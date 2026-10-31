import { CHANNEL } from "../domain/constants";

/* Messages between the console and the public screen: native IPC, or BroadcastChannel plus postMessage
   to the window this one opened (or that opened it). */
export function createBus({ native = null, win = globalThis.window, BroadcastChannelImpl = globalThis.BroadcastChannel } = {}) {
  const handlers = new Set();
  const emit = (m) => handlers.forEach((fn) => fn(m || {}));
  let pubWin = null, bc = null;
  // Only talk to windows of this same origin. A file:// page has the opaque origin "null", which postMessage
  // cannot target; "*" is safe there because a remote page cannot open a file:// URL.
  const origin = win.location && win.location.origin;
  const target = origin && origin !== "null" ? origin : "*";

  if (native) native.on(emit);
  else {
    try { bc = new BroadcastChannelImpl(CHANNEL); bc.addEventListener("message", (e) => emit(e.data)); } catch (e) { bc = null; }
    win.addEventListener("message", (e) => {
      const d = e.data;
      if (d && d.__ldlg && e.origin === origin && e.source && (e.source === pubWin || e.source === win.opener)) emit(d.m);
    });
  }

  return {
    post(m) {
      if (native) { native.send(m); return; }
      try { bc && bc.postMessage(m); } catch (e) {}
      const msg = { __ldlg: true, m };
      try { if (pubWin && !pubWin.closed) pubWin.postMessage(msg, target); } catch (e) {}
      try { if (win.opener && !win.opener.closed) win.opener.postMessage(msg, target); } catch (e) {}
    },
    on(fn) { handlers.add(fn); return () => handlers.delete(fn); },
    setPublicWindow(w) { pubWin = w; },
  };
}
