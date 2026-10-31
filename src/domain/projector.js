/* Native projector panel (desktop app only): display list, selection and status text. */

export const displayLabel = (d) => `Pantalla ${d.n}${d.primary ? " (esta)" : ""} · ${d.w}×${d.h}`;

// Selected display: the one in use, else the user's previous choice, else the first external one, else the first.
export function pickDisplay(info, keep) {
  const ids = info.displays.map((d) => String(d.id));
  if (info.on != null) return String(info.on);
  if (keep && ids.includes(keep)) return keep;
  const ext = info.displays.find((d) => !d.primary);
  return ext ? String(ext.id) : ids[0] || "";
}

export function projectorStatus(info) {
  const onD = info.displays.find((d) => d.id === info.on);
  if (!info.visible) return "Oculta. Toca Mostrar para enviarla al proyector.";
  if (onD && info.fullscreen) return `En la pantalla ${onD.n} (${onD.w}×${onD.h}), en pantalla completa.`;
  if (info.displays.length < 2) return "Solo detecto una pantalla. Conecta el proyector en modo Extender (no Duplicar) y se enviará sola.";
  return "En una ventana en tu pantalla. Elige la pantalla del proyector y toca Enviar.";
}
