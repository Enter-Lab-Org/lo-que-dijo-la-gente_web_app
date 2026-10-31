export default function BankToolbar({ query, onQuery, cat, options, onCat, onNew }) {
  return (
    <div className="b-tools">
      <input type="search" id="bSearch" placeholder="Buscar en preguntas y respuestas" aria-label="Buscar" value={query} onChange={(e) => onQuery(e.target.value)} />
      <select id="bCat" aria-label="Filtrar por categoría" value={cat} onChange={(e) => onCat(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <button className="btn b" id="bNew" type="button" onClick={onNew}>Nueva</button>
    </div>
  );
}
