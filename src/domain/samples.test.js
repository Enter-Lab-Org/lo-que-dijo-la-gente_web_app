import { describe, it, expect } from "vitest";
import { sampleBank, seedFirstRun } from "./samples";
import { defaults } from "./game";

describe("sample questions", () => {
  it("has 6 questions in the Ejemplos category with stable ids", () => {
    const bank = sampleBank();
    expect(bank).toHaveLength(6);
    expect(bank.every((b) => b.cat === "Ejemplos")).toBe(true);
    expect(bank.map((b) => b.id)).toEqual(["ej1", "ej2", "ej3", "ej4", "ej5", "ej6"]);
    expect(bank[1].q).toBe("Menciona algo típico de Guadalajara");
  });

  it("seeds the bank and 3 game questions on first run with an empty bank", () => {
    const r = seedFirstRun({ state: defaults(), bank: [], seeded: false });
    expect(r.changed).toBe(true);
    expect(r.seeded).toBe(true);
    expect(r.bank).toHaveLength(6);
    expect(r.state.list.map((x) => x.id)).toEqual(["ej1", "ej2", "ej3"]);
  });

  it("never seeds again once seeded, even with an empty bank", () => {
    const state = defaults();
    const r = seedFirstRun({ state, bank: [], seeded: true });
    expect(r.changed).toBe(false);
    expect(r.bank).toEqual([]);
  });

  it("does not seed when the bank already has questions", () => {
    const bank = [{ id: "a", q: "x", cat: "", answers: [{ text: "y", pts: 1 }] }];
    const r = seedFirstRun({ state: defaults(), bank, seeded: false });
    expect(r.bank).toBe(bank);
    expect(r.seeded).toBe(true);
    expect(r.changed).toBe(false);
  });

  it("keeps an existing game list", () => {
    const state = { ...defaults(), list: [{ id: "z", q: "Z", cat: "", answers: [{ text: "a", pts: 1 }] }] };
    const r = seedFirstRun({ state, bank: [], seeded: false });
    expect(r.state.list.map((x) => x.id)).toEqual(["z"]);
  });
});
