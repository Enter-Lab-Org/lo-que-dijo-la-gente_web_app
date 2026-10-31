import { MAX_ANSWERS } from "./constants";
import { norm, uid } from "./utils";
import { parseBlock } from "./textFormat";

/* Question bank ("banco"): sanitize, CRUD, filter, import and backup merge. */

export const NO_CATEGORY = "__none";

// Backups and stored data are untrusted: anything that is not text would crash React when rendered.
const text = (v) => (typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : "");
const points = (v) => { const n = parseInt(v, 10); return n > 0 ? n : 0; };
const sanitizeAnswers = (answers) =>
  (Array.isArray(answers) ? answers : [])
    .filter((a) => a && typeof a === "object" && text(a.text))
    .slice(0, MAX_ANSWERS)
    .map((a) => ({ text: text(a.text), pts: points(a.pts) }));

export const sanitizeBank = (items) =>
  (Array.isArray(items) ? items : [])
    .filter((d) => d && typeof d === "object")
    .map((d) => ({ id: text(d.id), q: text(d.q), cat: text(d.cat), answers: sanitizeAnswers(d.answers), updatedAt: Number(d.updatedAt) || 0 }))
    .filter((d) => d.id && d.q && d.answers.length)
    .sort((a, b) => (a.cat || "~").localeCompare(b.cat || "~", "es") || a.q.localeCompare(b.q, "es"));

export function upsertQuestion(bank, item, now = Date.now()) {
  const row = { id: item.id, q: item.q, cat: item.cat || "", answers: item.answers, updatedAt: now };
  const i = bank.findIndex((b) => b.id === item.id);
  const next = bank.slice();
  if (i >= 0) next[i] = row; else next.push(row);
  return { bank: sanitizeBank(next), row };
}

export const deleteQuestion = (bank, id) => bank.filter((b) => b.id !== id);

export const categories = (bank) => [...new Set(bank.map((b) => b.cat).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));

export function categoryOptions(bank) {
  const opts = [{ value: "", label: "Todas las categorías" }, ...categories(bank).map((c) => ({ value: c, label: c }))];
  if (bank.some((b) => !b.cat)) opts.push({ value: NO_CATEGORY, label: "Sin categoría" });
  return opts;
}

export function filterBank(bank, { query = "", cat = "" } = {}) {
  const q = norm(String(query).trim());
  return bank.filter((b) => (!cat || (cat === NO_CATEGORY ? !b.cat : b.cat === cat)) &&
    (!q || norm(b.q).includes(q) || b.answers.some((a) => norm(a.text).includes(q))));
}

export const answerTotal = (answers) => answers.reduce((s, a) => s + (a.pts || 0), 0);

export function importBlock(bank, text, cat, { now = Date.now(), makeId = uid } = {}) {
  const { questions, skipped } = parseBlock(text);
  if (!questions.length) return { bank, count: 0, skipped };
  const next = bank.slice();
  questions.forEach((q) => next.push({ id: makeId(), q: q.q, cat: String(cat || "").trim(), answers: q.answers, updatedAt: now }));
  return { bank: sanitizeBank(next), count: questions.length, skipped };
}

/* Backup JSON merge: adds new questions, replaces those with the same id. Returns { error } on invalid data. */
export function mergeBackup(bank, text, { now = Date.now(), makeId = uid } = {}) {
  let data;
  try { data = JSON.parse(text); } catch (e) { return { error: "invalid" }; }
  if (!data || typeof data !== "object") return { error: "invalid" };
  const rows = Array.isArray(data) ? data : Array.isArray(data.banco) ? data.banco : [];
  const theme = !Array.isArray(data) && data.diseno && typeof data.diseno === "object" ? data.diseno : null;
  if (!rows.length && !theme) return { error: "empty" };
  const byId = new Map(bank.map((b) => [b.id, b]));
  let count = 0;
  rows.forEach((r) => {
    if (r && r.q && Array.isArray(r.answers)) {
      const id = String(r.id || makeId());
      byId.set(id, { id, q: r.q, cat: r.cat || "", answers: r.answers.slice(0, MAX_ANSWERS), updatedAt: r.updatedAt || now });
      count++;
    }
  });
  return { bank: sanitizeBank([...byId.values()]), count, theme };
}

export const buildBackup = (bank, theme, date = new Date()) =>
  ({ app: "Lo Que Dijo la Gente", version: 1, fecha: date.toISOString(), banco: bank, diseno: Object.assign({}, theme, { rev: undefined }) });

/* Question form */
export const blankAnswer = () => ({ text: "", pts: "" });
export const blankAnswers = () => Array.from({ length: 5 }, blankAnswer);

export function formTotals(answers) {
  const filled = answers.filter((a) => String(a.text).trim());
  return { count: filled.length, total: filled.reduce((s, a) => s + (parseInt(a.pts, 10) || 0), 0) };
}

// Cleans the form: drops empty rows, points are integers >= 0, sorted high to low, max 8.
export function validateQuestion({ q, cat, answers }) {
  const text = String(q || "").trim();
  const clean = answers.map((a) => ({ text: String(a.text).trim(), pts: Math.max(0, parseInt(a.pts, 10) || 0) })).filter((a) => a.text)
    .sort((a, b) => b.pts - a.pts).slice(0, MAX_ANSWERS);
  if (!text) return { error: "missing-question" };
  if (!clean.length) return { error: "missing-answers" };
  return { question: { q: text, cat: String(cat || "").trim(), answers: clean } };
}
