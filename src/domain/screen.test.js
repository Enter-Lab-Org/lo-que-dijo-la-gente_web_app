import { describe, it, expect } from "vitest";
import { boardSlots, roundLabel, isNewer, isFreshFx, bigXCount } from "./screen";

describe("public screen helpers", () => {
  it("board slots are even, minimum 2, 8 when empty", () => {
    expect(boardSlots(0)).toBe(8);
    expect(boardSlots(1)).toBe(2);
    expect(boardSlots(5)).toBe(6);
    expect(boardSlots(6)).toBe(6);
    expect(boardSlots(8)).toBe(8);
  });

  it("round label shows Pregunta N de T and the multiplier", () => {
    expect(roundLabel({ has: false })).toBe("");
    expect(roundLabel({ has: true, idx: 0, total: 3, mult: 1 })).toBe("Pregunta 1 de 3");
    expect(roundLabel({ has: true, idx: 1, total: 3, mult: 2 })).toBe("Pregunta 2 de 3 · Puntos dobles");
    expect(roundLabel({ has: true, idx: 2, total: 3, mult: 3 })).toBe("Pregunta 3 de 3 · Puntos triples");
  });

  it("only accepts states with a higher rev", () => {
    expect(isNewer(null, { rev: 1 })).toBe(true);
    expect(isNewer({ rev: 5 }, { rev: 6 })).toBe(true);
    expect(isNewer({ rev: 5 }, { rev: 5 })).toBe(false);
    expect(isNewer({ rev: 5 }, { rev: 4 })).toBe(false);
    expect(isNewer({ rev: 5 }, null)).toBe(false);
  });

  it("fx plays only when new and younger than 8 seconds", () => {
    expect(isFreshFx({ id: "a", at: 1000 }, null, 8999)).toBe(true);
    expect(isFreshFx({ id: "a", at: 1000 }, null, 9000)).toBe(false);
    expect(isFreshFx({ id: "a", at: 1000 }, "a", 1001)).toBe(false);
    expect(isFreshFx(null, null, 1)).toBe(false);
  });

  it("big X count is between 1 and 3", () => {
    expect(bigXCount(0)).toBe(1);
    expect(bigXCount(2)).toBe(2);
    expect(bigXCount(7)).toBe(3);
  });
});
