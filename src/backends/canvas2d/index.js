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
    if (!opts.fieldCanvas) throw new Error('Canvas2dBackend requires opts.fieldCanvas');

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

    // Entity layer (eyes, portals) — top canvas, always drawn first every
    // frame so a heavy field-layer frame can never delay or skip the eyes.
    this._canvas      = canvas;
    this._ctx         = canvas.getContext('2d');

    // Field layer (particles, connections) — bottom canvas, the CPU-heavy
    // and throttle-able half of the scene. Composited under the entity layer
    // by the browser (CSS stacking), so it can be skipped or fall behind
    // without ever corrupting or delaying the eyes.
    this._fieldCanvas = opts.fieldCanvas;
    this._fieldCtx    = this._fieldCanvas.getContext('2d');

    // Glow layer — DOM canvas with CSS filter:blur set by element.js. Optional:
    // if absent (standalone use), ParticleSystem falls back to offscreen composite.
    this._glowCanvas  = opts.glowCanvas ?? null;

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
      glowCanvas: this._glowCanvas,
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
    const w = Math.max(1, rect.width)  * this._dpr;
    const h = Math.max(1, rect.height) * this._dpr;
    this._canvas.width       = w;
    this._canvas.height      = h;
    this._fieldCanvas.width  = w;
    this._fieldCanvas.height = h;
    if (this._glowCanvas) {
      this._glowCanvas.width  = w;
      this._glowCanvas.height = h;
    }
    this._cx = w / (2 * this._dpr);
    this._cy = h * 0.47 / this._dpr;
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
      if (!this._budget.shouldSkipFieldUpdate()) {
        this._particleSystem.update(this._t, state);
      }

      this._draw(state);
      this._rafId = requestAnimationFrame(frame);
    };
    this._rafId = requestAnimationFrame(frame);
  }

  // ── Draw ───────────────────────────────────────────────────────────────────

  _draw(state) {
    const budget = this._budget;
    budget.beginFrame();
    let t0;

    // ── Entity layer — eyes + portals, drawn FIRST to its own canvas. ────────
    // Always runs, every frame, before the field layer gets a chance to spend
    // any time. The browser composites the two canvases on the GPU, so this
    // layer's correctness and cadence no longer depend on field-layer cost —
    // a slow particle frame can delay or be skipped without ever touching it.
    const ectx = this._ctx;
    ectx.setTransform(1, 0, 0, 1, 0, 0);
    ectx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    ectx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);

    t0 = performance.now();
    this._portalSystem.draw(ectx, this._t, state);
    budget.record('portals', performance.now() - t0);

    t0 = performance.now();
    const eyeAlpha = this._eyeSystem.draw(ectx, this._t, state);
    budget.record('eyes', performance.now() - t0);

    if (eyeAlpha !== null && !this._readyCalled && eyeAlpha > 0.95) {
      this._readyCalled = true;
      if (typeof this._opts.onReady === 'function') this._opts.onReady();
    }

    // ── Field layer — particles + connections, the CPU-heavy half. ───────────
    // Gated as a whole: when the EMA-predicted cost would blow the frame
    // budget, the entire layer is skipped for up to 2 consecutive frames and
    // simply holds its last-painted content (a separate composited canvas, so
    // this never corrupts or delays the entity layer above it).
    if (budget.canDraw('field', 2)) {
      const fctx = this._fieldCtx;
      const t1   = performance.now();

      fctx.setTransform(1, 0, 0, 1, 0, 0);
      fctx.clearRect(0, 0, this._fieldCanvas.width, this._fieldCanvas.height);
      fctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);

      if (!this._opts.transparent) {
        fctx.fillStyle = '#010008';
        fctx.fillRect(0, 0, this._fieldCanvas.width / this._dpr, this._fieldCanvas.height / this._dpr);
      }

      // Particles — always draw when the layer runs (no skip = no flicker).
      // When over budget, shadowBlur is dropped instead (flat particles, no pop).
      t0 = performance.now();
      this._particleSystem.draw(fctx, this._t, state, budget.canGlow());
      budget.record('particles', performance.now() - t0);

      // Connections — binary skip under load (thin lines, acceptable to drop).
      if (state.hasBooted && budget.canDraw('connections')) {
        t0 = performance.now();
        this._connectionSystem.draw(fctx, this._t, state, this._particleSystem.particles);
        budget.record('connections', performance.now() - t0);
      }

      budget.record('field', performance.now() - t1);
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
