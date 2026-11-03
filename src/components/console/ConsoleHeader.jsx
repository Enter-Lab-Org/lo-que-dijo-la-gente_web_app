import Tabs from "./Tabs";

export default function ConsoleHeader({ tab, tabs, onTab, native, user = null, onLogout = null, brand = "Lo que dijo la gente" }) {
  return (
    <header className="c-bar">
      <div className="c-brand"><span className="c-logo">{brand}</span><span className="c-role">Consola</span></div>
      <Tabs tab={tab} tabs={tabs} onTab={onTab} />
      <div className="c-sync" id="sync" data-st="ok">
        <span className="dot" />
        <span id="syncTxt">{native ? "Sin internet · todo se guarda aquí" : "Guardado en este navegador"}</span>
      </div>
      {onLogout && (
        <div className="c-user">
          {user && <span className="c-user-email">{user.email}</span>}
          {user?.role && <span className="c-user-role">{user.role}</span>}
          <button type="button" className="btn sm" onClick={onLogout}>Cerrar sesión</button>
        </div>
      )}
    </header>
  );
}
