import { describe, it, expect } from "vitest";
import * as B from "./bank";
import { toText } from "./textFormat";

const row = (id, q, cat = "", answers = [{ text: "Uno", pts: 10 }]) => ({ id, q, cat, answers, updatedAt: 1 });

describe("sanitizeBank", () => {
  it("drops invalid rows, stringifies ids and sorts by category then question (same collation as the original)", () => {
    const bank = B.sanitizeBank([
      row("1", "Zeta", ""), row(2, "Beta", "Cliente"), row("3", "Alfa", "Cliente"), { id: "4", q: "", answers: [] }, null, { id: "5", q: "Sin respuestas", answers: [] },
      row("6", "Árbol", "Ana"),
    ]);
    expect(bank.map((b) => b.id)).toEqual(["1", "6", "3", "2"]);
    expect(B.sanitizeBank("x")).toEqual([]);
  });
});

describe("upsert and delete", () => {
  it("adds new and replaces by id", () => {
    let { bank } = B.upsertQuestion([], { id: "a", q: "A", answers: [{ text: "x", pts: 1 }] }, 99);
    expect(bank).toEqual([{ id: "a", q: "A", cat: "", answers: [{ text: "x", pts: 1 }], updatedAt: 99 }]);
    ({ bank } = B.upsertQuestion(bank, { id: "a", q: "A2", cat: "C", answers: [{ text: "y", pts: 2 }] }, 100));
    expect(bank).toHaveLength(1);
    expect(bank[0]).toMatchObject({ q: "A2", cat: "C", updatedAt: 100 });
    expect(B.deleteQuestion(bank, "a")).toEqual([]);
  });
});

describe("categories and search", () => {
  const bank = B.sanitizeBank([
    row("1", "Menciona algo típico de Guadalajara", "Taller UdeG", [{ text: "Tortas ahogadas", pts: 40 }]),
    row("2", "Menciona algo que haces en Día de Muertos", "Ejemplos", [{ text: "Ir al panteón", pts: 20 }]),
    row("3", "Sin cat", ""),
  ]);

  it("lists categories with All and No category options", () => {
    expect(B.categories(bank)).toEqual(["Ejemplos", "Taller UdeG"]);
    expect(B.categoryOptions(bank)).toEqual([
      { value: "", label: "Todas las categorías" }, { value: "Ejemplos", label: "Ejemplos" },
      { value: "Taller UdeG", label: "Taller UdeG" }, { value: "__none", label: "Sin categoría" },
    ]);
    expect(B.categoryOptions([row("1", "x", "A")]).map((o) => o.value)).toEqual(["", "A"]);
  });

  it("filters by category, none, and text in questions or answers ignoring accents and case", () => {
    expect(B.filterBank(bank, { cat: "Ejemplos" }).map((b) => b.id)).toEqual(["2"]);
    expect(B.filterBank(bank, { cat: "__none" }).map((b) => b.id)).toEqual(["3"]);
    expect(B.filterBank(bank, { query: "DIA DE muertos" }).map((b) => b.id)).toEqual(["2"]);
    expect(B.filterBank(bank, { query: "panteon" }).map((b) => b.id)).toEqual(["2"]);
    expect(B.filterBank(bank, { query: "  tortas " }).map((b) => b.id)).toEqual(["1"]);
    expect(B.filterBank(bank, { query: "tortas", cat: "Ejemplos" })).toEqual([]);
    expect(B.filterBank(bank)).toHaveLength(3);
  });

  it("searches 1000 questions quickly", () => {
    const big = Array.from({ length: 1000 }, (_, i) => row(String(i), `Pregunta número ${i}`, "C", [{ text: `Respuesta ${i}`, pts: i }]));
    const t = performance.now();
    B.filterBank(big, { query: "respuesta 999" });
    expect(performance.now() - t).toBeLessThan(200);
  });
});

describe("importBlock", () => {
  it("adds parsed questions with the given category", () => {
    let n = 0;
    const r = B.importBlock([], "P1\nA | 1\n\nSola\n\nP2\nB | 2", " Cliente ", { now: 5, makeId: () => "id" + ++n });
    expect(r.count).toBe(2);
    expect(r.skipped).toBe(1);
    expect(r.bank.map((b) => [b.id, b.cat, b.updatedAt])).toEqual([["id1", "Cliente", 5], ["id2", "Cliente", 5]]);
  });

  it("returns the same bank when nothing is found", () => {
    const bank = [row("1", "x")];
    expect(B.importBlock(bank, "nada")).toEqual({ bank, count: 0, skipped: 1 });
  });

  it("exported text imports back unchanged", () => {
    const bank = B.sanitizeBank([row("1", "Q", "", [{ text: "A", pts: 3 }, { text: "B", pts: 1 }])]);
    const again = B.importBlock([], toText(bank), "");
    expect(again.bank.map(({ q, answers }) => ({ q, answers }))).toEqual(bank.map(({ q, answers }) => ({ q, answers })));
  });
});

describe("backup", () => {
  it("buildBackup has the original shape and drops theme rev", () => {
    const data = B.buildBackup([row("1", "x")], { rev: 9, title: "T" }, new Date("2026-10-26T00:00:00Z"));
    expect(data).toMatchObject({ app: "Lo Que Dijo la Gente", version: 1, fecha: "2026-10-26T00:00:00.000Z", banco: [row("1", "x")] });
    expect(JSON.parse(JSON.stringify(data)).diseno).toEqual({ title: "T" });
  });

  it("merges: adds new, replaces same id, keeps max 8 answers, returns theme", () => {
    const bank = [row("1", "Viejo"), row("2", "Otro")];
    const answers = Array.from({ length: 10 }, (_, i) => ({ text: "r" + i, pts: i }));
    const text = JSON.stringify({ banco: [row("1", "Nuevo"), { q: "Sin id", answers }, { q: "bad" }], diseno: { title: "Cliente" } });
    const r = B.mergeBackup(bank, text, { makeId: () => "gen", now: 7 });
    expect(r.count).toBe(2);
    expect(r.bank.find((b) => b.id === "1").q).toBe("Nuevo");
    expect(r.bank.find((b) => b.id === "gen").answers).toHaveLength(8);
    expect(r.bank).toHaveLength(3);
    expect(r.theme).toEqual({ title: "Cliente" });
  });

  it("accepts a plain array of questions", () => {
    const r = B.mergeBackup([], JSON.stringify([row("9", "x")]));
    expect(r.count).toBe(1);
    expect(r.theme).toBeNull();
  });

  it("rejects invalid JSON and backups without questions or design", () => {
    expect(B.mergeBackup([], "{nope")).toEqual({ error: "invalid" });
    expect(B.mergeBackup([], "null")).toEqual({ error: "invalid" });
    expect(B.mergeBackup([], JSON.stringify({ banco: [] }))).toEqual({ error: "empty" });
  });

  it("normalizes malformed backup rows so they cannot crash rendering", () => {
    const text = JSON.stringify({ banco: [
      { id: "a", q: "Ok", cat: { x: 1 }, answers: [{ text: { x: 1 }, pts: 5 }, null, "str", { text: "Bien", pts: "7" }, { text: 3, pts: "nope" }, { text: "Neg", pts: -2 }] },
      { id: "b", q: { x: 1 }, answers: [{ text: "r", pts: 1 }] },
      { id: "c", q: "Sin respuestas válidas", answers: [{ text: [] }] },
    ] });
    const r = B.mergeBackup([], text);
    expect(r.bank).toEqual([{ id: "a", q: "Ok", cat: "", answers: [{ text: "Bien", pts: 7 }, { text: "3", pts: 0 }, { text: "Neg", pts: 0 }], updatedAt: expect.any(Number) }]);
    expect(r.bank.flatMap((b) => [b.q, b.cat, ...b.answers.map((a) => a.text)]).every((v) => typeof v === "string")).toBe(true);
  });

  it("sanitizeBank cleans corrupted stored data and keeps valid rows unchanged", () => {
    const good = row("1", "Bien");
    expect(B.sanitizeBank([good, { id: "2", q: "x", answers: [{ text: {} }] }])).toEqual([good]);
  });
});

describe("question form", () => {
  it("starts with 5 blank answers", () => {
    expect(B.blankAnswers()).toEqual(Array(5).fill({ text: "", pts: "" }));
  });

  it("totals count only rows with text", () => {
    expect(B.formTotals([{ text: "a", pts: "10" }, { text: " ", pts: "5" }, { text: "b", pts: "x" }])).toEqual({ count: 2, total: 10 });
  });

  it("validates, drops empty rows, clamps points and sorts high to low", () => {
    const r = B.validateQuestion({ q: " ¿Qué? ", cat: " C ", answers: [{ text: "a", pts: "5" }, { text: "", pts: "50" }, { text: "b", pts: "-3" }, { text: "c", pts: "20" }] });
    expect(r.question).toEqual({ q: "¿Qué?", cat: "C", answers: [{ text: "c", pts: 20 }, { text: "a", pts: 5 }, { text: "b", pts: 0 }] });
  });

  it("explains what is missing", () => {
    expect(B.validateQuestion({ q: " ", cat: "", answers: [{ text: "a", pts: 1 }] })).toEqual({ error: "missing-question" });
    expect(B.validateQuestion({ q: "Q", cat: "", answers: [{ text: " ", pts: 1 }] })).toEqual({ error: "missing-answers" });
  });
});
