import { useCallback, useState } from "react";
import { KEYS } from "../domain/constants";
import { normalizeProfileConfig, pickedQuestions, toBankItem } from "../domain/profiles";
import { applyProfileTheme } from "../domain/theme";

/* Game profile container: the browser-side config ("ldlg-profile") and applying a profile.
   The database is the only source of the questions; applying copies the picked ones into the local game bank. */
export function useProfile({ storage, bankStore, themeStore }) {
  const [config, setConfig] = useState(() => normalizeProfileConfig(storage.get(KEYS.profile)));

  // questions: database questions (any profile); ids: the ones picked for profileId. Returns how many were loaded.
  const apply = useCallback((profileId, questions, ids) => {
    const picked = pickedQuestions(questions, profileId, ids);
    const now = Date.now();
    bankStore.setBank(picked.map((q) => toBankItem(q, now)));
    themeStore.actions.commitTheme(applyProfileTheme(themeStore.current(), profileId));
    // Only the applied profile keeps its picks: every switch clears the others, so +18 picks never carry into default.
    const next = normalizeProfileConfig({ active: profileId, selected: { [profileId]: picked.map((q) => q.id) } });
    storage.set(KEYS.profile, next);
    setConfig(next);
    return picked.length;
  }, [storage, bankStore, themeStore]);

  return { config, apply };
}
