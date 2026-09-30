import test from 'node:test';
import assert from 'node:assert/strict';
import { DAILY_MOVES, makeRng, todayKey, seedFor, shiftKey, streakAfterFinish, liveStreak } from '../src/game/daily.js';
import { createState, applyMove, N } from '../src/game/board.js';

test('same seed gives the same sequence; different days differ', () => {
  const a = makeRng(seedFor('2026-09-30')), b = makeRng(seedFor('2026-09-30')), c = makeRng(seedFor('2026-10-01'));
  const seqA = Array.from({ length: 8 }, a), seqB = Array.from({ length: 8 }, b), seqC = Array.from({ length: 8 }, c);
  assert.deepEqual(seqA, seqB);
  assert.notDeepEqual(seqA, seqC);
  assert.ok(seqA.every((x) => x >= 0 && x < 1));
});

test('rng state can be saved and resumed mid-sequence', () => {
  const a = makeRng(123);
  [a(), a(), a()];
  const resumed = makeRng(a.getState());
  assert.deepEqual([a(), a(), a()], [resumed(), resumed(), resumed()]);
});

test('the daily board and its first moves are identical for everyone', () => {
  const play = () => {
    const rng = makeRng(seedFor('2026-09-30'));
    const s = createState(rng);
    const start = s.cells.slice();
    // slide the first tile we can into any empty neighbour, deterministically
    for (let step = 0; step < 5; step++) {
      let moved = false;
      for (let i = 0; i < N && !moved; i++) {
        if (!s.cells[i]) continue;
        for (const to of [i + 1, i - 1, i + 5, i - 5]) {
          if (to >= 0 && to < N && applyMove(s, i, to, rng)) { moved = true; break; }
        }
      }
    }
    return { start, end: s.cells.slice(), score: s.score };
  };
  assert.deepEqual(play(), play());
});

test('todayKey is a UTC date and shiftKey moves across month ends', () => {
  assert.equal(todayKey(new Date('2026-09-30T23:59:59Z')), '2026-09-30');
  assert.equal(shiftKey('2026-10-01', -1), '2026-09-30');
  assert.equal(shiftKey('2026-12-31', 1), '2027-01-01');
});

test('streak: extends on consecutive days, resets after a gap, idempotent same day', () => {
  assert.equal(streakAfterFinish(0, null, '2026-09-30'), 1);
  assert.equal(streakAfterFinish(3, '2026-09-29', '2026-09-30'), 4);
  assert.equal(streakAfterFinish(4, '2026-09-30', '2026-09-30'), 4);
  assert.equal(streakAfterFinish(7, '2026-09-20', '2026-09-30'), 1);
  assert.equal(liveStreak(5, '2026-09-30', '2026-09-30'), 5);
  assert.equal(liveStreak(5, '2026-09-29', '2026-09-30'), 5);
  assert.equal(liveStreak(5, '2026-09-27', '2026-09-30'), 0);
  assert.ok(DAILY_MOVES > 0);
});
