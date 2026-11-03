/* Game profiles: the look of the console and public screen, and which questions of the database bank they play.
   To rename a profile or change its colors, edit only this file: ids and question profiles are stable keys
   (stored in the database and the browser), names and palettes are free to change. */

// Question profile stored with every question in the database (migration 4 CHECK uses these values).
export const QUESTION_PROFILES = Object.freeze({ DEFAULT: "DEFAULT", ADULT: "ADULT" });
export const QUESTION_PROFILE_LIST = Object.freeze(Object.values(QUESTION_PROFILES));
export const QUESTION_PROFILE_LABELS = Object.freeze({ DEFAULT: "Default", ADULT: "+18" });
export const isQuestionProfile = (p) => QUESTION_PROFILE_LIST.includes(p);

export const DEFAULT_PROFILE = "default";

/* theme: values written into the Diseño theme when the profile is applied (title and the three accent colors).
   palette: CSS custom properties for the whole app while the profile is active (null = the stylesheet defaults). */
export const PROFILES = Object.freeze({
  default: {
    id: "default",
    name: "Lo que dijo la gente",
    description: "El juego como siempre: todas las preguntas default.",
    questionProfile: QUESTION_PROFILES.DEFAULT,
    theme: { title: "Lo que dijo la gente", gold: "#f5a518", rosa: "#e6007e", turq: "#18c2bd" },
    palette: null,
  },
  tacones: {
    id: "tacones",
    name: "100 Tacones Dijeron",
    description: "El juego de encuestas más drag de la noche. Solo preguntas +18.",
    questionProfile: QUESTION_PROFILES.ADULT,
    // Colors from 100-tacones-dijeron-presentacion.pdf ("Un show de marquesina").
    theme: { title: "100 Tacones Dijeron", gold: "#FFC727", rosa: "#FF4FA3", turq: "#1EC8B8" },
    palette: {
      "--bg": "#24093F", // Morado Noche
      "--glow": "#4B1580", // Morado Drag
      "--panel": "#3A1068",
      "--panel-2": "#2C0C52",
      "--tile": "#4B1580", // Morado Drag
      "--tile-hi": "#7A2DC8", // Violeta Brillo
      "--tile-deep": "#24093F", // Morado Noche
      "--line": "#5E2A9E",
      "--x": "#E8243C", // Rojo Labial
      "--paper": "#FFF3DC", // Crema Escenario
      "--paper-ink": "#24093F",
      "--muted": "#C9B3EC",
      "--marquee": "#E8243C", // Rojo Labial: the frame with bulbs
      "--bulb": "#FFC727", // Amarillo Reflector
      "--orange": "#FF7A1A", // Naranja Tacón
    },
  },
});
export const PROFILE_LIST = Object.freeze(Object.values(PROFILES));

export const getProfile = (id) => PROFILES[id] ?? PROFILES[DEFAULT_PROFILE];
export const profileVars = (id) => ({ ...(getProfile(id).palette ?? {}) });

/* Browser-side profile config ("ldlg-profile"): the active profile and the database question ids picked per profile. */
export function normalizeProfileConfig(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const ids = (v) => (Array.isArray(v) ? [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n > 0))] : []);
  const selected = Object.fromEntries(PROFILE_LIST.map((p) => [p.id, ids(r.selected?.[p.id])]));
  return { active: PROFILES[r.active] ? r.active : DEFAULT_PROFILE, selected };
}

// A database question (see src/server/bank) as an item of the local game bank (src/domain/bank.js).
export const toBankItem = (q, now = Date.now()) => ({
  id: "db-" + q.id, q: q.text, cat: q.category || "", updatedAt: now,
  answers: q.answers.map((a) => ({ text: a.text, pts: a.points })),
});

// The questions to load when a profile is applied: the picked ones of its question profile, in bank order.
export const pickedQuestions = (questions, profileId, selectedIds) => {
  const wanted = new Set(selectedIds);
  const qp = getProfile(profileId).questionProfile;
  return questions.filter((q) => q.profile === qp && wanted.has(q.id));
};
