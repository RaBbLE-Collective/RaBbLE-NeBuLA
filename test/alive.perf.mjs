// Frame-rate probe for <rabble-entity backend="alive"> in 2D and 3D, awake (post-boot), at a HiDPI viewport.
// Needs the dev CDN on :8080. Run: PLAYWRIGHT=<playwright pkg path> node test/alive.perf.mjs [gpu|swiftshader] [dpr]
import { createRequire } from 'node:module';
const { chromium, firefox } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || 'playwright');
// BROWSER=firefox [FFACCEL=1 -> gfx.canvas.accelerated forced on] [HEADED=1 -> real window, real GPU compositor]
const mode = process.argv[2] || 'gpu', dpr = +(process.argv[3] || 2), W = +(process.env.W || 1280), H = +(process.env.H || 800);
// SW2D=1 disables accelerated 2D canvas: reproduces browsers that raster Canvas2D on the CPU (e.g. Firefox on Linux).
const args = mode === 'gpu'
  ? ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=' + (process.env.ANGLE || 'vulkan'), '--enable-features=Vulkan', '--enable-gpu-rasterization', process.env.SW2D ? '--disable-accelerated-2d-canvas' : '--enable-accelerated-2d-canvas']
  : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = process.env.BROWSER === 'firefox'
  ? await firefox.launch({ headless: !process.env.HEADED, firefoxUserPrefs: process.env.FFACCEL
      ? { 'gfx.canvas.accelerated': true, 'gfx.canvas.accelerated.force-enabled': true, 'gfx.webrender.all': true } : {} })
  : await chromium.launch({ args, headless: !process.env.HEADED });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
await page.goto('http://localhost:8080/examples/alive.html?autoboot=1&delay=0.2&auto=0&profile=1' + (process.env.RENDERER ? '&renderer=' + process.env.RENDERER : ''));
const gpu = await page.evaluate(() => { const c = document.createElement('canvas').getContext('webgl'); const d = c && c.getExtension('WEBGL_debug_renderer_info'); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'n/a'; });
await page.waitForFunction(() => document.getElementById('e').getSnapshot().boot.done, null, { timeout: 180000, polling: 500 });
const fps = () => page.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); (function f() { n++; performance.now() - t0 < 3000 ? requestAnimationFrame(f) : r(+(n / 3).toFixed(1)); })(); }));
await page.waitForTimeout(1500);
const f2 = await fps();
const snap2 = await page.evaluate(() => { const s = document.getElementById('e').getSnapshot(); const c = document.querySelector('.rbl-alive canvas'); const v = [...document.querySelectorAll('.rbl-alive canvas')].find(x => getComputedStyle(x).display !== 'none'); return { quality: s.quality, renderer: s.renderer, profile: s.profile, backing: v.width + 'x' + v.height }; });
await page.evaluate(() => document.getElementById('e').setDimension('3d'));
await page.waitForFunction(() => document.getElementById('e').getSnapshot().dimension === '3d', null, { timeout: 60000, polling: 250 });
await page.waitForTimeout(1500);
const f3 = await fps();
console.log(JSON.stringify({ browser: process.env.BROWSER || 'chromium', ffaccel: !!process.env.FFACCEL, mode, dpr, gpu, fps2d: f2, fps3d: f3, ...snap2 }));
await browser.close();
