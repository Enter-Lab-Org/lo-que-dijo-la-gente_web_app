import { createJsonCall } from "./http";

/* Browser client for /api/users (ADMIN only; the server enforces it). Every method rejects with the server's message. */
export function createUsersApi({ fetch }) {
  const call = createJsonCall({ fetch });
  return {
    list: async () => (await call("GET", "/api/users")).users,
    create: async ({ email, password, role }) => (await call("POST", "/api/users", { email, password, role })).user,
    setRole: async (id, role) => (await call("PATCH", `/api/users/${id}`, { role })).user,
    resetPassword: async (id, password) => (await call("PATCH", `/api/users/${id}`, { password })).user,
    remove: async (id) => { await call("DELETE", `/api/users/${id}`); },
  };
}
