import { PUBLIC_HASH } from "../domain/constants";

/* Public screen placement. Desktop app: native display control. Browser: a popup window on #publico. */
export function createProjector({ native = null, win = globalThis.window, bus = null } = {}) {
  if (native) {
    return {
      native: true,
      displays: () => native.displays(),
      onDisplays: (fn) => native.onDisplays(fn),
      place: (id) => native.place(id),
      windowed: () => native.windowed(),
      toggle: () => native.toggle(),
      escape: () => native.escape(),
    };
  }
  return {
    native: false,
    // Returns false when the browser blocked the popup.
    openPublic() {
      const url = win.location.href.split("#")[0] + PUBLIC_HASH;
      const w = win.open(url, "ldlg-publico", "popup,width=1280,height=720");
      if (!w) return false;
      if (bus) bus.setPublicWindow(w);
      try { w.focus(); } catch (e) {}
      return true;
    },
  };
}
