const PARTICLE_COLORS = [
  '#1a4aaa', '#2255cc', '#3377ee', '#4499ff', '#55aaff',
  '#00bbdd', '#00eeff', '#33ddf0', '#55ccee',
  '#5533aa', '#7744cc', '#9944dd', '#aa44cc', '#bb55dd',
  '#ffffff', '#ddeeff', '#ccddff', '#aabbee',
  '#0a1a55', '#0d2277', '#112299',
];

const NEBULA_RADIUS = 130, FALLOFF_RADIUS = 155;
// Fraction of particles that contribute to the bloom layer.
// Lower = faster glow-buffer redraw (fewer flat draws into offscreen canvas).
const GLOW_FRACTION = 0.12;

export class ParticleSystem {
  constructor({ cx, cy, canvas, dpr, particleCount }) {
    this._cx            = cx;
    this._cy            = cy;
    this._canvas        = canvas;
    this._dpr           = dpr;
    this._particleCount = particleCount;
    this._particles     = [];
    this._initParticles();

    // Offscreen glow buffer — Phase 4 compositing.
    // Glow particles (shadowBlur) redraw into this buffer every N frames;
    // the buffer is then composited onto the main context every frame via
    // drawImage(). Persistence between redraws is what produces the smooth
    // bloom — and it means the expensive shadowBlur pass runs at a fraction
    // of the field layer's frame rate instead of every frame.
    this._glowCanvas = document.createElement('canvas');
    this._glowCanvas.width  = canvas.width;
    this._glowCanvas.height = canvas.height;
    this._glowCtx    = this._glowCanvas.getContext('2d');
    this._glowFrame     = 0;
    this._physicsFrame  = 0;  // throttle: skip every-other physics tick post-boot
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

  // Scatter particles across viewport for boot animation start
  scatter() {
    for (const p of this._particles) {
      p.x  = this._cx + (Math.random() - 0.5) * (this._canvas.width  / this._dpr) * 2.4;
      p.y  = this._cy + (Math.random() - 0.5) * (this._canvas.height / this._dpr) * 2.2;
      p.rx = p.x; p.ry = p.y;
    }
  }

  resize(cx, cy) {
    const dx = cx - this._cx, dy = cy - this._cy;
    this._cx = cx; this._cy = cy;
    for (const p of this._particles) { p.x += dx; p.y += dy; p.tx += dx; p.ty += dy; }
    while (this._particles.length < this._particleCount) this._particles.push(this._makeParticle(true));
    if (this._particles.length > this._particleCount) this._particles.length = this._particleCount;

    this._glowCanvas.width  = this._canvas.width;
    this._glowCanvas.height = this._canvas.height;
    this._glowFrame = 0;
  }

  // update() — position integration.
  // During boot: runs every frame (convergence must be smooth).
  // Post-boot: runs every other frame — drift amplitude is ~2px/frame at
  // 60fps, so halving frequency is imperceptible at the motion speeds used
  // but cuts 260 sin/cos calls per skipped frame.
  update(t, state) {
    const { inBoot, convProg, settleBlend, entropy } = state;

    // Always run during boot; throttle to every-other-frame post-boot.
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

  // Shared per-particle visibility math — used by both the flat and glow passes.
  _visibility(p, t, state) {
    const { inBoot, convProg, settleBlend } = state;
    const dx = p.rx - this._cx, dy = p.ry - this._cy;
    const d  = Math.sqrt(dx * dx + dy * dy);
    const falloff = Math.max(0, 1 - d / FALLOFF_RADIUS);
    const pulse   = 0.62 + 0.38 * Math.sin(p.phase * 2 + t * 0.015);
    const vis     = inBoot ? Math.min(1, convProg * 3) : 1;
    return { alpha: p.alpha * falloff * pulse * vis, settleBlend };
  }

  _drawFlat(ctx, p, t, state) {
    const { alpha } = this._visibility(p, t, state);
    ctx.beginPath(); ctx.arc(p.rx, p.ry, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.color; ctx.globalAlpha = alpha; ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Draws a glow particle flat — no shadowBlur. The bloom comes from a single
  // ctx.filter='blur()' applied at composite time in draw(), not per-particle.
  // Particles are drawn larger/more opaque so the blur spreads a visible halo.
  _drawGlowFlat(ctx, p, t, state) {
    const { alpha, settleBlend } = this._visibility(p, t, state);
    const eGlow  = 1 + state.entropy * 1.5;
    // Scale up slightly so the blur-spread halo has visible material to work with
    const rScale = 1 + (0.4 + settleBlend * 0.6) * state.effectiveGlow * eGlow;
    ctx.beginPath(); ctx.arc(p.rx, p.ry, p.r * rScale, 0, Math.PI * 2);
    ctx.fillStyle = p.color; ctx.globalAlpha = Math.min(1, alpha * 1.6); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // draw() — canvas rendering, always called every frame (no skip = no flicker).
  // allowGlow: when false, the glow pass is skipped entirely — every particle
  // draws flat. Dropping glow cuts draw time dramatically with no visible pop.
  //
  // Glow strategy: draw glow particles FLAT into an offscreen buffer every
  // glowInterval frames, then composite that buffer onto the main context with
  // ctx.filter='blur(Npx)' applied at drawImage time — one GPU blur pass over
  // the whole layer instead of N per-particle shadowBlur calls. shadowBlur is
  // eliminated entirely; the bloom comes from the single composite filter.
  // Persistence between redraws is the smooth bloom; the blur-radius modulates
  // with entropy so the halo breathes with entity state.
  draw(ctx, t, state, allowGlow = true) {
    const { effectiveGlow, adaptiveGlow, entropy } = state;
    const glowOn = allowGlow && effectiveGlow > 0.05;

    // Pass 1 — flat particles, drawn directly every frame.
    for (const p of this._particles) {
      if (!(glowOn && p.glow)) this._drawFlat(ctx, p, t, state);
    }

    // Pass 2 — glow bloom layer, composited from the offscreen buffer.
    if (glowOn) {
      const glowInterval = adaptiveGlow < 0.6 ? 4 : (adaptiveGlow < 0.9 ? 3 : 2);
      if (this._glowFrame <= 0) {
        this._glowFrame = glowInterval;
        const gctx = this._glowCtx;
        gctx.setTransform(1, 0, 0, 1, 0, 0);
        gctx.clearRect(0, 0, this._glowCanvas.width, this._glowCanvas.height);
        gctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
        for (const p of this._particles) {
          if (p.glow) this._drawGlowFlat(gctx, p, t, state);
        }
      }
      this._glowFrame--;

      // Single GPU blur composite — O(1) regardless of glow particle count.
      const blurPx = Math.round((6 + entropy * 5) * effectiveGlow);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.filter = `blur(${blurPx}px)`;
      ctx.drawImage(this._glowCanvas, 0, 0);
      ctx.filter = 'none';
      ctx.restore();
    }
  }

  dispose() {}
}
