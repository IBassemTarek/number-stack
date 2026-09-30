import test from 'node:test';
import assert from 'node:assert/strict';
import { SIZE, N, createState, moveKind, applyMove, hasMoves, spawn, restoreState } from '../src/game/board.js';

const empty = () => new Array(N).fill(0);

test('createState places tiles and zero score', () => {
  const s = createState();
  assert.equal(s.cells.filter(Boolean).length, 9);
  assert.equal(s.score, 0);
});

test('moveKind: merge, slide, invalid', () => {
  const c = empty();
  c[0] = 2; c[1] = 2; c[5] = 4;
  assert.equal(moveKind(c, 0, 1), 'merge');
  assert.equal(moveKind(c, 0, 5), null); // different values
  assert.equal(moveKind(c, 1, 2), 'slide');
  assert.equal(moveKind(c, 0, 6), null); // diagonal
  assert.equal(moveKind(c, 4, SIZE), null); // wraps rows, not adjacent
  assert.equal(moveKind(c, 3, 4), null); // source empty
});

test('merge doubles value, scores, and spawns one tile', () => {
  const s = { cells: empty(), score: 0 };
  s.cells[6] = 8; s.cells[7] = 8;
  const r = applyMove(s, 6, 7, () => 0);
  assert.equal(r.kind, 'merge');
  assert.equal(s.cells[7], 16);
  assert.equal(s.cells[6] === 0 || r.spawned.idx === 6, true);
  assert.equal(s.score, 16);
  assert.equal(s.cells.filter(Boolean).length, 2);
});

test('slide moves the tile and spawns one', () => {
  const s = { cells: empty(), score: 0 };
  s.cells[12] = 4;
  applyMove(s, 12, 13, () => 0.99);
  assert.equal(s.cells[13], 4);
  assert.equal(s.cells.filter(Boolean).length, 2);
  assert.equal(s.score, 0);
});

test('hasMoves: full board without pairs is over', () => {
  const c = empty().map((_, i) => ((Math.floor(i / SIZE) + (i % SIZE)) % 2 ? 2 : 4));
  assert.equal(hasMoves(c), false);
  c[0] = c[1];
  assert.equal(hasMoves(c), true);
  assert.equal(hasMoves(empty()), true);
});

test('spawn returns null on a full board', () => {
  assert.equal(spawn(new Array(N).fill(2)), null);
});

test('restoreState accepts a valid save and rejects bad ones', () => {
  const ok = empty(); ok[3] = 8; ok[4] = 2;
  assert.deepEqual(restoreState({ cells: ok, score: 40 }), { cells: ok, score: 40 });
  assert.equal(restoreState({ cells: ok, score: -5 }).score, 0);
  assert.equal(restoreState(null), null);
  assert.equal(restoreState({ cells: [2, 2] }), null);
  assert.equal(restoreState({ cells: empty() }), null); // empty board
  const bad = empty(); bad[0] = 3;
  assert.equal(restoreState({ cells: bad }), null); // not a power of two
  const str = empty(); str[0] = '4';
  assert.equal(restoreState({ cells: str }), null);
});
