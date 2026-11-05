// Post pipeline: temporal accumulation (motion blur + AA), bloom, anamorphic streaks, film grade.
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const quadGeo = new THREE.PlaneGeometry(2, 2);
function fsMat(frag, uniforms, extra = {}) {
  return new THREE.ShaderMaterial({
    uniforms, depthTest: false, depthWrite: false, ...extra,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.,1.); }',
    fragmentShader: frag,
  });
}

export class Post {
  constructor(renderer, w, h) {
    this.r = renderer; this.w = w; this.h = h;
    const opt = { type: THREE.HalfFloatType, depthBuffer: true, samples: 0 };
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, opt);
    this.accRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false });
    this.streakA = new THREE.WebGLRenderTarget(w / 4, h / 4, { type: THREE.HalfFloatType, depthBuffer: false });
    this.streakB = new THREE.WebGLRenderTarget(w / 4, h / 4, { type: THREE.HalfFloatType, depthBuffer: false });
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(quadGeo); this.qs = new THREE.Scene(); this.qs.add(this.quad); this.quad.frustumCulled = false;

    this.accMat = fsMat('uniform sampler2D tSrc; uniform float uW; varying vec2 vUv; void main(){ vec3 c = texture2D(tSrc,vUv).rgb; c = mix(c, vec3(0.0), vec3(isnan(c))); c = clamp(c, 0.0, 80.0); gl_FragColor = vec4(c*uW, 1.0); }',
      { tSrc: { value: null }, uW: { value: 1 } }, { blending: THREE.AdditiveBlending, transparent: true });
    this.copyMat = fsMat('uniform sampler2D tSrc; uniform float uW; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tSrc,vUv).rgb*uW, 1.0); }',
      { tSrc: { value: null }, uW: { value: 1 } });
    this.streakMat = fsMat(`uniform sampler2D tSrc; uniform vec2 uDir; uniform float uThresh; uniform float uFirst; varying vec2 vUv;
      void main(){ vec3 acc = vec3(0.); float wsum = 0.;
        for (int i=-12;i<=12;i++){ float fi = float(i); float w = exp(-abs(fi)*0.18); vec3 c = texture2D(tSrc, vUv + uDir*fi).rgb;
          if (uFirst > 0.5) c = max(c - uThresh, 0.0); acc += c*w; wsum += w; }
        gl_FragColor = vec4(acc/wsum, 1.0); }`, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() }, uThresh: { value: 1.2 }, uFirst: { value: 1 } });

    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.8, 0.6, 0.85);
    this.grade = fsMat(`uniform sampler2D tSrc, tStreak; uniform float uExposure, uFade, uSat, uContrast, uVig, uCA, uGrain, uSeed, uStreak, uTime;
      uniform vec3 uFlash, uShadow, uHigh, uLift; varying vec2 vUv;
      vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.,1.); }
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uSeed)*43758.5453); }
      vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
      void main(){
        vec2 uv = vUv; vec2 cc = uv - 0.5;
        float ca = uCA * dot(cc,cc);
        vec3 col;
        col.r = texture2D(tSrc, uv - cc*ca).r; col.g = texture2D(tSrc, uv).g; col.b = texture2D(tSrc, uv + cc*ca).b;
        col += texture2D(tStreak, uv).rgb * vec3(0.55,0.75,1.0) * uStreak;
        col *= uExposure;
        col += uFlash;
        col = aces(col);
        // split-tone grade: teal-ish shadows, gold highlights
        float l = dot(col, vec3(0.2126,0.7152,0.0722));
        col = mix(vec3(l), col, uSat);
        col += uShadow * (1.0 - smoothstep(0.0, 0.45, l)) * 0.6 + uHigh * smoothstep(0.35, 1.0, l) * 0.5;
        col = (col - 0.5) * uContrast + 0.5 + uLift;
        col = clamp(col, 0., 1.);
        // vignette
        float v = smoothstep(0.95, 0.25, length(cc*vec2(1.25,1.0)));
        col *= mix(1.0, v, uVig);
        col = toSRGB(col);
        // grain (in display space)
        float g = h(uv*vec2(1920.,804.)) + h(uv*vec2(1311.,977.)+3.1) - 1.0;
        col += g * uGrain * (0.6 + 0.4*(1.0-l));
        col *= (1.0 - uFade);
        gl_FragColor = vec4(col, 1.0);
      }`, {
      tSrc: { value: null }, tStreak: { value: null }, uExposure: { value: 1 }, uFade: { value: 0 }, uSat: { value: 1 }, uContrast: { value: 1.08 },
      uVig: { value: 0.6 }, uCA: { value: 0.012 }, uGrain: { value: 0.035 }, uSeed: { value: 0 }, uStreak: { value: 0.8 }, uTime: { value: 0 },
      uFlash: { value: new THREE.Color(0, 0, 0) }, uShadow: { value: new THREE.Color(-0.01, 0.0, 0.02) }, uHigh: { value: new THREE.Color(0.05, 0.025, -0.03) }, uLift: { value: new THREE.Color(0, 0, 0) },
    });
  }

  blit(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.qs, this.cam); }

  // renderSub(k) must render the scene for subframe k into this.sceneRT
  frame(K, renderSub, g) {
    const r = this.r;
    r.setRenderTarget(this.accRT); r.setClearColor(0x000000, 1); r.clear();
    for (let k = 0; k < K; k++) {
      r.setRenderTarget(this.sceneRT); r.setClearColor(0x000000, 1); r.clear();
      renderSub(k, this.sceneRT);
      this.accMat.uniforms.tSrc.value = this.sceneRT.texture; this.accMat.uniforms.uW.value = 1 / K;
      this.blit(this.accMat, this.accRT);
    }
    // anamorphic streaks
    if ((g.streak ?? 0.8) > 0) {
      this.streakMat.uniforms.uThresh.value = g.streakThresh ?? 1.4;
      this.streakMat.uniforms.tSrc.value = this.accRT.texture; this.streakMat.uniforms.uFirst.value = 1; this.streakMat.uniforms.uDir.value.set(4 / this.w, 0);
      this.blit(this.streakMat, this.streakA);
      this.streakMat.uniforms.tSrc.value = this.streakA.texture; this.streakMat.uniforms.uFirst.value = 0; this.streakMat.uniforms.uDir.value.set(14 / this.w, 0);
      this.blit(this.streakMat, this.streakB);
    }
    // bloom (blends onto accRT)
    this.bloom.strength = g.bloom ?? 0.8; this.bloom.radius = g.bloomRadius ?? 0.6; this.bloom.threshold = g.bloomThresh ?? 0.85;
    this.bloom.render(r, null, this.accRT, 0, false);
    const u = this.grade.uniforms;
    u.tSrc.value = this.accRT.texture; u.tStreak.value = this.streakB.texture;
    u.uExposure.value = g.exposure ?? 1; u.uFade.value = g.fade ?? 0; u.uSat.value = g.sat ?? 1; u.uContrast.value = g.contrast ?? 1.08;
    u.uVig.value = g.vignette ?? 0.6; u.uCA.value = g.ca ?? 0.012; u.uGrain.value = g.grain ?? 0.03; u.uSeed.value = g.seed ?? 0; u.uStreak.value = g.streak ?? 0.8;
    u.uFlash.value.copy(g.flash ?? new THREE.Color(0, 0, 0));
    if (g.shadow) u.uShadow.value.copy(g.shadow); else u.uShadow.value.setRGB(-0.012, 0.004, 0.022);
    if (g.high) u.uHigh.value.copy(g.high); else u.uHigh.value.setRGB(0.05, 0.022, -0.035);
    this.blit(this.grade, null);
  }
}
