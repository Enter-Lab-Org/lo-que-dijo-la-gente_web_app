import { describe, it, expect, vi } from "vitest";
import { getNative } from "./native";
import { createStorage } from "./storage";
import { createBus } from "./bus";
import { createFiles } from "./files";
import { createProjector } from "./projector";
import { createAudio } from "./audio";

const memLocal = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), m }; };

describe("getNative", () => {
  it("returns the bridge only when it is native", () => {
    const ldlg = { native: true };
    expect(getNative({ ldlg })).toBe(ldlg);
    expect(getNative({ ldlg: {} })).toBeNull();
    expect(getNative({})).toBeNull();
  });
});

describe("storage", () => {
  it("uses localStorage with JSON in the browser", () => {
    const local = memLocal(), s = createStorage({ local });
    expect(s.set("ldlg-v2", { a: 1 })).toBe(true);
    expect(local.m.get("ldlg-v2")).toBe('{"a":1}');
    expect(s.get("ldlg-v2")).toEqual({ a: 1 });
    expect(s.get("missing")).toBeNull();
    local.m.set("bad", "{x");
    expect(s.get("bad")).toBeNull();
  });

  it("reports a failed write (quota)", () => {
    const s = createStorage({ local: { setItem: () => { throw new Error("quota"); }, getItem: () => null } });
    expect(s.set("k", 1)).toBe(false);
  });

  it("uses the native bridge when present", () => {
    const native = { load: vi.fn(() => ({ b: 2 })), save: vi.fn() };
    const s = createStorage({ native, local: memLocal() });
    expect(s.get("ldlg-banco")).toEqual({ b: 2 });
    expect(native.load).toHaveBeenCalledWith("ldlg-banco");
    expect(s.set("ldlg-banco", [1])).toBe(true);
    expect(native.save).toHaveBeenCalledWith("ldlg-banco", [1]);
    native.load.mockImplementation(() => { throw new Error(); });
    native.save.mockImplementation(() => { throw new Error(); });
    expect(s.get("x")).toBeNull();
    expect(s.set("x", 1)).toBe(false);
  });
});

class FakeChannel {
  static all = [];
  constructor(name) { this.name = name; this.listeners = []; this.sent = []; FakeChannel.all.push(this); }
  addEventListener(_t, fn) { this.listeners.push(fn); }
  postMessage(m) { this.sent.push(m); FakeChannel.all.filter((c) => c !== this && c.name === this.name).forEach((c) => c.listeners.forEach((fn) => fn({ data: m }))); }
}

describe("bus", () => {
  it("talks between windows over BroadcastChannel ldlg-v2", () => {
    FakeChannel.all = [];
    const a = createBus({ win: window, BroadcastChannelImpl: FakeChannel });
    const b = createBus({ win: window, BroadcastChannelImpl: FakeChannel });
    const got = vi.fn();
    const off = b.on(got);
    a.post({ kind: "hello" });
    expect(FakeChannel.all[0].name).toBe("ldlg-v2");
    expect(got).toHaveBeenCalledWith({ kind: "hello" });
    off();
    a.post({ kind: "pub" });
    expect(got).toHaveBeenCalledTimes(1);
  });

  it("posts to the opened public window and accepts messages only from it", () => {
    const pub = { closed: false, postMessage: vi.fn() };
    const bus = createBus({ win: window, BroadcastChannelImpl: FakeChannel });
    bus.setPublicWindow(pub);
    bus.post({ kind: "theme" });
    expect(pub.postMessage).toHaveBeenCalledWith({ __ldlg: true, m: { kind: "theme" } }, window.location.origin);
    const got = vi.fn();
    bus.on(got);
    window.dispatchEvent(new MessageEvent("message", { data: { __ldlg: true, m: { kind: "hello" } }, source: null, origin: window.location.origin }));
    expect(got).not.toHaveBeenCalled();
  });

  it("ignores messages from another origin, even from the opened window or the opener", () => {
    const pub = { closed: false, postMessage: vi.fn() };
    const opener = { closed: false, postMessage: vi.fn() };
    const win = Object.assign(new EventTarget(), { location: { origin: "https://game.example" }, opener });
    const bus = createBus({ win, BroadcastChannelImpl: undefined });
    bus.setPublicWindow(pub);
    const got = vi.fn();
    bus.on(got);
    const data = { __ldlg: true, m: { kind: "hello" } };
    win.dispatchEvent(new MessageEvent("message", { data, source: opener, origin: "https://evil.example" }));
    win.dispatchEvent(new MessageEvent("message", { data, source: pub, origin: "https://evil.example" }));
    expect(got).not.toHaveBeenCalled();
    win.dispatchEvent(new MessageEvent("message", { data, source: opener, origin: "https://game.example" }));
    expect(got).toHaveBeenCalledWith({ kind: "hello" });
    bus.post({ kind: "pub" });
    expect(opener.postMessage).toHaveBeenCalledWith({ __ldlg: true, m: { kind: "pub" } }, "https://game.example");
  });

  it("falls back to '*' only for an opaque origin (file://), which a remote page cannot open", () => {
    const pub = { closed: false, postMessage: vi.fn() };
    const win = Object.assign(new EventTarget(), { location: { origin: "null" }, opener: null });
    const bus = createBus({ win, BroadcastChannelImpl: undefined });
    bus.setPublicWindow(pub);
    bus.post({ kind: "theme" });
    expect(pub.postMessage).toHaveBeenCalledWith({ __ldlg: true, m: { kind: "theme" } }, "*");
  });

  it("works without BroadcastChannel", () => {
    const bus = createBus({ win: window, BroadcastChannelImpl: undefined });
    expect(() => bus.post({ kind: "x" })).not.toThrow();
  });

  it("uses native IPC when present", () => {
    let nativeFn;
    const native = { on: vi.fn((fn) => { nativeFn = fn; }), send: vi.fn() };
    const bus = createBus({ native, win: window });
    const got = vi.fn();
    bus.on(got);
    nativeFn({ kind: "pub", pub: { rev: 1 } });
    expect(got).toHaveBeenCalledWith({ kind: "pub", pub: { rev: 1 } });
    bus.post({ kind: "hello" });
    expect(native.send).toHaveBeenCalledWith({ kind: "hello" });
    expect(native.on).toHaveBeenCalledTimes(1);
  });
});

describe("files", () => {
  it("downloads in the browser", async () => {
    const url = { createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() };
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const msg = await createFiles({ doc: document, url }).saveFile("a.txt", "hola", "text/plain");
    expect(msg).toBe("Archivo descargado: a.txt");
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it("uses native dialogs when present", async () => {
    const native = { exportFile: vi.fn(async () => "/home/x/a.json"), importFile: vi.fn(async () => ({ name: "b.txt", text: "t" })) };
    const f = createFiles({ native, doc: document });
    expect(await f.saveFile("a.json", "{}", "application/json")).toBe("Guardado en /home/x/a.json");
    native.exportFile.mockResolvedValueOnce(null);
    expect(await f.saveFile("a.json", "{}")).toBeNull();
    expect(await f.openFile()).toEqual({ name: "b.txt", text: "t" });
  });

  it("opens a file picker and reads the text", async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function () {
      Object.defineProperty(this, "files", { value: [new File(["Q\nA | 1"], "p.txt")] });
      this.onchange();
    });
    expect(await createFiles({ doc: document }).openFile()).toEqual({ name: "p.txt", text: "Q\nA | 1" });
    click.mockRestore();
  });
});

describe("projector", () => {
  it("opens #publico in a popup and registers it on the bus", () => {
    const pub = { focus: vi.fn() };
    const win = { location: { href: "http://localhost:8081/#x" }, open: vi.fn(() => pub) };
    const bus = { setPublicWindow: vi.fn() };
    const p = createProjector({ win, bus });
    expect(p.native).toBe(false);
    expect(p.openPublic()).toBe(true);
    expect(win.open).toHaveBeenCalledWith("http://localhost:8081/#publico", "ldlg-publico", "popup,width=1280,height=720");
    expect(bus.setPublicWindow).toHaveBeenCalledWith(pub);
    win.open.mockReturnValue(null);
    expect(p.openPublic()).toBe(false);
  });

  it("delegates to the native bridge", () => {
    const native = { displays: vi.fn(), onDisplays: vi.fn(), place: vi.fn(), windowed: vi.fn(), toggle: vi.fn(), escape: vi.fn() };
    const p = createProjector({ native });
    p.place(2); p.windowed(); p.toggle(); p.escape();
    expect(native.place).toHaveBeenCalledWith(2);
    expect(native.windowed).toHaveBeenCalled();
    expect(native.toggle).toHaveBeenCalled();
    expect(native.escape).toHaveBeenCalled();
  });
});

describe("audio", () => {
  it("is silent and safe without WebAudio", () => {
    const a = createAudio({ win: {} });
    expect(() => { a.unlock(); a.play("ding"); a.play("nope"); }).not.toThrow();
    expect(a.has("buzz")).toBe(true);
    expect(a.has("nope")).toBe(false);
  });

  it("synthesizes tones with oscillators", () => {
    const osc = () => ({ frequency: {}, connect: vi.fn(), start: vi.fn(), stop: vi.fn() });
    const ctx = { state: "running", currentTime: 0, destination: {}, createOscillator: vi.fn(osc), createGain: vi.fn(() => ({ gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() })) };
    const a = createAudio({ win: { AudioContext: function () { return ctx; } } });
    a.play("win");
    expect(ctx.createOscillator).toHaveBeenCalledTimes(4);
  });
});
