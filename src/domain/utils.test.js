import { describe, it, expect } from "vitest";
import { uid, nextRev, clone, norm, plural, today } from "./utils";

describe("utils", () => {
  it("uid uses the prefix and is unique", () => {
    const a = uid(), b = uid("fx");
    expect(a.startsWith("q")).toBe(true);
    expect(b.startsWith("fx")).toBe(true);
    expect(uid()).not.toBe(uid());
  });

  it("nextRev always grows, even when the clock is behind", () => {
    expect(nextRev(0, 1000)).toBe(1000);
    expect(nextRev(5000, 1000)).toBe(5001);
    expect(nextRev(undefined, 7)).toBe(7);
  });

  it("clone is deep", () => {
    const o = { a: [{ b: 1 }] }, c = clone(o);
    c.a[0].b = 2;
    expect(o.a[0].b).toBe(1);
  });

  it("norm removes accents and case", () => {
    expect(norm("Día de MUERTOS ñ")).toBe("dia de muertos n");
    expect(norm(null)).toBe("");
  });

  it("plural adds s except for one", () => {
    expect(plural(1, "pregunta")).toBe("pregunta");
    expect(plural(0, "pregunta")).toBe("preguntas");
    expect(plural(3, "respuesta")).toBe("respuestas");
  });

  it("today formats as YYYY-MM-DD", () => {
    expect(today(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
