/* Storage: the app's data files through the native bridge, or localStorage when opened in a browser. */
export function createStorage({ native = null, local = globalThis.localStorage } = {}) {
  return {
    native: !!native,
    get(k) {
      if (native) { try { return native.load(k); } catch (e) { return null; } }
      try { return JSON.parse(local.getItem(k)); } catch (e) { return null; }
    },
    set(k, v) {
      if (native) { try { native.save(k, v); return true; } catch (e) { return false; } }
      try { local.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
    },
  };
}
