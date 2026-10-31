import { useBump } from "../../hooks/useBump";

export default function TeamScore({ side, name, score }) {
  const ref = useBump(score);
  return (
    <div className={"s-team " + side} data-testid={"team-" + side}>
      <div className="s-name">{name || ""}</div>
      <div className="s-score" ref={ref}>{score || 0}</div>
    </div>
  );
}
