import { useCallback, useMemo, useRef, useState } from "react";
import { KEYS } from "../domain/constants";
import { nextRev } from "../domain/utils";
import { setTitle } from "../domain/theme";

export const TOO_HEAVY = "Las imágenes pesan demasiado para guardarse aquí. Prueba con imágenes más ligeras.";

/* Theme container: saves, sends to the public screen and keeps the Diseño tab message. */
export function useTheme({ storage, bus, initial }) {
  const ref = useRef(initial);
  const [theme, setState] = useState(initial);
  const [message, setMessage] = useState("");
  const titleTimer = useRef(null);

  const commitTheme = useCallback((next) => {
    const t = { ...next, rev: nextRev(next.rev) };
    ref.current = t;
    const saved = storage.set(KEYS.theme, t);
    if (!saved) setMessage(TOO_HEAVY);
    bus.post({ kind: "theme", theme: t });
    setState(t);
    return saved;
  }, [storage, bus]);

  const actions = useMemo(() => ({
    commitTheme,
    update: (patch) => commitTheme({ ...ref.current, ...patch }),
    setTitle: (raw) => {
      ref.current = setTitle(ref.current, raw);
      clearTimeout(titleTimer.current);
      titleTimer.current = setTimeout(() => commitTheme(ref.current), 300);
    },
  }), [commitTheme]);

  const current = useCallback(() => ref.current, []);
  return { theme, message, setMessage, actions, current };
}
