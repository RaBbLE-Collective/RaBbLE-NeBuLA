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
    this._colorBuckets  = new Map();  // color → particle[] — built once, never rebuilt
    this._initParticles();

    // Glow buffer — externally managed (DOM canvas with CSS blur) or owned offscreen.
    this._glowExternal = !!glowCanvas;
    this._glowCanvas   = glowCanvas || (() => {
      const c = document.createElement('canvas');
      c.width  = canvas.width;
      c.height = canvas.height;
      return c;
    })();
    this._glowCtx    = this._glowCanvas.getContext('2d');
    this._glowFrame  = 0;

    // Offscreen particle compositing canvas — flat particles batch here, then
    // a single destination-in radial gradient clips the falloff, then one
    // drawImage composites onto the field canvas. Reduces fill() calls from
    // N_particles to N_colors (21 max) and eliminates per-particle sqrt.
    this._particleCanvas = document.createElement('canvas');
    this._particleCanvas.width  = canvas.width;
    this._particleCanvas.height = canvas.height;
    this._particleCtx    = this._particleCanvas.getContext('2d');
    this._falloffGrad    = null;
    this._rebuildFalloffGrad();

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
    this._buildColorBuckets();
  }

  // Build color bucket map once — particle colors are fixed at creation.
  // Each bucket holds all particles of that color; the glow check in the draw
  // pass skips glow particles inline (only ~12% of the set, negligible cost).
  _buildColorBuckets() {
    this._colorBuckets.clear();
    for (const p of this._particles) {
      if (!this._colorBuckets.has(p.color)) this._colorBuckets.set(p.color, []);
      this._colorBuckets.get(p.color).push(p);
    }
  }

  // Cache the radial falloff gradient on the particle context.
  // Only needs rebuilding when cx/cy change (resize).
  _rebuildFalloffGrad() {
    const g = this._particleCtx.createRadialGradient(
      this._cx, this._cy, 0,
      this._cx, this._cy, FALLOFF_RADIUS
    );
    g.addColorStop(0,    'rgba(0,0,0,1)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.75)');
    g.addColorStop(1,    'rgba(0,0,0,0)');
    this._falloffGrad = g;
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
    this._particleCanvas.width  = this._canvas.width;
    this._particleCanvas.height = this._canvas.height;
    this._rebuildFalloffGrad();
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

  // _visibility() — kept for glow pass only (~18 particles, every 2-4 frames).
  // The flat pass no longer calls this; falloff is handled by the gradient overlay.
  _visibility(p, state) {
    const { inBoot, convProg, settleBlend } = state;
    const dx = p.rx - this._cx, dy = p.ry - this._cy;
    const d  = Math.sqrt(dx * dx + dy * dy);
    const falloff = Math.max(0, 1 - d / FALLOFF_RADIUS);
    const pulse   = 0.62 + 0.38 * Math.sin(p.phase * 2);
    const vis     = inBoot ? Math.min(1, convProg * 3) : 1;
    return { alpha: p.alpha * falloff * pulse * vis, settleBlend };
  }

  // Flat draw pass — batched by color, one fill() per color group (21 max).
  // Falloff is applied via a destination-in radial gradient on the offscreen
  // particle canvas, then composited onto the field canvas in one drawImage.
  // Eliminates: N_flat individual fill() GPU dispatches, N_flat sqrt() calls.
  _drawFlatBatched(ctx, state, glowOn) {
    const { inBoot, convProg } = state;
    const vis = inBoot ? Math.min(1, convProg * 3) : 1;
    if (vis <= 0) return;

    const pCtx = this._particleCtx;
    const W    = this._particleCanvas.width;
    const H    = this._particleCanvas.height;

    // Clear the offscreen compositing canvas
    pCtx.setTransform(1, 0, 0, 1, 0, 0);
    pCtx.clearRect(0, 0, W, H);
    pCtx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);

    // Batch by color — one beginPath + N arcs + fill() per color group.
    // All particles draw at globalAlpha=0.85; per-particle alpha variation
    // is replaced by the spatial gradient in the next pass.
    pCtx.globalAlpha = 0.85;
    for (const [color, pts] of this._colorBuckets) {
      pCtx.fillStyle = color;
      pCtx.beginPath();
      let drew = false;
      for (const p of pts) {
        if (glowOn && p.glow) continue;
        pCtx.moveTo(p.rx + p.r, p.ry);
        pCtx.arc(p.rx, p.ry, p.r, 0, Math.PI * 2);
        drew = true;
      }
      if (drew) pCtx.fill();
    }
    pCtx.globalAlpha = 1;

    // Apply radial falloff — destination-in clips the particle layer to the
    // gradient shape: fully opaque at entity center, transparent at FALLOFF_RADIUS.
    // This replaces the per-particle sqrt falloff with a single gradient pass.
    pCtx.globalCompositeOperation = 'destination-in';
    pCtx.fillStyle = this._falloffGrad;
    pCtx.fillRect(0, 0, W / this._dpr, H / this._dpr);
    pCtx.globalCompositeOperation = 'source-over';

    // Composite onto field canvas — one drawImage instead of N fill() calls.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = vis;
    ctx.drawImage(this._particleCanvas, 0, 0);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // draw() — flat pass is now batched; glow pass unchanged (small N, infrequent).
  draw(ctx, t, state, allowGlow = true) {
    const { effectiveGlow, adaptiveGlow, entropy } = state;
    const glowOn = allowGlow && effectiveGlow > 0.05;

    // Pass 1 — flat particles, batched by color with gradient falloff overlay.
    this._drawFlatBatched(ctx, state, glowOn);

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
