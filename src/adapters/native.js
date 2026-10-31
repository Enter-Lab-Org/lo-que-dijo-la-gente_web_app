/* Electron bridge exposed by preload.js as window.ldlg (native: true). Null in a plain browser. */
export const getNative = (win = globalThis.window) => (win && win.ldlg && win.ldlg.native ? win.ldlg : null);
