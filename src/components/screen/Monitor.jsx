import { useEffect, useRef, useState } from "react";
import PublicScreen from "./PublicScreen";

// The public screen at 1280×720, scaled to the card width. No sound.
export default function Monitor({ id, pub, theme }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(null);
  useEffect(() => {
    const mon = ref.current;
    const fit = () => { const w = mon.clientWidth; if (w) setScale(w / 1280); };
    let ro = null;
    try { ro = new ResizeObserver(fit); ro.observe(mon); } catch (e) { window.addEventListener("resize", fit); }
    fit();
    return () => { if (ro) ro.disconnect(); else window.removeEventListener("resize", fit); };
  }, []);
  return (
    <div className="monitor" id={id} ref={ref}>
      <PublicScreen variant="preview" pub={pub} theme={theme} style={scale ? { transform: `scale(${scale})` } : undefined} />
    </div>
  );
}
