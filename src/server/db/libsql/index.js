import { createClient } from "@libsql/client";
import { DatabaseError } from "../errors.js";
import { MIGRATIONS } from "../sqlite/migrations.js";
import { DEFAULT_ROLE } from "../../../domain/roles.js";

const SQLITE_CONSTRAINT_UNIQUE = 2067;
// The last-ADMIN rule lives in the write itself (one atomic statement), so concurrent requests cannot both pass it.
const OTHER_ADMINS = "(SELECT COUNT(*) FROM users WHERE role = 'ADMIN') > 1";
const lastAdmin = () => new DatabaseError("LAST_ADMIN", "At least one ADMIN must remain");
const toUser = (r) => (r ? { id: Number(r.id), email: r.email, passwordHash: r.password_hash, role: r.role, createdAt: Number(r.created_at) } : null);

/* Applies pending MIGRATIONS. Versions live in a table (not PRAGMA user_version) so it also works on remote Turso.
   Each step and its version row run in one write transaction (atomic; triggers with ";" in their body are fine).
   If another instance migrated first, its version wins. */
async function migrate(client) {
  await client.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY)");
  const current = async () => Number((await client.execute("SELECT COALESCE(MAX(version), 0) AS v FROM schema_migrations")).rows[0].v);
  for (let version = (await current()) + 1; version <= MIGRATIONS.length; version++) {
    const tx = await client.transaction("write");
    try {
      await tx.executeMultiple(MIGRATIONS[version - 1]);
      await tx.execute({ sql: "INSERT INTO schema_migrations (version) VALUES (?)", args: [version] });
      await tx.commit();
    } catch (e) {
      await tx.rollback().catch(() => {});
      if ((await current()) < version) throw e;
    } finally {
      tx.close();
    }
  }
}

/* libSQL adapter for the repository ports (see ../contract.js): Turso ("libsql://…" + authToken),
   a local file ("file:<path>") or ":memory:". */
export function createLibsqlDatabase({ url, authToken } = {}) {
  if (!url) throw new Error("DATABASE_URL is required for DB_DRIVER=libsql");
  const client = createClient({ url, authToken });
  const ready = migrate(client);
  ready.catch(() => {}); // Surfaced by the first query below, not as an unhandled rejection.
  const run = async (sql, args = []) => { await ready; return client.execute({ sql, args }); };
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
      await ready;
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
  return { users, sessions, close: () => client.close() };
}
