export const uid = (p = "q") => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const nextRev = (r, now = Date.now()) => Math.max(now, (r || 0) + 1);
export const clone = (o) => JSON.parse(JSON.stringify(o));
// Accent and case insensitive text for search.
export const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const plural = (n, word) => word + (n === 1 ? "" : "s");
export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
