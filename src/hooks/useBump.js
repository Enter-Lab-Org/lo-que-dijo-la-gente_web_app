import { useEffect, useRef } from "react";

// Replays the "bump" CSS animation on an element when its value changes as `shouldBump` says.
export function useBump(value, shouldBump = (prev, next) => prev !== next) {
  const ref = useRef(null), prev = useRef(value);
  useEffect(() => {
    const p = prev.current; prev.current = value;
    const el = ref.current;
    if (!el || p === value || !shouldBump(p, value)) return;
    el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump");
  }, [value]);
  return ref;
}
