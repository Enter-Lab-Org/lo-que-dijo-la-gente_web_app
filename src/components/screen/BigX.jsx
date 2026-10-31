export default function BigX({ count }) {
  return (
    <div className="s-bigx" hidden={!count} aria-hidden="true" data-testid="bigx">
      {Array.from({ length: count || 0 }, (_, i) => <span key={i}>X</span>)}
    </div>
  );
}
