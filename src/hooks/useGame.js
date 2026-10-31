import { useCallback, useMemo, useRef, useState } from "react";
import { KEYS } from "../domain/constants";
import * as G from "../domain/game";

/* Game container: runs pure actions, then saves, publishes the public state and re-renders. */
export function useGame({ storage, bus, initial }) {
  const ref = useRef(initial);
  const [state, setState] = useState(initial);
  const nameTimers = useRef({});

  const publish = useCallback((s) => {
    const p = G.pubState(s);
    storage.set(KEYS.pub, p);
    bus.post({ kind: "pub", pub: p });
  }, [storage, bus]);

  const commit = useCallback((next, fx) => {
    const s = G.stamp(next, fx);
    ref.current = s;
    storage.set(KEYS.state, s);
    publish(s);
    setState(s);
  }, [storage, publish]);

  const run = useCallback((action, ...args) => {
    const r = action(ref.current, ...args);
    if (r && r.state) commit(r.state, r.fx);
    return r;
  }, [commit]);

  const actions = useMemo(() => ({
    toggleReveal: (i) => run(G.toggleReveal, i),
    strike: () => run(G.strike),
    setStrikes: (i) => run(G.setStrikes, i),
    award: (t) => run(G.award, t),
    revealAll: () => run(G.revealAll),
    go: (d) => run(G.go, d),
    jumpTo: (i) => run(G.jumpTo, i),
    moveItem: (i, d) => run(G.moveItem, i, d),
    removeFromGame: (id) => run(G.removeFromGame, id),
    addToGame: (items) => { const r = run(G.addToGame, items); return r.added; },
    syncCopy: (item) => run(G.syncCopy, item),
    clearGame: () => run(G.clearGame),
    resetScores: () => run(G.resetScores),
    setMult: (m) => run(G.setMult, m),
    toggleSound: () => run(G.toggleSound),
    setScore: (t, v) => run(G.setScore, t, v),
    // Names update as you type; the commit waits 300 ms after the last key.
    setName: (t, raw) => {
      ref.current = G.setName(ref.current, t, raw).state;
      clearTimeout(nameTimers.current[t]);
      nameTimers.current[t] = setTimeout(() => commit(ref.current), 300);
    },
    isInGame: (id) => G.inList(ref.current, id),
  }), [run, commit]);

  const pub = useMemo(() => G.pubState(state), [state]);
  const current = useCallback(() => ref.current, []);
  return { state, pub, actions, publish, current };
}
