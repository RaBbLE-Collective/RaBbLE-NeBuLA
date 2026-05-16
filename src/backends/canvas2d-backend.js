/**
 * Canvas2D Backend — Layer 1 Entity Persona Renderer
 *
 * Renders the full RaBbLE entity: particle nebula, portal arcs, eyes, waveform.
 * Supports boot animation via BootSequence (convergence → portals → eye emergence).
 *
 * API: new Canvas2dBackend(canvas, opts)
 *   opts.mode          'idle'|'boot'  — start in idle or boot mode (default: 'idle')
 *   opts.particleCount  number        — particles in nebula cloud (default: 480)
 *   opts.transparent    boolean       — skip background fill (for mix-blend-mode: screen)
 *   opts.showWaveform   boolean       — waveform below eyes reflects entity state
 *   opts.interactive    boolean       — mouse tracking + click snap (default: true)
 *   opts.dpr            number        — device pixel ratio override
 *   opts.glowScale      number        — glow intensity multiplier
 */
import { Renderer } from './renderer.js';
import { BootSequence } from '../core/boot-sequence.js';
import { palette } from '../puppet/palette.js';

// Entity particle color palette — blue/cyan/violet nebula cloud
const PARTICLE_COLORS = [
  '#1a4aaa', '#2255cc', '#3377ee', '#4499ff', '#55aaff',
  '#00bbdd', '#00eeff', '#33ddf0', '#55ccee',
  '#5533aa', '#7744cc', '#9944dd', '#aa44cc', '#bb55dd',
  '#ffffff', '#ddeeff', '#ccddff', '#aabbee',
  '#0a1a55', '#0d2277', '#112299',
];

// Fixed geometry constants (tuned for 460×320 internal coordinates)
const EYE_W = 30, EYE_H = 56, EYE_GAP = 36, BASE_Y_OFFSET = -6;
const PORTAL_W = 62, PORTAL_H = 19, MAX_OFF = 13;
const NEBULA_RADIUS = 130, FALLOFF_RADIUS = 155, MOUSE_NEAR_DIST = 600;

function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
function clamp01(v)   { return Math.max(0, Math.min(1, v)); }

export class Canvas2dBackend extends Renderer {
  constructor(canvas, opts = {}) {
    super();
    if (!canvas) throw new Error('Canvas2dBackend requires HTMLCanvasElement');

    this._opts = {
      mode:          opts.mode          ?? 'idle',
      particleCount: opts.particleCount ?? 480,
      transparent:   opts.transparent   ?? false,
      showWaveform:  opts.showWaveform  ?? false,
      interactive:   opts.interactive   ?? true,
      dpr:           opts.dpr           ?? (window.devicePixelRatio || 1),
      glowScale:     opts.glowScale     ?? 1,
      onReady:       opts.onReady       ?? null,
    };

    this._canvas      = canvas;
    this._ctx         = canvas.getContext('2d');
    this._dpr         = this._opts.dpr;
    this._t           = 0;
    this._rafId       = null;
    this._state       = 'idle';
    this._readyCalled = false;

    // Boot timeline
    this._bootSeq  = new BootSequence();
    this._inBoot   = false;

    // Blink machine: 0=wait, 1=opening, 2=burst, 3=normal
    this._blinkMachine   = 3;
    this._blinkT         = 0;
    this._blinkPhase     = 0;
    this._nextBlink      = 100 + Math.random() * 150;
    this._eyeOpenProgress = 1;
    this._burstCount     = 0;
    this._burstGap       = 8;

    // Eye physics
    this._eyeCurX = 0; this._eyeCurY = 0;
    this._eyeVelX = 0; this._eyeVelY = 0;
    this._joltX   = 0; this._joltY   = 0; this._joltDecay  = 0;
    this._snapX   = 0; this._snapY   = 0; this._snapDecay  = 0;
    this._saccadeX = 0; this._saccadeY = 0;
    this._holdUntil = 0; this._nextSaccade = 0;
    this._distractX   = 0; this._distractY   = 0;
    this._distractCurX = 0; this._distractCurY = 0;
    this._distractVelX = 0; this._distractVelY = 0;
    this._distractReturnAt = 0;
    this._nextDistraction  = 120 + Math.random() * 180;
    this._mouseX = -9999; this._mouseY = -9999;

    // Canvas & centre point
    this._cx = 0; this._cy = 0;
    this._updateCanvasSize();

    // Particles
    this._particles = [];
    this._initParticles();

    // Start in boot mode if requested
    if (this._opts.mode === 'boot') this._startBoot();

    // Mouse tracking
    if (this._opts.interactive) this._setupMouseTracking();

    // Resize handler
    this._resizeHandler = () => this._preserveParticlesOnResize();
    window.addEventListener('resize', this._resizeHandler);

    this._start();
  }

  // ── Canvas sizing ──────────────────────────────────────────────────────────

  _updateCanvasSize() {
    const rect = this._canvas.getBoundingClientRect();
    this._canvas.width  = Math.max(1, rect.width)  * this._dpr;
    this._canvas.height = Math.max(1, rect.height) * this._dpr;
    this._cx = this._canvas.width  / (2 * this._dpr);
    this._cy = this._canvas.height * 0.47 / this._dpr;
  }

  _preserveParticlesOnResize() {
    const oldCx = this._cx, oldCy = this._cy;
    this._updateCanvasSize();
    const dx = this._cx - oldCx, dy = this._cy - oldCy;
    for (const p of this._particles) { p.x += dx; p.y += dy; p.tx += dx; p.ty += dy; }
    while (this._particles.length < this._opts.particleCount) this._particles.push(this._makeParticle(true));
    if (this._particles.length > this._opts.particleCount) this._particles.length = this._opts.particleCount;
  }

  // ── Particles ──────────────────────────────────────────────────────────────

  _makeParticle(atTarget = false) {
    const a  = Math.random() * Math.PI * 2;
    const r  = Math.pow(Math.random(), 0.52) * NEBULA_RADIUS;
    const tx = this._cx + r * Math.cos(a);
    const ty = this._cy + r * Math.sin(a) * 0.80;
    const sz = Math.random() * 11 + 0.8;
    return {
      x:     atTarget ? tx : this._cx + (Math.random() - 0.5) * (this._canvas.width  / this._dpr) * 2.4,
      y:     atTarget ? ty : this._cy + (Math.random() - 0.5) * (this._canvas.height / this._dpr) * 2.2,
      tx, ty, r: sz,
      alpha: Math.random() * 0.65 + 0.18,
      color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.011 + 0.004,
      cs:    Math.random() * 0.032 + 0.012,
      glow:  Math.random() > 0.55,
    };
  }

  _initParticles() {
    this._particles = [];
    for (let i = 0; i < this._opts.particleCount; i++) this._particles.push(this._makeParticle(true));
  }

  // ── Mouse tracking ─────────────────────────────────────────────────────────

  _setupMouseTracking() {
    this._onMouseMove = (e) => { this._mouseX = e.clientX; this._mouseY = e.clientY; };
    this._onClick     = (e) => {
      const rect = this._canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left - rect.width / 2;
      const my = e.clientY - rect.top  - rect.height / 2;
      const ang = Math.atan2(my, mx), str = Math.min(Math.hypot(mx, my) / 220, 1);
      this._snapX = Math.cos(ang) * MAX_OFF * str;
      this._snapY = Math.sin(ang) * MAX_OFF * 0.65 * str;
      this._snapDecay = 1.0;
      this._eyeCurX = this._snapX; this._eyeCurY = this._snapY;
      this._eyeVelX = 0; this._eyeVelY = 0;
      this._joltX = Math.cos(ang) * str; this._joltY = Math.sin(ang) * 0.65 * str;
      this._joltDecay = 1.0;
    };
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('click',     this._onClick);
  }

  // ── Boot ───────────────────────────────────────────────────────────────────

  _startBoot() {
    this._inBoot = true;
    this._bootSeq.reset();
    this._blinkMachine    = 0;
    this._blinkPhase      = 0;
    this._blinkT          = 0;
    this._burstCount      = 0;
    this._burstGap        = 8;
    this._nextBlink       = 99999;
    this._eyeOpenProgress = 0;
    // Scatter particles to boot start positions
    for (const p of this._particles) {
      p.x = this._cx + (Math.random() - 0.5) * (this._canvas.width  / this._dpr) * 2.4;
      p.y = this._cy + (Math.random() - 0.5) * (this._canvas.height / this._dpr) * 2.2;
    }
  }

  // ── Main loop ──────────────────────────────────────────────────────────────

  _start() {
    const frame = () => {
      this._t++;
      if (this._inBoot) {
        this._bootSeq.step();
        if (!this._bootSeq.isActive()) this._inBoot = false;
      }
      this._updateEyeTarget();
      this._updateBlinkMachine();
      this._draw();
      this._rafId = requestAnimationFrame(frame);
    };
    this._rafId = requestAnimationFrame(frame);
  }

  // ── Eye physics ────────────────────────────────────────────────────────────

  _updateEyeTarget() {
    const SACC = [
      [0.95, 0.0, 'hard'], [-0.95, 0.0, 'hard'], [0.0, 0.85, 'hard'], [0.0, -0.85, 'hard'],
      [0.75, 0.65, 'med'],  [-0.75, 0.65, 'med'],  [0.75, -0.55, 'med'], [-0.75, -0.55, 'med'],
      [0.55, 0.0, 'soft'],  [-0.55, 0.0, 'soft'],  [0.0,  0.5,  'soft'], [0.0,  -0.5,  'soft'],
      [0.35, 0.3, 'soft'],  [-0.35,-0.3,  'soft'],  [0.4,  0.55, 'soft'], [-0.4,  0.55, 'soft'],
      [0.0, 0.0, 'soft'], [0.0, 0.0, 'soft'], [0.0, 0.0, 'soft'],
    ];

    if (this._t > this._holdUntil && this._t > this._nextSaccade) {
      const item = SACC[Math.floor(Math.random() * SACC.length)];
      const kind = item[2];
      this._saccadeX = item[0]; this._saccadeY = item[1];
      const hd = kind === 'hard' ? 25 + Math.random() * 35 : kind === 'med' ? 45 + Math.random() * 55 : 65 + Math.random() * 80;
      const gd = kind === 'hard' ? 8  + Math.random() * 18 : kind === 'med' ? 20 + Math.random() * 40 : 40 + Math.random() * 70;
      this._holdUntil = this._t + hd; this._nextSaccade = this._holdUntil + gd;
    }

    if (this._joltDecay > 0.01) { this._joltDecay *= 0.88; } else { this._joltX = 0; this._joltY = 0; this._joltDecay = 0; }
    if (this._snapDecay > 0.01) { this._snapDecay *= 0.92; } else { this._snapX = 0; this._snapY = 0; this._snapDecay = 0; }

    if (this._t > this._nextDistraction) {
      const da = Math.random() * Math.PI * 2, reach = 0.45 + Math.random() * 0.55;
      this._distractX = Math.cos(da) * MAX_OFF * reach;
      this._distractY = Math.sin(da) * MAX_OFF * 0.72 * reach;
      this._distractReturnAt = this._t + 55 + Math.random() * 105;
      this._nextDistraction  = this._distractReturnAt + 170 + Math.random() * 300;
    }
    if (this._distractReturnAt && this._t > this._distractReturnAt) { this._distractX = 0; this._distractY = 0; }
    const ds = this._distractReturnAt && this._t <= this._distractReturnAt ? 0.018 : 0.026;
    this._distractVelX = (this._distractVelX + (this._distractX - this._distractCurX) * ds) * 0.9;
    this._distractVelY = (this._distractVelY + (this._distractY - this._distractCurY) * ds) * 0.9;
    this._distractCurX += this._distractVelX; this._distractCurY += this._distractVelY;

    const d1x = Math.sin(this._t * 0.019) * 2.6 + Math.sin(this._t * 0.043) * 1.1;
    const d1y = Math.cos(this._t * 0.015) * 1.8 + Math.cos(this._t * 0.037) * 0.9;
    const trX = Math.sin(this._t * 0.11) * 0.35 + Math.sin(this._t * 0.17) * 0.2;
    const trY = Math.cos(this._t * 0.09) * 0.25 + Math.cos(this._t * 0.21) * 0.15;

    const rect = this._canvas.getBoundingClientRect();
    const mx   = this._mouseX - rect.left - this._cx;
    const my   = this._mouseY - rect.top  - this._cy;
    const dist = Math.hypot(mx, my);
    const mouseNear = this._mouseX > -9000 && dist < MOUSE_NEAR_DIST;

    let rawX, rawY;
    if (mouseNear) {
      const ang = Math.atan2(my, mx), str = Math.min(dist / 220, 1);
      rawX = Math.cos(ang) * MAX_OFF * str * 0.48 + this._saccadeX * MAX_OFF * 0.42 + d1x + trX + this._distractCurX * 0.9 + this._snapX * this._snapDecay;
      rawY = Math.sin(ang) * MAX_OFF * 0.65 * str * 0.48 + this._saccadeY * MAX_OFF * 0.65 * 0.42 + d1y + trY + this._distractCurY * 0.9 + this._snapY * this._snapDecay;
    } else {
      rawX = this._saccadeX * MAX_OFF + d1x + trX + this._distractCurX + this._snapX * this._snapDecay + this._joltX * MAX_OFF * this._joltDecay;
      rawY = this._saccadeY * MAX_OFF * 0.65 + d1y + trY + this._distractCurY + this._snapY * this._snapDecay + this._joltY * MAX_OFF * 0.65 * this._joltDecay;
    }
    this._eyeTargetX = rawX; this._eyeTargetY = rawY;

    const spring = mouseNear ? 0.14 : 0.10;
    this._eyeVelX = (this._eyeVelX + (this._eyeTargetX - this._eyeCurX) * spring) * 0.72;
    this._eyeVelY = (this._eyeVelY + (this._eyeTargetY - this._eyeCurY) * spring) * 0.72;
    this._eyeCurX += this._eyeVelX; this._eyeCurY += this._eyeVelY;
  }

  _updateBlinkMachine() {
    // Phase 0: waiting for boot to reach eye start
    if (this._blinkMachine === 0 && (!this._inBoot || this._bootSeq.timeline > this._bootSeq.T_EYES_START)) {
      this._blinkMachine = 1;
    }
    // Phase 1: eye opening (boot emerge)
    if (this._blinkMachine === 1) {
      this._eyeOpenProgress = easeInOut(this._bootSeq.getEyeOpenProgress());
      if (this._eyeOpenProgress >= 0.98) {
        this._eyeOpenProgress = 1; this._blinkMachine = 2;
        this._burstCount = 0; this._burstGap = 8;
        this._nextBlink = this._t + this._bootSeq.BLINK_HOLD_AFTER_OPEN;
      }
    }
    // Phase 2: burst blinking
    if (this._blinkMachine === 2 && this._t > this._nextBlink) {
      this._blinkPhase += 0.52;
      this._blinkT = Math.max(0, Math.min(1, Math.abs(Math.sin(this._blinkPhase * Math.PI))));
      if (this._blinkPhase >= 1) {
        this._blinkPhase = 0; this._blinkT = 0; this._burstCount++;
        this._burstGap = this._burstGap * 1.55 + Math.random() * 8;
        if (this._burstCount >= this._bootSeq.BURST_TOTAL) {
          this._blinkMachine = 3;
          this._nextBlink = this._t + this._bootSeq.BLINK_DELAY_AFTER_BURSTS + Math.random() * 60;
        } else {
          this._nextBlink = this._t + this._burstGap;
        }
      }
    }
    // Phase 3: normal blinking
    if (this._blinkMachine === 3 && this._t > this._nextBlink) {
      this._blinkPhase += 0.20;
      this._blinkT = Math.max(0, Math.min(1, Math.abs(Math.sin(this._blinkPhase * Math.PI))));
      if (this._blinkPhase >= 1) {
        this._blinkPhase = 0; this._blinkT = 0;
        this._nextBlink = this._t + 100 + Math.random() * 150;
      }
    }
  }

  // ── Drawing ────────────────────────────────────────────────────────────────

  _draw() {
    const ctx = this._ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);

    if (!this._opts.transparent) {
      ctx.fillStyle = '#010008';
      ctx.fillRect(0, 0, this._canvas.width / this._dpr, this._canvas.height / this._dpr);
    }

    const convProg    = this._inBoot ? this._bootSeq.getConvergenceProgress() : 1;
    const settleBlend = this._inBoot
      ? clamp01((this._bootSeq.timeline - this._bootSeq.T_CONVERGE_END) / (1.5 * 60))
      : 1;

    // ── Particles
    for (const p of this._particles) {
      if (this._inBoot && convProg < 1) {
        p.x += (p.tx - p.x) * p.cs; p.y += (p.ty - p.y) * p.cs;
      } else {
        const sd = 0.28 + settleBlend * 0.55;
        p.x += (p.tx - p.x) * (p.cs * (1 - settleBlend) * 0.3) + Math.sin(p.phase * 0.7 + this._t * 0.003) * sd * 0.5;
        p.y += (p.ty - p.y) * (p.cs * (1 - settleBlend) * 0.3) + Math.cos(p.phase * 0.9 + this._t * 0.002) * sd * 0.35;
      }
      p.phase += p.speed * (0.7 + settleBlend * 0.5);

      const driftAmt = 0.6 + settleBlend * 2.4;
      const driftX   = Math.sin(p.phase + this._t * 0.008) * driftAmt;
      const driftY   = Math.cos(p.phase * 0.72 + this._t * 0.006) * driftAmt * 0.8;
      const dx = p.x + driftX - this._cx, dy = p.y + driftY - this._cy;
      const d  = Math.sqrt(dx * dx + dy * dy);
      const falloff = Math.max(0, 1 - d / FALLOFF_RADIUS);
      const pulse   = 0.62 + 0.38 * Math.sin(p.phase * 2 + this._t * 0.015);
      const vis     = this._inBoot ? Math.min(1, convProg * 3) : 1;
      const a       = p.alpha * falloff * pulse * vis;

      ctx.shadowColor = p.color;
      ctx.shadowBlur  = p.glow
        ? (20 + settleBlend * 14 + 7 * Math.sin(p.phase + this._t * 0.02)) * this._opts.glowScale
        : settleBlend * 4 * this._opts.glowScale;
      ctx.beginPath(); ctx.arc(p.x + driftX, p.y + driftY, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color; ctx.globalAlpha = a; ctx.fill();
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }

    // ── Connection lines
    if (settleBlend > 0) {
      const connAlpha = settleBlend * 0.13, connDist = 62 + settleBlend * 20;
      for (let i = 0; i < this._particles.length; i += 2) {
        const pi  = this._particles[i];
        const dxi = Math.sin(pi.phase + this._t * 0.008) * (0.6 + settleBlend * 2.4);
        const dyi = Math.cos(pi.phase * 0.72 + this._t * 0.006) * (0.6 + settleBlend * 2.4) * 0.8;
        for (let j = i + 2; j < this._particles.length; j += 2) {
          const pj  = this._particles[j];
          const dxj = Math.sin(pj.phase + this._t * 0.008) * (0.6 + settleBlend * 2.4);
          const dyj = Math.cos(pj.phase * 0.72 + this._t * 0.006) * (0.6 + settleBlend * 2.4) * 0.8;
          const dd  = Math.hypot((pi.x + dxi) - (pj.x + dxj), (pi.y + dyi) - (pj.y + dyj));
          if (dd < connDist) {
            ctx.beginPath();
            ctx.moveTo(pi.x + dxi, pi.y + dyi);
            ctx.lineTo(pj.x + dxj, pj.y + dyj);
            ctx.strokeStyle = pi.color;
            ctx.globalAlpha = connAlpha * (1 - dd / connDist);
            ctx.lineWidth = 0.4; ctx.stroke(); ctx.globalAlpha = 1;
          }
        }
      }
    }

    // ── Portals
    if (!this._inBoot || this._bootSeq.timeline > this._bootSeq.T_PORTALS_START) {
      this._drawPortals(this._inBoot ? this._bootSeq.getPortalProgress() : 1);
    }

    // ── Eyes + waveform
    if (!this._inBoot || this._bootSeq.timeline > this._bootSeq.T_EYES_START) {
      const eyeAlpha   = this._inBoot
        ? Math.pow(easeInOut(this._bootSeq.getEyesProgress()), 0.45)
        : 1;
      const emergeScale = this._blinkMachine === 1 ? this._eyeOpenProgress : 1.0;
      const blinkScale  = (1 - this._blinkT * 0.93) * emergeScale;
      this._drawEyes(eyeAlpha, blinkScale, emergeScale);
      if (this._opts.showWaveform && eyeAlpha > 0) this._drawWaveform(eyeAlpha * 0.92);

      if (!this._readyCalled && eyeAlpha > 0.95) {
        this._readyCalled = true;
        if (typeof this._opts.onReady === 'function') this._opts.onReady();
      }
    }
  }

  _drawPortals(drawProgress) {
    const ctx  = this._ctx;
    const pW2  = PORTAL_W / 2, pH2 = PORTAL_H / 2;
    const lx   = this._cx - EYE_GAP, rx = this._cx + EYE_GAP;
    const baseY = this._cy + BASE_Y_OFFSET;
    const lpY  = baseY + EYE_H * 0.44, rpY = baseY - EYE_H * 0.44;
    const p    = easeInOut(drawProgress);
    this._drawPortalArc(ctx, lx, lpY, palette.magenta, pW2, pH2, clamp01(p * 1.15));
    this._drawPortalArc(ctx, rx, rpY, palette.cyan,    pW2, pH2, clamp01((p - 0.08) * 1.15));
  }

  _drawPortalArc(ctx, px, py, col, pW2, pH2, frac) {
    const grd = ctx.createRadialGradient(px, py, 0, px, py, pW2);
    grd.addColorStop(0, '#010108'); grd.addColorStop(0.65, '#05050e'); grd.addColorStop(1, 'rgba(1,1,8,0)');
    ctx.beginPath(); ctx.ellipse(px, py, pW2, pH2, 0, 0, Math.PI * 2);
    ctx.fillStyle = grd; ctx.fill();
    if (frac <= 0) return;

    const glowBase = frac >= 1 ? 12 + 8 * Math.sin(this._t * 0.035) : 14 + 8 * Math.sin(this._t * 0.04);
    ctx.beginPath();
    const steps = Math.ceil(frac * 80) + 1;
    for (let s = 0; s <= steps; s++) {
      const ang = -Math.PI / 2 + (s / steps) * frac * Math.PI * 2;
      const ex = px + pW2 * Math.cos(ang), ey = py + pH2 * Math.sin(ang);
      s === 0 ? ctx.moveTo(ex, ey) : ctx.lineTo(ex, ey);
    }
    ctx.strokeStyle = col; ctx.lineWidth = 1.8;
    ctx.shadowColor = col; ctx.shadowBlur = glowBase * this._opts.glowScale;
    ctx.stroke(); ctx.shadowBlur = 0;

    if (frac < 1) {
      const ae = -Math.PI / 2 + frac * Math.PI * 2;
      const xe = px + pW2 * Math.cos(ae), ye = py + pH2 * Math.sin(ae);
      ctx.beginPath(); ctx.arc(xe, ye, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0;
    }
  }

  _drawEyes(alpha, blinkScale, emergeScale) {
    const ctx   = this._ctx;
    const pW2   = PORTAL_W / 2, pH2 = PORTAL_H / 2;
    const eW2   = EYE_W / 2,    eH2 = EYE_H / 2;
    const baseY = this._cy + BASE_Y_OFFSET;
    const lx    = this._cx - EYE_GAP, rx = this._cx + EYE_GAP;
    const lpY   = baseY + EYE_H * 0.44, rpY = baseY - EYE_H * 0.44;
    const maxIrisX = Math.max(0, pW2 - eW2 * 0.55);
    const maxIrisY = Math.max(0, pH2 - 4);

    const cp = (ox, oy) => {
      const nx = ox / maxIrisX || 0, ny = oy / maxIrisY || 0;
      const d  = Math.sqrt(nx * nx + ny * ny);
      return d > 1 ? { x: (nx / d) * maxIrisX, y: (ny / d) * maxIrisY } : { x: ox, y: oy };
    };
    const lC = cp(this._eyeCurX, this._eyeCurY);
    const rC = cp(this._eyeCurX, this._eyeCurY);
    const eb = easeInOut(emergeScale);

    const lOrbX = lx + lC.x * 0.7 * eb;
    const lOrbY = lpY + (baseY + lC.y * 0.5 * eb - lpY) * eb;
    const rOrbX = rx + rC.x * 0.7 * eb;
    const rOrbY = rpY + (baseY + rC.y * 0.5 * eb - rpY) * eb;

    ctx.globalAlpha = alpha;
    this._drawOrb(ctx, lOrbX, lOrbY, blinkScale, palette.magenta, lx, lpY, emergeScale, pW2, pH2, eW2, eH2);
    this._drawOrb(ctx, rOrbX, rOrbY, blinkScale, palette.cyan,    rx, rpY, emergeScale, pW2, pH2, eW2, eH2);
    ctx.globalAlpha = 1;
  }

  _drawOrb(ctx, ox, oy, bs, col, portalX, portalY, emerge, pW2, pH2, eW2, eH2) {
    if (emerge < 0.98) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(portalX, portalY,
        PORTAL_W * 0.55 + PORTAL_W * 0.45 * easeInOut(emerge),
        pH2 + EYE_H * easeInOut(emerge), 0, 0, Math.PI * 2);
      ctx.clip();
    }
    // Halo
    const haloSize = EYE_H * (0.80 + 0.12 * Math.sin(this._t * 0.022));
    const hg = ctx.createRadialGradient(ox, oy, 2, ox, oy, haloSize);
    hg.addColorStop(0, col + '38'); hg.addColorStop(1, 'transparent');
    ctx.beginPath(); ctx.ellipse(ox, oy, haloSize, haloSize, 0, 0, Math.PI * 2);
    ctx.fillStyle = hg; ctx.fill();
    // Eye white + pupil glow
    ctx.save(); ctx.translate(ox, oy); ctx.scale(1, bs);
    ctx.beginPath(); ctx.ellipse(0, 0, eW2, eH2, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f8faff';
    ctx.shadowColor = 'rgba(220,235,255,0.85)'; ctx.shadowBlur = 22 * this._opts.glowScale;
    ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.shadowColor = col; ctx.shadowBlur = (18 + 10 * Math.sin(this._t * 0.028)) * this._opts.glowScale;
    ctx.stroke(); ctx.shadowBlur = 0;
    ctx.restore();
    if (emerge < 0.98) ctx.restore();
  }

  _drawWaveform(alpha) {
    const ctx = this._ctx;
    const breathe = 1.2 + 0.8 * Math.sin(this._t * 0.018);
    const amp  = (this._state === 'speaking' ? 7.5 : this._state === 'thinking' ? 4.5 : 2.0) * breathe;
    const freq = this._state === 'speaking' ? 0.2 : this._state === 'thinking' ? 0.13 : 0.09;
    const spd  = this._state === 'speaking' ? 0.011 : this._state === 'thinking' ? 0.007 : 0.005;
    const wy = this._cy + 68, wx0 = this._cx - 64, wx1 = this._cx + 64;
    ctx.globalAlpha = alpha;
    [[palette.magenta, 0], [palette.cyan, Math.PI]].forEach(([col, ph]) => {
      ctx.beginPath();
      for (let x = wx0; x <= wx1; x += 2) {
        const frac = (x - wx0) / (wx1 - wx0);
        const y    = wy + amp * Math.sin(freq * (x - wx0) + this._t * spd * 60 + ph) * Math.sin(frac * Math.PI);
        x === wx0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = col; ctx.lineWidth = 1.9;
      ctx.shadowColor = col; ctx.shadowBlur = 8 + 4 * Math.sin(this._t * 0.025 + ph);
      ctx.stroke(); ctx.shadowBlur = 0;
    });
    ctx.globalAlpha = 1;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  setEntityState(state) {
    if (['idle', 'thinking', 'speaking'].includes(state)) {
      this._state = state;
      window.dispatchEvent(new CustomEvent('rabble:entity-state', { detail: { state } }));
    }
  }

  triggerBoot() { this._startBoot(); }

  injectEyeJolt(dx, dy) {
    this._joltX = Math.max(-1, Math.min(1, dx));
    this._joltY = Math.max(-1, Math.min(1, dy));
    this._joltDecay = 1.0;
  }

  resize() { this._preserveParticlesOnResize(); }

  dispose() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    window.removeEventListener('resize', this._resizeHandler);
    if (this._opts.interactive && this._onMouseMove) {
      window.removeEventListener('mousemove', this._onMouseMove);
      window.removeEventListener('click',     this._onClick);
    }
  }

  getPerformanceMetrics() {
    return { fps: 60, particles: this._particles.length, entityState: this._state };
  }
}
