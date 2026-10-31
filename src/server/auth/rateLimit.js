/* Fixed-window failure counter kept in memory (one server process). Enough for this stage;
   several instances would need a shared store. */
export function createRateLimiter({ max = 5, windowMs = 15 * 60_000, now = Date.now } = {}) {
  const hits = new Map();
  const live = (key) => {
    const e = hits.get(key);
    if (e && now() - e.start >= windowMs) { hits.delete(key); return null; }
    return e || null;
  };
  const prune = () => { for (const key of hits.keys()) live(key); };

  return {
    check(key) {
      const e = live(key);
      return e && e.count >= max ? { allowed: false, retryAfterMs: e.start + windowMs - now() } : { allowed: true };
    },
    fail(key) {
      const e = live(key);
      if (e) e.count++;
      else { if (hits.size >= 10_000) prune(); hits.set(key, { count: 1, start: now() }); }
    },
    reset(key) { hits.delete(key); },
  };
}
