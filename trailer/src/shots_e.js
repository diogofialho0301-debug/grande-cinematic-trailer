// 24-30s: The GRANDE reveal — metallic gold 3D letters emerging from darkness.
import * as THREE from 'three';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { makeParticles, makeSmoke, glowSprite, smooth, easeInOut, easeOut, expOut, lerp, clamp, SHARED, shake } from './lib.js';

let FONT = null;
export async function preloadFont() {
  if (FONT) return;
  const json = await new Promise((res, rej) => new TTFLoader().load('../assets/fonts/Cinzel-Black.ttf', res, undefined, rej));
  FONT = new Font(json);
}

function reveal() {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0, 0, 0);
  const gold = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(1.0, 0.71, 0.33), metalness: 1.0, roughness: 0.2, envMap: SHARED.envStudio, envMapIntensity: 0, clearcoat: 0.4, clearcoatRoughness: 0.1 });
  const goldSide = gold.clone(); goldSide.color = new THREE.Color(0.75, 0.47, 0.18); goldSide.roughness = 0.3;
  const word = 'GRANDE'; const size = 0.98; const letters = [];
  const group = new THREE.Group(); scene.add(group);
  let x = 0; const sp = 0.14;
  for (const ch of word) {
    const g = new TextGeometry(ch, { font: FONT, size, depth: 0.32, curveSegments: 10, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.028, bevelSegments: 4 });
    g.computeBoundingBox(); const bb = g.boundingBox; const w = bb.max.x - bb.min.x;
    g.translate(-bb.min.x - w / 2, 0, -0.16);
    const m = new THREE.Mesh(g, [gold, goldSide]);
    m.userData.x = x + w / 2; x += w + sp; letters.push(m); group.add(m);
  }
  const total = x - sp; letters.forEach((m) => { m.userData.x -= total / 2; m.position.x = m.userData.x; });
  group.position.y = 0.0;
  // reflective floor
  const refl = new Reflector(new THREE.PlaneGeometry(40, 40), { textureWidth: 960, textureHeight: 402, color: 0x2a2620, clipBias: 0.003 });
  refl.rotation.x = -Math.PI / 2; refl.position.y = -0.18;
  const floorFade = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    vertexShader: 'varying vec3 vW; void main(){ vW=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.); }',
    fragmentShader: 'varying vec3 vW; void main(){ float d = length(vW.xz*vec2(0.22,0.5)); gl_FragColor = vec4(0.,0.,0., smoothstep(0.4, 1.6, d)); }' }));
  floorFade.rotation.x = -Math.PI / 2; floorFade.position.y = -0.175;
  // lighting
  const key = new THREE.SpotLight(0xffe0b0, 0, 30, 0.35, 0.7, 1.2); key.position.set(-6, 5, 6); key.target.position.set(0, 0.5, 0); scene.add(key); scene.add(key.target);
  const rim = new THREE.PointLight(0xffb050, 0, 20, 1.5); rim.position.set(0, 2.5, -3); scene.add(rim);
  const sweep = new THREE.PointLight(0xfff0d0, 0, 8, 1.6); scene.add(sweep);
  const backGlow = glowSprite(new THREE.Color(1.0, 0.6, 0.22), 13, 0); backGlow.position.set(0, 0.7, -4); scene.add(backGlow);
  const dust = makeParticles({ count: 900, seed: 77, spread: new THREE.Vector3(18, 7, 10), size: 0.05, center: new THREE.Vector3(0, 1.0, -1), speed: new THREE.Vector3(0.05, 0.28, 0.02) }); scene.add(dust);
  const embers = makeParticles({ count: 160, seed: 78, spread: new THREE.Vector3(12, 6, 6), size: 0.11, center: new THREE.Vector3(0, 1.5, 0.5), speed: new THREE.Vector3(0.1, 0.45, 0.05) }); scene.add(embers);
  const smoke = makeSmoke(22, new THREE.Vector3(22, 1.4, 8), new THREE.Color(0.38, 0.27, 0.16), 0.2, 12, [3, 7]); smoke.position.set(0, 0.2, -0.5); scene.add(smoke);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
  const start = 0.75;
  return {
    scene, camera, K: 3, shutter: 0.5,
    update(lt, t) {
      dust.userData.update(lt + 3); embers.userData.update(lt + 2); smoke.userData.update(lt);
      const pa = smooth(0.4, 1.6, lt);
      dust.material.uniforms.uOpacity.value = pa * 1.2; embers.material.uniforms.uOpacity.value = smooth(0.45, 1.0, lt) * (1.2 - 0.4 * smooth(2, 5, lt));
      smoke.children.forEach((s) => (s.material.opacity = 0.2 * smooth(0.6, 2.5, lt)));
      letters.forEach((m, i) => {
        const p = clamp((lt - start - i * 0.09) / 1.1);
        const e = expOut(p);
        m.position.set(m.userData.x, lerp(-0.25, 0, e), lerp(-2.5, 0, e));
        m.rotation.set(lerp(0.5, 0, e), 0, 0);
        m.visible = p > 0;
      });
      const lit = smooth(start, start + 1.6, lt);
      gold.envMapIntensity = lit * 2.2; goldSide.envMapIntensity = lit * 1.3;
      gold.envMapRotation.set(0, lerp(-0.9, 0.5, easeInOut((lt - start) / 3.2)), 0); goldSide.envMapRotation.copy(gold.envMapRotation);
      key.intensity = lit * 180; rim.intensity = lit * 60;
      const sw = clamp((lt - 1.4) / 1.3);
      sweep.position.set(lerp(-5, 5, easeInOut(sw)), 1.2, 1.4); sweep.intensity = Math.sin(sw * Math.PI) * 22;
      backGlow.material.opacity = 0.2 * smooth(0.6, 2.4, lt) * (0.9 + 0.1 * Math.sin(lt * 3));
      const cp = easeOut(lt / 6.0);
      camera.position.set(lerp(-0.25, 0.15, cp), lerp(0.35, 0.62, cp), lerp(10.5, 8.3, cp)).add(shake(lt, 0.06 * Math.exp(-Math.max(lt - 0.4, 0) * 3) * (lt > 0.4 ? 1 : 0), 14, 2));
      camera.lookAt(0, 0.2, 0);
    },
    grade: (lt) => ({ bloom: 0.7, bloomThresh: 0.85, bloomRadius: 0.7, exposure: 1.2, streak: 1.6, streakThresh: 1.1, vignette: 0.85, contrast: 1.1, sat: 1.05,
      fade: Math.max(lt < 0.4 ? 1 : 0, smooth(5.15, 5.95, lt)),
      flash: (() => { const d = lt - 0.4; const a = d >= 0 && d < 0.35 ? 0.35 * Math.pow(1 - d / 0.35, 2) : 0; return new THREE.Color(a, a * 0.7, a * 0.35); })(),
      high: new THREE.Color(0.06, 0.03, -0.04) }),
  };
}

export const E_SHOTS = [
  { id: 'reveal', t0: 24.0, t1: 30.0, make: reveal, preload: preloadFont },
];
