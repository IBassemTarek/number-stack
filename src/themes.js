// All visuals are code-drawn; a theme is just data. Palettes are indexed by log2(value) - 1.
export const themes = [
  {
    name: 'Neon Night',
    font: '"Trebuchet MS", Verdana, sans-serif',
    bg: 0x0b0b1a, deco: 0x6a5cff, decoAlpha: 0.10,
    slot: 0x15152b, slotLine: 0x2c2c5a,
    panel: 0x15152b, accent: 0x00e5ff,
    label: '#7d7fb8', text: '#ffffff',
    radius: 26, glow: true, gloss: false, outline: 0,
    palette: [0x00e5ff, 0x00ff9d, 0x9dff00, 0xffe600, 0xff9100, 0xff3d71, 0xff00d4, 0xb14dff, 0x6a5cff, 0x2f8bff, 0xffffff],
    tileText: 0x0b0b1a,
  },
  {
    name: 'Clean Pastel',
    font: '"Trebuchet MS", Verdana, sans-serif',
    bg: 0xfdf6ec, deco: 0xf6c1b2, decoAlpha: 0.35,
    slot: 0xeadfcf, slotLine: 0xdccdb6,
    panel: 0xeadfcf, accent: 0xef7f6a,
    label: '#a08c74', text: '#5b4a3a',
    radius: 24, glow: false, gloss: false, outline: 0,
    palette: [0xbfe3f0, 0xc7ebc9, 0xf3e6a0, 0xf8cf9c, 0xf6b3a3, 0xf2a3c0, 0xd6b3ee, 0xb2b9f0, 0x9fd3d6, 0xa7dcb0, 0xf0c36b],
    tileText: 0x5b4a3a,
  },
  {
    name: 'Candy',
    font: '"Arial Rounded MT Bold", "Trebuchet MS", Verdana, sans-serif',
    bg: 0x2d1b4e, deco: 0xff5fa2, decoAlpha: 0.16,
    slot: 0x3f2a6b, slotLine: 0x57408f,
    panel: 0x3f2a6b, accent: 0xffd23f,
    label: '#b9a3ee', text: '#ffffff',
    radius: 38, glow: false, gloss: true, outline: 0,
    palette: [0x4dd0ff, 0x3ddc84, 0xb6e63c, 0xffd23f, 0xff9f43, 0xff5f6d, 0xff5fa2, 0xc26bff, 0x7f6bff, 0x33c4b3, 0xffffff],
    tileText: 0xffffff,
  },
  {
    name: 'Retro Pixel',
    font: '"Courier New", Courier, monospace',
    bg: 0x1a1c2c, deco: 0x000000, decoAlpha: 0,
    slot: 0x333c57, slotLine: 0x000000,
    panel: 0x333c57, accent: 0xffcd75,
    label: '#94b0c2', text: '#f4f4f4',
    radius: 6, glow: false, gloss: false, outline: 0x000000,
    palette: [0x41a6f6, 0x38b764, 0xa7f070, 0xffcd75, 0xef7d57, 0xb13e53, 0x5d275d, 0x73eff7, 0x3b5dc9, 0x566c86, 0xf4f4f4],
    tileText: 0x1a1c2c,
  },
];

export const tileColor = (theme, value) =>
  theme.palette[Math.min(Math.max(Math.log2(value) - 1, 0), theme.palette.length - 1)];

export function fontSizeFor(value) {
  const d = String(value).length;
  return d <= 2 ? 58 : d === 3 ? 48 : d === 4 ? 38 : 30;
}

export function drawTile(g, size, value, theme) {
  const c = tileColor(theme, value);
  const h = size / 2;
  const r = theme.radius;
  g.clear();
  if (theme.glow) {
    for (let i = 4; i >= 1; i--) {
      g.lineStyle(i * 5, c, 0.10);
      g.strokeRoundedRect(-h, -h, size, size, r);
    }
  }
  g.fillStyle(c, 1).fillRoundedRect(-h, -h, size, size, r);
  if (theme.gloss) {
    g.fillStyle(0xffffff, 0.28).fillRoundedRect(-h + 8, -h + 8, size - 16, size * 0.38, r * 0.7);
    g.fillStyle(0x000000, 0.14).fillRoundedRect(-h + 6, h - 20, size - 12, 14, 7);
  }
  if (theme.outline !== 0 || theme.name === 'Retro Pixel') {
    g.lineStyle(5, theme.outline, 1).strokeRoundedRect(-h, -h, size, size, r);
    g.fillStyle(0xffffff, 0.25).fillRect(-h + 6, -h + 6, size - 12, 8);
  }
}
