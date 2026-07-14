/**
 * effects/deepfield.js — streaks / constellation / haze
 *
 * Real Canvas2D ports of the Chrysalis liminal deep-field effects.
 * Source: RaBbLE-Chrysalis/Chrysalis-Web/ep1/world/js/RaBbLE-liminal.js
 *   - streaks:       drawSpace signal-streak block (:367–387)
 *   - constellation: drawSpace constellation-reach block (:348–365)
 *   - haze:          drawHaze + 1/8-res offscreen canvas (:306–322, :279–284)
 *
 * Frozen API: NeBuLA.effects.<name>(target, opts) -> { start(), stop(), setParams(opts) }
 * Palette resolved from Aether CSS vars at runtime (no raw hex in logic).
 */

import { resolvePalette, hexSolid, hexAlpha } from './_palette.js';

/* ─────────────────────────────────────────────────────────────────────────
   helpers shared by the three effects
   ───────────────────────────────────────────────────────────────────────── */

function _mkCanvas(target, extraCss) {
  const c = document.createElement('canvas');
  // width/height:100% is load-bearing: a canvas is a replaced element, so
  // inset:0 alone does NOT stretch it — it displays at its intrinsic
  // (attribute) size, which is dpr-scaled. Without the explicit 100% the
  // drawing renders oversized whenever dpr > 1 and pointer-anchored drawing
  // (constellation) lands past the real cursor.
  c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;' + (extraCss || '');
  // Only force a positioning context when the host has none — never clobber
  // a stylesheet-positioned (fixed/absolute) host with inline 'relative'.
  if (getComputedStyle(target).position === 'static') target.style.position = 'relative';
  target.appendChild(c);
  return c;
}

function _size(target) {
  return {
    w: target.clientWidth  || window.innerWidth,
    h: target.clientHeight || window.innerHeight,
  };
}

/* ═════════════════════════════════════════════════════════════════════════
   streaks — rare passing signal transmissions (velocity + decay segments)
   ═════════════════════════════════════════════════════════════════════════ */

export function streaks(target, opts) {
  opts = opts || {};
  let params = {
    spawnProb: opts.spawnProb != null ? opts.spawnProb : 0.0022,
    decay:     opts.decay     != null ? opts.decay     : 0.016,
    palette:   opts.palette   || null,
    glitch:    !!opts.glitch,
  };

  let canvas = null, ctx = null, w = 0, h = 0, dpr = 1;
  let list = [], pal = {}, rafId = null, running = false, _onResize = null;

  function _resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    const s = _size(target); w = s.w; h = s.h;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function _frame() {
    if (!running) return;
    ctx.clearRect(0, 0, w, h);
    const glitching = params.glitch;
    const spawn = glitching ? Math.max(params.spawnProb, 0.02) : params.spawnProb;
    if (Math.random() < spawn) {
      const fromTop = Math.random() < 0.5;
      list.push({
        x: Math.random() * w, y: fromTop ? -10 : Math.random() * h * 0.4,
        vx: 3 + Math.random() * 5, vy: 1.5 + Math.random() * 2.5,
        life: 1,
        tint: Math.random() < 0.5 ? pal.cyan : pal.magenta,
      });
    }
    for (let k = list.length - 1; k >= 0; k--) {
      const sk = list[k];
      sk.x += sk.vx; sk.y += sk.vy; sk.life -= params.decay;
      if (sk.life <= 0 || sk.x > w + 40 || sk.y > h + 40) { list.splice(k, 1); continue; }
      ctx.strokeStyle = hexAlpha(sk.tint, sk.life * 0.7);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(sk.x, sk.y);
      ctx.lineTo(sk.x - sk.vx * 6, sk.y - sk.vy * 6);
      ctx.stroke();
    }
    rafId = requestAnimationFrame(_frame);
  }

  return {
    start() {
      if (running) return;
      canvas = _mkCanvas(target); ctx = canvas.getContext('2d');
      pal = params.palette || resolvePalette(target);
      _resize();
      _onResize = () => _resize();
      window.addEventListener('resize', _onResize);
      running = true; rafId = requestAnimationFrame(_frame);
    },
    stop() {
      running = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      canvas = null; ctx = null; list = [];
      if (_onResize) { window.removeEventListener('resize', _onResize); _onResize = null; }
    },
    setParams(o) {
      Object.assign(params, o);
      if (running && (o.palette)) pal = params.palette || resolvePalette(target);
    },
  };
}

/* ═════════════════════════════════════════════════════════════════════════
   constellation — lines reaching from cursor to nearby seeded points
   (self-contained: seeds its own point set; or accepts a shared one)
   ═════════════════════════════════════════════════════════════════════════ */

export function constellation(target, opts) {
  opts = opts || {};
  let params = {
    maxDist:    opts.maxDist    != null ? opts.maxDist    : 130,
    alphaScale: opts.alphaScale != null ? opts.alphaScale : 0.28,
    count:      opts.count      != null ? opts.count      : 180,
    palette:    opts.palette    || null,
    points:     opts.points     || null,   // optional shared [{x,y}] in 0..1 space
    glitch:     !!opts.glitch,
  };

  let canvas = null, ctx = null, w = 0, h = 0, dpr = 1;
  let pts = [], pal = {}, rafId = null, running = false;
  let pointerX = 0, pointerY = 0, pointerSeen = false;
  let _onResize = null, _onPointer = null;

  function _resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    const s = _size(target); w = s.w; h = s.h;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function _seed() {
    if (params.points && params.points.length) { pts = params.points; return; }
    const compact = (typeof window !== 'undefined' && window.innerWidth <= 700);
    const count = compact ? Math.min(params.count, 100) : params.count;
    pts = [];
    for (let i = 0; i < count; i++) pts.push({ x: Math.random(), y: Math.random() });
  }

  function _frame() {
    if (!running) return;
    ctx.clearRect(0, 0, w, h);
    if (pointerSeen) {
      const cx = pointerX, cy = pointerY;
      const max = params.maxDist, max2 = max * max;
      const tint = params.glitch ? pal.magenta : pal.cyan;
      ctx.lineWidth = 0.6;
      for (let j = 0; j < pts.length; j++) {
        const sx = pts[j].x * w, sy = pts[j].y * h;
        const dx = sx - cx, dy = sy - cy, d2 = dx * dx + dy * dy;
        if (d2 < max2) {
          const a = (1 - Math.sqrt(d2) / max) * params.alphaScale;
          ctx.strokeStyle = hexAlpha(tint, a);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(sx, sy);
          ctx.stroke();
        }
      }
    }
    rafId = requestAnimationFrame(_frame);
  }

  return {
    start() {
      if (running) return;
      canvas = _mkCanvas(target); ctx = canvas.getContext('2d');
      pal = params.palette || resolvePalette(target);
      _resize(); _seed();
      _onPointer = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        pointerX = clientX - rect.left; pointerY = clientY - rect.top;
        pointerSeen = true;
      };
      window.addEventListener('mousemove', _onPointer, { passive: true });
      window.addEventListener('touchmove', _onPointer, { passive: true });
      _onResize = () => _resize();
      window.addEventListener('resize', _onResize);
      running = true; rafId = requestAnimationFrame(_frame);
    },
    stop() {
      running = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      canvas = null; ctx = null; pointerSeen = false;
      if (_onPointer) {
        window.removeEventListener('mousemove', _onPointer);
        window.removeEventListener('touchmove', _onPointer);
        _onPointer = null;
      }
      if (_onResize) { window.removeEventListener('resize', _onResize); _onResize = null; }
    },
    setParams(o) {
      Object.assign(params, o);
      if (running) {
        if (o.palette) pal = params.palette || resolvePalette(target);
        if (o.count != null || o.points) _seed();
      }
    },
  };
}

/* ═════════════════════════════════════════════════════════════════════════
   haze — slow-drifting radial nebula blobs on a 1/8-res offscreen canvas,
   CSS-upscaled (free blur). Repaints every Nth frame to stay cheap.
   ═════════════════════════════════════════════════════════════════════════ */

export function haze(target, opts) {
  opts = opts || {};
  let params = {
    blobs:       opts.blobs       != null ? opts.blobs       : 3,
    resScale:    opts.resScale    != null ? opts.resScale    : 0.125,
    repaintEvery:opts.repaintEvery!= null ? opts.repaintEvery: 4,
    palette:     opts.palette     || null,
    glitch:      !!opts.glitch,
  };

  let view = null, vctx = null;     // visible upscaled canvas
  let haze = null, hctx = null;     // low-res offscreen
  let w = 0, h = 0, blobs = [], pal = {};
  let rafId = null, running = false, frame = 0, _onResize = null;

  function _resize() {
    const s = _size(target); w = s.w; h = s.h;
    view.width = w; view.height = h;
    haze.width  = Math.max(2, Math.round(w * params.resScale));
    haze.height = Math.max(2, Math.round(h * params.resScale));
  }

  function _seedBlobs() {
    pal = params.palette || resolvePalette(target);
    const proto = [
      { x: 0.22, y: 0.30, r: 0.55, tint: pal.violet,  a: 0.045, dx: 0.004,  dy: 0.002 },
      { x: 0.80, y: 0.68, r: 0.60, tint: pal.magenta, a: 0.035, dx: -0.003, dy: 0.003 },
      { x: 0.55, y: 0.12, r: 0.45, tint: pal.cyan,    a: 0.030, dx: 0.002,  dy: -0.002 },
    ];
    blobs = [];
    const tints = [pal.violet, pal.magenta, pal.cyan, pal.pink];
    for (let i = 0; i < params.blobs; i++) {
      blobs.push(proto[i] || {
        x: Math.random(), y: Math.random(), r: 0.4 + Math.random() * 0.25,
        tint: tints[i % tints.length], a: 0.03 + Math.random() * 0.02,
        dx: (Math.random() - 0.5) * 0.008, dy: (Math.random() - 0.5) * 0.008,
      });
    }
  }

  function _drawHaze(t) {
    const cw = haze.width, ch = haze.height;
    const glitching = params.glitch;
    hctx.clearRect(0, 0, cw, ch);
    for (let b = 0; b < blobs.length; b++) {
      const blob = blobs[b];
      const bx = (blob.x + Math.sin(t * 0.00003 + b * 2.1) * 0.04 * blob.dx * 250) * cw;
      const by = (blob.y + Math.cos(t * 0.000024 + b * 1.7) * 0.04 * blob.dy * 250) * ch;
      const br = blob.r * Math.max(cw, ch);
      const grad = hctx.createRadialGradient(bx, by, 0, bx, by, br);
      grad.addColorStop(0, hexAlpha(blob.tint, glitching ? blob.a * 2.2 : blob.a));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      hctx.fillStyle = grad;
      hctx.fillRect(0, 0, cw, ch);
    }
  }

  function _frame() {
    if (!running) return;
    if (frame % params.repaintEvery === 0) {
      _drawHaze(performance.now());
      vctx.clearRect(0, 0, w, h);
      vctx.imageSmoothingEnabled = true;
      vctx.drawImage(haze, 0, 0, w, h);  // upscale = free GPU blur
    }
    frame++;
    rafId = requestAnimationFrame(_frame);
  }

  return {
    start() {
      if (running) return;
      view = _mkCanvas(target); vctx = view.getContext('2d');
      haze = document.createElement('canvas'); hctx = haze.getContext('2d');
      _resize(); _seedBlobs();
      _onResize = () => { _resize(); };
      window.addEventListener('resize', _onResize);
      running = true; frame = 0; rafId = requestAnimationFrame(_frame);
    },
    stop() {
      running = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      if (view && view.parentNode) view.parentNode.removeChild(view);
      view = null; vctx = null; haze = null; hctx = null; blobs = [];
      if (_onResize) { window.removeEventListener('resize', _onResize); _onResize = null; }
    },
    setParams(o) {
      Object.assign(params, o);
      if (running) {
        if (o.resScale != null) _resize();
        if (o.palette || o.blobs != null) _seedBlobs();
      }
    },
  };
}
