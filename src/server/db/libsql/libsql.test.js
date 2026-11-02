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
