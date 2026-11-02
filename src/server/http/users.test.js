import { createSqliteDatabase } from "../db/sqlite/index.js";
import { createAuthService } from "../auth/service.js";
import { handleUsers } from "./users.js";
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

const setup = async () => {
  const db = createSqliteDatabase({ url: ":memory:" });
  const auth = createAuthService({ db, now: () => 5_000 });
  const admin = await auth.createUser({ email: "admin@b.co", password: "secreto123", role: "ADMIN" });
  const op = await auth.createUser({ email: "op@b.co", password: "secreto123", role: "OPERADOR" });
  const adminToken = (await auth.login({ email: "admin@b.co", password: "secreto123" })).token;
  const opToken = (await auth.login({ email: "op@b.co", password: "secreto123" })).token;
  return { auth, admin, op, adminToken, opToken };
};
const call = async (auth, method, path, opts = {}, id = null) => {
  const res = await handleUsers(req(method, path, opts), { auth, id });
  return { status: res.status, body: await res.json(), cache: res.headers.get("cache-control") };
};

describe("/api/users access", () => {
  it("returns 401 without a valid session and 403 for a role without the users section", async () => {
    const { auth, opToken } = await setup();
    expect(await call(auth, "GET", "/api/users")).toMatchObject({ status: 401, body: { error: "Inicia sesión de nuevo." } });
    expect(await call(auth, "GET", "/api/users", { token: "forged" })).toMatchObject({ status: 401 });
    expect(await call(auth, "GET", "/api/users", { token: opToken })).toMatchObject({ status: 403, body: { error: "No tienes permiso para administrar usuarios." } });
    expect(await call(auth, "POST", "/api/users", { token: opToken, body: { email: "x@b.co", password: "secreto123" } })).toMatchObject({ status: 403 });
    expect((await auth.listUsers()).length).toBe(2);
  });

  it("refuses cross-origin or origin-less changes with 403, even for an admin", async () => {
    const { auth, op, adminToken } = await setup();
    const evil = { token: adminToken, origin: "https://evil.example", body: { role: "ADMIN" } };
    expect(await call(auth, "PATCH", `/api/users/${op.id}`, evil, String(op.id))).toMatchObject({ status: 403, body: { error: "Origen no permitido." } });
    expect(await call(auth, "DELETE", `/api/users/${op.id}`, { token: adminToken, origin: null }, String(op.id))).toMatchObject({ status: 403 });
    expect((await auth.listUsers()).find((u) => u.id === op.id).role).toBe("OPERADOR");
  });
});

describe("/api/users as ADMIN", () => {
  it("GET lists users without hashes and is never cached", async () => {
    const { auth, adminToken } = await setup();
    const r = await call(auth, "GET", "/api/users", { token: adminToken });
    expect(r.status).toBe(200);
    expect(r.cache).toBe("no-store");
    expect(r.body).toEqual({ users: [
      { id: expect.any(Number), email: "admin@b.co", role: "ADMIN", createdAt: 5_000 },
      { id: expect.any(Number), email: "op@b.co", role: "OPERADOR", createdAt: 5_000 },
    ] });
  });

  it("POST creates a user (201) and reports validation errors with 400 / 409", async () => {
    const { auth, adminToken } = await setup();
    const post = (body) => call(auth, "POST", "/api/users", { token: adminToken, body });
    expect(await post({ email: "New@B.co", password: "secreto123", role: "GUEST" }))
      .toEqual({ status: 201, cache: "no-store", body: { user: { id: expect.any(Number), email: "new@b.co", role: "GUEST", createdAt: 5_000 } } });
    expect(await post({ email: "new@b.co", password: "secreto123", role: "GUEST" })).toMatchObject({ status: 409, body: { error: "Ya existe un usuario con ese correo." } });
    expect(await post({ email: "x@b.co", password: "corta", role: "GUEST" })).toMatchObject({ status: 400, body: { error: "La contraseña debe tener al menos 8 caracteres." } });
    expect(await post({ email: "x@b.co", password: "secreto123", role: "ROOT" })).toMatchObject({ status: 400, body: { error: "Rol inválido. Usa uno de: ADMIN, OPERADOR, GUEST." } });
    expect(await post("{not json")).toMatchObject({ status: 400, body: { error: "Solicitud inválida." } });
  });

  it("PATCH changes a role or resets a password; not your own role", async () => {
    const { auth, admin, op, adminToken, opToken } = await setup();
    const patch = (id, body) => call(auth, "PATCH", `/api/users/${id}`, { token: adminToken, body }, String(id));
    expect(await patch(op.id, { role: "GUEST" })).toMatchObject({ status: 200, body: { user: { id: op.id, role: "GUEST" } } });
    expect(await patch(op.id, { password: "otra-clave-9" })).toMatchObject({ status: 200, body: { user: { id: op.id } } });
    expect(await auth.getSession(opToken)).toBeNull();
    expect((await auth.login({ email: "op@b.co", password: "otra-clave-9" })).ok).toBe(true);
    expect(await patch(admin.id, { role: "GUEST" })).toMatchObject({ status: 409, body: { error: "No puedes cambiar tu propio rol." } });
    expect(await patch(op.id, {})).toMatchObject({ status: 400, body: { error: "Solicitud inválida." } });
    expect(await patch(op.id, { role: "ADMIN", password: "corta" })).toMatchObject({ status: 400, body: { error: "Solicitud inválida." } });
    expect((await auth.listUsers()).find((u) => u.id === op.id).role).toBe("GUEST");
    expect(await patch(999, { role: "GUEST" })).toMatchObject({ status: 404, body: { error: "Usuario no encontrado." } });
  });

  it("DELETE removes another user; not yourself; unknown or malformed ids are 404", async () => {
    const { auth, admin, op, adminToken } = await setup();
    const del = (id) => call(auth, "DELETE", `/api/users/${id}`, { token: adminToken }, String(id));
    expect(await del(op.id)).toEqual({ status: 200, cache: "no-store", body: { ok: true } });
    expect(await del(op.id)).toMatchObject({ status: 404 });
    expect(await del(admin.id)).toMatchObject({ status: 409, body: { error: "No puedes eliminar tu propio usuario." } });
    expect(await del("1abc")).toMatchObject({ status: 404 });
    expect((await auth.listUsers()).map((u) => u.email)).toEqual(["admin@b.co"]);
  });

  it("answers 405 for methods the route does not support", async () => {
    const { auth, op, adminToken } = await setup();
    expect(await call(auth, "DELETE", "/api/users", { token: adminToken })).toMatchObject({ status: 405 });
    expect(await call(auth, "POST", `/api/users/${op.id}`, { token: adminToken, body: {} }, String(op.id))).toMatchObject({ status: 405 });
  });
});
