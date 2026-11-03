import { createJsonCall } from "./http";

/* Browser client for /api/bank (admin panel: ADMIN and OPERADOR; the server enforces it). */
export function createBankApi({ fetch }) {
  const call = createJsonCall({ fetch });
  return {
    listQuestions: async (profile) => (await call("GET", "/api/bank/questions" + (profile ? "?profile=" + encodeURIComponent(profile) : ""))).questions,
    createQuestion: async ({ text, categoryId, profile, answers }) => (await call("POST", "/api/bank/questions", { text, categoryId, profile, answers })).question,
    removeQuestion: async (id) => { await call("DELETE", `/api/bank/questions/${id}`); },
    listCategories: async () => (await call("GET", "/api/bank/categories")).categories,
    createCategory: async (name) => (await call("POST", "/api/bank/categories", { name })).category,
    removeCategory: async (id) => { await call("DELETE", `/api/bank/categories/${id}`); },
  };
}
