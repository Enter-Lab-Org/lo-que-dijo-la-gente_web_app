import { createDatabase } from "./index.js";

describe("createDatabase", () => {
  it("builds the sqlite adapter by default", async () => {
    const db = createDatabase({ driver: "sqlite", url: ":memory:" });
    expect(await db.users.findByEmail("x@example.com")).toBeNull();
    db.close();
  });

  it("names the supported drivers when the driver is unknown", () => {
    expect(() => createDatabase({ driver: "mongo" })).toThrow('Unsupported DB_DRIVER "mongo". Supported: sqlite');
  });
});
