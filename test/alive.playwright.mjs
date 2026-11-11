// Playwright check of <rabble-entity backend="alive"> via the NeBuLA entity lab.
// Headless swiftshader renders slowly, so every wait is on the entity's own state, never wall time.
// Needs dev-serve.sh running (http://localhost:8080) and a built dist/nebula.iife.js.
// Run: PLAYWRIGHT=<path to a playwright package whose browsers are installed> node test/alive.playwright.mjs
//   (ESM ignores npx's module path; S234 used ~/.npm/_npx/218f5d799962bf90/node_modules/playwright, chromium 1228)
// Screenshots land in test/shots/ (gitignored).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium, devices } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || 'playwright');
const BASE = 'http://localhost:8080/examples/alive.html';
const OUT = process.env.SHOTS || new URL('./shots/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
// GPU=1 uses the real GPU (fast); default is swiftshader (portable, slow: every wait is on entity state).
const browser = await chromium.launch({ args: process.env.GPU
  ? ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=vulkan', '--enable-features=Vulkan']
  : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
const check = (name, ok, info = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  · ' + info : ''}`); console.log(results.at(-1)); };
const shot = (page, name) => page.screenshot({ path: OUT + name, timeout: 90000 });

async function open(ctxOpts, query, iphone) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [], notices = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.text().startsWith('[notice]')) notices.push(m.text()); });
  if (iphone) await page.addInitScript(() => {
    // Chromium has no notch: simulate iPhone 15 safe areas + draw the Dynamic Island for the screenshot.
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = ':root{--rbl-safe-top:59px;--rbl-safe-bottom:34px}.lab{bottom:46px!important}' +
        '#island{position:fixed;left:50%;top:11px;width:126px;height:37px;margin-left:-63px;border-radius:20px;background:#000;z-index:99}';
      document.head.appendChild(s);
      const d = document.createElement('div'); d.id = 'island'; document.body.appendChild(d);
    });
  });
  await page.goto(BASE + query);
  const snap = () => page.evaluate(() => document.getElementById('e').getSnapshot());
  const until = async (pred, ms = 120000) => { const t0 = Date.now(); let s; while (Date.now() - t0 < ms) { s = await snap(); if (s && pred(s)) return s; await page.waitForTimeout(250); } return s; };
  return { page, ctx, errors, notices, snap, until };
}
const bootHeld = () => { document.getElementById('e').boot({ steps: [{ id: 'aether', label: 'Aether' }, { id: 'score', label: 'sCoRE link' }] }); };

// ---- desktop 1280x800
{
  const { page, ctx, errors, notices, snap, until } = await open({ viewport: { width: 1280, height: 800 } }, '');
  let s = await until(x => x);
  check('dormant before boot()', !s.boot.started);
  await shot(page, '01-dormant.png');
  await page.evaluate(bootHeld);
  await page.evaluate(() => document.getElementById('e').completeStep('aether'));
  s = await until(x => x.boot.t > 3);
  await shot(page, '02-boot.png');
  s = await until(x => x.boot.holding);
  check('boot holds at ready while sCoRE step pending', s.boot.holding && Math.abs(s.boot.t - 7.4) < .01, `t=${s.boot.t.toFixed(2)}`);
  await page.mouse.click(640, 400);
  s = await snap();
  check('tap during hold does not skip past it', s.boot.holding && !s.boot.done);
  await shot(page, '03-hold.png');
  await page.evaluate(() => document.getElementById('e').completeStep('score'));
  s = await until(x => x.boot.done);
  check('boot completes after the step settles', s.boot.done && s.boot.steps.every(x => x.ok));
  await page.waitForTimeout(1500);
  await shot(page, '04-awake.png');
  for (const st of ['listening', 'speaking']) {
    await page.evaluate(v => document.getElementById('e').setState(v), st);
    s = await until(x => x.state === st, 5000); check(`state ${st}`, s.state === st);
    await page.waitForTimeout(1500); await shot(page, `05-state-${st}.png`);
  }
  await page.evaluate(() => document.getElementById('e').setState('idle'));
  for (const m of ['ponder', 'process', 'insight']) {
    await page.evaluate(v => document.getElementById('e').setMood(v, { hold: 6 }), m);
    s = await until(x => x.mood === m, 5000); check(`mood ${m}`, s.mood === m, s.mood);
    await page.waitForTimeout(m === 'insight' ? 500 : 1500); await shot(page, `06-mood-${m}.png`);
  }
  const ok = await page.evaluate(() => document.getElementById('e').setPortals('violet', 'pink'));
  s = await snap(); check('setPortals violet/pink', ok && s.portals.a === '#bf5fff' && s.portals.b === '#ff79c6');
  check('setPortals rejects identical poles', (await page.evaluate(() => document.getElementById('e').setPortals('cyan', 'cyan'))) === false);
  await page.waitForTimeout(1000); await shot(page, '07-portals.png');
  await page.evaluate(() => document.getElementById('e').setPortals('cyan', 'magenta'));
  await page.evaluate(() => document.getElementById('e').setDimension('3d'));
  s = await until(x => x.dimension === '3d', 60000);
  check('3D mode engaged', s.dimension === '3d', notices.join(' | '));
  check('3D uses fat lines (no thin-line fallback)', !notices.some(n => /thin-line|failed/.test(n)));
  await page.waitForTimeout(3000); await shot(page, '08-3d.png');
  await page.evaluate(() => document.getElementById('e').setDimension('2d'));
  check('dispose on disconnect removes the stage', await page.evaluate(() => { document.getElementById('e').remove(); return !document.querySelector('.rbl-alive'); }));
  check('no page errors (desktop)', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

// ---- iPhone 15 portrait (393x852 @3x) with Dynamic Island + home indicator insets; failed step path
{
  const dev = devices['iPhone 15'] || { viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
  const { page, ctx, errors, until } = await open({ ...dev }, '?autoboot=1&fail=1&delay=2', true);
  let s = await until(x => x.boot.t > 4.5);
  await shot(page, '09-iphone15-boot.png');
  const geo = await page.evaluate(() => { const r = document.querySelector('.rbl-bootui').getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; });
  check('iPhone 15: boot text clear of Dynamic Island and home indicator', geo.top > 59 && geo.bottom < 852 - 34, JSON.stringify(geo));
  s = await until(x => x.boot.done);
  check('failed step still completes boot (offline degrade)', s.boot.done && s.boot.steps.find(x => x.id === 'score').ok === false);
  await page.waitForTimeout(1500);
  await shot(page, '10-iphone15-awake.png');
  check('no page errors (iPhone 15)', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}
// ---- iPhone 15 landscape (island on the left)
{
  const { page, ctx, errors, until } = await open({ viewport: { width: 852, height: 393 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, '?autoboot=1&delay=1', false);
  await page.addStyleTag({ content: ':root{--rbl-safe-left:59px;--rbl-safe-right:59px;--rbl-safe-bottom:21px}' });
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  let s = await until(x => x.boot.t > 4.5);
  await shot(page, '11-iphone15-landscape-boot.png');
  const geo = await page.evaluate(() => { const r = document.querySelector('.rbl-bootui').getBoundingClientRect(); return { left: r.left, right: r.right }; });
  check('iPhone 15 landscape: boot text inside side safe areas', geo.left > 59 && geo.right < 852 - 59, JSON.stringify(geo));
  s = await until(x => x.boot.done);
  await page.waitForTimeout(1000); await shot(page, '12-iphone15-landscape-awake.png');
  check('no page errors (landscape)', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}
await browser.close();
console.log('\n' + results.join('\n'));
