export default function PotPanel({ pot, nameA, nameB, disabled, onAward }) {
  return (
    <div className="h-pot">
      <div><span className="eyebrow">En juego</span><div className="h-potnum" id="hPot">{pot}</div></div>
      <button className="btn a" id="awardA" type="button" disabled={disabled} onClick={() => onAward("A")}>Puntos para {nameA}</button>
      <button className="btn b" id="awardB" type="button" disabled={disabled} onClick={() => onAward("B")}>Puntos para {nameB}</button>
    </div>
  );
}
