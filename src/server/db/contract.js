import { describe, it, expect, beforeEach, afterEach } from "vitest";

/* Behavior every database adapter must keep. Run it from each adapter's test with a factory that
   returns a fresh, empty database: describeRepositoryContract("sqlite", () => createSqliteDatabase(...)). */
export function describeRepositoryContract(name, createDb) {
  describe(`repository contract: ${name}`, () => {
    let db;
    beforeEach(async () => { db = await createDb(); });
    afterEach(async () => { await db.close(); });

    it("creates a user and finds it by email (case-insensitive) and id", async () => {
      const user = await db.users.create({ email: "host@example.com", passwordHash: "h1", createdAt: 10 });
      expect(user).toEqual({ id: expect.anything(), email: "host@example.com", passwordHash: "h1", role: "GUEST", createdAt: 10 });
      expect(await db.users.findByEmail("HOST@example.com")).toEqual(user);
      expect(await db.users.findById(user.id)).toEqual(user);
      expect(await db.users.findByEmail("nobody@example.com")).toBeNull();
      expect(await db.users.findById(999999)).toBeNull();
    });

    it("stores the given role and returns it with the user and the session", async () => {
      const user = await db.users.create({ email: "op@example.com", passwordHash: "h", role: "OPERADOR", createdAt: 1 });
      expect(user.role).toBe("OPERADOR");
      expect((await db.users.findByEmail("op@example.com")).role).toBe("OPERADOR");
      await db.sessions.create({ tokenHash: "t-op", userId: user.id, expiresAt: 500, createdAt: 1 });
      expect((await db.sessions.findByTokenHash("t-op")).role).toBe("OPERADOR");
    });

    it("rejects a duplicate email with code EMAIL_TAKEN", async () => {
      await db.users.create({ email: "a@example.com", passwordHash: "h", createdAt: 1 });
      await expect(db.users.create({ email: "A@example.com", passwordHash: "h", createdAt: 2 })).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
    });

    it("stores sessions by token hash and returns them with the user's email", async () => {
      const user = await db.users.create({ email: "s@example.com", passwordHash: "h", createdAt: 1 });
      await db.sessions.create({ tokenHash: "t1", userId: user.id, expiresAt: 500, createdAt: 1 });
      expect(await db.sessions.findByTokenHash("t1")).toEqual({ tokenHash: "t1", userId: user.id, email: "s@example.com", role: "GUEST", expiresAt: 500 });
      expect(await db.sessions.findByTokenHash("other")).toBeNull();
      await db.sessions.delete("t1");
      expect(await db.sessions.findByTokenHash("t1")).toBeNull();
    });

    it("deletes only expired sessions", async () => {
      const user = await db.users.create({ email: "e@example.com", passwordHash: "h", createdAt: 1 });
      await db.sessions.create({ tokenHash: "old", userId: user.id, expiresAt: 100, createdAt: 1 });
      await db.sessions.create({ tokenHash: "new", userId: user.id, expiresAt: 300, createdAt: 1 });
      await db.sessions.deleteExpired(200);
      expect(await db.sessions.findByTokenHash("old")).toBeNull();
      expect(await db.sessions.findByTokenHash("new")).not.toBeNull();
    });
  });
}
