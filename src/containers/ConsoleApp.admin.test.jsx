import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../GameApp";
import { fakeServices, storageWithGame, question } from "../test/fixtures";

// In-memory stand-in for the /api/bank adapter: same shape, default 10 points, rejects with the server message.
function fakeBankApi({ categories = [], questions = [] } = {}) {
  let cats = categories.map((c) => ({ createdAt: 1, ...c }));
  let qs = questions.map((q) => ({ categoryId: null, category: "", createdAt: 1, picked: false, ...q }));
  let next = 100;
  return {
    listQuestions: vi.fn(async (profile) => qs.filter((q) => !profile || q.profile === profile).map((q) => ({ ...q }))),
    createQuestion: vi.fn(async ({ text, categoryId, profile, answers }) => {
      if (!text.trim()) throw new Error("Escribe la pregunta.");
      const cat = cats.find((c) => c.id === categoryId);
      const q = { id: next++, text: text.trim(), categoryId: cat ? cat.id : null, category: cat ? cat.name : "", profile, createdAt: 2, picked: false,
        answers: answers.filter((a) => a.text.trim()).map((a) => ({ text: a.text.trim(), points: a.points === "" ? 10 : Number(a.points) })) };
      qs.push(q);
      return { ...q };
    }),
    removeQuestion: vi.fn(async (id) => { qs = qs.filter((q) => q.id !== id); }),
    listCategories: vi.fn(async () => cats.map((c) => ({ ...c }))),
    createCategory: vi.fn(async (name) => {
      if (cats.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) throw new Error("Ya existe una categoría con ese nombre.");
      const c = { id: next++, name: name.trim(), createdAt: 2 };
      cats.push(c);
      return { ...c };
    }),
    removeCategory: vi.fn(async (id) => { cats = cats.filter((c) => c.id !== id); }),
    savePicks: vi.fn(async (profile, ids) => { qs = qs.map((q) => (q.profile === profile ? { ...q, picked: ids.includes(q.id) } : q)); }),
  };
}

const ADULT = [
  { id: 1, text: "Algo que nunca falta en la bolsa de una drag", profile: "ADULT", category: "Cultura drag", categoryId: 7, answers: [{ text: "Labial", points: 34 }, { text: "Pestañas", points: 21 }] },
  { id: 2, text: "Señal de que tu cita va mal", profile: "ADULT", answers: [{ text: "Llega tarde", points: 10 }] },
];
const DEFAULT_Q = { id: 3, text: "Algo que llevas a la playa", profile: "DEFAULT", answers: [{ text: "Bloqueador", points: 40 }] };
const usersApi = () => ({ list: vi.fn(async () => []), create: vi.fn(), setRole: vi.fn(), resetPassword: vi.fn(), remove: vi.fn() });

function renderAs(user, bankApi = fakeBankApi({ categories: [{ id: 7, name: "Cultura drag" }], questions: [...ADULT, DEFAULT_Q] })) {
  const services = fakeServices({ storage: storageWithGame([question("local")]), users: usersApi(), bankApi });
  render(<App services={services} user={user} onLogout={user ? () => {} : null} />);
  return { services, bankApi };
}
const ADMIN = { id: 1, email: "admin@b.co", role: "ADMIN" };
const OP = { id: 2, email: "op@b.co", role: "OPERADOR" };
// Hidden tabs stay in the DOM (the game bank has its own "Pregunta" field), so form queries are scoped to the panel.
const panel = () => within(document.getElementById("p-admin"));
const openAdmin = async (u, part) => {
  await u.click(screen.getByRole("tab", { name: "Administración" }));
  if (part) await u.click(screen.getByRole("button", { name: part }));
};

describe("Console · admin panel access", () => {
  it("shows the Administración tab to ADMIN and OPERADOR; user management only to ADMIN", async () => {
    const u = userEvent.setup();
    renderAs(OP);
    await openAdmin(u);
    expect(screen.getByRole("button", { name: "Perfil del juego" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preguntas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Categorías" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Usuarios" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Usuarios" })).toBeNull();
  });

  it("puts user management inside the panel for ADMIN", async () => {
    const u = userEvent.setup();
    renderAs(ADMIN);
    expect(screen.queryByRole("tab", { name: "Usuarios" })).toBeNull();
    await openAdmin(u, "Usuarios");
    expect(await screen.findByRole("table", { name: "Usuarios con acceso" })).toBeInTheDocument();
  });

  it("is not shown in the desktop app (no user)", () => {
    renderAs(null);
    expect(screen.queryByRole("tab", { name: "Administración" })).toBeNull();
    expect(document.getElementById("p-admin")).toBeNull();
  });
});

describe("Console · admin panel bank", () => {
  it("adds and deletes categories, showing the server message on errors", async () => {
    const u = userEvent.setup();
    const { bankApi } = renderAs(OP);
    await openAdmin(u, "Categorías");
    const list = await screen.findByRole("list", { name: "Categorías" });
    expect(within(list).getByText("Cultura drag")).toBeInTheDocument();
    await u.type(panel().getByLabelText("Nueva categoría"), "Picante");
    await u.click(screen.getByRole("button", { name: "Agregar categoría" }));
    expect(await within(list).findByText("Picante")).toBeInTheDocument();
    expect(bankApi.createCategory).toHaveBeenCalledWith("Picante");
    await u.type(panel().getByLabelText("Nueva categoría"), "picante");
    await u.click(screen.getByRole("button", { name: "Agregar categoría" }));
    expect(await screen.findByText("Ya existe una categoría con ese nombre.")).toBeInTheDocument();
    const picante = within(list).getByText("Picante").closest("li");
    await u.click(within(picante).getByRole("button", { name: "Eliminar" }));
    await u.click(within(picante).getByRole("button", { name: "¿Eliminar?" }));
    expect(within(list).queryByText("Picante")).toBeNull();
    expect(bankApi.removeCategory).toHaveBeenCalledWith(expect.any(Number));
  });

  it("adds a question with category, profile and answers; points left empty go as empty (server default 10)", async () => {
    const u = userEvent.setup();
    const { bankApi } = renderAs(OP);
    await openAdmin(u, "Preguntas");
    await screen.findByRole("list", { name: "Preguntas del banco" });
    await u.type(panel().getByLabelText("Pregunta"), "Algo que te pregunta la tía en Navidad");
    await u.selectOptions(panel().getByLabelText("Categoría"), "Cultura drag");
    await u.selectOptions(panel().getByLabelText("Perfil"), "ADULT");
    await u.type(panel().getByLabelText("Respuesta 1"), "¿Y la novia?");
    await u.type(panel().getByLabelText("Puntaje 1"), "40");
    await u.type(panel().getByLabelText("Respuesta 2"), "¿Cuándo te casas?");
    await u.click(screen.getByRole("button", { name: "Guardar pregunta" }));
    expect(bankApi.createQuestion).toHaveBeenCalledWith({
      text: "Algo que te pregunta la tía en Navidad", categoryId: 7, profile: "ADULT",
      answers: [{ text: "¿Y la novia?", points: "40" }, { text: "¿Cuándo te casas?", points: "" }],
    });
    const list = screen.getByRole("list", { name: "Preguntas del banco" });
    const item = (await within(list).findByText("Algo que te pregunta la tía en Navidad")).closest("li");
    expect(within(item).getByText("+18")).toBeInTheDocument();
    expect(within(item).getByText(/¿Cuándo te casas\? · 10/)).toBeInTheDocument();
    expect(panel().getByLabelText("Pregunta")).toHaveValue("");
    await u.click(within(item).getByRole("button", { name: "Eliminar" }));
    await u.click(within(item).getByRole("button", { name: "¿Eliminar?" }));
    expect(within(list).queryByText("Algo que te pregunta la tía en Navidad")).toBeNull();
  });
});

describe("Console · game profile", () => {
  it("lists the +18 questions with checkboxes for 100 Tacones Dijeron; No changes nothing", async () => {
    const u = userEvent.setup();
    const { services } = renderAs(OP);
    await openAdmin(u, "Perfil del juego");
    await u.click(screen.getByRole("radio", { name: /100 Tacones Dijeron/ }));
    const picker = await screen.findByRole("group", { name: "Preguntas del perfil" });
    expect(within(picker).getAllByRole("checkbox").map((c) => c.closest("label").textContent))
      .toEqual([expect.stringContaining("Algo que nunca falta"), expect.stringContaining("Señal de que tu cita")]);
    expect(within(picker).queryByText(/Algo que llevas a la playa/)).toBeNull();
    await u.click(within(picker).getByRole("checkbox", { name: /Señal de que tu cita/ }));
    await u.click(screen.getByRole("button", { name: "Usar este perfil" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("¿Deseas usar el perfil 100 Tacones Dijeron?");
    expect(dialog).toHaveTextContent("Se cargará 1 pregunta al banco del juego.");
    services.storage.set.mockClear();
    await u.click(within(dialog).getByRole("button", { name: "No" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(services.storage.set).not.toHaveBeenCalled();
    expect(services.storage.data.get("ldlg-banco").map((q) => q.id)).toEqual(["local"]);
  });

  it("on Sí switches to the profile: its colors and title, the picked questions in the local bank, and the choice saved", async () => {
    const u = userEvent.setup();
    const { services } = renderAs(OP);
    await openAdmin(u, "Perfil del juego");
    await u.click(screen.getByRole("radio", { name: /100 Tacones Dijeron/ }));
    const picker = await screen.findByRole("group", { name: "Preguntas del perfil" });
    await u.click(within(picker).getByRole("checkbox", { name: /Algo que nunca falta/ }));
    await u.click(screen.getByRole("button", { name: "Usar este perfil" }));
    await u.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Sí" }));

    expect(services.storage.data.get("ldlg-banco")).toEqual([{
      id: "db-1", q: "Algo que nunca falta en la bolsa de una drag", cat: "Cultura drag", updatedAt: expect.any(Number),
      answers: [{ text: "Labial", pts: 34 }, { text: "Pestañas", pts: 21 }],
    }]);
    const theme = services.storage.data.get("ldlg-theme-v2");
    expect(theme).toMatchObject({ profile: "tacones", title: "100 Tacones Dijeron", gold: "#FFC727", rosa: "#FF4FA3", turq: "#1EC8B8" });
    expect(services.bus.posted.at(-1)).toMatchObject({ kind: "theme", theme: { profile: "tacones" } });
    expect(services.storage.data.get("ldlg-profile")).toEqual({ active: "tacones" });
    expect(document.documentElement.dataset.profile).toBe("tacones");
    expect(document.documentElement.style.getPropertyValue("--bg")).toBe("#24093F");
    expect(screen.getByText("Perfil activo: 100 Tacones Dijeron")).toBeInTheDocument();

    // The game's bank tab now shows only the picked question.
    await u.click(screen.getByRole("tab", { name: "Banco de preguntas" }));
    expect(screen.getByText("Algo que nunca falta en la bolsa de una drag")).toBeInTheDocument();
  });

  it("applies a profile with no picked questions (empty game bank), and can switch back to default", async () => {
    const u = userEvent.setup();
    const { services } = renderAs(OP);
    await openAdmin(u, "Perfil del juego");
    await u.click(screen.getByRole("radio", { name: /100 Tacones Dijeron/ }));
    await screen.findByRole("group", { name: "Preguntas del perfil" });
    await u.click(screen.getByRole("button", { name: "Usar este perfil" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("No se cargarán preguntas: el banco del juego quedará vacío.");
    await u.click(within(dialog).getByRole("button", { name: "Sí" }));
    expect(services.storage.data.get("ldlg-banco")).toEqual([]);
    expect(services.storage.data.get("ldlg-theme-v2")).toMatchObject({ profile: "tacones", title: "100 Tacones Dijeron" });
    expect(services.storage.data.get("ldlg-profile")).toEqual({ active: "tacones" });
    expect(document.documentElement.dataset.profile).toBe("tacones");

    await u.click(screen.getByRole("radio", { name: /Lo que dijo la gente/ }));
    const picker = await screen.findByRole("group", { name: "Preguntas del perfil" });
    await u.click(within(picker).getByRole("checkbox", { name: /Algo que llevas a la playa/ }));
    await u.click(screen.getByRole("button", { name: "Usar este perfil" }));
    await u.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Sí" }));
    expect(services.storage.data.get("ldlg-banco").map((q) => q.id)).toEqual(["db-3"]);
    expect(services.storage.data.get("ldlg-theme-v2")).toMatchObject({ profile: "default", title: "Lo que dijo la gente" });
    expect(document.documentElement.dataset.profile).toBe("default");
  });

  it("saves each profile's picks in the database and preloads them when the profile is chosen; the game bank only gets the applied one", async () => {
    const u = userEvent.setup();
    const { services, bankApi } = renderAs(OP);
    const checked = (picker) => within(picker).getAllByRole("checkbox").filter((c) => c.checked).map((c) => c.closest("label").textContent);
    await openAdmin(u, "Perfil del juego");
    await u.click(screen.getByRole("radio", { name: /100 Tacones Dijeron/ }));
    let picker = await screen.findByRole("group", { name: "Preguntas del perfil" });
    await u.click(within(picker).getByRole("checkbox", { name: /Algo que nunca falta/ }));
    await u.click(screen.getByRole("button", { name: "Usar este perfil" }));
    await u.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Sí" }));
    expect(bankApi.savePicks).toHaveBeenLastCalledWith("ADULT", [1]);

    await u.click(screen.getByRole("radio", { name: /Lo que dijo la gente/ }));
    picker = await screen.findByRole("group", { name: "Preguntas del perfil" });
    expect(checked(picker)).toEqual([]);
    await u.click(within(picker).getByRole("checkbox", { name: /Algo que llevas a la playa/ }));
    await u.click(screen.getByRole("button", { name: "Usar este perfil" }));
    await u.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Sí" }));
    expect(bankApi.savePicks).toHaveBeenLastCalledWith("DEFAULT", [3]);
    // No +18 question carries into the default game bank.
    expect(services.storage.data.get("ldlg-banco").map((q) => q.id)).toEqual(["db-3"]);

    // Back to 100 Tacones: its saved pick is preloaded.
    await u.click(screen.getByRole("radio", { name: /100 Tacones Dijeron/ }));
    picker = await screen.findByRole("group", { name: "Preguntas del perfil" });
    expect(checked(picker)).toEqual([expect.stringMatching(/Algo que nunca falta/)]);

    // Saving picks never deletes questions from the database.
    expect(bankApi.removeQuestion).not.toHaveBeenCalled();
    await u.click(screen.getByRole("button", { name: "Preguntas" }));
    for (const text of [/Algo que nunca falta/, /Señal de que tu cita/, /Algo que llevas a la playa/]) expect(panel().getByText(text)).toBeInTheDocument();
  });

  it("preloads the database picks of the active profile for any operator, on a fresh console", async () => {
    const u = userEvent.setup();
    const bankApi = fakeBankApi({ questions: [{ ...ADULT[0], picked: true }, ADULT[1], { ...DEFAULT_Q, picked: true }] });
    renderAs(OP, bankApi);
    await openAdmin(u, "Perfil del juego");
    const picker = await screen.findByRole("group", { name: "Preguntas del perfil" });
    await within(picker).findByRole("checkbox", { name: /Algo que llevas a la playa/, checked: true });
    await u.click(screen.getByRole("radio", { name: /100 Tacones Dijeron/ }));
    expect(within(screen.getByRole("group", { name: "Preguntas del perfil" })).getByRole("checkbox", { name: /Algo que nunca falta/ })).toBeChecked();
    expect(within(screen.getByRole("group", { name: "Preguntas del perfil" })).getByRole("checkbox", { name: /Señal de que tu cita/ })).not.toBeChecked();
  });

  it("keeps the current profile and game bank when the picks cannot be saved", async () => {
    const u = userEvent.setup();
    const bankApi = fakeBankApi({ questions: [...ADULT, DEFAULT_Q] });
    bankApi.savePicks.mockRejectedValueOnce(new Error("Inicia sesión de nuevo."));
    const { services } = renderAs(OP, bankApi);
    await openAdmin(u, "Perfil del juego");
    await u.click(screen.getByRole("radio", { name: /100 Tacones Dijeron/ }));
    const picker = await screen.findByRole("group", { name: "Preguntas del perfil" });
    await u.click(within(picker).getByRole("checkbox", { name: /Algo que nunca falta/ }));
    await u.click(screen.getByRole("button", { name: "Usar este perfil" }));
    await u.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Sí" }));
    expect(await screen.findByText("Inicia sesión de nuevo.")).toBeInTheDocument();
    expect(services.storage.data.get("ldlg-banco").map((q) => q.id)).toEqual(["local"]);
    expect(services.storage.data.get("ldlg-profile")).toBeUndefined();
    expect(document.documentElement.dataset.profile).not.toBe("tacones");
  });

  it("warns about unapplied checkbox changes, and asks before a profile change discards them", async () => {
    const u = userEvent.setup();
    const WARN = "Hay cambios sin aplicar: usa «Usar este perfil» para guardarlos.";
    const bankApi = fakeBankApi({ questions: [{ ...ADULT[0], picked: true }, ADULT[1], DEFAULT_Q] });
    renderAs(OP, bankApi);
    await openAdmin(u, "Perfil del juego");
    await u.click(screen.getByRole("radio", { name: /100 Tacones Dijeron/ }));
    const picker = () => screen.getByRole("group", { name: "Preguntas del perfil" });
    expect(screen.queryByText(WARN)).toBeNull();

    // Toggling back to the saved picks clears the warning.
    await u.click(within(picker()).getByRole("checkbox", { name: /Señal de que tu cita/ }));
    expect(screen.getByText(WARN)).toBeInTheDocument();
    await u.click(within(picker()).getByRole("checkbox", { name: /Señal de que tu cita/ }));
    expect(screen.queryByText(WARN)).toBeNull();

    // No keeps the profile and the changes; Sí discards them and switches.
    await u.click(within(picker()).getByRole("checkbox", { name: /Señal de que tu cita/ }));
    await u.click(screen.getByRole("radio", { name: /Lo que dijo la gente/ }));
    let dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("¿Descartar los cambios sin aplicar de 100 Tacones Dijeron?");
    expect(dialog).toHaveTextContent("Las preguntas marcadas o desmarcadas que no aplicaste se perderán.");
    await u.click(within(dialog).getByRole("button", { name: "No" }));
    expect(screen.getByRole("radio", { name: /100 Tacones Dijeron/ })).toBeChecked();
    expect(within(picker()).getByRole("checkbox", { name: /Señal de que tu cita/ })).toBeChecked();

    await u.click(screen.getByRole("radio", { name: /Lo que dijo la gente/ }));
    dialog = screen.getByRole("alertdialog");
    await u.click(within(dialog).getByRole("button", { name: "Sí" }));
    expect(screen.getByRole("radio", { name: /Lo que dijo la gente/ })).toBeChecked();
    expect(screen.queryByText(WARN)).toBeNull();
    await u.click(screen.getByRole("radio", { name: /100 Tacones Dijeron/ }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(within(picker()).getByRole("checkbox", { name: /Señal de que tu cita/ })).not.toBeChecked();
    expect(within(picker()).getByRole("checkbox", { name: /Algo que nunca falta/ })).toBeChecked();
    expect(bankApi.savePicks).not.toHaveBeenCalled();
  });
});
