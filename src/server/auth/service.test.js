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
    expect(user).toEqual({ id: expect.any(Number), email: "host@example.com" });
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
});

describe("login and sessions", () => {
  it("returns a session token that resolves to the user; only its hash is stored", async () => {
    const { db, auth, now } = setup();
    await auth.createUser({ email: "host@example.com", password: "secreto123" });
    const r = await auth.login({ email: "HOST@example.com", password: "secreto123", ip: "1.1.1.1" });
    expect(r).toEqual({ ok: true, token: expect.any(String), expiresAt: now() + SESSION_TTL_MS, user: { id: expect.any(Number), email: "host@example.com" } });
    expect(r.token.length).toBeGreaterThanOrEqual(43);
    expect(await db.sessions.findByTokenHash(r.token)).toBeNull();
    expect(await db.sessions.findByTokenHash(hashToken(r.token))).not.toBeNull();
    expect(await auth.getSession(r.token)).toEqual({ userId: r.user.id, email: "host@example.com", expiresAt: r.expiresAt });
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
