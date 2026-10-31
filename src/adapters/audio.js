/* Synthesized sounds (WebAudio, no files). Only the public screen plays them. */
export function createAudio({ win = globalThis.window } = {}) {
  let ac = null;
  function ctx() {
    try {
      if (!ac) { const AC = win.AudioContext || win.webkitAudioContext; if (!AC) return null; ac = new AC(); }
      if (ac.state === "suspended") ac.resume();
    } catch (e) { ac = null; }
    return ac;
  }
  function tone(freq, dur, type = "sine", when = 0, vol = 0.2) {
    const c = ctx(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + when;
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  const sounds = {
    ding: () => { tone(988, 0.25, "triangle"); tone(1319, 0.5, "triangle", 0.12); },
    buzz: () => { tone(110, 0.75, "sawtooth", 0, 0.22); tone(117, 0.75, "square", 0, 0.1); },
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, "triangle", i * 0.1)),
  };
  return {
    // Browsers only allow sound after a user gesture: create the context and play a silent tone.
    unlock() { ctx(); tone(1, 0.01, "sine", 0, 0.0002); },
    prepare: ctx,
    has: (type) => !!sounds[type],
    play(type) { if (sounds[type]) sounds[type](); },
  };
}
