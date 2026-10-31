import { getNative } from "./native";
import { createStorage } from "./storage";
import { createBus } from "./bus";
import { createAudio } from "./audio";
import { createFiles } from "./files";
import { prepImage } from "./images";
import { createProjector } from "./projector";

/* All side effects the app needs, built once. Tests pass fakes with the same shape. */
export function createServices(win = window) {
  const native = getNative(win);
  const bus = createBus({ native, win });
  return {
    native: !!native,
    storage: createStorage({ native, local: win.localStorage }),
    bus,
    audio: createAudio({ win }),
    files: createFiles({ native, doc: win.document, url: win.URL }),
    images: { prepImage },
    projector: createProjector({ native, win, bus }),
    fullscreen: {
      toggle() {
        try {
          const d = win.document, el = d.documentElement;
          if (d.fullscreenElement) d.exitFullscreen();
          else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
        } catch (e) {}
      },
    },
  };
}
