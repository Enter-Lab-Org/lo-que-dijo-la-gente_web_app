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
  // 4: question bank. A question belongs to an optional category and a question profile (src/domain/profiles.js);
  // its answers keep their order and points (10 when not given). Adapters also delete/unlink related rows explicitly,
  // because remote Turso may not enforce foreign keys.
  `CREATE TABLE categories (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL UNIQUE COLLATE NOCASE,
     created_at INTEGER NOT NULL
   );
   CREATE TABLE questions (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     text TEXT NOT NULL,
     category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
     profile TEXT NOT NULL CHECK (profile IN ('DEFAULT', 'ADULT')),
     created_at INTEGER NOT NULL
   );
   CREATE INDEX questions_profile ON questions(profile);
   CREATE TABLE answers (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
     text TEXT NOT NULL,
     points INTEGER NOT NULL DEFAULT 10 CHECK (points >= 0),
     position INTEGER NOT NULL
   );
   CREATE INDEX answers_question ON answers(question_id, position);`,
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
