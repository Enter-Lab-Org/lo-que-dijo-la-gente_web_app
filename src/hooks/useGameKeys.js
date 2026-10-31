import { useEffect, useRef } from "react";

/* Host shortcuts: 1-8 reveal, X strike, A/B award, arrows navigate. Never while typing in a field. */
export function useGameKeys(enabled, actions) {
  const ref = useRef(actions);
  ref.current = actions;
  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (e) => {
      if (e.target && e.target.closest && e.target.closest("input, textarea, select")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const a = ref.current, k = e.key.toLowerCase();
      if (/^[1-8]$/.test(k)) { a.toggleReveal(+k - 1); e.preventDefault(); }
      else if (k === "x") a.strike();
      else if (k === "a") a.award("A");
      else if (k === "b") a.award("B");
      else if (k === "arrowright") a.go(1);
      else if (k === "arrowleft") a.go(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled]);
}
