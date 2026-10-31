import { hashPassword, verifyPassword } from "./password.js";

describe("password hashing", () => {
  it("verifies the right password only and never stores it in clear", async () => {
    const hash = await hashPassword("correct horse");
    expect(hash).toMatch(/^scrypt\$/);
    expect(hash).not.toContain("correct horse");
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("uses a random salt", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("returns false for malformed hashes instead of throwing", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "scrypt$bad")).toBe(false);
    expect(await verifyPassword("x", "md5$1$2$3$4$5")).toBe(false);
  });
});
