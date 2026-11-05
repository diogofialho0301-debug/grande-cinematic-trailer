// 0-5s: The Beginning. Aerial reveal of the city at night.
import * as THREE from 'three';
import { makeSky, makeBeam, makeParticles, smooth, easeInOut, shake, lerp, GOLD } from './lib.js';
import { makeEnvUniforms, makeAerialCity, makeHills } from './city.js';

function aerial() {
  const scene = new THREE.Scene();
  const U = makeEnvUniforms({ fogColor: 0x1a110a, fogDensity: 0.00078 });
  const sky = makeSky({ zenith: 0x010208, horizon: 0x1c120b, glow: 0x4a280c, stars: 0.8 });
  scene.add(sky);
  const city = makeAerialCity(U, { seed: 11, blocks: 26 });
  scene.add(city);
  scene.add(makeHills(2700, 4, 0x040304));
  // premiere searchlights from landmark towers
  const beams = [];
  const lm = city.userData.list.filter((b) => b.landmark && !b.y).sort((a, b) => b.h - a.h).slice(0, 4);
  lm.forEach((b, i) => {
    const beam = makeBeam(new THREE.Color(1.0, 0.78, 0.45), 900, 26, 0.09);
    beam.position.set(b.x, b.h + 2, b.z); beam.userData.ph = i * 1.7; scene.add(beam); beams.push(beam);
  });
  const dust = makeParticles({ count: 500, seed: 3, spread: new THREE.Vector3(500, 200, 500), size: 1.2, center: new THREE.Vector3(0, 250, 900), speed: new THREE.Vector3(2, 1, -3) });
  scene.add(dust);
  const camera = new THREE.PerspectiveCamera(34, 1, 1, 9000);
  const target = new THREE.Vector3();
  return {
    scene, camera, K: 2, shutter: 0.5,
    update(lt, t, dur) {
      city.userData.update(t); sky.material.uniforms.uTime.value = t; dust.userData.update(t);
      const p = easeInOut(lt / dur);
      camera.position.set(lerp(-170, 30, p), lerp(300, 205, p), lerp(1300, 980, p));
      target.set(lerp(-70, 0, p), lerp(150, 135, p), -200);
      camera.position.add(shake(t, 1.2, 0.4, 3));
      camera.lookAt(target);
      camera.rotateZ(lerp(-0.035, 0.0, p));
      beams.forEach((b) => { const a = t * 0.35 + b.userData.ph; b.rotation.set(Math.PI + Math.sin(a) * 0.35, 0, Math.cos(a * 0.8) * 0.35); });
    },
    grade: (lt) => ({ bloom: 0.9, bloomThresh: 0.7, bloomRadius: 0.7, exposure: 1.25, sat: 1.0, streak: 0.7, vignette: 0.75 }),
  };
}

export const A_SHOTS = [
  { id: 'aerial', t0: 0, t1: 5, make: aerial },
];
