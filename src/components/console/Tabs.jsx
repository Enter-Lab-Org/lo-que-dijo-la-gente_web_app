export const TAB_LABELS = { juego: "Juego", banco: "Banco de preguntas", diseno: "Diseño", admin: "Administración" };

// Without a list, the game tabs (what a host without login shows). "admin" only appears when the role allows it.
const GAME_TABS = ["juego", "banco", "diseno"];

export default function Tabs({ tab, onTab, tabs = GAME_TABS }) {
  return (
    <div className="tabs" role="tablist" aria-label="Secciones de la consola">
      {tabs.map((key) => [key, TAB_LABELS[key]]).map(([key, label]) => (
        <button key={key} className="tab" role="tab" type="button" id={"tab-" + key} aria-controls={"p-" + key}
          aria-selected={String(tab === key)} onClick={() => onTab(key)}>{label}</button>
      ))}
    </div>
  );
}
