import { MAX_ANSWERS } from "./constants";

/* Bulk text format: question on the first line, "Answer | pts" below, blank line between questions. */
export function parseBlock(text) {
  const questions = []; let skipped = 0;
  for (const block of String(text || "").replace(/\r/g, "").split(/\n\s*\n/)) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    if (lines.length < 2) { skipped++; continue; }
    const answers = lines.slice(1).map((l) => {
      const m = l.match(/^(.*?)\s*[|:]?\s*(\d+)\s*$/);
      if (m && m[1].trim()) return { text: m[1].replace(/[|:\-–]\s*$/, "").trim(), pts: +m[2] };
      return { text: l.replace(/[|:]\s*$/, "").trim(), pts: 0 };
    }).filter((a) => a.text);
    if (!answers.length) { skipped++; continue; }
    answers.sort((a, b) => b.pts - a.pts);
    questions.push({ q: lines[0], answers: answers.slice(0, MAX_ANSWERS) });
  }
  return { questions, skipped };
}

export const toText = (qs) => qs.map((q) => [q.q, ...q.answers.map((a) => `${a.text} | ${a.pts}`)].join("\n")).join("\n\n");
