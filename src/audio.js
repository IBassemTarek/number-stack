// Tiny WebAudio synth: no audio files shipped.
let ctx = null;
let enabled = true;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

function tone(freq, dur, type = 'sine', gain = 0.12, delay = 0) {
  if (!enabled) return;
  const c = ensure();
  if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const audio = {
  unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); },
  setEnabled(v) { enabled = v; },
  suspend() { ctx?.suspend(); },
  resume() { ctx?.resume(); },
  pick() { tone(520, 0.06, 'triangle', 0.07); },
  drop() { tone(300, 0.08, 'triangle', 0.08); },
  slide() { tone(360, 0.07, 'sine', 0.08); },
  merge(value, combo = 1) {
    const step = Math.min(Math.log2(value) - 1 + (combo - 1) * 2, 20);
    const f = 330 * Math.pow(2, step / 12);
    tone(f, 0.16, 'triangle', 0.14);
    tone(f * 1.5, 0.22, 'sine', 0.08, 0.05);
  },
  over() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.28, 'sawtooth', 0.08, i * 0.16)); },
  best() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'triangle', 0.1, i * 0.09)); },
};

export default audio;
