// One strike mark: the classic X, or a broken red heel ("¡Tacón roto!") for profiles that use it.
export default function StrikeMark({ kind = "x" }) {
  if (kind !== "heel") return "X";
  return (
    <svg className="heel" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M4 42c0-9 8-12 16-6l14 10c6 4 13 2 17-4l6-12c2-3 5-2 5 2l-2 18c0 3-2 5-5 5h-3l-3 9h-5l1-9H14C8 55 4 50 4 46z" />
      <path className="heel-crack" d="M30 40l5 6-4 3 6 7" fill="none" stroke="var(--tile-deep, #24093F)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
