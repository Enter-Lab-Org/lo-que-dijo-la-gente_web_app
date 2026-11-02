import { AuthError } from "../auth/service.js";
import { DEFAULT_ROLE, ROLE_LIST } from "../../domain/roles.js";

export const USAGE = `Uso: npm run user:create -- <correo> [--role ${ROLE_LIST.join("|")}]   (rol por defecto: ${DEFAULT_ROLE}; contraseña en LDLG_USER_PASSWORD o se pide en pantalla)`;

// Accepts "<email>", "--role <ROLE>" and "--role=<ROLE>" in any order. Returns null on anything else.
function parseArgs(args) {
  let email = null, role;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--role") { role = args[++i]; if (role === undefined) return null; }
    else if (a.startsWith("--role=")) role = a.slice("--role=".length);
    else if (a.startsWith("-") || email !== null) return null;
    else email = a;
  }
  return email ? { email, role } : null;
}

/* Admin-only user creation (there is no public signup). Returns the process exit code. */
export async function createUserCommand({ args, env, auth, readPassword, log, error }) {
  const parsed = parseArgs(args);
  if (!parsed) { error(USAGE); return 1; }
  const { email, role } = parsed;
  if (role !== undefined && !ROLE_LIST.includes(role)) { error(`Rol inválido. Usa uno de: ${ROLE_LIST.join(", ")}.`); return 1; }
  let password = env.LDLG_USER_PASSWORD;
  if (!password) {
    password = await readPassword("Contraseña: ");
    if (password !== await readPassword("Repite la contraseña: ")) { error("Las contraseñas no coinciden."); return 1; }
  }
  try {
    const user = await auth.createUser({ email, password, ...(role && { role }) });
    log(`Usuario creado: ${user.email}`);
    return 0;
  } catch (e) {
    if (e instanceof AuthError) { error(e.message); return 1; }
    throw e;
  }
}
