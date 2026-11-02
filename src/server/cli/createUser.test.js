import { createSqliteDatabase } from "../db/sqlite/index.js";
import { createAuthService } from "../auth/service.js";
import { createUserCommand, USAGE } from "./createUser.js";

const setup = () => {
  const db = createSqliteDatabase({ url: ":memory:" });
  const out = [], err = [];
  const io = { auth: createAuthService({ db }), log: (m) => out.push(m), error: (m) => err.push(m) };
  return { db, out, err, io };
};

describe("user:create command", () => {
  it("creates the user with the password from LDLG_USER_PASSWORD", async () => {
    const { db, out, io } = setup();
    const code = await createUserCommand({ ...io, args: ["Host@Example.com"], env: { LDLG_USER_PASSWORD: "secreto123" }, readPassword: () => { throw new Error("no prompt"); } });
    expect(code).toBe(0);
    expect(out).toEqual(["Usuario creado: host@example.com"]);
    expect(await db.users.findByEmail("host@example.com")).not.toBeNull();
  });

  it("asks for the password twice when the variable is not set, and fails if they differ", async () => {
    const { out, err, io } = setup();
    const answers = ["secreto123", "secreto123"];
    expect(await createUserCommand({ ...io, args: ["a@b.co"], env: {}, readPassword: async () => answers.shift() })).toBe(0);
    expect(out).toEqual(["Usuario creado: a@b.co"]);
    const mismatch = ["secreto123", "otra-cosa"];
    expect(await createUserCommand({ ...io, args: ["c@d.co"], env: {}, readPassword: async () => mismatch.shift() })).toBe(1);
    expect(err).toEqual(["Las contraseñas no coinciden."]);
  });

  it("prints usage without an email, and the auth error message on invalid input", async () => {
    const { err, io } = setup();
    expect(await createUserCommand({ ...io, args: [], env: {}, readPassword: async () => "" })).toBe(1);
    expect(await createUserCommand({ ...io, args: ["a@b.co"], env: { LDLG_USER_PASSWORD: "corta" }, readPassword: async () => "" })).toBe(1);
    await createUserCommand({ ...io, args: ["a@b.co"], env: { LDLG_USER_PASSWORD: "secreto123" }, readPassword: async () => "" });
    expect(await createUserCommand({ ...io, args: ["a@b.co"], env: { LDLG_USER_PASSWORD: "secreto123" }, readPassword: async () => "" })).toBe(1);
    expect(err).toEqual([USAGE, "La contraseña debe tener al menos 8 caracteres.", "Ya existe un usuario con ese correo."]);
  });

  it("creates the user with --role, before or after the email; GUEST when omitted", async () => {
    const { db, out, io } = setup();
    const env = { LDLG_USER_PASSWORD: "secreto123" }, readPassword = async () => "";
    expect(await createUserCommand({ ...io, args: ["op@b.co", "--role", "OPERADOR"], env, readPassword })).toBe(0);
    expect(await createUserCommand({ ...io, args: ["--role=ADMIN", "ad@b.co"], env, readPassword })).toBe(0);
    expect(await createUserCommand({ ...io, args: ["gu@b.co"], env, readPassword })).toBe(0);
    expect(out).toEqual(["Usuario creado: op@b.co", "Usuario creado: ad@b.co", "Usuario creado: gu@b.co"]);
    expect((await db.users.findByEmail("op@b.co")).role).toBe("OPERADOR");
    expect((await db.users.findByEmail("ad@b.co")).role).toBe("ADMIN");
    expect((await db.users.findByEmail("gu@b.co")).role).toBe("GUEST");
  });

  it("rejects an unknown role, a --role without value and unknown options, creating nothing", async () => {
    const { db, err, io } = setup();
    const env = { LDLG_USER_PASSWORD: "secreto123" }, readPassword = async () => "";
    expect(await createUserCommand({ ...io, args: ["a@b.co", "--role", "ROOT"], env, readPassword })).toBe(1);
    expect(await createUserCommand({ ...io, args: ["a@b.co", "--role"], env, readPassword })).toBe(1);
    expect(await createUserCommand({ ...io, args: ["a@b.co", "--admin"], env, readPassword })).toBe(1);
    expect(err).toEqual(["Rol inválido. Usa uno de: ADMIN, OPERADOR, GUEST.", USAGE, USAGE]);
    expect(await db.users.findByEmail("a@b.co")).toBeNull();
  });
});
