export default function CornerControls({ show, onFullscreen }) {
  return (
    <div className={"p-corner" + (show ? " show" : "")} id="pCorner" data-testid="corner">
      <button className="btn sm" id="pFs" type="button" onClick={onFullscreen}>Pantalla completa</button>
    </div>
  );
}
