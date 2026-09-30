import Phaser from 'phaser';
import { SIZE, N, createState, moveKind, applyMove, restoreState } from '../game/board.js';
import { themes, drawTile, tileColor, tileTextColor, fontSizeFor } from '../themes.js';
import platform from '../platform.js';
import audio from '../audio.js';

const W = 720;
const H = 1280;
const CELL = 128;
const GAP = 12;
const BOARD = SIZE * CELL + (SIZE - 1) * GAP;
const BX = (W - BOARD) / 2;
const BY = 330;
const TEXT_RES = 2;

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  preload() {
    this.load.image('logo', 'logo.png');
  }

  create() {
    const saved = platform.data;
    this.themeIndex = Number.isInteger(saved.theme) ? saved.theme % themes.length : 0;
    this.best = saved.best || 0;
    this.state = restoreState(saved) || createState();
    this.startBest = this.best;
    this.tiles = new Array(N).fill(null);
    this.busy = false;
    this.over = false;
    this.modal = false;
    this.drag = null;
    this.combo = 0;
    this.confirmTimer = null;
    this.reduceMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    this.bgLayer = this.add.graphics().setDepth(0);
    this.slotLayer = this.add.graphics().setDepth(1);
    this.hlLayer = this.add.graphics().setDepth(2);
    this.shadow = this.add.graphics().setDepth(9).setVisible(false);
    this.uiLayer = this.add.graphics().setDepth(1);

    this.buildUI();
    this.applyTheme();
    this.syncTiles();

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);

    audio.setEnabled(platform.isAudioEnabled());
    platform.onAudioChange((on) => audio.setEnabled(on));
    platform.onPause(() => this.setPaused(true));
    platform.onResume(() => this.setPaused(false));
    this.input.keyboard.on('keydown-ESC', () => this.onEscape());

    // The scene is fully built here, so signal readiness now rather than waiting on a rendered frame
    // (offscreen or throttled frames would otherwise delay gameReady).
    platform.firstFrameReady();
    platform.gameReady();
    // The best score sent must match the best score in the save.
    if (this.best > 0) platform.sendScore(this.best);
    if (!saved.tutorialDone) this.showTutorial();
  }

  // ---------- layout helpers ----------
  cellPos(i) {
    return { x: BX + (i % SIZE) * (CELL + GAP) + CELL / 2, y: BY + Math.floor(i / SIZE) * (CELL + GAP) + CELL / 2 };
  }

  cellAt(x, y) {
    const c = Math.floor((x - BX) / (CELL + GAP));
    const r = Math.floor((y - BY) / (CELL + GAP));
    if (c < 0 || r < 0 || c >= SIZE || r >= SIZE) return -1;
    return r * SIZE + c;
  }

  get theme() { return themes[this.themeIndex]; }

  txt(x, y, s, size, extra = {}) {
    return this.add.text(x, y, s, { fontSize: `${size}px`, fontStyle: 'bold', resolution: TEXT_RES, ...extra });
  }

  // ---------- static UI ----------
  buildUI() {
    this.logo = this.add.image(40, 26, 'logo').setOrigin(0, 0).setDisplaySize(72, 72).setDepth(3);
    this.title = this.txt(126, 46, 'NUMBER STACK', 32).setDepth(3);
    this.scoreLabel = this.txt(40, 110, 'SCORE', 24).setDepth(3);
    this.scoreText = this.txt(40, 140, '0', 72).setDepth(3);
    this.bestLabel = this.txt(400, 110, 'BEST', 24).setDepth(3);
    this.bestText = this.txt(400, 140, '0', 72).setDepth(3);

    this.themeBtn = this.txt(W - 60, 70, '◐', 64).setOrigin(0.5).setDepth(3).setInteractive({ useHandCursor: true });
    this.themeBtn.on('pointerdown', (p, lx, ly, e) => { e?.stopPropagation?.(); this.cycleTheme(); });
    this.themeName = this.txt(W - 30, 132, '', 20).setOrigin(1, 0).setDepth(3);

    this.hint = this.txt(W / 2, BY + BOARD + 44, 'Drag a tile onto an equal neighbour to merge', 28, { align: 'center', wordWrap: { width: W - 60 } }).setOrigin(0.5, 0).setDepth(3);
    this.hint2 = this.txt(W / 2, BY + BOARD + 88, 'Sliding into empty space adds a tile', 22).setOrigin(0.5, 0).setDepth(3);

    this.restartBtn = this.txt(W / 2, H - 100, '↻  NEW GAME', 34).setOrigin(0.5).setDepth(3).setInteractive({ useHandCursor: true });
    this.restartBtn.on('pointerdown', () => this.onRestartTap());

    this.updateScore(false);
  }

  applyTheme() {
    const t = this.theme;
    this.cameras.main.setBackgroundColor(hex(t.bg));
    document.body.style.background = hex(t.bg);

    this.bgLayer.clear();
    if (t.decoAlpha > 0) {
      this.bgLayer.fillStyle(t.deco, t.decoAlpha).fillCircle(90, 1150, 260).fillCircle(660, 1000, 180).fillCircle(620, 40, 220);
    } else {
      // Retro: faint scanline stripes.
      this.bgLayer.fillStyle(0xffffff, 0.03);
      for (let y = 0; y < H; y += 8) this.bgLayer.fillRect(0, y, W, 4);
    }

    this.slotLayer.clear();
    this.slotLayer.fillStyle(t.panel, 1).fillRoundedRect(BX - 14, BY - 14, BOARD + 28, BOARD + 28, t.radius + 8);
    for (let i = 0; i < N; i++) {
      const { x, y } = this.cellPos(i);
      this.slotLayer.fillStyle(t.slot, 1).fillRoundedRect(x - CELL / 2, y - CELL / 2, CELL, CELL, t.radius);
      this.slotLayer.lineStyle(3, t.slotLine, 1).strokeRoundedRect(x - CELL / 2, y - CELL / 2, CELL, CELL, t.radius);
    }

    const font = { fontFamily: t.font };
    this.title.setStyle({ ...font, color: hex(t.accent) });
    [this.scoreLabel, this.bestLabel, this.themeName, this.hint2].forEach((o) => o.setColor(t.label).setFontFamily(t.font));
    [this.scoreText, this.bestText, this.hint].forEach((o) => o.setColor(t.text).setFontFamily(t.font));
    this.hint.setColor(t.label);
    this.hint2.setY(this.hint.y + this.hint.height + 10);
    this.themeBtn.setColor(hex(t.accent));
    this.themeName.setText(t.name.toUpperCase());
    this.restartBtn.setColor(hex(t.accent)).setFontFamily(t.font);

    this.tiles.forEach((n) => n && this.paint(n, n.value));
  }

  cycleTheme() {
    this.themeIndex = (this.themeIndex + 1) % themes.length;
    this.applyTheme();
    platform.save({ theme: this.themeIndex });
    audio.unlock();
    audio.pick();
    this.tweens.add({ targets: this.themeBtn, angle: this.themeBtn.angle + 180, duration: 260, ease: 'Back.easeOut' });
  }

  updateScore(bump = true) {
    this.scoreText.setText(String(this.state.score));
    if (this.state.score > this.best) this.best = this.state.score;
    this.bestText.setText(String(this.best));
    if (bump) {
      this.tweens.add({ targets: this.scoreText, scale: { from: 1.18, to: 1 }, duration: 180, ease: 'Sine.easeOut' });
    }
  }

  // ---------- tiles ----------
  paint(node, value) {
    const t = this.theme;
    drawTile(node.getAt(0), CELL, value, t);
    node.getAt(1)
      .setText(String(value))
      .setFontFamily(t.font)
      .setFontSize(fontSizeFor(value))
      .setColor(hex(tileTextColor(t, value)));
    node.value = value;
  }

  buildTile(x, y, value) {
    const g = this.add.graphics();
    const label = this.txt(0, 0, '', 58, { align: 'center' }).setOrigin(0.5);
    const node = this.add.container(x, y, [g, label]).setDepth(5);
    this.paint(node, value);
    return node;
  }

  makeTile(idx, value) {
    const { x, y } = this.cellPos(idx);
    const node = this.buildTile(x, y, value);
    this.tiles[idx] = node;
    return node;
  }

  syncTiles() {
    this.tiles.forEach((n) => n && n.destroy());
    this.tiles.fill(null);
    this.state.cells.forEach((v, i) => v && this.makeTile(i, v));
  }

  // ---------- input ----------
  onDown(p) {
    audio.unlock();
    if (this.busy || this.over || this.modal) return;
    const i = this.cellAt(p.x, p.y);
    const node = i >= 0 ? this.tiles[i] : null;
    if (!node) return;
    this.drag = { idx: i, node, ox: p.x - node.x, oy: p.y - node.y };
    node.setDepth(10);
    this.tweens.add({ targets: node, scale: 1.12, duration: 90, ease: 'Sine.easeOut' });
    this.shadow.clear().fillStyle(0x000000, 0.35).fillRoundedRect(-CELL / 2, -CELL / 2, CELL, CELL, this.theme.radius)
      .setPosition(node.x + 8, node.y + 14).setVisible(true);
    this.showTargets(i);
    audio.pick();
  }

  onMove(p) {
    if (!this.drag) return;
    const { node, ox, oy } = this.drag;
    node.setPosition(p.x - ox, p.y - oy);
    this.shadow.setPosition(node.x + 8, node.y + 14);
  }

  onUp(p) {
    if (!this.drag) return;
    const { idx, node } = this.drag;
    this.drag = null;
    this.hlLayer.clear();
    this.shadow.setVisible(false);
    // Use the dragged tile's centre so a slightly-off finger still lands where the tile visually is.
    const to = this.cellAt(node.x, node.y);
    const target = to >= 0 && moveKind(this.state.cells, idx, to) ? to : this.cellAt(p.x, p.y);
    if (target >= 0 && moveKind(this.state.cells, idx, target)) this.doMove(idx, target);
    else this.snapBack(idx, node);
  }

  showTargets(from) {
    const t = this.theme;
    this.hlLayer.clear();
    for (let to = 0; to < N; to++) {
      const kind = moveKind(this.state.cells, from, to);
      if (!kind) continue;
      const { x, y } = this.cellPos(to);
      const merge = kind === 'merge';
      this.hlLayer.lineStyle(merge ? 7 : 4, t.accent, merge ? 0.95 : 0.4);
      this.hlLayer.strokeRoundedRect(x - CELL / 2 - 2, y - CELL / 2 - 2, CELL + 4, CELL + 4, t.radius + 2);
    }
  }

  snapBack(idx, node) {
    const { x, y } = this.cellPos(idx);
    this.tweens.add({
      targets: node, x, y, scale: 1, duration: 200, ease: 'Back.easeOut',
      onComplete: () => node.setDepth(5),
    });
    audio.drop();
  }

  cancelDrag() {
    if (!this.drag) return;
    const { idx, node } = this.drag;
    this.drag = null;
    this.hlLayer.clear();
    this.shadow.setVisible(false);
    const { x, y } = this.cellPos(idx);
    this.tweens.killTweensOf(node);
    node.setPosition(x, y).setScale(1).setDepth(5);
  }

  // SDK pause: stop the whole loop (updates, tweens, rendering) and audio until onResume.
  setPaused(paused) {
    if (paused) {
      this.cancelDrag();
      this.saveProgress(this.over);
      audio.suspend();
      this.game.loop.sleep();
    } else {
      this.game.loop.wake();
      audio.resume();
    }
  }

  // ---------- moves ----------
  doMove(from, to) {
    this.busy = true;
    const node = this.tiles[from];
    const prevBest = this.best;
    const res = applyMove(this.state, from, to);
    const { x, y } = this.cellPos(to);
    this.tiles[from] = null;

    this.tweens.add({
      targets: node, x, y, scale: 1, duration: 100, ease: 'Sine.easeOut',
      onComplete: () => {
        if (res.kind === 'merge') this.onMerge(node, to, res, prevBest);
        else this.onSlide(node, to);
        if (res.spawned) this.spawnTile(res.spawned);
        this.saveProgress(res.gameOver);
        if (res.gameOver) this.time.delayedCall(550, () => this.showGameOver());
        else this.busy = false;
      },
    });
  }

  onSlide(node, to) {
    node.setDepth(5);
    this.tiles[to] = node;
    this.combo = 0;
    audio.slide();
  }

  onMerge(node, to, res, prevBest) {
    node.destroy();
    this.combo += 1;
    const target = this.tiles[to];
    this.paint(target, res.value);
    const { x, y } = this.cellPos(to);
    if (!this.reduceMotion) {
      this.tweens.add({ targets: target, scaleX: { from: 1.35, to: 1 }, scaleY: { from: 0.75, to: 1 }, duration: 320, ease: 'Elastic.easeOut' });
      this.burst(x, y, tileColor(this.theme, res.value), 10 + Math.min(res.value / 16, 14));
    }
    this.floatText(x, y - 40, `+${res.value}`, this.combo);
    if (res.value >= 128 && !this.reduceMotion) this.cameras.main.shake(140, Math.min(0.003 + res.value / 100000, 0.012));
    audio.merge(res.value, this.combo);
    this.updateScore(true);
    platform.sendScore(this.state.score);
    if (prevBest > 0 && prevBest < this.best && !this.announcedBest) {
      this.announcedBest = true;
      this.floatText(W / 2, BY - 40, 'NEW BEST!', 1, 56);
      audio.best();
    }
  }

  spawnTile({ idx, value }) {
    const node = this.makeTile(idx, value);
    node.setScale(0);
    this.tweens.add({ targets: node, scale: 1, duration: 260, delay: 60, ease: 'Back.easeOut' });
  }

  burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 60 + Math.random() * 90;
      const pool = [color, ...(this.theme.sparks || [])];
      const dot = this.add.circle(x, y, 5 + Math.random() * 7, pool[Math.floor(Math.random() * pool.length)], 1).setDepth(20);
      this.tweens.add({
        targets: dot, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, scale: 0.2,
        duration: 380 + Math.random() * 220, ease: 'Cubic.easeOut', onComplete: () => dot.destroy(),
      });
    }
  }

  floatText(x, y, s, combo, size = 44) {
    const label = combo >= 2 && size === 44 ? `${s}  x${combo}` : s;
    const t = this.txt(x, y, label, size, { fontFamily: this.theme.font, color: hex(this.theme.accent), stroke: '#000000', strokeThickness: 6 })
      .setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: t, y: y - 90, alpha: 0, duration: 800, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  // ---------- game flow ----------
  saveProgress(gameOver) {
    platform.save(gameOver
      ? { best: this.best, cells: null, score: 0 }
      : { best: this.best, cells: this.state.cells, score: this.state.score });
  }

  showGameOver() {
    this.over = true;
    audio.over();
    platform.sendScore(this.state.score);
    const t = this.theme;
    const c = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.72).setInteractive();
    const card = this.add.graphics();
    card.fillStyle(t.panel, 1).fillRoundedRect(80, 400, W - 160, 440, t.radius + 10);
    card.lineStyle(5, t.accent, 1).strokeRoundedRect(80, 400, W - 160, 440, t.radius + 10);
    const record = this.state.score > 0 && this.state.score > this.startBest;
    const title = this.txt(W / 2, 450, record ? 'NEW BEST!' : 'NO MOVES LEFT', 50, { fontFamily: t.font, color: hex(t.accent) }).setOrigin(0.5, 0);
    const score = this.txt(W / 2, 540, String(this.state.score), 110, { fontFamily: t.font, color: t.text }).setOrigin(0.5, 0);
    const best = this.txt(W / 2, 670, `BEST  ${this.best}`, 34, { fontFamily: t.font, color: t.label }).setOrigin(0.5, 0);
    const btn = this.add.graphics();
    btn.fillStyle(t.accent, 1).fillRoundedRect(180, 730, W - 360, 80, 40);
    const btnText = this.txt(W / 2, 770, 'PLAY AGAIN', 36, { fontFamily: t.font, color: hex(t.bg) }).setOrigin(0.5);
    const hit = this.add.rectangle(W / 2, 770, W - 360, 80, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.newGame());
    c.add([dim, card, title, score, best, btn, btnText, hit]);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 250 });
    this.overlay = c;
  }

  onEscape() {
    if (this.tutorial) this.closeTutorial();
    else if (this.overlay) this.newGame();
  }

  // Wiping a run needs a deliberate second tap so a stray touch can't lose progress.
  onRestartTap() {
    if (this.busy || this.modal) return;
    if (!this.confirmTimer) {
      this.restartBtn.setText('TAP AGAIN TO CONFIRM');
      this.confirmTimer = this.time.delayedCall(2500, () => this.resetRestartBtn());
      return;
    }
    this.resetRestartBtn();
    this.newGame();
  }

  resetRestartBtn() {
    this.confirmTimer?.remove(false);
    this.confirmTimer = null;
    this.restartBtn.setText('↻  NEW GAME');
  }

  // First-run demo: a finger drags one 2 onto another and they become a 4.
  showTutorial() {
    const t = this.theme;
    this.modal = true;
    const c = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.8).setInteractive();
    const title = this.txt(W / 2, 330, 'HOW TO PLAY', 56, { fontFamily: t.font, color: hex(t.accent) }).setOrigin(0.5);
    const line1 = this.txt(W / 2, 780, 'Drag a tile onto an equal\nneighbour to merge them', 38, { fontFamily: t.font, color: '#ffffff', align: 'center' }).setOrigin(0.5);
    const line2 = this.txt(W / 2, 890, 'Slide into empty cells to make room.\nThe game ends when the board is full.', 26, { fontFamily: t.font, color: '#c9c9d6', align: 'center' }).setOrigin(0.5);
    const go = this.txt(W / 2, 1040, 'TAP TO PLAY', 44, { fontFamily: t.font, color: hex(t.accent) }).setOrigin(0.5);
    this.tweens.add({ targets: go, alpha: 0.45, duration: 700, yoyo: true, repeat: -1 });

    const ax = W / 2 - 110;
    const bx = W / 2 + 110;
    const y = 580;
    const a = this.buildTile(ax, y, 2);
    const b = this.buildTile(bx, y, 2);
    const finger = this.add.circle(ax, y + 20, 30, 0xffffff, 0.9).setStrokeStyle(6, t.accent).setAlpha(0);
    c.add([dim, title, line1, line2, go, b, a, finger]);

    const cycle = () => {
      this.paint(b, 2);
      a.setPosition(ax, y).setAlpha(1).setScale(1);
      b.setScale(1);
      finger.setPosition(ax, y + 20).setAlpha(0);
      this.tweens.add({
        targets: finger, alpha: 1, duration: 250,
        onComplete: () => {
          this.tweens.add({ targets: [a, finger], x: bx, duration: 650, ease: 'Sine.easeInOut', delay: 150,
            onComplete: () => {
              a.setAlpha(0);
              this.paint(b, 4);
              this.tweens.add({ targets: b, scale: { from: 1.3, to: 1 }, duration: 300, ease: 'Back.easeOut' });
              this.tweens.add({ targets: finger, alpha: 0, duration: 250 });
            } });
        },
      });
    };
    cycle();
    this.tutorialLoop = this.time.addEvent({ delay: 2800, loop: true, callback: cycle });

    dim.on('pointerdown', () => this.closeTutorial());
    this.tutorial = c;
  }

  closeTutorial() {
    if (!this.tutorial) return;
    this.tutorialLoop?.remove(false);
    this.tutorial.destroy();
    this.tutorial = null;
    platform.save({ tutorialDone: true });
    audio.unlock();
    // Delay so the tap that dismissed the tutorial isn't also read as a drag start.
    this.time.delayedCall(80, () => { this.modal = false; });
  }

  newGame() {
    this.overlay?.destroy();
    this.overlay = null;
    this.startBest = this.best;
    this.state = createState();
    this.over = false;
    this.busy = false;
    this.combo = 0;
    this.announcedBest = false;
    this.syncTiles();
    this.tiles.forEach((n, i) => {
      if (!n) return;
      n.setScale(0);
      this.tweens.add({ targets: n, scale: 1, duration: 260, delay: i * 12, ease: 'Back.easeOut' });
    });
    this.updateScore(false);
    this.saveProgress(false);
  }
}
