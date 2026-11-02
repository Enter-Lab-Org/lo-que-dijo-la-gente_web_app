/* Framework-free handlers for the auth API: Web Request in, Web Response out. The Next route files only wire them. */
export const SESSION_COOKIE = "ldlg_session";
const MAX_BODY = 10_000;

export const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });

const cookie = (value, lifetime, secure = false) =>
  [`${SESSION_COOKIE}=${value}`, "Path=/", lifetime, "HttpOnly", "SameSite=Lax", ...(secure ? ["Secure"] : [])].join("; ");

// State-changing requests must come from our own pages. Browsers always send Origin on fetch POSTs.
export function sameOrigin(request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch (e) { return false; }
}

// Parsed JSON object body, or null when it is too large, malformed or not an object.
export async function readJsonObject(request) {
  const text = await request.text();
  let body = null;
  try { body = text.length <= MAX_BODY ? JSON.parse(text) : null; } catch (e) { body = null; }
  return body && typeof body === "object" && !Array.isArray(body) ? body : null;
}

export function readSessionToken(cookieHeader) {
  for (const part of String(cookieHeader || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === SESSION_COOKIE) return part.slice(i + 1).trim() || null;
  }
  return null;
}

// X-Forwarded-For is set by the client unless a proxy in front rewrites it, so it is only used when declared.
export function clientIp(request, { trustProxy = false } = {}) {
  if (!trustProxy) return null;
  const hops = String(request.headers.get("x-forwarded-for") || "").split(",").map((s) => s.trim()).filter(Boolean);
  return hops.at(-1) || null;
}

export async function handleLogin(request, { auth, secureCookie = true, trustProxy = false }) {
  if (!sameOrigin(request)) return json(403, { error: "Origen no permitido." });
  const body = await readJsonObject(request);
  if (!body) return json(400, { error: "Solicitud inválida." });

  const r = await auth.login({ email: body.email, password: body.password, ip: clientIp(request, { trustProxy }) });
  if (r.reason === "RATE_LIMITED") {
    return json(429, { error: `Demasiados intentos. Intenta de nuevo en ${Math.ceil(r.retryAfterMs / 60_000)} min.` },
      { "retry-after": String(Math.ceil(r.retryAfterMs / 1000)) });
  }
  if (!r.ok) return json(401, { error: "Correo o contraseña incorrectos." });
  const setCookie = cookie(r.token, `Expires=${new Date(r.expiresAt).toUTCString()}`, secureCookie);
  return json(200, { ok: true, user: { email: r.user.email } }, { "set-cookie": setCookie });
}

export async function handleLogout(request, { auth }) {
  if (!sameOrigin(request)) return json(403, { error: "Origen no permitido." });
  await auth.logout(readSessionToken(request.headers.get("cookie")));
  return json(200, { ok: true }, { "set-cookie": cookie("", "Max-Age=0") });
}
