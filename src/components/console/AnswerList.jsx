// Host view: all answers with points, each one can be revealed or hidden.
export default function AnswerList({ answers, revealed, free, onToggle }) {
  return (
    <ol className="h-answers" id="hAnswers">
      {answers.map((a, i) => {
        const open = revealed.includes(i);
        const label = open ? "Ocultar" : "Revelar";
        return (
          <li key={i} className={"h-ans" + (open ? " open" : "") + (free.includes(i) ? " free" : "")}>
            <span className="h-num">{i + 1}</span>
            <span className="h-txt">{a.text}</span>
            <span className="h-pts">{a.pts}</span>
            <button className="btn sm" type="button" aria-pressed={String(open)} aria-label={`${label} respuesta ${i + 1}`} onClick={() => onToggle(i)}>{label}</button>
          </li>
        );
      })}
    </ol>
  );
}
