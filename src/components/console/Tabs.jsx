export const TAB_LABELS = { juego: "Juego", banco: "Banco de preguntas", diseno: "Diseño" };

export default function Tabs({ tab, onTab }) {
  return (
    <div className="tabs" role="tablist" aria-label="Secciones de la consola">
      {Object.entries(TAB_LABELS).map(([key, label]) => (
        <button key={key} className="tab" role="tab" type="button" id={"tab-" + key} aria-controls={"p-" + key}
          aria-selected={String(tab === key)} onClick={() => onTab(key)}>{label}</button>
      ))}
    </div>
  );
}
