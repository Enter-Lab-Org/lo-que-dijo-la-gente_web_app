import { createSqliteDatabase } from "../db/sqlite/index.js";
import { createRateLimiter } from "./rateLimit.js";
import { createAuthService, hashToken, SESSION_TTL_MS } from "./service.js";

const setup = (opts = {}) => {
  let t = 1_000;
  const db = createSqliteDatabase({ url: ":memory:" });
  const auth = createAuthService({ db, now: () => t, ...opts });
  return { db, auth, advance: (ms) => { t += ms; }, now: () => t };
};

describe("createUser", () => {
  it("normalizes the email and stores only a hash", async () => {
    const { db, auth } = setup();
    const user = await auth.createUser({ email: "  Host@Example.COM ", password: "secreto123" });
    expect(user).toEqual({ id: expect.any(Number), email: "host@example.com", role: "GUEST", createdAt: 1_000 });
    const row = await db.users.findByEmail("host@example.com");
    expect(row.passwordHash).toMatch(/^scrypt\$/);
    expect(row.passwordHash).not.toContain("secreto123");
  });

  it("rejects invalid emails, short passwords and duplicates with explicit codes", async () => {
    const { auth } = setup();
    await expect(auth.createUser({ email: "no-at", password: "secreto123" })).rejects.toMatchObject({ code: "INVALID_EMAIL" });
    await expect(auth.createUser({ email: "a@b.co", password: "corta" })).rejects.toMatchObject({ code: "WEAK_PASSWORD" });
    await auth.createUser({ email: "a@b.co", password: "secreto123" });
    await expect(auth.createUser({ email: "A@B.co", password: "secreto123" })).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
  });

  it("stores the requested role and rejects unknown ones", async () => {
    const { db, auth } = setup();
    expect((await auth.createUser({ email: "op@b.co", password: "secreto123", role: "OPERADOR" })).role).toBe("OPERADOR");
    expect((await db.users.findByEmail("op@b.co")).role).toBe("OPERADOR");
    await expect(auth.createUser({ email: "x@b.co", password: "secreto123", role: "admin" }))
      .rejects.toMatchObject({ code: "INVALID_ROLE", message: "Rol inválido. Usa uno de: ADMIN, OPERADOR, GUEST." });
    expect(await db.users.findByEmail("x@b.co")).toBeNull();
  });

  it("returns the user's role with the login and the session", async () => {
    const { auth } = setup();
    await auth.createUser({ email: "admin@b.co", password: "secreto123", role: "ADMIN" });
    const r = await auth.login({ email: "admin@b.co", password: "secreto123" });
    expect(r.user.role).toBe("ADMIN");
    expect((await auth.getSession(r.token)).role).toBe("ADMIN");
  });
});

describe("login and sessions", () => {
  it("returns a session token that resolves to the user; only its hash is stored", async () => {
    const { db, auth, now } = setup();
    await auth.createUser({ email: "host@example.com", password: "secreto123" });
    const r = await auth.login({ email: "HOST@example.com", password: "secreto123", ip: "1.1.1.1" });
    expect(r).toEqual({ ok: true, token: expect.any(String), expiresAt: now() + SESSION_TTL_MS, user: { id: expect.any(Number), email: "host@example.com", role: "GUEST" } });
    expect(r.token.length).toBeGreaterThanOrEqual(43);
    expect(await db.sessions.findByTokenHash(r.token)).toBeNull();
    expect(await db.sessions.findByTokenHash(hashToken(r.token))).not.toBeNull();
    expect(await auth.getSession(r.token)).toEqual({ userId: r.user.id, email: "host@example.com", role: "GUEST", expiresAt: r.expiresAt });
  });

  it("gives the same generic failure for a wrong password and an unknown email", async () => {
    const { auth } = setup();
    await auth.createUser({ email: "host@example.com", password: "secreto123" });
    const wrong = await auth.login({ email: "host@example.com", password: "nope-nope", ip: "1" });
    const unknown = await auth.login({ email: "ghost@example.com", password: "secreto123", ip: "1" });
    expect(wrong).toEqual({ ok: false, reason: "INVALID_CREDENTIALS" });
    expect(unknown).toEqual(wrong);
    expect(await auth.login({ email: "host@example.com", password: "x".repeat(2000), ip: "1" })).toEqual(wrong);
    expect(await auth.login({ email: 42, password: null, ip: "1" })).toEqual(wrong);
  });

  it("rate limits repeated failures per ip+email, even with the right password, until the window passes", async () => {
    const { auth, advance } = setup({ limiter: createRateLimiter({ max: 3, windowMs: 60_000, now: () => 0 }) });
    await auth.createUser({ email: "host@example.com", password: "secreto123" });
    for (let i = 0; i < 3; i++) await auth.login({ email: "host@example.com", password: "bad-pass", ip: "9" });
    const r = await auth.login({ email: "host@example.com", password: "secreto123", ip: "9" });
    expect(r).toEqual({ ok: false, reason: "RATE_LIMITED", retryAfterMs: 60_000 });
    expect((await auth.login({ email: "host@example.com", password: "secreto123", ip: "8" })).ok).toBe(true);
    advance(0);
  });

  it("counts attempts before checking the password, so a parallel burst cannot pass the limit", async () => {
    const { auth } = setup({ limiter: createRateLimiter({ max: 3, windowMs: 60_000, now: () => 0 }) });
    await auth.createUser({ email: "host@example.com", password: "secreto123" });
    const burst = await Promise.all(Array.from({ length: 10 }, () => auth.login({ email: "host@example.com", password: "bad-pass", ip: "7" })));
    expect(burst.filter((r) => r.reason === "INVALID_CREDENTIALS")).toHaveLength(3);
    expect(burst.filter((r) => r.reason === "RATE_LIMITED")).toHaveLength(7);
  });

  it("a successful login clears the failures for that email", async () => {
    const { auth } = setup({ limiter: createRateLimiter({ max: 3, windowMs: 60_000, now: () => 0 }) });
    await auth.createUser({ email: "host@example.com", password: "secreto123" });
    for (let i = 0; i < 2; i++) await auth.login({ email: "host@example.com", password: "bad-pass", ip: "7" });
    expect((await auth.login({ email: "host@example.com", password: "secreto123", ip: "7" })).ok).toBe(true);
    for (let i = 0; i < 2; i++) await auth.login({ email: "host@example.com", password: "bad-pass", ip: "7" });
    expect((await auth.login({ email: "host@example.com", password: "secreto123", ip: "7" })).ok).toBe(true);
  });

  it("expires sessions after the TTL and deletes them", async () => {
    const { db, auth, advance } = setup();
    await auth.createUser({ email: "host@example.com", password: "secreto123" });
    const { token } = await auth.login({ email: "host@example.com", password: "secreto123", ip: "1" });
    advance(SESSION_TTL_MS);
    expect(await auth.getSession(token)).toBeNull();
    expect(await db.sessions.findByTokenHash(hashToken(token))).toBeNull();
  });

  it("logout deletes the session; empty or unknown tokens resolve to null", async () => {
    const { auth } = setup();
    await auth.createUser({ email: "host@example.com", password: "secreto123" });
    const { token } = await auth.login({ email: "host@example.com", password: "secreto123", ip: "1" });
    await auth.logout(token);
    expect(await auth.getSession(token)).toBeNull();
    expect(await auth.getSession("")).toBeNull();
    expect(await auth.getSession(undefined)).toBeNull();
    await expect(auth.logout(undefined)).resolves.toBeUndefined();
  });
});

describe("user administration", () => {
  const admin = async () => {
    const ctx = setup();
    const me = await ctx.auth.createUser({ email: "admin@b.co", password: "secreto123", role: "ADMIN" });
    const other = await ctx.auth.createUser({ email: "op@b.co", password: "secreto123", role: "OPERADOR" });
    return { ...ctx, me, other };
  };

  it("lists users without password hashes", async () => {
    const { auth } = await admin();
    expect(await auth.listUsers()).toEqual([
      { id: expect.any(Number), email: "admin@b.co", role: "ADMIN", createdAt: 1_000 },
      { id: expect.any(Number), email: "op@b.co", role: "OPERADOR", createdAt: 1_000 },
    ]);
  });

  it("changes another user's role; the session sees it on the next request", async () => {
    const { auth, me, other } = await admin();
    const { token } = await auth.login({ email: "op@b.co", password: "secreto123" });
    expect(await auth.setRole({ actorId: me.id, id: other.id, role: "GUEST" })).toEqual({ id: other.id, email: "op@b.co", role: "GUEST", createdAt: 1_000 });
    expect((await auth.getSession(token)).role).toBe("GUEST");
  });

  it("rejects changing your own role, an unknown role and an unknown user", async () => {
    const { auth, me, other } = await admin();
    await expect(auth.setRole({ actorId: me.id, id: me.id, role: "GUEST" })).rejects.toMatchObject({ code: "SELF_ROLE", message: "No puedes cambiar tu propio rol." });
    await expect(auth.setRole({ actorId: me.id, id: other.id, role: "ROOT" })).rejects.toMatchObject({ code: "INVALID_ROLE" });
    await expect(auth.setRole({ actorId: me.id, id: 999, role: "GUEST" })).rejects.toMatchObject({ code: "NOT_FOUND", message: "Usuario no encontrado." });
    expect((await auth.listUsers()).map((u) => u.role)).toEqual(["ADMIN", "OPERADOR"]);
  });

  it("resets a password: the new one works, the old one does not, and the user's sessions end", async () => {
    const { auth, other } = await admin();
    const { token } = await auth.login({ email: "op@b.co", password: "secreto123" });
    expect(await auth.resetPassword({ id: other.id, password: "nueva-clave-1" })).toMatchObject({ id: other.id, email: "op@b.co" });
    expect(await auth.getSession(token)).toBeNull();
    expect((await auth.login({ email: "op@b.co", password: "secreto123" })).ok).toBe(false);
    expect((await auth.login({ email: "op@b.co", password: "nueva-clave-1" })).ok).toBe(true);
  });

  it("rejects a short password and an unknown user on reset", async () => {
    const { auth, other } = await admin();
    await expect(auth.resetPassword({ id: other.id, password: "corta" })).rejects.toMatchObject({ code: "WEAK_PASSWORD" });
    await expect(auth.resetPassword({ id: 999, password: "secreto123" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("deletes another user and its sessions, but never yourself", async () => {
    const { auth, me, other } = await admin();
    const { token } = await auth.login({ email: "op@b.co", password: "secreto123" });
    await auth.deleteUser({ actorId: me.id, id: other.id });
    expect(await auth.getSession(token)).toBeNull();
    expect((await auth.listUsers()).map((u) => u.email)).toEqual(["admin@b.co"]);
    await expect(auth.deleteUser({ actorId: me.id, id: me.id })).rejects.toMatchObject({ code: "SELF_DELETE", message: "No puedes eliminar tu propio usuario." });
    await expect(auth.deleteUser({ actorId: me.id, id: other.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
