import { THEME0 } from "./constants";

export const normalizeTheme = (t) => Object.assign({}, THEME0, t && typeof t === "object" ? t : {});
export const resetTheme = (current) => Object.assign({}, THEME0, { rev: current.rev });
// A backup's design replaces the current one but keeps the rev counter.
export const themeFromBackup = (current, diseno) => Object.assign({}, THEME0, diseno, { rev: current.rev });
export const setTitle = (t, raw) => ({ ...t, title: String(raw || "").trim() || THEME0.title });

/* CSS custom properties for the public screen. */
export function screenVars(theme) {
  const t = normalizeTheme(theme), shade = `rgba(11,24,48,${(t.shade || 0) / 100})`;
  return {
    "--gold": t.gold, "--rosa": t.rosa, "--turq": t.turq,
    "--page-img": t.page ? `url("${t.page}")` : "none",
    "--page-shade": t.page ? shade : "transparent",
    "--stage-img": t.stage ? `url("${t.stage}")` : "none",
    "--stage-shade": t.stage ? shade : "transparent",
    "--tile-img": t.tile ? `url("${t.tile}")` : "none",
  };
}
