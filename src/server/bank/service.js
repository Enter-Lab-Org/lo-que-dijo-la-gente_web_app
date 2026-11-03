import { MAX_ANSWERS } from "../../domain/constants.js";
import { QUESTION_PROFILE_LIST, isQuestionProfile } from "../../domain/profiles.js";

export const DEFAULT_POINTS = 10;
const MAX_CATEGORY = 60;
const MAX_QUESTION = 200;
const MAX_ANSWER = 80;
const MAX_POINTS = 999;

export class BankError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "BankError";
    this.code = code;
  }
}
const invalid = (message) => new BankError("INVALID", message);
const text = (v) => (typeof v === "string" ? v.trim() : "");

export function checkProfile(profile) {
  if (!isQuestionProfile(profile)) throw invalid(`Perfil inválido. Usa ${QUESTION_PROFILE_LIST.join(" o ")}.`);
  return profile;
}

function checkCategoryId(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  const id = typeof raw === "number" ? raw : /^\d{1,15}$/.test(String(raw)) ? Number(raw) : NaN;
  if (!Number.isInteger(id) || id <= 0) throw invalid("Categoría inválida.");
  return id;
}

// Points not given (missing, null or "") are DEFAULT_POINTS; anything else must be a whole number 0..999.
function checkPoints(raw, answer) {
  if (raw === undefined || raw === null || (typeof raw === "string" && !raw.trim())) return DEFAULT_POINTS;
  const n = typeof raw === "number" ? raw : /^\s*\d+\s*$/.test(String(raw)) ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > MAX_POINTS) throw invalid(`Puntaje inválido en «${answer}»: usa un número entero de 0 a ${MAX_POINTS}.`);
  return n;
}

// Rows without text are dropped; the rest are sorted by points, high to low, like the board shows them.
function checkAnswers(raw) {
  const rows = (Array.isArray(raw) ? raw : [])
    .filter((a) => a && typeof a === "object" && text(a.text))
    .map((a) => {
      const answer = text(a.text);
      if (answer.length > MAX_ANSWER) throw invalid(`Cada respuesta admite máximo ${MAX_ANSWER} caracteres.`);
      return { text: answer, points: checkPoints(a.points, answer) };
    });
  if (!rows.length) throw invalid("Agrega al menos una respuesta.");
  if (rows.length > MAX_ANSWERS) throw invalid(`Máximo ${MAX_ANSWERS} respuestas.`);
  return rows.sort((a, b) => b.points - a.points);
}

/* Question bank use cases over the repository ports. db: { categories, questions } from ../db. */
export function createBankService({ db, now = Date.now }) {
  return {
    listCategories: () => db.categories.list(),

    async createCategory({ name }) {
      const clean = text(name);
      if (!clean) throw invalid("Escribe el nombre de la categoría.");
      if (clean.length > MAX_CATEGORY) throw invalid(`El nombre de la categoría admite máximo ${MAX_CATEGORY} caracteres.`);
      try {
        return await db.categories.create({ name: clean, createdAt: now() });
      } catch (e) {
        if (e?.code === "CATEGORY_TAKEN") throw new BankError("CATEGORY_TAKEN", "Ya existe una categoría con ese nombre.");
        throw e;
      }
    },

    async deleteCategory({ id }) {
      if (!(await db.categories.delete(id))) throw new BankError("NOT_FOUND", "Categoría no encontrada.");
    },

    listQuestions({ profile } = {}) {
      return db.questions.list(profile === undefined || profile === null ? {} : { profile: checkProfile(profile) });
    },

    async createQuestion({ text: raw, categoryId, profile, answers }) {
      const question = text(raw);
      if (!question) throw invalid("Escribe la pregunta.");
      if (question.length > MAX_QUESTION) throw invalid(`La pregunta admite máximo ${MAX_QUESTION} caracteres.`);
      const input = { text: question, profile: checkProfile(profile), categoryId: checkCategoryId(categoryId), answers: checkAnswers(answers), createdAt: now() };
      try {
        return await db.questions.create(input);
      } catch (e) {
        if (e?.code === "CATEGORY_NOT_FOUND") throw invalid("La categoría no existe.");
        throw e;
      }
    },

    async deleteQuestion({ id }) {
      if (!(await db.questions.delete(id))) throw new BankError("NOT_FOUND", "Pregunta no encontrada.");
    },
  };
}
