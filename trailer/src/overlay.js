// DOM typography layer, driven deterministically per frame.
import { clamp, easeOut, easeInOut, smooth, expOut } from './lib.js';

const ITEMS = [
  // 0-5
  { text: 'EVERY CITY HAS A STORY.', t0: 1.9, t1: 4.75, cls: 'serif gold shadow', size: 58, y: 540, track: [0.62, 0.36], stagger: 0.045, inDur: 0.9, style: 'reveal' },
  // 5-10
  { text: 'WRITE YOUR OWN.', t0: 8.0, t1: 9.92, cls: 'black gold shadow', size: 104, y: 540, track: [0.5, 0.22], stagger: 0.03, inDur: 0.5, style: 'reveal' },
  // 17-24
  { text: 'YOUR LIFE.', t0: 17.0, t1: 18.92, cls: 'black gold shadow', size: 150, y: 540, track: [0.32, 0.16], stagger: 0.0, inDur: 0.28, style: 'slam' },
  { text: 'YOUR RULES.', t0: 19.0, t1: 20.92, cls: 'black gold shadow', size: 150, y: 540, track: [0.32, 0.16], stagger: 0.0, inDur: 0.28, style: 'slam' },
  { text: 'YOUR STORY.', t0: 21.0, t1: 23.97, cls: 'black gold shadow', size: 150, y: 540, track: [0.32, 0.16], stagger: 0.0, inDur: 0.28, style: 'slam' },
  // reveal tagline
  { text: 'THE CITY IS YOURS.', t0: 27.15, t1: 29.4, cls: 'light gold', size: 34, y: 742, track: [1.1, 0.72], stagger: 0.04, inDur: 1.0, style: 'reveal', hold: true },
];

const CAPS = [
  { n: '01', text: 'LAW ENFORCEMENT', t0: 17.0, t1: 18.0 },
  { n: '02', text: 'CRIMINAL ORGANIZATIONS', t0: 18.0, t1: 19.0 },
  { n: '03', text: 'EMERGENCY SERVICES', t0: 19.0, t1: 20.0 },
  { n: '04', text: 'BUSINESS OWNERS', t0: 20.0, t1: 21.0 },
  { n: '05', text: 'CIVILIAN LIFE', t0: 21.0, t1: 22.5 },
  { n: '06', text: 'LUXURY & NIGHTLIFE', t0: 22.5, t1: 24.0 },
];

export class Overlay {
  constructor(root) {
    this.root = root; this.els = [];
    for (const it of ITEMS) {
      const d = document.createElement('div'); d.className = 'txt ' + it.cls;
      d.style.fontSize = it.size + 'px'; d.style.lineHeight = '1'; d.style.top = (it.y - it.size * 0.55) + 'px';
      const spans = [];
      for (const ch of it.text) { const s = document.createElement('span'); s.textContent = ch === ' ' ? ' ' : ch; d.appendChild(s); spans.push(s); }
      root.appendChild(d); this.els.push({ it, d, spans });
    }
    this.caps = CAPS.map((c) => {
      const d = document.createElement('div'); d.className = 'cap';
      d.innerHTML = `<i></i><b>${c.n}</b>${c.text}`; root.appendChild(d); return { c, d, bar: d.querySelector('i') };
    });
  }

  update(t) {
    for (const { it, d, spans } of this.els) {
      if (t < it.t0 - 0.01 || t > it.t1 + 0.01) { d.style.display = 'none'; continue; }
      d.style.display = 'block';
      const lt = t - it.t0, dur = it.t1 - it.t0;
      const outDur = it.style === 'slam' ? 0.22 : 0.45;
      const out = clamp((t - (it.t1 - outDur)) / outDur);
      const trackP = easeOut(lt / dur);
      const track = it.track[0] + (it.track[1] - it.track[0]) * trackP;
      d.style.letterSpacing = track + 'em';
      d.style.paddingLeft = track + 'em'; // keep visually centred with trailing spacing
      if (it.style === 'slam') {
        const p = clamp(lt / it.inDur);
        const sc = 1.0 + 0.35 * (1 - expOut(p)) + 0.04 * (1 - lt / dur);
        const op = Math.min(1, p * 3) * (1 - out);
        const blur = 14 * (1 - easeOut(p)) + 10 * out;
        d.style.transform = `scale(${sc + out * 0.08})`;
        d.style.opacity = op;
        d.style.filter = `blur(${blur}px) drop-shadow(0 0 22px rgba(0,0,0,0.9))`;
        spans.forEach((s) => { s.style.opacity = 1; s.style.transform = ''; s.style.filter = ''; });
      } else {
        d.style.transform = `scale(${1 + 0.03 * (lt / dur)})`;
        d.style.opacity = it.hold ? 1 : 1 - out;
        d.style.filter = '';
        spans.forEach((s, i) => {
          const p = clamp((lt - i * it.stagger) / it.inDur);
          const e = easeInOut(p);
          s.style.opacity = e * (it.hold ? 1 : 1);
          s.style.filter = `blur(${(1 - e) * 12 + out * 8}px)`;
          s.style.transform = `translateY(${(1 - e) * 14}px)`;
        });
      }
    }
    for (const { c, d, bar } of this.caps) {
      if (t < c.t0 || t > c.t1) { d.style.display = 'none'; continue; }
      d.style.display = 'block';
      const lt = t - c.t0, dur = c.t1 - c.t0;
      const p = easeOut(lt / 0.35);
      const out = clamp((t - (c.t1 - 0.15)) / 0.15);
      d.style.opacity = p * (1 - out);
      d.style.transform = `translateX(${(1 - p) * -30}px)`;
      bar.style.transform = `scaleX(${p})`;
    }
  }
}
