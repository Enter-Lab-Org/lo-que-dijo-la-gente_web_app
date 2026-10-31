import { describe, it, expect } from "vitest";
import { displayLabel, pickDisplay, projectorStatus } from "./projector";

const main = { id: 1, n: 1, w: 1920, h: 1080, primary: true };
const proj = { id: 2, n: 2, w: 1280, h: 720, primary: false };

describe("projector", () => {
  it("labels displays with number, resolution and the main one", () => {
    expect(displayLabel(main)).toBe("Pantalla 1 (esta) · 1920×1080");
    expect(displayLabel(proj)).toBe("Pantalla 2 · 1280×720");
  });

  it("picks the active display, the kept one, the external one, or the first", () => {
    expect(pickDisplay({ displays: [main, proj], on: 1 }, "2")).toBe("1");
    expect(pickDisplay({ displays: [main, proj], on: null }, "1")).toBe("1");
    expect(pickDisplay({ displays: [main, proj], on: null }, "9")).toBe("2");
    expect(pickDisplay({ displays: [main] }, "")).toBe("1");
    expect(pickDisplay({ displays: [] }, "")).toBe("");
  });

  it("describes where the public screen is", () => {
    expect(projectorStatus({ displays: [main, proj], visible: false })).toBe("Oculta. Toca Mostrar para enviarla al proyector.");
    expect(projectorStatus({ displays: [main, proj], visible: true, on: 2, fullscreen: true })).toBe("En la pantalla 2 (1280×720), en pantalla completa.");
    expect(projectorStatus({ displays: [main], visible: true, on: null })).toBe("Solo detecto una pantalla. Conecta el proyector en modo Extender (no Duplicar) y se enviará sola.");
    expect(projectorStatus({ displays: [main, proj], visible: true, on: null })).toBe("En una ventana en tu pantalla. Elige la pantalla del proyector y toca Enviar.");
  });
});
