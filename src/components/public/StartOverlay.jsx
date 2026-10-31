// Browser only: a user gesture is needed to enable sound and full screen.
export default function StartOverlay({ onStart }) {
  return (
    <div className="p-start" id="pStart">
      <p><strong>Pantalla lista</strong>Toca Iniciar para activar el sonido y la pantalla completa.</p>
      <button className="btn gold" id="pGo" type="button" onClick={onStart}>Iniciar</button>
    </div>
  );
}
