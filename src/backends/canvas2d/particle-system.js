const PARTICLE_COLORS = [
  '#1a4aaa', '#2255cc', '#3377ee', '#4499ff', '#55aaff',
  '#00bbdd', '#00eeff', '#33ddf0', '#55ccee',
  '#5533aa', '#7744cc', '#9944dd', '#aa44cc', '#bb55dd',
  '#ffffff', '#ddeeff', '#ccddff', '#aabbee',
  '#0a1a55', '#0d2277', '#112299',
];

const NEBULA_RADIUS = 130, FALLOFF_RADIUS = 155;
const GLOW_FRACTION = 0.12;

export class ParticleSystem {
  constructor({ cx, cy, canvas, dpr, particleCount, glowCanvas }) {
    this._cx            = cx;
    this._cy            = cy;
    this._canvas        = canvas;
    this._dpr           = dpr;
    this._particleCount = particleCount;
    this._particles     = [];
    this._initParticles();

    // Glow buffer — externally managed (DOM canvas with CSS blur) or owned offscreen.
    this._glowExternal = !!glowCanvas;
    this._glowCanvas   = glowCanvas || (() => {
      const c = document.createElement('canvas');
      c.width  = canvas.width;
      c.height = canvas.height;
      return c;
    })();
    this._glowCtx   = this._glowCanvas.getContext('2d');
    this._glowFrame = 0;

    this._physicsFrame = 0;
  }

  get particles() { return this._particles; }

  _makeParticle(atTarget = false) {
    const a  = Math.random() * Math.PI * 2;
    const r  = Math.pow(Math.random(), 0.52) * NEBULA_RADIUS;
    const tx = this._cx + r * Math.cos(a);
    const ty = this._cy + r * Math.sin(a) * 0.80;
    const sz = Math.random() * 11 + 0.8;
    return {
      x:     atTarget ? tx : this._cx + (Math.random() - 0.5) * (this._canvas.width  / this._dpr) * 2.4,
      y:     atTarget ? ty : this._cy + (Math.random() - 0.5) * (this._canvas.height / this._dpr) * 2.2,
      rx: 0, ry: 0,
      tx, ty, r: sz,
      alpha: Math.random() * 0.65 + 0.18,
      color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.011 + 0.004,
      cs:    Math.random() * 0.032 + 0.012,
      glow:  Math.random() < GLOW_FRACTION,
    };
  }

  _initParticles() {
    this._particles = [];
    for (let i = 0; i < this._particleCount; i++) {
      this._particles.push(this._makeParticle(true));
    }
  }

  scatter() {
    for (const p of this._particles) {
      p.x  = this._cx + (Math.random() - 0.5) * (this._canvas.width  / this._dpr) * 2.4;
      p.y  = this._cy + (Math.random() - 0.5) * (this._canvas.height / this._dpr) * 2.2;
      p.rx = p.x; p.ry = p.y;
    }
    // Color buckets are unaffected (colors don't change on scatter)
  }

  resize(cx, cy) {
    const dx = cx - this._cx, dy = cy - this._cy;
    this._cx = cx; this._cy = cy;
    for (const p of this._particles) { p.x += dx; p.y += dy; p.tx += dx; p.ty += dy; }
    while (this._particles.length < this._particleCount) this._particles.push(this._makeParticle(true));
    if (this._particles.length > this._particleCount) this._particles.length = this._particleCount;

    if (!this._glowExternal) {
      this._glowCanvas.width  = this._canvas.width;
      this._glowCanvas.height = this._canvas.height;
    }
    this._glowFrame = 0;
  }

  update(t, state) {
    const { inBoot, convProg, settleBlend, entropy } = state;

    if (!inBoot) {
      this._physicsFrame ^= 1;
      if (this._physicsFrame) return;
    }

    const eMul = 1 + entropy * 2.5;

    for (const p of this._particles) {
      if (inBoot && convProg < 1) {
        p.x += (p.tx - p.x) * p.cs;
        p.y += (p.ty - p.y) * p.cs;
      } else {
        const sd = 0.28 + settleBlend * 0.55;
        p.x += (p.tx - p.x) * (p.cs * (1 - settleBlend) * 0.3) + Math.sin(p.phase * 0.7 + t * 0.003) * sd * 0.5;
        p.y += (p.ty - p.y) * (p.cs * (1 - settleBlend) * 0.3) + Math.cos(p.phase * 0.9 + t * 0.002) * sd * 0.35;
      }
      p.phase += p.speed * (0.7 + settleBlend * 0.5) * eMul;

      const driftAmt = (0.6 + settleBlend * 2.4) * eMul;
      p.rx = p.x + Math.sin(p.phase + t * 0.008 * eMul) * driftAmt;
      p.ry = p.y + Math.cos(p.phase * 0.72 + t * 0.006 * eMul) * driftAmt * 0.8;
    }
  }

  // _visibility() — glow pass only. Flat pass inlines this to avoid call overhead.
  _visibility(p, state) {
    const { inBoot, convProg, settleBlend } = state;
    const dx = p.rx - this._cx, dy = p.ry - this._cy;
    const d2 = dx * dx + dy * dy;
    const falloff = Math.max(0, 1 - d2 / (FALLOFF_RADIUS * FALLOFF_RADIUS));
    const pulse   = 0.62 + 0.38 * Math.sin(p.phase * 2);
    const vis     = inBoot ? Math.min(1, convProg * 3) : 1;
    return { alpha: p.alpha * falloff * pulse * vis, settleBlend };
  }

  // draw() — flat pass inlined for speed; glow pass unchanged (small N, infrequent).
  draw(ctx, t, state, allowGlow = true) {
    const { effectiveGlow, adaptiveGlow, entropy } = state;
    const glowOn = allowGlow && effectiveGlow > 0.05;

    // Pass 1 — flat particles, per-particle draw with inlined visibility math.
    // Squared falloff (no sqrt), early-exit for out-of-range particles.
    {
      const cx = this._cx, cy = this._cy;
      const FR2 = FALLOFF_RADIUS * FALLOFF_RADIUS;
      const { inBoot, convProg } = state;
      const vis = inBoot ? Math.min(1, convProg * 3) : 1;
      const pts = this._particles;
      for (let i = 0, n = pts.length; i < n; i++) {
        const p = pts[i];
        if (glowOn && p.glow) continue;
        const dx = p.rx - cx, dy = p.ry - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 >= FR2) continue;                               // outside falloff — skip draw entirely
        const falloff = 1 - d2 / FR2;
        const alpha   = p.alpha * falloff * (0.62 + 0.38 * Math.sin(p.phase * 2)) * vis;
        ctx.beginPath();
        ctx.arc(p.rx, p.ry, p.r, 0, Math.PI * 2);
        ctx.fillStyle    = p.color;
        ctx.globalAlpha  = alpha;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Pass 2 — glow bloom layer, drawn into offscreen buffer every N frames.
    // Still per-particle (only ~18 particles, redraws every 2-4 frames — cheap).
    if (glowOn) {
      const glowInterval = adaptiveGlow < 0.6 ? 4 : (adaptiveGlow < 0.9 ? 3 : 2);
      if (this._glowFrame <= 0) {
        this._glowFrame = glowInterval;
        const gctx = this._glowCtx;
        gctx.setTransform(1, 0, 0, 1, 0, 0);
        gctx.clearRect(0, 0, this._glowCanvas.width, this._glowCanvas.height);
        gctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
        for (const p of this._particles) {
          if (!p.glow) continue;
          const { alpha, settleBlend } = this._visibility(p, state);
          const eGlow  = 1 + state.entropy * 1.5;
          const rScale = 1 + (0.4 + settleBlend * 0.6) * state.effectiveGlow * eGlow;
          gctx.beginPath();
          gctx.arc(p.rx, p.ry, p.r * rScale, 0, Math.PI * 2);
          gctx.fillStyle = p.color;
          gctx.globalAlpha = Math.min(1, alpha * 1.6);
          gctx.fill();
          gctx.globalAlpha = 1;
        }
      }
      this._glowFrame--;

      if (!this._glowExternal) {
        const blurPx = Math.round((6 + entropy * 5) * effectiveGlow);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.filter = `blur(${blurPx}px)`;
        ctx.drawImage(this._glowCanvas, 0, 0);
        ctx.filter = 'none';
        ctx.restore();
      }
    }
  }

  dispose() {}
}
