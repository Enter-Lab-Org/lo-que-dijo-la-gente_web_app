import { DatabaseSync } from "node:sqlite";
import { MIGRATIONS } from "./migrations.js";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describeRepositoryContract } from "../contract.js";
import { createSqliteDatabase } from "./index.js";

describeRepositoryContract("sqlite (memory)", () => createSqliteDatabase({ url: ":memory:" }));

describe("sqlite file database", () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "ldlg-db-")); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("creates the folder and file, and keeps data after reopening (file: prefix accepted)", async () => {
    const url = "file:" + join(dir, "nested", "app.db");
    const a = createSqliteDatabase({ url });
    await a.users.create({ email: "keep@example.com", passwordHash: "h", createdAt: 1 });
    a.close();
    expect(existsSync(join(dir, "nested", "app.db"))).toBe(true);
    const b = createSqliteDatabase({ url });
    expect((await b.users.findByEmail("keep@example.com")).email).toBe("keep@example.com");
    b.close();
  });
});

describe("sqlite migration 2 (roles)", () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "ldlg-db-")); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("makes users created before roles existed ADMIN, and new users OPERADOR", async () => {
    const path = join(dir, "v1.db");
    const v1 = new DatabaseSync(path);
    v1.exec(MIGRATIONS[0]);
    v1.exec("PRAGMA user_version = 1");
    v1.prepare("INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)").run("old@example.com", "h", 1);
    v1.close();
    const db = createSqliteDatabase({ url: path });
    expect((await db.users.findByEmail("old@example.com")).role).toBe("ADMIN");
    expect((await db.users.create({ email: "new@example.com", passwordHash: "h", createdAt: 2 })).role).toBe("OPERADOR");
    db.close();
  });
});

describe("sqlite migration 3 (GUEST removed)", () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "ldlg-db-")); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("turns GUEST users into OPERADOR, keeps their sessions, and refuses GUEST afterwards", async () => {
    const path = join(dir, "v2.db");
    const v2 = new DatabaseSync(path);
    v2.exec(MIGRATIONS[0]); v2.exec(MIGRATIONS[1]); v2.exec("PRAGMA user_version = 2");
    v2.prepare("INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, ?, ?)").run("g@example.com", "h", "GUEST", 1);
    v2.prepare("INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, ?, ?)").run("a@example.com", "h", "ADMIN", 1);
    v2.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, 1, 500, 1)").run("tg");
    v2.close();
    const db = createSqliteDatabase({ url: path });
    expect((await db.users.list()).map((u) => `${u.email}:${u.role}`)).toEqual(["a@example.com:ADMIN", "g@example.com:OPERADOR"]);
    expect((await db.sessions.findByTokenHash("tg")).role).toBe("OPERADOR");
    await expect(db.users.create({ email: "n@example.com", passwordHash: "h", role: "GUEST", createdAt: 2 })).rejects.toThrow();
    db.close();
  });
});
