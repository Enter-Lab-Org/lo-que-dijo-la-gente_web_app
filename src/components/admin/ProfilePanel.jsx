import { QUESTION_PROFILE_LABELS } from "../../domain/profiles";

/* Game profile picker: the profiles, and the database questions of the chosen one with checkboxes. */
export default function ProfilePanel({ profiles, chosen, activeId, questions, selected, dirty = false, onChoose, onToggle, onAll, onApply }) {
  const active = profiles.find((p) => p.id === activeId);
  return (
    <div className="a-grid">
      <fieldset className="card a-profiles">
        <legend className="a-legend">Perfil del juego</legend>
        <p className="hint">Perfil activo: {active?.name}</p>
        {profiles.map((p) => (
          <label key={p.id} className={"a-profile" + (p.id === chosen.id ? " on" : "")} data-profile-card={p.id}>
            <input type="radio" name="gameProfile" value={p.id} checked={p.id === chosen.id} onChange={() => onChoose(p.id)} />
            <span className="a-profile-txt">
              <strong>{p.name}</strong>
              <span>{p.description} Preguntas: {QUESTION_PROFILE_LABELS[p.questionProfile]}.</span>
            </span>
            {p.palette && <span className="a-swatches" aria-hidden="true">{["--bg", "--tile-hi", "--x", "--orange", "--bulb", "--paper"].map((k) => <i key={k} style={{ background: p.palette[k] }} />)}</span>}
          </label>
        ))}
      </fieldset>
      <div className="card">
        <div className="card-h">
          <h3>Preguntas para {chosen.name}</h3>
          <span className="hint">{selected.size} de {questions.length} seleccionadas</span>
        </div>
        {questions.length === 0
          ? <p className="hint">No hay preguntas {QUESTION_PROFILE_LABELS[chosen.questionProfile]} en la base de datos. Agrégalas en «Preguntas».</p>
          : (
            <>
              <div className="row">
                <button className="btn sm" type="button" onClick={() => onAll(true)}>Todas</button>
                <button className="btn sm" type="button" onClick={() => onAll(false)}>Ninguna</button>
              </div>
              <fieldset className="a-picker" aria-label="Preguntas del perfil">
                {questions.map((q) => (
                  <label key={q.id} className="a-check">
                    <input type="checkbox" checked={selected.has(q.id)} onChange={() => onToggle(q.id)} />
                    <span>{q.text}{q.category ? <em> · {q.category}</em> : null}</span>
                  </label>
                ))}
              </fieldset>
            </>
          )}
        {dirty && <p className="hint err" role="status">Hay cambios sin aplicar: usa «Usar este perfil» para guardarlos.</p>}
        <div className="row"><button className="btn gold" type="button" onClick={onApply}>Usar este perfil</button></div>
      </div>
    </div>
  );
}
