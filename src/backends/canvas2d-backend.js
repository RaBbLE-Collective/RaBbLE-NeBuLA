/**
 * Canvas2D Backend — Layer 1 Entity Persona Renderer
 *
 * Renders entropy-driven entity visual: eyes, portals, particle nebula.
 * • Performance target: 100–480 entities @ 55+ FPS
 * • Works offline (no backend, no WebGL)
 * • API: setEntityState('idle'|'thinking'|'speaking'), injectEyeJolt(dx, dy)
 */
import { Renderer } from './renderer.js';
import { palette, hexToRgba } from '../puppet/palette.js';

export class Canvas2dBackend extends Renderer {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    super();
    if (!canvas) throw new Error('Canvas2dBackend requires HTMLCanvasElement');

    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._dpr = window.devicePixelRatio || 1;

    // State management
    this._state = 'idle'; // 'idle' | 'thinking' | 'speaking'
    this._t = 0; // animation timeline (frames)
    this._rafId = null;
    this._readyCalled = false;

    // Canvas sizing
    this._updateCanvasSize();
    window.addEventListener('resize', () => this._updateCanvasSize());

    // Entity positioning
    this._cx = 0; // center x
    this._cy = 0; // center y
    this._updateCentre();

    // Eye state (position, movement, tracking)
    this._eyeCurX = 0;
    this._eyeCurY = 0;
    this._eyeVelX = 0;
    this._eyeVelY = 0;
    this._eyeTargetX = 0;
    this._eyeTargetY = 0;

    // Jolt & snap (eye startle effects)
    this._joltX = 0;
    this._joltY = 0;
    this._joltDecay = 0;
    this._snapX = 0;
    this._snapY = 0;
    this._snapDecay = 0;

    // Saccades & distractions
    this._saccadeX = 0;
    this._saccadeY = 0;
    this._holdUntil = 0;
    this._nextSaccade = 0;
    this._distractX = 0;
    this._distractY = 0;
    this._distractCurX = 0;
    this._distractCurY = 0;
    this._distractVelX = 0;
    this._distractVelY = 0;
    this._distractReturnAt = 0;
    this._nextDistraction = 120 + Math.random() * 180;

    // Blink state
    this._blinkT = 0;
    this._blinkPhase = 0;
    this._nextBlink = 100 + Math.random() * 150;
    this._blinkMachine = 3;
    this._eyeOpenProgress = 0;

    // Particle system
    this._particles = [];
    this._particleCount = 480;
    this._initParticles();

    // Mouse tracking
    this._mouseX = -9999;
    this._mouseY = -9999;
    this._setupMouseTracking();

    // Performance metrics
    this._frameCount = 0;
    this._fps = 60;
    this._lastMetricsTime = performance.now();

    // Start animation loop
    this._start();
  }

  /** Update canvas to device size */
  _updateCanvasSize() {
    const rect = this._canvas.getBoundingClientRect();
    const w = rect.width * this._dpr;
    const h = rect.height * this._dpr;
    this._canvas.width = w;
    this._canvas.height = h;
    this._ctx.scale(this._dpr, this._dpr);
    this._updateCentre();
  }

  /** Recalculate center point */
  _updateCentre() {
    this._cx = this._canvas.width / (2 * this._dpr);
    this._cy = this._canvas.height * 0.47 / this._dpr;
  }

  /** Initialize particle cloud */
  _initParticles() {
    this._particles = [];
    for (let i = 0; i < this._particleCount; i++) {
      this._particles.push(this._makeParticle());
    }
  }

  /** Create one particle with random properties */
  _makeParticle() {
    const a = Math.random() * Math.PI * 2;
    const r = Math.pow(Math.random(), 0.52) * 130; // NEBULA_RADIUS
    const tx = this._cx + r * Math.cos(a);
    const ty = this._cy + r * Math.sin(a) * 0.80;
    const sz = Math.random() * 11 + 0.8;
    return {
      x: tx,
      y: ty,
      tx,
      ty,
      r: sz,
      alpha: Math.random() * 0.65 + 0.18,
      color: this._randomParticleColor(),
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.011 + 0.004,
      cs: Math.random() * 0.032 + 0.012,
      glow: Math.random() > 0.55,
    };
  }

  /** Random color from palette for particles */
  _randomParticleColor() {
    const colors = [
      palette.cyan, palette.magenta, palette.violet, palette.pink,
      palette.text, '#ddeeff', '#ccddff', '#aabbee',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /** Setup mouse tracking for eye following */
  _setupMouseTracking() {
    window.addEventListener('mousemove', (e) => {
      this._mouseX = e.clientX;
      this._mouseY = e.clientY;
    });
    this._canvas.addEventListener('click', (e) => this._handleCanvasClick(e));
  }

  /** Handle canvas click (eye snap) */
  _handleCanvasClick(e) {
    const rect = this._canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left - rect.width / 2;
    const my = e.clientY - rect.top - rect.height / 2;
    const ang = Math.atan2(my, mx);
    const str = Math.min(Math.hypot(mx, my) / 220, 1);
    const maxOff = 13;
    this._snapX = Math.cos(ang) * maxOff * str;
    this._snapY = Math.sin(ang) * maxOff * 0.65 * str;
    this._snapDecay = 1.0;
    this._eyeCurX = this._snapX;
    this._eyeCurY = this._snapY;
    this._eyeVelX = 0;
    this._eyeVelY = 0;
    this._joltX = this._snapX / maxOff;
    this._joltY = this._snapY / (maxOff * 0.65);
    this._joltDecay = 1.0;
  }

  /** Main render loop */
  _start() {
    const frame = () => {
      this._update();
      this._draw();
      this._rafId = requestAnimationFrame(frame);
    };
    this._rafId = requestAnimationFrame(frame);
  }

  /** Update all animation state */
  _update() {
    this._t++;
    this._updateEyeTarget();
    this._updateParticles();
    this._updateBlink();
  }

  /** Update eye position and tracking */
  _updateEyeTarget() {
    const maxOff = 13;
    const mouseNearDist = 600;
    const driftX1 = 2.6, driftX2 = 1.1;
    const driftY1 = 1.8, driftY2 = 0.9;
    const saccadeTargets = [
      [0.95, 0.0], [-0.95, 0.0], [0.0, 0.85], [0.0, -0.85],
      [0.75, 0.65], [-0.75, 0.65], [0.75, -0.55], [-0.75, -0.55],
      [0.55, 0.0], [-0.55, 0.0], [0.0, 0.5], [0.0, -0.5],
      [0.35, 0.3], [-0.35, -0.3], [0.4, 0.55], [-0.4, 0.55],
      [0.0, 0.0], [0.0, 0.0], [0.0, 0.0],
    ];

    if (this._t > this._holdUntil && this._t > this._nextSaccade) {
      const item = saccadeTargets[Math.floor(Math.random() * saccadeTargets.length)];
      this._saccadeX = item[0];
      this._saccadeY = item[1];
      const hd = Math.abs(this._saccadeX) > 0.8 ? 25 + Math.random() * 35 : 45 + Math.random() * 80;
      const gd = Math.abs(this._saccadeX) > 0.8 ? 8 + Math.random() * 18 : 40 + Math.random() * 70;
      this._holdUntil = this._t + hd;
      this._nextSaccade = this._holdUntil + gd;
    }

    if (this._joltDecay > 0.01) {
      this._joltDecay *= 0.88;
    } else {
      this._joltX = 0;
      this._joltY = 0;
      this._joltDecay = 0;
    }

    if (this._snapDecay > 0.01) {
      this._snapDecay *= 0.92;
    } else {
      this._snapX = 0;
      this._snapY = 0;
      this._snapDecay = 0;
    }

    if (this._t > this._nextDistraction) {
      const da = Math.random() * Math.PI * 2;
      const reach = 0.45 + Math.random() * 0.55;
      this._distractX = Math.cos(da) * maxOff * reach;
      this._distractY = Math.sin(da) * maxOff * 0.72 * reach;
      this._distractReturnAt = this._t + 55 + Math.random() * 105;
      this._nextDistraction = this._distractReturnAt + 170 + Math.random() * 300;
    }

    if (this._distractReturnAt && this._t > this._distractReturnAt) {
      this._distractX = 0;
      this._distractY = 0;
    }

    const distractSpring = this._distractReturnAt && this._t <= this._distractReturnAt ? 0.018 : 0.026;
    this._distractVelX = (this._distractVelX + (this._distractX - this._distractCurX) * distractSpring) * 0.9;
    this._distractVelY = (this._distractVelY + (this._distractY - this._distractCurY) * distractSpring) * 0.9;
    this._distractCurX += this._distractVelX;
    this._distractCurY += this._distractVelY;

    const d1x = Math.sin(this._t * 0.019) * driftX1 + Math.sin(this._t * 0.043) * driftX2;
    const d1y = Math.cos(this._t * 0.015) * driftY1 + Math.cos(this._t * 0.037) * driftY2;
    const trX = Math.sin(this._t * 0.11) * 0.35 + Math.sin(this._t * 0.17) * 0.2;
    const trY = Math.cos(this._t * 0.09) * 0.25 + Math.cos(this._t * 0.21) * 0.15;

    const rect = this._canvas.getBoundingClientRect();
    const mx = this._mouseX - rect.left - this._cx;
    const my = this._mouseY - rect.top - this._cy;
    const dist = Math.hypot(mx, my);
    const mouseNear = this._mouseX > -9000 && dist < mouseNearDist;

    let rawX, rawY;
    if (mouseNear) {
      const ang2 = Math.atan2(my, mx);
      const str2 = Math.min(dist / 220, 1);
      const mouseSuggestX = Math.cos(ang2) * maxOff * str2;
      const mouseSuggestY = Math.sin(ang2) * maxOff * 0.65 * str2;
      rawX =
        mouseSuggestX * 0.48 +
        this._saccadeX * maxOff * 0.42 +
        d1x + trX +
        this._distractCurX * 0.9 +
        this._snapX * this._snapDecay;
      rawY =
        mouseSuggestY * 0.48 +
        this._saccadeY * maxOff * 0.65 * 0.42 +
        d1y + trY +
        this._distractCurY * 0.9 +
        this._snapY * this._snapDecay;
    } else {
      rawX =
        this._saccadeX * maxOff +
        d1x + trX +
        this._distractCurX +
        this._snapX * this._snapDecay +
        this._joltX * maxOff * this._joltDecay;
      rawY =
        this._saccadeY * maxOff * 0.65 +
        d1y + trY +
        this._distractCurY +
        this._snapY * this._snapDecay +
        this._joltY * maxOff * 0.65 * this._joltDecay;
    }

    this._eyeTargetX = rawX;
    this._eyeTargetY = rawY;

    const spring = mouseNear ? 0.14 : 0.10;
    this._eyeVelX = (this._eyeVelX + (this._eyeTargetX - this._eyeCurX) * spring) * 0.72;
    this._eyeVelY = (this._eyeVelY + (this._eyeTargetY - this._eyeCurY) * spring) * 0.72;
    this._eyeCurX += this._eyeVelX;
    this._eyeCurY += this._eyeVelY;
  }

  /** Update particle animation */
  _updateParticles() {
    for (let p of this._particles) {
      p.phase += p.speed;
      const ox = Math.sin(p.phase) * p.cs;
      const oy = Math.cos(p.phase) * p.cs;
      p.x += (p.tx + ox - p.x) * 0.035;
      p.y += (p.ty + oy - p.y) * 0.035;
    }
  }

  /** Update blink state */
  _updateBlink() {
    this._blinkT++;
    if (this._blinkT > this._nextBlink) {
      this._blinkPhase = 1;
      this._blinkT = 0;
      this._nextBlink = 100 + Math.random() * 150;
    }
    if (this._blinkPhase > 0) {
      this._blinkPhase -= 0.15;
      this._eyeOpenProgress = 1 - Math.abs(this._blinkPhase);
    }
  }

  /** Draw frame */
  _draw() {
    const ctx = this._ctx;
    ctx.clearRect(0, 0, this._canvas.width / this._dpr, this._canvas.height / this._dpr);

    // Background
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, this._canvas.width / this._dpr, this._canvas.height / this._dpr);

    // Draw particles
    this._drawParticles();

    // Draw portals & eyes
    this._drawPortals();
    this._drawEyes();

    // Signal ready on first frame
    if (!this._readyCalled && this._t === 1) {
      this._readyCalled = true;
      window.dispatchEvent(new CustomEvent('rabble:entity-ready'));
    }
  }

  /** Draw particle nebula */
  _drawParticles() {
    const ctx = this._ctx;
    for (let p of this._particles) {
      ctx.fillStyle = hexToRgba(p.color, p.alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 0.5, 0, Math.PI * 2);
      ctx.fill();

      if (p.glow) {
        ctx.strokeStyle = hexToRgba(p.color, p.alpha * 0.6);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  /** Draw portal ellipses around eyes */
  _drawPortals() {
    const ctx = this._ctx;
    const portalW = 62, portalH = 19;
    const eyeGap = 36;
    const baseYOffset = -6;
    const eyeH = 56;

    const lx = this._cx - eyeGap, rx = this._cx + eyeGap;
    const baseY = this._cy + baseYOffset;
    const lpY = baseY + eyeH * 0.44, rpY = baseY - eyeH * 0.44;

    this._drawPortalArc(ctx, lx, lpY, palette.magenta, portalW, portalH);
    this._drawPortalArc(ctx, rx, rpY, palette.cyan, portalW, portalH);
  }

  /** Helper: draw one portal arc */
  _drawPortalArc(ctx, px, py, color, w, h) {
    const w2 = w / 2, h2 = h / 2;
    const grd = ctx.createRadialGradient(px, py, 0, px, py, w2);
    grd.addColorStop(0, palette.bg);
    grd.addColorStop(0.65, palette.surface);
    grd.addColorStop(1, 'rgba(12, 11, 25, 0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(px, py, w2, h2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Portal glow
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    const steps = 80;
    for (let s = 0; s <= steps; s++) {
      const ang = (-Math.PI / 2) + (s / steps) * Math.PI * 2;
      const ex = px + w2 * Math.cos(ang);
      const ey = py + h2 * Math.sin(ang);
      s === 0 ? ctx.moveTo(ex, ey) : ctx.lineTo(ex, ey);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  /** Draw eyes */
  _drawEyes() {
    const ctx = this._ctx;
    const eyeW = 30, eyeH = 56;
    const eyeGap = 36;
    const baseYOffset = -6;

    const lx = this._cx - eyeGap, rx = this._cx + eyeGap;
    const baseY = this._cy + baseYOffset;

    // Left and right eye
    this._drawEye(ctx, lx, baseY, eyeW, eyeH);
    this._drawEye(ctx, rx, baseY, eyeW, eyeH);
  }

  /** Helper: draw one eye */
  _drawEye(ctx, ex, ey, w, h) {
    const open = Math.max(0, this._eyeOpenProgress);

    // Eye white
    ctx.fillStyle = palette.text;
    ctx.globalAlpha = open;
    ctx.beginPath();
    ctx.ellipse(ex, ey, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupil (tracking)
    ctx.fillStyle = palette.bg;
    ctx.beginPath();
    ctx.arc(ex + this._eyeCurX, ey + this._eyeCurY, 8, 0, Math.PI * 2);
    ctx.fill();

    // Pupil glow
    ctx.strokeStyle = palette.magenta;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = palette.magenta;
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.globalAlpha = 1;
  }

  /**
   * Public API: Change entity state
   * @param {string} state - 'idle' | 'thinking' | 'speaking'
   */
  setEntityState(state) {
    if (['idle', 'thinking', 'speaking'].includes(state)) {
      this._state = state;
      window.dispatchEvent(new CustomEvent('rabble:entity-state', { detail: { state } }));
    }
  }

  /**
   * Public API: Startle the entity
   * @param {number} dx - horizontal jolt (-1 to 1)
   * @param {number} dy - vertical jolt (-1 to 1)
   */
  injectEyeJolt(dx, dy) {
    this._joltX = Math.max(-1, Math.min(1, dx));
    this._joltY = Math.max(-1, Math.min(1, dy));
    this._joltDecay = 1.0;
  }

  /** Cleanup and stop animation */
  dispose() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    window.removeEventListener('resize', () => this._updateCanvasSize());
  }

  resize() {
    this._updateCanvasSize();
  }

  /** @returns {Object} Performance metrics */
  getPerformanceMetrics() {
    return {
      fps: this._fps,
      frameTime: 1000 / this._fps,
      particles: this._particles.length,
      entityState: this._state,
    };
  }
}
