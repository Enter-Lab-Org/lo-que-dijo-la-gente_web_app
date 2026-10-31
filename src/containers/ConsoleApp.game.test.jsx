import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../GameApp";
import { fakeServices, memoryStorage, storageWithGame, question, lastPub } from "../test/fixtures";

const items = () => [question("a"), question("b", [["Uno", 50], ["Dos", 30]]), question("c")];
function setup(over = {}) {
  const services = fakeServices({ storage: storageWithGame(items()), ...over });
  const user = userEvent.setup();
  render(<App services={services} />);
  return { services, user, bus: services.bus, storage: services.storage };
}
const host = () => screen.getByRole("tabpanel", { name: "Juego" });
const monitor = () => document.getElementById("mon1");

describe("Console · first run", () => {
  it("loads 6 sample questions and a game with 3 of them, once", () => {
    const storage = memoryStorage();
    render(<App services={fakeServices({ storage })} />);
    expect(storage.data.get("ldlg-banco")).toHaveLength(6);
    expect(storage.data.get("ldlg-v2").list.map((x) => x.id)).toEqual(["ej1", "ej2", "ej3"]);
    expect(storage.data.get("ldlg-seeded")).toBe(true);
    expect(screen.getByText("Pregunta 1 de 3 · Ejemplos")).toBeInTheDocument();
    expect(document.title).toBe("Lo Que Dijo la Gente · Consola");
  });

  it("does not load samples again after they were deleted", () => {
    const storage = memoryStorage({ "ldlg-seeded": true, "ldlg-banco": [] });
    render(<App services={fakeServices({ storage })} />);
    expect(storage.data.get("ldlg-banco")).toEqual([]);
    expect(screen.getByRole("heading", { name: "La partida está vacía" })).toBeInTheDocument();
    expect(screen.getByText("Sin preguntas")).toBeInTheDocument();
  });

  it("publishes the public state on start and answers hello with theme and state", () => {
    const { bus, storage } = setup();
    expect(lastPub(bus)).toMatchObject({ has: true, key: "a", n: 3, open: [] });
    expect(storage.data.get("ldlg-pub")).toMatchObject({ key: "a" });
    bus.posted.length = 0;
    act(() => bus.emit({ kind: "hello" }));
    expect(bus.posted.map((m) => m.kind)).toEqual(["theme", "pub"]);
  });
});

describe("Console · conducting a round", () => {
  it("shows all answers with points and reveals them reversibly", async () => {
    const { user, bus } = setup();
    const answers = within(host()).getAllByRole("listitem").filter((li) => li.classList.contains("h-ans"));
    expect(answers.map((li) => li.textContent)).toEqual(["1Tortillas34Revelar", "2Cerveza25Revelar", "3Salsa15Revelar"]);
    await user.click(screen.getByRole("button", { name: "Revelar respuesta 2" }));
    const btn = screen.getByRole("button", { name: "Ocultar respuesta 2" });
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(btn.closest("li")).toHaveClass("open");
    expect(document.getElementById("hPot")).toHaveTextContent("25");
    expect(lastPub(bus)).toMatchObject({ open: [{ i: 1, text: "Cerveza", pts: 25 }], pot: 25, fx: { type: "ding" } });
    expect(within(monitor()).getByText("Cerveza")).toBeInTheDocument();
    await user.click(btn);
    expect(document.getElementById("hPot")).toHaveTextContent("0");
    expect(lastPub(bus).open).toEqual([]);
  });

  it("security: the public state never carries hidden answers", async () => {
    const { user, bus } = setup();
    await user.click(screen.getByRole("button", { name: "Revelar respuesta 1" }));
    await user.click(screen.getByRole("button", { name: /X Strike/ }));
    await user.click(screen.getByRole("button", { name: "Siguiente →" }));
    for (const m of bus.posted.filter((x) => x.kind === "pub")) {
      const json = JSON.stringify(m);
      expect(json).not.toContain("Cerveza");
      expect(json).not.toContain("Salsa");
      expect(json).not.toContain("Uno");
      expect(m.pub.answers).toBeUndefined();
    }
    expect(monitor()).not.toHaveTextContent("Uno");
  });

  it("strike adds a buzz up to 3, indicators fix the count silently", async () => {
    const { user, bus } = setup();
    const strikeBtn = screen.getByRole("button", { name: "X Strike" });
    for (let i = 0; i < 4; i++) await user.click(strikeBtn);
    expect(lastPub(bus)).toMatchObject({ strikes: 3, fx: { type: "buzz", n: 3 }, status: "Tres strikes: el otro equipo puede robar" });
    expect(screen.getByText("Robo de puntos")).toHaveClass("pill", "steal");
    const fxId = lastPub(bus).fx.id;
    await user.click(screen.getByRole("button", { name: "Strike 1" }));
    expect(lastPub(bus).strikes).toBe(1);
    expect(lastPub(bus).fx.id).toBe(fxId);
    expect(screen.getByRole("button", { name: "Strike 1" })).toHaveClass("on");
    expect(screen.getByRole("button", { name: "Strike 2" })).not.toHaveClass("on");
  });

  it("awards the pot once with the team's name and closes the round", async () => {
    const { user, bus } = setup();
    const awardA = screen.getByRole("button", { name: "Puntos para Equipo Rosa" });
    expect(awardA).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "x2" }));
    expect(screen.getByRole("button", { name: "x2" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Revelar respuesta 1" }));
    expect(document.getElementById("hPot")).toHaveTextContent("68");
    await user.click(awardA);
    expect(lastPub(bus)).toMatchObject({ scoreA: 68, pot: 0, status: "Ronda para Equipo Rosa", fx: { type: "win" } });
    expect(awardA).toBeDisabled();
    expect(screen.getByRole("button", { name: "Puntos para Equipo Turquesa" })).toBeDisabled();
    expect(screen.getByText("Ronda para Equipo Rosa", { selector: ".pill" })).toHaveClass("done");
  });

  it("'Mostrar todas' reveals the rest dimmed and without points", async () => {
    const { user, bus } = setup();
    await user.click(screen.getByRole("button", { name: "Revelar respuesta 3" }));
    await user.click(screen.getByRole("button", { name: "Mostrar todas" }));
    expect(lastPub(bus).open).toHaveLength(3);
    expect(document.getElementById("hPot")).toHaveTextContent("15");
    expect(screen.getByRole("button", { name: "Ocultar respuesta 1" }).closest("li")).toHaveClass("free");
    expect(screen.getByRole("button", { name: "Ocultar respuesta 3" }).closest("li")).not.toHaveClass("free");
    expect(screen.getByRole("button", { name: "Mostrar todas" })).toBeDisabled();
  });

  it("navigates with Anterior/Siguiente, disabled at the ends, keeping each round", async () => {
    const { user } = setup();
    const prev = screen.getByRole("button", { name: "← Anterior" }), next = screen.getByRole("button", { name: "Siguiente →" });
    expect(prev).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Revelar respuesta 1" }));
    await user.click(next);
    expect(document.getElementById("hRound")).toHaveTextContent("Pregunta 2 de 3");
    expect(within(monitor()).getByText("Pregunta 2 de 3")).toBeInTheDocument();
    await user.click(next);
    expect(next).toBeDisabled();
    await user.click(prev); await user.click(prev);
    expect(screen.getByRole("button", { name: "Ocultar respuesta 1" })).toBeInTheDocument();
  });

  it("team names update the public screen while typing (300 ms) and fall back when empty", () => {
    vi.useFakeTimers();
    const { bus } = setup();
    const name = document.getElementById("nameA");
    fireEvent.change(name, { target: { value: "Los Tigres" } });
    act(() => { vi.advanceTimersByTime(300); });
    expect(lastPub(bus).nameA).toBe("Los Tigres");
    expect(screen.getByRole("button", { name: "Puntos para Los Tigres" })).toBeInTheDocument();
    fireEvent.change(name, { target: { value: "  " } });
    act(() => { vi.advanceTimersByTime(300); });
    expect(lastPub(bus).nameA).toBe("Equipo Rosa");
    vi.useRealTimers();
  });

  it("scores accept typed numbers", () => {
    const { bus } = setup();
    fireEvent.change(document.getElementById("scoreB"), { target: { value: "120" } });
    expect(lastPub(bus).scoreB).toBe(120);
    fireEvent.change(document.getElementById("scoreB"), { target: { value: "" } });
    expect(lastPub(bus).scoreB).toBe(0);
  });

  it("toggles sound for the public screen", async () => {
    const { user, bus } = setup();
    const b = screen.getByRole("button", { name: "Sonido en pantalla: sí" });
    expect(b).toHaveClass("on");
    await user.click(b);
    expect(b).toHaveTextContent("Sonido en pantalla: no");
    expect(lastPub(bus).sound).toBe(false);
  });

  it("'Reiniciar marcador' needs a second click", async () => {
    const { user, bus } = setup();
    fireEvent.change(document.getElementById("scoreA"), { target: { value: "50" } });
    const reset = screen.getByRole("button", { name: "Reiniciar marcador" });
    await user.click(reset);
    expect(lastPub(bus).scoreA).toBe(50);
    await user.click(screen.getByRole("button", { name: "Toca otra vez para borrar" }));
    expect(lastPub(bus)).toMatchObject({ scoreA: 0, scoreB: 0, idx: 0, mult: 1 });
  });
});

describe("Console · keyboard shortcuts", () => {
  it("1-8 reveal, X strike, A/B award, arrows navigate", async () => {
    const { user, bus } = setup();
    await user.keyboard("2");
    expect(lastPub(bus).open).toEqual([{ i: 1, text: "Cerveza", pts: 25 }]);
    await user.keyboard("9");
    expect(lastPub(bus).open).toHaveLength(1);
    await user.keyboard("x");
    expect(lastPub(bus).strikes).toBe(1);
    await user.keyboard("B");
    expect(lastPub(bus).scoreB).toBe(25);
    await user.keyboard("a");
    expect(lastPub(bus).scoreA).toBe(0);
    await user.keyboard("{ArrowRight}");
    expect(lastPub(bus).idx).toBe(1);
    await user.keyboard("{ArrowLeft}");
    expect(lastPub(bus).idx).toBe(0);
    await user.keyboard("2");
    expect(lastPub(bus).open).toEqual([]);
  });

  it("never acts while typing in a field or with modifiers", async () => {
    const { user, bus } = setup();
    await user.click(document.getElementById("nameA"));
    await user.keyboard("1x");
    expect(lastPub(bus).open).toEqual([]);
    expect(lastPub(bus).strikes).toBe(0);
    await user.click(document.body);
    await user.keyboard("{Control>}1{/Control}");
    expect(lastPub(bus).open).toEqual([]);
  });

  it("only works in the Juego tab", async () => {
    const { user, bus } = setup();
    await user.click(screen.getByRole("tab", { name: "Diseño" }));
    await user.keyboard("1");
    expect(lastPub(bus).open).toEqual([]);
  });
});

describe("Console · playlist", () => {
  const playlist = () => document.getElementById("playlist");

  it("jumps, reorders and removes questions; awarded rounds are marked done", async () => {
    const { user, bus } = setup();
    await user.click(screen.getByRole("button", { name: "Revelar respuesta 1" }));
    await user.click(screen.getByRole("button", { name: "Puntos para Equipo Rosa" }));
    expect(within(playlist()).getAllByRole("listitem")[0]).toHaveClass("cur", "done");
    await user.click(within(playlist()).getByRole("button", { name: /Pregunta c/ }));
    expect(lastPub(bus)).toMatchObject({ key: "c", idx: 2 });
    const ups = within(playlist()).getAllByRole("button", { name: "Subir" });
    expect(ups[0]).toBeDisabled();
    expect(within(playlist()).getAllByRole("button", { name: "Bajar" })[2]).toBeDisabled();
    await user.click(ups[2]);
    expect(lastPub(bus)).toMatchObject({ key: "c", idx: 1 });
    await user.click(within(playlist()).getAllByRole("button", { name: "Quitar de la partida" })[0]);
    expect(lastPub(bus)).toMatchObject({ total: 2, key: "c", idx: 0 });
    expect(screen.getByText("· 2")).toBeInTheDocument();
  });

  it("clears with confirmation and shows the empty hints with links to the bank", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Vaciar" }));
    await user.click(screen.getByRole("button", { name: "¿Vaciar? Toca otra vez" }));
    expect(screen.getByRole("heading", { name: "La partida está vacía" })).toBeInTheDocument();
    expect(document.getElementById("plEmpty")).toBeVisible();
    expect(screen.getByRole("button", { name: "Vaciar" })).toBeDisabled();
    expect(within(monitor()).getByText("Esperando la primera pregunta")).toBeInTheDocument();
    await user.click(within(document.getElementById("hEmpty")).getByRole("button", { name: "Banco de preguntas" }));
    expect(screen.getByRole("tab", { name: "Banco de preguntas" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("Console · tabs and projector", () => {
  it("switches tabs and remembers the open tab", async () => {
    const { user, storage } = setup();
    expect(screen.getByRole("tab", { name: "Juego" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: "Banco de preguntas" }));
    expect(storage.data.get("ldlg-tab")).toBe("banco");
    expect(document.getElementById("p-juego")).not.toBeVisible();
    expect(document.getElementById("p-banco")).toBeVisible();
  });

  it("opens the saved tab on start", () => {
    render(<App services={fakeServices({ storage: storageWithGame(items(), { "ldlg-tab": "diseno" }) })} />);
    expect(screen.getByRole("tab", { name: "Diseño" })).toHaveAttribute("aria-selected", "true");
  });

  it("browser mode: opens the public window, or asks to allow popups", async () => {
    const projector = { native: false, openPublic: vi.fn(() => false) };
    const { user } = setup({ projector });
    expect(screen.getByText("Guardado en este navegador")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Abrir pantalla del público" }));
    expect(projector.openPublic).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Permite ventanas emergentes" })).toBeInTheDocument();
  });

  it("desktop mode: lists displays and controls the public window", async () => {
    let push;
    const info = { displays: [{ id: 1, n: 1, w: 1920, h: 1080, primary: true }, { id: 7, n: 2, w: 1280, h: 720, primary: false }], on: null, visible: true, fullscreen: false };
    const projector = { native: true, displays: vi.fn(async () => info), onDisplays: vi.fn((fn) => { push = fn; }), place: vi.fn(), windowed: vi.fn(), toggle: vi.fn() };
    const { user } = setup({ native: true, projector });
    expect(screen.getByText("Sin internet · todo se guarda aquí")).toBeInTheDocument();
    expect(await screen.findByText("En una ventana en tu pantalla. Elige la pantalla del proyector y toca Enviar.")).toBeInTheDocument();
    const sel = screen.getByRole("combobox", { name: "Pantalla para el público" });
    expect(sel).toHaveValue("7");
    expect(within(sel).getAllByRole("option").map((o) => o.textContent)).toEqual(["Pantalla 1 (esta) · 1920×1080", "Pantalla 2 · 1280×720"]);
    await user.click(screen.getByRole("button", { name: "Enviar a esa pantalla" }));
    expect(projector.place).toHaveBeenCalledWith(7);
    await user.click(screen.getByRole("button", { name: "En ventana" }));
    expect(projector.windowed).toHaveBeenCalled();
    act(() => push({ ...info, on: 7, fullscreen: true }));
    expect(screen.getByText("En la pantalla 2 (1280×720), en pantalla completa.")).toBeInTheDocument();
    act(() => push({ ...info, visible: false }));
    await user.click(screen.getByRole("button", { name: "Mostrar" }));
    expect(projector.toggle).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Abrir pantalla del público" })).not.toBeInTheDocument();
  });
});

afterEach(() => vi.useRealTimers());
