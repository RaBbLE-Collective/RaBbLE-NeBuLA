const COLS = [
  '#1a3aaa', '#2255cc', '#2266dd', '#3388ff', '#4499ff', '#55aaee',
  '#00aabb', '#00ccee', '#00eeff', '#33ddf0',
  '#4422aa', '#6633bb', '#7744cc', '#9944dd', '#aa55ee',
  '#ffffff', '#ddeeff', '#ccddff', '#aabbee',
  '#0a1a55', '#0d2277', '#112299',
];

const GLOW_EVERY    = 3;
const GLOW_FRACTION = 0.12;

// AmbientField — drop-in replacement for RaBbLE-bg.js.
// Draws the outrun perspective grid + ambient particle nebula on fixed canvases.
// Budget contract: background-only, never competes with the entity layer.
//   - Grid baked offscreen on init/resize — zero gradient cost per frame
//   - Half-rate render (30fps): holds last canvas on skip frames; GPU re-composites texture
//   - Glow via CSS element filter:blur on DOM canvas — compositor thread, zero JS/Skia cost
//   - No connections — O(N²) at 0.07 opacity is pure overhead for a background
//
// Usage: const bg = new NeBuLA.AmbientField({ particles: true, grid: true });
//        bg.destroy();  // cleanup
export class AmbientField {
  constructor(opts = {}) {
    this._opts = {
      particles: opts.particles !== false,
      grid:      opts.grid      !== false,
      n:         opts.n         ?? 100,
    };

    this._rafId        = null;
    this._physicsFrame = 0;
    this._glowFrame    = 0;
    this._skipFrame    = 0;  // half-rate: alternates 0/1, skip odd frames entirely

    // Main canvas — fixed, covers the full viewport, lowest z-index.
    this._cv  = document.createElement('canvas');
    this._cv.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:0;';
    document.body.insertBefore(this._cv, document.body.firstChild);
    this._ctx = this._cv.getContext('2d');

    // Glow canvas — DOM element with CSS filter:blur(8px) so the browser
    // compositor handles the blur on its own thread, never touching JS/Skia.
    // Inserted before _cv so it sits visually behind the flat-particle layer.
    this._glowCv = document.createElement('canvas');
    this._glowCv.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:0;filter:blur(8px);';
    document.body.insertBefore(this._glowCv, this._cv);
    this._glowCtx = this._glowCv.getContext('2d');

    // Grid baked to its own offscreen canvas — redrawn only on resize,
    // composited with drawImage every frame (zero createLinearGradient overhead).
    this._gridCv  = document.createElement('canvas');
    this._gridCtx = this._gridCv.getContext('2d');

    this._pts = [];
    this._resize();
    this._initParticles();

    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
    this._rafId = requestAnimationFrame(() => this._frame());
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this._cv.width       = w; this._cv.height       = h;
    this._glowCv.width   = w; this._glowCv.height   = h;
    this._gridCv.width   = w; this._gridCv.height   = h;
    this._glowFrame = 0;
    if (this._opts.grid) this._bakeGrid(w, h);
    for (const p of this._pts) {
      if (p.x > w + 8) p.x = Math.random() * w;
      if (p.y > h + 8) p.y = Math.random() * h;
    }
  }

  _bakeGrid(W, H) {
    const ctx = this._gridCtx;
    const vx = W / 2, vy = H * 0.74;
    ctx.clearRect(0, 0, W, H);
    // Vertical lines — 18 fan lines to vanishing point
    for (let i = 0; i <= 18; i++) {
      const tx = i / 18, x = vx + (tx - 0.5) * W * 3.2;
      ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(vx, vy);
      const g = ctx.createLinearGradient(x, H, vx, vy);
      g.addColorStop(0, 'rgba(191,95,255,0.10)');
      g.addColorStop(1, 'transparent');
      ctx.strokeStyle = g; ctx.lineWidth = 0.8; ctx.stroke();
    }
    // Horizontal lines — 11 power-curved lines along the floor plane
    for (let j = 0; j <= 11; j++) {
      const ty = Math.pow(j / 11, 1.65), y = vy + (H - vy) * ty, sp = ty * W * 1.6;
      ctx.beginPath(); ctx.moveTo(vx - sp, y); ctx.lineTo(vx + sp, y);
      const g2 = ctx.createLinearGradient(vx - sp, y, vx + sp, y);
      g2.addColorStop(0, 'transparent');
      g2.addColorStop(0.25, 'rgba(255,45,120,0.12)');
      g2.addColorStop(0.75, 'rgba(255,45,120,0.12)');
      g2.addColorStop(1, 'transparent');
      ctx.strokeStyle = g2; ctx.lineWidth = 0.6; ctx.stroke();
    }
  }

  _initParticles() {
    const w = window.innerWidth, h = window.innerHeight;
    this._pts = [];
    for (let i = 0; i < this._opts.n; i++) {
      this._pts.push({
        x:     Math.random() * w,
        y:     Math.random() * h,
        vx:    (Math.random() - 0.5) * 0.11,
        vy:    (Math.random() - 0.5) * 0.08,
        r:     Math.random() * 2.2 + 0.3,
        col:   COLS[Math.floor(Math.random() * COLS.length)],
        alpha: Math.random() * 0.45 + 0.08,
        phase: Math.random() * Math.PI * 2,
        glow:  Math.random() < GLOW_FRACTION,
      });
    }
  }

  _frame() {
    this._rafId = requestAnimationFrame(() => this._frame());

    // Half-rate: skip every other frame entirely.
    // Ambient drift at 0.11px/frame is imperceptible at 30fps vs 60fps.
    // Holding the last painted canvas costs nothing — GPU just re-composites
    // the existing texture. This halves all JS + paint cost for the background.
    this._skipFrame ^= 1;
    if (this._skipFrame) return;

    const W = this._cv.width, H = this._cv.height;
    const ctx = this._ctx;
    ctx.clearRect(0, 0, W, H);

    // Grid — static baked layer, one drawImage per draw-frame
    if (this._opts.grid) ctx.drawImage(this._gridCv, 0, 0);

    if (this._opts.particles) {
      const pts = this._pts;

      // Physics — every draw-frame (already running at half the RAF rate)
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        p.x += p.vx; p.y += p.vy;
        p.phase += 0.022;  // doubled to compensate for half-rate so drift speed is unchanged
        if (p.x < -8) p.x = W + 8; else if (p.x > W + 8) p.x = -8;
        if (p.y < -8) p.y = H + 8; else if (p.y > H + 8) p.y = -8;
      }

      // Pass 1 — flat particles
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (p.glow) continue;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.col;
        ctx.globalAlpha = p.alpha * (0.6 + 0.4 * Math.sin(p.phase));
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Pass 2 — glow buffer; redraws every GLOW_EVERY draw-frames
      this._glowFrame--;
      if (this._glowFrame <= 0) {
        this._glowFrame = GLOW_EVERY;
        const gctx = this._glowCtx;
        gctx.clearRect(0, 0, W, H);
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          if (!p.glow) continue;
          gctx.beginPath(); gctx.arc(p.x, p.y, p.r * 1.5, 0, Math.PI * 2);
          gctx.fillStyle = p.col;
          gctx.globalAlpha = Math.min(1, p.alpha * (0.6 + 0.4 * Math.sin(p.phase)) * 1.8);
          gctx.fill();
        }
        gctx.globalAlpha = 1;
      }
      // Glow canvas composites via CSS filter:blur on its DOM element — no drawImage needed.

      // Connections removed — O(N²) per frame at negligible opacity is pure overhead.
    }
  }

  destroy() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    window.removeEventListener('resize', this._onResize);
    this._glowCv.remove();
    this._cv.remove();
  }
}
