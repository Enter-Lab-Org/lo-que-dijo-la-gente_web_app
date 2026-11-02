import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../GameApp";
import { fakeServices, storageWithGame, question } from "../test/fixtures";

// In-memory stand-in for the /api/users adapter, same shape and error behavior (rejects with the server message).
function fakeUsersApi(initial) {
  let rows = initial.map((u) => ({ createdAt: Date.UTC(2026, 10, 2), ...u }));
  let next = 100;
  return {
    list: vi.fn(async () => rows.map((u) => ({ ...u }))),
    create: vi.fn(async ({ email, password, role }) => {
      if (rows.some((u) => u.email === email)) throw new Error("Ya existe un usuario con ese correo.");
      if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
      const user = { id: next++, email, role, createdAt: Date.UTC(2026, 10, 2) };
      rows.push(user);
      return user;
    }),
    setRole: vi.fn(async (id, role) => { const u = rows.find((r) => r.id === id); u.role = role; return { ...u }; }),
    resetPassword: vi.fn(async (id) => ({ ...rows.find((r) => r.id === id) })),
    remove: vi.fn(async (id) => { rows = rows.filter((r) => r.id !== id); }),
  };
}

const ME = { id: 1, email: "admin@b.co", role: "ADMIN" };
const renderAs = (user, users = fakeUsersApi([ME, { id: 2, email: "op@b.co", role: "OPERADOR" }])) => {
  render(<App services={fakeServices({ storage: storageWithGame([question("a")]), users })} user={user} onLogout={user ? () => {} : null} />);
  return users;
};
const openUsers = async (u) => { await u.click(screen.getByRole("tab", { name: "Usuarios" })); return screen.findByRole("table", { name: "Usuarios con acceso" }); };
const row = (table, email) => within(table).getByText(email).closest("tr");

describe("Console · user administration", () => {
  it("shows the Usuarios tab only to ADMIN, never to other roles or the desktop app", () => {
    renderAs(ME);
    expect(screen.getByRole("tab", { name: "Usuarios" })).toBeInTheDocument();
  });

  it.each([["OPERADOR"], ["GUEST"]])("hides the Usuarios tab and panel from %s", (role) => {
    renderAs({ id: 3, email: "x@b.co", role });
    expect(screen.queryByRole("tab", { name: "Usuarios" })).toBeNull();
    expect(document.getElementById("p-usuarios")).toBeNull();
  });

  it("hides it in the desktop app (no user)", () => {
    renderAs(null);
    expect(screen.queryByRole("tab", { name: "Usuarios" })).toBeNull();
  });

  it("lists the users with their role", async () => {
    const u = userEvent.setup();
    renderAs(ME);
    const table = await openUsers(u);
    expect(within(row(table, "op@b.co")).getByRole("combobox", { name: "Rol de op@b.co" })).toHaveValue("OPERADOR");
    expect(within(row(table, "admin@b.co")).getByText("Tú")).toBeInTheDocument();
  });

  it("creates a user and shows it in the list; shows the server error otherwise", async () => {
    const u = userEvent.setup();
    const api = renderAs(ME);
    const table = await openUsers(u);
    await u.type(screen.getByLabelText("Correo"), "nuevo@b.co");
    await u.type(screen.getByLabelText("Contraseña"), "secreto123");
    await u.selectOptions(screen.getByLabelText("Rol"), "OPERADOR");
    await u.click(screen.getByRole("button", { name: "Crear usuario" }));
    expect(api.create).toHaveBeenCalledWith({ email: "nuevo@b.co", password: "secreto123", role: "OPERADOR" });
    expect(await within(table).findByText("nuevo@b.co")).toBeInTheDocument();
    expect(screen.getByText("Usuario creado: nuevo@b.co")).toBeInTheDocument();
    expect(screen.getByLabelText("Correo")).toHaveValue("");
    expect(screen.getByLabelText("Contraseña")).toHaveValue("");

    await u.type(screen.getByLabelText("Correo"), "op@b.co");
    await u.type(screen.getByLabelText("Contraseña"), "secreto123");
    await u.click(screen.getByRole("button", { name: "Crear usuario" }));
    expect(await screen.findByText("Ya existe un usuario con ese correo.")).toBeInTheDocument();
  });

  it("new users default to GUEST in the form", async () => {
    const u = userEvent.setup();
    renderAs(ME);
    await openUsers(u);
    expect(screen.getByLabelText("Rol")).toHaveValue("GUEST");
  });

  it("changes another user's role; your own role and delete are locked", async () => {
    const u = userEvent.setup();
    const api = renderAs(ME);
    const table = await openUsers(u);
    await u.selectOptions(within(row(table, "op@b.co")).getByRole("combobox", { name: "Rol de op@b.co" }), "GUEST");
    expect(api.setRole).toHaveBeenCalledWith(2, "GUEST");
    expect(await screen.findByText("Rol de op@b.co: GUEST")).toBeInTheDocument();
    expect(within(row(table, "admin@b.co")).getByRole("combobox", { name: "Rol de admin@b.co" })).toBeDisabled();
    expect(within(row(table, "admin@b.co")).getByRole("button", { name: "Eliminar" })).toBeDisabled();
  });

  it("resets a password from the row and clears the field", async () => {
    const u = userEvent.setup();
    const api = renderAs(ME);
    const table = await openUsers(u);
    const r = row(table, "op@b.co");
    await u.type(within(r).getByLabelText("Nueva contraseña para op@b.co"), "otra-clave-9");
    await u.click(within(r).getByRole("button", { name: "Cambiar contraseña" }));
    expect(api.resetPassword).toHaveBeenCalledWith(2, "otra-clave-9");
    expect(await screen.findByText("Contraseña cambiada para op@b.co. Sus sesiones se cerraron.")).toBeInTheDocument();
    expect(within(r).getByLabelText("Nueva contraseña para op@b.co")).toHaveValue("");
  });

  it("deletes a user only after confirming with a second click", async () => {
    const u = userEvent.setup();
    const api = renderAs(ME);
    const table = await openUsers(u);
    await u.click(within(row(table, "op@b.co")).getByRole("button", { name: "Eliminar" }));
    expect(api.remove).not.toHaveBeenCalled();
    await u.click(within(row(table, "op@b.co")).getByRole("button", { name: "¿Eliminar?" }));
    expect(api.remove).toHaveBeenCalledWith(2);
    expect(await screen.findByText("Usuario eliminado: op@b.co")).toBeInTheDocument();
    expect(within(table).queryByText("op@b.co")).toBeNull();
  });

  it("shows the error when the list cannot be loaded", async () => {
    const u = userEvent.setup();
    const api = fakeUsersApi([]);
    api.list.mockRejectedValueOnce(new Error("No tienes permiso para administrar usuarios."));
    renderAs(ME, api);
    await u.click(screen.getByRole("tab", { name: "Usuarios" }));
    expect(await screen.findByText("No tienes permiso para administrar usuarios.")).toBeInTheDocument();
  });
});
