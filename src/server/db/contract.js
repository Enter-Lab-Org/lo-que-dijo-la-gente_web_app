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
      expect(user).toEqual({ id: expect.anything(), email: "host@example.com", passwordHash: "h1", role: "OPERADOR", createdAt: 10 });
      expect(await db.users.findByEmail("HOST@example.com")).toEqual(user);
      expect(await db.users.findById(user.id)).toEqual(user);
      expect(await db.users.findByEmail("nobody@example.com")).toBeNull();
      expect(await db.users.findById(999999)).toBeNull();
    });

    it("stores the given role and returns it with the user and the session", async () => {
      const user = await db.users.create({ email: "op@example.com", passwordHash: "h", role: "ADMIN", createdAt: 1 });
      expect(user.role).toBe("ADMIN");
      expect((await db.users.findByEmail("op@example.com")).role).toBe("ADMIN");
      await db.sessions.create({ tokenHash: "t-op", userId: user.id, expiresAt: 500, createdAt: 1 });
      expect((await db.sessions.findByTokenHash("t-op")).role).toBe("ADMIN");
    });

    it("refuses to store the removed GUEST role, on insert and on update", async () => {
      await expect(db.users.create({ email: "g@example.com", passwordHash: "h", role: "GUEST", createdAt: 1 })).rejects.toThrow();
      expect(await db.users.findByEmail("g@example.com")).toBeNull();
      const user = await db.users.create({ email: "u2@example.com", passwordHash: "h", createdAt: 1 });
      await expect(db.users.updateRole(user.id, "GUEST")).rejects.toThrow();
      expect((await db.users.findById(user.id)).role).toBe("OPERADOR");
    });

    it("rejects a duplicate email with code EMAIL_TAKEN", async () => {
      await db.users.create({ email: "a@example.com", passwordHash: "h", createdAt: 1 });
      await expect(db.users.create({ email: "A@example.com", passwordHash: "h", createdAt: 2 })).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
    });

    it("stores sessions by token hash and returns them with the user's email", async () => {
      const user = await db.users.create({ email: "s@example.com", passwordHash: "h", createdAt: 1 });
      await db.sessions.create({ tokenHash: "t1", userId: user.id, expiresAt: 500, createdAt: 1 });
      expect(await db.sessions.findByTokenHash("t1")).toEqual({ tokenHash: "t1", userId: user.id, email: "s@example.com", role: "OPERADOR", expiresAt: 500 });
      expect(await db.sessions.findByTokenHash("other")).toBeNull();
      await db.sessions.delete("t1");
      expect(await db.sessions.findByTokenHash("t1")).toBeNull();
    });

    it("lists users ordered by email", async () => {
      await db.users.create({ email: "b@example.com", passwordHash: "h", role: "ADMIN", createdAt: 1 });
      await db.users.create({ email: "a@example.com", passwordHash: "h", createdAt: 2 });
      expect((await db.users.list()).map((u) => [u.email, u.role, u.createdAt])).toEqual([["a@example.com", "OPERADOR", 2], ["b@example.com", "ADMIN", 1]]);
    });

    it("updates a user's role and password hash, returning the user, or null when it does not exist", async () => {
      const user = await db.users.create({ email: "u@example.com", passwordHash: "old", createdAt: 1 });
      expect(await db.users.updateRole(user.id, "OPERADOR")).toMatchObject({ id: user.id, role: "OPERADOR", passwordHash: "old" });
      expect(await db.users.updatePassword(user.id, "new")).toMatchObject({ id: user.id, role: "OPERADOR", passwordHash: "new" });
      expect(await db.users.updateRole(999999, "ADMIN")).toBeNull();
      expect(await db.users.updatePassword(999999, "x")).toBeNull();
    });

    it("deletes a user together with its sessions, and reports whether it existed", async () => {
      const user = await db.users.create({ email: "d@example.com", passwordHash: "h", createdAt: 1 });
      const other = await db.users.create({ email: "o@example.com", passwordHash: "h", createdAt: 1 });
      await db.sessions.create({ tokenHash: "d1", userId: user.id, expiresAt: 500, createdAt: 1 });
      await db.sessions.create({ tokenHash: "o1", userId: other.id, expiresAt: 500, createdAt: 1 });
      expect(await db.users.delete(user.id)).toBe(true);
      expect(await db.users.findById(user.id)).toBeNull();
      expect(await db.sessions.findByTokenHash("d1")).toBeNull();
      expect(await db.sessions.findByTokenHash("o1")).not.toBeNull();
      expect(await db.users.delete(user.id)).toBe(false);
    });

    it("never leaves zero ADMINs, even when two admins act on each other at the same time", async () => {
      const a = await db.users.create({ email: "a@example.com", passwordHash: "h", role: "ADMIN", createdAt: 1 });
      const b = await db.users.create({ email: "b@example.com", passwordHash: "h", role: "ADMIN", createdAt: 1 });
      await db.sessions.create({ tokenHash: "sa", userId: a.id, expiresAt: 500, createdAt: 1 });
      const demotions = await Promise.allSettled([db.users.updateRole(a.id, "OPERADOR"), db.users.updateRole(b.id, "OPERADOR")]);
      expect(demotions.filter((r) => r.status === "rejected").map((r) => r.reason.code)).toEqual(["LAST_ADMIN"]);
      expect((await db.users.list()).filter((u) => u.role === "ADMIN")).toHaveLength(1);
      const [last] = (await db.users.list()).filter((u) => u.role === "ADMIN");
      await expect(db.users.delete(last.id)).rejects.toMatchObject({ code: "LAST_ADMIN" });
      await expect(db.users.updateRole(last.id, "OPERADOR")).rejects.toMatchObject({ code: "LAST_ADMIN" });
      expect(await db.users.updateRole(last.id, "ADMIN")).toMatchObject({ role: "ADMIN" });
      expect(await db.users.findById(last.id)).not.toBeNull();
      if (last.id === a.id) expect(await db.sessions.findByTokenHash("sa")).not.toBeNull();
    });

    it("rejects concurrent mutual deletes of the last two ADMINs, keeping one", async () => {
      const a = await db.users.create({ email: "a@example.com", passwordHash: "h", role: "ADMIN", createdAt: 1 });
      const b = await db.users.create({ email: "b@example.com", passwordHash: "h", role: "ADMIN", createdAt: 1 });
      const results = await Promise.allSettled([db.users.delete(a.id), db.users.delete(b.id)]);
      expect(results.filter((r) => r.status === "rejected").map((r) => r.reason.code)).toEqual(["LAST_ADMIN"]);
      expect((await db.users.list()).map((u) => u.role)).toEqual(["ADMIN"]);
    });

    it("deletes all sessions of one user only", async () => {
      const user = await db.users.create({ email: "s1@example.com", passwordHash: "h", createdAt: 1 });
      const other = await db.users.create({ email: "s2@example.com", passwordHash: "h", createdAt: 1 });
      await db.sessions.create({ tokenHash: "a", userId: user.id, expiresAt: 500, createdAt: 1 });
      await db.sessions.create({ tokenHash: "b", userId: user.id, expiresAt: 500, createdAt: 1 });
      await db.sessions.create({ tokenHash: "c", userId: other.id, expiresAt: 500, createdAt: 1 });
      await db.sessions.deleteByUser(user.id);
      expect(await db.sessions.findByTokenHash("a")).toBeNull();
      expect(await db.sessions.findByTokenHash("b")).toBeNull();
      expect(await db.sessions.findByTokenHash("c")).not.toBeNull();
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
