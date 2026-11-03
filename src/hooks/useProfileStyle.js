import { useEffect } from "react";
import { getProfile, profileVars } from "../domain/profiles";

/* Paints the whole page (console or public screen) with the active game profile: data-profile on <html>
   for profile-specific CSS, and the profile palette as CSS custom properties. Undone on change and unmount. */
export function useProfileStyle(profileId, doc = document) {
  useEffect(() => {
    const root = doc.documentElement;
    const id = getProfile(profileId).id;
    const vars = profileVars(id);
    root.dataset.profile = id;
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    return () => {
      Object.keys(vars).forEach((k) => root.style.removeProperty(k));
      delete root.dataset.profile;
    };
  }, [profileId, doc]);
}
