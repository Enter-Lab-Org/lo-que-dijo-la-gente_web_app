import { AuthError } from "../auth/service.js";
import { SECTIONS, canAccess } from "../../domain/roles.js";
import { json, readJsonObject, readSessionToken, sameOrigin } from "./handlers.js";

const STATUS = { NOT_FOUND: 404, EMAIL_TAKEN: 409, SELF_ROLE: 409, SELF_DELETE: 409 };
const INVALID = () => json(400, { error: "Solicitud inválida." });
const parseId = (raw) => (/^\d{1,15}$/.test(String(raw)) ? Number(raw) : null);

// The real access check for user management: a live session whose role may open the users section.
async function authorize(request, auth) {
  const session = await auth.getSession(readSessionToken(request.headers.get("cookie")));
  if (!session) return { error: json(401, { error: "Inicia sesión de nuevo." }) };
  if (!canAccess({ role: session.role }, SECTIONS.USERS)) return { error: json(403, { error: "No tienes permiso para administrar usuarios." }) };
  return { actorId: session.userId };
}

/* /api/users (id = null: GET list, POST create) and /api/users/:id (PATCH role or password, DELETE).
   Framework-free like ./handlers.js; the Next route files only pass the raw id. */
export async function handleUsers(request, { auth, id = null }) {
  const method = request.method;
  const allowed = id === null ? ["GET", "POST"] : ["PATCH", "DELETE"];
  if (!allowed.includes(method)) return json(405, { error: "Método no permitido." }, { allow: allowed.join(", ") });
  if (method !== "GET" && !sameOrigin(request)) return json(403, { error: "Origen no permitido." });

  const { error, actorId } = await authorize(request, auth);
  if (error) return error;

  try {
    if (method === "GET") return json(200, { users: await auth.listUsers() });
    if (method === "POST") {
      const body = await readJsonObject(request);
      if (!body) return INVALID();
      return json(201, { user: await auth.createUser({ email: body.email, password: body.password, role: body.role }) });
    }

    const target = parseId(id);
    if (target === null) return json(404, { error: "Usuario no encontrado." });
    if (method === "DELETE") {
      await auth.deleteUser({ actorId, id: target });
      return json(200, { ok: true });
    }
    const body = await readJsonObject(request);
    // Exactly one change per request, so a failing half never leaves the other half applied.
    if (!body || (body.role === undefined) === (body.password === undefined)) return INVALID();
    const user = body.role !== undefined
      ? await auth.setRole({ actorId, id: target, role: body.role })
      : await auth.resetPassword({ id: target, password: body.password });
    return json(200, { user });
  } catch (e) {
    if (e instanceof AuthError) return json(STATUS[e.code] ?? 400, { error: e.message });
    throw e;
  }
}
