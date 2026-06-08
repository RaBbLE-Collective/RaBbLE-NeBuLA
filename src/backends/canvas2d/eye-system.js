import { palette } from '../../puppet/palette.js';

// Layout constants shared with PortalSystem — proportions matched to RaBbLE4K.png
// reference (eye W:H:gap ≈ 121:445:257 → tall narrow ovals close together; portals
// are equal-size flattened ellipses, cyan above the left eye, magenta below the right)
export const EYE_W = 38, EYE_H = 110, EYE_GAP = 36, BASE_Y_OFFSET = -6;
export const PORTAL_W = 90, PORTAL_H = 28, MAX_OFF = 13;

const MOUSE_NEAR_DIST = 600;

function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

export class EyeSystem {
  constructor({ canvas, cx, cy, bootSeq, glowScale, showWaveform }) {
    this._canvas       = canvas;
    this._cx           = cx;
    this._cy           = cy;
    this._bootSeq      = bootSeq;
    this._glowScale    = glowScale;
    this._showWaveform = showWaveform;
    this._entityState  = 'idle';

    // Blink FSM: 0=wait, 1=opening, 2=burst, 3=normal
    this._blinkMachine    = 3;
    this._blinkT          = 0;
    this._blinkPhase      = 0;
    this._nextBlink       = 100 + Math.random() * 150;
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
    this._nextDistraction  = 120 + Math.random() * 180;

    this._mouseX = -9999; this._mouseY = -9999;
  }

  get blinkMachine()    { return this._blinkMachine; }
  get eyeOpenProgress() { return this._eyeOpenProgress; }
  get blinkT()          { return this._blinkT; }

  resize(cx, cy) {
    this._cx = cx; this._cy = cy;
  }

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
      const rect = this._canvas.getBoundingClientRect();
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

  update(t, state) {
    this._updateEyeTarget(t);
    this._updateBlinkMachine(t, state);
  }

  _updateEyeTarget(t) {
    const SACC = [
      [0.95, 0.0, 'hard'], [-0.95, 0.0, 'hard'], [0.0, 0.85, 'hard'], [0.0, -0.85, 'hard'],
      [0.75, 0.65, 'med'],  [-0.75, 0.65, 'med'],  [0.75, -0.55, 'med'], [-0.75, -0.55, 'med'],
      [0.55, 0.0, 'soft'],  [-0.55, 0.0, 'soft'],  [0.0,  0.5,  'soft'], [0.0,  -0.5,  'soft'],
      [0.35, 0.3, 'soft'],  [-0.35, -0.3, 'soft'],  [0.4,  0.55, 'soft'], [-0.4,  0.55, 'soft'],
      [0.0, 0.0, 'soft'], [0.0, 0.0, 'soft'], [0.0, 0.0, 'soft'],
    ];

    if (t > this._holdUntil && t > this._nextSaccade) {
      const item = SACC[Math.floor(Math.random() * SACC.length)];
      const kind = item[2];
      this._saccadeX = item[0]; this._saccadeY = item[1];
      const hd = kind === 'hard' ? 25 + Math.random() * 35 : kind === 'med' ? 45 + Math.random() * 55 : 65 + Math.random() * 80;
      const gd = kind === 'hard' ? 8  + Math.random() * 18 : kind === 'med' ? 20 + Math.random() * 40 : 40 + Math.random() * 70;
      this._holdUntil = t + hd; this._nextSaccade = this._holdUntil + gd;
    }

    if (this._joltDecay > 0.01) { this._joltDecay *= 0.94; } else { this._joltX = 0; this._joltY = 0; this._joltDecay = 0; }
    if (this._snapDecay > 0.01) { this._snapDecay *= 0.92; } else { this._snapX = 0; this._snapY = 0; this._snapDecay = 0; }

    if (t > this._nextDistraction) {
      const da = Math.random() * Math.PI * 2, reach = 0.45 + Math.random() * 0.55;
      this._distractX = Math.cos(da) * MAX_OFF * reach;
      this._distractY = Math.sin(da) * MAX_OFF * 0.72 * reach;
      this._distractReturnAt = t + 55 + Math.random() * 105;
      this._nextDistraction  = this._distractReturnAt + 170 + Math.random() * 300;
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
      rawX = this._saccadeX * MAX_OFF + d1x + trX + this._distractCurX + this._snapX * this._snapDecay + this._joltX * MAX_OFF * 2.5 * this._joltDecay;
      rawY = this._saccadeY * MAX_OFF * 0.65 + d1y + trY + this._distractCurY + this._snapY * this._snapDecay + this._joltY * MAX_OFF * 1.6 * this._joltDecay;
    }

    const spring = mouseNear ? 0.14 : 0.10;
    this._eyeVelX = (this._eyeVelX + (rawX - this._eyeCurX) * spring) * 0.72;
    this._eyeVelY = (this._eyeVelY + (rawY - this._eyeCurY) * spring) * 0.72;
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
        this._nextBlink = t + 100 + Math.random() * 150;
      }
    }
  }

  // draw() — always runs (eyes are highest priority system).
  // glowCtx: CSS-blurred canvas for glow shapes; all shadowBlur eliminated.
  // Returns eyeAlpha so orchestrator can fire onReady callback.
  draw(ctx, t, state, glowCtx) {
    const { inBoot, bootSeq } = state;
    if (inBoot && bootSeq.timeline <= bootSeq.T_EYES_START) return null;

    const eyeAlpha    = inBoot ? Math.pow(easeInOut(bootSeq.getEyesProgress()), 0.45) : 1;
    const emergeScale = this._blinkMachine === 1 ? this._eyeOpenProgress : 1.0;
    const blinkScale  = (1 - this._blinkT * 0.93) * emergeScale;

    this._drawEyes(ctx, t, eyeAlpha, blinkScale, emergeScale, glowCtx);
    if (this._showWaveform && eyeAlpha > 0) this._drawWaveform(ctx, t, eyeAlpha * 0.92, glowCtx);

    return eyeAlpha;
  }

  _drawEyes(ctx, t, alpha, blinkScale, emergeScale, glowCtx) {
    const pW2   = PORTAL_W / 2, pH2 = PORTAL_H / 2;
    const eW2   = EYE_W / 2,    eH2 = EYE_H / 2;
    const baseY = this._cy + BASE_Y_OFFSET;
    const lx    = this._cx - EYE_GAP, rx = this._cx + EYE_GAP;
    const lpY   = baseY - EYE_H * 0.44, rpY = baseY + EYE_H * 0.44;
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
    const haloSize = EYE_H * (0.80 + 0.12 * Math.sin(t * 0.022));
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

    // Glow on CSS-blurred canvas — shapes drawn larger to compensate for 8px blur spread
    // Compositor handles the blur on its own thread; zero JS/Skia cost.
    if (glowCtx) {
      glowCtx.save(); glowCtx.translate(ox, oy); glowCtx.scale(1, bs);
      // White glow fill (oversized so CSS blur spreads it into a halo)
      glowCtx.beginPath(); glowCtx.ellipse(0, 0, eW2 + 8, eH2 + 14, 0, 0, Math.PI * 2);
      glowCtx.fillStyle = 'rgba(220,235,255,0.5)';
      glowCtx.fill();
      // Colored stroke glow
      glowCtx.beginPath(); glowCtx.ellipse(0, 0, eW2, eH2, 0, 0, Math.PI * 2);
      glowCtx.strokeStyle = col; glowCtx.lineWidth = 10;
      glowCtx.globalAlpha = 0.65;
      glowCtx.stroke();
      glowCtx.globalAlpha = 1;
      glowCtx.restore();
    }

    if (emerge < 0.98) ctx.restore();
  }

  _drawWaveform(ctx, t, alpha, glowCtx) {
    const breathe = 1.2 + 0.8 * Math.sin(t * 0.018);
    const amp  = (this._entityState === 'speaking' ? 7.5 : this._entityState === 'thinking' ? 4.5 : 2.0) * breathe;
    const freq = this._entityState === 'speaking' ? 0.2 : this._entityState === 'thinking' ? 0.13 : 0.09;
    const spd  = this._entityState === 'speaking' ? 0.011 : this._entityState === 'thinking' ? 0.007 : 0.005;
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
