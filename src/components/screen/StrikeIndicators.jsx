import { MAX_STRIKES } from "../../domain/constants";

export default function StrikeIndicators({ count = 0 }) {
  return (
    <div className="s-strikes" data-testid="strikes">
      {Array.from({ length: MAX_STRIKES }, (_, i) => <span key={i} className={"s-strike" + (i < count ? " on" : "")}>X</span>)}
    </div>
  );
}
