import { createSqliteDatabase } from "./sqlite/index.js";

/* The only place that knows the engines. A new engine implements the ports in ./contract.js
   (users, sessions, close), passes describeRepositoryContract, and is added here. */
const DRIVERS = { sqlite: createSqliteDatabase };

export function createDatabase({ driver = process.env.DB_DRIVER || "sqlite", url = process.env.DATABASE_URL } = {}) {
  const create = DRIVERS[driver];
  if (!create) throw new Error(`Unsupported DB_DRIVER "${driver}". Supported: ${Object.keys(DRIVERS).join(", ")}`);
  return create(url ? { url } : {});
}

// One connection per server process. Kept on globalThis so dev hot reloads do not open a new one each time.
export function getDatabase() {
  globalThis.__ldlgDatabase ??= createDatabase();
  return globalThis.__ldlgDatabase;
}
