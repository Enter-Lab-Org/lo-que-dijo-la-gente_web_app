import { createClient } from "@libsql/client";
import { DatabaseError } from "../errors.js";
import { MIGRATIONS } from "../sqlite/migrations.js";
import { DEFAULT_ROLE } from "../../../domain/roles.js";
import { BANK_SQL, ORDER, categoryNotFound, categoryTaken, isUniqueViolation, toCategory, toQuestions } from "../bankSql.js";

const SQLITE_CONSTRAINT_UNIQUE = 2067;
// The last-ADMIN rule lives in the write itself (one atomic statement), so concurrent requests cannot both pass it.
const OTHER_ADMINS = "(SELECT COUNT(*) FROM users WHERE role = 'ADMIN') > 1";
const lastAdmin = () => new DatabaseError("LAST_ADMIN", "At least one ADMIN must remain");
const toUser = (r) => (r ? { id: Number(r.id), email: r.email, passwordHash: r.password_hash, role: r.role, createdAt: Number(r.created_at) } : null);

// Splits a migration into statements for one atomic batch. The shared migrations hold no ";" inside string literals;
// the only ";" that does not end a statement is inside a CREATE TRIGGER body, which runs until its END.
export function statements(sql) {
  const out = [];
  let current = "";
  for (const part of sql.split(";")) {
    current = current ? `${current};${part}` : part;
    const trimmed = current.trim();
    if (/^CREATE\s+TRIGGER\b/i.test(trimmed) && !/\bEND$/i.test(trimmed)) continue;
    if (trimmed) out.push(trimmed);
    current = "";
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/* Applies pending MIGRATIONS. Versions live in a table (not PRAGMA user_version) so it also works on remote Turso.
   Each step and its version row run in one write batch: atomic, and a single request on remote Turso.
   If another instance migrated first, its version wins. */
async function migrate(client) {
  await client.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY)");
  const current = async () => Number((await client.execute("SELECT COALESCE(MAX(version), 0) AS v FROM schema_migrations")).rows[0].v);
  for (let version = (await current()) + 1; version <= MIGRATIONS.length; version++) {
    try {
      await client.batch([...statements(MIGRATIONS[version - 1]), { sql: "INSERT INTO schema_migrations (version) VALUES (?)", args: [version] }], "write");
    } catch (e) {
      if ((await current()) < version) throw e;
    }
  }
}

/* libSQL adapter for the repository ports (see ../contract.js): Turso ("libsql://…" + authToken),
   a local file ("file:<path>") or ":memory:". */
export function createLibsqlDatabase({ url, authToken } = {}) {
  if (!url) throw new Error("DATABASE_URL is required for DB_DRIVER=libsql");
  // timeout: busy wait for local files, like the sqlite driver (remote Turso ignores it and serializes writes itself).
  const client = createClient({ url, authToken, timeout: 5000 });
  // A failed migration is not cached: the next query tries again instead of failing until the process restarts.
  let ready = null;
  const migrated = () => (ready ??= migrate(client).catch((e) => { ready = null; throw e; }));
  migrated().catch(() => {}); // Start now; a failure surfaces on the first query, not as an unhandled rejection.
  const run = async (sql, args = []) => { await migrated(); return client.execute({ sql, args }); };
  const first = async (sql, args) => (await run(sql, args)).rows[0] ?? null;

  const users = {
    async findByEmail(email) { return toUser(await first("SELECT * FROM users WHERE email = ?", [email])); },
    async findById(id) { return toUser(await first("SELECT * FROM users WHERE id = ?", [id])); },
    async create({ email, passwordHash, role = DEFAULT_ROLE, createdAt }) {
      try {
        const { lastInsertRowid } = await run("INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, ?, ?)", [email, passwordHash, role, createdAt]);
        return users.findById(Number(lastInsertRowid));
      } catch (e) {
        if (e.rawCode === SQLITE_CONSTRAINT_UNIQUE || /UNIQUE constraint failed/.test(e.message)) {
          throw new DatabaseError("EMAIL_TAKEN", "A user with this email already exists");
        }
        throw e;
      }
    },
    async list() { return (await run("SELECT * FROM users ORDER BY email")).rows.map(toUser); },
    async updateRole(id, role) {
      const sql = `UPDATE users SET role = ? WHERE id = ? AND (role <> 'ADMIN' OR ? = 'ADMIN' OR ${OTHER_ADMINS})`;
      if ((await run(sql, [role, id, role])).rowsAffected) return users.findById(id);
      if (await users.findById(id)) throw lastAdmin();
      return null;
    },
    async updatePassword(id, passwordHash) {
      return (await run("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, id])).rowsAffected ? users.findById(id) : null;
    },
    // One write batch, so the user and its sessions go together. Explicit, because remote Turso may not enforce foreign keys.
    // Sessions are only removed when the user row really went away (the last-ADMIN guard may keep it).
    async delete(id) {
      await migrated();
      const [del] = await client.batch([
        { sql: `DELETE FROM users WHERE id = ? AND (role <> 'ADMIN' OR ${OTHER_ADMINS})`, args: [id] },
        { sql: "DELETE FROM sessions WHERE user_id = ? AND NOT EXISTS (SELECT 1 FROM users WHERE id = ?)", args: [id, id] },
      ], "write");
      if (del.rowsAffected > 0) return true;
      if (await users.findById(id)) throw lastAdmin();
      return false;
    },
  };
  const sessions = {
    async create({ tokenHash, userId, expiresAt, createdAt }) {
      await run("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)", [tokenHash, userId, expiresAt, createdAt]);
    },
    async findByTokenHash(tokenHash) {
      const r = await first("SELECT s.token_hash, s.user_id, s.expires_at, u.email, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?", [tokenHash]);
      return r ? { tokenHash: r.token_hash, userId: Number(r.user_id), email: r.email, role: r.role, expiresAt: Number(r.expires_at) } : null;
    },
    async delete(tokenHash) { await run("DELETE FROM sessions WHERE token_hash = ?", [tokenHash]); },
    async deleteExpired(now) { await run("DELETE FROM sessions WHERE expires_at <= ?", [now]); },
    async deleteByUser(userId) { await run("DELETE FROM sessions WHERE user_id = ?", [userId]); },
  };
  const writeBatch = async (stmts) => { await migrated(); return client.batch(stmts, "write"); };
  const loadQuestions = async (rows) => {
    if (!rows.length) return [];
    return toQuestions(rows, (await run(BANK_SQL.answersOf(rows.length), rows.map((r) => r.id))).rows);
  };

  const categories = {
    async list() { return (await run(BANK_SQL.listCategories)).rows.map(toCategory); },
    async create({ name, createdAt }) {
      try {
        const { lastInsertRowid } = await run(BANK_SQL.insertCategory, [name, createdAt]);
        return toCategory(await first(BANK_SQL.categoryById, [Number(lastInsertRowid)]));
      } catch (e) {
        if (isUniqueViolation(e)) throw categoryTaken();
        throw e;
      }
    },
    async delete(id) {
      const [, del] = await writeBatch([{ sql: BANK_SQL.unlinkCategory, args: [id] }, { sql: BANK_SQL.deleteCategory, args: [id] }]);
      return del.rowsAffected > 0;
    },
  };

  const questions = {
    async list({ profile } = {}) {
      const { rows } = profile ? await run(BANK_SQL.questions + " WHERE q.profile = ?" + ORDER, [profile]) : await run(BANK_SQL.questions + ORDER);
      return loadQuestions(rows);
    },
    // One write batch (atomic). Answers point at the question just inserted (the newest id inside this write
    // transaction) and are skipped when the question insert changed nothing (missing category): changes() = 1.
    async create({ text, categoryId = null, profile, answers, createdAt }) {
      const [inserted] = await writeBatch([
        { sql: BANK_SQL.insertQuestion, args: [text, categoryId, profile, createdAt] },
        ...answers.map((a, i) => ({
          sql: "INSERT INTO answers (question_id, text, points, position) SELECT (SELECT MAX(id) FROM questions), ?, ?, ? WHERE changes() = 1",
          args: [a.text, a.points, i],
        })),
      ]);
      if (!inserted.rowsAffected) throw categoryNotFound();
      return (await loadQuestions((await run(BANK_SQL.questions + " WHERE q.id = ?", [Number(inserted.lastInsertRowid)])).rows))[0];
    },
    async delete(id) {
      const [, del] = await writeBatch([{ sql: BANK_SQL.deleteAnswers, args: [id] }, { sql: BANK_SQL.deleteQuestion, args: [id] }]);
      return del.rowsAffected > 0;
    },
  };

  return { users, sessions, categories, questions, close: () => client.close() };
}
