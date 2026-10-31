import ImageSlot from "./ImageSlot";
import SyncedInput from "../atoms/SyncedInput";
import ArmedButton from "../atoms/ArmedButton";
import { THEME0 } from "../../domain/constants";

const SLOTS = [
  { slot: "page", title: "Fondo de la pantalla" },
  { slot: "stage", title: "Fondo del tablero" },
  { slot: "tile", title: "Fichas ocultas" },
  { slot: "logo", title: "Logo", emptyText: "Sin logo", logo: true },
];

/* Client design: images, title, colors and background shade. Only changes the public screen. */
export default function DesignPanel({ theme, message, onFile, onClear, onTitle, onColor, onShade, onReset }) {
  return (
    <div className="card">
      <h3>Diseño del cliente</h3>
      <p className="hint">Las imágenes se reducen solas y se guardan en esta computadora.</p>
      <div className="slots">
        {SLOTS.map((s) => <ImageSlot key={s.slot} {...s} image={theme[s.slot]} onFile={onFile} onClear={onClear} />)}
      </div>
      <div className="fields">
        <label className="field"><span>Título del juego</span>
          <SyncedInput id="t-title" maxLength={40} value={theme.title} onInput={onTitle} normalize={(v) => v.trim() || THEME0.title} />
        </label>
        <label className="field"><span>Color de acento</span><input type="color" id="t-gold" value={theme.gold} onChange={(e) => onColor("gold", e.target.value)} /></label>
        <label className="field"><span>Color equipo 1</span><input type="color" id="t-rosa" value={theme.rosa} onChange={(e) => onColor("rosa", e.target.value)} /></label>
        <label className="field"><span>Color equipo 2</span><input type="color" id="t-turq" value={theme.turq} onChange={(e) => onColor("turq", e.target.value)} /></label>
        <label className="field"><span>Oscurecer fondos</span><input type="range" id="t-shade" min="0" max="90" step="5" value={theme.shade} onChange={(e) => onShade(+e.target.value)} /></label>
      </div>
      <div className="row"><ArmedButton id="themeReset" armedLabel="Toca otra vez para restaurar" onConfirm={onReset}>Volver al diseño original</ArmedButton></div>
      <div className="msg" id="cmsg" aria-live="polite">{message}</div>
    </div>
  );
}
