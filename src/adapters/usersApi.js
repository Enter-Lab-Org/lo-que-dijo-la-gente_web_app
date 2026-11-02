const FALLBACK = "No se pudo completar la acción. Intenta de nuevo.";

/* Browser client for /api/users (ADMIN only; the server enforces it). Every method rejects with the server's message. */
export function createUsersApi({ fetch }) {
  async function call(method, path, body) {
    let res;
    try {
      res = await fetch(path, {
        method,
        credentials: "same-origin",
        headers: body ? { "content-type": "application/json" } : {},
        ...(body && { body: JSON.stringify(body) }),
      });
    } catch (e) {
      throw new Error(FALLBACK);
    }
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) throw new Error(data?.error || FALLBACK);
    return data;
  }
  return {
    list: async () => (await call("GET", "/api/users")).users,
    create: async ({ email, password, role }) => (await call("POST", "/api/users", { email, password, role })).user,
    setRole: async (id, role) => (await call("PATCH", `/api/users/${id}`, { role })).user,
    resetPassword: async (id, password) => (await call("PATCH", `/api/users/${id}`, { password })).user,
    remove: async (id) => { await call("DELETE", `/api/users/${id}`); },
  };
}
