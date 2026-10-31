import { useBump } from "../../hooks/useBump";

// Center of the scoreboard: client logo, game title and points in play.
export default function PotDisplay({ logo, title, pot }) {
  const ref = useBump(pot || 0, (prev, next) => next > prev);
  return (
    <div className="s-pot">
      <img className="s-logo" alt="" hidden={!logo} src={logo || undefined} />
      <div className="s-brand">{title}</div>
      <span className="s-label">En juego</span>
      <div className="s-potnum" ref={ref} data-testid="pot">{pot || 0}</div>
    </div>
  );
}
