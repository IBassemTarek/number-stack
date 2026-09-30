"""Synthesizes the preview video's soundtrack (all original, generated from math: no samples, no music rights issues).
Sound effects mirror the game's own WebAudio tones (src/audio.js); a soft arpeggio bed sits underneath.
Timed from the same script as make_video.py. Run via make_video.py, or: python3 store/make_audio.py
"""
import math
import struct
import wave
from pathlib import Path

RATE = 44100


def _wave(kind, phase):
    p = phase % 1.0
    if kind == 'sine':
        return math.sin(math.tau * p)
    if kind == 'triangle':
        return 4 * abs(p - 0.5) - 1
    if kind == 'sawtooth':
        return 2 * p - 1
    raise ValueError(kind)


class Mixer:
    def __init__(self, seconds):
        self.n = int(seconds * RATE)
        self.buf = [0.0] * self.n

    def tone(self, freq, dur, kind='sine', gain=0.1, at=0.0, attack=0.01):
        """Same envelope as the game: quick rise, then exponential decay to silence."""
        start = int(at * RATE)
        count = int((dur + 0.02) * RATE)
        floor = 0.0001
        for i in range(count):
            j = start + i
            if j >= self.n:
                break
            t = i / RATE
            if t < attack:
                env = gain * (t / attack)
            else:
                env = gain * (floor / gain) ** (min((t - attack) / max(dur - attack, 1e-3), 1.0))
            self.buf[j] += env * _wave(kind, freq * t)

    def fade(self, fade_in, fade_out):
        for i in range(self.n):
            t = i / RATE
            g = min(1.0, t / fade_in) * min(1.0, (self.n / RATE - t) / fade_out)
            self.buf[i] *= g

    def write(self, path, peak=0.85):
        top = max(abs(x) for x in self.buf) or 1.0
        k = peak / top
        with wave.open(str(path), 'wb') as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(RATE)
            frames = bytearray()
            for x in self.buf:
                v = int(max(-1.0, min(1.0, x * k)) * 32767)
                frames += struct.pack('<hh', v, v)
            w.writeframes(bytes(frames))


CHORDS = [  # Am, F, C, G  (bass, triad)
    (110.00, [220.00, 261.63, 329.63]),
    (87.31, [174.61, 220.00, 261.63]),
    (130.81, [261.63, 329.63, 392.00]),
    (98.00, [196.00, 246.94, 293.66]),
]


def music(m, total):
    beat = 60 / 96
    eighth = beat / 2
    bar = beat * 4
    t, ci = 0.0, 0
    while t < total:
        bass, tri = CHORDS[ci % 4]
        m.tone(bass, bar * 0.9, 'sine', 0.05, t)
        pattern = [tri[0], tri[1], tri[2], tri[0] * 2, tri[2], tri[1], tri[0], tri[1]]
        for k, f in enumerate(pattern):
            m.tone(f, 0.42, 'triangle', 0.028, t + k * eighth)
        t += bar
        ci += 1


def merge_sound(m, value, combo, at):
    step = min(math.log2(value) - 1 + (combo - 1) * 2, 20)
    f = 330 * 2 ** (step / 12)
    m.tone(f, 0.16, 'triangle', 0.14, at)
    m.tone(f * 1.5, 0.22, 'sine', 0.08, at + 0.05)


def build(path, total, steps, moves, t_start, t_move):
    m = Mixer(total)
    music(m, total)
    combo = 0
    for i, (_, kind, gain, _) in enumerate(steps):
        t0 = t_start + i * t_move
        m.tone(520, 0.06, 'triangle', 0.07, t0)                 # pick up
        if kind == 'merge':
            combo += 1
            merge_sound(m, gain, combo, t0 + 0.42)               # merge, rising with combo
        else:
            combo = 0
            m.tone(360, 0.07, 'sine', 0.08, t0 + 0.42)           # slide
        m.tone(660, 0.05, 'sine', 0.035, t0 + 0.58)              # new tile appears
    end = t_start + len(steps) * t_move + 0.25
    for k, f in enumerate([523, 659, 784, 1047]):                # closing chime (as the game's "best")
        m.tone(f, 0.2, 'triangle', 0.1, end + k * 0.09)
    m.fade(0.4, 1.4)
    m.write(path)
