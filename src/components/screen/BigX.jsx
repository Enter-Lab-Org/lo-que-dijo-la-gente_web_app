import StrikeMark from "./StrikeMark";

export default function BigX({ count, mark = "x" }) {
  return (
    <div className="s-bigx" hidden={!count} aria-hidden="true" data-testid="bigx">
      {Array.from({ length: count || 0 }, (_, i) => <span key={i}><StrikeMark kind={mark} /></span>)}
    </div>
  );
}
