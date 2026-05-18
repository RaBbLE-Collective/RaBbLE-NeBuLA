const PARTICLE_COLORS = [
  '#1a4aaa', '#2255cc', '#3377ee', '#4499ff', '#55aaff',
  '#00bbdd', '#00eeff', '#33ddf0', '#55ccee',
  '#5533aa', '#7744cc', '#9944dd', '#aa44cc', '#bb55dd',
  '#ffffff', '#ddeeff', '#ccddff', '#aabbee',
  '#0a1a55', '#0d2277', '#112299',
];

const NEBULA_RADIUS = 130, FALLOFF_RADIUS = 155;

export class ParticleSystem {
  constructor({ cx, cy, canvas, dpr, particleCount }) {
    this._cx            = cx;
    this._cy            = cy;
    this._canvas        = canvas;
    this._dpr           = dpr;
    this._particleCount = particleCount;
    this._particles     = [];
    this._initParticles();
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
      glow:  Math.random() > 0.72,
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
  }

  // update() — position integration, always runs every frame
  update(t, state) {
    const { inBoot, convProg, settleBlend, entropy } = state;
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

  // draw() — canvas rendering, can be deferred by FrameBudget
  draw(ctx, t, state) {
    const { inBoot, convProg, settleBlend, entropy, effectiveGlow } = state;

    for (const p of this._particles) {
      const dx = p.rx - this._cx, dy = p.ry - this._cy;
      const d  = Math.sqrt(dx * dx + dy * dy);
      const falloff = Math.max(0, 1 - d / FALLOFF_RADIUS);
      const pulse   = 0.62 + 0.38 * Math.sin(p.phase * 2 + t * 0.015);
      const vis     = inBoot ? Math.min(1, convProg * 3) : 1;
      const a       = p.alpha * falloff * pulse * vis;

      const useBlur = p.glow && effectiveGlow > 0.05;
      if (useBlur) {
        ctx.shadowColor = p.color;
        const eGlow = 1 + entropy * 1.5;
        ctx.shadowBlur = (20 + settleBlend * 14 + 7 * Math.sin(p.phase + t * 0.02)) * effectiveGlow * eGlow;
      }
      ctx.beginPath(); ctx.arc(p.rx, p.ry, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color; ctx.globalAlpha = a; ctx.fill();
      if (useBlur) ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }

  dispose() {}
}
