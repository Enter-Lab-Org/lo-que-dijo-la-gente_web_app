import { displayLabel } from "../../domain/projector";

// Desktop app: choose the projector display, windowed mode, hide/show.
export function NativeProjectorPanel({ info, status, selected, onSelect, onPlace, onWindowed, onToggle }) {
  const displays = info ? info.displays : [];
  return (
    <section className="c-link" id="projNative" aria-label="Pantalla del público">
      <div className="c-link-txt">
        <strong>Pantalla del público</strong>
        <span id="projState">{info ? status : "Buscando pantallas…"}</span>
      </div>
      <select className="proj-sel" id="projSel" aria-label="Pantalla para el público" value={selected} onChange={(e) => onSelect(e.target.value)}>
        {displays.map((d) => <option key={d.id} value={String(d.id)}>{displayLabel(d)}</option>)}
      </select>
      <div className="row">
        <button className="btn gold" id="projGo" type="button" disabled={!!info && !displays.length} onClick={onPlace}>Enviar a esa pantalla</button>
        <button className="btn" id="projWin" type="button" onClick={onWindowed}>En ventana</button>
        <button className="btn" id="projToggle" type="button" onClick={onToggle}>{!info || info.visible ? "Ocultar" : "Mostrar"}</button>
      </div>
    </section>
  );
}

// Browser: open the public screen in a popup window.
export function WebProjectorPanel({ blocked, onOpen }) {
  return (
    <section className="c-link" id="projWeb" aria-label="Pantalla del público">
      <div className="c-link-txt">
        <strong>Pantalla del público</strong>
        <span>Ábrela, arrástrala a la pantalla del proyector y toca Iniciar para ponerla en pantalla completa.</span>
      </div>
      <div className="row">
        <button className="btn gold" id="openPub" type="button" onClick={onOpen}>{blocked ? "Permite ventanas emergentes" : "Abrir pantalla del público"}</button>
      </div>
    </section>
  );
}
