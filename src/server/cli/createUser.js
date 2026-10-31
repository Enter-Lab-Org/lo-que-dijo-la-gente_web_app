import { AuthError } from "../auth/service.js";

export const USAGE = "Uso: npm run user:create -- <correo>   (contraseña en LDLG_USER_PASSWORD o se pide en pantalla)";

/* Admin-only user creation (there is no public signup). Returns the process exit code. */
export async function createUserCommand({ args, env, auth, readPassword, log, error }) {
  const email = args[0];
  if (!email) { error(USAGE); return 1; }
  let password = env.LDLG_USER_PASSWORD;
  if (!password) {
    password = await readPassword("Contraseña: ");
    if (password !== await readPassword("Repite la contraseña: ")) { error("Las contraseñas no coinciden."); return 1; }
  }
  try {
    const user = await auth.createUser({ email, password });
    log(`Usuario creado: ${user.email}`);
    return 0;
  } catch (e) {
    if (e instanceof AuthError) { error(e.message); return 1; }
    throw e;
  }
}
