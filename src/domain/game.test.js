import { describe, it, expect } from "vitest";
import * as G from "./game";

const q = (id, pts = [30, 20, 10]) => ({ id, q: "Pregunta " + id, cat: "", answers: pts.map((p, i) => ({ text: `R${i + 1}`, pts: p })) });
const game = (over = {}) => G.normState({ list: [q("a"), q("b"), q("c")], ...over });
const apply = (s, ...steps) => steps.reduce((acc, fn) => { const r = fn(acc); return r ? r.state : acc; }, s);

describe("normState", () => {
  it("fills defaults for empty or broken input", () => {
    expect(G.normState(null)).toEqual(G.defaults());
    expect(G.normState("x")).toEqual(G.defaults());
    const s = G.normState({ list: "nope", rounds: null });
    expect(s.list).toEqual([]);
    expect(s.rounds).toEqual({});
  });

  it("drops invalid game items and clamps idx", () => {
    const s = G.normState({ list: [q("a"), { id: "x" }, null, { id: "y", q: "Y", answers: "no" }], idx: 9 });
    expect(s.list.map((x) => x.id)).toEqual(["a"]);
    expect(s.idx).toBe(0);
  });

  it("keeps team names and does not mutate the input", () => {
    const input = { nameA: "Rojos", list: [] };
    const s = G.normState(input);
    s.nameA = "x";
    expect(input.nameA).toBe("Rojos");
    expect(G.normState(input).nameB).toBe("Equipo Turquesa");
  });
});

describe("reveal and pot", () => {
  it("revealing adds points to the pot with a ding, and is reversible", () => {
    const r = G.toggleReveal(game(), 1);
    expect(r.fx).toBe("ding");
    expect(G.pot(r.state)).toBe(20);
    const back = G.toggleReveal(r.state, 1);
    expect(back.fx).toBe(null);
    expect(G.pot(back.state)).toBe(0);
  });

  it("ignores answers that do not exist", () => {
    expect(G.toggleReveal(game(), 5)).toBeNull();
    expect(G.toggleReveal(G.normState({}), 0)).toBeNull();
  });

  it("does not mutate the previous state", () => {
    const s = game();
    G.toggleReveal(s, 0);
    expect(s.rounds).toEqual({});
  });

  it("applies the multiplier to the pot", () => {
    let s = apply(game(), (x) => G.toggleReveal(x, 0), (x) => G.toggleReveal(x, 2));
    expect(G.pot(s)).toBe(40);
    s = G.setMult(s, 2).state;
    expect(G.pot(s)).toBe(80);
    s = G.setMult(s, 3).state;
    expect(G.pot(s)).toBe(120);
  });

  it("revealAll shows the rest without adding them to the pot", () => {
    let s = G.toggleReveal(game(), 0).state;
    const r = G.revealAll(s);
    expect(r.fx).toBe("ding");
    s = r.state;
    expect(G.roundOf(s).revealed).toEqual([0, 1, 2]);
    expect(G.roundOf(s).free).toEqual([1, 2]);
    expect(G.pot(s)).toBe(30);
  });

  it("hiding a free answer removes it from free", () => {
    let s = G.revealAll(game()).state;
    s = G.toggleReveal(s, 1).state;
    expect(G.roundOf(s).free).toEqual([0, 2]);
    s = G.toggleReveal(s, 1).state;
    expect(G.pot(s)).toBe(20);
  });
});

describe("strikes", () => {
  it("adds a strike with buzz and never goes past 3", () => {
    let s = game(); const fx = [];
    for (let i = 0; i < 5; i++) { const r = G.strike(s); fx.push(r.fx); s = r.state; }
    expect(G.roundOf(s).strikes).toBe(3);
    expect(fx.every((f) => f === "buzz")).toBe(true);
  });

  it("setStrikes fixes the count and toggles back, without fx", () => {
    let r = G.setStrikes(game(), 1);
    expect(r.fx).toBe(null);
    expect(G.roundOf(r.state).strikes).toBe(2);
    r = G.setStrikes(r.state, 1);
    expect(G.roundOf(r.state).strikes).toBe(1);
    r = G.setStrikes(r.state, 0);
    expect(G.roundOf(r.state).strikes).toBe(0);
  });

  it("three strikes means steal", () => {
    const s = apply(game(), G.strike, G.strike, G.strike);
    expect(G.statusText(s)).toBe("Tres strikes: el otro equipo puede robar");
    expect(G.roundState(s)).toEqual({ text: "Robo de puntos", tone: "steal" });
  });

  it("no round, no strike", () => {
    expect(G.strike(G.normState({}))).toBeNull();
    expect(G.setStrikes(G.normState({}), 0)).toBeNull();
  });
});

describe("award", () => {
  it("adds the pot to the team once, closes the round and plays win", () => {
    let s = apply(game(), (x) => G.toggleReveal(x, 0), (x) => G.setMult(x, 2));
    const r = G.award(s, "A");
    expect(r.fx).toBe("win");
    s = r.state;
    expect(s.scoreA).toBe(60);
    expect(G.pot(s)).toBe(0);
    expect(G.roundOf(s).awardedTo).toBe("A");
    expect(G.award(s, "B")).toBeNull();
    expect(G.award(s, "A")).toBeNull();
    expect(G.statusText(s)).toBe("Ronda para Equipo Rosa");
    expect(G.roundState(s)).toEqual({ text: "Ronda para Equipo Rosa", tone: "done" });
  });

  it("does nothing with an empty pot", () => {
    expect(G.award(game(), "A")).toBeNull();
    expect(G.award(G.revealAll(game()).state, "B")).toBeNull();
  });

  it("status uses the current team name", () => {
    let s = G.toggleReveal(game(), 0).state;
    s = G.award(s, "B").state;
    s = G.setName(s, "B", "  Los Tigres ").state;
    expect(G.statusText(s)).toBe("Ronda para Los Tigres");
  });
});

describe("navigation", () => {
  it("moves within bounds and keeps each round's state", () => {
    let s = G.toggleReveal(game(), 0).state;
    expect(G.go(s, -1)).toBeNull();
    s = G.go(s, 1).state;
    expect(s.idx).toBe(1);
    expect(G.roundOf(s).revealed).toEqual([]);
    s = G.go(s, 1).state;
    expect(G.go(s, 1)).toBeNull();
    s = G.go(G.go(s, -1).state, -1).state;
    expect(G.roundOf(s).revealed).toEqual([0]);
  });

  it("does nothing with an empty game", () => {
    expect(G.go(G.normState({}), 1)).toBeNull();
    expect(G.go(G.normState({}), -1)).toBeNull();
  });

  it("jumpTo goes to an index", () => {
    expect(G.jumpTo(game(), 2).state.idx).toBe(2);
    expect(G.jumpTo(game(), 3)).toBeNull();
  });

  it("moveItem reorders and keeps the current question selected", () => {
    let s = G.jumpTo(game(), 1).state;
    s = G.moveItem(s, 1, -1).state;
    expect(s.list.map((x) => x.id)).toEqual(["b", "a", "c"]);
    expect(s.idx).toBe(0);
    s = G.moveItem(s, 1, 1).state;
    expect(s.list.map((x) => x.id)).toEqual(["b", "c", "a"]);
    expect(s.idx).toBe(0);
    expect(G.moveItem(s, 0, -1)).toBeNull();
    expect(G.moveItem(s, 2, 1)).toBeNull();
  });
});

describe("game list", () => {
  it("addToGame copies questions and never repeats them", () => {
    const s = G.normState({});
    const item = q("x");
    const r = G.addToGame(s, [item, item, q("y")]);
    expect(r.added).toBe(2);
    item.answers[0].text = "changed";
    expect(r.state.list[0].answers[0].text).toBe("R1");
    const again = G.addToGame(r.state, [q("x")]);
    expect(again.added).toBe(0);
    expect(again.state).toBeNull();
  });

  it("removeFromGame drops the round and adjusts idx", () => {
    let s = G.jumpTo(game(), 2).state;
    s = G.toggleReveal(s, 0).state;
    s = G.removeFromGame(s, "a").state;
    expect(s.list.map((x) => x.id)).toEqual(["b", "c"]);
    expect(s.idx).toBe(1);
    s = G.removeFromGame(s, "c").state;
    expect(s.idx).toBe(0);
    expect(s.rounds.c).toBeUndefined();
    expect(G.removeFromGame(s, "zzz")).toBeNull();
  });

  it("removing the current question keeps idx when it is not last", () => {
    const s = G.removeFromGame(G.jumpTo(game(), 1).state, "b").state;
    expect(s.idx).toBe(1);
    expect(G.currentItem(s).id).toBe("c");
  });

  it("syncCopy updates the copy and drops revealed answers that no longer exist", () => {
    let s = apply(game(), (x) => G.toggleReveal(x, 2), (x) => G.toggleReveal(x, 0));
    s = G.syncCopy(s, { id: "a", q: "Nueva", cat: "Cliente", answers: [{ text: "Solo", pts: 50 }, { text: "Dos", pts: 5 }] }).state;
    expect(G.currentItem(s)).toMatchObject({ q: "Nueva", cat: "Cliente" });
    expect(G.roundOf(s).revealed).toEqual([0]);
    expect(G.pubState(s).open).toEqual([{ i: 0, text: "Solo", pts: 50 }]);
    expect(G.syncCopy(s, { id: "nope", q: "x", answers: [] })).toBeNull();
  });

  it("clearGame empties the list and rounds", () => {
    const s = G.clearGame(G.toggleReveal(game(), 0).state).state;
    expect(s.list).toEqual([]);
    expect(s.rounds).toEqual({});
    expect(s.idx).toBe(0);
  });

  it("resetScores zeroes scores, rounds, idx and multiplier", () => {
    let s = apply(game(), (x) => G.toggleReveal(x, 0), (x) => G.award(x, "A"), (x) => G.go(x, 1), (x) => G.setMult(x, 3));
    s = G.resetScores(s).state;
    expect(s).toMatchObject({ scoreA: 0, scoreB: 0, rounds: {}, idx: 0, mult: 1 });
    expect(s.list).toHaveLength(3);
  });
});

describe("teams and sound", () => {
  it("empty names fall back to the default names", () => {
    expect(G.setName(game(), "A", "   ").state.nameA).toBe("Equipo Rosa");
    expect(G.setName(game(), "B", "").state.nameB).toBe("Equipo Turquesa");
  });

  it("scores accept typed numbers, invalid is 0", () => {
    expect(G.setScore(game(), "A", "125").state.scoreA).toBe(125);
    expect(G.setScore(game(), "B", "abc").state.scoreB).toBe(0);
  });

  it("toggleSound flips the flag", () => {
    expect(G.toggleSound(game()).state.sound).toBe(false);
  });
});

describe("stamp", () => {
  it("increments rev and records the fx with strikes count for buzz", () => {
    let s = G.strike(G.strike(game()).state).state;
    const st = G.stamp(s, "buzz", { now: 5000, makeId: () => "fx1" });
    expect(st.rev).toBe(5000);
    expect(st.fx).toEqual({ id: "fx1", type: "buzz", n: 2, at: 5000 });
    const st2 = G.stamp(st, null, { now: 10 });
    expect(st2.rev).toBe(5001);
    expect(st2.fx).toEqual(st.fx);
    expect(G.stamp(s, "ding", { now: 1, makeId: () => "d" }).fx.n).toBe(0);
  });
});

describe("pubState (security: no hidden answers)", () => {
  it("only carries revealed answers plus the answer count", () => {
    const s = G.toggleReveal(game(), 1).state;
    const p = G.pubState(s);
    expect(p).toMatchObject({ has: true, key: "a", q: "Pregunta a", n: 3, open: [{ i: 1, text: "R2", pts: 20 }], pot: 20, idx: 0, total: 3 });
    const json = JSON.stringify(p);
    expect(json).not.toContain("R1");
    expect(json).not.toContain("R3");
    expect(p.answers).toBeUndefined();
    expect(p.list).toBeUndefined();
    expect(p.rounds).toBeUndefined();
  });

  it("is empty with no questions", () => {
    expect(G.pubState(G.normState({}))).toMatchObject({ has: false, key: "", q: "", n: 0, open: [], strikes: 0, status: "", pot: 0, total: 0 });
  });
});
