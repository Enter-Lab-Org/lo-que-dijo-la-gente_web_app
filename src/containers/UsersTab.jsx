import { useEffect, useState } from "react";
import { DEFAULT_ROLE } from "../domain/roles";
import UserForm from "../components/users/UserForm";
import UserList from "../components/users/UserList";

const emptyForm = () => ({ email: "", password: "", role: DEFAULT_ROLE });

/* ADMIN user management over the users API adapter. The server enforces the permission; this only shapes the UI. */
export default function UsersTab({ api, currentUserId }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [passwords, setPasswords] = useState({});
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (action, done) => {
    setBusy(true);
    try { setNotice({ ok: true, text: await done(await action()) }); }
    catch (e) { setNotice({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    let alive = true;
    api.list().then((list) => { if (alive) setUsers(list); }, (e) => { if (alive) setNotice({ ok: false, text: e.message }); });
    return () => { alive = false; };
  }, [api]);

  const create = () => run(() => api.create(form), (user) => {
    setUsers((list) => [...list, user].sort((a, b) => a.email.localeCompare(b.email)));
    setForm(emptyForm());
    return "Usuario creado: " + user.email;
  });
  const changeRole = (u, role) => run(() => api.setRole(u.id, role), (user) => {
    setUsers((list) => list.map((x) => (x.id === user.id ? user : x)));
    return `Rol de ${user.email}: ${user.role}`;
  });
  const resetPassword = (u) => run(() => api.resetPassword(u.id, passwords[u.id] ?? ""), () => {
    setPasswords((p) => ({ ...p, [u.id]: "" }));
    return `Contraseña cambiada para ${u.email}. Sus sesiones se cerraron.`;
  });
  const remove = (u) => run(() => api.remove(u.id), () => {
    setUsers((list) => list.filter((x) => x.id !== u.id));
    return "Usuario eliminado: " + u.email;
  });

  return (
    <div className="users-tab">
      {notice && <p className={"hint" + (notice.ok ? "" : " err")} role="status">{notice.text}</p>}
      <UserForm form={form} busy={busy} onChange={(k, v) => setForm((f) => ({ ...f, [k]: v }))} onSubmit={create} />
      <UserList users={users} currentUserId={currentUserId} passwords={passwords} busy={busy}
        onRole={changeRole} onPasswordInput={(id, v) => setPasswords((p) => ({ ...p, [id]: v }))} onPassword={resetPassword} onDelete={remove} />
    </div>
  );
}
