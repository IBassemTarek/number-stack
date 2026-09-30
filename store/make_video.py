"""Renders the Playables preview video (16:9, no audio) from a scripted game, in the Neon Night look.
The script plays by the real rules (merge equal neighbours, or slide into empty cells) and asserts every move.
No logos or branding text: only tiles and a score number.
Run: python3 store/make_video.py   (needs ffmpeg)
"""
import math
import random
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, str(Path(__file__).parent))
import make_art as art  # noqa: E402

W, H, FPS = 1920, 1080, 30
CELL, GAP = 165, 15
SIZE = 5
BW = SIZE * CELL + (SIZE - 1) * GAP
X0, Y0 = (W - BW) / 2 + 120, (H - BW) / 2
FONT = art.FONT

# ---- script: initial board (0 = empty) and moves, with the tile that spawns after each move ----
START = [
    [2, 2, 4, 0, 0],
    [0, 8, 0, 0, 4],
    [16, 8, 0, 4, 0],
    [0, 0, 2, 0, 2],
    [32, 0, 0, 0, 16],
]
MOVES = [  # (from, to, spawn_cell, spawn_value)
    ((0, 0), (0, 1), (4, 3), 2),
    ((0, 1), (0, 2), (0, 0), 2),
    ((1, 1), (2, 1), (1, 3), 4),
    ((2, 1), (2, 0), (1, 1), 2),
    ((2, 0), (3, 0), (0, 4), 4),
    ((3, 0), (4, 0), (3, 1), 2),
    ((3, 2), (3, 3), (2, 4), 4),
    ((3, 3), (3, 4), (0, 3), 2),
]
T_START, T_MOVE, T_END = 0.7, 0.95, 1.8


def simulate():
    """Returns [(board_before, kind, gain, board_after)] after validating every move."""
    board = [row[:] for row in START]
    steps = []
    for (fr, to, sp, sv) in MOVES:
        before = [row[:] for row in board]
        a, b = board[fr[0]][fr[1]], board[to[0]][to[1]]
        assert a and abs(fr[0] - to[0]) + abs(fr[1] - to[1]) == 1, f'bad move {fr}->{to}'
        if b == 0:
            kind, gain = 'slide', 0
            board[to[0]][to[1]] = a
        else:
            assert a == b, f'unequal merge {fr}->{to}'
            kind, gain = 'merge', a * 2
            board[to[0]][to[1]] = a * 2
        board[fr[0]][fr[1]] = 0
        assert board[sp[0]][sp[1]] == 0, f'spawn cell {sp} occupied'
        board[sp[0]][sp[1]] = sv
        steps.append((before, kind, gain, [row[:] for row in board]))
    return steps


STEPS = simulate()


# ---- sprites ----
PAD = int(CELL * 1.9)
_cache = {}


def sprite(value, kind='tile'):
    key = (value, kind)
    if key not in _cache:
        k = 3
        cv = Image.new('RGBA', (PAD * k, PAD * k), (0, 0, 0, 0))
        if kind == 'drag':
            art.draw_tile(cv, PAD * k / 2, PAD * k / 2, CELL * k, value, scale=1.0, glow=1.0, shadow=True)
        else:
            art.draw_tile(cv, PAD * k / 2, PAD * k / 2, CELL * k, value, glow=0.7)
        _cache[key] = cv.resize((PAD, PAD), Image.LANCZOS)
    return _cache[key]


def put(frame, spr, cx, cy, sx=1.0, sy=None):
    sy = sx if sy is None else sy
    if sx <= 0.02 or sy <= 0.02:
        return
    w, h = max(1, int(PAD * sx)), max(1, int(PAD * sy))
    s = spr if (w, h) == spr.size else spr.resize((w, h), Image.BILINEAR)
    frame.paste(s, (int(cx - w / 2), int(cy - h / 2)), s)


def center(r, c):
    return X0 + c * (CELL + GAP) + CELL / 2, Y0 + r * (CELL + GAP) + CELL / 2


# ---- static background ----
def make_background():
    k = 2
    cv = art.base(W * k, H * k)
    art.draw_slots(cv, X0 * k, Y0 * k, CELL * k, GAP * k)
    return cv.resize((W, H), Image.LANCZOS).convert('RGB')


BG = make_background()
F_SCORE = ImageFont.truetype(FONT, 150)
F_FLOAT = ImageFont.truetype(FONT, 64)


def ease_out(t):
    return 1 - (1 - t) ** 3


def ease_io(t):
    return t * t * (3 - 2 * t)


def back_out(t):
    c1, c3 = 1.70158, 2.70158
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2


def frame_at(t):
    frame = BG.copy()
    overlay = None

    # locate the active move
    idx = int((t - T_START) // T_MOVE) if t >= T_START else -1
    idx = min(idx, len(STEPS) - 1)
    u = (t - T_START) - idx * T_MOVE if idx >= 0 else 0
    score = 0
    for i in range(max(idx, 0)):
        score += STEPS[i][2]

    if idx < 0 or u >= T_MOVE:
        # settled state
        board = START if idx < 0 else STEPS[idx][3]
        if idx >= 0:
            score += STEPS[idx][2]
        for r in range(SIZE):
            for c in range(SIZE):
                if board[r][c]:
                    put(frame, sprite(board[r][c]), *center(r, c))
    else:
        before, kind, gain, after = STEPS[idx]
        (fr, to, sp, sv) = MOVES[idx]
        merged_at, land_at = 0.42, 0.42
        for r in range(SIZE):
            for c in range(SIZE):
                v = before[r][c]
                if not v or (r, c) == fr:
                    continue
                if (r, c) == to and kind == 'merge' and u >= merged_at:
                    k = (u - merged_at) / 0.32
                    amp = 0.34 * math.exp(-4.2 * k) * math.cos(11 * k) if k < 1.4 else 0
                    put(frame, sprite(v * 2), *center(r, c), 1 + amp, 1 - amp * 0.75)
                elif (r, c) == to and kind == 'slide':
                    continue
                else:
                    put(frame, sprite(v), *center(r, c))
        # moving tile
        v = before[fr[0]][fr[1]]
        fx, fy = center(*fr)
        tx, ty = center(*to)
        if u < 0.12:
            k = ease_out(u / 0.12)
            put(frame, sprite(v, 'drag'), fx, fy, 1 + 0.12 * k)
        elif u < land_at:
            k = ease_io((u - 0.12) / (land_at - 0.12))
            put(frame, sprite(v, 'drag'), fx + (tx - fx) * k, fy + (ty - fy) * k, 1.12)
        elif kind == 'slide':
            k = min((u - land_at) / 0.12, 1)
            put(frame, sprite(v, 'drag' if k < 1 else 'tile'), tx, ty, 1.12 - 0.12 * ease_out(k))
        # effects for merge
        if kind == 'merge' and u >= merged_at:
            score += int(gain * ease_out(min((u - merged_at) / 0.3, 1)))
            overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            od = ImageDraw.Draw(overlay)
            rnd = random.Random(idx * 91 + 5)
            col = art.color_for(gain)
            for _ in range(16):
                a = rnd.random() * math.tau
                sp_ = 150 + rnd.random() * 260
                life = 0.45 + rnd.random() * 0.25
                age = u - merged_at
                if age < life:
                    d = sp_ * ease_out(age / life)
                    rr = (6 + rnd.random() * 9) * (1 - age / life * 0.7)
                    px, py = tx + math.cos(a) * d, ty + math.sin(a) * d
                    od.ellipse([px - rr, py - rr, px + rr, py + rr], fill=col + (int(255 * (1 - age / life)),))
            age = u - merged_at
            if age < 0.8:
                od.text((tx, max(70, ty - 20 - 70 * ease_out(age / 0.8))), f'+{gain}', font=F_FLOAT, fill=art.ACCENT + (int(255 * (1 - age / 0.8)),), anchor='mm')
        else:
            score += 0
        # spawn
        if u >= 0.55:
            k = min((u - 0.55) / 0.3, 1)
            put(frame, sprite(sv), *center(*sp), back_out(k))

    d = ImageDraw.Draw(frame)
    d.text((W * 0.14, H * 0.5), str(score), font=F_SCORE, fill=(255, 255, 255), anchor='mm')
    if overlay is not None:
        frame = Image.alpha_composite(frame.convert('RGBA'), overlay).convert('RGB')
    return frame


def main():
    total = T_START + len(STEPS) * T_MOVE + T_END
    n = int(total * FPS)
    out = Path(__file__).parent / 'number-stack-preview-1920x1080.mp4'
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS),
           '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', str(out)]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(n):
        p.stdin.write(frame_at(i / FPS).tobytes())
    p.stdin.close()
    p.wait()
    print(f'wrote {out} ({n} frames, {total:.1f}s)')


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'still':
        frame_at(float(sys.argv[2])).save(sys.argv[3])
    else:
        main()
