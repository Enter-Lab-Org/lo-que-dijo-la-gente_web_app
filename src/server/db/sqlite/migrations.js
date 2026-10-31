/* Schema versions, applied in order and tracked with PRAGMA user_version. Append new steps; never edit old ones. */
export const MIGRATIONS = [
  `CREATE TABLE users (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     email TEXT NOT NULL UNIQUE COLLATE NOCASE,
     password_hash TEXT NOT NULL,
     created_at INTEGER NOT NULL
   );
   CREATE TABLE sessions (
     token_hash TEXT PRIMARY KEY,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     expires_at INTEGER NOT NULL,
     created_at INTEGER NOT NULL
   );
   CREATE INDEX sessions_expires_at ON sessions(expires_at);`,
];

export function migrate(db) {
  const current = db.prepare("PRAGMA user_version").get().user_version;
  MIGRATIONS.slice(current).forEach((sql, i) => {
    db.exec("BEGIN");
    try {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${current + i + 1}`);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  });
}
