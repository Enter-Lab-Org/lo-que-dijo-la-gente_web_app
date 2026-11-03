import { createSqliteDatabase } from "../db/sqlite/index.js";
import { createAuthService } from "../auth/service.js";
import { createBankService } from "../bank/service.js";
import { handleBank } from "./bank.js";
import { SESSION_COOKIE } from "./handlers.js";

const ORIGIN = "http://localhost:8081";
const req = (method, path, { body, token, origin = ORIGIN } = {}) => new Request(ORIGIN + path, {
  method,
  headers: {
    host: "localhost:8081",
    ...(origin && { origin }),
    ...(token && { cookie: `${SESSION_COOKIE}=${token}` }),
    ...(body !== undefined && { "content-type": "application/json" }),
  },
  ...(body !== undefined && { body: typeof body === "string" ? body : JSON.stringify(body) }),
});

let ctx;
beforeEach(async () => {
  const db = createSqliteDatabase({ url: ":memory:" });
  const auth = createAuthService({ db, now: () => 5_000 });
  const bank = createBankService({ db, now: () => 7_000 });
  await auth.createUser({ email: "admin@b.co", password: "secreto123", role: "ADMIN" });
  await auth.createUser({ email: "op@b.co", password: "secreto123", role: "OPERADOR" });
  const adminToken = (await auth.login({ email: "admin@b.co", password: "secreto123" })).token;
  const opToken = (await auth.login({ email: "op@b.co", password: "secreto123" })).token;
  ctx = { db, auth, bank, adminToken, opToken };
});
afterEach(() => ctx.db.close());

const call = async (method, path, opts = {}) => {
  const [, , , resource, id = null] = path.split("?")[0].split("/"); // /api/bank/<resource>/<id>
  const res = await handleBank(req(method, path, { token: ctx.opToken, ...opts }), { auth: ctx.auth, bank: ctx.bank, resource, id });
  return { status: res.status, body: await res.json(), cache: res.headers.get("cache-control") };
};
const ANSWERS = [{ text: "Labial", points: 34 }, { text: "Pestañas", points: 21 }];

describe("bank API · access", () => {
  it("rejects requests without a live session (401) and mutations from another origin (403)", async () => {
    expect(await call("GET", "/api/bank/questions", { token: null })).toMatchObject({ status: 401, body: { error: "Inicia sesión de nuevo." } });
    expect(await call("GET", "/api/bank/categories", { token: "forged" })).toMatchObject({ status: 401 });
    expect(await call("POST", "/api/bank/categories", { body: { name: "X" }, origin: "http://evil.example" }))
      .toMatchObject({ status: 403, body: { error: "Origen no permitido." } });
    expect(await ctx.db.categories.list()).toEqual([]);
  });

  it("lets both ADMIN and OPERADOR use it, without caching", async () => {
    const op = await call("GET", "/api/bank/questions");
    expect(op).toEqual({ status: 200, body: { questions: [] }, cache: "no-store" });
    expect((await call("GET", "/api/bank/categories", { token: ctx.adminToken })).status).toBe(200);
  });

  it("answers 405 to unsupported methods and 404 to unknown resources", async () => {
    expect(await call("PUT", "/api/bank/questions")).toMatchObject({ status: 405 });
    expect(await call("DELETE", "/api/bank/questions")).toMatchObject({ status: 405 });
    expect(await call("GET", "/api/bank/questions/3")).toMatchObject({ status: 405 });
    expect(await call("GET", "/api/bank/answers")).toMatchObject({ status: 404 });
  });
});

describe("bank API · categories", () => {
  it("creates (trimmed), lists by name and deletes categories", async () => {
    const created = await call("POST", "/api/bank/categories", { body: { name: "  Picante " } });
    expect(created).toMatchObject({ status: 201, body: { category: { id: expect.any(Number), name: "Picante", createdAt: 7_000 } } });
    await call("POST", "/api/bank/categories", { body: { name: "Antro y fiesta" } });
    expect((await call("GET", "/api/bank/categories")).body.categories.map((c) => c.name)).toEqual(["Antro y fiesta", "Picante"]);
    expect(await call("DELETE", `/api/bank/categories/${created.body.category.id}`)).toMatchObject({ status: 200, body: { ok: true } });
    expect(await call("DELETE", `/api/bank/categories/${created.body.category.id}`)).toMatchObject({ status: 404, body: { error: "Categoría no encontrada." } });
  });

  it("validates the name and refuses duplicates", async () => {
    expect(await call("POST", "/api/bank/categories", { body: { name: "  " } })).toMatchObject({ status: 400, body: { error: "Escribe el nombre de la categoría." } });
    expect(await call("POST", "/api/bank/categories", { body: { name: "x".repeat(61) } }))
      .toMatchObject({ status: 400, body: { error: "El nombre de la categoría admite máximo 60 caracteres." } });
    await call("POST", "/api/bank/categories", { body: { name: "Picante" } });
    expect(await call("POST", "/api/bank/categories", { body: { name: "picante" } })).toMatchObject({ status: 409, body: { error: "Ya existe una categoría con ese nombre." } });
    expect(await call("POST", "/api/bank/categories", { body: "[]" })).toMatchObject({ status: 400, body: { error: "Solicitud inválida." } });
  });
});

describe("bank API · questions", () => {
  it("creates a question with category, profile and answers sorted by points; lists it filtered by profile", async () => {
    const cat = (await call("POST", "/api/bank/categories", { body: { name: "Cultura drag" } })).body.category;
    const res = await call("POST", "/api/bank/questions", {
      body: { text: " Algo que nunca falta en la bolsa de una drag ", categoryId: cat.id, profile: "ADULT", answers: [{ text: "Pestañas", points: 21 }, { text: " Labial ", points: "34" }] },
    });
    expect(res).toMatchObject({ status: 201, body: { question: {
      text: "Algo que nunca falta en la bolsa de una drag", categoryId: cat.id, category: "Cultura drag", profile: "ADULT", createdAt: 7_000,
      answers: [{ text: "Labial", points: 34 }, { text: "Pestañas", points: 21 }],
    } } });
    await call("POST", "/api/bank/questions", { body: { text: "Default", profile: "DEFAULT", answers: ANSWERS } });
    expect((await call("GET", "/api/bank/questions?profile=ADULT")).body.questions.map((q) => q.text)).toEqual(["Algo que nunca falta en la bolsa de una drag"]);
    expect((await call("GET", "/api/bank/questions?profile=DEFAULT")).body.questions.map((q) => q.text)).toEqual(["Default"]);
    expect((await call("GET", "/api/bank/questions")).body.questions).toHaveLength(2);
    expect(await call("GET", "/api/bank/questions?profile=KIDS")).toMatchObject({ status: 400, body: { error: "Perfil inválido. Usa DEFAULT o ADULT." } });
  });

  it("gives 10 points to an answer whose points are not specified, and drops answers without text", async () => {
    const res = await call("POST", "/api/bank/questions", {
      body: { text: "Señal de que tu cita va mal", profile: "ADULT", answers: [{ text: "Llega tarde" }, { text: "Habla de su ex", points: "" }, { text: "Pide el 50/50", points: 12 }, { text: "  ", points: 50 }] },
    });
    expect(res.status).toBe(201);
    expect(res.body.question.answers).toEqual([{ text: "Pide el 50/50", points: 12 }, { text: "Llega tarde", points: 10 }, { text: "Habla de su ex", points: 10 }]);
    expect(res.body.question).toMatchObject({ categoryId: null, category: "" });
  });

  it.each([
    [{ text: "", profile: "ADULT", answers: ANSWERS }, 400, "Escribe la pregunta."],
    [{ text: "x".repeat(201), profile: "ADULT", answers: ANSWERS }, 400, "La pregunta admite máximo 200 caracteres."],
    [{ text: "q", profile: "KIDS", answers: ANSWERS }, 400, "Perfil inválido. Usa DEFAULT o ADULT."],
    [{ text: "q", profile: "ADULT", answers: [] }, 400, "Agrega al menos una respuesta."],
    [{ text: "q", profile: "ADULT", answers: Array.from({ length: 9 }, (_, i) => ({ text: "r" + i })) }, 400, "Máximo 8 respuestas."],
    [{ text: "q", profile: "ADULT", answers: [{ text: "Labial", points: -1 }] }, 400, "Puntaje inválido en «Labial»: usa un número entero de 0 a 999."],
    [{ text: "q", profile: "ADULT", answers: [{ text: "Labial", points: 2.5 }] }, 400, "Puntaje inválido en «Labial»: usa un número entero de 0 a 999."],
    [{ text: "q", profile: "ADULT", answers: [{ text: "x".repeat(81) }] }, 400, "Cada respuesta admite máximo 80 caracteres."],
    [{ text: "q", profile: "ADULT", categoryId: "abc", answers: ANSWERS }, 400, "Categoría inválida."],
    [{ text: "q", profile: "ADULT", categoryId: 999, answers: ANSWERS }, 400, "La categoría no existe."],
  ])("refuses an invalid question %#", async (body, status, error) => {
    expect(await call("POST", "/api/bank/questions", { body })).toMatchObject({ status, body: { error } });
    expect(await ctx.db.questions.list()).toEqual([]);
  });

  it("deletes a question; unknown or malformed ids are 404", async () => {
    const q = (await call("POST", "/api/bank/questions", { body: { text: "q", profile: "DEFAULT", answers: ANSWERS } })).body.question;
    expect(await call("DELETE", `/api/bank/questions/${q.id}`)).toMatchObject({ status: 200, body: { ok: true } });
    expect(await call("DELETE", `/api/bank/questions/${q.id}`)).toMatchObject({ status: 404, body: { error: "Pregunta no encontrada." } });
    expect(await call("DELETE", "/api/bank/questions/abc")).toMatchObject({ status: 404 });
    expect(await ctx.db.questions.list()).toEqual([]);
  });
});

describe("bank API · picked questions per profile", () => {
  const add = async (text, profile) => (await call("POST", "/api/bank/questions", { body: { text, profile, answers: ANSWERS } })).body.question;

  it("saves the picks of one profile (PUT) for every operator; questions list them as picked", async () => {
    const a = await add("A", "ADULT");
    const b = await add("B", "ADULT");
    const d = await add("D", "DEFAULT");
    expect(a.picked).toBe(false);
    expect(await call("PUT", "/api/bank/picks", { body: { profile: "DEFAULT", ids: [d.id] } })).toEqual({ status: 200, body: { ok: true }, cache: "no-store" });
    expect(await call("PUT", "/api/bank/picks", { body: { profile: "ADULT", ids: [b.id] }, token: ctx.adminToken })).toMatchObject({ status: 200 });
    const listed = (await call("GET", "/api/bank/questions", { token: ctx.adminToken })).body.questions;
    expect(listed.map((q) => [q.text, q.picked])).toEqual([["A", false], ["B", true], ["D", true]]);
    expect(await call("PUT", "/api/bank/picks", { body: { profile: "ADULT", ids: [] } })).toMatchObject({ status: 200 });
    expect((await ctx.db.questions.list({ profile: "ADULT" })).map((q) => q.picked)).toEqual([false, false]);
  });

  it("refuses an unknown profile, ids that are not a list of positive whole numbers, other methods and other origins", async () => {
    const a = await add("A", "ADULT");
    for (const body of [{ profile: "KIDS", ids: [a.id] }, { ids: [a.id] }]) {
      expect(await call("PUT", "/api/bank/picks", { body })).toMatchObject({ status: 400, body: { error: "Perfil inválido. Usa DEFAULT o ADULT." } });
    }
    for (const ids of [undefined, "1", [0], [-1], [1.5], ["1"], [null]]) {
      expect(await call("PUT", "/api/bank/picks", { body: { profile: "ADULT", ids } })).toMatchObject({ status: 400, body: { error: "Selección de preguntas inválida." } });
    }
    expect(await call("GET", "/api/bank/picks")).toMatchObject({ status: 405 });
    expect(await call("POST", "/api/bank/picks", { body: { profile: "ADULT", ids: [a.id] } })).toMatchObject({ status: 405 });
    expect(await call("PUT", "/api/bank/picks", { body: { profile: "ADULT", ids: [a.id] }, origin: "http://evil.example" })).toMatchObject({ status: 403 });
    expect(await call("PUT", "/api/bank/picks", { body: { profile: "ADULT", ids: [a.id] }, token: null })).toMatchObject({ status: 401 });
    expect((await ctx.db.questions.list())[0].picked).toBe(false);
  });
});
