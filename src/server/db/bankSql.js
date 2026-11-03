import { DatabaseError } from "./errors.js";

/* Question bank SQL and row mapping shared by every SQLite-family adapter (sqlite, libsql). */
export const BANK_SQL = {
  listCategories: "SELECT * FROM categories ORDER BY name COLLATE NOCASE",
  categoryById: "SELECT * FROM categories WHERE id = ?",
  insertCategory: "INSERT INTO categories (name, created_at) VALUES (?, ?)",
  // Questions first lose the category (Turso may not enforce ON DELETE SET NULL), then it goes.
  unlinkCategory: "UPDATE questions SET category_id = NULL WHERE category_id = ?",
  deleteCategory: "DELETE FROM categories WHERE id = ?",
  questions: `SELECT q.id, q.text, q.category_id, q.profile, q.created_at, COALESCE(c.name, '') AS category
    FROM questions q LEFT JOIN categories c ON c.id = q.category_id`,
  answersOf: (count) => `SELECT question_id, text, points FROM answers WHERE question_id IN (${Array(count).fill("?").join(", ")}) ORDER BY question_id, position`,
  // The category check lives in the insert itself, so a category deleted at the same time cannot be linked.
  insertQuestion: `INSERT INTO questions (text, category_id, profile, created_at)
    SELECT ?1, ?2, ?3, ?4 WHERE ?2 IS NULL OR EXISTS (SELECT 1 FROM categories WHERE id = ?2)`, // text, categoryId, profile, createdAt
  insertAnswer: "INSERT INTO answers (question_id, text, points, position) VALUES (?, ?, ?, ?)",
  deleteAnswers: "DELETE FROM answers WHERE question_id = ?",
  deleteQuestion: "DELETE FROM questions WHERE id = ?",
};

export const ORDER = " ORDER BY q.text COLLATE NOCASE, q.id";
export const isUniqueViolation = (e) => e?.errcode === 2067 || e?.rawCode === 2067 || /UNIQUE constraint failed/.test(e?.message || "");

export const categoryTaken = () => new DatabaseError("CATEGORY_TAKEN", "A category with this name already exists");
export const categoryNotFound = () => new DatabaseError("CATEGORY_NOT_FOUND", "The category does not exist");

export const toCategory = (r) => (r ? { id: Number(r.id), name: r.name, createdAt: Number(r.created_at) } : null);

// Questions rows + their answers rows -> questions with ordered answers.
export function toQuestions(rows, answerRows) {
  const byQuestion = new Map(rows.map((r) => [Number(r.id), []]));
  answerRows.forEach((a) => byQuestion.get(Number(a.question_id))?.push({ text: a.text, points: Number(a.points) }));
  return rows.map((r) => ({
    id: Number(r.id), text: r.text, categoryId: r.category_id === null ? null : Number(r.category_id), category: r.category,
    profile: r.profile, createdAt: Number(r.created_at), answers: byQuestion.get(Number(r.id)),
  }));
}
