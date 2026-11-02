import { createClient } from "@libsql/client";
import { DatabaseError } from "../errors.js";
import { MIGRATIONS } from "../sqlite/migrations.js";

const SQLITE_CONSTRAINT_UNIQUE = 2067;
const toUser = (r) => (r ? { id: Number(r.id), email: r.email, passwordHash: r.password_hash, createdAt: Number(r.created_at) } : null);
// The shared migrations hold no ";" inside literals, so splitting on it yields whole statements.
const statements = (sql) => sql.split(";").map((s) => s.trim()).filter(Boolean);

/* Applies pending MIGRATIONS. Versions live in a table (not PRAGMA user_version) so it also works on remote Turso.
   Each step runs in one write batch, so it is atomic; if another instance migrated first, its version wins. */
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
  const client = createClient({ url, authToken });
  const ready = migrate(client);
  ready.catch(() => {}); // Surfaced by the first query below, not as an unhandled rejection.
  const run = async (sql, args = []) => { await ready; return client.execute({ sql, args }); };
  const first = async (sql, args) => (await run(sql, args)).rows[0] ?? null;

  const users = {
    async findByEmail(email) { return toUser(await first("SELECT * FROM users WHERE email = ?", [email])); },
    async findById(id) { return toUser(await first("SELECT * FROM users WHERE id = ?", [id])); },
    async create({ email, passwordHash, createdAt }) {
      try {
        const { lastInsertRowid } = await run("INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)", [email, passwordHash, createdAt]);
        return users.findById(Number(lastInsertRowid));
      } catch (e) {
        if (e.rawCode === SQLITE_CONSTRAINT_UNIQUE || /UNIQUE constraint failed/.test(e.message)) {
          throw new DatabaseError("EMAIL_TAKEN", "A user with this email already exists");
        }
        throw e;
      }
    },
  };
  const sessions = {
    async create({ tokenHash, userId, expiresAt, createdAt }) {
      await run("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)", [tokenHash, userId, expiresAt, createdAt]);
    },
    async findByTokenHash(tokenHash) {
      const r = await first("SELECT s.token_hash, s.user_id, s.expires_at, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?", [tokenHash]);
      return r ? { tokenHash: r.token_hash, userId: Number(r.user_id), email: r.email, expiresAt: Number(r.expires_at) } : null;
    },
    async delete(tokenHash) { await run("DELETE FROM sessions WHERE token_hash = ?", [tokenHash]); },
    async deleteExpired(now) { await run("DELETE FROM sessions WHERE expires_at <= ?", [now]); },
  };
  return { users, sessions, close: () => client.close() };
}
