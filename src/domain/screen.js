import { FX_MAX_AGE, MAX_STRIKES } from "./constants";

/* Pure helpers for the public screen. */

// Board slots: always an even number, at least 2; 8 empty tiles when there is no question.
export const boardSlots = (n) => (n ? Math.max(2, n + (n % 2)) : 8);

export function roundLabel(p) {
  if (!p.has) return "";
  const multTxt = p.mult === 2 ? " · Puntos dobles" : p.mult === 3 ? " · Puntos triples" : "";
  return `Pregunta ${p.idx + 1} de ${p.total}${multTxt}`;
}

// The screen ignores any state older (lower rev) than what it already shows.
export const isNewer = (current, incoming) => !!incoming && (!current || (incoming.rev || 0) > (current.rev || 0));

// An effect plays once, and only if it is recent, so reloading the window does not repeat sounds.
export const isFreshFx = (fx, lastId, now = Date.now()) => !!fx && fx.id !== lastId && now - (fx.at || 0) < FX_MAX_AGE;

export const bigXCount = (n) => Math.max(1, Math.min(MAX_STRIKES, n || 1));

export const EMPTY_PUB = { has: false, nameA: "", nameB: "", scoreA: 0, scoreB: 0, pot: 0 };
