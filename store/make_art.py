"""Generates Playables store art (thumbnails) in the game's Neon Night look.
No logos, no branding text: only number tiles, per the Playables design requirements.
Run: python3 store/make_art.py
"""
import math
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FONT = '/System/Library/Fonts/Supplemental/Trebuchet MS Bold.ttf'
SS = 2  # supersampling factor

# Palette matched to the logo: deep navy, glossy jelly tiles, warm sparks (same values as src/themes.js).
BG_TOP, BG_BOT = (5, 9, 44), (13, 21, 88)
DECO = (42, 58, 255)
SLOT, SLOT_LINE, PANEL = (15, 21, 83), (39, 48, 143), (11, 16, 71)
ACCENT = (47, 244, 255)
DARK = (6, 16, 67)
PINK = (253, 40, 141)
WARM = [(255, 213, 74), (255, 244, 196)]
PALETTE = [(31, 216, 255), (146, 230, 4), (255, 210, 31), (255, 138, 31), (253, 40, 141),
           (210, 60, 255), (169, 139, 255), (61, 123, 255), (0, 224, 184), (255, 255, 255), (255, 213, 74)]


def color_for(v):
    return PALETTE[min(max(int(math.log2(v)) - 1, 0), len(PALETTE) - 1)]


def gradient(w, h):
    img = Image.new('RGB', (w, h))
    px = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(h - 1, 1)
        px.line([(0, y), (w, y)], fill=tuple(int(BG_TOP[i] + (BG_BOT[i] - BG_TOP[i]) * t) for i in range(3)))
    return img.convert('RGBA')


def glow_blob(canvas, cx, cy, r, color, alpha):
    layer = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (alpha,))
    layer = layer.filter(ImageFilter.GaussianBlur(r * 0.45))
    canvas.alpha_composite(layer)


def rrect_layer(size, box, radius, fill=None, outline=None, width=0):
    layer = Image.new('RGBA', size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)
    return layer


def draw_tile(canvas, cx, cy, size, value, scale=1.0, glow=1.0, shadow=False):
    s = size * scale
    x0, y0, x1, y1 = cx - s / 2, cy - s / 2, cx + s / 2, cy + s / 2
    r = s * 0.2
    col = color_for(value)
    if shadow:
        sh = rrect_layer(canvas.size, [x0 + s * 0.07, y0 + s * 0.12, x1 + s * 0.07, y1 + s * 0.12], r, fill=(0, 0, 0, 120))
        canvas.alpha_composite(sh.filter(ImageFilter.GaussianBlur(s * 0.06)))
    if glow > 0:
        g = rrect_layer(canvas.size, [x0 - s * 0.04, y0 - s * 0.04, x1 + s * 0.04, y1 + s * 0.04], r * 1.1, fill=col + (int(150 * glow),))
        canvas.alpha_composite(g.filter(ImageFilter.GaussianBlur(s * 0.16)))
    canvas.alpha_composite(rrect_layer(canvas.size, [x0, y0, x1, y1], r, fill=col + (255,)))
    # jelly finish: darker bottom lip, soft sheen, specular highlights, light inner rim
    canvas.alpha_composite(rrect_layer(canvas.size, [x0 + s * 0.06, y1 - s * 0.19, x1 - s * 0.06, y1 - s * 0.05], s * 0.06, fill=(0, 0, 0, 36)))
    canvas.alpha_composite(rrect_layer(canvas.size, [x0 + s * 0.06, y0 + s * 0.06, x1 - s * 0.06, y0 + s * 0.46], r * 0.85, fill=(255, 255, 255, 52)))
    hl = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    hd = ImageDraw.Draw(hl)
    hd.ellipse([x0 + s * 0.17, y0 + s * 0.135, x0 + s * 0.37, y0 + s * 0.215], fill=(255, 255, 255, 170))
    hd.ellipse([x0 + s * 0.425, y0 + s * 0.145, x0 + s * 0.47, y0 + s * 0.19], fill=(255, 255, 255, 170))
    canvas.alpha_composite(hl)
    canvas.alpha_composite(rrect_layer(canvas.size, [x0 + s * 0.02, y0 + s * 0.02, x1 - s * 0.02, y1 - s * 0.02], r * 0.93, outline=(255, 255, 255, 80), width=max(2, int(s * 0.02))))
    label = str(value)
    fsize = s * (0.5 if len(label) <= 2 else 0.4 if len(label) == 3 else 0.32)
    font = ImageFont.truetype(FONT, int(fsize))
    ImageDraw.Draw(canvas).text((cx, cy + s * 0.02), label, font=font, fill=DARK + (255,), anchor='mm')


def draw_slots(canvas, x0, y0, cell, gap, rows=5, cols=5):
    pad = cell * 0.11
    bw = cols * cell + (cols - 1) * gap
    bh = rows * cell + (rows - 1) * gap
    canvas.alpha_composite(rrect_layer(canvas.size, [x0 - pad, y0 - pad, x0 + bw + pad, y0 + bh + pad], cell * 0.3, fill=PANEL + (255,)))
    for r in range(rows):
        for c in range(cols):
            bx, by = x0 + c * (cell + gap), y0 + r * (cell + gap)
            canvas.alpha_composite(rrect_layer(canvas.size, [bx, by, bx + cell, by + cell], cell * 0.2, fill=SLOT + (255,), outline=SLOT_LINE + (255,), width=max(2, int(cell * 0.025))))


def cell_center(x0, y0, cell, gap, r, c):
    return x0 + c * (cell + gap) + cell / 2, y0 + r * (cell + gap) + cell / 2


BOARD = [
    [2, 4, 8, 0, 0],
    [0, 16, 4, 2, 0],
    [32, 8, 0, 64, 0],
    [4, 0, 16, 64, 2],
    [2, 0, 4, 8, 0],
]
DRAG_FROM, DRAG_TO = (2, 3), (3, 3)


def sparks(canvas, cx, cy, radius, n, seed):
    rnd = random.Random(seed)
    for _ in range(n):
        a = rnd.random() * math.tau
        d = radius * (0.5 + rnd.random())
        r = radius * (0.03 + rnd.random() * 0.05)
        col = rnd.choice(WARM + WARM + [PINK, ACCENT])
        px, py = cx + math.cos(a) * d, cy + math.sin(a) * d
        layer = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).ellipse([px - r, py - r, px + r, py + r], fill=col + (230,))
        canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(r * 0.35)))


def draw_board(canvas, x0, y0, cell, gap, hero=True):
    draw_slots(canvas, x0, y0, cell, gap)
    for r in range(5):
        for c in range(5):
            v = BOARD[r][c]
            if not v or (r, c) == DRAG_FROM:
                continue
            cx, cy = cell_center(x0, y0, cell, gap, r, c)
            draw_tile(canvas, cx, cy, cell, v, glow=0.7)
    if hero:
        tx, ty = cell_center(x0, y0, cell, gap, *DRAG_TO)
        # merge target highlight
        canvas.alpha_composite(rrect_layer(canvas.size, [tx - cell / 2 - 6, ty - cell / 2 - 6, tx + cell / 2 + 6, ty + cell / 2 + 6], cell * 0.24, outline=ACCENT + (255,), width=max(5, int(cell * 0.05))))
        fx, fy = cell_center(x0, y0, cell, gap, *DRAG_FROM)
        px, py = fx + (tx - fx) * 0.5, fy + (ty - fy) * 0.5
        draw_tile(canvas, px, py, cell, 64, scale=1.14, glow=1.0, shadow=True)
        sparks(canvas, tx, ty, cell * 0.95, 16, 7)


def base(w, h):
    canvas = gradient(w, h)
    glow_blob(canvas, w * 0.12, h * 0.92, min(w, h) * 0.45, DECO, 70)
    glow_blob(canvas, w * 0.9, h * 0.1, min(w, h) * 0.4, PINK, 40)
    glow_blob(canvas, w * 0.85, h * 0.75, min(w, h) * 0.3, ACCENT, 26)
    return canvas


def finish(canvas, w, h, path):
    out = canvas.resize((w, h), Image.LANCZOS).convert('RGB')
    out.save(path, 'PNG', optimize=True)
    print('wrote', path, out.size)


def thumb_square(w=1440, h=1440):
    W, H = w * SS, h * SS
    c = base(W, H)
    cell = int(W * 0.155)
    gap = int(cell * 0.09)
    bw = 5 * cell + 4 * gap
    draw_board(c, (W - bw) / 2, (H - bw) / 2, cell, gap)
    finish(c, w, h, 'store/thumbnails/thumb_1x1_1440x1440.png')


def thumb_portrait(w=1250, h=1750):
    W, H = w * SS, h * SS
    c = base(W, H)
    cell = int(W * 0.15)
    gap = int(cell * 0.09)
    bw = 5 * cell + 4 * gap
    # progression row above the board
    vals = [2, 4, 8, 16, 32]
    t = int(W * 0.13)
    step = t * 1.42
    x = W / 2 - step * (len(vals) - 1) / 2
    y = H * 0.17
    for i, v in enumerate(vals):
        draw_tile(c, x + i * step, y, t, v, scale=1 + i * 0.05, glow=0.9)
    draw_board(c, (W - bw) / 2, H * 0.34, cell, gap)
    finish(c, w, h, 'store/thumbnails/thumb_5x7_1250x1750.png')


def thumb_wide(w=1920, h=1080):
    W, H = w * SS, h * SS
    c = base(W, H)
    # right: board, kept fully inside the frame
    cell = int(H * 0.125)
    gap = int(cell * 0.09)
    bw = 5 * cell + 4 * gap
    draw_board(c, W - bw - W * 0.05, (H - bw) / 2, cell, gap)
    # left: 32 + 32 -> 64, the core mechanic at a glance
    cy = H * 0.5
    t32, gap32, t64 = int(H * 0.19), int(H * 0.014), int(H * 0.26)
    x = W * 0.03
    glow_blob(c, x + t32 + gap32 / 2, cy, t32 * 1.1, color_for(32), 40)
    draw_tile(c, x + t32 / 2, cy, t32, 32, glow=0.9)
    draw_tile(c, x + t32 * 1.5 + gap32, cy, t32, 32, glow=0.9)
    ax = x + t32 * 2 + gap32 + H * 0.045
    aw, ah = H * 0.07, H * 0.08
    ImageDraw.Draw(c).polygon([(ax, cy - ah / 2), (ax + aw, cy), (ax, cy + ah / 2), (ax + aw * 0.3, cy)], fill=ACCENT + (255,))
    bx = ax + aw + H * 0.045 + t64 / 2
    glow_blob(c, bx, cy, t64 * 1.2, color_for(64), 60)
    draw_tile(c, bx, cy, t64, 64, glow=1.0)
    sparks(c, bx, cy, t64 * 0.75, 14, 3)
    finish(c, w, h, 'store/thumbnails/thumb_16x9_1920x1080.png')


if __name__ == '__main__':
    thumb_square()
    thumb_portrait()
    thumb_wide()
