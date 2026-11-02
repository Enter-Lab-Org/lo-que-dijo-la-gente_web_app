import { cookies } from "next/headers";
import { getDatabase } from "./db/index.js";
import { createAuthService } from "./auth/service.js";
import { SESSION_COOKIE } from "./http/handlers.js";

/* Next.js wiring: one auth service per server process, configured from the environment. */
export function getAuth() {
  globalThis.__ldlgAuth ??= createAuthService({ db: getDatabase() });
  return globalThis.__ldlgAuth;
}

export const httpConfig = () => ({
  // Secure cookies need https (localhost is exempt in browsers). COOKIE_SECURE=false allows plain http on a LAN.
  secureCookie: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE !== "false" : process.env.NODE_ENV === "production",
  trustProxy: process.env.TRUST_PROXY === "1",
});

// The real access check: the session must exist in the database and not be expired.
export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await getAuth().getSession(token);
  return session ? { id: session.userId, email: session.email, role: session.role } : null;
}
