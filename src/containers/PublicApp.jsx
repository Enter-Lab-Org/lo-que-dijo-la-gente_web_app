import { useEffect, useRef, useState } from "react";
import { KEYS } from "../domain/constants";
import { isNewer } from "../domain/screen";
import { useServices } from "../hooks/services";
import PublicScreen from "../components/screen/PublicScreen";
import StartOverlay from "../components/public/StartOverlay";
import CornerControls from "../components/public/CornerControls";

const keepNewer = (cur, next) => (isNewer(cur, next) ? next : cur);

/* Public screen window: read only. It gets the public state and theme, never the bank or the full game. */
export default function PublicApp() {
  const { storage, bus, audio, native, fullscreen, projector } = useServices();
  const [pub, setPub] = useState(() => keepNewer(null, storage.get(KEYS.pub)));
  const [theme, setTheme] = useState(() => keepNewer(null, storage.get(KEYS.theme)));
  const [started, setStarted] = useState(false);
  const [corner, setCorner] = useState(false);
  const hideTimer = useRef(null);

  useEffect(() => {
    document.title = "Lo Que Dijo la Gente · Público";
    document.body.style.overflow = "hidden";
    const off = bus.on((m) => {
      if (m.kind === "pub") setPub((cur) => keepNewer(cur, m.pub));
      if (m.kind === "theme") setTheme((cur) => keepNewer(cur, m.theme));
    });
    bus.post({ kind: "hello" });
    return () => { off(); document.body.style.overflow = ""; };
  }, [bus]);

  // Cursor and corner button hide after 2.5 s without moving.
  useEffect(() => {
    const wake = () => {
      document.body.classList.remove("nocursor");
      if (!native) setCorner(true);
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => { setCorner(false); document.body.classList.add("nocursor"); }, 2500);
    };
    document.addEventListener("mousemove", wake);
    document.addEventListener("touchstart", wake, { passive: true });
    wake();
    return () => {
      document.removeEventListener("mousemove", wake);
      document.removeEventListener("touchstart", wake);
      clearTimeout(hideTimer.current);
      document.body.classList.remove("nocursor");
    };
  }, [native]);

  // In the desktop app the window is already on the projector and may play sound without a click; Esc leaves full screen.
  useEffect(() => {
    if (!native) return undefined;
    audio.prepare();
    const onKey = (e) => { if (e.key === "Escape") projector.escape(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [native, audio, projector]);

  const start = () => { audio.unlock(); setStarted(true); fullscreen.toggle(); };
  return (
    <div id="pub">
      <PublicScreen id="pubWrap" variant="full" pub={pub} theme={theme} audio={audio} />
      {!native && !started ? <StartOverlay onStart={start} /> : null}
      <CornerControls show={corner} onFullscreen={fullscreen.toggle} />
    </div>
  );
}
