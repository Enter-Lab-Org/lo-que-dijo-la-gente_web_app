import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DatabaseError } from "../errors.js";
import { migrate } from "./migrations.js";

export const DEFAULT_SQLITE_URL = "data/ldlg.db";
const SQLITE_CONSTRAINT_UNIQUE = 2067;

const toUser = (r) => (r ? { id: Number(r.id), email: r.email, passwordHash: r.password_hash, createdAt: r.created_at } : null);

/* SQLite adapter for the repository ports (see ../contract.js). url: a file path, "file:<path>" or ":memory:". */
export function createSqliteDatabase({ url = DEFAULT_SQLITE_URL } = {}) {
  const path = String(url).replace(/^file:/, "");
  if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  migrate(db);

  const q = {
    userByEmail: db.prepare("SELECT * FROM users WHERE email = ?"),
    userById: db.prepare("SELECT * FROM users WHERE id = ?"),
    insertUser: db.prepare("INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)"),
    insertSession: db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)"),
    session: db.prepare("SELECT s.token_hash, s.user_id, s.expires_at, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?"),
    deleteSession: db.prepare("DELETE FROM sessions WHERE token_hash = ?"),
    deleteExpired: db.prepare("DELETE FROM sessions WHERE expires_at <= ?"),
  };

  // Async like any networked engine will be, so callers never depend on SQLite being synchronous.
  const users = {
    async findByEmail(email) { return toUser(q.userByEmail.get(email)); },
    async findById(id) { return toUser(q.userById.get(id)); },
    async create({ email, passwordHash, createdAt }) {
      try {
        const { lastInsertRowid } = q.insertUser.run(email, passwordHash, createdAt);
        return toUser(q.userById.get(lastInsertRowid));
      } catch (e) {
        if (e.errcode === SQLITE_CONSTRAINT_UNIQUE) throw new DatabaseError("EMAIL_TAKEN", "A user with this email already exists");
        throw e;
      }
    },
  };

  const sessions = {
    async create({ tokenHash, userId, expiresAt, createdAt }) { q.insertSession.run(tokenHash, userId, expiresAt, createdAt); },
    async findByTokenHash(tokenHash) {
      const r = q.session.get(tokenHash);
      return r ? { tokenHash: r.token_hash, userId: Number(r.user_id), email: r.email, expiresAt: r.expires_at } : null;
    },
    async delete(tokenHash) { q.deleteSession.run(tokenHash); },
    async deleteExpired(now) { q.deleteExpired.run(now); },
  };

  return { users, sessions, close: () => db.close() };
}
