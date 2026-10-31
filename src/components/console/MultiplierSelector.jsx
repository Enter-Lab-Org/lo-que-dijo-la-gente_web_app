export default function MultiplierSelector({ mult, onChange }) {
  return (
    <div className="seg" id="mult" role="group" aria-label="Multiplicador de puntos">
      {[1, 2, 3].map((m) => <button key={m} type="button" aria-pressed={String(mult === m)} onClick={() => onChange(m)}>x{m}</button>)}
    </div>
  );
}
