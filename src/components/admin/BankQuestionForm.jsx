import { QUESTION_PROFILE_LIST, QUESTION_PROFILE_LABELS } from "../../domain/profiles";

/* New database question: text, category, question profile and up to 8 answers with points.
   Points left empty are saved as 10 by the server. The container owns the values. */
export default function BankQuestionForm({ form, categories, busy, onChange, onAnswer, onAddRow, maxAnswers, onSubmit }) {
  return (
    <form className="card" noValidate onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <div className="card-h"><h3>Nueva pregunta</h3></div>
      <label className="field"><span>Pregunta</span>
        <input type="text" maxLength={200} value={form.text} onChange={(e) => onChange("text", e.target.value)} placeholder="Ej. Algo que nunca falta en la bolsa de una drag" />
      </label>
      <div className="fields">
        <label className="field"><span>Categoría</span>
          <select value={form.categoryId} onChange={(e) => onChange("categoryId", e.target.value)}>
            <option value="">Sin categoría</option>
            {categories.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>
        </label>
        <label className="field"><span>Perfil</span>
          <select value={form.profile} onChange={(e) => onChange("profile", e.target.value)}>
            {QUESTION_PROFILE_LIST.map((p) => <option key={p} value={p}>{QUESTION_PROFILE_LABELS[p]}</option>)}
          </select>
        </label>
      </div>
      <div className="a-answers">
        {form.answers.map((a, i) => (
          <div key={i} className="a-answer">
            <input type="text" maxLength={80} aria-label={`Respuesta ${i + 1}`} placeholder={`Respuesta ${i + 1}`} value={a.text} onChange={(e) => onAnswer(i, "text", e.target.value)} />
            <input type="number" min="0" max="999" step="1" inputMode="numeric" aria-label={`Puntaje ${i + 1}`} placeholder="10" value={a.points} onChange={(e) => onAnswer(i, "points", e.target.value)} />
          </div>
        ))}
      </div>
      <p className="hint">Si no escribes el puntaje de una respuesta, vale 10 puntos.</p>
      <div className="row">
        <button className="btn sm" type="button" onClick={onAddRow} disabled={form.answers.length >= maxAnswers}>Agregar respuesta</button>
        <button className="btn gold" type="submit" disabled={busy}>Guardar pregunta</button>
      </div>
    </form>
  );
}
