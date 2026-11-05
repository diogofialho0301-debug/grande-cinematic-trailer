// 17-24s: Your World — roleplay opportunities.
import * as THREE from 'three';
import { makeSky, makeBeam, makeParticles, makeSmoke, glowSprite, smooth, easeInOut, easeOut, shake, lerp, rng, SHARED, GOLD } from './lib.js';
import { makeEnvUniforms, makeAerialCity, makeHills, setLights } from './city.js';
import { makeCar, makeAmbulance, policePhase } from './car.js';
import { makeFigure } from './figure.js';
import { nightStreet, policeLights, penthouse, sunsetSky, makePalm, wetGround, RED, BLUE } from './sets.js';

const EPIC = { bloom: 1.0, bloomThresh: 0.72, exposure: 1.3, streak: 1.2, contrast: 1.12 };

// --- Law enforcement ---
function police() {
  const S = nightStreet({ seed: 91, fogDensity: 0.006 });
  const car = makeCar({ police: true, color: 0x050508 }); car.position.set(-1.2, 0, -1.5); car.rotation.y = 0.55; S.scene.add(car);
  const car2 = makeCar({ police: true, color: 0x050508 }); car2.position.set(4.5, 0, -12); car2.rotation.y = -0.4; S.scene.add(car2);
  const cop = makeFigure({ color: 0x0b1222, pants: 0x0a0f1a, cap: 0x0a0f1a }); cop.position.set(1.3, 0, 0.8); cop.rotation.y = -0.2; S.scene.add(cop);
  const cop2 = makeFigure({ color: 0x0b1222, pants: 0x0a0f1a, cap: 0x0a0f1a }); cop2.position.set(3.2, 0, -8); cop2.rotation.y = 0.4; S.scene.add(cop2);
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.03, 6), new THREE.MeshStandardMaterial({ color: 0xffd070, metalness: 1, roughness: 0.2, envMap: SHARED.envStudio })); badge.position.set(-0.1, 0.45, 0.13); cop.userData.torso.add(badge);
  const PL = policeLights(S.scene, 2, 70);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 6000);
  return {
    scene: S.scene, camera, K: 2, shutter: 0.5,
    update(lt, t) {
      S.tick(t); car.userData.update(t, 0); car2.userData.update(t + 0.2, 0);
      cop.userData.pose({ alz: 0.25, arz: -0.25, elL: -0.5, elR: -0.5, hy: 0.15 + lt * 0.05, hx: -0.05 });
      cop2.userData.pose({ arx: -1.2, elR: -1.3, hy: 0.4 });
      setLights(S.U, [...PL.set(0, new THREE.Vector3(-1.4, 1.6, -1.9), t, 0), ...PL.set(1, new THREE.Vector3(4.4, 1.6, -12.3), t, 0.3)]);
      S.lampsNear(0, 0, 50);
      const p = easeInOut(lt / 1.0);
      camera.position.set(lerp(3.6, 2.6, p), 0.5, lerp(5.4, 4.6, p)); camera.lookAt(0.9, 1.45, -1);
    },
    grade: { ...EPIC },
  };
}

// --- Criminal organizations ---
function crime() {
  const scene = new THREE.Scene();
  scene.add(makeSky({ zenith: 0x010102, horizon: 0x0a0706, glow: 0x140a04, stars: 0 }));
  const ground = wetGround(0x0c0b0a, 0.22, 300); scene.add(ground);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x0d0c0b, roughness: 0.9 });
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(2, 14, 120), wallMat); w.position.set(s * 9, 7, -40); scene.add(w); }
  // backlight cars
  const cars = [];
  for (const x of [-3.2, 3.2]) { const c = makeCar({ color: 0x050505, beams: true, beamInt: 0.07 }); c.position.set(x, 0, -16); c.rotation.y = 0; scene.add(c); cars.push(c);
  }
  const back = new THREE.PointLight(0xffaa50, 300, 20, 1.6); back.position.set(0, 2.5, -6.5); scene.add(back);
  const back2 = new THREE.PointLight(0xffd090, 120, 12, 1.6); back2.position.set(2.5, 3.0, -5); scene.add(back2);
  const crew = [];
  const R = rng(5);
  [[0, 0, 0x0b0b0c, true], [-1.3, -1.0, 0x0b0b0c, false], [1.3, -0.9, 0x0e0c0a, true], [-2.5, -2.0, 0x0b0b0c, false], [2.6, -2.1, 0x0b0b0c, false]].forEach(([x, z, c, coat], i) => {
    const f = makeFigure({ color: c, coat, cap: i === 3 ? 0x080808 : undefined }); f.position.set(x, 0, z); f.userData.ph = R() * 6; scene.add(f); crew.push(f);
  });
  const smoke = makeSmoke(22, new THREE.Vector3(18, 3, 18), new THREE.Color(0.8, 0.62, 0.42), 0.03, 3, [6, 11]); smoke.position.set(0, 1.5, -8); scene.add(smoke);
  scene.add(new THREE.AmbientLight(0x100c08, 0.4));
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 500);
  return {
    scene, camera, K: 2, shutter: 0.5,
    update(lt, t) {
      smoke.userData.update(t); cars.forEach((c) => c.userData.update(0, 0));
      crew.forEach((f, i) => { f.position.z = [0, -1, -0.9, -2, -2.1][i] + lt * 0.9 - 2; f.userData.walk(lt * 4.6 + f.userData.ph, 0.7); });
      const p = easeInOut(lt / 1.0);
      camera.position.set(0.3, 0.55, lerp(6.0, 5.3, p)); camera.lookAt(0, 1.55, -3);
    },
    grade: { ...EPIC, high: new THREE.Color(0.07, 0.03, -0.04) },
  };
}

// --- Emergency services ---
function ems() {
  const S = nightStreet({ seed: 101, fogDensity: 0.006 });
  const amb = makeAmbulance(); amb.position.set(-2.5, 0, -3); amb.rotation.y = 0.35; S.scene.add(amb);
  const medMat = 0x0e1a2e;
  const m1 = makeFigure({ color: medMat, pants: 0x0a1222 }); m1.position.set(0.6, 0, 0.4); S.scene.add(m1);
  const m2 = makeFigure({ color: medMat, pants: 0x0a1222 }); m2.position.set(0.6, 0, 2.9); S.scene.add(m2);
  const stretcher = new THREE.Group();
  const bed = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 2.0), new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.6 })); bed.position.y = 0.85; stretcher.add(bed);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.05), new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.8, roughness: 0.3 })); frame.position.set(0, 0.45, 0); stretcher.add(frame);
  stretcher.position.set(0.6, 0, 1.65); S.scene.add(stretcher);
  for (const f of [m1, m2]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.04, 0.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 1.2, 0.6) })); st.position.set(0, 0.2, 0); f.userData.torso.add(st); }
  const red = new THREE.PointLight(0xff1810, 0, 40, 1.4), wht = new THREE.PointLight(0xffffff, 0, 40, 1.4); S.scene.add(red); S.scene.add(wht);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 6000);
  return {
    scene: S.scene, camera, K: 2, shutter: 0.5,
    update(lt, t) {
      S.tick(t); amb.userData.update(t);
      const ph = amb.userData.phase(t);
      red.position.set(-2.3, 2.9, -2.0); wht.position.set(-2.0, 2.9, -2.0); red.intensity = ph * 90; wht.intensity = (1 - ph) * 60;
      setLights(S.U, [{ p: red.position, c: RED, i: ph * 3, r: 12 }, { p: wht.position, c: new THREE.Color(1, 1, 1), i: (1 - ph) * 0.7, r: 8 }]);
      const z = lt * 1.6;
      m1.position.z = 0.4 + z; m2.position.z = 2.9 + z; stretcher.position.z = 1.65 + z;
      m1.rotation.y = 0; m2.rotation.y = 0;
      m1.userData.walk(lt * 7, 0.9); m2.userData.walk(lt * 7 + 3, 0.9);
      m1.userData.L.armL.pivot.rotation.x = -0.9; m1.userData.L.armR.pivot.rotation.x = -0.9;
      m2.userData.L.armL.pivot.rotation.x = 0.0; m2.userData.L.armR.pivot.rotation.x = 0.0;
      S.lampsNear(0, 0, 40);
      const p = easeInOut(lt / 1.0);
      camera.position.set(lerp(6.0, 5.0, p), 0.9, lerp(7.5, 8.6, p)); camera.lookAt(-0.2, 1.3, 0.5 + z * 0.5);
    },
    grade: { ...EPIC },
  };
}

// --- Business owners ---
function business() {
  const scene = new THREE.Scene();
  const U = makeEnvUniforms({ fogColor: 0x120c08, fogDensity: 0.0007 });
  scene.add(makeSky({ zenith: 0x02030a, horizon: 0x2a180c, glow: 0x5a3010, stars: 0.6 }));
  const city = makeAerialCity(U, { seed: 19, blocks: 20, traffic: 1600, center: new THREE.Vector2(0, -450) }); scene.add(city);
  scene.add(makeHills(2600, 13, 0x050404));
  const room = penthouse(city, { lounge: false, desk: true }); room.position.set(0, 140, 40); scene.add(room);
  const boss = makeFigure({ color: 0x0b0a09, watch: true }); boss.position.set(0.5, 140, 39.8 + 0.7); boss.rotation.y = Math.PI; scene.add(boss);
  const rimB = new THREE.PointLight(0xffb060, 10, 4, 1.5); rimB.position.set(1.2, 141.9, 39.6); scene.add(rimB);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 9000);
  return {
    scene, camera, K: 2, shutter: 0.5,
    update(lt, t) {
      city.userData.update(t);
      boss.userData.pose({ alz: 0.12, arz: -0.12, elL: -0.3, elR: -0.3, alx: 0.15, arx: 0.15, hx: 0.08, hy: Math.sin(lt * 1.2) * 0.12 });
      const p = easeInOut(lt / 1.0);
      camera.position.set(lerp(2.6, 1.8, p), 140.9, 40 + lerp(5.0, 4.2, p)); camera.lookAt(lerp(-0.6, 0.0, p), 141.5, 20);
    },
    grade: { ...EPIC, exposure: 1.35 },
  };
}

// --- Civilian life (golden hour street) ---
function civilian() {
  const sunDir = new THREE.Vector3(0.0, 0.07, -1).normalize();
  const S = nightStreet({ seed: 111, fogDensity: 0.0032, fogColor: 0xc07040, day: 0.92, litProb: 0.3, sunDir: new THREE.Vector3(0.6, 0.35, -1), sunCol: 0xffa060, wet: 0.15, sky: { zenith: 0x22305a, horizon: 0xff8a40, glow: 0xff6a20, sunDir, sunColor: 0xffc080, sunSize: 0.0016, stars: 0 }, ambient: 0x6a4a3a, ambientI: 1.2, hemiSky: 0x8090c0, hemiGround: 0x6a3a1a, hemiI: 1.2, tall: 40 });
  const sun = new THREE.DirectionalLight(0xffb070, 3.0); sun.position.set(-20, 10, -80); S.scene.add(sun);
  const palms = [];
  for (let i = 0; i < 16; i++) for (const s of [-1, 1]) { const p = makePalm(i * 2 + (s > 0 ? 1 : 0), 11 + (i % 3) * 2, new THREE.MeshStandardMaterial({ color: 0x1a120a, roughness: 1 })); p.position.set(s * 12.8, 0, -i * 22 + 10 + (s > 0 ? 11 : 0)); S.scene.add(p); palms.push(p); }
  const R = rng(8); const peds = [];
  const clothes = [0x6a2a20, 0xd8c8a8, 0x2a3a5a, 0x1a1a1a, 0xe0e0e0, 0x8a6a3a, 0x3a5a3a, 0xb04030];
  for (let i = 0; i < 12; i++) {
    const side = R() < 0.5 ? -1 : 1; const dir = R() < 0.5 ? 1 : -1;
    const f = makeFigure({ color: clothes[i % clothes.length], pants: R() < 0.5 ? 0x1a2030 : 0x2a2420, skin: [0x5a3a2a, 0x8a6a50, 0xb08a6a, 0x3a2418][i % 4], dress: R() < 0.25, longHair: R() < 0.4, env: SHARED.envSunset });
    f.position.set(side * lerp(11.2, 14.0, R()), 0, -R() * 60 + 8); f.rotation.y = dir > 0 ? 0 : Math.PI; f.userData.dir = dir; f.userData.z0 = f.position.z; f.userData.ph = R() * 6; f.userData.sp = lerp(1.1, 1.5, R());
    S.scene.add(f); peds.push(f);
  }
  const traffic = [];
  [[2.5, 0x9a1a1a, 1], [-7.5, 0xd0d0d0, -1], [7.5, 0x1a2a4a, 1], [-2.5, 0x111111, -1]].forEach(([x, c, d], i) => { const car = makeCar({ color: c, env: SHARED.envSunset, metal: 0.5 }); car.position.x = x; car.rotation.y = d > 0 ? 0 : Math.PI; car.userData.d = d; car.userData.z0 = -80 + i * 35; S.scene.add(car); traffic.push(car); });
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 6000);
  return {
    scene: S.scene, camera, K: 2, shutter: 0.5,
    update(lt, t) {
      S.tick(t); palms.forEach((p) => p.userData.update(t));
      peds.forEach((f) => { f.position.z = f.userData.z0 + f.userData.dir * f.userData.sp * lt; f.userData.walk(lt * f.userData.sp * 4.2 + f.userData.ph, 0.9); });
      traffic.forEach((c) => { c.position.z = c.userData.z0 + c.userData.d * 14 * lt; c.userData.update(lt, 14); });
      setLights(S.U, []);
      const p = easeInOut(lt / 1.5);
      camera.position.set(lerp(12.6, 12.2, p), 1.7, lerp(14, 10, p)); camera.lookAt(lerp(8.0, 6.5, p), 3.4, -60);
    },
    grade: { ...EPIC, bloom: 0.9, bloomThresh: 0.85, exposure: 1.0, sat: 1.05, high: new THREE.Color(0.06, 0.02, -0.04) },
  };
}

// --- Luxury & nightlife ---
function nightlife() {
  const S = nightStreet({ seed: 121, fogDensity: 0.005 });
  const car = makeCar({ color: 0xb08a3a, metal: 1.0, rough: 0.18, envInt: 1.8 }); car.rotation.y = 0; S.scene.add(car);
  // club facade: gold neon frame on right side buildings
  const neon = new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 5, 1.8) });
  const frame = new THREE.Group(); frame.position.set(15.4, 0, -6); S.scene.add(frame);
  for (const z of [-3, 3]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 5, 0.1), neon); p.position.set(0, 2.5, z); frame.add(p); }
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 6.1), neon); top.position.set(0, 5, 0); frame.add(top);
  for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 6.1 - i * 1.2), neon); l.position.set(0, 5.5 + i * 0.5, 0); frame.add(l); }
  const glowIn = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 4.9), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.28, 0.17, 0.07) })); glowIn.rotation.y = -Math.PI / 2; glowIn.position.set(0.05, 2.45, 0); frame.add(glowIn);
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.4), new THREE.MeshStandardMaterial({ color: 0x4a0808, roughness: 0.8 })); carpet.rotation.x = -Math.PI / 2; carpet.position.set(12.4, 0.02, -6); S.scene.add(carpet);
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xd4a050, metalness: 1, roughness: 0.2, envMap: SHARED.envStudio });
  for (let i = 0; i < 5; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.0, 10), ropeMat); p.position.set(11.0, 0.5, -10 + i * 1.6); S.scene.add(p); }
  const doorL = new THREE.PointLight(0xffb060, 25, 30, 1.2); doorL.position.set(13.5, 3, -6); S.scene.add(doorL);
  const R = rng(14); const queue = [];
  for (let i = 0; i < 7; i++) { const f = makeFigure({ color: [0x0b0b0b, 0x3a1010, 0x0b0b0b, 0xc0a060, 0x0b0b0b, 0x1a1a2a, 0x0b0b0b][i], dress: i % 2 === 1, longHair: i % 2 === 1, watch: true }); f.position.set(12.6 + R() * 0.6, 0, -11 - i * 1.1); f.rotation.y = -Math.PI / 2 + (R() - 0.5) * 0.8; f.userData.ph = R() * 6; S.scene.add(f); queue.push(f); }
  const flash = new THREE.PointLight(0xffffff, 0, 30, 1.2); S.scene.add(flash);
  const confetti = makeParticles({ count: 300, seed: 21, spread: new THREE.Vector3(12, 8, 16), size: 0.06, center: new THREE.Vector3(10, 4, -6), speed: new THREE.Vector3(0, -0.6, 0) }); S.scene.add(confetti);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 6000);
  return {
    scene: S.scene, camera, K: 3, shutter: 0.6,
    update(lt, t) {
      S.tick(t); confetti.userData.update(t);
      const arrive = easeOut(lt / 1.1);
      const cz = lerp(-30, -6, arrive);
      car.position.set(7.5, 0, cz); car.userData.update(lt, (1 - arrive) * 25);
      queue.forEach((f) => f.userData.pose({ hy: Math.sin(t * 1.3 + f.userData.ph) * 0.3, alz: 0.1, arz: -0.1, elL: -0.4, elR: -0.9, arx: -0.5 }));
      flash.intensity = 0;
      [0.3, 0.52, 0.7, 0.95, 1.1].forEach((f, i) => { const d = lt - f; if (d > 0 && d < 0.05) { flash.intensity = 700 * (1 - d / 0.05); flash.position.set(10 - i * 0.6, 1.8, -2 - i * 1.5); } });
      setLights(S.U, [{ p: new THREE.Vector3(13, 3, -6), c: new THREE.Color(1, 0.7, 0.3), i: 6, r: 10 }, { p: new THREE.Vector3(7.5, 0.6, cz + 6), c: new THREE.Color(1, 0.95, 0.85), i: 3, r: 6 }]);
      S.lampsNear(cz, 0, 60);
      const p = easeInOut(lt / 1.5);
      camera.position.set(lerp(2.0, 3.0, p), 0.6, lerp(6.0, 4.0, p)); camera.lookAt(lerp(9.5, 9.8, p), 1.2, -10);
    },
    grade: { ...EPIC, high: new THREE.Color(0.07, 0.03, -0.04) },
  };
}

export const D_SHOTS = [
  { id: 'police', t0: 17.0, t1: 18.0, make: police, lightScale: 0.15 },
  { id: 'crime', t0: 18.0, t1: 19.0, make: crime, lightScale: 0.15 },
  { id: 'ems', t0: 19.0, t1: 20.0, make: ems, lightScale: 0.25 },
  { id: 'business', t0: 20.0, t1: 21.0, make: business },
  { id: 'civilian', t0: 21.0, t1: 22.5, make: civilian },
  { id: 'nightlife', t0: 22.5, t1: 24.0, make: nightlife, lightScale: 0.3 },
];
