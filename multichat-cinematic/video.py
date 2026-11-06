#!/usr/bin/env python3
"""GRANDE – Multi-Chat Cinematic: Bild (1920x1080, 60 fps, exakt 13 s = 780 Frames).

Fast vollständig schwarz. Nur extrem unscharfe rote/violette/blaue Partylichter,
Doppelsicht und Schwanken im Rausch, Lichtflackern/Erschütterung bei den Schüssen,
Abdunkeln (10–11 s) und kompletter Blackout (11–13 s).
Rendert in niedriger Auflösung (die Lichter sind ohnehin extrem unscharf) und wird
per FFmpeg weich auf 1080p skaliert; Filmkorn kommt in FFmpeg dazu.
"""
import subprocess
import sys
import numpy as np

FPS, DUR = 60, 13.0
NF = int(FPS * DUR)
W, H = 480, 270
BEAT = 60 / 126.0
SHOTS = [7.00, 7.11, 7.20, 7.62, 7.74, 8.18, 8.26, 8.33, 8.80, 9.25, 9.55]
rng = np.random.default_rng(3)

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
cx, cy = W / 2, H / 2
vig = np.clip(1.15 - ((xx - cx) ** 2 / (W * 0.62) ** 2 + (yy - cy) ** 2 / (H * 0.72) ** 2), 0, 1) ** 1.5

COLS = [(1.0, 0.08, 0.15), (0.55, 0.1, 1.0), (0.1, 0.25, 1.0), (0.9, 0.05, 0.55), (1.0, 0.12, 0.1), (0.35, 0.12, 1.0), (0.15, 0.35, 1.0), (0.75, 0.1, 0.9)]
LIGHTS = []
for i, c in enumerate(COLS):
    LIGHTS.append(dict(c=np.array(c, np.float32), ax=rng.uniform(0.25, 0.45) * W, ay=rng.uniform(0.15, 0.3) * H,
                       fx=rng.uniform(0.05, 0.16), fy=rng.uniform(0.04, 0.12), ph=rng.uniform(0, 6.28, 2),
                       s=rng.uniform(28, 55), a=rng.uniform(0.5, 1.0), sweep=rng.uniform(0.2, 0.5)))


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def frame(t):
    img = np.zeros((H, W, 3), np.float32)
    drunk = smooth(3.8, 6.5, t)                 # Rausch-Intensität
    panic = smooth(6.98, 7.02, t)               # ab Schüssen
    dark = smooth(9.9, 11.0, t)                 # Bewusstlosigkeit
    if t >= 11.0:
        return img
    beat = (1 - ((t % BEAT) / BEAT)) ** 4 * (1 - panic)
    # Kamera: leichtes Schwanken, im Rausch stärker; bei Schüssen Erschütterung
    sway_x = np.sin(t * 0.7) * 6 + drunk * (np.sin(t * 1.1) * 22 + np.sin(t * 2.3) * 8)
    sway_y = np.cos(t * 0.5) * 4 + drunk * np.sin(t * 0.9 + 1) * 12
    kick = 0.0
    for s in SHOTS:
        d = t - s
        if 0 <= d < 0.25:
            kick = max(kick, np.exp(-d / 0.05))
    sway_x += kick * rng.uniform(-14, 14); sway_y += kick * rng.uniform(-9, 9)
    ghost = drunk * (18 + 10 * np.sin(t * 1.7)) * (1 - panic * 0.6)   # Doppelsicht-Abstand
    blur_scale = 1.0 + drunk * 0.6 + dark * 0.8
    for i, Lt in enumerate(LIGHTS):
        speed = 1.0 + panic * 2.5  # Lichter geraten ins Taumeln
        px = cx + Lt['ax'] * np.sin(t * Lt['fx'] * 6.28 * speed + Lt['ph'][0]) + sway_x
        py = cy + Lt['ay'] * np.sin(t * Lt['fy'] * 6.28 * speed + Lt['ph'][1]) + sway_y
        s = Lt['s'] * blur_scale
        inten = Lt['a'] * (0.55 + 0.45 * beat if i % 2 == 0 else 0.7 + 0.3 * np.sin(t * 2 + i))
        inten /= blur_scale ** 1.6
        if panic > 0:  # Partylichter flackern unregelmäßig / fallen aus
            inten *= 0.35 + 0.65 * (np.sin(t * 37 + i * 5) > -0.3)
        for gx, gw in ((0.0, 1.0), (ghost, 0.55 * drunk)):
            if gw <= 0.01:
                continue
            g = np.exp(-(((xx - px - gx) ** 2) + (yy - py) ** 2 * 1.3) / (2 * s * s))
            img += g[..., None] * Lt['c'] * inten * gw
    # Mündungsfeuer: kurzer, sehr unscharfer warmer Lichtblitz aus verschiedenen Richtungen
    for k, s in enumerate(SHOTS):
        d = t - s
        if 0 <= d < 0.06:
            sx = cx + [-120, -110, -100, 160, 165, -170, -165, -160, 90, -20, 180][k] + sway_x
            sy = cy + rng.uniform(-30, 20)
            a = (1 - d / 0.06) ** 2
            g = np.exp(-(((xx - sx) ** 2) + (yy - sy) ** 2) / (2 * 70 ** 2))
            img += g[..., None] * np.array([1.0, 0.75, 0.45], np.float32) * a * 1.4
            img += a * 0.05  # Raum hellt kurz auf
    # Augenlider schwer: periodisches Abdunkeln im Rausch
    lids = 1 - drunk * 0.35 * smooth(0.6, 1.0, np.sin(t * 1.3) * 0.5 + 0.5) * (1 - panic)
    level = 0.27 * lids * (1 - dark) ** 1.6
    img *= level
    img *= vig[..., None] if dark == 0 else (vig ** (1 + dark * 3))[..., None]
    # Tonemapping, fast schwarz halten
    img = 1 - np.exp(-img * 1.6)
    return img


def main(out):
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
           '-vf', "scale=1920:1080:flags=bicubic,gblur=sigma=6,noise=alls=5:allf=t:enable='lt(t\\,10.9)',format=yuv420p",
           '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-r', str(FPS), out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in range(NF):
        img = frame(f / FPS)
        p.stdin.write((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8).tobytes())
    p.stdin.close(); p.wait()
    print('geschrieben:', out, NF, 'Frames')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'build/video.mp4')
