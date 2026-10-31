import ArmedButton from "../atoms/ArmedButton";

/* Today's game ("partida"): jump, reorder, remove, or clear with confirmation. */
export default function Playlist({ list, idx, rounds, onGo, onMove, onRemove, onClear, onGoto }) {
  return (
    <div className="card">
      <div className="card-h">
        <h3>Partida <span id="plCount" className="eyebrow">{list.length ? `· ${list.length}` : ""}</span></h3>
        <ArmedButton className="btn sm" id="plClear" disabled={!list.length} armedLabel="¿Vaciar? Toca otra vez" onConfirm={onClear}>Vaciar</ArmedButton>
      </div>
      <ol className="playlist" id="playlist">
        {list.map((it, i) => {
          const r = rounds[it.id];
          return (
            <li key={it.id} className={"pl-item" + (i === idx ? " cur" : "") + (r && r.awardedTo ? " done" : "")}>
              <button className="pl-go" type="button" onClick={() => onGo(i)}><span className="pl-n">{i + 1}</span><span className="pl-q">{it.q}</span></button>
              <span className="pl-acts">
                <button className="icon" type="button" aria-label="Subir" disabled={i === 0} onClick={() => onMove(i, -1)}>↑</button>
                <button className="icon" type="button" aria-label="Bajar" disabled={i === list.length - 1} onClick={() => onMove(i, 1)}>↓</button>
                <button className="icon" type="button" aria-label="Quitar de la partida" onClick={() => onRemove(it.id)}>×</button>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="hint" id="plEmpty" hidden={list.length > 0}>Todavía no hay preguntas en la partida. Agrégalas desde el <button className="linkbtn" type="button" onClick={() => onGoto("banco")}>Banco de preguntas</button>.</p>
    </div>
  );
}
