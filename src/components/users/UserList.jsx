import { ROLE_LIST } from "../../domain/roles";
import { today } from "../../domain/utils";
import ArmedButton from "../atoms/ArmedButton";

/* Users who can sign in. Your own row cannot change its role or be deleted (there is always an ADMIN). */
export default function UserList({ users, currentUserId, passwords, busy, onRole, onPasswordInput, onPassword, onDelete }) {
  return (
    <div className="card">
      <div className="card-h"><h3>Usuarios con acceso</h3><span className="eyebrow">{users.length}</span></div>
      <table className="users" aria-label="Usuarios con acceso">
        <thead><tr><th>Correo</th><th>Rol</th><th>Alta</th><th>Contraseña</th><th /></tr></thead>
        <tbody>
          {users.map((u) => {
            const self = u.id === currentUserId;
            return (
              <tr key={u.id}>
                <td>{u.email}{self && <span className="eyebrow"> Tú</span>}</td>
                <td>
                  <select aria-label={`Rol de ${u.email}`} value={u.role} disabled={self || busy} onChange={(e) => onRole(u, e.target.value)}>
                    {ROLE_LIST.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td>{today(new Date(u.createdAt))}</td>
                <td>
                  <form className="row" onSubmit={(e) => { e.preventDefault(); onPassword(u); }}>
                    <input type="password" autoComplete="new-password" aria-label={`Nueva contraseña para ${u.email}`} placeholder="Nueva contraseña"
                      value={passwords[u.id] ?? ""} onChange={(e) => onPasswordInput(u.id, e.target.value)} />
                    <button className="btn sm" type="submit" disabled={busy || !passwords[u.id]}>Cambiar contraseña</button>
                  </form>
                </td>
                <td>
                  <ArmedButton className="btn sm" armedLabel="¿Eliminar?" disabled={self || busy} onConfirm={() => onDelete(u)}>Eliminar</ArmedButton>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
