/**
 * effects/starfield.js — nebula.effects.starfield
 *
 * Seeded Canvas2D deep-field starfield: depth-layered stars, cursor-reactive
 * parallax, slow drift, and subtle constellation lines toward the cursor.
 *
 * Ported from Chrysalis RaBbLE-liminal.js (deep-field canvas, drawSpace).
 * Colors resolved from Aether palette CSS vars at runtime.
 *
 * Usage:
 *   const sf = NeBuLA.effects.starfield(targetEl, { count: 180, drift: 1.0 });
 *   sf.start();
 *   sf.setParams({ count: 240 }); // rebuilds star array
 *   sf.stop();
 *
 * @param {HTMLElement} target  Element to append the canvas into.
 * @param {object}      opts
 * @param {number}      [opts.count=180]       Star count. Mobile auto-caps at 100.
 * @param {number}      [opts.drift=1.0]       Drift speed multiplier.
 * @param {number}      [opts.depthLayers=3]   Depth bucket count (affects parallax).
 * @param {object}      [opts.palette]         Override palette; keys: magenta/cyan/violet/text.
 * @returns {{ start(), stop(), setParams(opts) }}
 */

import { resolvePalette as _resolvePalette, hexSolid as _hexSolid, hexAlpha as _hexAlpha } from './_palette.js';

export function starfield(target, opts) {
  opts = opts || {};

  let params = {
    count:       opts.count       != null ? opts.count       : 180,
    drift:       opts.drift       != null ? opts.drift       : 1.0,
    depthLayers: opts.depthLayers != null ? opts.depthLayers : 3,
    palette:     opts.palette     || null,
  };

  let canvas = null, ctx = null;
  let w = 0, h = 0, dpr = 1;
  let stars = [];
  let pal   = {};
  let rafId = null;
  let running = false;
  let pointerX = 0.5, pointerY = 0.5, pointerSeen = false;
  let _onPointer = null, _onResize = null;

  function _buildCanvas() {
    canvas = document.createElement('canvas');
    // width/height:100% is load-bearing: a canvas is a replaced element, so
    // inset:0 alone does NOT stretch it — it displays at its intrinsic
    // (attribute) size, which is dpr-scaled. Without the explicit 100% the
    // whole drawing renders oversized whenever dpr > 1 and every drawn point
    // (constellation lines included) lands past the real cursor.
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    // Only force a positioning context when the host has none — never clobber
    // a stylesheet-positioned (fixed/absolute) host with inline 'relative'.
    if (getComputedStyle(target).position === 'static') target.style.position = 'relative';
    target.appendChild(canvas);
    ctx = canvas.getContext('2d');
  }

  function _resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    w = target.clientWidth  || window.innerWidth;
    h = target.clientHeight || window.innerHeight;
    canvas.width  = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function _seedStars() {
    pal = params.palette || _resolvePalette(target);
    // Cap star count on small screens to keep budget low
    const compact = (typeof window !== 'undefined' && window.innerWidth <= 700);
    const count   = compact ? Math.min(params.count, 100) : params.count;
    const tints   = [
      _hexSolid(pal.text),    _hexSolid(pal.text),    _hexSolid(pal.text),
      _hexSolid(pal.cyan),    _hexSolid(pal.magenta), _hexSolid(pal.violet),
    ];
    stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x:     Math.random(),
        y:     Math.random(),
        z:     0.15 + Math.random() * 0.85,  // depth: 0=far, 1=near
        tw:    Math.random() * Math.PI * 2,   // twinkle phase
        solid: tints[Math.floor(Math.random() * tints.length)],
        _sx:   0, _sy: 0,                    // last screen position (for constellation)
      });
    }
  }

  function _drawFrame(t) {
    ctx.clearRect(0, 0, w, h);

    const px = (pointerX - 0.5);
    const py = (pointerY - 0.5);
    const driftSpeed = 0.0000045 * params.drift;

    // Stars — depth parallax + gentle drift + twinkle
    for (let i = 0; i < stars.length; i++) {
      const s   = stars[i];
      const sx  = ((s.x + t * driftSpeed * s.z) % 1) * w - px * 36 * s.z;
      const sy  = s.y * h - py * 24 * s.z;
      const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(s.tw + t * 0.0011 * s.z));
      const size    = s.z * 1.7;
      ctx.globalAlpha = 0.18 + twinkle * 0.5 * s.z;
      ctx.fillStyle   = s.solid;
      ctx.fillRect(sx, sy, size, size);
      s._sx = sx;
      s._sy = sy;
    }
    ctx.globalAlpha = 1;

    // Constellation — lines reach toward cursor (130px radius)
    if (pointerSeen) {
      const cx = pointerX * w;
      const cy = pointerY * h;
      ctx.lineWidth = 0.6;
      for (let j = 0; j < stars.length; j++) {
        const st = stars[j];
        const dx = st._sx - cx, dy = st._sy - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 < 16900) {  // 130²
          const a = (1 - Math.sqrt(d2) / 130) * 0.22;
          ctx.strokeStyle = _hexAlpha(pal.cyan, a);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(st._sx, st._sy);
          ctx.stroke();
        }
      }
    }
  }

  function _frame() {
    if (!running) return;
    _drawFrame(performance.now());
    rafId = requestAnimationFrame(_frame);
  }

  function _init() {
    _buildCanvas();
    _resize();
    _seedStars();

    _onPointer = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      pointerX    = w > 0 ? (clientX - rect.left) / w : 0.5;
      pointerY    = h > 0 ? (clientY - rect.top)  / h : 0.5;
      pointerSeen = true;
    };
    window.addEventListener('mousemove', _onPointer, { passive: true });
    window.addEventListener('touchmove', _onPointer, { passive: true });

    _onResize = () => { _resize(); _seedStars(); };
    window.addEventListener('resize', _onResize);
  }

  return {
    start() {
      if (running) return;
      _init();
      running = true;
      rafId   = requestAnimationFrame(_frame);
    },

    stop() {
      running = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      canvas = null; ctx = null;
      if (_onPointer) {
        window.removeEventListener('mousemove', _onPointer);
        window.removeEventListener('touchmove', _onPointer);
        _onPointer = null;
      }
      if (_onResize) {
        window.removeEventListener('resize', _onResize);
        _onResize = null;
      }
    },

    setParams(newOpts) {
      Object.assign(params, newOpts);
      if (running && canvas) { _resize(); _seedStars(); }
    },
  };
}
