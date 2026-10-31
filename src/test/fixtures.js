import { vi } from "vitest";
import { normState, pubState, toggleReveal } from "../domain/game";

export const question = (id, answers = [["Tortillas", 34], ["Cerveza", 25], ["Salsa", 15]], cat = "") =>
  ({ id, q: "Pregunta " + id, cat, answers: answers.map(([text, pts]) => ({ text, pts })) });

export const gameWith = (...ids) => normState({ list: ids.map((id) => question(id)) });

export const pubOf = (state) => pubState(state);
export const revealed = (state, ...is) => is.reduce((s, i) => toggleReveal(s, i).state, state);

export function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
  return {
    native: false, data,
    get: vi.fn((k) => (data.has(k) ? JSON.parse(JSON.stringify(data.get(k))) : null)),
    set: vi.fn((k, v) => { data.set(k, JSON.parse(JSON.stringify(v ?? null))); return true; }),
  };
}

export function fakeBus() {
  const handlers = new Set();
  return {
    posted: [],
    post: vi.fn(function (m) { this.posted.push(JSON.parse(JSON.stringify(m))); }),
    on: vi.fn((fn) => { handlers.add(fn); return () => handlers.delete(fn); }),
    setPublicWindow: vi.fn(),
    emit: (m) => handlers.forEach((fn) => fn(m)),
  };
}

export const fakeAudio = () => ({ unlock: vi.fn(), prepare: vi.fn(), play: vi.fn(), has: (t) => ["ding", "buzz", "win"].includes(t) });

export function fakeServices(over = {}) {
  const bus = fakeBus();
  return {
    native: false,
    storage: memoryStorage(),
    bus,
    audio: fakeAudio(),
    files: { saveFile: vi.fn(async (name) => "Archivo descargado: " + name), openFile: vi.fn(async () => null) },
    images: { prepImage: vi.fn(async () => "data:image/jpeg;base64,AAA") },
    projector: { native: false, openPublic: vi.fn(() => true) },
    fullscreen: { toggle: vi.fn() },
    ...over,
  };
}

// Seeded storage with the given game items in both bank and game, so no samples are loaded.
export function storageWithGame(items, extra = {}) {
  return memoryStorage({
    "ldlg-seeded": true,
    "ldlg-banco": items.map((q) => ({ ...q, updatedAt: 1 })),
    "ldlg-v2": { list: items, idx: 0, rounds: {} },
    ...extra,
  });
}

export const lastPub = (bus) => [...bus.posted].reverse().find((m) => m.kind === "pub").pub;
