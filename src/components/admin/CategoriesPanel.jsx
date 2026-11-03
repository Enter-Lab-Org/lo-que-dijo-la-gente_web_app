import ArmedButton from "../atoms/ArmedButton";

/* Question categories of the database bank: add and delete. The container owns the values. */
export default function CategoriesPanel({ categories, name, busy, onName, onAdd, onDelete }) {
  return (
    <div className="a-grid">
      <form className="card" noValidate onSubmit={(e) => { e.preventDefault(); onAdd(); }}>
        <div className="card-h"><h3>Nueva categoría</h3></div>
        <label className="field"><span>Nueva categoría</span>
          <input type="text" maxLength={60} value={name} onChange={(e) => onName(e.target.value)} placeholder="Ej. Cultura drag" />
        </label>
        <div className="row"><button className="btn" type="submit" disabled={busy}>Agregar categoría</button></div>
      </form>
      <div className="card">
        <div className="card-h"><h3>Categorías</h3></div>
        {categories.length === 0 && <p className="hint">Todavía no hay categorías.</p>}
        <ul className="a-list" aria-label="Categorías">
          {categories.map((c) => (
            <li key={c.id} className="a-item">
              <span className="a-name">{c.name}</span>
              <ArmedButton className="btn sm" armedLabel="¿Eliminar?" disabled={busy} onConfirm={() => onDelete(c)}>Eliminar</ArmedButton>
            </li>
          ))}
        </ul>
        <p className="hint">Al eliminar una categoría, sus preguntas quedan sin categoría.</p>
      </div>
    </div>
  );
}
