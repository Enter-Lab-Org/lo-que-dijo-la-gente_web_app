import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../GameApp";
import { fakeServices, memoryStorage, gameWith, revealed, pubOf } from "../test/fixtures";
import { stamp } from "../domain/game";

const pubAt = (state, rev) => ({ ...pubOf(state), rev });
function setup(over = {}, stored = {}) {
  const services = fakeServices({ storage: memoryStorage(stored), ...over });
  render(<App services={services} />);
  return services;
}

describe("Public screen window", () => {
  beforeEach(() => { window.location.hash = "#publico"; });
  afterEach(() => { window.location.hash = ""; vi.useRealTimers(); });

  it("shows the saved state and theme, and says hello to the console", () => {
    const s = setup({}, { "ldlg-pub": pubAt(gameWith("a"), 5), "ldlg-theme-v2": { rev: 2, title: "Cliente" } });
    expect(screen.getByRole("heading", { name: "Pregunta a" })).toBeInTheDocument();
    expect(screen.getByText("Cliente")).toBeInTheDocument();
    expect(s.bus.post).toHaveBeenCalledWith({ kind: "hello" });
    expect(document.title).toBe("Lo Que Dijo la Gente · Público");
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("applies newer states and ignores older revs", () => {
    const s = setup();
    expect(screen.getByRole("heading", { name: "Esperando la primera pregunta" })).toBeInTheDocument();
    act(() => s.bus.emit({ kind: "pub", pub: pubAt(revealed(gameWith("a"), 0), 10) }));
    expect(screen.getByText("Tortillas")).toBeInTheDocument();
    act(() => s.bus.emit({ kind: "pub", pub: pubAt(gameWith("a"), 9) }));
    expect(screen.getByText("Tortillas")).toBeInTheDocument();
    act(() => s.bus.emit({ kind: "theme", theme: { rev: 3, title: "Nuevo" } }));
    act(() => s.bus.emit({ kind: "theme", theme: { rev: 1, title: "Viejo" } }));
    expect(screen.getByText("Nuevo")).toBeInTheDocument();
  });

  it("security: only renders what the public state carries", () => {
    const s = setup();
    act(() => s.bus.emit({ kind: "pub", pub: pubAt(revealed(gameWith("a"), 2), 10) }));
    const board = document.getElementById("pubWrap");
    expect(board).toHaveTextContent("Salsa");
    expect(board).not.toHaveTextContent("Tortillas");
    expect(board).not.toHaveTextContent("Cerveza");
  });

  it("plays sounds for fresh effects", () => {
    const s = setup();
    act(() => s.bus.emit({ kind: "pub", pub: pubOf(stamp(revealed(gameWith("a"), 0), "ding")) }));
    expect(s.audio.play).toHaveBeenCalledWith("ding");
  });

  it("browser: 'Iniciar' enables sound and full screen, then hides", async () => {
    const s = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Iniciar" }));
    expect(s.audio.unlock).toHaveBeenCalled();
    expect(s.fullscreen.toggle).toHaveBeenCalled();
    expect(screen.queryByText("Pantalla lista")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Pantalla completa" }));
    expect(s.fullscreen.toggle).toHaveBeenCalledTimes(2);
  });

  it("hides the cursor and corner button after 2.5 s without moving", () => {
    vi.useFakeTimers();
    setup();
    expect(screen.getByTestId("corner")).toHaveClass("show");
    act(() => { vi.advanceTimersByTime(2500); });
    expect(screen.getByTestId("corner")).not.toHaveClass("show");
    expect(document.body).toHaveClass("nocursor");
    fireEvent.mouseMove(document);
    expect(document.body).not.toHaveClass("nocursor");
    expect(screen.getByTestId("corner")).toHaveClass("show");
  });

  it("desktop app: no start overlay, sound ready, Esc leaves full screen", () => {
    const projector = { native: true, escape: vi.fn() };
    const s = setup({ native: true, projector });
    expect(screen.queryByRole("button", { name: "Iniciar" })).not.toBeInTheDocument();
    expect(s.audio.prepare).toHaveBeenCalled();
    expect(screen.getByTestId("corner")).not.toHaveClass("show");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(projector.escape).toHaveBeenCalled();
  });
});

describe("App routing", () => {
  afterEach(() => { window.location.hash = ""; });

  it("switches between console and public screen on hash change", () => {
    render(<App services={fakeServices()} />);
    expect(screen.getByText("Consola")).toBeInTheDocument();
    act(() => { window.location.hash = "#publico"; window.dispatchEvent(new HashChangeEvent("hashchange")); });
    expect(screen.queryByText("Consola")).not.toBeInTheDocument();
    expect(screen.getByTestId("public-screen")).toHaveClass("full");
  });
});
