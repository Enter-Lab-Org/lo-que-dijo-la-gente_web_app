import { MAX_STRIKES, TEAM_FALLBACK } from "./constants";
import { clone, nextRev, uid } from "./utils";

/* Game state ("partida") as pure functions. Actions return { state, fx } or null when nothing changes. */

export const defaults = () => ({ rev: 0, list: [], idx: 0, rounds: {}, scoreA: 0, scoreB: 0, nameA: TEAM_FALLBACK.A, nameB: TEAM_FALLBACK.B, mult: 1, sound: true, fx: null });

export function normState(input) {
  const s = Object.assign(defaults(), input && typeof input === "object" ? clone(input) : {});
  if (!Array.isArray(s.list)) s.list = [];
  s.list = s.list.filter((it) => it && it.id && it.q && Array.isArray(it.answers));
  if (typeof s.rounds !== "object" || !s.rounds) s.rounds = {};
  if (s.idx >= s.list.length) s.idx = Math.max(0, s.list.length - 1);
  return s;
}

export const currentItem = (s) => s.list[s.idx] || null;
export const inList = (s, id) => s.list.some((x) => x.id === id);

// Round of a question, normalized. Revealed answers that no longer exist are dropped.
export function roundOf(s, it = currentItem(s)) {
  if (!it) return null;
  const r = { revealed: [], free: [], strikes: 0, awardedTo: null, ...(s.rounds[it.id] || {}) };
  r.free = r.free || [];
  r.revealed = (r.revealed || []).filter((i) => i < it.answers.length);
  return r;
}

export function pot(s) {
  const it = currentItem(s); if (!it) return 0;
  const r = roundOf(s); if (r.awardedTo) return 0;
  return it.answers.reduce((sum, a, i) => sum + (r.revealed.includes(i) && !r.free.includes(i) ? a.pts : 0), 0) * s.mult;
}

export function statusText(s) {
  const r = roundOf(s); if (!r) return "";
  if (r.awardedTo) return `Ronda para ${s["name" + r.awardedTo]}`;
  if (r.strikes >= MAX_STRIKES) return "Tres strikes: el otro equipo puede robar";
  return "";
}

// Host-side label of the round state.
export function roundState(s) {
  const r = roundOf(s);
  if (!r) return { text: "Sin ronda", tone: "" };
  if (r.awardedTo) return { text: `Ronda para ${s["name" + r.awardedTo]}`, tone: "done" };
  if (r.strikes >= MAX_STRIKES) return { text: "Robo de puntos", tone: "steal" };
  return { text: "Ronda abierta", tone: "" };
}

/* The only data the public screen ever gets: hidden answers are reduced to a count (n). */
export function pubState(s) {
  const it = currentItem(s), r = roundOf(s);
  return {
    rev: s.rev, has: !!it, key: it ? it.id : "", q: it ? it.q : "", n: it ? it.answers.length : 0,
    open: it ? r.revealed.map((i) => ({ i, text: it.answers[i].text, pts: it.answers[i].pts })) : [],
    strikes: r ? r.strikes : 0, status: statusText(s),
    nameA: s.nameA, nameB: s.nameB, scoreA: s.scoreA, scoreB: s.scoreB,
    pot: pot(s), mult: s.mult, idx: s.idx, total: s.list.length, sound: s.sound, fx: s.fx,
  };
}

/* Stamp a change: new rev and, optionally, the effect the public screen plays. */
export function stamp(s, fxType, { now = Date.now(), makeId = uid } = {}) {
  const next = { ...s };
  if (fxType) next.fx = { id: makeId("fx"), type: fxType, n: fxType === "buzz" ? roundOf(next).strikes : 0, at: now };
  next.rev = nextRev(s.rev, now);
  return next;
}

// Runs fn on a copy of the state with the current round; fn returns false to cancel, or the fx type.
function onRound(s, fn) {
  const it = currentItem(s); if (!it) return null;
  const next = clone(s), r = roundOf(next);
  const fx = fn(next, r, currentItem(next));
  if (fx === false) return null;
  next.rounds[it.id] = r;
  return { state: next, fx: fx || null };
}
const change = (s, fn) => { const next = clone(s); fn(next); return { state: next, fx: null }; };

export const toggleReveal = (s, i) => onRound(s, (_n, r, it) => {
  if (i < 0 || i >= it.answers.length) return false;
  const k = r.revealed.indexOf(i);
  if (k >= 0) { r.revealed.splice(k, 1); r.free = r.free.filter((x) => x !== i); return null; }
  r.revealed.push(i);
  return "ding";
});

export const strike = (s) => onRound(s, (_n, r) => { if (r.strikes < MAX_STRIKES) r.strikes++; return "buzz"; });

// Tapping strike indicator i sets the count to i+1 (or back to i if it was already there). No big X, no sound.
export const setStrikes = (s, i) => onRound(s, (_n, r) => { r.strikes = r.strikes === i + 1 ? i : i + 1; return null; });

export function award(s, team) {
  const r = roundOf(s), p = pot(s);
  if (!r || r.awardedTo || !p) return null;
  return onRound(s, (next, nr) => { next["score" + team] += p; nr.awardedTo = team; return "win"; });
}

// Shows the remaining answers without adding them to the pot.
export const revealAll = (s) => onRound(s, (_n, r, it) => {
  it.answers.forEach((_, i) => { if (!r.revealed.includes(i)) { r.revealed.push(i); r.free.push(i); } });
  return "ding";
});

export function go(s, d) {
  const n = Math.min(Math.max(s.idx + d, 0), s.list.length - 1);
  if (n === s.idx || n < 0) return null;
  return change(s, (next) => { next.idx = n; });
}

export const jumpTo = (s, i) => (i >= 0 && i < s.list.length ? change(s, (next) => { next.idx = i; }) : null);

export function moveItem(s, i, dir) {
  const j = i + dir;
  if (i < 0 || j < 0 || j >= s.list.length) return null;
  return change(s, (next) => {
    const curId = currentItem(next) && currentItem(next).id;
    [next.list[i], next.list[j]] = [next.list[j], next.list[i]];
    next.idx = Math.max(0, next.list.findIndex((x) => x.id === curId));
  });
}

export function addToGame(s, items) {
  const next = clone(s); let added = 0;
  for (const q of items) if (!inList(next, q.id)) { next.list.push({ id: q.id, q: q.q, cat: q.cat || "", answers: clone(q.answers) }); added++; }
  return { state: added ? next : null, fx: null, added };
}

export function removeFromGame(s, id) {
  const i = s.list.findIndex((x) => x.id === id); if (i < 0) return null;
  return change(s, (next) => {
    next.list.splice(i, 1); delete next.rounds[id];
    if (next.idx > i || next.idx >= next.list.length) next.idx = Math.max(0, next.idx - 1);
  });
}

// An edited bank question updates its copy in the game.
export function syncCopy(s, item) {
  if (!inList(s, item.id)) return null;
  return change(s, (next) => {
    const it = next.list.find((x) => x.id === item.id);
    it.q = item.q; it.cat = item.cat || ""; it.answers = clone(item.answers);
  });
}

export const clearGame = (s) => change(s, (next) => { next.list = []; next.rounds = {}; next.idx = 0; });
export const resetScores = (s) => change(s, (next) => { next.scoreA = 0; next.scoreB = 0; next.rounds = {}; next.idx = 0; next.mult = 1; });
export const setMult = (s, m) => change(s, (next) => { next.mult = m; });
export const toggleSound = (s) => change(s, (next) => { next.sound = !next.sound; });
export const teamName = (team, raw) => String(raw || "").trim() || TEAM_FALLBACK[team];
export const setName = (s, team, raw) => change(s, (next) => { next["name" + team] = teamName(team, raw); });
export function setScore(s, team, raw) {
  const v = parseInt(raw, 10);
  return change(s, (next) => { next["score" + team] = isNaN(v) ? 0 : v; });
}
