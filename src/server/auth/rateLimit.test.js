import { createRateLimiter } from "./rateLimit.js";

describe("rate limiter", () => {
  it("blocks after max failures inside the window and reports when to retry", () => {
    let t = 0;
    const rl = createRateLimiter({ max: 2, windowMs: 1000, now: () => t });
    expect(rl.check("k")).toEqual({ allowed: true });
    rl.fail("k"); rl.fail("k");
    t = 400;
    expect(rl.check("k")).toEqual({ allowed: false, retryAfterMs: 600 });
    expect(rl.check("other")).toEqual({ allowed: true });
    t = 1000;
    expect(rl.check("k")).toEqual({ allowed: true });
  });

  it("reset clears a key", () => {
    const rl = createRateLimiter({ max: 1, windowMs: 1000, now: () => 0 });
    rl.fail("k");
    rl.reset("k");
    expect(rl.check("k").allowed).toBe(true);
  });
});
