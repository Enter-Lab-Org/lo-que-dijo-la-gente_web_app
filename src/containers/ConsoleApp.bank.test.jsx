import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../GameApp";
import { fakeServices, storageWithGame, memoryStorage, question, lastPub } from "../test/fixtures";

const bankItems = () => [
  question("a", [["Tortas ahogadas", 40], ["Tequila", 20]], "Taller UdeG"),
  question("b", [["Ir al panteón", 20]], "Ejemplos"),
  { ...question("c", [["Algo", 5]]), q: "Menciona algo sin categoría" },
];
function setup(over = {}) {
  const items = bankItems();
  const storage = memoryStorage({ "ldlg-seeded": true, "ldlg-tab": "banco", "ldlg-banco": items, "ldlg-v2": { list: [items[0]] } });
  const services = fakeServices({ storage, ...over });
  const user = userEvent.setup();
  render(<App services={services} />);
  return { services, user, storage, bus: services.bus };
}
const list = () => document.getElementById("bList");
const rows = () => within(list()).queryAllByRole("listitem");
const field = (id) => document.getElementById(id);

describe("Bank · list, categories and search", () => {
  it("shows each question with category, answer count, total and which are in the game", () => {
    setup();
    expect(screen.getByText("3 de 3 preguntas")).toBeInTheDocument();
    const a = rows().find((li) => li.textContent.includes("Pregunta a"));
    expect(a).toHaveClass("inlist");
    expect(within(a).getByText("Taller UdeG")).toHaveClass("chip");
    expect(a).toHaveTextContent("2 respuestas · 60 pts");
    expect(a).toHaveTextContent("Tortas ahogadas 40 · Tequila 20");
    expect(within(a).getByRole("button", { name: "Quitar de la partida" })).toBeInTheDocument();
  });

  it("filters by category or no category and searches ignoring accents and case", async () => {
    const { user } = setup();
    const cat = screen.getByRole("combobox", { name: "Filtrar por categoría" });
    expect(within(cat).getAllByRole("option").map((o) => o.textContent)).toEqual(["Todas las categorías", "Ejemplos", "Taller UdeG", "Sin categoría"]);
    await user.selectOptions(cat, "__none");
    expect(rows()).toHaveLength(1);
    expect(screen.getByText("1 de 3 preguntas")).toBeInTheDocument();
    await user.selectOptions(cat, "");
    await user.type(screen.getByRole("searchbox", { name: "Buscar" }), "PANTEON");
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent("Pregunta b");
    await user.type(screen.getByRole("searchbox", { name: "Buscar" }), "zzz");
    expect(screen.getByText("Ninguna pregunta coincide con la búsqueda.")).toBeVisible();
  });

  it("adds and removes questions from the game without repeating them", async () => {
    const { user, bus } = setup();
    const b = rows().find((li) => li.textContent.includes("Pregunta b"));
    await user.click(within(b).getByRole("button", { name: "Agregar a la partida" }));
    expect(lastPub(bus).total).toBe(2);
    expect(within(b).getByRole("button", { name: "Quitar de la partida" })).toBeInTheDocument();
    await user.click(within(b).getByRole("button", { name: "Quitar de la partida" }));
    expect(lastPub(bus).total).toBe(1);
  });

  it("'Agregar las que se ven' adds the filtered ones and reports it", async () => {
    const { user, bus } = setup();
    await user.click(screen.getByRole("button", { name: "Agregar las que se ven a la partida" }));
    expect(screen.getByText("Agregué 2 a la partida")).toBeInTheDocument();
    expect(lastPub(bus).total).toBe(3);
    expect(screen.getByRole("button", { name: "Agregar las que se ven a la partida" })).toBeDisabled();
    await user.type(screen.getByRole("searchbox", { name: "Buscar" }), "a");
    expect(screen.queryByText("Agregué 2 a la partida")).not.toBeInTheDocument();
  });

  it("deletes only after confirming, and keeps the copy in the game", async () => {
    const { user, storage, bus } = setup();
    const a = rows().find((li) => li.textContent.includes("Pregunta a"));
    await user.click(within(a).getByRole("button", { name: "Eliminar" }));
    expect(rows()).toHaveLength(3);
    await user.click(within(a).getByRole("button", { name: "¿Eliminar?" }));
    expect(rows()).toHaveLength(2);
    expect(storage.data.get("ldlg-banco").map((b) => b.id)).not.toContain("a");
    expect(lastPub(bus).key).toBe("a");
  });

  it("shows the empty bank message", () => {
    render(<App services={fakeServices({ storage: memoryStorage({ "ldlg-seeded": true, "ldlg-tab": "banco" }) })} />);
    expect(screen.getByText("Tu banco está vacío. Escribe una pregunta en el formulario o importa varias en bloque.")).toBeVisible();
    expect(screen.getByText("0 de 0 preguntas")).toBeInTheDocument();
  });
});

describe("Bank · question form", () => {
  it("explains what is missing", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getByText("Escribe la pregunta.")).toBeInTheDocument();
    expect(field("fQ")).toHaveFocus();
    await user.type(field("fQ"), "Menciona algo");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getByText("Agrega al menos una respuesta.")).toBeInTheDocument();
  });

  it("creates a question sorted by points, skipping empty rows, with live totals", async () => {
    const { user, storage } = setup();
    expect(screen.getByText("0 respuestas · 0 pts")).toBeInTheDocument();
    await user.type(field("fQ"), "Menciona una fruta");
    await user.type(field("fCat"), "Cliente X");
    await user.type(screen.getByRole("textbox", { name: "Respuesta 1" }), "Pera");
    await user.type(screen.getByRole("spinbutton", { name: "Puntos de la respuesta 1" }), "10");
    await user.type(screen.getByRole("textbox", { name: "Respuesta 3" }), "Mango");
    await user.type(screen.getByRole("spinbutton", { name: "Puntos de la respuesta 3" }), "30");
    expect(screen.getByText("2 respuestas · 40 pts")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getByText("Guardada en el banco.")).toBeInTheDocument();
    const saved = storage.data.get("ldlg-banco").find((b) => b.q === "Menciona una fruta");
    expect(saved).toMatchObject({ cat: "Cliente X", answers: [{ text: "Mango", pts: 30 }, { text: "Pera", pts: 10 }] });
    expect(field("fQ")).toHaveValue("");
    expect(field("fCat")).toHaveValue("Cliente X");
    expect(screen.getByText("4 de 4 preguntas")).toBeInTheDocument();
  });

  it("adds answer rows up to 8 and removes rows", async () => {
    const { user } = setup();
    const add = screen.getByRole("button", { name: "+ Respuesta" });
    await user.click(add);
    expect(screen.getByRole("textbox", { name: "Respuesta 6" })).toHaveFocus();
    await user.click(add); await user.click(add);
    expect(add).toBeDisabled();
    expect(screen.getAllByRole("button", { name: /Quitar respuesta/ })).toHaveLength(8);
    await user.click(screen.getByRole("button", { name: "Quitar respuesta 8" }));
    expect(add).toBeEnabled();
  });

  it("removing the last row leaves one blank row", async () => {
    const { user } = setup();
    for (let i = 0; i < 5; i++) await user.click(screen.getByRole("button", { name: "Quitar respuesta 1" }));
    expect(screen.getAllByRole("button", { name: /Quitar respuesta/ })).toHaveLength(1);
  });

  it("edits a bank question and updates its copy in the game, dropping revealed answers that no longer exist", async () => {
    const { user, bus } = setup();
    await user.click(screen.getByRole("tab", { name: "Juego" }));
    await user.keyboard("2");
    expect(lastPub(bus).open).toHaveLength(1);
    await user.click(screen.getByRole("tab", { name: "Banco de preguntas" }));
    const a = rows().find((li) => li.textContent.includes("Pregunta a"));
    await user.click(within(a).getByRole("button", { name: "Editar" }));
    expect(screen.getByRole("heading", { name: "Editar pregunta" })).toBeInTheDocument();
    expect(field("fQ")).toHaveValue("Pregunta a");
    expect(field("fCat")).toHaveValue("Taller UdeG");
    await user.click(screen.getByRole("button", { name: "Quitar respuesta 2" }));
    await user.clear(field("fQ"));
    await user.type(field("fQ"), "Pregunta corregida");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getByText("Cambios guardados.")).toBeInTheDocument();
    expect(lastPub(bus)).toMatchObject({ q: "Pregunta corregida", n: 1, open: [] });
    expect(screen.getByRole("heading", { name: "Nueva pregunta" })).toBeInTheDocument();
  });

  it("'Limpiar' and 'Nueva' reset the form", async () => {
    const { user } = setup();
    await user.type(field("fQ"), "Algo");
    await user.type(field("fCat"), "Cat");
    await user.click(screen.getByRole("button", { name: "Limpiar" }));
    expect(field("fQ")).toHaveValue("");
    expect(field("fCat")).toHaveValue("Cat");
    await user.click(screen.getByRole("button", { name: "Nueva" }));
    expect(field("fCat")).toHaveValue("");
    expect(field("fQ")).toHaveFocus();
  });

  it("suggests existing categories", () => {
    setup();
    expect([...document.querySelectorAll("#catList option")].map((o) => o.value)).toEqual(["Ejemplos", "Taller UdeG"]);
  });
});

describe("Bank · import, backup and export", () => {
  it("imports a text block with a category and reports skipped blocks", async () => {
    const { user, storage } = setup();
    fireEvent.change(field("impText"), { target: { value: "Nueva uno\nA | 3\n\nSin respuestas\n\nNueva dos\nB: 4" } });
    await user.type(field("impCat"), "Evento");
    await user.click(screen.getByRole("button", { name: "Importar al banco" }));
    expect(screen.getByText("Listo: 2 preguntas en el banco. Omití 1 bloque sin respuestas.")).toBeInTheDocument();
    expect(storage.data.get("ldlg-banco").filter((b) => b.cat === "Evento")).toHaveLength(2);
    expect(field("impText")).toHaveValue("");
  });

  it("says when no questions were found", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Importar al banco" }));
    expect(screen.getByText("No encontré preguntas. Revisa que cada una tenga al menos una respuesta debajo.")).toBeInTheDocument();
  });

  it("opens a .txt into the import box", async () => {
    const files = { saveFile: vi.fn(), openFile: vi.fn(async () => ({ name: "lista.txt", text: "Q\nA | 1" })) };
    const { user } = setup({ files });
    await user.click(screen.getByRole("button", { name: "Abrir archivo" }));
    expect(field("impText")).toHaveValue("Q\nA | 1");
    expect(screen.getByText("Cargué lista.txt. Revisa el texto y toca Importar al banco.")).toBeInTheDocument();
  });

  it("restores a .json backup: merges questions and applies the design", async () => {
    const backup = { app: "Lo Que Dijo la Gente", version: 1, banco: [{ id: "a", q: "Reemplazada", cat: "", answers: [{ text: "x", pts: 1 }] }, { id: "n", q: "Nueva", answers: [{ text: "y", pts: 2 }] }], diseno: { title: "Cliente" } };
    const files = { saveFile: vi.fn(), openFile: vi.fn(async () => ({ name: "r.json", text: JSON.stringify(backup) })) };
    const { user, storage, bus } = setup({ files });
    await user.click(screen.getByRole("button", { name: "Abrir archivo" }));
    expect(screen.getByText("Respaldo cargado: 2 preguntas. También cargué el diseño.")).toBeInTheDocument();
    const bank = storage.data.get("ldlg-banco");
    expect(bank).toHaveLength(4);
    expect(bank.find((b) => b.id === "a").q).toBe("Reemplazada");
    expect(storage.data.get("ldlg-theme-v2").title).toBe("Cliente");
    expect(bus.posted.some((m) => m.kind === "theme" && m.theme.title === "Cliente")).toBe(true);
  });

  it("rejects an invalid .json without changes", async () => {
    const files = { saveFile: vi.fn(), openFile: vi.fn(async () => ({ name: "r.json", text: "{roto" })) };
    const { user, storage } = setup({ files });
    await user.click(screen.getByRole("button", { name: "Abrir archivo" }));
    expect(screen.getByText("Ese archivo no es un respaldo válido.")).toBeInTheDocument();
    expect(storage.data.get("ldlg-banco")).toHaveLength(3);
    files.openFile.mockResolvedValueOnce({ name: "r.json", text: "{}" });
    await user.click(screen.getByRole("button", { name: "Abrir archivo" }));
    expect(screen.getByText("El respaldo no trae preguntas.")).toBeInTheDocument();
  });

  it("saves a dated backup with bank and design", async () => {
    const { user, services } = setup();
    await user.click(screen.getByRole("button", { name: "Guardar respaldo" }));
    const [name, text, mime] = services.files.saveFile.mock.calls[0];
    expect(name).toMatch(/^respaldo-lo-que-dijo-la-gente-\d{4}-\d{2}-\d{2}\.json$/);
    expect(mime).toBe("application/json");
    const data = JSON.parse(text);
    expect(data).toMatchObject({ app: "Lo Que Dijo la Gente", version: 1 });
    expect(data.banco).toHaveLength(3);
    expect(data.diseno.title).toBe("Lo que dijo la gente");
    expect(data.diseno.rev).toBeUndefined();
    expect(await screen.findByText(/^Archivo descargado: respaldo-/)).toBeInTheDocument();
  });

  it("exports the filtered questions as re-importable text", async () => {
    const { user, services } = setup();
    await user.selectOptions(screen.getByRole("combobox", { name: "Filtrar por categoría" }), "Ejemplos");
    await user.click(screen.getByRole("button", { name: "Exportar preguntas en texto" }));
    const [name, text] = services.files.saveFile.mock.calls[0];
    expect(name).toMatch(/^preguntas-.*\.txt$/);
    expect(text).toBe("Pregunta b\nIr al panteón | 20");
  });

  it("reports export errors and empty exports", async () => {
    const files = { saveFile: vi.fn(async () => { throw new Error("x"); }), openFile: vi.fn() };
    const { user } = setup({ files });
    await user.click(screen.getByRole("button", { name: "Guardar respaldo" }));
    expect(await screen.findByText("No se pudo guardar el archivo.")).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "Buscar" }), "zzz");
    await user.click(screen.getByRole("button", { name: "Exportar preguntas en texto" }));
    expect(screen.getByText("No hay preguntas para exportar.")).toBeInTheDocument();
  });
});
