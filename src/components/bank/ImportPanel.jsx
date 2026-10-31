export default function ImportPanel({ text, onText, cat, onCat, message, onImport, onOpenFile }) {
  return (
    <div className="card">
      <h3>Importar en bloque</h3>
      <p className="hint">La pregunta va en la primera línea y cada respuesta debajo con sus puntos. Deja una línea en blanco entre preguntas.</p>
      <pre>{"Menciona algo que no puede faltar en una carne asada\nTortillas | 34\nCerveza | 25\nSalsa | 15"}</pre>
      <textarea className="mono" id="impText" rows={7} spellCheck={false} aria-label="Preguntas para importar" value={text} onChange={(e) => onText(e.target.value)} />
      <label className="field"><span>Categoría para todas</span>
        <input type="text" id="impCat" list="catList" placeholder="Opcional" value={cat} onChange={(e) => onCat(e.target.value)} />
      </label>
      <div className="row">
        <button className="btn b" id="impGo" type="button" onClick={onImport}>Importar al banco</button>
        <button className="btn" id="impFile" type="button" onClick={onOpenFile}>Abrir archivo</button>
      </div>
      <div className="msg" id="impMsg" aria-live="polite">{message}</div>
    </div>
  );
}
