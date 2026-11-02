export const NO_ACCESS = "Tu usuario no tiene acceso a esta sección.";

export default function NoAccess({ onLogout = null }) {
  return (
    <div className="no-access" role="alert">
      <p>{NO_ACCESS}</p>
      {onLogout && <button type="button" className="btn sm" onClick={onLogout}>Cerrar sesión</button>}
    </div>
  );
}
