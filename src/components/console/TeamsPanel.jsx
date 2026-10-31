import SyncedInput from "../atoms/SyncedInput";
import CommitInput from "../atoms/CommitInput";
import ArmedButton from "../atoms/ArmedButton";
import { teamName } from "../../domain/game";

function TeamEditor({ team, label, name, score, onName, onScore }) {
  return (
    <div className={"team-ed " + team.toLowerCase()}>
      <label className="field"><span>{label}</span>
        <SyncedInput id={"name" + team} maxLength={24} value={name} onInput={(v) => onName(team, v)} normalize={(v) => teamName(team, v)} />
      </label>
      <label className="field"><span>Puntos</span>
        <CommitInput type="number" id={"score" + team} inputMode="numeric" value={score} onCommit={(v) => onScore(team, v)} />
      </label>
    </div>
  );
}

export default function TeamsPanel({ nameA, nameB, scoreA, scoreB, sound, onName, onScore, onToggleSound, onReset }) {
  return (
    <div className="card">
      <h3>Equipos</h3>
      <div className="teams">
        <TeamEditor team="A" label="Equipo 1" name={nameA} score={scoreA} onName={onName} onScore={onScore} />
        <TeamEditor team="B" label="Equipo 2" name={nameB} score={scoreB} onName={onName} onScore={onScore} />
      </div>
      <div className="row">
        <button className={"btn" + (sound ? " on" : "")} id="soundToggle" type="button" onClick={onToggleSound}>Sonido en pantalla: {sound ? "sí" : "no"}</button>
        <ArmedButton id="resetGame" armedLabel="Toca otra vez para borrar" onConfirm={onReset}>Reiniciar marcador</ArmedButton>
      </div>
    </div>
  );
}
