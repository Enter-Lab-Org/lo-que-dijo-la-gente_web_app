import ArmedButton from "../atoms/ArmedButton";
import { QUESTION_PROFILE_LABELS } from "../../domain/profiles";

/* Questions stored in the database bank, with their category, profile and answers. */
export default function BankQuestionList({ questions, busy, onDelete }) {
  return (
    <div className="card">
      <div className="card-h"><h3>Banco en la base de datos</h3><span className="hint">{questions.length} en total</span></div>
      {questions.length === 0 && <p className="hint">Todavía no hay preguntas en la base de datos.</p>}
      <ul className="a-list" aria-label="Preguntas del banco">
        {questions.map((q) => (
          <li key={q.id} className="a-item b-item">
            <div>
              <div className="b-q">{q.text}</div>
              <div className="b-meta">
                <span className={"chip" + (q.profile === "ADULT" ? " adult" : "")}>{QUESTION_PROFILE_LABELS[q.profile] ?? q.profile}</span>
                {q.category ? <span className="chip">{q.category}</span> : null}
              </div>
              <div className="b-ans">{q.answers.map((a) => `${a.text} · ${a.points}`).join("  /  ")}</div>
            </div>
            <ArmedButton className="btn sm" armedLabel="¿Eliminar?" disabled={busy} onConfirm={() => onDelete(q)}>Eliminar</ArmedButton>
          </li>
        ))}
      </ul>
    </div>
  );
}
