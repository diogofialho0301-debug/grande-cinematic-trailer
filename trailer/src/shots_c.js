// 10-17s: The Dark Side — robbery prep, police, helicopter, meeting, gunfire, chase.
import * as THREE from 'three';
import { makeSky, makeBeam, makeParticles, makeSmoke, glowSprite, smooth, easeInOut, easeOut, easeIn, shake, lerp, rng, SHARED } from './lib.js';
import { makeEnvUniforms, makeAerialCity, makeHills, setLights } from './city.js';
import { makeCar, makeHelicopter, policePhase } from './car.js';
import { makeFigure } from './figure.js';
import { nightStreet, policeLights, wetGround, RED, BLUE } from './sets.js';

const DARK = { shadow: new THREE.Color(-0.02, 0.01, 0.035), high: new THREE.Color(0.02, 0.02, 0.0), sat: 0.85, contrast: 1.15 };

// --- Robbery preparation ---
function robbery() {
  const scene = new THREE.Scene();
  const concrete = new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.85 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), concrete); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 10), new THREE.MeshStandardMaterial({ color: 0x1c1b1a, roughness: 0.9 })); wall.position.set(0, 5, -6); scene.add(wall);
  // window strip with cold light
  const win = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.45, 0.8) })); win.position.set(-4, 3.6, -5.95); scene.add(win);
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.05), new THREE.MeshBasicMaterial({ color: 0x000000 })); b.position.set(-6.5 + i, 3.6, -5.9); scene.add(b); }
  const cold = new THREE.DirectionalLight(0x4a78c0, 2.2); cold.position.set(-4, 4, -6); scene.add(cold);
  const back = new THREE.PointLight(0x6a90d0, 18, 10, 1.4); back.position.set(0.5, 2.6, -3.5); scene.add(back);
  // table + gear
  const wood = new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.7 });
  const table = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 1.2), wood); table.position.set(0, 0.9, 0); scene.add(table);
  for (const [x, z] of [[-1.1, -0.5], [1.1, -0.5], [-1.1, 0.5], [1.1, 0.5]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.9, 0.07), wood); l.position.set(x, 0.45, z); scene.add(l); }
  const bagMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.6, envMap: SHARED.envNight, envMapIntensity: 0.4 });
  const bag1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.6, 6, 12), bagMat); bag1.rotation.z = Math.PI / 2; bag1.position.set(-0.55, 1.15, 0.05); scene.add(bag1);
  const bag2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.5, 6, 12), bagMat); bag2.rotation.z = Math.PI / 2; bag2.rotation.y = 0.4; bag2.position.set(0.55, 1.12, -0.2); scene.add(bag2);
  const gunMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.35, metalness: 0.8, envMap: SHARED.envNight });
  const rifle = new THREE.Group();
  const rb = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.07, 0.05), gunMat); rifle.add(rb);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.04), gunMat); mag.position.set(0.05, -0.1, 0); mag.rotation.z = 0.2; rifle.add(mag);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.045), gunMat); stock.position.set(-0.42, -0.03, 0); rifle.add(stock);
  rifle.position.set(0.25, 0.97, 0.35); rifle.rotation.set(Math.PI / 2, 0, 0.3); scene.add(rifle);
  // blueprint
  const plan = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.55), new THREE.MeshStandardMaterial({ color: 0x1a3050, roughness: 0.9, emissive: 0x050a14 })); plan.rotation.x = -Math.PI / 2; plan.position.set(0.1, 0.945, 0.1); scene.add(plan);
  const cash = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.08), new THREE.MeshStandardMaterial({ color: 0x3a4a2a, roughness: 0.8 }));
  for (let i = 0; i < 5; i++) { const c = cash.clone(); c.position.set(-0.9 + i * 0.05, 0.97 + (i % 2) * 0.06, 0.4 - (i % 3) * 0.05); c.rotation.y = i * 0.3; scene.add(c); }
  // crew (masked)
  const crew = [];
  [[-1.5, -0.3, 1.2, 0xd8d2c4], [0.2, -1.1, 0.1, 0x1a1a1a], [1.55, 0.2, -1.3, 0xc8c0b0]].forEach(([x, z, ry, mask], i) => {
    const f = makeFigure({ color: 0x0d0d0f, mask, hood: i === 1, hair: false }); f.position.set(x, 0, z); f.rotation.y = ry; scene.add(f); crew.push(f);
  });
  // swinging lamp
  const lamp = new THREE.Group(); lamp.position.set(0, 3.6, 0); scene.add(lamp);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.2), new THREE.MeshBasicMaterial({ color: 0x050505 })); cord.position.y = -0.6; lamp.add(cord);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.25, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.4 })); shade.position.y = -1.25; lamp.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(14, 9, 4) })); bulb.position.y = -1.36; lamp.add(bulb);
  const spot = new THREE.SpotLight(0xffc27a, 55, 12, 0.95, 0.6, 1.4);
  const fillL = new THREE.PointLight(0xffb070, 4, 6, 1.4); fillL.position.set(0, 2.3, 0.4); scene.add(fillL); spot.position.y = -1.36; lamp.add(spot); spot.target.position.set(0, -6, 0); lamp.add(spot.target);
  const beam = makeBeam(new THREE.Color(1.0, 0.8, 0.5), 3.0, 1.9, 0.06); beam.position.y = -1.36; lamp.add(beam);
  scene.add(new THREE.AmbientLight(0x101820, 0.5));
  const smoke = makeSmoke(14, new THREE.Vector3(8, 2, 6), new THREE.Color(0.5, 0.45, 0.4), 0.12, 2, [3, 6]); smoke.position.set(0, 2.2, 0); scene.add(smoke);
  const dust = makeParticles({ count: 400, seed: 2, spread: new THREE.Vector3(3, 3, 3), size: 0.03, center: new THREE.Vector3(0, 1.8, 0), speed: new THREE.Vector3(0.05, -0.04, 0.02), color: new THREE.Color(1, 0.85, 0.6) }); scene.add(dust);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 200);
  return {
    scene, camera, K: 2, shutter: 0.5,
    update(lt, t) {
      lamp.rotation.z = Math.sin(lt * 2.4) * 0.12; lamp.rotation.x = Math.cos(lt * 1.9) * 0.05;
      smoke.userData.update(t); dust.userData.update(t);
      crew[0].userData.pose({ alx: -0.9, arx: -0.8, elL: -1.0, elR: -1.1, tx: 0.25, hx: 0.35 });
      crew[1].userData.pose({ alx: -0.6 + Math.sin(lt * 5) * 0.1, arx: -1.0, elL: -1.2, elR: -0.9, tx: 0.15, hx: 0.25, hy: Math.sin(lt * 1.5) * 0.2 });
      crew[2].userData.pose({ alx: -1.3 + Math.min(lt, 0.6) * 0.8, arx: -0.6, elL: -1.4, elR: -0.4, tx: 0.2, hx: 0.3 });
      const p = easeInOut(lt / 1.25);
      camera.position.set(lerp(0.9, 0.5, p), lerp(1.55, 1.7, p), lerp(3.9, 3.1, p)).add(shake(t, 0.025, 1.5, 11));
      camera.lookAt(-0.1, 1.15, -0.4);
    },
    grade: { ...DARK, bloom: 0.8, bloomThresh: 0.8, exposure: 1.35, streak: 0.9 },
  };
}

// --- Police vehicles racing past ---
function policePass() {
  const S = nightStreet({ seed: 52, fogDensity: 0.006, ambientI: 0.3 });
  const cops = [makeCar({ police: true, color: 0x050508, beams: true }), makeCar({ police: true, color: 0x050508, beams: true })];
  cops.forEach((c) => { c.rotation.y = Math.PI; S.scene.add(c); });
  const PL = policeLights(S.scene, 2, 80);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 6000);
  return {
    scene: S.scene, camera, K: 5, shutter: 0.7,
    update(lt, t) {
      S.tick(t);
      const v = 60;
      const zc = 30 - v * lt;
      cops[0].position.set(-2.6, 0, zc); cops[1].position.set(2.4, 0, zc + 11);
      cops.forEach((c) => c.userData.update(t, v));
      const L = [...PL.set(0, new THREE.Vector3(-2.6, 1.6, zc + 0.5), t, 0), ...PL.set(1, new THREE.Vector3(2.4, 1.6, zc + 11.5), t, 0.23)];
      setLights(S.U, L);
      S.lampsNear(0, 0, 60);
      const camZ = -6;
      camera.position.set(8.2, 0.7, camZ).add(shake(t, 0.05, 5, 2));
      const look = new THREE.Vector3(-0.5, 1.0, Math.max(cops[0].position.z + 2, camZ - 4));
      camera.lookAt(look);
    },
    grade: { ...DARK, bloom: 1.0, bloomThresh: 0.7, exposure: 1.3, streak: 1.3 },
  };
}

// --- Helicopter searchlight ---
function helicopter() {
  const scene = new THREE.Scene();
  const U = makeEnvUniforms({ fogColor: 0x070a10, fogDensity: 0.0011 });
  scene.add(makeSky({ zenith: 0x010207, horizon: 0x0c1018, glow: 0x101828, stars: 0.5 }));
  const city = makeAerialCity(U, { seed: 31, blocks: 18, traffic: 1500, center: new THREE.Vector2(200, -400) }); scene.add(city);
  const heli = makeHelicopter(); scene.add(heli);
  heli.add(new THREE.PointLight(0x8090a0, 4, 20));
  const beam = makeBeam(new THREE.Color(0.85, 0.92, 1.0), 1, 1, 0.5); scene.add(beam);
  const smoke = makeSmoke(10, new THREE.Vector3(200, 40, 200), new THREE.Color(0.3, 0.35, 0.45), 0.1, 6, [60, 120]); smoke.position.set(0, 60, 0); scene.add(smoke);
  scene.add(new THREE.AmbientLight(0x202838, 0.6));
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 9000);
  const tgt = new THREE.Vector3(), lampW = new THREE.Vector3(), dir = new THREE.Vector3();
  return {
    scene, camera, K: 3, shutter: 0.6,
    update(lt, t) {
      city.userData.update(t); smoke.userData.update(t);
      heli.position.set(lerp(-20, -6, lt), 125, lerp(30, 18, lt)); heli.rotation.set(0.12, 0.6 + lt * 0.1, -0.08); heli.userData.update(t);
      heli.updateMatrixWorld(); lampW.copy(heli.userData.lampPos).applyMatrix4(heli.matrixWorld);
      tgt.set(lerp(-40, 30, easeInOut(lt)), 0, lerp(-80, -60, lt) + Math.sin(lt * 4) * 6);
      dir.subVectors(tgt, lampW); const len = dir.length(); dir.normalize();
      beam.position.copy(lampW); beam.scale.set(len * 0.09, len, len * 0.09);
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
      U.uSpotPos.value.copy(lampW); U.uSpotDir.value.copy(dir); U.uSpotCos.value = Math.cos(Math.atan(0.09)); U.uSpotCol.value.setRGB(2.4, 2.6, 3.0);
      const lt2 = t;
      const ph = policePhase(lt2), ph2 = policePhase(lt2, 0.3);
      setLights(U, [
        { p: new THREE.Vector3(tgt.x - 30, 2, tgt.z + 10), c: RED, i: ph.r * 8, r: 20 }, { p: new THREE.Vector3(tgt.x - 30, 2, tgt.z + 12), c: BLUE, i: ph.b * 10, r: 20 },
        { p: new THREE.Vector3(tgt.x - 55, 2, tgt.z + 6), c: RED, i: ph2.r * 8, r: 20 }, { p: new THREE.Vector3(tgt.x - 55, 2, tgt.z + 8), c: BLUE, i: ph2.b * 10, r: 20 },
      ]);
      camera.position.set(lerp(-34, -26, lt), 138, lerp(66, 58, lt)).add(shake(t, 0.25, 2.5, 5));
      camera.lookAt(lerp(-16, -4, lt), 70, -60);
    },
    grade: { ...DARK, bloom: 0.9, bloomThresh: 0.75, exposure: 1.4, streak: 1.1, shadow: new THREE.Color(-0.02, 0.01, 0.05) },
  };
}

// --- Criminal meeting ---
function meeting() {
  const scene = new THREE.Scene();
  const ground = wetGround(0x121212, 0.3, 120); scene.add(ground);
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.9 });
  for (let i = -3; i <= 3; i++) for (const z of [-9, 9]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.9, 6, 0.9), pillarMat); p.position.set(i * 7, 3, z); scene.add(p); }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), pillarMat); ceil.rotation.x = Math.PI / 2; ceil.position.y = 6; scene.add(ceil);
  const tube = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.1), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 4, 4.5) })); tube.position.set(0, 5.9, -6); scene.add(tube);
  const tubeL = new THREE.PointLight(0x9fc0ff, 25, 18, 1.3); tubeL.position.set(0, 5.6, -6); scene.add(tubeL);
  const carA = makeCar({ color: 0x08080a, beams: true, beamInt: 0.1 }); carA.position.set(-7.5, 0, 0); carA.rotation.y = Math.PI / 2; scene.add(carA);
  const carB = makeCar({ color: 0x1a1408, beams: true, beamInt: 0.1 }); carB.position.set(7.5, 0, 0.4); carB.rotation.y = -Math.PI / 2; scene.add(carB);
  for (const [car, sx] of [[carA, 1], [carB, -1]]) {
    const s = new THREE.SpotLight(0xfff0d8, 160, 40, 0.42, 0.5, 1.2); s.position.set(car.position.x + sx * 2.3, 0.7, car.position.z); s.target.position.set(car.position.x + sx * 20, 0, car.position.z); scene.add(s); scene.add(s.target);
  }
  const figs = [];
  [[-2.2, 0.3, 1], [-3.6, -1.4, 1], [-3.8, 1.6, 1], [2.2, 0.2, -1], [3.5, 1.5, -1], [3.7, -1.2, -1]].forEach(([x, z, s], i) => {
    const f = makeFigure({ color: i < 3 ? 0x0a0a0c : 0x14100a, coat: i === 0 || i === 3 }); f.position.set(x, 0, z); f.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(f); figs.push(f);
  });
  const case_ = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.32, 0.1), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.9, roughness: 0.25, envMap: SHARED.envNight })); case_.position.set(0, -0.32, 0.05); figs[0].userData.L.armR.knee.add(case_);
  const smoke = makeSmoke(18, new THREE.Vector3(24, 3, 10), new THREE.Color(0.6, 0.6, 0.62), 0.045, 8, [5, 10]); smoke.position.set(0, 1.5, 0); scene.add(smoke);
  scene.add(new THREE.AmbientLight(0x101418, 0.5));
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400);
  return {
    scene, camera, K: 2, shutter: 0.5,
    update(lt, t) {
      smoke.userData.update(t); carA.userData.update(0, 0); carB.userData.update(0, 0);
      tubeL.intensity = (Math.sin(t * 37) > 0.7 && (t % 0.9) < 0.2) ? 6 : 25; tube.visible = tubeL.intensity > 10;
      figs[0].userData.pose({ arx: -0.6 + easeInOut(lt / 1.0) * 0.1, elR: -0.9, hx: 0.05 });
      figs[3].userData.pose({ alx: -0.5 * easeInOut(lt / 1.0), elL: -0.8 });
      const p = easeInOut(lt / 1.0);
      camera.position.set(lerp(-1.8, 1.2, p), 0.85, lerp(9.0, 8.4, p)).add(shake(t, 0.015, 1.2, 9));
      camera.lookAt(0, 1.3, 0);
    },
    grade: { ...DARK, bloom: 1.0, bloomThresh: 0.75, exposure: 1.25, streak: 1.3 },
  };
}

// --- Gunfire in the distance ---
function gunfire() {
  const S = nightStreet({ seed: 63, fogDensity: 0.0055, ambientI: 0.25, winGain: 0.7 });
  const flashes = []; const shots = [0.06, 0.16, 0.22, 0.38, 0.47, 0.6];
  const fl = glowSprite(new THREE.Color(10, 7, 3), 6); S.scene.add(fl);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 6000);
  const muzzle = new THREE.Vector3(3, 1.5, -170);
  const cop = makeCar({ police: true }); cop.position.set(-4, 0, -200); cop.rotation.y = 0.9; S.scene.add(cop);
  return {
    scene: S.scene, camera, K: 2, shutter: 0.5,
    update(lt, t) {
      S.tick(t); cop.userData.update(t, 0);
      let f = 0; for (const s of shots) { const d = lt - s; if (d >= 0 && d < 0.05) f = Math.max(f, 1 - d / 0.05); }
      fl.position.copy(muzzle); fl.scale.setScalar(4 + f * 10); fl.material.opacity = f;
      const ph = policePhase(t);
      setLights(S.U, [
        { p: muzzle, c: new THREE.Color(1, 0.7, 0.3), i: f * 30, r: 12 },
        { p: new THREE.Vector3(-4, 1.6, -200), c: RED, i: ph.r * 4, r: 14 }, { p: new THREE.Vector3(-3.4, 1.6, -200), c: BLUE, i: ph.b * 5, r: 14 },
      ]);
      S.lampsNear(-12, 0, 40);
      const zoom = easeOut(lt / 0.2);
      camera.fov = lerp(34, 22, zoom); camera.updateProjectionMatrix();
      const kick = f * 0.12;
      camera.position.set(-6, 4.5, 0).add(shake(t, 0.08 + kick, 6, 3)); camera.lookAt(1, 2.0, -170);
    },
    grade: { ...DARK, bloom: 1.0, bloomThresh: 0.7, exposure: 1.3, streak: 1.4 },
  };
}

// --- High-speed chase (rear) ---
function chaseRear() {
  const S = nightStreet({ seed: 71, fogDensity: 0.0042 });
  const runner = makeCar({ color: 0x8a6418, metal: 0.95, rough: 0.2, envInt: 2.2 }); S.scene.add(runner);
  const cops = [makeCar({ police: true, color: 0x0a0a10, beams: true, beamInt: 0.1 }), makeCar({ police: true, color: 0x0a0a10, beams: true, beamInt: 0.1 })]; cops.forEach((c) => S.scene.add(c));
  const PL = policeLights(S.scene, 2, 70);
  const sparks = makeParticles({ count: 120, seed: 3, spread: new THREE.Vector3(1.5, 0.3, 4), size: 0.05, color: new THREE.Color(1, 0.6, 0.2), speed: new THREE.Vector3(0, 0, -12) }); S.scene.add(sparks);
  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 6000);
  return {
    scene: S.scene, camera, K: 5, shutter: 0.7,
    update(lt, t) {
      S.tick(t); sparks.userData.update(t);
      const v = 52; const z = -300 + v * lt;
      const xr = Math.sin(lt * 2.6) * 3.2;
      runner.position.set(xr, 0, z + 14); runner.rotation.y = Math.cos(lt * 2.6) * 0.12; runner.userData.update(t, v);
      cops[0].position.set(Math.sin(lt * 2.6 - 0.7) * 3.4 - 1, 0, z + 5); cops[0].rotation.y = Math.cos(lt * 2.6 - 0.7) * 0.1;
      cops[1].position.set(4.5 + Math.sin(lt * 2.0) * 1.5, 0, z - 4); cops.forEach((c) => c.userData.update(t, v));
      sparks.position.set(xr, 0.2, z + 12);
      const L = [...PL.set(0, new THREE.Vector3(cops[0].position.x, 1.6, z + 4.5), t, 0), ...PL.set(1, new THREE.Vector3(cops[1].position.x, 1.6, z - 4.5), t, 0.3),
        { p: new THREE.Vector3(xr, 0.7, z + 11.5), c: new THREE.Color(1, 0.05, 0.02), i: 0.7, r: 2 }];
      setLights(S.U, L);
      S.lampsNear(z + 14, 0, 170);
      camera.position.set(xr + 3.3, 0.75, z + 14 + 3.4).add(shake(t, 0.06, 8, 5));
      camera.lookAt(xr + 0.2, 0.75, z + 7); camera.rotateZ(Math.sin(t * 2.3) * 0.03);
    },
    grade: { ...DARK, bloom: 1.0, bloomThresh: 0.7, exposure: 1.7, streak: 1.3 },
  };
}

// --- Chase (front, cars blast past camera) ---
function chaseFront() {
  const S = nightStreet({ seed: 82, fogDensity: 0.005 });
  const runner = makeCar({ color: 0x8a6418, metal: 0.95, rough: 0.2, beams: true }); runner.rotation.y = Math.PI; S.scene.add(runner);
  const cops = [makeCar({ police: true, beams: true }), makeCar({ police: true, beams: true })]; cops.forEach((c) => { c.rotation.y = Math.PI; S.scene.add(c); });
  const PL = policeLights(S.scene, 2, 80);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 6000);
  return {
    scene: S.scene, camera, K: 5, shutter: 0.75,
    update(lt, t) {
      S.tick(t);
      const v = 62; const z = 28 - v * lt;
      runner.position.set(-1.5 + Math.sin(lt * 3) * 1.0, 0, z); runner.userData.update(t, v);
      cops[0].position.set(-3.5, 0, z + 9); cops[1].position.set(1.5, 0, z + 17); cops.forEach((c) => c.userData.update(t, v));
      const L = [...PL.set(0, new THREE.Vector3(-3.5, 1.6, z + 9.5), t, 0), ...PL.set(1, new THREE.Vector3(1.5, 1.6, z + 17.5), t, 0.27),
        { p: new THREE.Vector3(runner.position.x, 0.6, z - 6), c: new THREE.Color(1, 0.95, 0.85), i: 1.6, r: 6 }];
      setLights(S.U, L);
      S.lampsNear(0, 0, 60);
      camera.fov = lerp(30, 40, smooth(0.3, 0.9, lt)); camera.updateProjectionMatrix();
      camera.position.set(5.5, 0.5, -6).add(shake(t, 0.05 + smooth(0.5, 0.9, lt) * 0.2, 8, 9));
      camera.lookAt(runner.position.x * 0.5, 1.0, Math.max(z + 2, -9));
    },
    grade: { ...DARK, bloom: 1.0, bloomThresh: 0.7, exposure: 1.6, streak: 1.5 },
  };
}

export const C_SHOTS = [
  { id: 'robbery', t0: 10.0, t1: 11.25, make: robbery, lightScale: 0.8 },
  { id: 'policepass', t0: 11.25, t1: 12.0, make: policePass, lightScale: 0.3 },
  { id: 'heli', t0: 12.0, t1: 13.0, make: helicopter },
  { id: 'meeting', t0: 13.0, t1: 14.0, make: meeting, lightScale: 0.35 },
  { id: 'gunfire', t0: 14.0, t1: 14.75, make: gunfire, lightScale: 0.4 },
  { id: 'chaseRear', t0: 14.75, t1: 16.0, make: chaseRear, lightScale: 0.6 },
  { id: 'chaseFront', t0: 16.0, t1: 17.0, make: chaseFront, lightScale: 0.6 },
];
