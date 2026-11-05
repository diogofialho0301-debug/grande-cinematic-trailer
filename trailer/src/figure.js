// Stylised articulated human figures (read as cinematic silhouettes under rim light).
import * as THREE from 'three';
import { SHARED } from './lib.js';

function cap(r, len, mat) { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), mat); return m; }

export function makeFigure(o = {}) {
  const env = o.env ?? SHARED.envNight;
  const cloth = new THREE.MeshStandardMaterial({ color: o.color ?? 0x0b0b0d, roughness: o.rough ?? 0.6, metalness: 0.0, envMap: env, envMapIntensity: 0.6 });
  const pants = new THREE.MeshStandardMaterial({ color: o.pants ?? o.color ?? 0x0b0b0d, roughness: 0.7, envMap: env, envMapIntensity: 0.4 });
  const skin = new THREE.MeshStandardMaterial({ color: o.skin ?? 0x5a3a2a, roughness: 0.55, envMap: env, envMapIntensity: 0.5 });
  const root = new THREE.Group(); const hips = new THREE.Group(); hips.position.y = 0.98; root.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.16, 0.58, 16), cloth); chest.scale.z = 0.62; chest.position.y = 0.32; torso.add(chest);
  const shoulders = cap(0.085, 0.36, cloth); shoulders.rotation.z = Math.PI / 2; shoulders.position.y = 0.57; shoulders.scale.z = 0.9; torso.add(shoulders);
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.17, 0.2, 14), pants); pelvis.scale.z = 0.7; pelvis.position.y = 0.0; torso.add(pelvis);
  if (o.coat) { const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.26, 0.6, 16, 1, true), cloth); coat.scale.z = 0.7; coat.position.y = -0.16; torso.add(coat); }
  if (o.dress) { const dress = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.34, 0.85, 18, 1, true), cloth); dress.scale.z = 0.8; dress.position.y = -0.36; torso.add(dress); }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 8), skin); neck.position.y = 0.66; torso.add(neck);
  const head = new THREE.Group(); head.position.y = 0.8; torso.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.105, 20, 16), o.mask ? new THREE.MeshStandardMaterial({ color: o.mask, roughness: 0.4, envMap: env }) : skin); skull.scale.set(0.92, 1.15, 1.0); head.add(skull);
  if (o.hair !== false) { const hair = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: 0x050403, roughness: 0.8 })); hair.position.y = 0.025; hair.scale.set(0.95, 1.1, 1.05); head.add(hair); }
  if (o.longHair) { const lh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.32, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0x0a0604, roughness: 0.8, side: THREE.DoubleSide })); lh.position.set(0, -0.1, -0.03); head.add(lh); }
  if (o.cap) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.12, 0.08, 16), new THREE.MeshStandardMaterial({ color: o.cap, roughness: 0.5 })); c.position.y = 0.09; head.add(c); const brim = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.015, 0.1), c.material); brim.position.set(0, 0.06, 0.12); head.add(brim); }
  if (o.hood) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.7), cloth); h.position.set(0, 0.0, -0.01); head.add(h); }
  const limb = (side, isArm) => {
    const pivot = new THREE.Group();
    const upper = cap(isArm ? 0.055 : 0.078, isArm ? 0.24 : 0.34, isArm ? cloth : pants); upper.position.y = isArm ? -0.15 : -0.22; pivot.add(upper);
    const knee = new THREE.Group(); knee.position.y = isArm ? -0.3 : -0.44; pivot.add(knee);
    const lower = cap(isArm ? 0.045 : 0.062, isArm ? 0.22 : 0.34, isArm ? cloth : pants); lower.position.y = isArm ? -0.14 : -0.22; knee.add(lower);
    const end = new THREE.Mesh(isArm ? new THREE.SphereGeometry(0.045, 8, 8) : new THREE.BoxGeometry(0.1, 0.07, 0.26), isArm ? skin : new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.3, metalness: 0.3, envMap: env }));
    end.position.set(0, isArm ? -0.3 : -0.47, isArm ? 0 : 0.05); knee.add(end);
    if (isArm) { pivot.position.set(side * 0.24, 0.55, 0); torso.add(pivot); } else { pivot.position.set(side * 0.1, -0.04, 0); hips.add(pivot); }
    return { pivot, knee, end };
  };
  const L = { armL: limb(-1, true), armR: limb(1, true), legL: limb(-1, false), legR: limb(1, false) };
  if (o.watch) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 6, 16), new THREE.MeshStandardMaterial({ color: 0xffc860, metalness: 1, roughness: 0.15, envMap: SHARED.envStudio, emissive: 0x3a2000 })); w.rotation.x = Math.PI / 2; w.position.y = -0.24; L.armL.knee.add(w); }
  root.userData = {
    L, head, torso, hips,
    pose(p = {}) {
      L.armL.pivot.rotation.set(p.alx ?? 0, 0, p.alz ?? 0.08); L.armR.pivot.rotation.set(p.arx ?? 0, 0, p.arz ?? -0.08);
      L.armL.knee.rotation.x = p.elL ?? -0.15; L.armR.knee.rotation.x = p.elR ?? -0.15;
      L.legL.pivot.rotation.x = p.llx ?? 0; L.legR.pivot.rotation.x = p.lrx ?? 0; L.legL.knee.rotation.x = p.klL ?? 0; L.legR.knee.rotation.x = p.klR ?? 0;
      head.rotation.set(p.hx ?? 0, p.hy ?? 0, 0); torso.rotation.set(p.tx ?? 0, p.ty ?? 0, 0); hips.position.y = 0.98 + (p.bob ?? 0);
    },
    walk(ph, amt = 1) {
      const s = Math.sin(ph), c = Math.cos(ph);
      this.pose({ llx: s * 0.45 * amt, lrx: -s * 0.45 * amt, klL: Math.max(0, -c) * 0.7 * amt, klR: Math.max(0, c) * 0.7 * amt, alx: -s * 0.35 * amt, arx: s * 0.35 * amt, elL: -0.25, elR: -0.25, bob: Math.abs(c) * 0.03 * amt - 0.015 });
    },
  };
  root.traverse((x) => { if (x.isMesh) x.castShadow = false; });
  root.userData.pose({});
  root.scale.setScalar(o.scale ?? 1);
  return root;
}

// Simple instanced crowd body (for the nightclub).
export function makeCrowd(count, area, seed, mat) {
  const parts = [];
  const body = new THREE.CylinderGeometry(0.19, 0.15, 0.7, 10); body.translate(0, 1.25, 0); parts.push(body);
  const legs = new THREE.CylinderGeometry(0.15, 0.1, 0.9, 8); legs.translate(0, 0.45, 0); parts.push(legs);
  const head = new THREE.SphereGeometry(0.11, 12, 10); head.scale(0.95, 1.15, 1); head.translate(0, 1.78, 0); parts.push(head);
  const armL = new THREE.CapsuleGeometry(0.045, 0.55, 4, 6); armL.rotateZ(0.35); armL.translate(-0.33, 1.95, 0); parts.push(armL);
  const armR = new THREE.CapsuleGeometry(0.045, 0.55, 4, 6); armR.rotateZ(-0.35); armR.translate(0.33, 1.95, 0); parts.push(armR);
  return { parts };
}
