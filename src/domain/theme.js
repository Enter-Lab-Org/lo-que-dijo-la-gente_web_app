import { THEME0 } from "./constants";
import { getProfile, profileVars } from "./profiles";

export const normalizeTheme = (t) => Object.assign({}, THEME0, t && typeof t === "object" ? t : {});
// Reset goes back to the active game profile's look (src/domain/profiles.js), keeping the profile.
export const resetTheme = (current) => {
  const profile = getProfile(current.profile);
  return Object.assign({}, THEME0, profile.theme, { rev: current.rev, profile: profile.id });
};
// Applying a game profile: its title and colors over the current design (images stay).
export const applyProfileTheme = (current, profileId) => {
  const profile = getProfile(profileId);
  return { ...normalizeTheme(current), ...profile.theme, profile: profile.id };
};
// A backup's design replaces the current one but keeps the rev counter.
export const themeFromBackup = (current, diseno) => Object.assign({}, THEME0, diseno, { rev: current.rev });
export const setTitle = (t, raw) => ({ ...t, title: String(raw || "").trim() || THEME0.title });

/* CSS custom properties for the public screen. */
export function screenVars(theme) {
  const t = normalizeTheme(theme), shade = `rgba(11,24,48,${(t.shade || 0) / 100})`;
  return {
    ...profileVars(t.profile),
    "--gold": t.gold, "--rosa": t.rosa, "--turq": t.turq,
    "--page-img": t.page ? `url("${t.page}")` : "none",
    "--page-shade": t.page ? shade : "transparent",
    "--stage-img": t.stage ? `url("${t.stage}")` : "none",
    "--stage-shade": t.stage ? shade : "transparent",
    "--tile-img": t.tile ? `url("${t.tile}")` : "none",
  };
}
