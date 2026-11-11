/**
 * eye-behavior.js — the RaBbLE entity's shared "soul"
 *
 * One personality, two bodies. This module holds every constant and every
 * piece of physics/FSM logic that makes the entity's gaze read as alive:
 * the saccade target table, spring-damped pursuit, distraction drift,
 * jolt-on-click, and the 4-state burst-blink rhythm. It knows nothing about
 * Canvas2D or Three.js — it just tracks two numbers (eye offset x/y) and a
 * blink phase over time, in DOM-pixel-equivalent units.
 *
 * Ported from `canvas2d/eye-system.js` (the original, still-canonical
 * implementation) so Canvas2dBackend and ThreeJsBackend consume the exact
 * same behavior instead of drifting into two different creatures. Canvas2D
 * keeps its own EyeSystem as a thin wrapper (draw-only) around an
 * EyeBehavior instance; ThreeJsBackend consumes EyeBehavior directly.
 *
 * Geometry constants here are the canonical proportions — the visual spec
 * (`RaBbLE-Aether/RaBbLE-Entity-Visual-Spec.md`) and any other backend
 * should treat these as ground truth, scaled to their own coordinate space.
 */

// Layout constants — proportions matched to RaBbLE4K.png reference (eye
// W:H:gap ≈ 121:445:257 → tall narrow ovals close together; portals are
// equal-size flattened ellipses, one hung above its eye, one below).
export const EYE_W = 38, EYE_H = 110, EYE_GAP = 36, BASE_Y_OFFSET = -6;
export const PORTAL_W = 90, PORTAL_H = 28, MAX_OFF = 13;

// Fraction of the eye's FULL height that a portal is offset from the shared
// orb centerline. One eye's portal sits below by this much, the other
// above — this is what makes the pairing read as two mismatched sockets
// rather than a symmetric cartoon face. Never make this 0 or make both
// portals use the same sign.
export const PORTAL_OFFSET_RATIO = 0.44;

const MOUSE_NEAR_DIST = 600;

function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

// Saccade target table: [x, y, weight-class]. Coordinates are fractions of
// MAX_OFF (roughly -1..1), weight-class controls hold/gap duration and how
// often 'calm'/'alert'/'chaotic' saccade modes pick this entry.
const SACC = [
  [0.95, 0.0, 'hard'], [-0.95, 0.0, 'hard'], [0.0, 0.85, 'hard'], [0.0, -0.85, 'hard'],
  [0.75, 0.65, 'med'],  [-0.75, 0.65, 'med'],  [0.75, -0.55, 'med'], [-0.75, -0.55, 'med'],
  [0.55, 0.0, 'soft'],  [-0.55, 0.0, 'soft'],  [0.0,  0.5,  'soft'], [0.0,  -0.5,  'soft'],
  [0.35, 0.3, 'soft'],  [-0.35, -0.3, 'soft'],  [0.4,  0.55, 'soft'], [-0.4,  0.55, 'soft'],
  [0.0, 0.0, 'soft'], [0.0, 0.0, 'soft'], [0.0, 0.0, 'soft'],
];

export class EyeBehavior {
  /** @param {{ canvas?: HTMLCanvasElement }} [opts] canvas is only used for
   *  mouse-proximity math (getBoundingClientRect) and click coordinates —
   *  purely optional plumbing, not a rendering dependency. */
  constructor(opts = {}) {
    this._canvas = opts.canvas || null;
    this._entityState = 'idle';

    this.cfg = {
      saccadeMode: 'normal',       // 'calm' | 'normal' | 'alert' | 'chaotic'
      blinkIntervalFrames: 100,    // base blink interval (added to rand(0-150))
      distractionFreqFrames: 120,  // base distraction interval (added to rand(0-180))
      joltDecay: 0.94,             // per-frame jolt decay factor
      snapDecay: 0.92,             // per-frame snap decay factor
      springStrength: 0.12,        // eye spring pull to target
      dampingFactor: 0.72,         // velocity damping
    };

    // Blink FSM: 0=wait, 1=opening, 2=burst, 3=normal
    this._blinkMachine    = 3;
    this._blinkT          = 0;
    this._blinkPhase      = 0;
    this._nextBlink       = this.cfg.blinkIntervalFrames + Math.random() * 150;
    this._eyeOpenProgress = 1;
    this._burstCount      = 0;
    this._burstGap        = 8;

    // Eye physics
    this._eyeCurX = 0; this._eyeCurY = 0;
    this._eyeVelX = 0; this._eyeVelY = 0;
    this._joltX   = 0; this._joltY   = 0; this._joltDecay  = 0;
    this._snapX   = 0; this._snapY   = 0; this._snapDecay  = 0;
    this._saccadeX = 0; this._saccadeY = 0;
    this._holdUntil = 0; this._nextSaccade = 0;
    this._distractX    = 0; this._distractY    = 0;
    this._distractCurX = 0; this._distractCurY = 0;
    this._distractVelX = 0; this._distractVelY = 0;
    this._distractReturnAt = 0;
    this._nextDistraction  = this.cfg.distractionFreqFrames + Math.random() * 180;

    this._mouseX = -9999; this._mouseY = -9999;
  }

  attachCanvas(canvas) { this._canvas = canvas; }

  setConfig(cfg) {
    if (!cfg) return;
    if (cfg.saccadeMode !== undefined) this.cfg.saccadeMode = cfg.saccadeMode;
    if (cfg.blinkIntervalFrames !== undefined) this.cfg.blinkIntervalFrames = cfg.blinkIntervalFrames;
    if (cfg.distractionFreqFrames !== undefined) this.cfg.distractionFreqFrames = cfg.distractionFreqFrames;
    if (cfg.joltDecay !== undefined) this.cfg.joltDecay = cfg.joltDecay;
    if (cfg.snapDecay !== undefined) this.cfg.snapDecay = cfg.snapDecay;
    if (cfg.springStrength !== undefined) this.cfg.springStrength = cfg.springStrength;
    if (cfg.dampingFactor !== undefined) this.cfg.dampingFactor = cfg.dampingFactor;
  }

  getConfig() {
    return JSON.parse(JSON.stringify(this.cfg));
  }

  _getSaccadeDistribution(sacc) {
    const mode = this.cfg.saccadeMode;
    if (mode === 'calm') {
      return sacc.filter(function(item) { return item[2] === 'soft'; });
    }
    if (mode === 'alert') {
      const hardMed = sacc.filter(function(item) { return item[2] === 'hard' || item[2] === 'med'; });
      const soft    = sacc.filter(function(item) { return item[2] === 'soft'; });
      const pool = [];
      for (let i = 0; i < 4; i++) { for (let j = 0; j < hardMed.length; j++) pool.push(hardMed[j]); }
      for (let j = 0; j < soft.length; j++) pool.push(soft[j]);
      return pool;
    }
    if (mode === 'chaotic') {
      return sacc.filter(function(item) { return item[2] === 'hard'; });
    }
    return sacc;
  }

  get blinkMachine()    { return this._blinkMachine; }
  get eyeOpenProgress() { return this._eyeOpenProgress; }
  get blinkT()          { return this._blinkT; }
  get eyeCurX()         { return this._eyeCurX; }
  get eyeCurY()         { return this._eyeCurY; }

  setEntityState(state) { this._entityState = state; }

  initBoot() {
    this._blinkMachine    = 0;
    this._blinkPhase      = 0;
    this._blinkT          = 0;
    this._burstCount      = 0;
    this._burstGap        = 8;
    this._nextBlink       = 99999;
    this._eyeOpenProgress = 0;
  }

  setupMouseTracking() {
    this._onMouseMove = (e) => { this._mouseX = e.clientX; this._mouseY = e.clientY; };
    this._onClick     = (e) => {
      const rect = this._canvas ? this._canvas.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
      const mx   = e.clientX - rect.left - rect.width / 2;
      const my   = e.clientY - rect.top  - rect.height / 2;
      const ang  = Math.atan2(my, mx), str = Math.min(Math.hypot(mx, my) / 220, 1);
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

  injectJolt(dx, dy) {
    this._joltX = Math.max(-1, Math.min(1, dx));
    this._joltY = Math.max(-1, Math.min(1, dy));
    this._joltDecay = 1.0;
  }

  dispose() {
    if (this._onMouseMove) window.removeEventListener('mousemove', this._onMouseMove);
    if (this._onClick)     window.removeEventListener('click',     this._onClick);
  }

  /**
   * Advance gaze physics + blink FSM by one frame tick.
   * @param {number} t - monotonically increasing frame counter (1 per frame, ~60/s)
   * @param {{inBoot:boolean, bootSeq:import('../core/boot-sequence.js').BootSequence}} state
   * @param {number} cx - entity center x, in the same coordinate space as the
   *   canvas passed to setupMouseTracking (client px relative to viewport)
   * @param {number} cy - entity center y, same space
   */
  update(t, state, cx, cy) {
    this._updateEyeTarget(t, cx, cy);
    this._updateBlinkMachine(t, state);
  }

  _updateEyeTarget(t, cx, cy) {
    if (t > this._holdUntil && t > this._nextSaccade) {
      const pool = this._getSaccadeDistribution(SACC);
      const item = pool[Math.floor(Math.random() * pool.length)];
      const kind = item[2];
      this._saccadeX = item[0]; this._saccadeY = item[1];
      const chaotic = this.cfg.saccadeMode === 'chaotic';
      const hd = chaotic ? 8 + Math.random() * 12 : kind === 'hard' ? 25 + Math.random() * 35 : kind === 'med' ? 45 + Math.random() * 55 : 65 + Math.random() * 80;
      const gd = chaotic ? 2 + Math.random() * 6  : kind === 'hard' ? 8  + Math.random() * 18 : kind === 'med' ? 20 + Math.random() * 40 : 40 + Math.random() * 70;
      this._holdUntil = t + hd; this._nextSaccade = this._holdUntil + gd;
    }

    if (this._joltDecay > 0.01) { this._joltDecay *= this.cfg.joltDecay; } else { this._joltX = 0; this._joltY = 0; this._joltDecay = 0; }
    if (this._snapDecay > 0.01) { this._snapDecay *= this.cfg.snapDecay; } else { this._snapX = 0; this._snapY = 0; this._snapDecay = 0; }

    if (t > this._nextDistraction) {
      const da = Math.random() * Math.PI * 2, reach = 0.45 + Math.random() * 0.55;
      this._distractX = Math.cos(da) * MAX_OFF * reach;
      this._distractY = Math.sin(da) * MAX_OFF * 0.72 * reach;
      this._distractReturnAt = t + 55 + Math.random() * 105;
      this._nextDistraction  = this._distractReturnAt + this.cfg.distractionFreqFrames + Math.random() * 180;
    }
    if (this._distractReturnAt && t > this._distractReturnAt) { this._distractX = 0; this._distractY = 0; }
    const ds = this._distractReturnAt && t <= this._distractReturnAt ? 0.018 : 0.026;
    this._distractVelX = (this._distractVelX + (this._distractX - this._distractCurX) * ds) * 0.9;
    this._distractVelY = (this._distractVelY + (this._distractY - this._distractCurY) * ds) * 0.9;
    this._distractCurX += this._distractVelX; this._distractCurY += this._distractVelY;

    const d1x = Math.sin(t * 0.019) * 2.6 + Math.sin(t * 0.043) * 1.1;
    const d1y = Math.cos(t * 0.015) * 1.8 + Math.cos(t * 0.037) * 0.9;
    const trX = Math.sin(t * 0.11) * 0.35 + Math.sin(t * 0.17) * 0.2;
    const trY = Math.cos(t * 0.09) * 0.25 + Math.cos(t * 0.21) * 0.15;

    let mx = 0, my = 0, dist = Infinity, mouseNear = false;
    if (this._mouseX > -9000) {
      const rect = this._canvas ? this._canvas.getBoundingClientRect() : { left: 0, top: 0 };
      mx = this._mouseX - rect.left - cx;
      my = this._mouseY - rect.top  - cy;
      dist = Math.hypot(mx, my);
      mouseNear = dist < MOUSE_NEAR_DIST;
    }

    let rawX, rawY;
    if (mouseNear) {
      const ang = Math.atan2(my, mx), str = Math.min(dist / 220, 1);
      rawX = Math.cos(ang) * MAX_OFF * str * 0.48 + this._saccadeX * MAX_OFF * 0.42 + d1x + trX + this._distractCurX * 0.9 + this._snapX * this._snapDecay;
      rawY = Math.sin(ang) * MAX_OFF * 0.65 * str * 0.48 + this._saccadeY * MAX_OFF * 0.65 * 0.42 + d1y + trY + this._distractCurY * 0.9 + this._snapY * this._snapDecay;
    } else {
      rawX = this._saccadeX * MAX_OFF + d1x + trX + this._distractCurX + this._snapX * this._snapDecay + this._joltX * MAX_OFF * 2.5 * this._joltDecay;
      rawY = this._saccadeY * MAX_OFF * 0.65 + d1y + trY + this._distractCurY + this._snapY * this._snapDecay + this._joltY * MAX_OFF * 1.6 * this._joltDecay;
    }

    const spring = mouseNear ? this.cfg.springStrength * 1.167 : this.cfg.springStrength * 0.833;
    this._eyeVelX = (this._eyeVelX + (rawX - this._eyeCurX) * spring) * this.cfg.dampingFactor;
    this._eyeVelY = (this._eyeVelY + (rawY - this._eyeCurY) * spring) * this.cfg.dampingFactor;
    this._eyeCurX += this._eyeVelX; this._eyeCurY += this._eyeVelY;
  }

  _updateBlinkMachine(t, state) {
    const { inBoot, bootSeq } = state;
    if (this._blinkMachine === 0 && (!inBoot || bootSeq.timeline > bootSeq.T_EYES_START)) {
      this._blinkMachine = 1;
    }
    if (this._blinkMachine === 1) {
      this._eyeOpenProgress = easeInOut(bootSeq.getEyeOpenProgress());
      if (this._eyeOpenProgress >= 0.98) {
        this._eyeOpenProgress = 1; this._blinkMachine = 2;
        this._burstCount = 0; this._burstGap = 8;
        this._nextBlink = t + bootSeq.BLINK_HOLD_AFTER_OPEN;
      }
    }
    if (this._blinkMachine === 2 && t > this._nextBlink) {
      this._blinkPhase += 0.52;
      this._blinkT = Math.max(0, Math.min(1, Math.abs(Math.sin(this._blinkPhase * Math.PI))));
      if (this._blinkPhase >= 1) {
        this._blinkPhase = 0; this._blinkT = 0; this._burstCount++;
        this._burstGap = this._burstGap * 1.55 + Math.random() * 8;
        if (this._burstCount >= bootSeq.BURST_TOTAL) {
          this._blinkMachine = 3;
          this._nextBlink = t + bootSeq.BLINK_DELAY_AFTER_BURSTS + Math.random() * 60;
        } else {
          this._nextBlink = t + this._burstGap;
        }
      }
    }
    if (this._blinkMachine === 3 && t > this._nextBlink) {
      this._blinkPhase += 0.20;
      this._blinkT = Math.max(0, Math.min(1, Math.abs(Math.sin(this._blinkPhase * Math.PI))));
      if (this._blinkPhase >= 1) {
        this._blinkPhase = 0; this._blinkT = 0;
        this._nextBlink = t + this.cfg.blinkIntervalFrames + Math.random() * 150;
      }
    }
  }
}
