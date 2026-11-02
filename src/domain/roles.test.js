import { ROLES, DEFAULT_ROLE, SECTIONS, ACCESS, isRole, canAccess, allowedSections } from "./roles";

describe("roles", () => {
  it("defines exactly ADMIN, OPERADOR and GUEST, with GUEST as the least-privileged default", () => {
    expect(Object.values(ROLES)).toEqual(["ADMIN", "OPERADOR", "GUEST"]);
    expect(DEFAULT_ROLE).toBe("GUEST");
    expect(isRole("OPERADOR")).toBe(true);
    expect(isRole("admin")).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });

  it("has an access entry for every role that only names known sections", () => {
    const known = Object.values(SECTIONS);
    for (const role of Object.values(ROLES)) {
      expect(ACCESS[role].every((s) => known.includes(s))).toBe(true);
    }
  });

  it("checks a section against the role's access list", () => {
    const access = { ADMIN: ["juego", "banco"], OPERADOR: ["juego"], GUEST: [] };
    expect(canAccess({ role: "OPERADOR" }, "juego", access)).toBe(true);
    expect(canAccess({ role: "OPERADOR" }, "banco", access)).toBe(false);
    expect(canAccess({ role: "GUEST" }, "juego", access)).toBe(false);
    expect(allowedSections({ role: "ADMIN" }, access)).toEqual(["juego", "banco"]);
  });

  it("denies a signed-in user with an unknown or missing role", () => {
    expect(canAccess({ role: "ROOT" }, "juego")).toBe(false);
    expect(canAccess({ email: "x@y.z" }, "juego")).toBe(false);
    expect(allowedSections({ role: "ROOT" })).toEqual([]);
  });

  it("allows everything but user management when there is no user at all (desktop app, which has no login)", () => {
    expect(allowedSections(null)).toEqual(["juego", "banco", "diseno", "publico"]);
    expect(canAccess(null, "diseno")).toBe(true);
    expect(canAccess(null, "usuarios")).toBe(false);
    expect(allowedSections(null, { ADMIN: [] })).toEqual(["juego", "banco", "diseno", "publico"]);
  });

  it("gives the users section only to ADMIN; the other sections to every role (limits not defined yet)", () => {
    expect(SECTIONS.USERS).toBe("usuarios");
    expect(allowedSections({ role: "ADMIN" })).toEqual(["juego", "banco", "diseno", "publico", "usuarios"]);
    expect(allowedSections({ role: "OPERADOR" })).toEqual(["juego", "banco", "diseno", "publico"]);
    expect(allowedSections({ role: "GUEST" })).toEqual(["juego", "banco", "diseno", "publico"]);
  });
});
