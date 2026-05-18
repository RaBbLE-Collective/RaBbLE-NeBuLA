import { Renderer } from '../renderer.js';
import { BootSequence } from '../../core/boot-sequence.js';
import { ParticleSystem } from './particle-system.js';
import { ConnectionSystem } from './connection-system.js';
import { PortalSystem } from './portal-system.js';
import { EyeSystem } from './eye-system.js';
import { FrameBudget } from './frame-budget.js';

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
    this._entropy     = 0.3;
    this._readyCalled = false;

    // FPS tracking + adaptive glow
    this._fps          = 60;
    this._frameCount   = 0;
    this._lastMetrics  = performance.now();
    this._adaptiveGlow = 1.0;
    this._glowRampT    = 0;

    // Boot timeline
    this._bootSeq   = new BootSequence();
    this._inBoot    = false;
    this._hasBooted = (this._opts.mode !== 'idle');

    // Canvas & centre point
    this._cx = 0; this._cy = 0;
    this._updateCanvasSize();

    // Systems
    this._budget = new FrameBudget();

    this._particleSystem = new ParticleSystem({
      cx: this._cx, cy: this._cy,
      canvas: this._canvas, dpr: this._dpr,
      particleCount: this._opts.particleCount,
    });

    this._connectionSystem = new ConnectionSystem();
    this._connectionSystem.rebuild(this._particleSystem.particles);

    this._portalSystem = new PortalSystem({ glowScale: this._opts.glowScale });
    this._portalSystem.resize(this._cx, this._cy);

    this._eyeSystem = new EyeSystem({
      canvas:      this._canvas,
      cx:          this._cx,
      cy:          this._cy,
      bootSeq:     this._bootSeq,
      glowScale:   this._opts.glowScale,
      showWaveform: this._opts.showWaveform,
    });

    if (this._opts.mode === 'boot') this._startBoot();
    if (this._opts.interactive) this._eyeSystem.setupMouseTracking();

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
    this._updateCanvasSize();
    this._particleSystem.resize(this._cx, this._cy);
    this._connectionSystem.rebuild(this._particleSystem.particles);
    this._portalSystem.resize(this._cx, this._cy);
    this._eyeSystem.resize(this._cx, this._cy);
  }

  // ── Boot ───────────────────────────────────────────────────────────────────

  _startBoot() {
    this._inBoot       = true;
    this._hasBooted    = true;
    this._glowRampT    = 0;
    this._adaptiveGlow = 0; // ramp in after boot — prevents 1fps cliff
    this._bootSeq.reset();
    this._eyeSystem.initBoot();
    this._particleSystem.scatter();
  }

  // ── State snapshot passed to all systems each frame ────────────────────────

  _buildState() {
    const convProg    = this._inBoot ? this._bootSeq.getConvergenceProgress() : 1;
    const settleBlend = this._inBoot
      ? clamp01((this._bootSeq.timeline - this._bootSeq.T_CONVERGE_END) / (1.5 * 60))
      : 1;
    return {
      t:            this._t,
      inBoot:       this._inBoot,
      hasBooted:    this._hasBooted,
      convProg,
      settleBlend,
      entropy:      this._entropy,
      adaptiveGlow: this._adaptiveGlow,
      effectiveGlow: this._opts.glowScale * this._adaptiveGlow,
      glowScale:    this._opts.glowScale,
      bootSeq:      this._bootSeq,
    };
  }

  // ── Main loop ──────────────────────────────────────────────────────────────

  _start() {
    const frame = () => {
      this._t++;

      if (this._inBoot) {
        this._bootSeq.step();
        if (!this._bootSeq.isActive()) {
          this._inBoot    = false;
          this._glowRampT = 0;
        }
      }

      // Ramp glow gradually after boot ends (prevents 1fps cliff)
      if (!this._inBoot && this._glowRampT < 180) {
        this._glowRampT++;
        this._adaptiveGlow = easeInOut(Math.min(1, this._glowRampT / 180));
      }

      // FPS tracking + adaptive glow reduction under load
      this._frameCount++;
      const now     = performance.now();
      const elapsed = now - this._lastMetrics;
      if (elapsed >= 1000) {
        this._fps         = Math.round(this._frameCount * 1000 / elapsed);
        this._frameCount  = 0;
        this._lastMetrics = now;
        if (this._fps < 40 && this._adaptiveGlow > 0.3) {
          this._adaptiveGlow = Math.max(0.3, this._adaptiveGlow * 0.85);
        }
      }

      const state = this._buildState();

      // update() always runs — physics, FSM, position integration
      this._eyeSystem.update(this._t, state);
      this._particleSystem.update(this._t, state);

      this._draw(state);
      this._rafId = requestAnimationFrame(frame);
    };
    this._rafId = requestAnimationFrame(frame);
  }

  // ── Draw ───────────────────────────────────────────────────────────────────

  _draw(state) {
    const ctx = this._ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);

    if (!this._opts.transparent) {
      ctx.fillStyle = '#010008';
      ctx.fillRect(0, 0, this._canvas.width / this._dpr, this._canvas.height / this._dpr);
    }

    // Reserve budget for always-draw systems (eyes + portals), then budget the rest.
    // Draw order is back-to-front (particles → connections → portals → eyes).
    // Priority under load: eyes (always) > portals (always) > connections > particles.
    const budget = this._budget;
    budget.beginFrame();
    let t0;

    // Particles — always draw every frame (no skip = no flicker).
    // When over budget, shadowBlur is dropped instead (flat particles, no pop).
    t0 = performance.now();
    this._particleSystem.draw(ctx, this._t, state, budget.canGlow());
    budget.record('particles', performance.now() - t0);

    // Connections — binary skip under load (thin lines, acceptable to drop).
    if (state.hasBooted && budget.canDraw('connections')) {
      t0 = performance.now();
      this._connectionSystem.draw(ctx, this._t, state, this._particleSystem.particles);
      budget.record('connections', performance.now() - t0);
    }

    // Portals — always draw, measure cost for next-frame budget reservation
    t0 = performance.now();
    this._portalSystem.draw(ctx, this._t, state);
    budget.record('portals', performance.now() - t0);

    // Eyes — always draw (highest priority), measure cost
    t0 = performance.now();
    const eyeAlpha = this._eyeSystem.draw(ctx, this._t, state);
    budget.record('eyes', performance.now() - t0);

    if (eyeAlpha !== null && !this._readyCalled && eyeAlpha > 0.95) {
      this._readyCalled = true;
      if (typeof this._opts.onReady === 'function') this._opts.onReady();
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  setEntityState(state) {
    if (['idle', 'thinking', 'speaking'].includes(state)) {
      this._eyeSystem.setEntityState(state);
      window.dispatchEvent(new CustomEvent('rabble:entity-state', { detail: { state } }));
    }
  }

  setEntropy(val) {
    this._entropy = Math.max(0, Math.min(1, val));
  }

  triggerBoot() { this._startBoot(); }

  injectEyeJolt(dx, dy) {
    this._eyeSystem.injectJolt(dx, dy);
  }

  pause() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  }

  resume() {
    if (!this._rafId) this._start();
  }

  resize() { this._preserveParticlesOnResize(); }

  dispose() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    window.removeEventListener('resize', this._resizeHandler);
    if (this._opts.interactive) this._eyeSystem.dispose();
  }

  getPerformanceMetrics() {
    return {
      fps:          this._fps,
      particles:    this._particleSystem.particles.length,
      links:        this._connectionSystem.links.length,
      adaptiveGlow: this._adaptiveGlow,
      entityState:  this._eyeSystem._entityState,
      budget:       this._budget.metrics,
      backend:      'Canvas2D',
    };
  }
}
