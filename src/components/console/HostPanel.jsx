import AnswerList from "./AnswerList";
import StrikeControls from "./StrikeControls";
import PotPanel from "./PotPanel";
import MultiplierSelector from "./MultiplierSelector";

/* The host's card in the Juego tab: current question, answers, strikes, pot and navigation. */
export default function HostPanel({ item, idx, total, round, roundState, pot, nameA, nameB, mult, actions, onGoto }) {
  return (
    <div className="card">
      <div className="h-top">
        <span className="eyebrow" id="hRound">{item ? `Pregunta ${idx + 1} de ${total}${item.cat ? " · " + item.cat : ""}` : "Sin preguntas"}</span>
        <span className={"pill" + (roundState.tone ? " " + roundState.tone : "")} id="hState">{roundState.text}</span>
      </div>
      <h2 className="h-q" id="hQ">{item ? item.q : "La partida está vacía"}</h2>
      {item
        ? <AnswerList answers={item.answers} revealed={round.revealed} free={round.free} onToggle={actions.toggleReveal} />
        : <p className="hint" id="hEmpty">La partida está vacía. Ve al <button className="linkbtn" type="button" onClick={() => onGoto("banco")}>Banco de preguntas</button> y agrega las que quieras jugar.</p>}
      <div className="row">
        <StrikeControls strikes={round ? round.strikes : 0} disabled={!round} onStrike={actions.strike} onSet={actions.setStrikes} />
        <span className="grow" />
        <button className="btn" id="revealAll" type="button" disabled={!item || round.revealed.length >= item.answers.length} onClick={actions.revealAll}>Mostrar todas</button>
      </div>
      <PotPanel pot={pot} nameA={nameA} nameB={nameB} disabled={!round || !!round.awardedTo || pot === 0} onAward={actions.award} />
      <div className="row">
        <button className="btn" id="prev" type="button" disabled={idx <= 0} onClick={() => actions.go(-1)}>← Anterior</button>
        <button className="btn" id="next" type="button" disabled={idx >= total - 1} onClick={() => actions.go(1)}>Siguiente →</button>
        <span className="grow" />
        <MultiplierSelector mult={mult} onChange={actions.setMult} />
      </div>
    </div>
  );
}
