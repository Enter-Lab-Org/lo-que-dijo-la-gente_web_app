/* Export and import files: native save/open dialogs, or a download and a file picker in the browser. */
export function createFiles({ native = null, doc = globalThis.document, url = globalThis.URL } = {}) {
  return {
    // Resolves to the message to show, or null if the user cancelled.
    async saveFile(name, text, mime) {
      if (native) { const p = await native.exportFile(name, text); return p ? "Guardado en " + p : null; }
      const href = url.createObjectURL(new Blob([text], { type: mime }));
      const a = doc.createElement("a"); a.href = href; a.download = name; doc.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => url.revokeObjectURL(href), 2000);
      return "Archivo descargado: " + name;
    },
    // Resolves to { name, text } or null.
    openFile() {
      if (native) return native.importFile();
      return new Promise((resolve) => {
        const inp = doc.createElement("input");
        inp.type = "file"; inp.accept = ".txt,.json,text/plain,application/json";
        inp.onchange = () => {
          const f = inp.files && inp.files[0]; if (!f) return resolve(null);
          readText(f).then(resolve, () => resolve(null));
        };
        inp.click();
      });
    },
  };
}

export const readText = (f) => new Promise((resolve, reject) => {
  const fr = new FileReader();
  fr.onload = () => resolve({ name: f.name, text: String(fr.result || "") });
  fr.onerror = reject;
  fr.readAsText(f, "utf-8");
});
