import { describe, it, expect } from "vitest";
import { parseBlock, toText } from "./textFormat";

describe("parseBlock", () => {
  it("reads the documented format", () => {
    const { questions, skipped } = parseBlock("Menciona algo que no puede faltar en una carne asada\nTortillas | 34\nCerveza | 25\nSalsa | 15");
    expect(skipped).toBe(0);
    expect(questions).toEqual([{ q: "Menciona algo que no puede faltar en una carne asada", answers: [
      { text: "Tortillas", pts: 34 }, { text: "Cerveza", pts: 25 }, { text: "Salsa", pts: 15 },
    ] }]);
  });

  it("accepts ':' or only a space before the number, and CRLF", () => {
    const { questions } = parseBlock("P\r\nUno: 10\r\nDos 20\r\nTres - 5");
    expect(questions[0].answers).toEqual([{ text: "Dos", pts: 20 }, { text: "Uno", pts: 10 }, { text: "Tres", pts: 5 }]);
  });

  it("answers without points get 0", () => {
    const { questions } = parseBlock("P\nAlgo |\nOtra 3");
    expect(questions[0].answers).toEqual([{ text: "Otra", pts: 3 }, { text: "Algo", pts: 0 }]);
  });

  it("skips blocks without answers and counts them", () => {
    const { questions, skipped } = parseBlock("Sola\n\nP\nA | 1\n\n\n\nOtra sola");
    expect(questions).toHaveLength(1);
    expect(skipped).toBe(2);
  });

  it("sorts by points and keeps only the best 8", () => {
    const lines = Array.from({ length: 10 }, (_, i) => `R${i} | ${i}`).join("\n");
    const { questions } = parseBlock("P\n" + lines);
    expect(questions[0].answers).toHaveLength(8);
    expect(questions[0].answers[0]).toEqual({ text: "R9", pts: 9 });
    expect(questions[0].answers[7]).toEqual({ text: "R2", pts: 2 });
  });

  it("handles empty input", () => {
    expect(parseBlock("")).toEqual({ questions: [], skipped: 0 });
    expect(parseBlock(null)).toEqual({ questions: [], skipped: 0 });
  });
});

describe("toText", () => {
  it("round-trips with parseBlock", () => {
    const qs = [
      { q: "Menciona algo típico de Guadalajara", answers: [{ text: "Tortas ahogadas", pts: 40 }, { text: "Tequila", pts: 20 }] },
      { q: "Otra", answers: [{ text: "Sí", pts: 0 }] },
    ];
    const txt = toText(qs);
    expect(txt).toBe("Menciona algo típico de Guadalajara\nTortas ahogadas | 40\nTequila | 20\n\nOtra\nSí | 0");
    expect(parseBlock(txt).questions).toEqual(qs);
  });

  it("is empty for no questions", () => {
    expect(toText([])).toBe("");
  });
});
