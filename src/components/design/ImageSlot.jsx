export default function ImageSlot({ slot, title, image, emptyText = "Sin imagen", logo = false, onFile, onClear }) {
  return (
    <div className="slotcard">
      <h4>{title}</h4>
      <div className={"thumb" + (logo ? " logo-thumb" : "") + (image ? " filled" : "")} id={"th-" + slot} data-testid={"thumb-" + slot}
        style={image ? { backgroundImage: `url("${image}")` } : undefined}>{emptyText}</div>
      <div className="row">
        <label className="btn sm">Subir
          <input className="vh" type="file" accept="image/*" id={"f-" + slot} aria-label={"Subir " + title}
            onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) onFile(slot, f); }} />
        </label>
        <button className="btn sm" type="button" aria-label={"Quitar " + title} onClick={() => onClear(slot)}>Quitar</button>
      </div>
    </div>
  );
}
