import { useEffect, useRef } from "react";

/* In-page yes/no question (never a browser dialog, which would block the projector window). */
export default function ConfirmDialog({ title, children, onYes, onNo, yes = "Sí", no = "No" }) {
  const yesRef = useRef(null);
  useEffect(() => { yesRef.current?.focus(); }, []);
  return (
    <div className="a-dialog-back">
      <div className="a-dialog card" role="alertdialog" aria-modal="true" aria-labelledby="aDialogTitle"
        onKeyDown={(e) => { if (e.key === "Escape") onNo(); }}>
        <h3 id="aDialogTitle">{title}</h3>
        <div className="hint">{children}</div>
        <div className="row">
          <button ref={yesRef} type="button" className="btn gold" onClick={onYes}>{yes}</button>
          <button type="button" className="btn" onClick={onNo}>{no}</button>
        </div>
      </div>
    </div>
  );
}
