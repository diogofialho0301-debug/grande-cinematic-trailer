// Reusable sets: night street, sunset sky, palms, interior rooms.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeSky, rng, lerp, SHARED, glowSprite, makeSmoke } from './lib.js';
import { makeEnvUniforms, makeStreet, setLights } from './city.js';
import { policePhase } from './car.js';

export const RED = new THREE.Color(1.0, 0.05, 0.03), BLUE = new THREE.Color(0.08, 0.25, 1.0), WARM = new THREE.Color(1.0, 0.7, 0.35);

export function nightStreet(o = {}) {
  const scene = new THREE.Scene();
  const U = makeEnvUniforms({ fogColor: o.fogColor ?? 0x0c0a0c, fogDensity: o.fogDensity ?? 0.006, day: o.day ?? 0, litProb: o.litProb ?? 1, sunDir: o.sunDir, sunCol: o.sunCol, winGain: o.winGain ?? 1 });
  const sky = makeSky(o.sky ?? { zenith: 0x010207, horizon: 0x1a110b, glow: 0x3a200c, stars: 0.4 });
  scene.add(sky);
  const street = makeStreet(U, { seed: o.seed ?? 21, wet: o.wet ?? 1, tall: o.tall ?? 70 });
  scene.add(street);
  scene.add(new THREE.AmbientLight(o.ambient ?? 0x2a2020, o.ambientI ?? 0.5));
  const hemi = new THREE.HemisphereLight(o.hemiSky ?? 0x1a2235, o.hemiGround ?? 0x2a1a0a, o.hemiI ?? 0.6); scene.add(hemi);
  const lamp = new THREE.PointLight(0xffb060, 0, 30, 1.6); scene.add(lamp);
  const lamp2 = new THREE.PointLight(0xffb060, 0, 30, 1.6); scene.add(lamp2);
  return {
    scene, U, sky, street, lamp, lamp2,
    // move key lights to the nearest street lamps around position z
    lampsNear(z, x = 0, gain = 60) {
      const z1 = Math.round(z / 30) * 30, z2 = Math.round((z - 15) / 30) * 30 + 15;
      lamp.position.set(-11.5, 7.7, z1); lamp2.position.set(11.5, 7.7, z2);
      lamp.intensity = gain * Math.exp(-((z - z1) ** 2) / 300); lamp2.intensity = gain * Math.exp(-((z - z2) ** 2) / 300);
    },
    tick(t) { U.uTime.value = t; sky.material.uniforms.uTime.value = t; },
  };
}

// Police strobe helper: returns PointLights (red, blue) + updates env dynamic lights.
export function policeLights(scene, n = 1, power = 40) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    const r = new THREE.PointLight(0xff1008, 0, 40, 1.5), b = new THREE.PointLight(0x1040ff, 0, 40, 1.5);
    scene.add(r); scene.add(b); arr.push({ r, b });
  }
  return {
    arr,
    set(i, pos, t, off = 0, gain = 1) {
      const ph = policePhase(t, off); const L = arr[i];
      L.r.position.set(pos.x - 0.4, pos.y, pos.z); L.b.position.set(pos.x + 0.4, pos.y, pos.z);
      L.r.intensity = ph.r * power * gain; L.b.intensity = ph.b * power * gain * 1.3;
      return [{ p: L.r.position, c: RED, i: ph.r * 1.6 * gain, r: 10 }, { p: L.b.position, c: BLUE, i: ph.b * 2.2 * gain, r: 10 }];
    },
  };
}

export function sunsetSky(o = {}) {
  const sunDir = (o.sunDir ?? new THREE.Vector3(0.0, 0.04, -1)).clone().normalize();
  return makeSky({ zenith: o.zenith ?? 0x0f1430, horizon: o.horizon ?? 0xff7a2a, glow: o.glow ?? 0xff5a10, sunDir, sunColor: 0xffb060, sunSize: o.sunSize ?? 0.0009, stars: 0 });
}

export function makePalm(seed = 1, h = 10, mat) {
  const R = rng(seed); const g = new THREE.Group();
  mat = mat ?? new THREE.MeshStandardMaterial({ color: 0x050302, roughness: 1 });
  const lean = (R() - 0.5) * 0.12;
  const trunkG = new THREE.CylinderGeometry(0.16, 0.26, h, 8, 12); trunkG.translate(0, h / 2, 0);
  const p = trunkG.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + lean * y * y / h); }
  trunkG.computeVertexNormals(); g.add(new THREE.Mesh(trunkG, mat));
  const top = new THREE.Vector3(lean * h, h, 0);
  const leafShape = new THREE.Shape(); const L = 4.2;
  leafShape.moveTo(0, 0);
  for (let i = 0; i <= 12; i++) { const x = (i / 12) * L; leafShape.lineTo(x, Math.sin((i / 12) * Math.PI) * 0.55 * (i % 2 ? 1 : 0.6)); }
  for (let i = 12; i >= 0; i--) { const x = (i / 12) * L; leafShape.lineTo(x, -Math.sin((i / 12) * Math.PI) * 0.55 * (i % 2 ? 1 : 0.6)); }
  const leafG = new THREE.ShapeGeometry(leafShape, 1);
  const lp = leafG.attributes.position;
  for (let i = 0; i < lp.count; i++) { const x = lp.getX(i); lp.setZ(i, -0.09 * x * x); }
  leafG.rotateX(-Math.PI / 2); // leaf lies in XZ, droops in -Y
  const lm = mat.clone(); lm.side = THREE.DoubleSide;
  const fronds = new THREE.Group(); fronds.position.copy(top); g.add(fronds);
  const n = 11;
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(leafG, lm); const a = (i / n) * Math.PI * 2 + R() * 0.3;
    m.rotation.order = 'YZX'; m.rotation.y = a; m.rotation.z = 0.15 + R() * 0.25 - 0.1; fronds.add(m);
  }
  g.userData.fronds = fronds;
  g.userData.update = (t) => { fronds.rotation.z = Math.sin(t * 0.9 + seed) * 0.03; fronds.rotation.x = Math.cos(t * 0.7 + seed) * 0.03; };
  return g;
}

// Penthouse / office interior overlooking a city group.
export function penthouse(cityGroup, o = {}) {
  const g = new THREE.Group();
  const env = SHARED.envNight;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 10), new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.22, metalness: 0.3, envMap: env, envMapIntensity: 1.0 }));
  floor.rotation.x = -Math.PI / 2; floor.position.z = 4; g.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(40, 10), new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.9 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 3.6, 4); g.add(ceil);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(40, 4), new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.7 })); back.position.set(0, 2, 9); back.rotation.y = Math.PI; g.add(back);
  // window mullions along z = -1 (looking -z out to the city)
  const mull = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.4, metalness: 0.8, envMap: env });
  for (let x = -20; x <= 20; x += 2.6) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.6, 0.12), mull); m.position.set(x, 1.8, -1); g.add(m); }
  const sill = new THREE.Mesh(new THREE.BoxGeometry(40, 0.1, 0.3), mull); sill.position.set(0, 0.05, -1); g.add(sill);
  const top = new THREE.Mesh(new THREE.BoxGeometry(40, 0.2, 0.3), mull); top.position.set(0, 3.5, -1); g.add(top);
  // faint glass reflection plane
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(40, 3.6), new THREE.MeshBasicMaterial({ color: 0x0a0806, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
  glass.position.set(0, 1.8, -1.02); g.add(glass);
  // recessed ceiling lights
  for (let x = -12; x <= 12; x += 3) for (const z of [2, 6]) { const l = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.3, 0.7) })); l.rotation.x = Math.PI / 2; l.position.set(x, 3.58, z); g.add(l); }
  const gold = new THREE.MeshStandardMaterial({ color: 0xd4a050, metalness: 1, roughness: 0.2, envMap: SHARED.envStudio });
  const leather = new THREE.MeshStandardMaterial({ color: 0x0d0b0a, roughness: 0.45, envMap: env, envMapIntensity: 0.5 });
  if (o.lounge !== false) {
    const sofa = new THREE.Mesh(new RoundedBoxGeometry(3.4, 0.45, 1.0, 3, 0.12), leather); sofa.position.set(-5.2, 0.32, 3.2); g.add(sofa);
    const sback = new THREE.Mesh(new RoundedBoxGeometry(3.4, 0.6, 0.25, 3, 0.1), leather); sback.position.set(-5.2, 0.75, 3.62); g.add(sback);
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.05, 32), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.05, metalness: 0.2, envMap: env })); table.position.set(-5.2, 0.42, 1.9); g.add(table);
    const tleg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.25, 0.4, 16), gold); tleg.position.set(-5.2, 0.2, 1.9); g.add(tleg);
  }
  if (o.desk) {
    const desk = new THREE.Mesh(new RoundedBoxGeometry(2.4, 0.08, 1.0, 2, 0.03), new THREE.MeshStandardMaterial({ color: 0x080706, roughness: 0.15, metalness: 0.3, envMap: env })); desk.position.set(0.8, 0.76, 1.6); g.add(desk);
    for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.76, 0.9), gold); leg.position.set(0.8 + s * 1.1, 0.38, 1.6); g.add(leg); }
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.34), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.75, 1.2) })); screen.position.set(0.5, 0.98, 1.85); screen.rotation.y = Math.PI; screen.rotation.x = -0.25; g.add(screen);
    const lampS = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 1.6, 0.7) })); lampS.position.set(1.7, 1.25, 1.7); g.add(lampS);
    const lampL = new THREE.PointLight(0xffaa55, 4, 6, 1.5); lampL.position.copy(lampS.position); g.add(lampL);
  }
  // pendant lights
  for (const x of [-7.5, -6.3]) {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 1.4), gold); cord.position.set(x, 2.9, 1.9); g.add(cord);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.4, 0.6) })); bulb.position.set(x, 2.15, 1.9); g.add(bulb);
  }
  const warm = new THREE.PointLight(0xffa050, 18, 12, 1.4); warm.position.set(-3.0, 2.2, 2.4); g.add(warm);
  const fill = new THREE.PointLight(0xffc080, 6, 14, 1.2); fill.position.set(3, 3, 5); g.add(fill);
  g.add(new THREE.AmbientLight(0x221a12, 0.5));
  return g;
}

export function wetGround(color = 0x0a0a0b, rough = 0.18, size = 400) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.5, envMap: SHARED.envNight, envMapIntensity: 0.9 }));
  m.rotation.x = -Math.PI / 2; return m;
}

export { setLights };
