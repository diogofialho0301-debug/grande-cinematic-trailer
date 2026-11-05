// Shared helpers: seeded randomness, easing, procedural textures, materials.
import * as THREE from 'three';

export function rng(seed = 1) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = (t) => Math.pow(clamp(t), 3);
export const expOut = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t)));

// smooth deterministic 1D noise for handheld camera shake
function h1(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }
export function noise1(x) {
  const i = Math.floor(x), f = x - i; const u = f * f * (3 - 2 * f);
  return lerp(h1(i), h1(i + 1), u) * 2 - 1;
}
export function shake(t, amp, freq = 1, seed = 0) {
  return new THREE.Vector3(
    (noise1(t * freq + seed) * 0.6 + noise1(t * freq * 2.7 + seed + 9) * 0.4) * amp,
    (noise1(t * freq + seed + 31) * 0.6 + noise1(t * freq * 3.1 + seed + 17) * 0.4) * amp,
    (noise1(t * freq + seed + 57)) * amp * 0.5,
  );
}

export const GOLD = new THREE.Color(1.0, 0.72, 0.32);
export const GOLD_HOT = new THREE.Color(1.0, 0.82, 0.5);

// ---------- canvas textures ----------
export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

export function glowTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.12, 'rgba(255,255,255,0.75)');
    r.addColorStop(0.35, 'rgba(255,255,255,0.18)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  }, false);
}

export function smokeTexture(seed = 3) {
  const R = rng(seed);
  return canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      const x = w / 2 + (R() - 0.5) * w * 0.45, y = h / 2 + (R() - 0.5) * h * 0.45;
      const rad = 30 + R() * 70;
      const r = g.createRadialGradient(x, y, 0, x, y, rad);
      const a = 0.05 + R() * 0.07;
      r.addColorStop(0, `rgba(255,255,255,${a})`);
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
    }
    // radial falloff mask
    g.globalCompositeOperation = 'destination-in';
    const m = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.6, 'rgba(0,0,0,0.8)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = m; g.fillRect(0, 0, w, h);
  }, false);
}

// ---------- materials ----------
export function glowSprite(color, size, opacity = 1) {
  const m = new THREE.SpriteMaterial({ map: SHARED.glow, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const s = new THREE.Sprite(m); s.scale.setScalar(size); return s;
}

// Fake volumetric light cone (apex at origin, pointing -Y, length 1, unit radius at base).
export function beamMaterial(color, intensity = 1) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uInt: { value: intensity }, uTime: { value: 0 } },
    vertexShader: `varying float vH; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ vH = -position.y; vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vW=(modelMatrix*vec4(position,1.)).xyz; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uInt; uniform float uTime; varying float vH; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      float hs(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
      void main(){ float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
        float along = pow(1.0 - clamp(vH,0.,1.), 1.4) * smoothstep(0.0, 0.04, vH);
        float dust = 0.85 + 0.15*sin(vW.x*1.7+uTime*0.7)*sin(vW.y*1.3-uTime*0.5)*sin(vW.z*2.1);
        gl_FragColor = vec4(uColor * uInt * edge * along * dust, 1.0); }`,
  });
}
export function makeBeam(color, length, radius, intensity = 1, seg = 32) {
  const g = new THREE.ConeGeometry(radius, length, seg, 1, true);
  g.translate(0, -length / 2, 0); // apex at origin
  g.scale(1 / length, 1 / length, 1 / length); // normalize so vH 0..1 via position.y
  const mesh = new THREE.Mesh(g, beamMaterial(color, intensity));
  mesh.scale.setScalar(length);
  mesh.frustumCulled = false;
  return mesh;
}

// Sky dome with night / sunset gradients.
export function makeSky(opts = {}) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uZenith: { value: new THREE.Color(opts.zenith ?? 0x02040a) },
      uHorizon: { value: new THREE.Color(opts.horizon ?? 0x2a1a10) },
      uGlow: { value: new THREE.Color(opts.glow ?? 0x6a3a12) },
      uSunDir: { value: (opts.sunDir ?? new THREE.Vector3(0, -1, 0)).clone().normalize() },
      uSunColor: { value: new THREE.Color(opts.sunColor ?? 0xffa040) },
      uSunSize: { value: opts.sunSize ?? 0.0 },
      uStars: { value: opts.stars ?? 1.0 },
      uTime: { value: 0 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 uZenith,uHorizon,uGlow,uSunColor,uSunDir; uniform float uSunSize,uStars,uTime; varying vec3 vDir;
      float hs(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
      void main(){ vec3 d = normalize(vDir); float h = clamp(d.y,0.,1.);
        vec3 c = mix(uHorizon, uZenith, pow(h, 0.45));
        c += uGlow * exp(-max(d.y,0.)*9.0);
        float s = max(dot(d, uSunDir), 0.);
        c += uSunColor * (pow(s, 8.0)*0.35 + pow(s, 64.0)*0.8);
        c += uSunColor * 6.0 * smoothstep(1.0 - uSunSize, 1.0 - uSunSize*0.85, s) * step(0.0001,uSunSize);
        vec3 q = floor(d*420.0); float st = hs(q); c += vec3(0.8,0.85,1.0) * step(0.9975, st) * uStars * smoothstep(0.05,0.4,d.y) * (0.5+0.5*sin(uTime*3.0+st*40.0));
        if (d.y < 0.0) c = mix(uHorizon*0.6 + uGlow*0.5, vec3(0.0), clamp(-d.y*4.0,0.,1.));
        gl_FragColor = vec4(c,1.0); }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(5000, 32, 16), mat);
  m.frustumCulled = false; m.renderOrder = -10;
  return m;
}

// Studio-like environment for glossy cars / gold metal: emissive panels in a dark room.
export function makeEnvScene(kind = 'night') {
  const s = new THREE.Scene();
  s.background = new THREE.Color(kind === 'sunset' ? 0x1a0d06 : 0x020203);
  const box = new THREE.Mesh(new THREE.BoxGeometry(40, 20, 40), new THREE.MeshBasicMaterial({ color: kind === 'sunset' ? 0x2a1408 : 0x050506, side: THREE.BackSide }));
  s.add(box);
  const add = (w, h, c, x, y, z, ry = 0, rx = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0); s.add(m);
  };
  if (kind === 'studio') {
    add(30, 2, new THREE.Color(6, 4.4, 2.2), 0, 9.5, 0, 0, Math.PI / 2);
    add(2, 14, new THREE.Color(5, 3.6, 1.6), -19, 2, 0, Math.PI / 2);
    add(2, 14, new THREE.Color(2.5, 1.8, 0.9), 19, 2, -6, -Math.PI / 2);
    add(10, 1, new THREE.Color(8, 6, 3.5), 0, 4, -19);
    add(14, 0.6, new THREE.Color(3, 2.2, 1.2), 0, -2, 19, Math.PI);
  } else if (kind === 'sunset') {
    add(40, 6, new THREE.Color(6, 2.6, 0.8), 0, 0, -19);
    add(30, 2, new THREE.Color(1.2, 0.7, 0.5), 0, 9.5, 0, 0, Math.PI / 2);
    add(4, 4, new THREE.Color(14, 8, 3), 4, 1, -18.9);
  } else {
    // night street: rows of warm lamps + a cool sky strip
    for (let i = -4; i <= 4; i++) add(1.2, 0.5, new THREE.Color(7, 4.5, 1.8), i * 4.5, 8, -10, 0, Math.PI / 2.4);
    for (let i = -4; i <= 4; i++) add(1.2, 0.5, new THREE.Color(5, 3.2, 1.3), i * 4.5, 8, 10, 0, -Math.PI / 2.4);
    add(40, 3, new THREE.Color(0.25, 0.3, 0.45), 0, 9.9, 0, 0, Math.PI / 2);
    add(10, 3, new THREE.Color(1.2, 0.8, 0.5), -19.9, 1, 0, Math.PI / 2);
    add(10, 3, new THREE.Color(0.6, 0.6, 0.8), 19.9, 1, 0, -Math.PI / 2);
  }
  return s;
}

export const SHARED = {};
export function initShared(renderer) {
  SHARED.glow = glowTexture();
  SHARED.smoke = smokeTexture(7);
  const pm = new THREE.PMREMGenerator(renderer);
  SHARED.envNight = pm.fromScene(makeEnvScene('night'), 0.02).texture;
  SHARED.envStudio = pm.fromScene(makeEnvScene('studio'), 0.02).texture;
  SHARED.envSunset = pm.fromScene(makeEnvScene('sunset'), 0.02).texture;
  pm.dispose();
}

// Smoke / haze sprites drifting.
export function makeSmoke(count, area, color, opacity, seed = 1, size = [6, 14]) {
  const R = rng(seed); const group = new THREE.Group(); const items = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.SpriteMaterial({ map: SHARED.smoke, color, transparent: true, opacity, depthWrite: false, fog: false, blending: THREE.NormalBlending });
    const s = new THREE.Sprite(m);
    const base = new THREE.Vector3((R() - 0.5) * area.x, (R() - 0.5) * area.y, (R() - 0.5) * area.z);
    const sc = lerp(size[0], size[1], R());
    s.scale.setScalar(sc); s.position.copy(base);
    items.push({ s, base, sp: new THREE.Vector3((R() - 0.5) * 0.6, R() * 0.3, (R() - 0.5) * 0.6), rot: (R() - 0.5) * 0.2, ph: R() * 6 });
    m.rotation = R() * 6;
    group.add(s);
  }
  group.userData.update = (t) => { for (const it of items) { it.s.position.copy(it.base).addScaledVector(it.sp, t); it.s.material.rotation = it.ph + it.rot * t; } };
  return group;
}

// Additive particles (gold dust, embers, sparks).
export function makeParticles({ count, seed = 1, spread, color = GOLD, size = 3, center = new THREE.Vector3(), speed = new THREE.Vector3(0, 0.3, 0), twinkle = 1 }) {
  const R = rng(seed);
  const pos = new Float32Array(count * 3), rnd = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (R() - 0.5) * spread.x; pos[i * 3 + 1] = (R() - 0.5) * spread.y; pos[i * 3 + 2] = (R() - 0.5) * spread.z;
    rnd[i * 4] = R(); rnd[i * 4 + 1] = R(); rnd[i * 4 + 2] = R(); rnd[i * 4 + 3] = R();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 4));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uSize: { value: size }, uSpeed: { value: speed }, uSpread: { value: spread }, uCenter: { value: center }, uOpacity: { value: 1 }, uTw: { value: twinkle }, uScale: { value: 1 } },
    vertexShader: `uniform float uTime,uSize,uScale; uniform vec3 uSpeed,uSpread,uCenter; attribute vec4 aRnd; varying float vA; varying float vR;
      void main(){ vec3 p = position + uSpeed*(0.4+aRnd.x)*uTime;
        p.x += sin(uTime*(0.3+aRnd.y)+aRnd.z*6.28)*0.6*uSpread.x*0.03;
        p.z += cos(uTime*(0.25+aRnd.w)+aRnd.y*6.28)*0.6*uSpread.z*0.03;
        p = mod(p + uSpread*0.5, uSpread) - uSpread*0.5; p += uCenter;
        vec4 mv = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv;
        float sz = uSize*(0.35+aRnd.w*aRnd.w*1.6);
        gl_PointSize = sz*uScale*(300.0/max(-mv.z,0.1));
        vA = 0.5+0.5*sin(uTime*(1.5+aRnd.x*4.0)+aRnd.y*30.0); vR = aRnd.z; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity,uTw; varying float vA; varying float vR;
      void main(){ vec2 c = gl_PointCoord-0.5; float d = length(c); float a = exp(-d*d*28.0) + exp(-d*d*6.0)*0.25;
        float tw = mix(1.0, vA, uTw); vec3 col = uColor*(0.8+vR*0.6);
        gl_FragColor = vec4(col*a*tw*uOpacity*1.6, 1.0); }`,
  });
  const p = new THREE.Points(g, mat); p.frustumCulled = false;
  p.userData.update = (t) => { mat.uniforms.uTime.value = t; };
  return p;
}

export function stdMat(color, rough = 0.8, metal = 0, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
}
