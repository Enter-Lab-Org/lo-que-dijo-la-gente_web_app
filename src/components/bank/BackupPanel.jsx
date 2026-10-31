export default function BackupPanel({ message, onBackup, onExportText }) {
  return (
    <div className="card">
      <h3>Respaldo</h3>
      <p className="hint">Guarda tu banco y el diseño en un archivo para tener copia o pasarlos a otra computadora. Para recuperarlo, usa Abrir archivo.</p>
      <div className="row">
        <button className="btn" id="expBackup" type="button" onClick={onBackup}>Guardar respaldo</button>
        <button className="btn" id="expText" type="button" onClick={onExportText}>Exportar preguntas en texto</button>
      </div>
      <div className="msg" id="expMsg" aria-live="polite">{message}</div>
    </div>
  );
}
