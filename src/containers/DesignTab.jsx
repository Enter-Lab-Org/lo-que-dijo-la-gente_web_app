import { IMAGE_SIZES } from "../domain/constants";
import { resetTheme } from "../domain/theme";
import DesignPanel from "../components/design/DesignPanel";
import Monitor from "../components/screen/Monitor";

export default function DesignTab({ themeStore, pub, images }) {
  const { theme, message, setMessage, actions, current } = themeStore;
  const onFile = async (slot, file) => {
    setMessage("Cargando imagen…");
    let data;
    try { data = await images.prepImage(file, IMAGE_SIZES[slot][0], IMAGE_SIZES[slot][1]); }
    catch (e) { setMessage("No pude abrir ese archivo. Usa una imagen JPG, PNG o WebP."); return; }
    setMessage("Imagen aplicada.");
    actions.update({ [slot]: data });
  };
  const onClear = (slot) => { actions.update({ [slot]: null }); setMessage("Imagen quitada."); };
  const onReset = () => { actions.commitTheme(resetTheme(current())); setMessage("Diseño original restaurado."); };
  return (
    <div className="d-grid">
      <DesignPanel theme={theme} message={message} onFile={onFile} onClear={onClear} onTitle={actions.setTitle}
        onColor={(k, v) => actions.update({ [k]: v })} onShade={(v) => actions.update({ shade: v })} onReset={onReset} />
      <div className="card">
        <div className="card-h"><h3>Vista previa</h3><span className="eyebrow">Pantalla del público</span></div>
        <Monitor id="mon2" pub={pub} theme={theme} />
      </div>
    </div>
  );
}
