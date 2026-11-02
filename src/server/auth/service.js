import { createHash, randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "./password.js";
import { createRateLimiter } from "./rateLimit.js";
import { DEFAULT_ROLE, ROLE_LIST, isRole } from "../../domain/roles.js";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60_000;
export const MIN_PASSWORD = 8;
const MAX_PASSWORD = 1024; // scrypt cost grows with input; longer passwords are rejected before hashing
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

export const normalizeEmail = (email) => (typeof email === "string" ? email.trim().toLowerCase() : "");
// The database keeps only this hash: a leaked sessions table cannot be replayed as cookies.
export const hashToken = (token) => createHash("sha256").update(token).digest("base64url");

const FAILED = { ok: false, reason: "INVALID_CREDENTIALS" };
const publicUser = (u) => ({ id: u.id, email: u.email, role: u.role, createdAt: u.createdAt });
const notFound = () => new AuthError("NOT_FOUND", "Usuario no encontrado.");
// The database enforces "at least one ADMIN" atomically; this only translates its error.
const keepAdmin = (e) => {
  if (e?.code === "LAST_ADMIN") throw new AuthError("LAST_ADMIN", "Debe quedar al menos un ADMIN.");
  throw e;
};
function checkPassword(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
    throw new AuthError("WEAK_PASSWORD", `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
  }
}
function checkRole(role) {
  if (!isRole(role)) throw new AuthError("INVALID_ROLE", `Rol inválido. Usa uno de: ${ROLE_LIST.join(", ")}.`);
}

/* Login use cases over the repository ports. db: { users, sessions } from ../db. */
export function createAuthService({
  db,
  now = Date.now,
  sessionTtlMs = SESSION_TTL_MS,
  limiter = createRateLimiter({ max: 5 }),
  ipLimiter = createRateLimiter({ max: 20 }),
} = {}) {
  let dummyHash = null; // verified for unknown emails so both failures take the same time

  return {
    async createUser({ email, password, role = DEFAULT_ROLE }) {
      const e = normalizeEmail(email);
      if (!EMAIL_RE.test(e) || e.length > 254) throw new AuthError("INVALID_EMAIL", "Correo inválido.");
      checkRole(role);
      checkPassword(password);
      try {
        const user = await db.users.create({ email: e, passwordHash: await hashPassword(password), role, createdAt: now() });
        return publicUser(user);
      } catch (err) {
        if (err.code === "EMAIL_TAKEN") throw new AuthError("EMAIL_TAKEN", "Ya existe un usuario con ese correo.");
        throw err;
      }
    },

    // ip is null when it cannot be trusted: failures are then counted per email only.
    async login({ email, password, ip = null }) {
      const e = normalizeEmail(email);
      const checks = [[limiter, `${ip ?? "*"}|${e}`]];
      if (ip) checks.push([ipLimiter, `ip:${ip}`]);
      for (const [rl, key] of checks) {
        const c = rl.check(key);
        if (!c.allowed) return { ok: false, reason: "RATE_LIMITED", retryAfterMs: c.retryAfterMs };
      }
      // Count the attempt before any await: parallel requests would all pass the check otherwise.
      checks.forEach(([rl, key]) => rl.fail(key));
      if (!e || typeof password !== "string" || !password || password.length > MAX_PASSWORD) return FAILED;

      const user = await db.users.findByEmail(e);
      dummyHash ??= await hashPassword(randomBytes(16).toString("hex"));
      const ok = await verifyPassword(password, user ? user.passwordHash : dummyHash);
      if (!user || !ok) return FAILED;

      limiter.reset(checks[0][1]);
      const token = randomBytes(32).toString("base64url");
      const t = now(), expiresAt = t + sessionTtlMs;
      await db.sessions.deleteExpired(t);
      await db.sessions.create({ tokenHash: hashToken(token), userId: user.id, expiresAt, createdAt: t });
      return { ok: true, token, expiresAt, user: { id: user.id, email: user.email, role: user.role } };
    },

    async getSession(token) {
      if (typeof token !== "string" || !token) return null;
      const s = await db.sessions.findByTokenHash(hashToken(token));
      if (!s) return null;
      if (s.expiresAt <= now()) { await db.sessions.delete(s.tokenHash); return null; }
      return { userId: s.userId, email: s.email, role: s.role, expiresAt: s.expiresAt };
    },

    /* User administration. The caller (HTTP layer) has already checked that the actor may manage users.
       actorId is the signed-in admin: they cannot change their own role or delete themselves, so an ADMIN always remains. */
    async listUsers() { return (await db.users.list()).map(publicUser); },

    async setRole({ actorId, id, role }) {
      checkRole(role);
      if (id === actorId) throw new AuthError("SELF_ROLE", "No puedes cambiar tu propio rol.");
      const user = await db.users.updateRole(id, role).catch(keepAdmin);
      if (!user) throw notFound();
      return publicUser(user);
    },

    // Ends every session of that user, so a leaked or old password stops working right away.
    async resetPassword({ id, password }) {
      checkPassword(password);
      const user = await db.users.updatePassword(id, await hashPassword(password));
      if (!user) throw notFound();
      await db.sessions.deleteByUser(id);
      return publicUser(user);
    },

    async deleteUser({ actorId, id }) {
      if (id === actorId) throw new AuthError("SELF_DELETE", "No puedes eliminar tu propio usuario.");
      if (!(await db.users.delete(id).catch(keepAdmin))) throw notFound();
    },

    async logout(token) {
      if (typeof token === "string" && token) await db.sessions.delete(hashToken(token));
    },
  };
}
