// Daily challenge helpers. No backend: everyone gets the same board because it is seeded from the UTC date.
export const DAILY_MOVES = 40;

// Small seeded PRNG (mulberry32). getState/seed let a half-finished daily run resume with the same tile sequence.
export function makeRng(seed) {
  let a = seed >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.getState = () => a;
  return rng;
}

export const todayKey = (date = new Date()) => date.toISOString().slice(0, 10);

export function seedFor(key) {
  let h = 2166136261;
  for (const ch of `number-stack:${key}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function shiftKey(key, days) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Streak after finishing today's run: same day changes nothing, the next day extends it, a gap resets it.
export function streakAfterFinish(streak, lastDone, today) {
  if (lastDone === today) return streak || 1;
  if (lastDone === shiftKey(today, -1)) return (streak || 0) + 1;
  return 1;
}

// The streak worth showing right now (a missed day means it has already lapsed).
export function liveStreak(streak, lastDone, today) {
  return lastDone === today || lastDone === shiftKey(today, -1) ? streak || 0 : 0;
}
