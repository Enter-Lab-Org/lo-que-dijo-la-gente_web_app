/* Shrinks an uploaded image to maxW and returns it as a data URL (PNG keeps transparency). */
export function prepImage(file, maxW, png) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth || maxW, h = img.naturalHeight || Math.round(maxW * 0.5625), s = Math.min(1, maxW / w);
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL(png ? "image/png" : "image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
