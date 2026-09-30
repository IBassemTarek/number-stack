// Pure game logic: no Phaser, no DOM. Cells are indexed row * SIZE + col; 0 = empty.
export const SIZE = 5;
export const N = SIZE * SIZE;

export function createState(rng = Math.random) {
  const state = { cells: new Array(N).fill(0), score: 0 };
  for (let i = 0; i < 9; i++) spawn(state.cells, rng);
  return state;
}

export function areAdjacent(a, b) {
  const ar = Math.floor(a / SIZE), ac = a % SIZE;
  const br = Math.floor(b / SIZE), bc = b % SIZE;
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
}

// 'merge' onto an equal neighbour, 'slide' into an empty neighbour, otherwise null.
export function moveKind(cells, from, to) {
  if (from < 0 || to < 0 || from >= N || to >= N || from === to) return null;
  if (!cells[from] || !areAdjacent(from, to)) return null;
  if (cells[to] === 0) return 'slide';
  if (cells[to] === cells[from]) return 'merge';
  return null;
}

export function spawnValue(cells, rng = Math.random) {
  const max = Math.max(...cells);
  const r = rng();
  if (max >= 64 && r > 0.9) return 8;
  return r < 0.65 ? 2 : 4;
}

export function spawn(cells, rng = Math.random) {
  const empties = [];
  for (let i = 0; i < N; i++) if (cells[i] === 0) empties.push(i);
  if (!empties.length) return null;
  const idx = empties[Math.floor(rng() * empties.length)];
  const value = spawnValue(cells, rng);
  cells[idx] = value;
  return { idx, value };
}

// While an empty cell exists some tile can always slide, so play only ends on a full board with no pairs.
export function hasMoves(cells) {
  if (cells.includes(0)) return true;
  for (let i = 0; i < N; i++) {
    if (i % SIZE < SIZE - 1 && cells[i] === cells[i + 1]) return true;
    if (i + SIZE < N && cells[i] === cells[i + SIZE]) return true;
  }
  return false;
}

// Merges cost nothing (two tiles become one, one spawns); slides add a tile, so the board slowly fills.
export function applyMove(state, from, to, rng = Math.random) {
  const kind = moveKind(state.cells, from, to);
  if (!kind) return null;
  const { cells } = state;
  let value;
  if (kind === 'merge') {
    value = cells[to] * 2;
    cells[to] = value;
    state.score += value;
  } else {
    value = cells[from];
    cells[to] = value;
  }
  cells[from] = 0;
  const spawned = spawn(cells, rng);
  return { kind, from, to, value, spawned, gameOver: !hasMoves(cells) };
}
