import { describe, it, expect, vi } from "vitest";
import { createBankApi } from "./bankApi";

const reply = (status, body) => ({ ok: status < 300, status, json: async () => body });

describe("bank API adapter", () => {
  it("calls /api/bank with the right method, JSON body and same-origin credentials", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(reply(200, { questions: [{ id: 1 }] }))
      .mockResolvedValueOnce(reply(200, { questions: [] }))
      .mockResolvedValueOnce(reply(201, { question: { id: 2 } }))
      .mockResolvedValueOnce(reply(200, { ok: true }))
      .mockResolvedValueOnce(reply(200, { categories: [{ id: 3 }] }))
      .mockResolvedValueOnce(reply(201, { category: { id: 4 } }))
      .mockResolvedValueOnce(reply(200, { ok: true }));
    const api = createBankApi({ fetch });
    expect(await api.listQuestions("ADULT")).toEqual([{ id: 1 }]);
    expect(await api.listQuestions()).toEqual([]);
    expect(await api.createQuestion({ text: "q", categoryId: null, profile: "ADULT", answers: [{ text: "a", points: "" }] })).toEqual({ id: 2 });
    expect(await api.removeQuestion(2)).toBeUndefined();
    expect(await api.listCategories()).toEqual([{ id: 3 }]);
    expect(await api.createCategory("Picante")).toEqual({ id: 4 });
    expect(await api.removeCategory(4)).toBeUndefined();
    const json = { "content-type": "application/json" };
    expect(fetch.mock.calls).toEqual([
      ["/api/bank/questions?profile=ADULT", { method: "GET", credentials: "same-origin", headers: {} }],
      ["/api/bank/questions", { method: "GET", credentials: "same-origin", headers: {} }],
      ["/api/bank/questions", { method: "POST", credentials: "same-origin", headers: json, body: '{"text":"q","categoryId":null,"profile":"ADULT","answers":[{"text":"a","points":""}]}' }],
      ["/api/bank/questions/2", { method: "DELETE", credentials: "same-origin", headers: {} }],
      ["/api/bank/categories", { method: "GET", credentials: "same-origin", headers: {} }],
      ["/api/bank/categories", { method: "POST", credentials: "same-origin", headers: json, body: '{"name":"Picante"}' }],
      ["/api/bank/categories/4", { method: "DELETE", credentials: "same-origin", headers: {} }],
    ]);
  });

  it("rejects with the server message", async () => {
    const api = createBankApi({ fetch: vi.fn().mockResolvedValue(reply(409, { error: "Ya existe una categoría con ese nombre." })) });
    await expect(api.createCategory("x")).rejects.toThrow("Ya existe una categoría con ese nombre.");
  });
});
