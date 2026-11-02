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

  it("makes users created before roles existed ADMIN, and new users GUEST", async () => {
    const path = join(dir, "v1.db");
    const v1 = new DatabaseSync(path);
    v1.exec(MIGRATIONS[0]);
    v1.exec("PRAGMA user_version = 1");
    v1.prepare("INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)").run("old@example.com", "h", 1);
    v1.close();
    const db = createSqliteDatabase({ url: path });
    expect((await db.users.findByEmail("old@example.com")).role).toBe("ADMIN");
    expect((await db.users.create({ email: "new@example.com", passwordHash: "h", createdAt: 2 })).role).toBe("GUEST");
    db.close();
  });
});
