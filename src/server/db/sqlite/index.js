import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DatabaseError } from "../errors.js";
import { migrate } from "./migrations.js";
import { DEFAULT_ROLE } from "../../../domain/roles.js";
import { BANK_SQL, ORDER, categoryNotFound, categoryTaken, isUniqueViolation, toCategory, toQuestions } from "../bankSql.js";

export const DEFAULT_SQLITE_URL = "data/ldlg.db";
const SQLITE_CONSTRAINT_UNIQUE = 2067;

// The last-ADMIN rule lives in the write itself (one atomic statement), so concurrent requests cannot both pass it.
const OTHER_ADMINS = "(SELECT COUNT(*) FROM users WHERE role = 'ADMIN') > 1";
const lastAdmin = () => new DatabaseError("LAST_ADMIN", "At least one ADMIN must remain");
const toUser = (r) => (r ? { id: Number(r.id), email: r.email, passwordHash: r.password_hash, role: r.role, createdAt: r.created_at } : null);

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
    insertUser: db.prepare("INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, ?, ?)"),
    insertSession: db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)"),
    session: db.prepare("SELECT s.token_hash, s.user_id, s.expires_at, u.email, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?"),
    deleteSession: db.prepare("DELETE FROM sessions WHERE token_hash = ?"),
    deleteExpired: db.prepare("DELETE FROM sessions WHERE expires_at <= ?"),
    listUsers: db.prepare("SELECT * FROM users ORDER BY email"),
    updateRole: db.prepare(`UPDATE users SET role = ? WHERE id = ? AND (role <> 'ADMIN' OR ? = 'ADMIN' OR ${OTHER_ADMINS})`),
    updatePassword: db.prepare("UPDATE users SET password_hash = ? WHERE id = ?"),
    deleteUser: db.prepare(`DELETE FROM users WHERE id = ? AND (role <> 'ADMIN' OR ${OTHER_ADMINS})`),
    deleteUserSessions: db.prepare("DELETE FROM sessions WHERE user_id = ?"),
  };

  // Async like any networked engine will be, so callers never depend on SQLite being synchronous.
  const users = {
    async findByEmail(email) { return toUser(q.userByEmail.get(email)); },
    async findById(id) { return toUser(q.userById.get(id)); },
    async create({ email, passwordHash, role = DEFAULT_ROLE, createdAt }) {
      try {
        const { lastInsertRowid } = q.insertUser.run(email, passwordHash, role, createdAt);
        return toUser(q.userById.get(lastInsertRowid));
      } catch (e) {
        if (e.errcode === SQLITE_CONSTRAINT_UNIQUE) throw new DatabaseError("EMAIL_TAKEN", "A user with this email already exists");
        throw e;
      }
    },
    async list() { return q.listUsers.all().map(toUser); },
    async updateRole(id, role) {
      if (q.updateRole.run(role, id, role).changes) return toUser(q.userById.get(id));
      if (q.userById.get(id)) throw lastAdmin();
      return null;
    },
    async updatePassword(id, passwordHash) { return q.updatePassword.run(passwordHash, id).changes ? toUser(q.userById.get(id)) : null; },
    // Sessions are removed explicitly too (same transaction), so this does not depend on foreign keys being enforced.
    async delete(id) {
      let deleted;
      db.exec("BEGIN IMMEDIATE");
      try {
        deleted = q.deleteUser.run(id).changes > 0;
        if (deleted) q.deleteUserSessions.run(id);
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      if (!deleted && q.userById.get(id)) throw lastAdmin();
      return deleted;
    },
  };

  const sessions = {
    async create({ tokenHash, userId, expiresAt, createdAt }) { q.insertSession.run(tokenHash, userId, expiresAt, createdAt); },
    async findByTokenHash(tokenHash) {
      const r = q.session.get(tokenHash);
      return r ? { tokenHash: r.token_hash, userId: Number(r.user_id), email: r.email, role: r.role, expiresAt: r.expires_at } : null;
    },
    async delete(tokenHash) { q.deleteSession.run(tokenHash); },
    async deleteExpired(now) { q.deleteExpired.run(now); },
    async deleteByUser(userId) { q.deleteUserSessions.run(userId); },
  };

  const tx = (fn) => {
    db.exec("BEGIN IMMEDIATE");
    try { const out = fn(); db.exec("COMMIT"); return out; } catch (e) { db.exec("ROLLBACK"); throw e; }
  };
  const loadQuestions = (rows) => {
    if (!rows.length) return [];
    return toQuestions(rows, db.prepare(BANK_SQL.answersOf(rows.length)).all(...rows.map((r) => r.id)));
  };

  const categories = {
    async list() { return db.prepare(BANK_SQL.listCategories).all().map(toCategory); },
    async create({ name, createdAt }) {
      try {
        const { lastInsertRowid } = db.prepare(BANK_SQL.insertCategory).run(name, createdAt);
        return toCategory(db.prepare(BANK_SQL.categoryById).get(lastInsertRowid));
      } catch (e) {
        if (isUniqueViolation(e)) throw categoryTaken();
        throw e;
      }
    },
    async delete(id) {
      return tx(() => { db.prepare(BANK_SQL.unlinkCategory).run(id); return db.prepare(BANK_SQL.deleteCategory).run(id).changes > 0; });
    },
  };

  const questions = {
    async list({ profile } = {}) {
      const rows = profile
        ? db.prepare(BANK_SQL.questions + " WHERE q.profile = ?" + ORDER).all(profile)
        : db.prepare(BANK_SQL.questions + ORDER).all();
      return loadQuestions(rows);
    },
    async create({ text, categoryId = null, profile, answers, createdAt }) {
      const id = tx(() => {
        const { changes, lastInsertRowid } = db.prepare(BANK_SQL.insertQuestion).run(text, categoryId, profile, createdAt);
        if (!changes) throw categoryNotFound();
        const insert = db.prepare(BANK_SQL.insertAnswer);
        answers.forEach((a, i) => insert.run(lastInsertRowid, a.text, a.points, i));
        return lastInsertRowid;
      });
      return loadQuestions(db.prepare(BANK_SQL.questions + " WHERE q.id = ?").all(id))[0];
    },
    async delete(id) {
      return tx(() => { db.prepare(BANK_SQL.deleteAnswers).run(id); return db.prepare(BANK_SQL.deleteQuestion).run(id).changes > 0; });
    },
    async setPicked({ profile, ids }) { db.prepare(BANK_SQL.setPicked).run(profile, JSON.stringify(ids)); },
  };

  return { users, sessions, categories, questions, close: () => db.close() };
}
