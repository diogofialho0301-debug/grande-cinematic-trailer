// Procedural vehicles: supercar, police cruiser, ambulance, helicopter.
import * as THREE from 'three';
import { SHARED, makeBeam } from './lib.js';

function extrudeSide(points, width, bevel = 0.06) {
  const s = new THREE.Shape(); s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.length === 5) s.absarc(p[0], p[1], p[2], p[3], p[4], false); else s.lineTo(p[0], p[1]);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: true, bevelThickness: bevel * 1.3, bevelSize: bevel, bevelSegments: 4, curveSegments: 14 });
  g.translate(0, 0, -width / 2); g.rotateY(-Math.PI / 2); g.computeVertexNormals();
  return g;
}

function wheel(paint) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.3, 28), new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.85 }));
  tire.rotation.z = Math.PI / 2; g.add(tire);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x8a6a30, metalness: 1, roughness: 0.25, envMap: SHARED.envNight });
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.32, 12), rimMat); hub.rotation.z = Math.PI / 2; g.add(hub);
  const spokes = new THREE.Group();
  for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.07), rimMat); sp.rotation.x = (i / 5) * Math.PI * 2; sp.position.x = 0.14; spokes.add(sp); }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.025, 6, 28), rimMat); ring.rotation.y = Math.PI / 2; ring.position.x = 0.14; spokes.add(ring);
  g.add(spokes); g.userData.spin = spokes;
  return g;
}

export function makeCar(o = {}) {
  const group = new THREE.Group(); const body = new THREE.Group(); group.add(body);
  const env = o.env ?? SHARED.envNight;
  const paint = new THREE.MeshPhysicalMaterial({ color: o.color ?? 0x0a0a0c, metalness: o.metal ?? 0.6, roughness: o.rough ?? 0.28, clearcoat: 1, clearcoatRoughness: 0.09, envMap: env, envMapIntensity: o.envInt ?? 1.4 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x030405, metalness: 0.2, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.08, envMap: env, envMapIntensity: 1.6 });
  const prof = [
    [2.2, 0.28], [1.92, 0.28], [1.45, 0.36, 0.47, 0, Math.PI], [-0.98, 0.28], [-1.45, 0.36, 0.47, 0, Math.PI], [-2.18, 0.30],
    [-2.33, 0.46], [-2.34, 0.78], [-2.16, 0.88], [-1.5, 0.92], [0.55, 0.9], [1.5, 0.76], [2.22, 0.6], [2.37, 0.45], [2.32, 0.32],
  ];
  const bodyMesh = new THREE.Mesh(extrudeSide(prof, 1.82, 0.07), paint); body.add(bodyMesh);
  const cabin = [[0.7, 0.86], [-0.15, 1.17], [-0.85, 1.19], [-1.85, 0.92], [-1.6, 0.86]];
  const cab = new THREE.Mesh(extrudeSide(cabin, 1.36, 0.1), glass); body.add(cab);
  // side intakes
  const intake = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.18, 0.6), new THREE.MeshStandardMaterial({ color: 0x010101, roughness: 0.9 }));
  intake.position.set(0, 0.55, -0.55); body.add(intake);
  // lights
  const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 9, 10) });
  const tailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 0.25, 0.15) });
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.1), headMat); hl.position.set(s * 0.68, 0.58, 2.33); hl.rotation.z = s * 0.15; body.add(hl);
  }
  const tl = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.05, 0.06), tailMat); tl.position.set(0, 0.74, -2.44); body.add(tl);
  for (const s of [-1, 1]) { const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.06), tailMat); t2.position.set(s * 0.72, 0.66, -2.44); body.add(t2); }
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.03, 0.3), paint); spoiler.position.set(0, 0.98, -2.1); body.add(spoiler);
  // wheels
  const wheels = [];
  for (const [x, z] of [[-0.86, 1.45], [0.86, 1.45], [-0.86, -1.45], [0.86, -1.45]]) {
    const w = wheel(paint); w.position.set(x, 0.37, z); if (x < 0) w.rotation.y = Math.PI; group.add(w); wheels.push(w);
  }
  const lights = { headMat, tailMat };
  // optional light bar (police)
  if (o.police) {
    const doors = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.35, metalness: 0.2, envMap: env });
    for (const s of [-1, 1]) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.36, 1.6), doors); d.position.set(s * 1.0, 0.58, 0.05); body.add(d); }
    const red = new THREE.MeshBasicMaterial({ color: new THREE.Color(10, 0.3, 0.2) });
    const blue = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.8, 12) });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.25), new THREE.MeshStandardMaterial({ color: 0x111111 })); bar.position.set(0, 1.26, -0.5); body.add(bar);
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.22), red); r.position.set(-0.33, 1.33, -0.5); body.add(r);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.22), blue); b.position.set(0.33, 1.33, -0.5); body.add(b);
    lights.red = r; lights.blue = b;
    const gr = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.06), red); gr.position.set(-0.4, 0.42, 2.42); body.add(gr);
    const gb = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.06), blue); gb.position.set(0.4, 0.42, 2.42); body.add(gb);
    lights.gr = gr; lights.gb = gb;
  }
  if (o.beams) {
    for (const s of [-1, 1]) {
      const b = makeBeam(new THREE.Color(1.0, 0.92, 0.8), 30, 5, o.beamInt ?? 0.18);
      b.position.set(s * 0.68, 0.58, 2.36); b.rotation.x = -Math.PI / 2 + 0.06; body.add(b);
    }
  }
  group.userData = {
    wheels, lights, paint, body,
    update(t, speed = 0) {
      for (const w of wheels) w.userData.spin.rotation.x = (t * speed) / 0.37 * (w.rotation.y ? -1 : 1);
      if (o.police) {
        const ph = policePhase(t);
        lights.red.visible = lights.gr.visible = ph.r > 0.5; lights.blue.visible = lights.gb.visible = ph.b > 0.5;
      }
    },
  };
  return group;
}

// Classic double-flash alternating strobe pattern.
export function policePhase(t, off = 0) {
  const p = ((t + off) * 2.2) % 1;
  const r = (p < 0.08 || (p > 0.14 && p < 0.22)) ? 1 : 0;
  const b = ((p > 0.5 && p < 0.58) || (p > 0.64 && p < 0.72)) ? 1 : 0;
  return { r, b };
}

export function makeAmbulance(o = {}) {
  const g = new THREE.Group(); const env = o.env ?? SHARED.envNight;
  const white = new THREE.MeshPhysicalMaterial({ color: 0xdedede, roughness: 0.3, metalness: 0.1, clearcoat: 1, envMap: env });
  const box = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.3, 3.8), white); box.position.set(0, 1.55, -0.9); g.add(box);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.5, 1.9), white); cab.position.set(0, 1.15, 1.9); g.add(cab);
  const ws = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 0.05), new THREE.MeshPhysicalMaterial({ color: 0x020203, roughness: 0.05, envMap: env })); ws.position.set(0, 1.55, 2.86); ws.rotation.x = -0.25; g.add(ws);
  const stripeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 0.02, 0.02) });
  for (const s of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 5.6), stripeMat); st.position.set(s * 1.11, 1.1, 0); g.add(st); }
  const red = new THREE.MeshBasicMaterial({ color: new THREE.Color(12, 0.3, 0.2) });
  const wht = new THREE.MeshBasicMaterial({ color: new THREE.Color(10, 10, 10) });
  const lights = [];
  [[-0.9, red], [-0.3, wht], [0.3, wht], [0.9, red]].forEach(([x, m], i) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.25), m); l.position.set(x, 2.77, 1.0); g.add(l); lights.push(l); });
  for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 0.1), red); l.position.set(s * 0.9, 2.5, -2.82); g.add(l); lights.push(l); }
  const head = new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 8, 8) });
  for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.05), head); h.position.set(s * 0.75, 0.8, 2.86); g.add(h); }
  for (const [x, z] of [[-1, 2.0], [1, 2.0], [-1, -1.9], [1, -1.9]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 20), new THREE.MeshStandardMaterial({ color: 0x0a0a0a })); w.rotation.z = Math.PI / 2; w.position.set(x, 0.42, z); g.add(w); }
  g.userData.update = (t) => { const p = (t * 3) % 1; lights.forEach((l, i) => { l.visible = ((p < 0.5) === (i % 2 === 0)) || (i >= 4 && p > 0.3 && p < 0.45); }); };
  g.userData.phase = (t) => ((t * 3) % 1 < 0.5 ? 1 : 0);
  return g;
}

export function makeHelicopter() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.5, metalness: 0.5, envMap: SHARED.envNight });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.4, 24, 16), mat); body.scale.set(1, 0.85, 1.7); g.add(body);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.32, 5.5, 10), mat); boom.rotation.x = Math.PI / 2; boom.position.set(0, 0.2, -4.2); g.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.7), mat); fin.position.set(0, 0.6, -6.8); g.add(fin);
  for (const s of [-1, 1]) { const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 6), mat); sk.rotation.x = Math.PI / 2; sk.position.set(s * 0.9, -1.4, 0); g.add(sk); }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(5.5, 48), new THREE.MeshBasicMaterial({ color: 0x222226, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = 1.35; g.add(disc);
  const blades = new THREE.Group(); blades.position.y = 1.4;
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.03, 11), mat); b.rotation.y = (i * Math.PI) / 4 * 2 / 2; blades.add(b); }
  g.add(blades);
  const blink = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(14, 0.4, 0.3) })); blink.position.set(0, -1.1, 0.5); g.add(blink);
  const blinkW = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(12, 12, 12) })); blinkW.position.set(0, 1.2, -6.9); g.add(blinkW);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(30, 28, 24) })); lamp.position.set(0, -1.2, 1.6); g.add(lamp);
  g.userData.update = (t) => { blades.rotation.y = t * 31; blink.visible = (t * 1.3) % 1 < 0.15; blinkW.visible = (t * 1.3 + 0.5) % 1 < 0.15; };
  g.userData.lampPos = lamp.position;
  return g;
}
