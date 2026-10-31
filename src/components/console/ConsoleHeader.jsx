import Tabs from "./Tabs";

export default function ConsoleHeader({ tab, onTab, native, user = null, onLogout = null }) {
  return (
    <header className="c-bar">
      <div className="c-brand"><span className="c-logo">Lo que dijo la gente</span><span className="c-role">Consola</span></div>
      <Tabs tab={tab} onTab={onTab} />
      <div className="c-sync" id="sync" data-st="ok">
        <span className="dot" />
        <span id="syncTxt">{native ? "Sin internet · todo se guarda aquí" : "Guardado en este navegador"}</span>
      </div>
      {onLogout && (
        <div className="c-user">
          {user && <span className="c-user-email">{user.email}</span>}
          <button type="button" className="btn sm" onClick={onLogout}>Cerrar sesión</button>
        </div>
      )}
    </header>
  );
}
