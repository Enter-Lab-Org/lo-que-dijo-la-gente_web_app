import { ROLE_LIST } from "../../domain/roles";

/* New user: email, password and role. The container owns the values. */
export default function UserForm({ form, busy, onChange, onSubmit }) {
  return (
    <form className="card" id="userForm" autoComplete="off" noValidate onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <div className="card-h"><h3>Nuevo usuario</h3></div>
      <label className="field"><span>Correo</span>
        <input type="email" id="uEmail" value={form.email} onChange={(e) => onChange("email", e.target.value)} />
      </label>
      <label className="field"><span>Contraseña</span>
        <input type="password" id="uPassword" autoComplete="new-password" value={form.password} onChange={(e) => onChange("password", e.target.value)} />
      </label>
      <label className="field"><span>Rol</span>
        <select id="uRole" value={form.role} onChange={(e) => onChange("role", e.target.value)}>
          {ROLE_LIST.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
      <div className="row"><button className="btn" type="submit" disabled={busy}>Crear usuario</button></div>
    </form>
  );
}
