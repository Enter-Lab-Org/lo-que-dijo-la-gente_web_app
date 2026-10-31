import { useEffect, useRef, useState } from "react";
import { bigXCount, isFreshFx } from "../domain/screen";

/* Plays the latest effect once: big X for a buzz, and the sound when the screen has audio. Returns how many X to show. */
export function useScreenFx(pub, audio, now = Date.now) {
  const lastFx = useRef(null), timer = useRef(null);
  const [bigX, setBigX] = useState(0);
  const fx = pub && pub.fx;
  useEffect(() => {
    if (!fx || fx.id === lastFx.current) return;
    const fresh = isFreshFx(fx, lastFx.current, now());
    lastFx.current = fx.id;
    if (!fresh) return;
    if (fx.type === "buzz") {
      setBigX(bigXCount(fx.n));
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setBigX(0), 1100);
    }
    if (audio && pub.sound !== false && audio.has(fx.type)) audio.play(fx.type);
  }, [fx && fx.id]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return bigX;
}
