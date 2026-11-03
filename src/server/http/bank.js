import { SECTIONS, canAccess } from "../../domain/roles.js";
import { json, readJsonObject, readSessionToken, sameOrigin } from "./handlers.js";

const STATUS = { INVALID: 400, NOT_FOUND: 404, CATEGORY_TAKEN: 409 };
const RESOURCES = ["questions", "categories", "picks"];
const parseId = (raw) => (/^\d{1,15}$/.test(String(raw)) ? Number(raw) : null);

// A live session whose role may open the admin panel (ADMIN and OPERADOR).
async function authorize(request, auth) {
  const session = await auth.getSession(readSessionToken(request.headers.get("cookie")));
  if (!session) return json(401, { error: "Inicia sesión de nuevo." });
  if (!canAccess({ role: session.role }, SECTIONS.ADMIN)) return json(403, { error: "No tienes permiso para administrar el banco de preguntas." });
  return null;
}

/* /api/bank/<questions|categories> (GET list, POST create), /api/bank/<resource>/:id (DELETE)
   and /api/bank/picks (PUT { profile, ids }: the picked questions of that profile).
   Framework-free like ./handlers.js; the Next route files only pass the resource and the raw id. */
export async function handleBank(request, { auth, bank, resource, id = null }) {
  if (!RESOURCES.includes(resource)) return json(404, { error: "No encontrado." });
  const method = request.method;
  const allowed = resource === "picks" ? (id === null ? ["PUT"] : []) : id === null ? ["GET", "POST"] : ["DELETE"];
  if (!allowed.length) return json(404, { error: "No encontrado." });
  if (!allowed.includes(method)) return json(405, { error: "Método no permitido." }, { allow: allowed.join(", ") });
  if (method !== "GET" && !sameOrigin(request)) return json(403, { error: "Origen no permitido." });

  const denied = await authorize(request, auth);
  if (denied) return denied;

  const isQuestions = resource === "questions";
  try {
    if (method === "PUT") {
      const body = await readJsonObject(request);
      if (!body) return json(400, { error: "Solicitud inválida." });
      await bank.savePicks(body);
      return json(200, { ok: true });
    }
    if (method === "GET") {
      if (!isQuestions) return json(200, { categories: await bank.listCategories() });
      const profile = new URL(request.url).searchParams.get("profile");
      return json(200, { questions: await bank.listQuestions({ profile }) });
    }
    if (method === "POST") {
      const body = await readJsonObject(request);
      if (!body) return json(400, { error: "Solicitud inválida." });
      return isQuestions
        ? json(201, { question: await bank.createQuestion(body) })
        : json(201, { category: await bank.createCategory(body) });
    }
    const target = parseId(id);
    if (target === null) return json(404, { error: isQuestions ? "Pregunta no encontrada." : "Categoría no encontrada." });
    await (isQuestions ? bank.deleteQuestion({ id: target }) : bank.deleteCategory({ id: target }));
    return json(200, { ok: true });
  } catch (e) {
    // By name, not instanceof: Next bundles each route apart, and the shared service may come from another copy.
    if (e?.name === "BankError") return json(STATUS[e.code] ?? 400, { error: e.message });
    throw e;
  }
}
