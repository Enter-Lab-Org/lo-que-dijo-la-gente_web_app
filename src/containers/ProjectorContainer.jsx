import { useEffect, useState } from "react";
import { pickDisplay, projectorStatus } from "../domain/projector";
import { NativeProjectorPanel, WebProjectorPanel } from "../components/console/ProjectorPanel";

export default function ProjectorContainer({ projector }) {
  const [info, setInfo] = useState(null);
  const [selected, setSelected] = useState("");
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!projector.native) return;
    const apply = (i) => { if (!i) return; setInfo(i); setSelected((keep) => pickDisplay(i, keep)); };
    projector.onDisplays(apply);
    Promise.resolve(projector.displays()).then(apply).catch(() => {});
  }, [projector]);

  if (!projector.native) return <WebProjectorPanel blocked={blocked} onOpen={() => { if (!projector.openPublic()) setBlocked(true); }} />;
  return (
    <NativeProjectorPanel info={info} status={info ? projectorStatus(info) : ""} selected={selected} onSelect={setSelected}
      onPlace={() => { const id = Number(selected); if (selected !== "" && !isNaN(id)) projector.place(id); }}
      onWindowed={() => projector.windowed()} onToggle={() => projector.toggle()} />
  );
}
