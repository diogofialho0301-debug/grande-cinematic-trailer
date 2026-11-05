#!/usr/bin/env python3
"""GRANDE trailer — procedural sound design + score (48 kHz stereo, exactly 30 s).

Everything is synthesised from scratch with numpy: city ambience, sirens, V8 engine,
helicopter, gunshots, whooshes, braams, drums, bass, pads, risers and the final impact.
Timings are locked to the picture edit in src/shots_*.js (120 BPM grid, 1 bar = 2 s).
"""
import sys
import wave
import numpy as np

SR = 48000
DUR = 30.0
N = int(SR * DUR)
RNG = np.random.default_rng(1234)
BEAT = 0.5

L = np.zeros(N)
R = np.zeros(N)


# ---------------------------------------------------------------- helpers
def tt(d):
    return np.arange(int(d * SR)) / SR


def noise(n):
    return RNG.standard_normal(n)


def _mask(n, fn):
    f = np.fft.rfftfreq(n, 1 / SR)
    return fn(np.maximum(f, 1e-6))


def lowpass(x, fc, order=2):
    X = np.fft.rfft(x)
    X *= _mask(len(x), lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order)))
    return np.fft.irfft(X, len(x))


def highpass(x, fc, order=2):
    X = np.fft.rfft(x)
    X *= _mask(len(x), lambda f: 1 / np.sqrt(1 + (fc / f) ** (2 * order)))
    return np.fft.irfft(X, len(x))


def bandpass(x, lo, hi, order=2):
    return highpass(lowpass(x, hi, order), lo, order)


def peak(x, fc, q=8.0, gain=1.0):
    """Resonant band (gaussian in log-frequency)."""
    X = np.fft.rfft(x)
    X *= _mask(len(x), lambda f: gain * np.exp(-0.5 * (np.log2(f / fc) * q) ** 2))
    return np.fft.irfft(X, len(x))


def sweep_lp(x, fc_fn, block=2048):
    """Time-varying low-pass via overlap-add STFT. fc_fn(t)->Hz."""
    hop = block // 2
    win = np.hanning(block)
    out = np.zeros(len(x) + block)
    xp = np.concatenate([x, np.zeros(block)])
    f = np.fft.rfftfreq(block, 1 / SR)
    for i in range(0, len(x), hop):
        seg = xp[i:i + block] * win
        fc = max(fc_fn((i + hop) / SR), 20)
        S = np.fft.rfft(seg) / np.sqrt(1 + (f / fc) ** 4)
        out[i:i + block] += np.fft.irfft(S, block)
    return out[:len(x)]


def sweep_bp(x, fc_fn, width=1.0, block=2048):
    hop = block // 2
    win = np.hanning(block)
    out = np.zeros(len(x) + block)
    xp = np.concatenate([x, np.zeros(block)])
    f = np.maximum(np.fft.rfftfreq(block, 1 / SR), 1)
    for i in range(0, len(x), hop):
        seg = xp[i:i + block] * win
        fc = max(fc_fn((i + hop) / SR), 20)
        S = np.fft.rfft(seg) * np.exp(-0.5 * (np.log2(f / fc) / width) ** 2)
        out[i:i + block] += np.fft.irfft(S, block)
    return out[:len(x)]


def phase_of(freq):
    return np.cumsum(freq) / SR


def saw(ph):
    return 2.0 * (ph % 1.0) - 1.0


def sq(ph):
    return np.sign(np.sin(2 * np.pi * ph))


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def env(n, a=0.005, d=0.1, s=0.0, r=0.05, hold=None):
    """ADSR envelope of n samples (hold = sustain length in s, default fill)."""
    e = np.zeros(n)
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    i = 0
    seg = min(na, n)
    e[:seg] = np.linspace(0, 1, seg, endpoint=False) if seg else e[:seg]
    i += seg
    seg = min(nd, n - i)
    if seg > 0:
        e[i:i + seg] = 1 + (s - 1) * np.linspace(0, 1, seg)
        i += seg
    nh = n - i - nr if hold is None else int(hold * SR)
    nh = max(0, min(nh, n - i))
    e[i:i + nh] = s
    i += nh
    seg = n - i
    if seg > 0:
        e[i:] = s * np.linspace(1, 0, seg) ** 2
    return e


def expd(n, tau):
    return np.exp(-np.arange(n) / SR / tau)


def place(sig, t0, gain=1.0, pan=0.0, sig_r=None):
    """Add mono (or stereo with sig_r) signal at time t0 with constant-power pan."""
    i0 = int(round(t0 * SR))
    if i0 >= N:
        return
    sl = sig if sig_r is None else sig
    srr = sig if sig_r is None else sig_r
    a = 0
    if i0 < 0:
        a = -i0
        i0 = 0
    n = min(len(sl) - a, N - i0)
    if n <= 0:
        return
    th = (pan + 1) * np.pi / 4
    L[i0:i0 + n] += sl[a:a + n] * gain * np.cos(th) * 1.414
    R[i0:i0 + n] += srr[a:a + n] * gain * np.sin(th) * 1.414


def fade(x, fi=0.01, fo=0.05):
    x = x.copy()
    a, b = int(fi * SR), int(fo * SR)
    if a:
        x[:a] *= np.linspace(0, 1, a)
    if b:
        x[-b:] *= np.linspace(1, 0, b)
    return x


def make_ir(sec, tau, seed, lp=6000, pre=0.012):
    rg = np.random.default_rng(seed)
    n = int(sec * SR)
    t = np.arange(n) / SR
    irs = []
    for k in range(2):
        x = rg.standard_normal(n) * np.exp(-t / tau)
        x = lowpass(x, lp, 1)
        x[:int(pre * SR)] = 0
        irs.append(x / np.sqrt(np.sum(x ** 2)))
    return irs


def convolve(x, h):
    n = len(x) + len(h) - 1
    nf = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, nf) * np.fft.rfft(h, nf), nf)[:len(x)]


# send buses (mono in -> stereo reverb)
BUS_HALL = np.zeros(N)
BUS_ROOM = np.zeros(N)
BUS_FAR = np.zeros(N)


def send(bus, sig, t0, gain=1.0):
    i0 = int(round(t0 * SR))
    if i0 >= N:
        return
    a = max(0, -i0)
    i0 = max(0, i0)
    n = min(len(sig) - a, N - i0)
    if n > 0:
        bus[i0:i0 + n] += sig[a:a + n] * gain


# ---------------------------------------------------------------- instruments
def kick(level=1.0, dec=0.42, f0=130, f1=42):
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.045)
    x = np.sin(2 * np.pi * phase_of(f)) * expd(n, dec)
    x += noise(n) * expd(n, 0.004) * 0.25
    return np.tanh(x * 1.6) * level


def snare(level=1.0):
    n = int(0.45 * SR)
    x = bandpass(noise(n), 900, 7000) * expd(n, 0.13)
    x += np.sin(2 * np.pi * 185 * tt(0.45)) * expd(n, 0.06) * 0.6
    # clap layer
    for d in (0.0, 0.011, 0.022):
        i = int(d * SR)
        x[i:] += bandpass(noise(n - i), 1200, 4500) * expd(n - i, 0.025) * 0.6
    return x * level * 0.7


def hat(level=1.0, dec=0.035):
    n = int(0.2 * SR)
    return highpass(noise(n), 7500, 3) * expd(n, dec) * level * 0.22


def tom(f=72, level=1.0, dec=0.55):
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    fr = f * (1 + 0.6 * np.exp(-t / 0.03))
    x = np.sin(2 * np.pi * phase_of(fr)) * expd(n, dec)
    x += lowpass(noise(n), 900) * expd(n, 0.05) * 0.5
    return np.tanh(x * 1.4) * level


def crash(level=1.0, dec=1.8):
    n = int(3.5 * SR)
    x = highpass(noise(n), 3500, 2) * expd(n, dec)
    t = tt(3.5)
    for p in (423, 587, 811, 1043, 1471, 2213, 3301):
        x += np.sin(2 * np.pi * p * t + RNG.random() * 6) * expd(n, dec * 0.5) * 0.04
    return lowpass(x, 11000, 2) * level * 0.16


def whoosh(d=0.45, f0=250, f1=4000, level=1.0, rev=False):
    n = int(d * SR)
    x = noise(n)
    x = sweep_bp(x, lambda t: f0 * (f1 / f0) ** min(t / d, 1), 0.9, 1024)
    e = np.sin(np.pi * np.linspace(0, 1, n)) ** 2
    if rev:
        e = np.linspace(0, 1, n) ** 3
    return x * e * level / (np.std(x) + 1e-9) * 0.12


def riser(d, level=1.0, f0=200, f1=9000):
    n = int(d * SR)
    t = np.arange(n) / SR
    x = sweep_bp(noise(n), lambda s: f0 * (f1 / f0) ** (s / d), 1.2)
    x /= np.std(x) + 1e-9
    # shepard-ish rising tone
    tone = np.zeros(n)
    for o in range(5):
        fr = 55 * 2 ** (o + 2.0 * t / d)
        w = np.exp(-0.5 * ((np.log2(fr) - np.log2(440)) / 1.4) ** 2)
        tone += np.sin(2 * np.pi * phase_of(fr)) * w
    e = (t / d) ** 2.2
    return (x * 0.06 + tone * 0.2) * e * level


def braam(root_midi=26, d=2.6, level=1.0, bright=2400):
    n = int(d * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for iv, a in ((0, 1.0), (12, 0.8), (19, 0.55), (24, 0.45), (27, 0.25)):
        for det in (-0.12, 0.0, 0.13):
            f = mtof(root_midi + iv + det)
            x += saw(phase_of(np.full(n, f)) + RNG.random()) * a
    x = sweep_lp(x, lambda s: 180 + bright * np.exp(-((s - 0.18) / 0.35) ** 2) + 300 * np.exp(-s / 1.2))
    x = np.tanh(x * 0.5)
    x += np.sin(2 * np.pi * mtof(root_midi) * t) * 0.9
    e = env(n, 0.02, 0.4, 0.55, 1.2)
    return x * e * level * 0.5


def pad(midis, d, level=1.0, cutoff=1400, attack=0.6, choir=False):
    n = int(d * SR)
    x = np.zeros(n)
    for m in midis:
        for k in range(5):
            det = (k - 2) * 0.09
            f = mtof(m + det)
            x += saw(phase_of(np.full(n, f)) + RNG.random())
    x /= len(midis) * 3
    if choir:
        y = peak(x, 700, 4, 1.0) + peak(x, 1150, 5, 0.7) + peak(x, 2600, 6, 0.35)
        x = y * 2.0
    else:
        x = lowpass(x, cutoff, 2)
    return x * env(n, attack, 0.2, 0.9, min(0.8, d * 0.4)) * level


def pluck(m, d=0.22, level=1.0, cutoff=3000):
    n = int(d * SR)
    f = mtof(m)
    x = saw(phase_of(np.full(n, f))) + 0.5 * saw(phase_of(np.full(n, f * 1.005)))
    x = lowpass(x, cutoff, 2) * expd(n, 0.07)
    return fade(x, 0.002, 0.02) * level


def bass_note(m, d, level=1.0, cutoff=500):
    n = int(d * SR)
    f = mtof(m)
    ph = phase_of(np.full(n, f))
    x = saw(ph) * 0.6 + np.sin(2 * np.pi * ph * 0.5) * 0.0 + np.sin(2 * np.pi * ph) * 0.8
    x = lowpass(x, cutoff, 2)
    return fade(np.tanh(x * 1.3), 0.004, 0.03) * level


def engine(rpm, cyl=8, level=1.0, rough=0.4):
    """rpm: array per-sample. V8-ish growl."""
    n = len(rpm)
    f0 = rpm / 60.0 * cyl / 2.0
    ph = phase_of(f0)
    x = np.zeros(n)
    for k, a in ((0.5, 0.5), (1, 1.0), (1.5, 0.35), (2, 0.6), (3, 0.3), (4, 0.22), (5, 0.12), (6, 0.1), (8, 0.05)):
        x += a * np.sin(2 * np.pi * k * ph + k)
    puls = np.sin(np.pi * (ph % 1.0)) ** 8
    x += noise(n) * puls * rough
    x = np.tanh(x * 1.8)
    mean_rpm = float(np.mean(rpm))
    x = lowpass(x, 600 + mean_rpm * 0.35, 2)
    return x * level * 0.5


def siren(d, kind='wail', level=1.0, dist=0.6, f_scale=1.0, doppler=None):
    n = int(d * SR)
    t = np.arange(n) / SR
    if kind == 'wail':
        f = 900 + 420 * np.sin(2 * np.pi * t / 2.6 - 1.2)
    else:  # yelp
        f = 1000 + 380 * np.sin(2 * np.pi * t * 3.2)
    f = f * f_scale
    if doppler is not None:
        f = f * doppler
    ph = phase_of(f)
    x = np.sin(2 * np.pi * ph) + 0.35 * np.sin(4 * np.pi * ph) + 0.15 * np.sin(6 * np.pi * ph)
    x = lowpass(x, 6000 * (1 - dist) + 900, 2)
    return x * level * 0.25


def gunshot(dist=0.7, level=1.0):
    n = int(0.6 * SR)
    crack = bandpass(noise(n), 900, 8000) * expd(n, 0.006)
    thump = np.sin(2 * np.pi * phase_of(60 + 90 * expd(n, 0.02))) * expd(n, 0.09)
    body = lowpass(noise(n), 1500) * expd(n, 0.04)
    x = crack * 1.2 + thump * 0.9 + body * 0.6
    x = lowpass(x, 9000 * (1 - dist) + 1200, 2)
    return np.tanh(x * 2) * level


def metal_hit(level=1.0, dec=2.5, base=1.0):
    n = int(4.0 * SR)
    t = tt(4.0)
    x = np.zeros(n)
    for p, a in ((87, 1.0), (213, 0.7), (346, 0.55), (541, 0.4), (788, 0.3), (1131, 0.22), (1597, 0.15), (2311, 0.1)):
        x += a * np.sin(2 * np.pi * p * base * t + RNG.random() * 6) * expd(n, dec * (1.2 - p / 3000))
    x += bandpass(noise(n), 2000, 9000) * expd(n, 0.01) * 0.6
    return x * level * 0.25


def sub_drop(d=2.2, f0=72, f1=27, level=1.0):
    n = int(d * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.5)
    return np.sin(2 * np.pi * phase_of(f)) * env(n, 0.003, 0.2, 0.7, d * 0.7) * level


def impact(level=1.0, sub=True):
    x = np.zeros(int(4 * SR))
    k = kick(1.0, 0.7, 160, 38)
    x[:len(k)] += k * 1.1
    if sub:
        s = sub_drop(2.5)
        x[:len(s)] += s * 0.9
    m = metal_hit(0.7, 1.6)
    x[:len(m)] += m[:len(x)]
    x[:int(0.4 * SR)] += bandpass(noise(int(0.4 * SR)), 300, 6000) * expd(int(0.4 * SR), 0.05) * 0.5
    return x * level


def flashpop(level=1.0):
    n = int(0.25 * SR)
    x = highpass(noise(n), 3000) * expd(n, 0.008) * 0.8
    x += np.sin(2 * np.pi * phase_of(np.linspace(5200, 3200, n))) * expd(n, 0.05) * 0.15
    return x * level


def screech(d, level=1.0):
    n = int(d * SR)
    t = np.arange(n) / SR
    x = peak(noise(n), 2300, 6, 1.0) + peak(noise(n), 3400, 7, 0.6)
    tone = np.sin(2 * np.pi * phase_of(2250 + 180 * np.sin(2 * np.pi * 9 * t) + 60 * noise(n).cumsum() / SR))
    x = x / (np.std(x) + 1e-9) * 0.3 + tone * 0.2
    return x * env(n, 0.04, 0.1, 0.8, d * 0.4) * level


def crowd(d, level=1.0):
    n = int(d * SR)
    x = np.zeros(n)
    for f, a in ((500, 1.0), (900, 0.8), (1400, 0.5), (2500, 0.3)):
        x += peak(noise(n), f, 2.5, a)
    t = np.arange(n) / SR
    mod = 0.7 + 0.3 * np.sin(2 * np.pi * 2 * t) ** 2
    return x / (np.std(x) + 1e-9) * mod * level * 0.15


def heli(d, level=1.0):
    n = int(d * SR)
    t = np.arange(n) / SR
    blade = 21.0
    thump = (np.sin(np.pi * (t * blade % 1.0)) ** 12)
    x = lowpass(noise(n), 260) * thump * 4.0
    x += lowpass(noise(n), 120) * 0.6
    x += np.sin(2 * np.pi * 4200 * t) * 0.01 + bandpass(noise(n), 3000, 6000) * 0.04
    return x * level * 0.4


def sparkle(level=1.0):
    n = int(0.6 * SR)
    f = RNG.uniform(2200, 7000)
    t = tt(0.6)
    x = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 2.76 * t)) * expd(n, RNG.uniform(0.08, 0.25))
    return fade(x, 0.002, 0.01) * level * 0.03


# ---------------------------------------------------------------- arrangement
def build():
    # ===== 0-5 THE BEGINNING ==================================================
    amb = bandpass(noise(int(24.2 * SR)), 180, 2500, 1)
    amb = amb / np.std(amb) * 0.018
    a_env = np.clip(np.linspace(-0.2, 1.2, len(amb)), 0, 1) ** 1.5
    a_env[int(10 * SR):] *= 0.5
    place(amb * a_env, 0.0, 1.0, -0.2)
    place(bandpass(noise(int(24.2 * SR)), 180, 2500, 1) / 70 * a_env, 0.0, 1.0, 0.25)
    hum = sum(np.sin(2 * np.pi * f * tt(10.0) + i) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.13 * (i + 1) * tt(10.0))) for i, f in enumerate([92, 117, 146]))
    place(lowpass(hum, 200) * 0.012 * env(len(hum), 1.5, 0.1, 1.0, 1.0), 0.0)
    # deep rumble swelling
    rum = lowpass(noise(int(5.4 * SR)), 70, 2)
    rum = rum / np.std(rum) * 0.22 * np.linspace(0, 1, len(rum)) ** 1.4
    rum += np.sin(2 * np.pi * mtof(26) * tt(5.4)) * 0.22 * np.linspace(0, 1, int(5.4 * SR)) ** 2
    place(rum, 0.0)
    # distant sirens
    s1 = siren(4.6, 'wail', 1.0, dist=0.85)
    s1 *= env(len(s1), 1.2, 0.1, 1.0, 1.4)
    place(s1, 0.3, 0.28, -0.6)
    send(BUS_FAR, s1, 0.3, 0.35)
    s2 = siren(3.0, 'yelp', 1.0, dist=0.9, f_scale=0.93)
    s2 *= env(len(s2), 0.8, 0.1, 1.0, 1.2)
    place(s2, 1.7, 0.14, 0.7)
    send(BUS_FAR, s2, 1.7, 0.25)
    # dark pad
    p = pad([38, 45, 50, 53], 4.0, 0.16, cutoff=700, attack=2.0)
    place(p, 1.0, 1.0, -0.15)
    place(pad([38, 45, 50, 53], 4.0, 0.16, cutoff=700, attack=2.0), 1.0, 1.0, 0.15)
    send(BUS_HALL, p, 1.0, 0.4)
    # text hit at 1.9 ("EVERY CITY HAS A STORY.")
    h = kick(0.5, 1.0, 90, 34)
    place(h, 1.9, 0.7)
    m = metal_hit(0.25, 2.0, 1.0)
    place(m, 1.9, 0.6, 0.0)
    send(BUS_HALL, m, 1.9, 0.6)
    # sports car engine start (2.55 s)
    st = int(0.38 * SR)
    starter = (sq(phase_of(np.full(st, 27))) * 0.3 + np.sin(2 * np.pi * phase_of(np.linspace(220, 330, st))) * 0.4) * env(st, 0.01, 0.05, 1, 0.05)
    starter = lowpass(starter, 1800)
    place(starter, 2.55, 0.35, 0.1)
    d_eng = 2.6
    te = tt(d_eng)
    rpm = 900 + 0 * te
    rpm = np.where(te < 0.08, 300 + te / 0.08 * 1500, rpm)
    rev1 = np.exp(-((te - 0.4) / 0.2) ** 2) * 5600
    rev2 = np.exp(-((te - 1.25) / 0.14) ** 2) * 4200
    rpm = np.maximum(rpm, 1100 + rev1 + rev2)
    rpm[:int(0.08 * SR)] = np.linspace(300, 1800, int(0.08 * SR))
    eng = engine(rpm, level=1.0, rough=0.6)
    eng *= env(len(eng), 0.01, 0.1, 1.0, 0.6)
    place(eng, 2.93, 0.75, 0.1)
    send(BUS_ROOM, eng, 2.93, 0.35)
    # exhaust pops
    for tp in (4.25, 4.33, 4.36, 4.5):
        pop = gunshot(0.6, 0.25)
        place(pop, tp, 0.5, 0.15)
        send(BUS_ROOM, pop, tp, 0.5)
    # reverse whoosh into 5.0
    place(whoosh(0.9, 200, 5000, 1.4, rev=True), 4.1, 1.0)
    place(riser(1.2, 0.5), 3.8, 1.0)

    # ===== 5-10 THE LIFESTYLE ==================================================
    place(impact(0.8, sub=True), 5.0, 1.0)
    send(BUS_HALL, impact(0.5, sub=False), 5.0, 0.5)
    place(crash(0.6), 5.0, 1.0, 0.0)
    # chords per bar: Dm | Bb | C(half) ; bass ostinato 8ths
    prog = [(5.0, 26, [50, 53, 57]), (7.0, 22, [46, 50, 53]), (9.0, 24, [48, 52, 55])]
    for (t0, root, chord) in prog:
        bar = 2.0 if t0 < 9.0 else 1.0
        for i in range(int(bar / 0.25)):
            tn = t0 + i * 0.25
            if tn >= 9.75:
                break
            m = root + 12 + (12 if i % 4 == 3 else 0)
            place(bass_note(m, 0.22, 0.5, cutoff=300 + 1200 * (tn - 5) / 5), tn, 1.0)
        pd = pad(chord, bar + 0.3, 0.13, cutoff=900 + (t0 - 5) * 250, attack=0.3)
        place(pd, t0, 1.0, -0.3)
        place(pad(chord, bar + 0.3, 0.13, cutoff=900 + (t0 - 5) * 250, attack=0.3), t0, 1.0, 0.3)
        send(BUS_HALL, pd, t0, 0.3)
    # drums: kick 4otf from 5.0, hats/claps from 7.0
    for i in range(10):
        tb = 5.0 + i * BEAT
        if tb < 9.75:
            place(kick(0.85), tb)
    for i in range(int(2.75 / 0.125)):
        tb = 7.0 + i * 0.125
        if tb < 9.75:
            place(hat(0.5 if i % 2 else 0.25), tb, 1.0, 0.3)
    for tb in (7.5, 8.5, 9.5):
        sn = snare(0.55)
        place(sn, tb, 1.0)
        send(BUS_ROOM, sn, tb, 0.4)
    # gold arp 16ths from 6.0
    arp_notes = {5: [62, 65, 69, 74], 7: [58, 62, 65, 70], 9: [60, 64, 67, 72]}
    for i in range(int(3.75 / 0.125)):
        tn = 6.0 + i * 0.125
        bar = 5 if tn < 7 else (7 if tn < 9 else 9)
        nts = arp_notes[bar]
        n_ = nts[i % 4] + (12 if (i // 4) % 2 else 0)
        pl = pluck(n_, 0.2, 0.09, cutoff=1500 + 3000 * (tn - 6) / 4)
        place(pl, tn, 1.0, 0.4 * np.sin(i))
        send(BUS_HALL, pl, tn, 0.35)
    # cut whooshes
    for tc in (6.0, 6.75, 7.5, 8.25, 9.0):
        place(whoosh(0.35, 400, 6000, 0.7), tc - 0.18, 1.0, RNG.uniform(-0.5, 0.5))
    # supercar pass 5.0-6.0 (tracking) — high revs
    te = tt(1.1)
    eng = engine(5200 + 600 * np.sin(2 * np.pi * 0.9 * te), level=0.9, rough=0.4)
    place(fade(eng, 0.02, 0.15), 5.0, 0.55, -0.1)
    # club crowd
    cr = crowd(0.9, 1.0)
    place(fade(cr, 0.05, 0.1), 6.0, 0.6, 0.0)
    send(BUS_ROOM, cr, 6.0, 0.5)
    # street race engines
    te = tt(0.9)
    e1 = engine(6200 + 900 * te, level=0.9, rough=0.5)
    e2 = engine(5800 + 1100 * te, level=0.9, rough=0.5)
    place(fade(e1, 0.02, 0.1), 7.5, 0.5, 0.35)
    place(fade(e2, 0.02, 0.1), 7.5, 0.45, -0.35)
    # camera flashes at luxury arrival
    for tf in (8.37, 8.56, 8.70, 8.85):
        place(flashpop(0.5), tf, 1.0, RNG.uniform(-0.6, 0.6))
    # WRITE YOUR OWN. hit at 8.0
    place(impact(0.55, sub=False), 8.0, 1.0)
    place(crash(0.5, 2.5), 8.0, 1.0)
    send(BUS_HALL, metal_hit(0.4, 2.0), 8.0, 0.6)
    # riser 8.2 -> 9.92, then suck to silence before the drop
    rz = riser(1.72, 0.9)
    place(rz, 8.2, 1.0)
    place(whoosh(0.6, 150, 3000, 1.2, rev=True), 9.35, 1.0)
    # sunset gulls/waves (subtle)
    wv = lowpass(noise(int(1.0 * SR)), 900) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.7 * tt(1.0)))
    place(fade(wv / np.std(wv) * 0.03, 0.1, 0.2), 9.0)

    # ===== 10-17 THE DARK SIDE =================================================
    place(braam(26, 3.0, 1.0, 2600), 10.0, 1.0, -0.1)
    place(braam(26, 3.0, 1.0, 2600), 10.0, 1.0, 0.1)
    send(BUS_HALL, braam(26, 3.0, 0.8), 10.0, 0.45)
    place(impact(1.0), 10.0, 1.0)
    place(crash(0.8, 2.5), 10.0, 1.0)
    # ticking clock (robbery prep)
    for i in range(10):
        tk = highpass(noise(int(0.03 * SR)), 4000) * expd(int(0.03 * SR), 0.004)
        place(tk, 10.0 + i * 0.125, 0.25 if i % 2 else 0.4, 0.4)
    # gun cock at 10.55
    for dt_, f_ in ((0.0, 2400), (0.09, 1800)):
        c = peak(noise(int(0.08 * SR)), f_, 3, 1.0) * expd(int(0.08 * SR), 0.01)
        place(c / (np.max(np.abs(c)) + 1e-9) * 0.35, 10.55 + dt_, 1.0, 0.2)
        send(BUS_ROOM, c, 10.55 + dt_, 0.1)
    # staccato low strings 16ths
    for i in range(int(7.0 / 0.125)):
        tn = 10.0 + i * 0.125
        root = 38 if tn < 14.0 else 34
        m = root + (0 if i % 4 else 12) + (3 if (i // 8) % 4 == 3 else 0)
        n_ = int(0.12 * SR)
        f = mtof(m)
        x = (saw(phase_of(np.full(n_, f))) + saw(phase_of(np.full(n_, f * 1.004)))) * 0.5
        x = lowpass(x, 900 + 900 * ((i % 4) == 0), 2) * env(n_, 0.004, 0.05, 0.4, 0.04)
        place(x, tn, 0.16 if i % 4 else 0.22, 0.25 if i % 2 else -0.25)
    # taiko groove
    pat = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 1]
    for i in range(int(6.5 / 0.125)):
        tn = 10.5 + i * 0.125
        if pat[i % 16]:
            tm = tom(68 if i % 16 < 8 else 82, 0.55 if i % 4 == 0 else 0.35)
            place(tm, tn, 1.0, RNG.uniform(-0.3, 0.3))
            send(BUS_HALL, tm, tn, 0.25)
    for i in range(14):
        place(kick(0.7, 0.35), 10.0 + i * BEAT)
    for tb in np.arange(10.5, 17.0, 1.0):
        sn = snare(0.5)
        place(sn, tb, 1.0)
        send(BUS_HALL, sn, tb, 0.3)
    # cut hits
    for tc in (11.25, 12.0, 13.0, 14.0, 14.75, 16.0):
        place(kick(0.6, 0.5, 110, 40), tc)
        place(whoosh(0.3, 500, 7000, 0.8), tc - 0.15, 1.0, RNG.uniform(-0.4, 0.4))
    # police pass (11.25-12.0): siren with doppler + engines + passby
    d = 1.2
    te = tt(d)
    lt_ = te
    zc = 30 - 60 * lt_  # matches picture: car z, camera at z=-6 x=8
    dx, dz = 8 + 2.6, zc - (-6)
    dist = np.sqrt(dx ** 2 + dz ** 2)
    vr = np.gradient(dist, 1 / SR)
    dop = 343 / (343 + vr)
    sg = siren(d, 'yelp', 1.0, dist=0.2, doppler=dop)
    amp = 1 / (1 + (dist / 10) ** 2) * 3
    place(sg * amp, 11.25, 0.7, -0.2)
    send(BUS_HALL, sg * amp, 11.25, 0.25)
    eng = engine(6500 * dop, level=1.0, rough=0.6) * amp
    place(eng, 11.25, 0.5, 0.0)
    place(whoosh(0.5, 200, 3000, 1.5), 11.5, 1.0, -0.3)
    # helicopter 12-13
    hh = heli(1.25, 1.0)
    place(fade(hh, 0.05, 0.15), 11.95, 0.9, 0.2)
    send(BUS_FAR, hh, 11.95, 0.2)
    sz = siren(1.0, 'wail', 1.0, dist=0.7, f_scale=1.05)
    place(fade(sz, 0.1, 0.2), 12.0, 0.25, 0.5)
    # meeting 13-14: tension — low heartbeat + drone
    for tb in (13.05, 13.3, 13.55, 13.8):
        place(kick(0.5, 0.2, 70, 40), tb)
    dr = pad([26, 33, 38], 1.2, 0.2, cutoff=300, attack=0.2)
    place(dr, 13.0)
    # gunfire 14.0-14.75 (distant)
    for s_ in (0.06, 0.16, 0.22, 0.38, 0.47, 0.6):
        g = gunshot(0.55, 0.9)
        place(g, 14.0 + s_ + 0.02, 0.55, 0.15)
        send(BUS_FAR, g, 14.0 + s_ + 0.02, 0.9)
    place(braam(22, 2.6, 0.9, 2200), 14.0, 1.0)
    send(BUS_HALL, braam(22, 2.6, 0.6), 14.0, 0.4)
    # chase 14.75-17
    te = tt(2.3)
    rpm = 6800 + 400 * np.sin(2 * np.pi * 0.8 * te)
    rpm -= 1600 * np.clip(1 - np.abs(te - 0.9) / 0.06, 0, 1)  # gear shift
    e = engine(rpm, level=1.0, rough=0.5)
    place(fade(e, 0.03, 0.1), 14.75, 0.55, 0.1)
    e2 = engine(6000 + 300 * np.sin(2 * np.pi * 1.1 * te), level=1.0, rough=0.5)
    place(fade(e2, 0.03, 0.1), 14.75, 0.35, -0.3)
    s1 = siren(2.3, 'wail', 1.0, dist=0.25)
    place(fade(s1, 0.05, 0.1), 14.75, 0.35, -0.4)
    s2 = siren(2.3, 'yelp', 1.0, dist=0.3, f_scale=0.95)
    place(fade(s2, 0.05, 0.1), 14.75, 0.3, 0.45)
    send(BUS_HALL, s1 + s2, 14.75, 0.15)
    place(screech(0.7, 0.5), 15.25, 1.0, 0.2)
    # front pass-by at ~16.6
    place(whoosh(0.7, 150, 2500, 2.0), 16.3, 1.0, -0.4)
    place(whoosh(0.6, 150, 2500, 1.6), 16.55, 1.0, 0.4)
    # riser into climax
    place(riser(1.6, 1.0), 15.4, 1.0)
    for i in range(16):
        tn = 16.0 + i * 0.0625
        place(snare(0.15 + 0.35 * i / 16), tn, 1.0, 0.0)
    place(whoosh(0.5, 100, 6000, 1.4, rev=True), 16.5, 1.0)

    # ===== 17-24 YOUR WORLD — CLIMAX ==========================================
    place(impact(1.2), 17.0, 1.0)
    place(crash(1.0, 2.8), 17.0, 1.0)
    send(BUS_HALL, impact(0.7, sub=False), 17.0, 0.6)
    climax = [(17.0, 26, [50, 53, 57, 62]), (19.0, 22, [46, 50, 53, 58]), (21.0, 17, [48, 53, 57, 60]), (22.0, 24, [48, 52, 55, 60]), (23.0, 21, [49, 52, 57, 61])]
    for idx, (t0, root, chord) in enumerate(climax):
        bar = (climax[idx + 1][0] if idx + 1 < len(climax) else 24.0) - t0
        # braam on each section start
        if t0 in (17.0, 19.0, 21.0):
            b = braam(root, 2.4, 0.85, 2800)
            place(b, t0, 1.0)
            send(BUS_HALL, b, t0, 0.35)
            place(impact(0.75, sub=False), t0, 1.0)
            place(crash(0.6, 2.0), t0, 1.0, 0.2)
        # choir + strings pads
        ch = pad(chord, bar + 0.2, 0.12, attack=0.15, choir=True)
        place(ch, t0, 1.0, -0.35)
        place(pad(chord, bar + 0.2, 0.12, attack=0.15, choir=True), t0, 1.0, 0.35)
        send(BUS_HALL, ch, t0, 0.5)
        st_ = pad([c + 12 for c in chord], bar + 0.2, 0.06, cutoff=3500, attack=0.1)
        place(st_, t0, 1.0, 0.0)
        # bass 8ths w/ sub
        for i in range(int(bar / 0.25)):
            tn = t0 + i * 0.25
            place(bass_note(root + 12 + (12 if i % 2 else 0), 0.23, 0.55, cutoff=900), tn)
            place(np.sin(2 * np.pi * mtof(root) * tt(0.24)) * env(int(0.24 * SR), 0.005, 0.05, 0.9, 0.05) * 0.35, tn)
        # arp 16ths
        for i in range(int(bar / 0.125)):
            tn = t0 + i * 0.125
            n_ = chord[i % 4] + 12 + (12 if (i // 4) % 2 else 0)
            pl = pluck(n_, 0.18, 0.08, cutoff=5000)
            place(pl, tn, 1.0, 0.5 * np.sin(i * 1.3))
            send(BUS_HALL, pl, tn, 0.3)
    for i in range(14):
        tb = 17.0 + i * BEAT
        place(kick(1.0, 0.45), tb)
        if i % 2 == 1:
            sn = snare(0.75)
            place(sn, tb, 1.0)
            send(BUS_HALL, sn, tb, 0.35)
    for i in range(int(7.0 / 0.125)):
        place(hat(0.55 if i % 2 else 0.3), 17.0 + i * 0.125, 1.0, 0.3)
    for i in range(int(7.0 / 0.125)):
        tn = 17.0 + i * 0.125
        if pat[i % 16] and i % 2 == 0:
            tm = tom(64 if i % 32 < 16 else 76, 0.4)
            place(tm, tn, 1.0, -0.2)
            send(BUS_HALL, tm, tn, 0.2)
    # role cut whooshes
    for tc in (18.0, 20.0, 22.5):
        place(whoosh(0.3, 400, 7000, 0.7), tc - 0.15, 1.0)
    # sirens/flash flavour inside climax
    place(fade(siren(1.0, 'yelp', 1.0, dist=0.4), 0.05, 0.2), 17.0, 0.18, 0.5)
    place(fade(siren(1.0, 'wail', 1.0, dist=0.4, f_scale=0.8), 0.05, 0.2), 19.0, 0.12, -0.5)
    for tf in (22.8, 23.02, 23.2, 23.45, 23.6):
        place(flashpop(0.4), tf, 1.0, RNG.uniform(-0.6, 0.6))
    # riser + snare roll into hard stop at 24.0
    place(riser(1.5, 1.2), 22.5, 1.0)
    for i in range(24):
        tn = 22.5 + i * (1.5 / 24) ** 1.0
        place(snare(0.2 + 0.5 * i / 24), tn, 1.0)



def build_reveal():
    # ===== 24-30 THE GRANDE REVEAL ============================================
    place(whoosh(0.3, 100, 2500, 0.5, rev=True), 24.12, 1.0)
    imp = impact(1.4)
    place(imp, 24.4, 1.0)
    send(BUS_HALL, imp, 24.4, 0.8)
    place(sub_drop(4.0, 55, 26, 0.9), 24.4, 1.0)
    # drone D minor -> D major lift at tagline
    dr1 = pad([26, 33, 38, 45], 3.0, 0.22, cutoff=500, attack=1.2)
    place(dr1, 24.6, 1.0)
    send(BUS_HALL, dr1, 24.6, 0.5)
    # rising shimmer as letters emerge
    place(whoosh(1.5, 300, 9000, 1.0, rev=True), 24.8, 1.0)
    # logo lock hit at 25.2
    lk = impact(1.0, sub=False)
    place(lk, 25.2, 1.0)
    send(BUS_HALL, lk, 25.2, 0.8)
    place(crash(0.7, 3.0), 25.2, 1.0)
    # metallic "shing" with the light sweep at ~26.0
    n = int(2.0 * SR)
    shing = sweep_bp(noise(n), lambda s: 3000 + 6000 * min(s / 0.4, 1), 0.25) * expd(n, 0.4)
    shing = shing / (np.std(shing) + 1e-9) * 0.05
    shing += sum(np.sin(2 * np.pi * f * tt(2.0)) * expd(n, 0.9) for f in (2637, 3951, 5274)) * 0.02
    place(shing, 25.75, 1.0, -0.3)
    send(BUS_HALL, shing, 25.75, 1.0)
    # sparkles (gold particles)
    for i in range(70):
        ts = 24.6 + RNG.random() ** 0.8 * 5.0
        sp = sparkle(RNG.uniform(0.4, 1.0))
        place(sp, ts, 1.0, RNG.uniform(-0.9, 0.9))
        send(BUS_HALL, sp, ts, 0.6)
    # tagline 27.15: warm D major bloom
    dr2 = pad([26, 38, 42, 45, 50, 54], 3.0, 0.2, cutoff=1400, attack=0.6, choir=True)
    place(dr2, 27.1, 1.0)
    send(BUS_HALL, dr2, 27.1, 0.6)
    tg = kick(0.5, 1.2, 80, 30)
    place(tg, 27.15, 1.0)
    place(metal_hit(0.3, 3.0, 1.5), 27.15, 1.0)
    send(BUS_HALL, metal_hit(0.3, 3.0, 1.5), 27.15, 0.5)


IRS = {}


def apply_reverb():
    if not IRS:
        IRS['hall'] = make_ir(3.8, 1.1, 7, 5000)
        IRS['room'] = make_ir(1.2, 0.25, 8, 7000, 0.006)
        IRS['far'] = make_ir(2.5, 0.7, 9, 2500, 0.03)
    for bus, ir, g in ((BUS_HALL, IRS['hall'], 0.55), (BUS_ROOM, IRS['room'], 0.5), (BUS_FAR, IRS['far'], 0.7)):
        L[:] += convolve(bus, ir[0]) * g
        R[:] += convolve(bus, ir[1]) * g
        bus[:] = 0


def tone_shape(x):
    # +3 dB lows below ~90 Hz, -5 dB air above ~7 kHz
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    g = 1 + 0.41 / (1 + (f / 90) ** 4)
    g *= 1 - 0.44 / (1 + (7000 / np.maximum(f, 1)) ** 2)
    return np.fft.irfft(X * g, len(x))


def master():
    global L, R
    L = tone_shape(L)
    R = tone_shape(R)
    # gentle glue: low-shelf boost + soft clip
    for ch in (L, R):
        ch -= np.mean(ch)
    mx = max(np.max(np.abs(L)), np.max(np.abs(R)))
    L /= mx
    R /= mx
    drive = 2.2
    L = np.tanh(L * drive) / np.tanh(drive)
    R = np.tanh(R * drive) / np.tanh(drive)
    # end fade (picture fades 29.15-29.95)
    t = np.arange(N) / SR
    g = np.clip((29.98 - t) / 1.6, 0, 1) ** 1.5
    L *= g
    R *= g
    L[:int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))
    R[:int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))
    mx = max(np.max(np.abs(L)), np.max(np.abs(R)))
    L *= 0.89 / mx
    R *= 0.89 / mx


def write(path):
    data = np.stack([L, R], axis=1)
    pcm = (np.clip(data, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'build/soundtrack.wav'
    build()
    apply_reverb()
    cut = int(24.0 * SR)
    pre_L, pre_R = L.copy(), R.copy()
    pre_L[cut:] = 0
    pre_R[cut:] = 0
    pre_L[cut - 240:cut] *= np.linspace(1, 0, 240)
    pre_R[cut - 240:cut] *= np.linspace(1, 0, 240)
    L[:] = 0
    R[:] = 0
    build_reveal()
    apply_reverb()
    L += pre_L
    R += pre_R
    master()
    write(out)
    print('wrote', out, f'{N / SR:.2f}s')
