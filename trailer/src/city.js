// Procedural night city: aerial grid city + street-level corridor.
import * as THREE from 'three';
import { rng, lerp, SHARED } from './lib.js';

const NL = 6; // dynamic lights supported by city shaders

export function makeEnvUniforms(o = {}) {
  const lp = [], lc = [];
  for (let i = 0; i < NL; i++) { lp.push(new THREE.Vector4(0, -1000, 0, 1)); lc.push(new THREE.Vector4(0, 0, 0, 0)); }
  return {
    uTime: { value: 0 },
    uFogColor: { value: new THREE.Color(o.fogColor ?? 0x0b0a10) },
    uFogDensity: { value: o.fogDensity ?? 0.0012 },
    uDay: { value: o.day ?? 0 },
    uSunDir: { value: (o.sunDir ?? new THREE.Vector3(0, 0.1, -1)).clone().normalize() },
    uSunCol: { value: new THREE.Color(o.sunCol ?? 0xff8a3a) },
    uLitProb: { value: o.litProb ?? 1.0 },
    uWinGain: { value: o.winGain ?? 1.0 },
    uLPos: { value: lp }, uLCol: { value: lc },
    uSpotPos: { value: new THREE.Vector3(0, -1000, 0) }, uSpotDir: { value: new THREE.Vector3(0, -1, 0) },
    uSpotCos: { value: 0.97 }, uSpotCol: { value: new THREE.Color(0, 0, 0) },
  };
}

const COMMON = /* glsl */`
uniform float uTime, uFogDensity, uDay, uLitProb, uWinGain, uSpotCos;
uniform vec3 uFogColor, uSunDir, uSunCol, uSpotPos, uSpotDir, uSpotCol;
uniform vec4 uLPos[${NL}]; uniform vec4 uLCol[${NL}];
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }
vec3 dynLights(vec3 P, vec3 N){ vec3 acc = vec3(0.);
  for(int i=0;i<${NL};i++){ vec3 L = uLPos[i].xyz - P; float d2 = dot(L,L); float r = uLPos[i].w;
    float att = r*r/(r*r + d2); acc += uLCol[i].rgb * max(dot(N, normalize(L)), 0.0) * att; }
  vec3 S = P - uSpotPos; float sd = length(S); float c = dot(S/sd, uSpotDir);
  acc += uSpotCol * smoothstep(uSpotCos, uSpotCos + (1.0-uSpotCos)*0.25, c) * max(dot(N, -S/sd),0.0) * 4000.0/(sd*sd+400.0);
  return acc; }
vec3 applyFog(vec3 c, float depth){ float f = 1.0 - exp(-uFogDensity*uFogDensity*depth*depth); return mix(c, uFogColor, clamp(f,0.,1.)); }
`;

export function buildingMaterial(U, opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, uStreet: { value: opts.street ? 1 : 0 } },
    vertexShader: `attribute vec4 aInfo; varying vec3 vW; varying vec3 vN; varying vec4 vInfo; varying vec3 vL; varying float vDepth; varying vec3 vScale;
      void main(){ mat4 m = modelMatrix * instanceMatrix; vec4 w = m * vec4(position,1.); vW = w.xyz; vN = normalize(mat3(m)*normal);
        vScale = vec3(length(m[0].xyz), length(m[1].xyz), length(m[2].xyz)); vL = position; vInfo = aInfo;
        vec4 mv = viewMatrix * w; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: COMMON + `uniform float uStreet; varying vec3 vW; varying vec3 vN; varying vec4 vInfo; varying vec3 vL; varying float vDepth; varying vec3 vScale;
      void main(){
        vec3 N = normalize(vN); float seed = vInfo.x; float style = vInfo.y; float H = vInfo.z; float landmark = vInfo.w;
        vec3 V = normalize(cameraPosition - vW);
        vec3 col;
        vec3 gold = vec3(1.0,0.66,0.28);
        if (N.y > 0.5) {
          col = vec3(0.012,0.012,0.016) * (0.6+0.4*hash12(floor(vW.xz*0.5)));
          col += gold * 0.03 * landmark;
          col = mix(col, vec3(0.16,0.09,0.05)*0.6, uDay*0.6);
        } else {
          float u = (abs(N.x) > 0.5) ? vW.z : vW.x; float v = vW.y;
          float face = (abs(N.x) > 0.5) ? sign(N.x) : 2.0*sign(N.z);
          float cw = mix(3.0, 4.2, fract(seed*7.3)); float ch = 3.6;
          vec2 g = vec2(u/cw, v/ch); vec2 cell = floor(g); vec2 f = fract(g);
          vec2 fw = fwidth(g);
          float wx = smoothstep(0.12-fw.x, 0.12+fw.x, f.x) * (1.0 - smoothstep(0.88-fw.x, 0.88+fw.x, f.x));
          float wy = smoothstep(0.22-fw.y, 0.22+fw.y, f.y) * (1.0 - smoothstep(0.82-fw.y, 0.82+fw.y, f.y));
          if (style > 0.66) { wx = smoothstep(0.03-fw.x,0.03+fw.x,f.x)*(1.0-smoothstep(0.97-fw.x,0.97+fw.x,f.x)); } // glass curtain
          float win = wx*wy;
          float hcell = hash13(vec3(cell, seed*91.7 + face*13.0));
          float floorOn = hash12(vec2(cell.y, seed*17.0+face));
          float prob = mix(0.08, 0.42, fract(seed*3.17)) * uLitProb * (0.3 + floorOn);
          float lit = step(hcell, prob);
          float flick = 1.0;
          vec3 wc = mix(vec3(1.0,0.62,0.25), vec3(1.0,0.86,0.62), hash12(cell+seed));
          wc = mix(wc, vec3(0.62,0.78,1.0), step(0.86, hash12(cell*1.7+seed)));
          float bright = mix(0.35, 1.6, hash12(cell*3.1+seed*5.0)) * flick * uWinGain;
          // glass / facade
          float fres = pow(1.0 - max(dot(N,V),0.0), 3.0);
          vec3 glass = mix(vec3(0.010,0.013,0.022), vec3(0.04,0.05,0.08), fres) * (0.6 + 0.4*smoothstep(0.0, 300.0, v));
          vec3 facade = vec3(0.018,0.016,0.017) * (0.8 + 0.4*fract(seed*13.0));
          vec3 cDark = mix(facade, glass, win);
          vec3 cLit = wc * bright;
          col = mix(cDark, cLit, win*lit);
          // distance LOD: average out sub-pixel windows
          float lod = clamp(max(fw.x,fw.y)*3.2 - 0.3, 0.0, 1.0);
          vec3 avg = mix(facade, wc*0.65*uWinGain, prob*0.5*0.8);
          col = mix(col, avg, lod);
          // floor slabs
          col *= 0.75 + 0.25*smoothstep(0.0, 0.08, f.y);
          // street glow at base & gold crown on landmarks
          col += gold * 0.12 * exp(-v/7.0) * (1.0 + uStreet*0.5);
          float top = smoothstep(H-10.0, H, v);
          col += gold * landmark * (top*1.2 + 0.12*smoothstep(H-40.0, H, v));
          // vertical gold accent strips on landmarks
          float edge = smoothstep(0.45, 0.5, abs(vL.x)) + smoothstep(0.45,0.5,abs(vL.z));
          float inFace = (abs(N.x) > 0.5) ? abs(vL.z) : abs(vL.x);
          col += gold * landmark * 1.2 * smoothstep(0.47, 0.5, inFace) * smoothstep(H*0.3, H, v);
          // sunset light
          float sun = max(dot(N, uSunDir), 0.0);
          vec3 dayFacade = mix(vec3(0.05,0.04,0.045), vec3(0.18,0.12,0.09), fract(seed*5.1));
          vec3 dayCol = dayFacade * (0.25 + 1.6*sun*uSunCol) + mix(vec3(0.0), uSunCol*0.25, fres*win);
          dayCol += cLit * win * lit * 0.25;
          col = mix(col, dayCol, uDay);
          // storefronts (street mode)
          if (uStreet > 0.5 && v < 4.5) {
            float sh = hash12(vec2(floor(u/7.0), seed*3.0));
            vec3 sc = mix(vec3(1.0,0.7,0.35), vec3(1.0,0.85,0.6), sh);
            if (sh > 0.95) sc = vec3(0.2,0.8,1.0); else if (sh > 0.9) sc = vec3(1.0,0.25,0.5);
            float sf = fract(u/7.0); float shop = step(0.08,sf)*step(sf,0.92)*step(0.4,v)*step(v,3.6);
            float mull = step(0.06, fract(u/1.75)); col = mix(col, sc * (0.06+sh*0.22) * (0.6+0.4*mull) * (0.7+0.3*smoothstep(0.4,3.6,v)), shop * step(0.35, sh));
            col += sc * 1.2 * step(3.85, v) * step(v, 4.0) * step(0.6, sh); // neon strip
          }
        }
        col += dynLights(vW, N) * 0.06;
        col = applyFog(col, vDepth);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

// Ground with roads + streetlight pools + wet reflections.
function groundMaterial(U, o) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, uPitch: { value: o.pitch ?? 76 }, uRoadW: { value: o.roadW ?? 16 }, uMode: { value: o.mode ?? 0 }, uWet: { value: o.wet ?? 1.0 }, uLampH: { value: 8.0 }, uLampSp: { value: o.lampSp ?? 30 }, uLampX: { value: o.lampX ?? 11.5 } },
    vertexShader: `varying vec3 vW; varying float vDepth; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW=w.xyz; vec4 mv = viewMatrix*w; vDepth=-mv.z; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: COMMON + `uniform float uPitch, uRoadW, uMode, uWet, uLampH, uLampSp, uLampX; varying vec3 vW; varying float vDepth;
      vec3 lampRefl(vec3 P, vec3 R, vec3 L, vec3 c, float shin){ vec3 d = normalize(L-P);
        float az = atan(R.x, R.z) - atan(d.x, d.z); az = mod(az + 3.14159, 6.28318) - 3.14159;
        float el = asin(clamp(R.y,-1.,1.)) - asin(clamp(d.y,-1.,1.));
        float s = sqrt(shin/300.0);
        return c * exp(-pow(az*70.0*s, 2.0) - pow(el*2.6*s, 2.0)) * step(0.0, dot(R,d)); }
      void main(){
        vec3 P = vW; vec3 V = normalize(P - cameraPosition); vec3 R = reflect(V, vec3(0,1,0));
        vec3 gold = vec3(1.0,0.62,0.26);
        vec3 col = vec3(0.012,0.012,0.014) * (0.7 + 0.6*vnoise(P.xz*0.7));
        vec3 spec = vec3(0.0);
        float puddle = smoothstep(0.45, 0.7, vnoise(P.xz*0.08 + 3.0)) ;
        float shin = mix(60.0, 900.0, puddle) * uWet + 20.0;
        if (uMode < 0.5) {
          // aerial grid: roads where mod < roadW
          vec2 m = mod(P.xz, uPitch);
          float rx = step(m.x, uRoadW), rz = step(m.y, uRoadW);
          float road = max(rx, rz);
          col = mix(vec3(0.02,0.019,0.022), vec3(0.008,0.008,0.01), road);
          // lamp pools along roads
          float pz = mod(P.z, 25.0) - 12.5; float px = mod(P.x, 25.0) - 12.5;
          float dx = min(abs(m.x-1.0), abs(m.x-uRoadW+1.0)); float dz = min(abs(m.y-1.0), abs(m.y-uRoadW+1.0));
          float pool = rx * exp(-(dx*dx + pz*pz)/30.0) + rz * exp(-(dz*dz + px*px)/30.0);
          col += gold * pool * 0.9;
          col += gold * 0.06 * road;
        } else {
          // street corridor along z: road |x|<10, sidewalks to 15
          float ax = abs(P.x);
          float road = step(ax, 10.0);
          col = mix(vec3(0.03,0.028,0.03)*(0.8+0.4*vnoise(P.xz*3.0)), col, road);
          // curb line
          col += vec3(0.06) * smoothstep(0.15,0.0,abs(ax-10.0));
          // lane markings
          float dash = step(0.5, fract(P.z/9.0));
          float lane = smoothstep(0.12, 0.06, abs(ax-5.0)) * dash;
          float center = smoothstep(0.08,0.03,abs(ax-0.18)) + smoothstep(0.08,0.03,abs(ax+0.18)-0.0)*0.0;
          center = smoothstep(0.09,0.04,abs(ax-0.2));
          col += vec3(0.5) * lane * road * 0.35 + vec3(0.6,0.45,0.1) * center * 0.45;
          // crosswalks
          float zc = mod(P.z + 60.0, 240.0);
          float cw = step(zc, 6.0) * step(0.5, fract(P.x/1.2)) * road;
          col += vec3(0.25)*cw;
          // lamp pools + reflections
          float zk0 = floor(P.z/uLampSp + 0.5);
          for (int k=-2;k<=2;k++){
            float zk = (zk0+float(k))*uLampSp;
            for (int s=0;s<2;s++){
              vec3 L = vec3(s==0? -uLampX: uLampX, uLampH, zk + (s==0?0.0:uLampSp*0.5));
              vec3 d = L - P; float dd = dot(d,d); vec2 hd = P.xz - L.xz;
              col += gold * (0.16 * exp(-dot(hd,hd)/40.0) + 0.6/(dd + 4.0));
              spec += lampRefl(P, R, L, gold*0.9, shin + 100.0);
            }
          }
          spec *= (0.35 + 0.65*puddle) * road;
        }
        // dynamic lights: diffuse pool + glossy reflection
        for(int i=0;i<${NL};i++){ vec3 L = uLPos[i].xyz; vec3 d = L - P; float dd = dot(d,d); float r = uLPos[i].w;
          float att = r*r/(r*r+dd); col += uLCol[i].rgb * att * att * max(normalize(d).y, 0.0) * 0.5;
          spec += lampRefl(P, R, L, uLCol[i].rgb, shin) * 0.35 * uWet; }
        // heli spotlight
        vec3 S = P - uSpotPos; float sd = length(S); float c = dot(S/sd, uSpotDir);
        col += uSpotCol * smoothstep(uSpotCos, uSpotCos + (1.0-uSpotCos)*0.2, c) * 3500.0/(sd*sd+400.0);
        col = mix(col, vec3(0.08,0.06,0.05)*(0.6+0.4*vnoise(P.xz*0.2)) * (0.4 + uSunCol*0.8), uDay*0.85);
        col += spec * uWet * (1.0 - uDay*0.7);
        col = applyFog(col, vDepth);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

// Moving car lights rendered as points; computed fully in the vertex shader.
function trafficPoints(U, { count, seed, pitch, half, mode }) {
  const R = rng(seed);
  const a = new Float32Array(count * 4), pos = new Float32Array(count * 3);
  const nRoads = Math.floor((half * 2) / pitch);
  for (let i = 0; i < count; i++) {
    a[i * 4] = mode === 0 ? Math.floor(R() * nRoads) : 0; // road index
    a[i * 4 + 1] = R() < 0.5 ? 0 : 1; // axis (aerial) / unused
    a[i * 4 + 2] = R(); // phase
    a[i * 4 + 3] = R(); // lane/speed
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aCar', new THREE.BufferAttribute(a, 4));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { ...U, uPitch: { value: pitch }, uHalf: { value: half }, uMode: { value: mode }, uSize: { value: mode === 0 ? 7.0 : 2.0 } },
    vertexShader: `uniform float uTime, uPitch, uHalf, uMode, uSize, uFogDensity; attribute vec4 aCar; varying vec3 vC; varying float vFog;
      void main(){ float L = uHalf*2.0; float dir = aCar.w < 0.5 ? 1.0 : -1.0; float speed = mix(10.0, 22.0, fract(aCar.w*7.0));
        float s = mod(aCar.z*L + dir*speed*uTime, L) - uHalf; vec3 p;
        float lane = dir > 0.0 ? 4.0 : 12.0;
        if (aCar.y < 0.5) p = vec3(-uHalf + aCar.x*uPitch + lane - uPitch*0.5 + uPitch*0.5, 0.8, s);
        else p = vec3(s, 0.8, -uHalf + aCar.x*uPitch + lane);
        vec4 mv = viewMatrix * vec4(p,1.0); gl_Position = projectionMatrix * mv;
        // headlight if moving toward camera-ish, else taillight
        vec3 fwd = aCar.y < 0.5 ? vec3(0,0,dir) : vec3(dir,0,0);
        float toward = dot(fwd, normalize(cameraPosition - p));
        vC = toward > 0.0 ? vec3(1.0,0.85,0.65)*1.6 : vec3(1.0,0.06,0.03)*1.4;
        gl_PointSize = uSize * 300.0 / max(-mv.z, 1.0);
        float d = -mv.z; vFog = exp(-uFogDensity*uFogDensity*d*d); }`,
    fragmentShader: `varying vec3 vC; varying float vFog; void main(){ vec2 c = gl_PointCoord-0.5; float d=dot(c,c); gl_FragColor = vec4(vC*exp(-d*30.0)*vFog,1.0); }`,
  });
  const p = new THREE.Points(g, mat); p.frustumCulled = false; return p;
}

function lampPoints(U, positions, size = 3, color = new THREE.Color(1.0, 0.7, 0.35)) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uFogDensity: U.uFogDensity, uSize: { value: size }, uColor: { value: color } },
    vertexShader: `uniform float uSize, uFogDensity; varying float vFog; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv; gl_PointSize = uSize*300.0/max(-mv.z,1.0); float d=-mv.z; vFog = exp(-uFogDensity*uFogDensity*d*d*0.6); }`,
    fragmentShader: `uniform vec3 uColor; varying float vFog; void main(){ vec2 c = gl_PointCoord-0.5; float d=dot(c,c); gl_FragColor = vec4(uColor*(exp(-d*40.0)*2.0 + exp(-d*8.0)*0.3)*vFog, 1.0); }`,
  });
  const p = new THREE.Points(g, mat); p.frustumCulled = false; return p;
}

function instancedBuildings(U, list, street) {
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const mat = buildingMaterial(U, { street });
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  const info = new Float32Array(list.length * 4); const m = new THREE.Matrix4();
  list.forEach((b, i) => {
    m.makeScale(b.w, b.h, b.d); m.setPosition(b.x, b.y ?? 0, b.z); mesh.setMatrixAt(i, m);
    info[i * 4] = b.seed; info[i * 4 + 1] = b.style; info[i * 4 + 2] = b.h + (b.y ?? 0); info[i * 4 + 3] = b.landmark ?? 0;
  });
  geo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(info, 4));
  mesh.frustumCulled = false;
  return mesh;
}

// Red aviation beacons on top of tall towers.
function beacons(list) {
  const pos = [];
  list.forEach((b) => { if (b.h > 110) pos.push(b.x + b.w * 0.35, b.h + 2, b.z + b.d * 0.35); });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 } },
    vertexShader: `uniform float uTime; varying float vB; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize = 6.0*300.0/max(-mv.z,1.0); vB = 0.25 + 0.75*step(0.55, fract(uTime*0.7 + position.x*0.013)); }`,
    fragmentShader: `varying float vB; void main(){ vec2 c=gl_PointCoord-0.5; float d=dot(c,c); gl_FragColor=vec4(vec3(1.0,0.08,0.04)*exp(-d*30.0)*2.0*vB,1.0); }` });
  const p = new THREE.Points(g, mat); p.frustumCulled = false; p.userData.mat = mat; return p;
}

export function makeAerialCity(U, o = {}) {
  const R = rng(o.seed ?? 11);
  const pitch = 76, road = 16, N = o.blocks ?? 24, half = (N * pitch) / 2;
  const group = new THREE.Group();
  const list = [];
  const center = o.center ?? new THREE.Vector2(0, -150);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const bx = -half + i * pitch + road, bz = -half + j * pitch + road, bs = pitch - road;
    const cx = bx + bs / 2, cz = bz + bs / 2;
    const r = Math.hypot(cx - center.x, cz - center.y);
    const down = Math.exp(-(r * r) / (2 * 300 * 300));
    const split = R() < 0.55 ? 2 : 1;
    for (let a = 0; a < split; a++) for (let b = 0; b < split; b++) {
      if (R() < 0.08) continue;
      const cell = bs / split;
      const w = cell * lerp(0.6, 0.92, R()), d = cell * lerp(0.6, 0.92, R());
      let h = lerp(8, 30, R() * R()) + down * lerp(40, 260, Math.pow(R(), 1.3));
      const landmark = down > 0.55 && R() < 0.2 ? 1 : 0;
      if (landmark) h = Math.max(h, 170 + R() * 120);
      const x = bx + cell * (a + 0.5), z = bz + cell * (b + 0.5);
      list.push({ x, z, w, d, h, seed: R() * 100, style: R(), landmark });
      // setback tiers for tall towers
      if (h > 120 && R() < 0.6) list.push({ x, z, w: w * 0.7, d: d * 0.7, h: h * lerp(0.15, 0.3, R()), y: h, seed: R() * 100, style: R(), landmark });
    }
  }
  group.add(instancedBuildings(U, list, false));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 3000, half * 2 + 3000), groundMaterial(U, { mode: 0, pitch, roadW: road, wet: 0.0 }));
  ground.rotation.x = -Math.PI / 2; group.add(ground);
  // streetlights
  const lamps = [];
  for (let i = 0; i <= N; i++) {
    const rx = -half + i * pitch;
    for (let z = -half; z < half; z += 25) { lamps.push(rx + 1, 7, z, rx + road - 1, 7, z + 12.5); lamps.push(z, 7, rx + 1, z + 12.5, 7, rx + road - 1); }
  }
  group.add(lampPoints(U, lamps, 2.4));
  group.add(trafficPoints(U, { count: o.traffic ?? 2600, seed: 5, pitch, half, mode: 0 }));
  const bc = beacons(list); group.add(bc);
  group.userData.update = (t) => { U.uTime.value = t; bc.userData.mat.uniforms.uTime.value = t; };
  group.userData.list = list;
  return group;
}

// Street-level corridor along Z. Road |x|<10, sidewalks to 15, buildings beyond.
export function makeStreet(U, o = {}) {
  const R = rng(o.seed ?? 21);
  const len = o.length ?? 1600; const group = new THREE.Group(); const list = [];
  for (const side of [-1, 1]) {
    let z = -len / 2;
    while (z < len / 2) {
      const w = lerp(14, 40, R());
      if (R() < 0.12) { z += 16; continue; } // cross street
      const depth = lerp(18, 40, R());
      let h = lerp(10, o.tall ?? 70, Math.pow(R(), 1.6));
      if (R() < 0.12) h = lerp(90, 200, R());
      const x = side * (15.5 + depth / 2 + R() * 2);
      list.push({ x, z: z + w / 2, w: depth, d: w - 1.0, h, seed: R() * 100, style: R(), landmark: (h > 120 && R() < 0.5) ? 1 : 0 });
      z += w;
    }
  }
  // background towers
  for (let i = 0; i < 120; i++) {
    const side = R() < 0.5 ? -1 : 1;
    list.push({ x: side * lerp(80, 400, R()), z: (R() - 0.5) * len, w: lerp(20, 50, R()), d: lerp(20, 50, R()), h: lerp(40, 260, R() * R()), seed: R() * 100, style: R(), landmark: R() < 0.15 ? 1 : 0 });
  }
  group.add(instancedBuildings(U, list, true));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, len + 600, 1, 1), groundMaterial(U, { mode: 1, wet: o.wet ?? 1.0, lampSp: 30, lampX: 11.5 }));
  ground.rotation.x = -Math.PI / 2; group.add(ground);
  // lamp posts
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.14, 8, 6); poleGeo.translate(0, 4, 0);
  const armGeo = new THREE.BoxGeometry(1.6, 0.1, 0.1);
  const headGeo = new THREE.BoxGeometry(0.7, 0.12, 0.3);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.7 });
  const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.6, 1.1) });
  const lampsPos = [];
  const n = Math.floor(len / 30);
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, n * 2), arms = new THREE.InstancedMesh(armGeo, poleMat, n * 2), heads = new THREE.InstancedMesh(headGeo, headMat, n * 2);
  const m = new THREE.Matrix4(); let k = 0;
  for (let i = 0; i < n; i++) for (const s of [-1, 1]) {
    const z = -len / 2 + i * 30 + (s > 0 ? 15 : 0); const x = s * 12.5;
    m.makeTranslation(x, 0, z); poles.setMatrixAt(k, m);
    m.makeTranslation(x - s * 0.8, 7.9, z); arms.setMatrixAt(k, m);
    m.makeTranslation(x - s * 1.0, 7.85, z); heads.setMatrixAt(k, m);
    lampsPos.push(x - s * 1.0, 7.75, z); k++;
  }
  [poles, arms, heads].forEach((x) => { x.frustumCulled = false; group.add(x); });
  // lamps in the ground shader sit at x=±11.5 with alternating z offsets -> match
  group.add(lampPoints(U, lampsPos, 1.6));
  group.userData.update = (t) => { U.uTime.value = t; };
  group.userData.poleMat = poleMat;
  return group;
}

// Distant hills silhouette ring.
export function makeHills(radius = 2600, seed = 4, color = 0x030304) {
  const R = rng(seed); const seg = 200; const pos = []; const idx = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const h = 60 + 140 * Math.abs(Math.sin(a * 3 + 1)) * (0.5 + 0.5 * Math.sin(a * 7.0)) + R() * 25;
    pos.push(Math.cos(a) * radius, -5, Math.sin(a) * radius, Math.cos(a) * radius, h, Math.sin(a) * radius);
    if (i < seg) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: false }));
}

// Helper: write dynamic light list into env uniforms.
export function setLights(U, lights) {
  for (let i = 0; i < NL; i++) {
    const l = lights[i];
    if (l) { U.uLPos.value[i].set(l.p.x, l.p.y, l.p.z, l.r ?? 8); U.uLCol.value[i].set(l.c.r * l.i, l.c.g * l.i, l.c.b * l.i, 0); }
    else { U.uLPos.value[i].set(0, -1000, 0, 1); U.uLCol.value[i].set(0, 0, 0, 0); }
  }
}
