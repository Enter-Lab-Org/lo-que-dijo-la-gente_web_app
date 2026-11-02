import { describe, it, expect, vi } from "vitest";
import { createUsersApi } from "./usersApi";

const reply = (status, body) => ({ ok: status < 300, status, json: async () => body });

describe("users API adapter", () => {
  it("calls /api/users with the right method, JSON body and same-origin credentials", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(reply(200, { users: [{ id: 1 }] }))
      .mockResolvedValueOnce(reply(201, { user: { id: 2 } }))
      .mockResolvedValueOnce(reply(200, { user: { id: 2, role: "GUEST" } }))
      .mockResolvedValueOnce(reply(200, { user: { id: 2 } }))
      .mockResolvedValueOnce(reply(200, { ok: true }));
    const api = createUsersApi({ fetch });
    expect(await api.list()).toEqual([{ id: 1 }]);
    expect(await api.create({ email: "a@b.co", password: "secreto123", role: "GUEST" })).toEqual({ id: 2 });
    expect(await api.setRole(2, "GUEST")).toEqual({ id: 2, role: "GUEST" });
    expect(await api.resetPassword(2, "otra-clave-9")).toEqual({ id: 2 });
    expect(await api.remove(2)).toBeUndefined();
    const json = { "content-type": "application/json" };
    expect(fetch.mock.calls).toEqual([
      ["/api/users", { method: "GET", credentials: "same-origin", headers: {} }],
      ["/api/users", { method: "POST", credentials: "same-origin", headers: json, body: '{"email":"a@b.co","password":"secreto123","role":"GUEST"}' }],
      ["/api/users/2", { method: "PATCH", credentials: "same-origin", headers: json, body: '{"role":"GUEST"}' }],
      ["/api/users/2", { method: "PATCH", credentials: "same-origin", headers: json, body: '{"password":"otra-clave-9"}' }],
      ["/api/users/2", { method: "DELETE", credentials: "same-origin", headers: {} }],
    ]);
  });

  it("rejects with the server message, or a generic one when there is none or the network fails", async () => {
    const api = (impl) => createUsersApi({ fetch: vi.fn(impl) });
    await expect(api(async () => reply(409, { error: "Ya existe un usuario con ese correo." })).list()).rejects.toThrow("Ya existe un usuario con ese correo.");
    await expect(api(async () => ({ ok: false, status: 500, json: async () => { throw new Error("html"); } })).list()).rejects.toThrow("No se pudo completar la acción. Intenta de nuevo.");
    await expect(api(async () => { throw new TypeError("offline"); }).list()).rejects.toThrow("No se pudo completar la acción. Intenta de nuevo.");
  });
});
