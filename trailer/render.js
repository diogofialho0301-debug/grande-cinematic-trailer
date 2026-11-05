// Headless capture driver.
//   node render.js --stills 30,300,900 --out stills/        -> PNG stills
//   node render.js --range 0 1800 --out build/seg.mkv        -> lossless-ish video segment
//   node render.js --all --workers 3                         -> renders build/video.mkv in parallel segments
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = __dirname;
const TOTAL = 1800; // 30 s @ 60 fps
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };

function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf', '.json': 'application/json' };
  const srv = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}

async function openPage(port) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/src/index.html`);
  await page.waitForFunction(() => window.renderFrame !== undefined, null, { timeout: 120000 });
  return { browser, page };
}

async function renderRange(port, a, b, out) {
  const { browser, page } = await openPage(port);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '60', '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '8', '-pix_fmt', 'yuv444p', '-r', '60', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = a; f < b; f++) {
    await page.evaluate((f) => window.renderFrame(f), f);
    const buf = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((f - a) % 30 === 0) {
      const el = (Date.now() - t0) / 1000; const done = f - a + 1;
      console.log(`[${out}] frame ${f} (${done}/${b - a}) ${(el / done).toFixed(2)}s/f eta ${((b - a - done) * el / done / 60).toFixed(1)}m`);
    }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
}

(async () => {
  const srv = await serve(); const port = srv.address().port;
  if (args.includes('--stills')) {
    const frames = arg('--stills').split(',').map(Number); const outDir = arg('--out', 'stills');
    fs.mkdirSync(outDir, { recursive: true });
    const { browser, page } = await openPage(port);
    for (const f of frames) {
      const t0 = Date.now();
      await page.evaluate((f) => window.renderFrame(f), f);
      await page.screenshot({ path: path.join(outDir, `f${String(f).padStart(4, '0')}.png`) });
      console.log('still', f, ((Date.now() - t0) / 1000).toFixed(2) + 's');
    }
    await browser.close();
  } else if (args.includes('--range')) {
    const i = args.indexOf('--range');
    await renderRange(port, +args[i + 1], +args[i + 2], arg('--out', 'build/seg.mp4'));
  } else if (args.includes('--shots')) {
    // Per-shot rendering with a work queue: build/shots/NN_id.mp4 (re-render single shots with --only id1,id2)
    const { browser, page } = await openPage(port);
    const list = await page.evaluate(() => window.SHOT_LIST);
    await browser.close();
    const only = arg('--only', '') ? arg('--only').split(',') : null;
    fs.mkdirSync(path.join(ROOT, 'build', 'shots'), { recursive: true });
    const name = (i) => path.join(ROOT, 'build', 'shots', `${String(i).padStart(2, '0')}_${list[i].id}.mp4`);
    const queue = list.map((s, i) => i).filter((i) => !only || only.includes(list[i].id));
    queue.sort((a, b) => (list[b].t1 - list[b].t0) - (list[a].t1 - list[a].t0));
    const workers = +arg('--workers', 4);
    await Promise.all(Array.from({ length: workers }, async () => {
      while (queue.length) {
        const i = queue.shift();
        const a = Math.round(list[i].t0 * 60), b = Math.round(list[i].t1 * 60);
        await renderRange(port, a, b, name(i));
      }
    }));
    fs.writeFileSync(path.join(ROOT, 'build', 'segments.txt'), list.map((s, i) => `file '${name(i)}'`).join('\n'));
    console.log('shots done');
  } else if (args.includes('--all')) {
    const workers = +arg('--workers', 3); const segs = [];
    const from = +arg('--from', 0), to = +arg('--to', TOTAL);
    const per = Math.ceil((to - from) / workers);
    const jobs = [];
    for (let w = 0; w < workers; w++) {
      const a = from + w * per, b = Math.min(to, a + per); if (a >= b) continue;
      const out = path.join(ROOT, 'build', `seg_${String(a).padStart(4, '0')}.mp4`); segs.push(out);
      jobs.push(renderRange(port, a, b, out));
    }
    await Promise.all(jobs);
    fs.writeFileSync(path.join(ROOT, 'build', 'segments.txt'), segs.map((s) => `file '${s}'`).join('\n'));
    console.log('segments done');
  }
  srv.close();
})();
