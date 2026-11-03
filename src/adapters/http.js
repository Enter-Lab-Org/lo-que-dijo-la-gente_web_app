const FALLBACK = "No se pudo completar la acción. Intenta de nuevo.";

/* JSON calls to our own API routes. Rejects with the server's message, or a generic one when there is none. */
export function createJsonCall({ fetch }) {
  return async function call(method, path, body) {
    let res;
    try {
      res = await fetch(path, {
        method,
        credentials: "same-origin",
        headers: body ? { "content-type": "application/json" } : {},
        ...(body && { body: JSON.stringify(body) }),
      });
    } catch (e) {
      throw new Error(FALLBACK);
    }
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) throw new Error(data?.error || FALLBACK);
    return data;
  };
}
