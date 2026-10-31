import { createSqliteDatabase } from "../db/sqlite/index.js";
import { createAuthService } from "../auth/service.js";
import { createRateLimiter } from "../auth/rateLimit.js";
import { clientIp, handleLogin, handleLogout, readSessionToken, SESSION_COOKIE } from "./handlers.js";

const ORIGIN = "http://localhost:8081";
const post = (path, body, headers = {}) => new Request(ORIGIN + path, {
  method: "POST",
  headers: { host: "localhost:8081", origin: ORIGIN, "content-type": "application/json", ...headers },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

const setup = async (opts) => {
  const db = createSqliteDatabase({ url: ":memory:" });
  const auth = createAuthService({ db, ...opts });
  await auth.createUser({ email: "host@example.com", password: "secreto123" });
  return { auth };
};

describe("POST /api/auth/login", () => {
  it("sets an HttpOnly SameSite=Lax session cookie on success", async () => {
    const { auth } = await setup();
    const res = await handleLogin(post("/api/auth/login", { email: "host@example.com", password: "secreto123" }), { auth, secureCookie: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, user: { email: "host@example.com" } });
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toMatch(new RegExp(`^${SESSION_COOKIE}=[A-Za-z0-9_-]{43}; Path=/; Expires=`));
    expect(cookie).toContain("; HttpOnly; SameSite=Lax; Secure");
    const token = cookie.split(";")[0].split("=")[1];
    expect((await auth.getSession(token)).email).toBe("host@example.com");
  });

  it("omits Secure when secureCookie is false (plain http on a LAN)", async () => {
    const { auth } = await setup();
    const res = await handleLogin(post("/api/auth/login", { email: "host@example.com", password: "secreto123" }), { auth, secureCookie: false });
    expect(res.headers.get("set-cookie")).not.toContain("Secure");
  });

  it("returns 401 with a generic message and no cookie on bad credentials", async () => {
    const { auth } = await setup();
    for (const body of [{ email: "host@example.com", password: "mala-clave" }, { email: "ghost@example.com", password: "secreto123" }]) {
      const res = await handleLogin(post("/api/auth/login", body), { auth });
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Correo o contraseña incorrectos." });
      expect(res.headers.get("set-cookie")).toBeNull();
    }
  });

  it("returns 429 with Retry-After when rate limited", async () => {
    const { auth } = await setup({ limiter: createRateLimiter({ max: 1, windowMs: 120_000, now: () => 0 }) });
    await handleLogin(post("/api/auth/login", { email: "host@example.com", password: "mala-clave" }), { auth });
    const res = await handleLogin(post("/api/auth/login", { email: "host@example.com", password: "secreto123" }), { auth });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("120");
    expect(await res.json()).toEqual({ error: "Demasiados intentos. Intenta de nuevo en 2 min." });
  });

  it("rejects cross-origin or origin-less requests with 403 and malformed bodies with 400", async () => {
    const { auth } = await setup();
    const body = { email: "host@example.com", password: "secreto123" };
    const evil = await handleLogin(post("/api/auth/login", body, { origin: "https://evil.example" }), { auth });
    expect(evil.status).toBe(403);
    expect(await evil.json()).toEqual({ error: "Origen no permitido." });
    const noOrigin = new Request(ORIGIN + "/api/auth/login", { method: "POST", headers: { host: "localhost:8081" }, body: JSON.stringify(body) });
    expect((await handleLogin(noOrigin, { auth })).status).toBe(403);
    for (const bad of ["{nope", "null", "[]", "x".repeat(20_000)]) {
      const res = await handleLogin(post("/api/auth/login", bad), { auth });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Solicitud inválida." });
    }
  });
});

describe("POST /api/auth/logout", () => {
  it("deletes the session and clears the cookie", async () => {
    const { auth } = await setup();
    const { token } = await auth.login({ email: "host@example.com", password: "secreto123" });
    const res = await handleLogout(post("/api/auth/logout", "", { cookie: `other=1; ${SESSION_COOKIE}=${token}` }), { auth });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(new RegExp(`^${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`));
    expect(await auth.getSession(token)).toBeNull();
  });

  it("refuses a cross-origin logout and keeps the session", async () => {
    const { auth } = await setup();
    const { token } = await auth.login({ email: "host@example.com", password: "secreto123" });
    const res = await handleLogout(post("/api/auth/logout", "", { origin: "https://evil.example", cookie: `${SESSION_COOKIE}=${token}` }), { auth });
    expect(res.status).toBe(403);
    expect(await auth.getSession(token)).not.toBeNull();
  });
});

describe("helpers", () => {
  it("reads the session token from a Cookie header", () => {
    expect(readSessionToken(`a=1; ${SESSION_COOKIE}=abc; b=2`)).toBe("abc");
    expect(readSessionToken("a=1")).toBeNull();
    expect(readSessionToken(null)).toBeNull();
  });

  it("trusts X-Forwarded-For only behind a declared proxy, using the last hop", () => {
    const req = (xff) => new Request(ORIGIN, { headers: xff ? { "x-forwarded-for": xff } : {} });
    expect(clientIp(req("6.6.6.6, 10.0.0.1"), { trustProxy: false })).toBeNull();
    expect(clientIp(req("6.6.6.6, 10.0.0.1"), { trustProxy: true })).toBe("10.0.0.1");
    expect(clientIp(req(null), { trustProxy: true })).toBeNull();
  });
});
