// GRANDE — cinematic trailer renderer. Exposes window.renderFrame(f) for the headless capture driver.
import * as THREE from 'three';
import { Post } from './post.js';
import { Overlay } from './overlay.js';
import { initShared, clamp, smooth } from './lib.js';
import { SHOTS } from './shots.js';

export const FPS = 60, W = 1920, H = 804;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
initShared(renderer);
const post = new Post(renderer, W, H);
const overlay = new Overlay(document.getElementById('ov'));

const built = new Map();
function getShot(i) {
  if (!built.has(i)) {
    const s = SHOTS[i];
    const inst = s.make({ renderer, W, H });
    inst.camera.aspect = W / H; inst.camera.updateProjectionMatrix();
    inst.lights = []; inst.scene.traverse((o) => { if (o.isLight && !o.isAmbientLight && !o.isHemisphereLight) inst.lights.push(o); });
    built.set(i, inst);
  }
  return built.get(i);
}
function shotIndexAt(t) {
  for (let i = 0; i < SHOTS.length; i++) if (t >= SHOTS[i].t0 && t < SHOTS[i].t1) return i;
  return SHOTS.length - 1;
}

// Global edit-level grade events (fades, flashes on hits).
function globalGrade(t) {
  const g = { fade: 0, flash: new THREE.Color(0, 0, 0) };
  g.fade = Math.max(g.fade, 1 - smooth(0.5, 3.0, t));                    // open from black
  const flash = (tc, amt, dur, col = [1, 0.85, 0.6]) => { const d = t - tc; if (d >= 0 && d < dur) { const a = amt * Math.pow(1 - d / dur, 2.2); g.flash.r += col[0] * a; g.flash.g += col[1] * a; g.flash.b += col[2] * a; } };
  flash(5.0, 1.2, 0.18); flash(10.0, 3.0, 0.3, [1, 1, 1]); flash(17.0, 2.0, 0.25); flash(19.0, 1.2, 0.2); flash(21.0, 1.2, 0.2);
  for (const tc of [6.0, 6.75, 7.5, 8.25, 9.0]) flash(tc, 0.35, 0.1);
  for (const tc of [11.25, 12.0, 13.0, 14.0, 14.75, 16.0]) flash(tc, 0.16, 0.07, [1, 1, 1]);
  return g;
}

let ready = false;
async function init() {
  await document.fonts.load('700 40px Cinzel'); await document.fonts.load('900 40px Cinzel');
  await document.fonts.load('300 40px Montserrat'); await document.fonts.load('600 40px Montserrat');
  for (const s of SHOTS) if (s.preload) await s.preload();
  ready = true;
}
const initP = init();

window.renderFrame = async function (f) {
  await initP;
  const t = f / FPS;
  const si = shotIndexAt(t); const s = SHOTS[si]; const shot = getShot(si);
  const K = shot.K ?? 2; const shutter = shot.shutter ?? 0.5;
  const gg = globalGrade(t);
  const base = typeof shot.grade === 'function' ? shot.grade(t - s.t0, t) : (shot.grade ?? {});
  const g = { ...base, fade: Math.max(base.fade ?? 0, gg.fade), flash: (base.flash ? base.flash.clone() : new THREE.Color(0, 0, 0)).add(gg.flash), seed: (f * 7.31) % 100 };
  post.frame(K, (k, rt) => {
    const dt = K > 1 ? ((k + 0.5) / K - 0.5) * shutter / FPS : 0;
    const st = t + dt; const lt = st - s.t0;
    shot.update(lt, st, s.t1 - s.t0);
    const cam = shot.camera;
    const jx = K > 1 ? ((k * 0.618) % 1) - 0.5 : 0, jy = K > 1 ? ((k * 0.382 + 0.25) % 1) - 0.5 : 0;
    cam.setViewOffset(W, H, jx, jy, W, H);
    const ls = shot.lightScale ?? s.lightScale ?? 1;
    for (const l of shot.lights) { l.userData.base = l.intensity; l.intensity *= ls; }
    renderer.setRenderTarget(rt);
    renderer.render(shot.scene, cam);
    for (const l of shot.lights) l.intensity = l.userData.base;
    cam.clearViewOffset();
  }, g);
  overlay.update(t);
  return si;
};
window.isReady = () => ready;
window.SHOT_LIST = SHOTS.map((s) => ({ id: s.id, t0: s.t0, t1: s.t1 }));
