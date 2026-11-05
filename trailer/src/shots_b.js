// 5-10s: The Lifestyle — supercars, nightclub, penthouse, street racing, luxury, sunset.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeSky, makeBeam, makeParticles, makeSmoke, glowSprite, smooth, easeInOut, easeOut, shake, lerp, rng, SHARED, GOLD } from './lib.js';
import { makeEnvUniforms, makeAerialCity, makeHills, setLights } from './city.js';
import { makeCar } from './car.js';
import { makeFigure } from './figure.js';
import { nightStreet, penthouse, sunsetSky, makePalm, wetGround, WARM } from './sets.js';

const BEAT = 0.5; // 120 BPM

// --- Supercar tracking shot ---
function supercar() {
  const S = nightStreet({ seed: 31, fogDensity: 0.0045 });
  const car = makeCar({ color: 0x9a7438, metal: 0.95, rough: 0.24, envInt: 2.6 }); S.scene.add(car);
  const rim = new THREE.PointLight(0xffb560, 140, 14, 1.5); S.scene.add(rim);
  const top = new THREE.PointLight(0xfff0d8, 60, 10, 1.5); S.scene.add(top);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 6000);
  const v = 34;
  return {
    scene: S.scene, camera, K: 4, shutter: 0.6,
    update(lt, t) {
      S.tick(t);
      const z = -200 + v * lt; car.position.set(-4.0, 0, z); car.userData.update(lt, v);
      S.lampsNear(z, 0, 90);
      rim.position.set(-8, 3, z - 4); top.position.set(-1.5, 4.5, z + 1);
      S.scene.environmentRotation = new THREE.Euler(0, 0, 0);
      car.userData.paint.envMap = SHARED.envNight;
      const p = lt / 1.0;
      camera.position.set(-4.0 + lerp(4.6, 3.4, p), 0.75, z + lerp(3.2, 1.6, p)).add(shake(t, 0.03, 6, 1));
      camera.lookAt(-4.0 - 0.2, 0.6, z - 0.4);
      setLights(S.U, [
        { p: new THREE.Vector3(-4.0, 0.6, z + 6), c: new THREE.Color(1, 0.95, 0.85), i: 1.2, r: 6 },
        { p: new THREE.Vector3(-4.0, 0.7, z - 2.8), c: new THREE.Color(1, 0.05, 0.02), i: 0.6, r: 2 },
      ]);
    },
    grade: { bloom: 0.9, bloomThresh: 0.8, exposure: 1.3, streak: 1.0, high: new THREE.Color(0.06, 0.03, -0.04) },
  };
}

// --- Nightclub ---
function nightclub() {
  const scene = new THREE.Scene();
  const floor = wetGround(0x060506, 0.25, 80); scene.add(floor);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x050405, roughness: 0.9 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(60, 20), wallMat); back.position.set(0, 10, -22); scene.add(back);
  // LED wall
  const led = new THREE.Mesh(new THREE.PlaneGeometry(22, 7), new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform float uTime; varying vec2 vUv;
      void main(){ vec2 g = vUv*vec2(88.,28.); vec2 f = fract(g); float px = step(0.15,f.x)*step(0.15,f.y);
        float bars = 0.5+0.5*sin(floor(g.x)*0.35 - uTime*6.0); float beat = pow(1.0-fract(uTime*2.0), 3.0);
        float wave = smoothstep(0.0, 0.05, bars*0.9 - abs(vUv.y-0.5)*1.6 + beat*0.3);
        vec3 c = mix(vec3(1.0,0.55,0.15), vec3(1.0,0.85,0.5), vUv.y) * wave * (1.2 + beat*2.0);
        c += vec3(0.9,0.1,0.5)*0.25*(1.0-wave)*smoothstep(0.2,0.9,sin(vUv.x*12.0+uTime*3.0));
        gl_FragColor = vec4(c*px*0.8,1.); }` }));
  led.position.set(0, 5.2, -21.5); scene.add(led);
  // DJ booth
  const booth = new THREE.Mesh(new THREE.BoxGeometry(5, 1.2, 1.5), new THREE.MeshStandardMaterial({ color: 0x0a0806, roughness: 0.3, metalness: 0.6, envMap: SHARED.envStudio })); booth.position.set(0, 1.4, -18); scene.add(booth);
  const boothStrip = new THREE.Mesh(new THREE.BoxGeometry(5, 0.04, 0.02), new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 5, 2) })); boothStrip.position.set(0, 1.95, -17.24); scene.add(boothStrip);
  const stage = new THREE.Mesh(new THREE.BoxGeometry(24, 0.8, 8), wallMat); stage.position.set(0, 0.4, -19); scene.add(stage);
  const dj = makeFigure({ color: 0x0a0a0a }); dj.position.set(0, 0.8, -18.8); scene.add(dj);
  // crowd (instanced)
  const parts = [];
  const bodyG = new THREE.CylinderGeometry(0.2, 0.15, 0.72, 10); bodyG.translate(0, 1.22, 0); parts.push(bodyG);
  const legG = new THREE.CylinderGeometry(0.15, 0.1, 0.88, 8); legG.translate(0, 0.44, 0); parts.push(legG);
  const headG = new THREE.SphereGeometry(0.115, 12, 10); headG.scale(0.95, 1.15, 1); headG.translate(0, 1.76, 0); parts.push(headG);
  const shG = new THREE.CapsuleGeometry(0.08, 0.36, 4, 8); shG.rotateZ(Math.PI / 2); shG.translate(0, 1.55, 0); parts.push(shG);
  const crowdUp = [...parts]; const crowdDown = [...parts];
  const aL = new THREE.CapsuleGeometry(0.045, 0.42, 4, 6); aL.rotateZ(0.35); aL.translate(-0.3, 1.88, 0); crowdUp.push(aL);
  const aR = new THREE.CapsuleGeometry(0.045, 0.42, 4, 6); aR.rotateZ(-0.35); aR.translate(0.3, 1.88, 0); crowdUp.push(aR);
  const dL = new THREE.CapsuleGeometry(0.045, 0.55, 4, 6); dL.translate(-0.27, 1.2, 0); crowdDown.push(dL);
  const dR = new THREE.CapsuleGeometry(0.045, 0.55, 4, 6); dR.translate(0.27, 1.2, 0); crowdDown.push(dR);
  const crowdMat = new THREE.MeshStandardMaterial({ color: 0x0a0809, roughness: 0.5, metalness: 0.1, envMap: SHARED.envNight, envMapIntensity: 0.6 });
  const R = rng(17); const people = [];
  const mU = new THREE.InstancedMesh(mergeGeometries(crowdUp), crowdMat, 160), mD = new THREE.InstancedMesh(mergeGeometries(crowdDown), crowdMat, 160);
  let nu = 0, nd = 0;
  for (let i = 0; i < 300; i++) {
    const x = (R() - 0.5) * 26, z = -15 + R() * 22; const up = R() < 0.45;
    people.push({ x, z, up, idx: up ? nu++ : nd++, ph: R() * 6.28, s: 0.92 + R() * 0.16, ry: (R() - 0.5) * 0.8 });
  }
  mU.count = nu; mD.count = nd; mU.frustumCulled = mD.frustumCulled = false; scene.add(mU); scene.add(mD);
  // beams from truss
  const beams = []; const cols = [0xffc070, 0xffffff, 0xff3fa0, 0xffc070, 0xffa040, 0xffffff];
  for (let i = 0; i < 6; i++) { const b = makeBeam(new THREE.Color(cols[i]), 40, 3.2, 0.11); b.position.set(-10 + i * 4, 9.5, -19); b.userData.ph = i; scene.add(b); beams.push(b); }
  const back1 = new THREE.PointLight(0xffa040, 60, 40, 1.2); back1.position.set(-4, 4, -16); scene.add(back1);
  const back2 = new THREE.PointLight(0xff2a90, 40, 40, 1.2); back2.position.set(6, 5, -15); scene.add(back2);
  const strobe = new THREE.PointLight(0xffffff, 0, 60, 1.0); strobe.position.set(0, 8, -6); scene.add(strobe);
  scene.add(new THREE.AmbientLight(0x150a10, 0.6));
  const smoke = makeSmoke(26, new THREE.Vector3(34, 6, 26), new THREE.Color(0.55, 0.38, 0.3), 0.1, 5, [8, 16]); smoke.position.set(0, 4, -8); scene.add(smoke);
  const confetti = makeParticles({ count: 600, seed: 9, spread: new THREE.Vector3(30, 12, 26), size: 0.25, center: new THREE.Vector3(0, 6, -8), speed: new THREE.Vector3(0, -1.2, 0) }); scene.add(confetti);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 500);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  return {
    scene, camera, K: 2, shutter: 0.5,
    update(lt, t) {
      led.material.uniforms.uTime.value = t; smoke.userData.update(t); confetti.userData.update(t);
      const beat = Math.pow(1 - ((t % BEAT) / BEAT), 3);
      for (const p of people) {
        const bob = Math.abs(Math.sin(t * Math.PI * 2 + p.ph)) * 0.08;
        e.set(0, p.ry + Math.sin(t * 2 + p.ph) * 0.15, Math.sin(t * Math.PI * 2 + p.ph) * 0.05); q.setFromEuler(e);
        pv.set(p.x, bob, p.z); sv.setScalar(p.s); m.compose(pv, q, sv); (p.up ? mU : mD).setMatrixAt(p.idx, m);
      }
      mU.instanceMatrix.needsUpdate = mD.instanceMatrix.needsUpdate = true;
      beams.forEach((b, i) => { const a = t * 1.3 + i * 1.1; b.rotation.set(Math.sin(a) * 0.55 + 0.25, 0, Math.cos(a * 0.7) * 0.5); });
      dj.userData.pose({ arx: -1.2 + Math.sin(t * 12.56) * 0.2, alx: -0.9, elL: -0.8, elR: -0.6, bob: -beat * 0.04 });
      strobe.intensity = ((t % BEAT) < 0.035) ? 120 : 0;
      back1.intensity = 45 + beat * 60;
      camera.position.set(lerp(-1.5, 1.0, lt / 0.75), 2.15, lerp(9.5, 8.2, lt / 0.75)).add(shake(t, 0.04, 3, 4));
      camera.lookAt(0, 3.0, -18); camera.rotateZ(-0.04);
    },
    grade: { bloom: 1.0, bloomThresh: 0.7, exposure: 1.2, streak: 1.2, sat: 1.1 },
  };
}

// --- Penthouse ---
function penthouseShot() {
  const scene = new THREE.Scene();
  const U = makeEnvUniforms({ fogColor: 0x120c08, fogDensity: 0.0007 });
  scene.add(makeSky({ zenith: 0x02030a, horizon: 0x24160c, glow: 0x5a3010, stars: 0.6 }));
  const city = makeAerialCity(U, { seed: 12, blocks: 20, traffic: 1600, center: new THREE.Vector2(0, -500) }); scene.add(city);
  scene.add(makeHills(2600, 9, 0x050404));
  const room = penthouse(city); room.position.set(0, 150, 60); scene.add(room);
  const fig = makeFigure({ color: 0x0a0909, coat: true, watch: true }); fig.position.set(0.3, 150, 60.1); fig.rotation.y = Math.PI; scene.add(fig);
  fig.userData.pose({ alx: -1.4, elL: -1.5, arz: -0.05, hx: 0.1 });
  const figRim = new THREE.PointLight(0xffb060, 28, 4, 1.5); figRim.position.set(0.9, 151.9, 59.3); scene.add(figRim);
  const figRim2 = new THREE.PointLight(0xffd090, 6, 4, 1.5); figRim2.position.set(-0.6, 151.2, 59.4); scene.add(figRim2);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0xffb040, emissive: 0x4a2000, roughness: 0.1, transparent: true, opacity: 0.8 }));
  glass.position.set(0, -0.36, 0.0); fig.userData.L.armL.knee.add(glass);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 9000);
  return {
    scene, camera, K: 2, shutter: 0.5,
    update(lt, t) {
      city.userData.update(t);
      const p = easeInOut(lt / 0.75);
      camera.position.set(lerp(-2.6, -0.8, p), 151.45, 60 + 5.0);
      camera.lookAt(lerp(-0.7, 0.4, p), 151.55, 40);
    },
    grade: { bloom: 0.85, bloomThresh: 0.75, exposure: 1.35, streak: 0.8, vignette: 0.8 },
  };
}

// --- Street racing ---
function streetRace() {
  const S = nightStreet({ seed: 44, fogDensity: 0.005 });
  const a = makeCar({ color: 0x9a6a1a, metal: 0.9, rough: 0.25 }); const b = makeCar({ color: 0x0a0a0a, metal: 0.7, rough: 0.2 });
  S.scene.add(a); S.scene.add(b);
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 6000);
  return {
    scene: S.scene, camera, K: 4, shutter: 0.7,
    update(lt, t) {
      S.tick(t);
      const v = 46; const z0 = -100 + v * lt;
      const za = z0 + 1.2 + lt * 2.5, zb = z0 - 0.4;
      a.position.set(-2.4, 0, za); b.position.set(-7.4, 0, zb); a.userData.update(lt, v); b.userData.update(lt, v);
      S.lampsNear(z0, 0, 80);
      camera.position.set(-4.9, 0.42, z0 - 6.2 + lt * 0.8).add(shake(t, 0.06, 9, 7));
      camera.lookAt(-4.9, 0.8, z0 + 30); camera.rotateZ(0.03 * Math.sin(t * 3));
      setLights(S.U, [
        { p: new THREE.Vector3(-2.4, 0.7, za - 2.7), c: new THREE.Color(1, 0.05, 0.02), i: 0.7, r: 2 },
        { p: new THREE.Vector3(-7.4, 0.7, zb - 2.7), c: new THREE.Color(1, 0.05, 0.02), i: 0.7, r: 2 },
        { p: new THREE.Vector3(-2.4, 0.6, za + 6), c: new THREE.Color(1, 0.95, 0.85), i: 1.5, r: 6 },
        { p: new THREE.Vector3(-7.4, 0.6, zb + 6), c: new THREE.Color(1, 0.95, 0.85), i: 1.5, r: 6 },
      ]);
    },
    grade: { bloom: 0.9, bloomThresh: 0.75, exposure: 1.25, streak: 1.2 },
  };
}

// --- Luxury outfit / arrival ---
function luxury() {
  const scene = new THREE.Scene();
  scene.add(makeSky({ zenith: 0x010104, horizon: 0x120a06, glow: 0x2a1406, stars: 0 }));
  const ground = wetGround(0x080706, 0.12, 200); scene.add(ground);
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 30), new THREE.MeshStandardMaterial({ color: 0x3a0606, roughness: 0.8 })); carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.01, -8); scene.add(carpet);
  const car = makeCar({ color: 0x060606, metal: 0.8, rough: 0.18, env: SHARED.envStudio, envInt: 1.2 }); car.position.set(-2.4, 0, 1.5); car.rotation.y = 0; scene.add(car);
  const fig = makeFigure({ color: 0x08080a, coat: false, watch: true, rough: 0.35 }); fig.position.set(0, 0, 0); scene.add(fig);
  const fig2 = makeFigure({ color: 0x3a2a12, dress: true, longHair: true, skin: 0x6a4a36 }); fig2.position.set(0.75, 0, -0.5); fig2.scale.setScalar(0.95); scene.add(fig2);
  // entrance frame with gold light
  const frameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.8, 1.5) });
  for (const x of [-3, 3]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 6, 0.12), frameMat); p.position.set(x, 3, -10); scene.add(p); }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.1, 0.12, 0.12), frameMat); lintel.position.set(0, 6, -10); scene.add(lintel);
  const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 5.9), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.0, 0.45) })); doorGlow.position.set(0, 2.95, -10.1); scene.add(doorGlow);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(80, 30), new THREE.MeshStandardMaterial({ color: 0x0a0807, roughness: 0.6 })); wall.position.set(0, 15, -10.2); scene.add(wall);
  const backL = new THREE.PointLight(0xffb060, 120, 30, 1.3); backL.position.set(0, 3, -8.5); scene.add(backL);
  const key = new THREE.SpotLight(0xffd8a0, 60, 30, 0.5, 0.6, 1.2); key.position.set(4, 5, 5); key.target.position.set(0, 1, 0); scene.add(key); scene.add(key.target);
  scene.add(new THREE.AmbientLight(0x1a120a, 0.4));
  const flash = new THREE.PointLight(0xffffff, 0, 30, 1.2); scene.add(flash);
  const flashes = [0.12, 0.31, 0.45, 0.6]; const fPos = [[3, 1.8, 3], [-3.5, 2, 2], [4, 1.6, 0.5], [-2, 2.2, 4]];
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 500);
  return {
    scene, camera, K: 2, shutter: 0.5,
    update(lt, t) {
      car.userData.update(0, 0);
      const ph = lt * 2.6;
      fig.position.z = -1.6 + lt * 1.1; fig.userData.walk(ph, 0.8); fig.rotation.y = 0;
      fig2.position.z = -2.0 + lt * 1.1; fig2.userData.walk(ph + 2.2, 0.6); fig2.rotation.y = 0;
      flash.intensity = 0;
      flashes.forEach((f, i) => { const d = lt - f; if (d > 0 && d < 0.06) { flash.intensity = 900 * (1 - d / 0.06); flash.position.set(...fPos[i]); } });
      const p = easeOut(lt / 0.75);
      camera.position.set(lerp(0.6, 0.3, p), 0.35, lerp(5.6, 4.6, p));
      camera.lookAt(0.2, 1.5, -2);
    },
    grade: { bloom: 1.0, bloomThresh: 0.7, exposure: 1.25, streak: 1.3 },
  };
}

// --- Sunset ---
function sunset() {
  const scene = new THREE.Scene();
  const sunDir = new THREE.Vector3(0.15, 0.035, -1).normalize();
  const sky = sunsetSky({ sunDir, sunSize: 0.0012 }); scene.add(sky);
  const U = makeEnvUniforms({ fogColor: 0x9a5a38, fogDensity: 0.00042, day: 1, sunDir: new THREE.Vector3(0.15, 0.3, -1), sunCol: 0xff9a50, litProb: 0.5 });
  const city = makeAerialCity(U, { seed: 15, blocks: 12, traffic: 400, center: new THREE.Vector2(0, 0) }); city.position.set(-600, 0, -1500); scene.add(city);
  // ocean
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000, 1, 1), new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSun: { value: sunDir } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform float uTime; uniform vec3 uSun; varying vec3 vW;
      float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
      void main(){ vec3 V = normalize(vW - cameraPosition);
        vec2 p = vW.xz*0.15; float w = n(p + vec2(uTime*0.3, uTime*0.2)) + 0.5*n(p*2.3 - uTime*0.4) + 0.25*n(p*5.1 + uTime);
        vec3 N = normalize(vec3((w-0.9)*0.25, 1.0, (n(p*1.7+3.0+uTime*0.25)-0.5)*0.25));
        vec3 R = reflect(V, N); float s = max(dot(R, uSun), 0.0);
        float fres = pow(1.0 - max(dot(-V, vec3(0,1,0)),0.0), 4.0);
        vec3 sky = mix(vec3(0.12,0.08,0.12), vec3(1.0,0.45,0.15), smoothstep(0.0, 0.3, 1.0 - R.y*3.0));
        vec3 c = vec3(0.02,0.025,0.04) + sky*fres*0.8 + vec3(1.0,0.6,0.25)*pow(s, 300.0)*30.0 + vec3(1.0,0.5,0.2)*pow(s,20.0)*0.4;
        float d = length(vW.xz - cameraPosition.xz); c = mix(c, vec3(0.9,0.42,0.18), smoothstep(800.0, 4000.0, d));
        gl_FragColor = vec4(c,1.0); }` }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -0.5; scene.add(sea);
  // coastal hill + road silhouette foreground
  const hill = new THREE.Mesh(new THREE.BoxGeometry(400, 6, 30), new THREE.MeshBasicMaterial({ color: 0x050302 })); hill.position.set(0, 1, 40); scene.add(hill);
  const palms = [];
  [[-14, 30, 13], [-8, 34, 11], [6, 31, 14], [12, 36, 10], [24, 30, 12], [-26, 33, 15]].forEach(([x, z, h], i) => { const p = makePalm(i + 3, h, new THREE.MeshBasicMaterial({ color: 0x030201 })); p.position.set(x, 4, z); scene.add(p); palms.push(p); });
  const car = makeCar({ color: 0x050505, env: SHARED.envSunset }); car.scale.setScalar(1); scene.add(car);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 12000);
  return {
    scene, camera, K: 2, shutter: 0.5,
    update(lt, t) {
      city.userData.update(t); sea.material.uniforms.uTime.value = t; palms.forEach((p) => p.userData.update(t));
      car.position.set(-30 + lt * 18, 4.0, 42); car.rotation.y = Math.PI / 2; car.userData.update(lt, 18);
      const p = easeInOut(lt / 1.0);
      camera.position.set(lerp(-6, 2, p), 9.5, 58); camera.lookAt(lerp(-30, -10, p), 14, -400);
    },
    grade: { bloom: 1.0, bloomThresh: 0.85, exposure: 1.0, streak: 1.2, sat: 1.05, high: new THREE.Color(0.06, 0.02, -0.04) },
  };
}

export const B_SHOTS = [
  { id: 'supercar', t0: 5.0, t1: 6.0, make: supercar },
  { id: 'club', t0: 6.0, t1: 6.75, make: nightclub, lightScale: 0.8 },
  { id: 'penthouse', t0: 6.75, t1: 7.5, make: penthouseShot },
  { id: 'race', t0: 7.5, t1: 8.25, make: streetRace },
  { id: 'luxury', t0: 8.25, t1: 9.0, make: luxury },
  { id: 'sunset', t0: 9.0, t1: 10.0, make: sunset },
];
