import { MAX_STRIKES } from "../../domain/constants";

// "X Strike" adds a strike with buzz; the three indicators fix the count silently.
export default function StrikeControls({ strikes, disabled, onStrike, onSet }) {
  return (
    <>
      <button className="btn x" id="btnStrike" type="button" disabled={disabled} onClick={onStrike}>X Strike</button>
      <div className="h-strikes" id="hStrikes" aria-label="Strikes de la ronda">
        {Array.from({ length: MAX_STRIKES }, (_, i) => (
          <button key={i} className={"h-strike" + (!disabled && i < strikes ? " on" : "")} type="button" disabled={disabled}
            aria-label={`Strike ${i + 1}`} onClick={() => onSet(i)}>X</button>
        ))}
      </div>
    </>
  );
}
