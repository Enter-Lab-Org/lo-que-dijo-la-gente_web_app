// Storage keys and message channel are kept identical to the original app so old data and backups still load.
export const KEYS = { state: "ldlg-v2", theme: "ldlg-theme-v2", bank: "ldlg-banco", pub: "ldlg-pub", tab: "ldlg-tab", seeded: "ldlg-seeded" };
export const CHANNEL = "ldlg-v2";
export const PUBLIC_HASH = "#publico";

export const TABS = ["juego", "banco", "diseno"];
export const MAX_ANSWERS = 8;
export const MAX_STRIKES = 3;
export const FX_MAX_AGE = 8000;
export const TEAM_FALLBACK = { A: "Equipo Rosa", B: "Equipo Turquesa" };

export const IMG_SLOTS = ["page", "stage", "tile", "logo"];
// [max width in px, keep transparency (PNG)]
export const IMAGE_SIZES = { page: [1920, false], stage: [1600, false], tile: [900, false], logo: [600, true] };
export const THEME0 = { rev: 0, title: "Lo que dijo la gente", gold: "#f5a518", rosa: "#e6007e", turq: "#18c2bd", shade: 55, page: null, stage: null, tile: null, logo: null };
