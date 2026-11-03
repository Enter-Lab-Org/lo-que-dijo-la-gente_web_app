/* User roles and what each one may see. Shared by the server (database, sessions) and the browser (console views).
   To restrict a role, remove sections from its ACCESS list: tabs and views read only this table. */

export const ROLES = Object.freeze({ ADMIN: "ADMIN", OPERADOR: "OPERADOR" });
export const ROLE_LIST = Object.freeze(Object.values(ROLES));
// A user created without an explicit role is an OPERADOR (the role with fewer permissions).
export const DEFAULT_ROLE = ROLES.OPERADOR;

// Sections that can be restricted. Values match the console tab keys and the public screen view.
// ADMIN is the Administración panel (profile, database question bank, categories); USERS is the user management inside it.
export const SECTIONS = Object.freeze({ GAME: "juego", BANK: "banco", DESIGN: "diseno", PUBLIC: "publico", ADMIN: "admin", USERS: "usuarios" });
// Sections that need the web server and a signed-in user; a host without login never shows them.
const LOGIN_ONLY = [SECTIONS.ADMIN, SECTIONS.USERS];
const GAME_SECTIONS = Object.values(SECTIONS).filter((s) => !LOGIN_ONLY.includes(s));

// Game limits are not defined yet, so every role sees every game section and the admin panel. User management is ADMIN only.
export const ACCESS = Object.freeze({
  [ROLES.ADMIN]: [...GAME_SECTIONS, SECTIONS.ADMIN, SECTIONS.USERS],
  [ROLES.OPERADOR]: [...GAME_SECTIONS, SECTIONS.ADMIN],
});

export const isRole = (role) => ROLE_LIST.includes(role);

// No user means a host without login (the desktop app): every game section, never the login-only ones.
// A signed-in user with an unknown role sees nothing (fail closed).
export function allowedSections(user, access = ACCESS) {
  if (!user) return [...GAME_SECTIONS];
  return isRole(user.role) ? [...(access[user.role] ?? [])] : [];
}

export const canAccess = (user, section, access = ACCESS) => allowedSections(user, access).includes(section);
