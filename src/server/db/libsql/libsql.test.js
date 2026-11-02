import { createClient } from "@libsql/client";
import { MIGRATIONS } from "../sqlite/migrations.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describeRepositoryContract } from "../contract.js";
import { createLibsqlDatabase, statements } from "./index.js";

// Same contract as every adapter, run against a local libSQL engine so it needs no network or Turso account.
describeRepositoryContract("libsql (memory)", () => createLibsqlDatabase({ url: ":memory:" }));

describe("libsql file database", () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "ldlg-libsql-")); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("keeps data after reopening and does not re-run applied migrations", async () => {
    const url = "file:" + join(dir, "app.db");
    const a = createLibsqlDatabase({ url });
    await a.users.create({ email: "keep@example.com", passwordHash: "h", createdAt: 1 });
    a.close();
    const b = createLibsqlDatabase({ url });
    expect((await b.users.findByEmail("keep@example.com")).email).toBe("keep@example.com");
    b.close();
  });

  it("requires a url", () => {
    expect(() => createLibsqlDatabase({})).toThrow("DATABASE_URL is required for DB_DRIVER=libsql");
  });
});

describe("libsql migration 2 (roles)", () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "ldlg-libsql-")); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("makes users created before roles existed ADMIN, and new users OPERADOR", async () => {
    const url = "file:" + join(dir, "v1.db");
    const v1 = createClient({ url });
    await v1.executeMultiple(MIGRATIONS[0]);
    await v1.execute("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY)");
    await v1.execute("INSERT INTO schema_migrations (version) VALUES (1)");
    await v1.execute({ sql: "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)", args: ["old@example.com", "h", 1] });
    v1.close();
    const db = createLibsqlDatabase({ url });
    expect((await db.users.findByEmail("old@example.com")).role).toBe("ADMIN");
    expect((await db.users.create({ email: "new@example.com", passwordHash: "h", createdAt: 2 })).role).toBe("OPERADOR");
    db.close();
  });
});

describe("libsql migration 3 (GUEST removed)", () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "ldlg-libsql-")); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("turns GUEST users into OPERADOR, keeps their sessions, and refuses GUEST afterwards", async () => {
    const url = "file:" + join(dir, "v2.db");
    const v2 = createClient({ url });
    await v2.executeMultiple(MIGRATIONS[0]);
    await v2.executeMultiple(MIGRATIONS[1]);
    await v2.execute("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY)");
    await v2.execute("INSERT INTO schema_migrations (version) VALUES (1), (2)");
    await v2.execute("INSERT INTO users (email, password_hash, role, created_at) VALUES ('g@example.com', 'h', 'GUEST', 1), ('a@example.com', 'h', 'ADMIN', 1)");
    await v2.execute("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES ('tg', 1, 500, 1)");
    v2.close();
    const db = createLibsqlDatabase({ url });
    expect((await db.users.list()).map((u) => `${u.email}:${u.role}`)).toEqual(["a@example.com:ADMIN", "g@example.com:OPERADOR"]);
    expect((await db.sessions.findByTokenHash("tg")).role).toBe("OPERADOR");
    await expect(db.users.create({ email: "n@example.com", passwordHash: "h", role: "GUEST", createdAt: 2 })).rejects.toThrow();
    db.close();
  });
});

describe("libsql concurrent startup", () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "ldlg-libsql-")); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("lets several instances migrate the same new database at once; all of them work", async () => {
    const url = "file:" + join(dir, "shared.db");
    const dbs = [1, 2, 3, 4].map(() => createLibsqlDatabase({ url }));
    const results = await Promise.allSettled(dbs.map((db, i) => db.users.create({ email: `u${i}@example.com`, passwordHash: "h", createdAt: 1 })));
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "fulfilled", "fulfilled", "fulfilled"]);
    expect((await dbs[0].users.list()).map((u) => u.role)).toEqual(["OPERADOR", "OPERADOR", "OPERADOR", "OPERADOR"]);
    const check = createClient({ url });
    expect((await check.execute("SELECT version FROM schema_migrations ORDER BY version")).rows.map((r) => Number(r.version))).toEqual([1, 2, 3]);
    check.close();
    dbs.forEach((db) => db.close());
  });
});

describe("libsql migration recovery", () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "ldlg-libsql-")); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("retries a failed migration on the next query instead of failing until restart", async () => {
    const url = "file:" + join(dir, "blocked.db");
    const blocker = createClient({ url });
    await blocker.execute("CREATE VIEW users AS SELECT 1 AS id"); // makes migration 1 fail
    const db = createLibsqlDatabase({ url });
    await expect(db.users.findByEmail("a@example.com")).rejects.toThrow();
    await blocker.execute("DROP VIEW users");
    blocker.close();
    expect((await db.users.create({ email: "a@example.com", passwordHash: "h", createdAt: 1 })).role).toBe("OPERADOR");
    db.close();
  });
});

describe("libsql migration statements", () => {
  it("splits on ';' but keeps a CREATE TRIGGER body whole", () => {
    expect(statements(`UPDATE t SET a = 1;
      CREATE TRIGGER x BEFORE INSERT ON t WHEN NEW.a > 1
        BEGIN SELECT RAISE(ABORT, 'no'); END;
      CREATE INDEX i ON t(a);`)).toEqual([
      "UPDATE t SET a = 1",
      "CREATE TRIGGER x BEFORE INSERT ON t WHEN NEW.a > 1\n        BEGIN SELECT RAISE(ABORT, 'no'); END",
      "CREATE INDEX i ON t(a)",
    ]);
  });
});
