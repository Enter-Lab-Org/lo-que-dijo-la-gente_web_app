import { boardSlots } from "../../domain/screen";
import AnswerTile, { BlankTile } from "./AnswerTile";

// Two-column board with tiles 1..n; gaps up to an even count are blank tiles.
export default function Board({ n = 0, open = [] }) {
  const slots = boardSlots(n);
  const byIndex = new Map(open.map((o) => [o.i, o]));
  return (
    <ol className="s-board" style={{ "--rows": slots / 2 }}>
      {Array.from({ length: slots }, (_, i) => (i < n ? <AnswerTile key={i} index={i} open={byIndex.get(i)} /> : <BlankTile key={i} />))}
    </ol>
  );
}
