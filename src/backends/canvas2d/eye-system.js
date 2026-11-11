import { palette } from '../../puppet/palette.js';
import {
  EyeBehavior,
  EYE_W, EYE_H, EYE_GAP, BASE_Y_OFFSET,
  PORTAL_W, PORTAL_H, MAX_OFF, PORTAL_OFFSET_RATIO,
} from '../eye-behavior.js';

// Re-exported so portal-system.js (and any other Canvas2D consumer) keeps
// importing layout constants from eye-system.js — eye-behavior.js is the
// canonical source now, this module is the draw-time face of it.
export { EYE_W, EYE_H, EYE_GAP, BASE_Y_OFFSET, PORTAL_W, PORTAL_H, MAX_OFF, PORTAL_OFFSET_RATIO };

function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

/**
 * EyeSystem — Canvas2D draw layer.
 *
 * All gaze physics (saccades, spring pursuit, distraction drift, jolt,
 * blink FSM) live in `EyeBehavior` (`../eye-behavior.js`), shared with
 * ThreeJsBackend. This class owns only what's specific to Canvas2D:
 * drawing the orb/portal/halo/waveform shapes onto the entity + glow
 * canvases from the behavior's current gaze offset and blink state.
 */
export class EyeSystem {
  constructor({ canvas, cx, cy, bootSeq, glowScale, showWaveform }) {
    this._canvas       = canvas;
    this._cx           = cx;
    this._cy           = cy;
    this._bootSeq      = bootSeq;
    this._glowScale    = glowScale;
    this._showWaveform = showWaveform;
    this._entityState  = 'idle';

    this._behavior = new EyeBehavior({ canvas });

    this.cfg = {
      waveform: {
        idle:     { amplitude: 2.0, frequency: 0.09, speed: 0.005 },
        thinking: { amplitude: 4.5, frequency: 0.13, speed: 0.007 },
        speaking: { amplitude: 7.5, frequency: 0.20, speed: 0.011 },
      },
    };
  }

  setConfig(cfg) {
    if (!cfg) return;
    this._behavior.setConfig(cfg);
    if (cfg.waveform) {
      if (cfg.waveform.idle)     Object.assign(this.cfg.waveform.idle,     cfg.waveform.idle);
      if (cfg.waveform.thinking) Object.assign(this.cfg.waveform.thinking, cfg.waveform.thinking);
      if (cfg.waveform.speaking) Object.assign(this.cfg.waveform.speaking, cfg.waveform.speaking);
    }
  }

  getConfig() {
    return { ...this._behavior.getConfig(), waveform: JSON.parse(JSON.stringify(this.cfg.waveform)) };
  }

  get blinkMachine()    { return this._behavior.blinkMachine; }
  get eyeOpenProgress() { return this._behavior.eyeOpenProgress; }
  get blinkT()          { return this._behavior.blinkT; }

  resize(cx, cy) {
    this._cx = cx; this._cy = cy;
  }

  setEntityState(state) { this._entityState = state; this._behavior.setEntityState(state); }

  initBoot() { this._behavior.initBoot(); }

  setupMouseTracking() { this._behavior.setupMouseTracking(); }

  injectJolt(dx, dy) { this._behavior.injectJolt(dx, dy); }

  dispose() { this._behavior.dispose(); }

  update(t, state) {
    this._behavior.update(t, state, this._cx, this._cy);
  }

  // draw() — always runs (eyes are highest priority system).
  // glowCtx: CSS-blurred canvas for glow shapes; all shadowBlur eliminated.
  // Returns eyeAlpha so orchestrator can fire onReady callback.
  draw(ctx, t, state, glowCtx) {
    const { inBoot, bootSeq } = state;
    if (inBoot && bootSeq.timeline <= bootSeq.T_EYES_START) return null;

    const eyeAlpha    = inBoot ? Math.pow(easeInOut(bootSeq.getEyesProgress()), 0.45) : 1;
    const emergeScale = this._behavior.blinkMachine === 1 ? this._behavior.eyeOpenProgress : 1.0;
    const blinkScale  = (1 - this._behavior.blinkT * 0.93) * emergeScale;

    this._drawEyes(ctx, t, eyeAlpha, blinkScale, emergeScale, glowCtx);
    if (this._showWaveform && eyeAlpha > 0) this._drawWaveform(ctx, t, eyeAlpha * 0.92, glowCtx);

    return eyeAlpha;
  }

  _drawEyes(ctx, t, alpha, blinkScale, emergeScale, glowCtx) {
    const pW2   = PORTAL_W / 2, pH2 = PORTAL_H / 2;
    const eW2   = EYE_W / 2,    eH2 = EYE_H / 2;
    const baseY = this._cy + BASE_Y_OFFSET;
    const lx    = this._cx - EYE_GAP, rx = this._cx + EYE_GAP;
    const lpY   = baseY - EYE_H * PORTAL_OFFSET_RATIO, rpY = baseY + EYE_H * PORTAL_OFFSET_RATIO;
    const maxIrisX = Math.max(0, pW2 - eW2 * 0.55);
    const maxIrisY = Math.max(0, pH2 - 4);

    const cp = (ox, oy) => {
      const nx = ox / maxIrisX || 0, ny = oy / maxIrisY || 0;
      const d  = Math.sqrt(nx * nx + ny * ny);
      return d > 1 ? { x: (nx / d) * maxIrisX, y: (ny / d) * maxIrisY } : { x: ox, y: oy };
    };
    const eyeCurX = this._behavior.eyeCurX, eyeCurY = this._behavior.eyeCurY;
    const lC = cp(eyeCurX, eyeCurY);
    const rC = cp(eyeCurX, eyeCurY);
    const eb = easeInOut(emergeScale);

    const lOrbX = lx + lC.x * 0.7 * eb;
    const lOrbY = lpY + (baseY + lC.y * 0.5 * eb - lpY) * eb;
    const rOrbX = rx + rC.x * 0.7 * eb;
    const rOrbY = rpY + (baseY + rC.y * 0.5 * eb - rpY) * eb;

    ctx.globalAlpha = alpha;
    if (glowCtx) glowCtx.globalAlpha = alpha;
    this._drawOrb(ctx, t, lOrbX, lOrbY, blinkScale, palette.cyan,    lx, lpY, emergeScale, pW2, pH2, eW2, eH2, glowCtx);
    this._drawOrb(ctx, t, rOrbX, rOrbY, blinkScale, palette.magenta, rx, rpY, emergeScale, pW2, pH2, eW2, eH2, glowCtx);
    ctx.globalAlpha = 1;
    if (glowCtx) glowCtx.globalAlpha = 1;
  }

  _drawOrb(ctx, t, ox, oy, bs, col, portalX, portalY, emerge, pW2, pH2, eW2, eH2, glowCtx) {
    if (emerge < 0.98) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(portalX, portalY,
        PORTAL_W * 0.55 + PORTAL_W * 0.45 * easeInOut(emerge),
        pH2 + EYE_H * easeInOut(emerge), 0, 0, Math.PI * 2);
      ctx.clip();
    }

    // Halo gradient (radial fill — cheap, no blur needed)
    const haloSize = EYE_H * (0.55 + 0.08 * Math.sin(t * 0.022));
    const hg = ctx.createRadialGradient(ox, oy, 2, ox, oy, haloSize);
    hg.addColorStop(0, col + '38'); hg.addColorStop(1, 'transparent');
    ctx.beginPath(); ctx.ellipse(ox, oy, haloSize, haloSize, 0, 0, Math.PI * 2);
    ctx.fillStyle = hg; ctx.fill();

    // Crisp eye shape on entity canvas — NO shadowBlur
    ctx.save(); ctx.translate(ox, oy); ctx.scale(1, bs);
    ctx.beginPath(); ctx.ellipse(0, 0, eW2, eH2, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f8faff';
    ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Glow on CSS-blurred canvas — shapes drawn slightly larger to compensate for 8px blur spread.
    // Keep shapes tight to the eye outline so they don't bleed into the portal socket area.
    if (glowCtx) {
      glowCtx.save(); glowCtx.translate(ox, oy); glowCtx.scale(1, bs);
      // Subtle white glow fill
      glowCtx.beginPath(); glowCtx.ellipse(0, 0, eW2 + 4, eH2 + 7, 0, 0, Math.PI * 2);
      glowCtx.fillStyle = 'rgba(220,235,255,0.22)';
      glowCtx.fill();
      // Colored outline glow — thin, stays close to eye edge
      glowCtx.beginPath(); glowCtx.ellipse(0, 0, eW2, eH2, 0, 0, Math.PI * 2);
      glowCtx.strokeStyle = col; glowCtx.lineWidth = 6;
      glowCtx.globalAlpha = 0.4;
      glowCtx.stroke();
      glowCtx.globalAlpha = 1;
      glowCtx.restore();
    }

    if (emerge < 0.98) ctx.restore();
  }

  _drawWaveform(ctx, t, alpha, glowCtx) {
    const breathe = 1.2 + 0.8 * Math.sin(t * 0.018);
    const wfState = this.cfg.waveform[this._entityState] || this.cfg.waveform.idle;
    const amp  = wfState.amplitude * breathe;
    const freq = wfState.frequency;
    const spd  = wfState.speed;
    const wy = this._cy + 68, wx0 = this._cx - 64, wx1 = this._cx + 64;

    [[palette.magenta, 0], [palette.cyan, Math.PI]].forEach(([col, ph]) => {
      const buildPath = (c) => {
        c.beginPath();
        for (let x = wx0; x <= wx1; x += 2) {
          const frac = (x - wx0) / (wx1 - wx0);
          const y    = wy + amp * Math.sin(freq * (x - wx0) + t * spd * 60 + ph) * Math.sin(frac * Math.PI);
          x === wx0 ? c.moveTo(x, y) : c.lineTo(x, y);
        }
      };

      // Crisp line on entity canvas — no shadowBlur
      ctx.globalAlpha = alpha;
      buildPath(ctx);
      ctx.strokeStyle = col; ctx.lineWidth = 1.9;
      ctx.stroke();

      // Glow line on CSS-blurred canvas
      if (glowCtx) {
        glowCtx.globalAlpha = alpha * 0.7;
        buildPath(glowCtx);
        glowCtx.strokeStyle = col; glowCtx.lineWidth = 7;
        glowCtx.stroke();
        glowCtx.globalAlpha = 1;
      }
    });
    ctx.globalAlpha = 1;
  }

}
