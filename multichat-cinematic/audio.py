#!/usr/bin/env python3
"""GRANDE – Multi-Chat Cinematic: Sounddesign (48 kHz Stereo, exakt 13,0 s).

Stimmen: neuronale deutsche Piper-TTS-Stimmen (rhasspy/piper-voices, de_DE),
mehrere weibliche und männliche Sprecher, räumlich positioniert (ITD/ILD, Nah-/Fernfeld, Hall).
Club-Musik, Gläser, Schüsse, Glasbruch, Stühle, Schritte, Tinnitus und Herzschlag werden
prozedural mit numpy/scipy erzeugt (physikalisch motivierte Synthese, keine Piepser).
"""
import io
import sys
import wave
import numpy as np
from scipy.signal import resample_poly, butter, sosfilt, sosfiltfilt, fftconvolve
from piper import PiperVoice
from piper.config import SynthesisConfig

SR = 48000
DUR = 13.0
N = int(SR * DUR)
RNG = np.random.default_rng(7)
import os
FEAT = float(os.environ.get('FEAT', '1'))
RAW = os.environ.get('RAW') == '1'
VDIR = 'voices/'

# separate Busse: Musik, Raum (Stimmen/Effekte), Nahfeld (trocken)
L = np.zeros(N); R = np.zeros(N)
REV_L = np.zeros(N); REV_R = np.zeros(N)   # Hall-Send (Club-Raum)
MUS_L = np.zeros(N); MUS_R = np.zeros(N)   # Musikbus (wird ab 7.0 s abgewürgt)
DLG_L = np.zeros(N); DLG_R = np.zeros(N)   # Hauptdialoge (Sidechain-Quelle)


# ------------------------------------------------------------------ DSP-Helfer
def bq(kind, f, order=2):
    if kind == 'bp':
        return butter(order, [f[0] / (SR / 2), f[1] / (SR / 2)], 'band', output='sos')
    return butter(order, f / (SR / 2), kind, output='sos')


def lp(x, f, o=2): return sosfilt(bq('low', f, o), x)
def hp(x, f, o=2): return sosfilt(bq('high', f, o), x)
def bp(x, a, b, o=2): return sosfilt(bq('bp', (a, b), o), x)


def tt(d): return np.arange(int(d * SR)) / SR
def noise(n): return RNG.standard_normal(n)
def expd(n, tau): return np.exp(-np.arange(n) / SR / tau)


def env(n, a, r):
    e = np.ones(n)
    na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    if na: e[:na] = np.linspace(0, 1, na)
    if nr: e[-nr:] *= np.linspace(1, 0, nr)
    return e


def place(sig, t0, gain=1.0, pan=0.0, dist=0.0, rev=0.25, bus='main'):
    """Räumliche Platzierung: pan -1..1 (ILD + ITD), dist 0..1 (Dämpfung, Höhenverlust)."""
    i0 = int(round(t0 * SR))
    if i0 >= N or len(sig) == 0:
        return
    x = sig * gain
    if dist > 0:
        x = lp(x, 9000 * (1 - dist) + 1200, 1) * (1 - 0.55 * dist)
    th = (pan + 1) * np.pi / 4
    gl, gr = np.cos(th) * 1.414, np.sin(th) * 1.414
    itd = int(abs(pan) * 0.00062 * SR)
    xl, xr = x * gl, x * gr
    # abgewandtes Ohr: verzögert und leicht dumpfer (Kopfschatten)
    if pan > 0:
        xl = np.concatenate([np.zeros(itd), lp(xl, 4000 + 8000 * (1 - pan), 1)])[:len(x)]
    elif pan < 0:
        xr = np.concatenate([np.zeros(itd), lp(xr, 4000 + 8000 * (1 + pan), 1)])[:len(x)]
    n = min(len(x), N - i0)
    if bus == 'music':
        MUS_L[i0:i0 + n] += xl[:n]; MUS_R[i0:i0 + n] += xr[:n]
    elif bus == 'dlg':
        DLG_L[i0:i0 + n] += xl[:n] * (1 - rev * 0.5); DLG_R[i0:i0 + n] += xr[:n] * (1 - rev * 0.5)
    else:
        L[i0:i0 + n] += xl[:n] * (1 - rev * 0.5); R[i0:i0 + n] += xr[:n] * (1 - rev * 0.5)
    REV_L[i0:i0 + n] += xl[:n] * rev; REV_R[i0:i0 + n] += xr[:n] * rev


def make_ir(sec, tau, seed, lpf=6000, pre=0.01):
    rg = np.random.default_rng(seed); n = int(sec * SR); t = np.arange(n) / SR
    out = []
    for _ in range(2):
        h = rg.standard_normal(n) * np.exp(-t / tau)
        h = lp(h, lpf, 1); h[:int(pre * SR)] = 0
        # frühe Reflexionen
        for d, a in ((0.011, 0.5), (0.017, 0.4), (0.023, 0.35), (0.031, 0.3)):
            h[int(d * SR)] += a * rg.choice([-1, 1])
        out.append(h / np.sqrt(np.sum(h ** 2)))
    return out


def resamp(x, factor):
    """Tonhöhe+Tempo ändern (factor>1 = höher/schneller)."""
    up = 1000; down = int(round(1000 * factor))
    return resample_poly(x, up, down)


# ------------------------------------------------------------------ Stimmen (Piper TTS)
_VOICES = {}


def voice(name):
    if name not in _VOICES:
        _VOICES[name] = PiperVoice.load(f'{VDIR}de_DE-{name}.onnx')
    return _VOICES[name]


def say(name, text, sid=None, speed=1.0, noise_scale=0.75, noise_w=0.9, pitch=1.0):
    v = voice(name)
    b = io.BytesIO(); w = wave.open(b, 'wb')
    v.synthesize_wav(text, w, SynthesisConfig(speaker_id=sid, length_scale=1.0 / speed, noise_scale=noise_scale, noise_w_scale=noise_w))
    w.close(); b.seek(0); r = wave.open(b)
    sr = r.getframerate(); x = np.frombuffer(r.readframes(r.getnframes()), '<i2').astype(np.float64) / 32768
    x = resample_poly(x, SR, sr)
    if pitch != 1.0:
        x = resamp(x, pitch)
    # Stille an den Rändern abschneiden
    a = np.abs(x) > 0.01
    if a.any():
        i0, i1 = np.argmax(a), len(a) - np.argmax(a[::-1])
        x = x[max(0, i0 - 200):i1 + 400]
    x = hp(x, 90)
    return x / (np.max(np.abs(x)) + 1e-9)


def shout(x, drive=3.0):
    """Schreien/Rufen: Präsenz anheben, Sättigung, Kompression."""
    x = x + 0.8 * bp(x, 1800, 4200)
    x = np.tanh(x * drive) / np.tanh(drive)
    return x / (np.max(np.abs(x)) + 1e-9)


def scream(name, text, sid=None, pitch=1.35, speed=1.25):
    x = say(name, text, sid, speed=speed, noise_scale=0.9, noise_w=1.0, pitch=pitch)
    # Vibrato/Zittern durch zeitvariante Verzögerung
    n = len(x); t = np.arange(n) / SR
    d = (0.0018 * np.sin(2 * np.pi * 6.5 * t) + 0.0008 * np.sin(2 * np.pi * 11 * t)) * SR
    idx = np.clip(np.arange(n) - d - 100, 0, n - 1)
    x = np.interp(idx, np.arange(n), x)
    return shout(x, 4.0)


def intimate(x):
    """Nahbesprechung direkt am Ohr: Nahbesprechungseffekt (Bass), Atem."""
    x = x + 0.6 * lp(x, 220)
    br = bp(noise(len(x)), 1500, 6000) * 0.012 * (0.5 + 0.5 * np.abs(x) / (np.abs(x).max() + 1e-9))
    return (x + br) / (np.max(np.abs(x + br)) + 1e-9)


def drug(x, depth=0.006, rate=0.7, slow=0.9):
    """Benommen: langsamer/tiefer, schwankende Tonhöhe."""
    x = resamp(x, slow)
    n = len(x); t = np.arange(n) / SR
    d = depth * SR * (1 + np.sin(2 * np.pi * rate * t))
    return np.interp(np.clip(np.arange(n) - d, 0, n - 1), np.arange(n), x)


# ------------------------------------------------------------------ Club-Musik (126 BPM Techno/House)
BPM = 126.0
BEAT = 60 / BPM


def kick():
    n = int(0.5 * SR); t = np.arange(n) / SR
    f = 48 + 110 * np.exp(-t / 0.035)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * expd(n, 0.28)
    x += bp(noise(n), 2000, 8000) * expd(n, 0.003) * 0.25
    return np.tanh(x * 2.2)


def clap():
    n = int(0.35 * SR); x = np.zeros(n)
    for d in (0.0, 0.008, 0.017, 0.027):
        i = int(d * SR); x[i:] += bp(noise(n - i), 900, 5000) * expd(n - i, 0.012 if d < 0.027 else 0.09)
    return x * 0.5


def hat(open_=False):
    n = int((0.3 if open_ else 0.08) * SR)
    x = hp(noise(n), 8000, 4) * expd(n, 0.09 if open_ else 0.018)
    return x * 0.35


def bassline(m, d):
    n = int(d * SR); f = 440 * 2 ** ((m - 69) / 12); t = np.arange(n) / SR
    ph = f * t
    x = 2 * (ph % 1) - 1 + 0.5 * (2 * ((ph * 1.006) % 1) - 1)
    x = lp(x, 300 + 900 * np.exp(-t[-1] / 0.2), 2) if False else lp(x, 520, 2)
    x = np.tanh(x * 1.5 + np.sin(2 * np.pi * f * t) * 1.2)
    return x * env(n, 0.004, 0.03)


def stab(midis, d):
    n = int(d * SR); t = np.arange(n) / SR; x = np.zeros(n)
    for m in midis:
        for det in (-0.08, 0.0, 0.08):
            f = 440 * 2 ** ((m + det - 69) / 12); x += 2 * ((f * t + RNG.random()) % 1) - 1
    x = lp(x / (3 * len(midis)), 2400, 2) * expd(n, 0.12)
    return x


def build_music():
    """Ganzer Track 0–7.05 s; wird später für den Rausch verbogen und bei 7.0 s abgewürgt."""
    d = 7.2; n = int(d * SR)
    ml = np.zeros(n); mr = np.zeros(n)

    def add(sig, t0, g=1.0, pan=0.0):
        i0 = int(t0 * SR); m = min(len(sig), n - i0)
        if m <= 0: return
        th = (pan + 1) * np.pi / 4
        ml[i0:i0 + m] += sig[:m] * g * np.cos(th) * 1.414; mr[i0:i0 + m] += sig[:m] * g * np.sin(th) * 1.414
    k, c = kick(), clap()
    notes = [33, 33, 45, 33, 36, 33, 43, 33]  # A-Moll-Groove
    t = 0.0; i = 0
    while t < d:
        add(k, t, 1.0)
        if i % 2 == 1: add(c, t, 0.7, 0.05)
        add(hat(), t + BEAT / 2, 0.8, 0.25)
        add(hat(), t + BEAT / 4, 0.25, -0.2); add(hat(), t + 3 * BEAT / 4, 0.25, -0.2)
        if i % 4 == 3: add(hat(True), t + BEAT / 2, 0.5, 0.3)
        for s in range(4):
            if s != 0:
                add(bassline(notes[(i * 4 + s) % 8], BEAT / 4 * 0.9), t + s * BEAT / 4, 0.55)
        if i % 2 == 0:
            add(stab([57, 60, 64, 67], 0.35), t + BEAT * 0.75, 0.35, -0.3)
            add(stab([57, 60, 64, 67], 0.35), t + BEAT * 0.75 + 0.012, 0.35, 0.3)
        t += BEAT; i += 1
    # Pad-Fläche
    tp = np.arange(n) / SR; pad = np.zeros(n)
    for m in (57, 64, 69, 72):
        f = 440 * 2 ** ((m - 69) / 12)
        pad += 2 * ((f * tp + RNG.random()) % 1) - 1
    pad = lp(pad / 4, 1100, 2) * 0.12
    ml += pad; mr += np.roll(pad, 300)
    return ml, mr


# ------------------------------------------------------------------ Geräusche
def glass_clink():
    n = int(0.9 * SR); t = np.arange(n) / SR; x = np.zeros(n)
    base = RNG.uniform(2300, 3400)
    for r, a in ((1.0, 1.0), (2.32, 0.5), (3.87, 0.3), (5.1, 0.18), (1.51, 0.25)):
        x += a * np.sin(2 * np.pi * base * r * t + RNG.random() * 6) * expd(n, RNG.uniform(0.12, 0.4) / r ** 0.5)
    x += hp(noise(n), 4000) * expd(n, 0.002) * 0.6
    if RNG.random() < 0.6:  # zweites Glas
        i = int(0.012 * SR); x[i:] += 0.7 * np.sin(2 * np.pi * base * 1.13 * t[:-i]) * expd(n - i, 0.2)
    return x * 0.3


def gunshot(indoor=1.0):
    """Faustfeuerwaffe in Innenraum: Mündungsknall, Körper, Raumantwort, leichte Übersteuerung."""
    n = int(1.4 * SR); t = np.arange(n) / SR
    crack = noise(n) * expd(n, 0.0016)
    crack = hp(crack, 600) * 2.5
    body = lp(noise(n), 1800, 2) * expd(n, 0.02) * 1.4
    thump = np.sin(2 * np.pi * np.cumsum(55 + 140 * np.exp(-t / 0.012)) / SR) * expd(n, 0.07) * 1.2
    mech = bp(noise(n), 3000, 9000) * expd(n, 0.004) * 0.4
    x = crack + body + thump + mech
    # Raumschwanz (Flatterecho + diffuser Hall)
    tail = lp(noise(n), 3500, 1) * expd(n, 0.32) * 0.25 * indoor
    for d in (0.023, 0.041, 0.067, 0.089):
        i = int(d * SR); tail[i:] += x[:n - i] * 0.22 * indoor
    x = x + tail
    x = np.tanh(x * 1.8) / np.tanh(1.8)
    return x


def glass_break():
    n = int(1.6 * SR); x = np.zeros(n)
    x += hp(noise(n), 1500) * expd(n, 0.03) * 0.9
    x += bp(noise(n), 300, 2000) * expd(n, 0.015) * 0.6
    for _ in range(90):  # Scherben
        i = int(RNG.uniform(0, 1.2) ** 1.7 * SR); m = int(0.15 * SR)
        if i + m >= n: continue
        f = RNG.uniform(2500, 9000); tt_ = np.arange(m) / SR
        x[i:i + m] += np.sin(2 * np.pi * f * tt_ + RNG.random() * 6) * expd(m, RNG.uniform(0.01, 0.05)) * RNG.uniform(0.05, 0.3)
    return x * 0.6


def chair_fall():
    n = int(1.2 * SR); x = np.zeros(n)
    for k, (d, a) in enumerate(((0.0, 1.0), (0.11, 0.6), (0.19, 0.45), (0.3, 0.3), (0.42, 0.18))):
        i = int(d * SR); m = n - i; tt_ = np.arange(m) / SR
        hit = lp(noise(m), 1200, 2) * expd(m, 0.025)
        for f in (RNG.uniform(160, 260), RNG.uniform(420, 700), RNG.uniform(900, 1400)):  # Holz/Metallbeine
            hit += np.sin(2 * np.pi * f * tt_) * expd(m, 0.06) * 0.3
        x[i:] += hit * a
    return x * 0.5


def footsteps(d, rate=6.5, level=1.0, hard=True):
    n = int(d * SR); x = np.zeros(n); t = 0.0
    while t < d - 0.1:
        i = int(t * SR); m = int(0.09 * SR)
        s = lp(noise(m), 900 if hard else 500, 2) * expd(m, 0.012) + bp(noise(m), 1500, 5000) * expd(m, 0.004) * 0.4
        x[i:i + m] += s * RNG.uniform(0.6, 1.0)
        t += 1 / rate * RNG.uniform(0.75, 1.25)
    return x * level


def crowd_walla(d, density=1.0):
    """Diffuses Stimmengewirr-Bett (formantgefiltertes Rauschen, amplitudenmoduliert)."""
    n = int(d * SR); t = np.arange(n) / SR; x = np.zeros(n)
    for _ in range(int(10 * density)):
        f1 = RNG.uniform(400, 800); f2 = RNG.uniform(1000, 2200)
        v = bp(noise(n), f1 * 0.8, f1 * 1.25) + 0.6 * bp(noise(n), f2 * 0.85, f2 * 1.15)
        syll = 0.5 + 0.5 * np.sin(2 * np.pi * RNG.uniform(3, 6) * t + RNG.random() * 6)
        phrase = (np.sin(2 * np.pi * RNG.uniform(0.2, 0.5) * t + RNG.random() * 6) > -0.2).astype(float)
        x += v * syll ** 2 * lp(phrase, 8, 1)
    return x / (np.std(x) + 1e-9) * 0.05


def tinnitus(d):
    n = int(d * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * 7400 * t) + 0.25 * np.sin(2 * np.pi * 7410 * t)
    return x * 0.06


def heartbeat(t_list, level=1.0):
    out = []
    for _ in t_list:
        n = int(0.6 * SR); tt_ = np.arange(n) / SR
        lub = np.sin(2 * np.pi * np.cumsum(38 + 30 * np.exp(-tt_ / 0.03)) / SR) * expd(n, 0.07)
        i = int(0.17 * SR); dub = np.zeros(n)
        dub[i:] = np.sin(2 * np.pi * np.cumsum(48 + 25 * np.exp(-tt_[:n - i] / 0.02)) / SR) * expd(n - i, 0.05) * 0.7
        out.append(lp(lub + dub, 150, 2) * level)
    return out


# ------------------------------------------------------------------ Arrangement
def build():
    # ---------- Musik: 0–7 s, ab 4 s zunehmend verzerrt/dröhnend, bei 7.0 abgewürgt
    ml, mr = build_music()
    n = len(ml); t = np.arange(n) / SR
    # Rausch ab 4 s: Tape-Wobble (Tonhöhe), Tiefpass, Sättigung, Pegel steigt
    w = np.clip((t - 4.0) / 3.0, 0, 1)
    wob = (0.004 * np.sin(2 * np.pi * 0.55 * t) + 0.002 * np.sin(2 * np.pi * 1.7 * t)) * w * SR + w ** 2 * 0.03 * SR
    idx = np.clip(np.arange(n) - wob, 0, n - 1)
    ml = np.interp(idx, np.arange(n), ml); mr = np.interp(idx, np.arange(n), mr)
    # "Club von außen gehört": immer leicht gedämpft; ab 4s stärker
    def club_filter(x):
        bright = lp(x, 9000, 2); dull = lp(x, 700, 2)
        return bright * (1 - w * 0.75) + dull * (w * 0.75 + 0.0)
    ml, mr = club_filter(ml), club_filter(mr)
    drive = 1.4 + 2.5 * w
    ml = np.tanh(ml * drive) / np.tanh(drive) * (1 + 0.3 * w); mr = np.tanh(mr * drive) / np.tanh(drive) * (1 + 0.3 * w)
    # Dröhnen: Sub-Drone unterlegen
    drone = np.sin(2 * np.pi * 55 * t + 0.6 * np.sin(2 * np.pi * 0.4 * t)) * w ** 1.5 * 0.35
    ml += drone; mr += drone
    # Einblenden (Szene beginnt mitten in der Party) und harter Stopp bei 7.0 s
    fade_in = np.clip(t / 0.35, 0, 1)
    cut = int(7.0 * SR)
    ml *= fade_in; mr *= fade_in
    ml[cut:] = 0; mr[cut:] = 0
    ml[cut - 96:cut] *= np.linspace(1, 0, 96); mr[cut - 96:cut] *= np.linspace(1, 0, 96)
    MG = float(__import__("os").environ.get("MUSIC_GAIN", "0.34"))
    duck = np.ones(n)
    for a, b in ((0.95, 2.35), (2.65, 4.05), (4.25, 6.0)):
        duck *= 1 - 0.45 * np.clip(np.minimum((t - a) / 0.08, (b - t) / 0.25), 0, 1)
    ml *= duck; mr *= duck
    MUS_L[:n] += ml[:N] * MG; MUS_R[:n] += mr[:N] * MG

    # ---------- Party-Atmosphäre 0–7 s
    wl = crowd_walla(7.2, 1.2); wr = crowd_walla(7.2, 1.2)
    i7 = int(7.0 * SR)
    for sig, pan in ((wl, -0.6), (wr, 0.6)):
        sig = sig * np.clip(np.arange(len(sig)) / SR / 0.3, 0, 1)
        sig[i7:] *= np.linspace(1, 0, len(sig) - i7) ** 3
        place(sig, 0.0, 0.6, pan, 0.2, 0.4)
    # Hintergrundgespräche (verschiedene Sprecher, verschiedene Richtungen, teils überlappend)
    chatter = [
        ('karlsson-low', 'Noch eine Runde? Ich lad dich ein.', None, 0.15, -0.8, 0.55, 0.92),
        ('eva_k-x_low', 'Wo ist eigentlich Lena hin?', None, 0.5, 0.7, 0.6, 1.0),
        ('pavoque-low', 'Der DJ ist heute echt krass.', None, 0.9, -0.4, 0.65, 1.0),
        ('kerstin-low', 'Nein, echt jetzt? Das glaub ich dir nicht!', None, 1.5, 0.85, 0.6, 1.12),
        ('thorsten-high', 'Prost, auf uns!', None, 1.9, -0.9, 0.5, 0.9),
        ('ramona-low', 'Hast du den Typen da drüben gesehen?', None, 2.2, 0.75, 0.65, 1.06),
        ('pavoque-low', 'Wann fährst du eigentlich nach Hause?', None, 2.9, -0.7, 0.6, 0.94),
        ('karlsson-low', 'Ich hol uns noch was zu trinken.', None, 3.4, 0.9, 0.6, 1.05),
        ('eva_k-x_low', 'Ey, das Lied ist so gut!', None, 3.8, -0.5, 0.55, 0.95),
        ('thorsten-high', 'Keine Ahnung, frag sie doch selbst.', None, 4.6, 0.75, 0.7, 1.08),
        ('ramona-low', 'Komm schon, nur noch ein Glas.', None, 5.2, -0.85, 0.7, 0.97),
        ('karlsson-low', 'Alter, wie spät ist es?', None, 5.9, 0.6, 0.75, 0.9),
        ('kerstin-low', 'Hahaha, hör auf!', None, 6.3, -0.4, 0.7, 1.1),
    ]
    for name, text, sid, t0, pan, dist, pit in chatter:
        x = say(name, text, sid, speed=RNG.uniform(1.05, 1.2), noise_scale=0.8, pitch=pit)
        if t0 > 4.0:
            x = drug(x, 0.004, 0.5, 0.88)
        if t0 + len(x) / SR > 7.0:  # bricht mit den Schüssen ab
            x = x[:max(0, int((7.0 - t0) * SR))]
            if len(x) > 400: x[-400:] *= np.linspace(1, 0, 400)
        place(x, t0, 0.17, pan, dist, 0.6)
    # Frauen lachen miteinander (rechts, mittlere Entfernung)
    for name, txt, sid, t0, pan, pit in (('eva_k-x_low', 'Hahaha!', None, 0.7, 0.55, 1.1), ('ramona-low', 'Haha, nein!', None, 2.05, 0.45, 1.12), ('kerstin-low', 'Hihi!', None, 3.15, 0.35, 1.18)):
        x = say(name, txt, sid, speed=1.15, noise_scale=0.95, pitch=pit)
        place(x, t0, 0.3, pan, 0.35, 0.45)
    # Gläser klirren
    for t0, pan in ((0.45, 0.3), (1.6, -0.5), (2.45, 0.6), (3.3, -0.2), (4.4, 0.4), (5.6, -0.6)):
        place(glass_clink(), t0, 0.55, pan, 0.25, 0.35)

    # ---------- Hauptdialog 0–4 s
    x = say('kerstin-low', 'Hey, alles gut bei dir?', speed=0.95, noise_scale=0.8, pitch=1.04)
    x = drug(x, 0.0015, 0.8, 0.98)
    place(x, 1.0, FEAT * 2.6, -0.35, 0.03, 0.25, bus='dlg')
    x1 = say('eva_k-x_low', 'Haha!', speed=1.1, noise_scale=0.95, pitch=1.06)
    place(x1, 2.35, 0.42, 0.45, 0.08, 0.3)
    x2 = say('eva_k-x_low', 'Komm, wir gehen tanzen!', speed=1.05, noise_scale=0.75)
    place(x2, 2.7, FEAT * 2.3, 0.4, 0.05, 0.25, bus='dlg')

    # ---------- Rausch 4–7 s
    x = say('kerstin-low', 'Ey, hörst du mir überhaupt zu?', speed=0.95, noise_scale=0.7)
    x = intimate(drug(x, 0.0025, 0.6, 0.95))
    place(x, 4.3, FEAT * 2.9, -0.85, 0.0, 0.12, bus='dlg')      # ganz nah am linken Ohr
    x = say('thorsten-high', 'Was ist denn mit dir los?', speed=1.0, noise_scale=0.8)
    x = shout(drug(x, 0.005, 0.45, 0.9), 2.0)
    place(x, 5.7, FEAT * 2.0, 0.55, 0.45, 0.55, bus='dlg')      # ruft aus dem Hintergrund
    # Überlagerung: Echo-Fetzen der Sätze, verlangsamt und verhallt
    e = drug(say('kerstin-low', 'Alles gut bei dir?', speed=0.9), 0.008, 0.35, 0.78)
    place(e, 5.85, 0.22, 0.6, 0.6, 0.9)
    e = drug(say('kerstin-low', 'Hörst du mir zu?', speed=0.9), 0.008, 0.3, 0.75)
    place(e, 6.1, 0.24, -0.5, 0.6, 0.9)
    # tiefer Puls/Druck im Kopf
    t2 = tt(3.0)
    press = np.sin(2 * np.pi * 38 * t2) * (0.5 + 0.5 * np.sin(2 * np.pi * 1.05 * t2)) ** 2 * np.clip(t2 / 2.5, 0, 1) * 0.3
    place(press, 4.0, 1.0, 0.0, 0.0, 0.0)

    # ---------- Schießerei 7–10 s
    shots = [(7.00, -0.25, 0.0), (7.11, -0.3, 0.0), (7.20, -0.2, 0.05), (7.62, 0.7, 0.35), (7.74, 0.7, 0.35),
             (8.18, -0.75, 0.25), (8.26, -0.75, 0.25), (8.33, -0.7, 0.25), (8.80, 0.4, 0.5), (9.25, -0.1, 0.15), (9.55, 0.8, 0.6)]
    for t0, pan, dist in shots:
        place(gunshot(), t0, 0.8 - dist * 0.3, pan, dist, 0.35)
    # Glas zerbricht, Stühle fallen
    for t0, pan in ((7.08, 0.35), (7.4, -0.6), (8.3, 0.75), (9.0, -0.3)):
        place(glass_break(), t0, 0.75, pan, 0.2, 0.35)
    for t0, pan in ((7.5, 0.5), (7.85, -0.4), (8.55, 0.2), (9.35, -0.7)):
        place(chair_fall(), t0, 0.8, pan, 0.25, 0.3)
    # Schritte: viele Leute rennen in verschiedene Richtungen
    for t0, pan, d in ((7.2, -0.5, 2.8), (7.35, 0.6, 2.6), (7.6, 0.1, 2.4), (7.9, -0.8, 2.0), (8.1, 0.85, 1.9)):
        place(footsteps(d, RNG.uniform(5.5, 7.5), 0.35), t0, 1.0, pan, 0.3, 0.3)
    # Schreie (Frauen, panisch)
    for name, txt, sid, t0, pan, g in (
            ('eva_k-x_low', 'Aaaah!', None, 7.05, 0.55, 0.5), ('kerstin-low', 'Aaaaaah!', None, 7.15, -0.6, 0.45),
            ('eva_k-x_low', 'Nein! Nein!', None, 7.85, 0.8, 0.3), ('ramona-low', 'Aaaah!', None, 8.2, -0.35, 0.4),
            ('kerstin-low', 'Hilfe!', None, 8.7, 0.65, 0.32), ('eva_k-x_low', 'Aaaah!', None, 9.1, -0.8, 0.35),
            ('ramona-low', 'Oh Gott, oh Gott!', None, 9.4, 0.3, 0.38)):
        place(scream(name, txt, sid, pitch=RNG.uniform(1.15, 1.3)), t0, g, pan, 0.35, 0.45)
    # Zentrale Rufe
    x = shout(say('ramona-low', 'Scheiße! Was ist das?!', speed=1.05, noise_scale=0.7, pitch=1.03), 2.0)
    place(x, 7.31, FEAT * 1.35, -0.3, 0.05, 0.25, bus='dlg')
    x = shout(say('thorsten_emotional-medium', 'Runter! Alle runter!', sid=1, speed=1.2, noise_scale=0.8, pitch=1.04), 2.2)
    place(x, 8.2, FEAT * 1.25, 0.45, 0.08, 0.3, bus='dlg')
    x = shout(say('karlsson-low', 'Lauft! Lauft!', speed=1.05, noise_scale=0.7, pitch=1.02), 2.0)
    place(x, 9.0, FEAT * 1.2, -0.55, 0.2, 0.35, bus='dlg')
    x = shout(say('pavoque-low', 'Raus hier! Schnell!', speed=1.25, noise_scale=0.85, pitch=1.1), 2.2)
    place(x, 9.55, 0.45, 0.8, 0.5, 0.5)
    # Panik-Gewirr unter allem
    pw = crowd_walla(3.4, 1.6)
    pw = shout(hp(pw, 400), 2.0) * 0.05 * env(len(pw), 0.08, 0.6)
    place(pw, 7.05, 1.0, 0.3, 0.3, 0.5); place(crowd_walla(3.4, 1.6) * 0.6 * env(int(3.4 * SR), 0.08, 0.6), 7.05, 1.0, -0.4, 0.3, 0.5)

    # ---------- 10–13 s: Tinnitus, Herzschlag (Zusammenbruch / Blackout)
    tin = tinnitus(2.6) * env(int(2.6 * SR), 0.15, 1.6)
    return tin


def master(tin):
    global L, R
    ir = make_ir(1.6, 0.42, 3, 6500)
    wl = fftconvolve(REV_L, ir[0])[:N]; wr = fftconvolve(REV_R, ir[1])[:N]
    mix_l = L + wl * 0.55 + MUS_L
    mix_r = R + wr * 0.55 + MUS_R
    # Sidechain: alles außer Hauptdialog weicht der Stimme aus (max. -8 dB)
    d = np.abs(DLG_L) + np.abs(DLG_R)
    e = np.zeros(N); a_, r_ = np.exp(-1 / (0.01 * SR)), np.exp(-1 / (0.18 * SR))
    from scipy.signal import lfilter
    e = lfilter([1 - r_], [1, -r_], d)            # Hüllkurve
    e = np.maximum(e, lfilter([1 - a_], [1, -a_], d))
    g = 1 - 0.6 * np.clip(e / (np.percentile(e[e > 1e-4], 60) + 1e-9), 0, 1)
    mix_l *= g; mix_r *= g
    mix_l += DLG_L; mix_r += DLG_R
    if os.environ.get('STEMS'):
        np.save('build/st_dlg.npy', np.stack([DLG_L, DLG_R])); np.save('build/st_rest.npy', np.stack([mix_l - DLG_L, mix_r - DLG_R]))
    # Musik erzeugt Hall im Raum (auch nach dem Abwürgen kurz hörbar)
    mwl = fftconvolve(MUS_L, ir[0])[:N] * 0.25; mwr = fftconvolve(MUS_R, ir[1])[:N] * 0.25
    mix_l += mwl; mix_r += mwr
    t = np.arange(N) / SR
    # 10–11 s: alles wird stark gedämpft (Tiefpass + Pegel), Stimmen entfernen sich
    def collapse(x):
        out = x.copy(); i0 = int(9.95 * SR)
        seg = x[i0:]
        tl = np.arange(len(seg)) / SR
        # zeitvarianter Tiefpass per Blockverarbeitung
        blk = 1024; res = np.zeros(len(seg) + blk); win = np.hanning(blk)
        f = np.fft.rfftfreq(blk, 1 / SR)
        for i in range(0, len(seg), blk // 2):
            s = np.concatenate([seg[i:i + blk], np.zeros(max(0, blk - len(seg[i:i + blk])))]) * win
            tc = (i + blk / 2) / SR
            fc = 9000 * np.exp(-tc / 0.18) + 260
            res[i:i + blk] += np.fft.irfft(np.fft.rfft(s) / np.sqrt(1 + (f / fc) ** 4), blk)
        g = np.exp(-np.clip(tl - 0.1, 0, None) / 0.9) * 0.9 + 0.1
        g *= np.clip((12.6 - (tl + 9.95)) / 1.6, 0, 1) ** 2   # Blackout ausblenden
        out[i0:] = res[:len(seg)] * g
        return out
    mix_l, mix_r = collapse(mix_l), collapse(mix_r)
    # Tinnitus ab 10.0 s
    i0 = int(10.0 * SR); n = min(len(tin), N - i0)
    mix_l[i0:i0 + n] += tin[:n]; mix_r[i0:i0 + n] += tin[:n] * 0.92
    # Herzschlag: setzt bei 10.15 ein, verlangsamt sich, letztes dumpfes Pochen ~12.35 s
    beats = [10.15, 10.98, 11.85, 12.75]
    hb = heartbeat(beats)
    lv = [0.9, 0.85, 0.75, 0.65]
    beats = [10.15, 10.95, 11.8]
    for k, b in enumerate(beats):
        i = int(b * SR); s = hb[k] * lv[k]; m = min(len(s), N - i)
        mix_l[i:i + m] += s[:m]; mix_r[i:i + m] += s[:m]
    # letztes dumpfes Pochen (nur "lub", tiefer) bei 12.35
    n = int(0.5 * SR); tt_ = np.arange(n) / SR
    last = lp(np.sin(2 * np.pi * np.cumsum(32 + 20 * np.exp(-tt_ / 0.03)) / SR) * expd(n, 0.09), 120, 2) * 0.75
    i = int(12.35 * SR); m = min(n, N - i)
    mix_l[i:i + m] += last[:m]; mix_r[i:i + m] += last[:m]
    if RAW:
        L, R = mix_l, mix_r; return
    # Normalisieren / weiches Limiting
    mx = max(np.abs(mix_l).max(), np.abs(mix_r).max())
    mix_l /= mx; mix_r /= mx
    # transparenter Look-ahead-Peak-Limiter (nur Spitzen über -6 dBFS, v. a. Schüsse)
    from scipy.ndimage import maximum_filter1d, uniform_filter1d
    peak = maximum_filter1d(np.maximum(np.abs(mix_l), np.abs(mix_r)), int(0.004 * SR))
    thr = 0.5
    gr = np.minimum(1.0, thr / np.maximum(peak, 1e-9))
    gr = np.minimum(gr, uniform_filter1d(gr, int(0.003 * SR)))
    rel = np.exp(-1 / (0.06 * SR)); from scipy.signal import lfilter
    gr = 1 - lfilter([1 - rel], [1, -rel], 1 - gr)  # weicher Release
    gr = np.minimum(gr, thr / np.maximum(peak, 1e-9) * 1.25)
    gr = np.clip(gr, 0, 1)
    mix_l *= gr; mix_r *= gr
    # absolute Stille ab 12.9 s
    end = int(12.9 * SR)
    fade = int(0.3 * SR)
    mix_l[end - fade:end] *= np.linspace(1, 0, fade) ** 2; mix_r[end - fade:end] *= np.linspace(1, 0, fade) ** 2
    mix_l[end:] = 0; mix_r[end:] = 0
    pk = max(np.abs(mix_l).max(), np.abs(mix_r).max())
    L, R = mix_l * 0.93 / pk, mix_r * 0.93 / pk


def write(path):
    pcm = (np.clip(np.stack([L, R], 1), -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'build/audio.wav'
    tin = build()
    master(tin)
    write(out)
    print('geschrieben:', out)
