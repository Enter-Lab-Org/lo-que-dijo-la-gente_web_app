import { useCallback, useState } from "react";
import { KEYS, TABS } from "../domain/constants";

export function useTab({ storage, initial }) {
  const [tab, setTab] = useState(initial);
  const showTab = useCallback((t) => {
    const next = TABS.includes(t) ? t : "juego";
    storage.set(KEYS.tab, next);
    setTab(next);
  }, [storage]);
  return [tab, showTab];
}
