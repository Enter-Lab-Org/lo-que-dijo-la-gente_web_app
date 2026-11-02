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
  // 2: roles (see src/domain/roles.js). Users that existed before roles were created by the admin, so they become ADMIN.
  `ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'GUEST' CHECK (role IN ('ADMIN', 'OPERADOR', 'GUEST'));
   UPDATE users SET role = 'ADMIN';`,
  // 3: GUEST removed; its users become OPERADOR (same access). The table is not rebuilt to change the CHECK above,
  // because dropping users would cascade-delete sessions; triggers refuse anything but ADMIN / OPERADOR instead.
  // The column default ('GUEST') is unused: adapters always write an explicit role.
  `UPDATE users SET role = 'OPERADOR' WHERE role = 'GUEST';
   CREATE TRIGGER users_role_insert BEFORE INSERT ON users WHEN NEW.role NOT IN ('ADMIN', 'OPERADOR')
     BEGIN SELECT RAISE(ABORT, 'invalid role'); END;
   CREATE TRIGGER users_role_update BEFORE UPDATE OF role ON users WHEN NEW.role NOT IN ('ADMIN', 'OPERADOR')
     BEGIN SELECT RAISE(ABORT, 'invalid role'); END;`,
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
