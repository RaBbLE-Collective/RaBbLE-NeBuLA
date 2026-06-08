import { palette } from '../../puppet/palette.js';
import { PORTAL_W, PORTAL_H, EYE_GAP, BASE_Y_OFFSET, EYE_H } from './eye-system.js';

function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
function clamp01(v)   { return Math.max(0, Math.min(1, v)); }

export class PortalSystem {
  constructor({ glowScale }) {
    this._glowScale = glowScale;
    this._cx = 0; this._cy = 0;
  }

  resize(cx, cy) {
    this._cx = cx; this._cy = cy;
  }

  update() {}

  // draw() — can be deferred by FrameBudget (priority: after eyes, before connections)
  draw(ctx, t, state) {
    const { inBoot, bootSeq } = state;
    if (inBoot && bootSeq.timeline <= bootSeq.T_PORTALS_START) return;

    const drawProgress = inBoot ? bootSeq.getPortalProgress() : 1;
    const pW2   = PORTAL_W / 2, pH2 = PORTAL_H / 2;
    const lx    = this._cx - EYE_GAP, rx = this._cx + EYE_GAP;
    const baseY = this._cy + BASE_Y_OFFSET;
    // Reference portrait: cyan (left) eye's portal sits above it, magenta (right) eye's below
    const lpY   = baseY - EYE_H * 0.44, rpY = baseY + EYE_H * 0.44;
    const p     = easeInOut(drawProgress);
    this._drawPortalArc(ctx, t, lx, lpY, palette.cyan,    pW2, pH2, clamp01(p * 1.15));
    this._drawPortalArc(ctx, t, rx, rpY, palette.magenta, pW2, pH2, clamp01((p - 0.08) * 1.15));
  }

  _drawPortalArc(ctx, t, px, py, col, pW2, pH2, frac) {
    const grd = ctx.createRadialGradient(px, py, 0, px, py, pW2);
    grd.addColorStop(0, '#010108'); grd.addColorStop(0.65, '#05050e'); grd.addColorStop(1, 'rgba(1,1,8,0)');
    ctx.beginPath(); ctx.ellipse(px, py, pW2, pH2, 0, 0, Math.PI * 2);
    ctx.fillStyle = grd; ctx.fill();
    if (frac <= 0) return;

    const glowBase = frac >= 1 ? 12 + 8 * Math.sin(t * 0.035) : 14 + 8 * Math.sin(t * 0.04);
    ctx.beginPath();
    const steps = Math.ceil(frac * 80) + 1;
    for (let s = 0; s <= steps; s++) {
      const ang = -Math.PI / 2 + (s / steps) * frac * Math.PI * 2;
      const ex  = px + pW2 * Math.cos(ang), ey = py + pH2 * Math.sin(ang);
      s === 0 ? ctx.moveTo(ex, ey) : ctx.lineTo(ex, ey);
    }
    ctx.strokeStyle = col; ctx.lineWidth = 1.8;
    ctx.shadowColor = col; ctx.shadowBlur = glowBase * this._glowScale;
    ctx.stroke(); ctx.shadowBlur = 0;

    if (frac < 1) {
      const ae = -Math.PI / 2 + frac * Math.PI * 2;
      const xe = px + pW2 * Math.cos(ae), ye = py + pH2 * Math.sin(ae);
      ctx.beginPath(); ctx.arc(xe, ye, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0;
    }
  }

  dispose() {}
}
