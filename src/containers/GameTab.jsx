import { currentItem, pot, roundOf, roundState } from "../domain/game";
import HostPanel from "../components/console/HostPanel";
import TeamsPanel from "../components/console/TeamsPanel";
import Playlist from "../components/console/Playlist";
import KeyboardHint from "../components/console/KeyboardHint";
import Monitor from "../components/screen/Monitor";

export default function GameTab({ game, theme, onGoto }) {
  const { state: s, pub, actions } = game;
  const item = currentItem(s);
  return (
    <div className="g-grid">
      <div className="g-col">
        <HostPanel item={item} idx={s.idx} total={s.list.length} round={roundOf(s)} roundState={roundState(s)} pot={pot(s)}
          nameA={s.nameA} nameB={s.nameB} mult={s.mult} actions={actions} onGoto={onGoto} />
        <TeamsPanel nameA={s.nameA} nameB={s.nameB} scoreA={s.scoreA} scoreB={s.scoreB} sound={s.sound}
          onName={actions.setName} onScore={actions.setScore} onToggleSound={actions.toggleSound} onReset={actions.resetScores} />
      </div>
      <div className="g-col">
        <div className="card">
          <div className="card-h"><h3>Así lo ve el público</h3><span className="eyebrow">Sin respuestas ocultas</span></div>
          <Monitor id="mon1" pub={pub} theme={theme} />
        </div>
        <Playlist list={s.list} idx={s.idx} rounds={s.rounds} onGo={actions.jumpTo} onMove={actions.moveItem}
          onRemove={actions.removeFromGame} onClear={actions.clearGame} onGoto={onGoto} />
        <KeyboardHint />
      </div>
    </div>
  );
}
