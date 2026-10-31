import { useEffect, useRef } from "react";
import { MAX_ANSWERS } from "../../domain/constants";
import { formTotals } from "../../domain/bank";
import { plural } from "../../domain/utils";

/* Create or edit a question with up to 8 answers. The container owns the form state. */
export default function QuestionForm({ form, categories, message, formRef, questionRef, onChange, onAnswer, onAddAnswer, onRemoveAnswer, onClear, onSubmit }) {
  const { count, total } = formTotals(form.answers);
  const focusRow = useRef(null);
  useEffect(() => {
    if (focusRow.current == null) return;
    const el = document.getElementById("fa-t-" + focusRow.current);
    focusRow.current = null;
    if (el) el.focus();
  }, [form.answers.length]);
  const add = () => { if (form.answers.length < MAX_ANSWERS) { focusRow.current = form.answers.length; onAddAnswer(); } };
  return (
    <form className="card" id="qForm" autoComplete="off" noValidate ref={formRef} onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <div className="card-h"><h3 id="fTitle">{form.id ? "Editar pregunta" : "Nueva pregunta"}</h3><span className="eyebrow" id="fTotal">{`${count} ${plural(count, "respuesta")} · ${total} pts`}</span></div>
      <label className="field"><span>Pregunta</span>
        <textarea id="fQ" rows={2} placeholder="Menciona algo que…" ref={questionRef} value={form.q} onChange={(e) => onChange("q", e.target.value)} />
      </label>
      <label className="field"><span>Categoría o cliente</span>
        <input type="text" id="fCat" list="catList" placeholder="Por ejemplo: Taller UdeG" value={form.cat} onChange={(e) => onChange("cat", e.target.value)} />
      </label>
      <datalist id="catList">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      <div className="field"><span>Respuestas y puntos (hasta 8)</span>
        <div className="f-ans" id="fAns">
          {form.answers.map((a, i) => (
            <div className="f-row" key={i}>
              <span className="h-num">{i + 1}</span>
              <input type="text" id={"fa-t-" + i} placeholder="Respuesta" aria-label={`Respuesta ${i + 1}`} value={a.text} onChange={(e) => onAnswer(i, "text", e.target.value)} />
              <input type="number" id={"fa-p-" + i} min="0" placeholder="Pts" aria-label={`Puntos de la respuesta ${i + 1}`} value={a.pts} onChange={(e) => onAnswer(i, "pts", e.target.value)} />
              <button className="icon" type="button" aria-label={`Quitar respuesta ${i + 1}`} onClick={() => onRemoveAnswer(i)}>×</button>
            </div>
          ))}
        </div>
      </div>
      <div className="row">
        <button className="btn sm" id="fAdd" type="button" disabled={form.answers.length >= MAX_ANSWERS} onClick={add}>+ Respuesta</button>
        <span className="grow" />
        <button className="btn" id="fCancel" type="button" onClick={onClear}>Limpiar</button>
        <button className="btn b" type="submit">Guardar</button>
      </div>
      <div className="msg" id="fMsg" aria-live="polite">{message}</div>
    </form>
  );
}
