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
