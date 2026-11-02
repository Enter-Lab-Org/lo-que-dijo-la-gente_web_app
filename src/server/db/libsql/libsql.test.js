import { createClient } from "@libsql/client";
import { MIGRATIONS } from "../sqlite/migrations.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describeRepositoryContract } from "../contract.js";
import { createLibsqlDatabase } from "./index.js";

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

  it("makes users created before roles existed ADMIN, and new users GUEST", async () => {
    const url = "file:" + join(dir, "v1.db");
    const v1 = createClient({ url });
    await v1.executeMultiple(MIGRATIONS[0]);
    await v1.execute("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY)");
    await v1.execute("INSERT INTO schema_migrations (version) VALUES (1)");
    await v1.execute({ sql: "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)", args: ["old@example.com", "h", 1] });
    v1.close();
    const db = createLibsqlDatabase({ url });
    expect((await db.users.findByEmail("old@example.com")).role).toBe("ADMIN");
    expect((await db.users.create({ email: "new@example.com", passwordHash: "h", createdAt: 2 })).role).toBe("GUEST");
    db.close();
  });
});
