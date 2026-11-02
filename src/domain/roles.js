/* User roles and what each one may see. Shared by the server (database, sessions) and the browser (console views).
   To restrict a role, remove sections from its ACCESS list: tabs and views read only this table. */

export const ROLES = Object.freeze({ ADMIN: "ADMIN", OPERADOR: "OPERADOR", GUEST: "GUEST" });
export const ROLE_LIST = Object.freeze(Object.values(ROLES));
// Least privilege: a user created without an explicit role gets the smallest one.
export const DEFAULT_ROLE = ROLES.GUEST;

// Sections that can be restricted. Values match the console tab keys and the public screen view.
export const SECTIONS = Object.freeze({ GAME: "juego", BANK: "banco", DESIGN: "diseno", PUBLIC: "publico" });
const ALL = Object.values(SECTIONS);

// Limits are not defined yet, so every role sees everything for now.
export const ACCESS = Object.freeze({
  [ROLES.ADMIN]: ALL,
  [ROLES.OPERADOR]: ALL,
  [ROLES.GUEST]: ALL,
});

export const isRole = (role) => ROLE_LIST.includes(role);

// No user means a host without login (the desktop app): nothing to restrict.
// A signed-in user with an unknown role sees nothing (fail closed).
export function allowedSections(user, access = ACCESS) {
  if (!user) return ALL;
  return isRole(user.role) ? [...(access[user.role] ?? [])] : [];
}

export const canAccess = (user, section, access = ACCESS) => allowedSections(user, access).includes(section);
