import { palette } from '../../puppet/palette.js';
import { PORTAL_W, PORTAL_H, EYE_GAP, BASE_Y_OFFSET, EYE_H } from './eye-system.js';

function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
function clamp01(v)   { return Math.max(0, Math.min(1, v)); }

export class PortalSystem {
  constructor({ glowScale }) {
    this._glowScale = glowScale;
    this._cx = 0; this._cy = 0;
    this.visible = true;
  }

  resize(cx, cy) {
    this._cx = cx; this._cy = cy;
  }

  update() {}

  draw(ctx, t, state, glowCtx) {
    if (!this.visible) return;
    const { inBoot, bootSeq } = state;
    if (inBoot && bootSeq.timeline <= bootSeq.T_PORTALS_START) return;

    const drawProgress = inBoot ? bootSeq.getPortalProgress() : 1;
    const pW2   = PORTAL_W / 2, pH2 = PORTAL_H / 2;
    const lx    = this._cx - EYE_GAP, rx = this._cx + EYE_GAP;
    const baseY = this._cy + BASE_Y_OFFSET;
    const lpY   = baseY - EYE_H * 0.44, rpY = baseY + EYE_H * 0.44;
    const p     = easeInOut(drawProgress);
    this._drawPortalArc(ctx, t, lx, lpY, palette.cyan,    pW2, pH2, clamp01(p * 1.15),          glowCtx);
    this._drawPortalArc(ctx, t, rx, rpY, palette.magenta, pW2, pH2, clamp01((p - 0.08) * 1.15), glowCtx);
  }

  _drawPortalArc(ctx, t, px, py, col, pW2, pH2, frac, glowCtx) {
    // Opaque dark fill inside portal — blocks glowCanvas from showing through.
    // Opaque edge is intentional: prevents glow bleed coloring the socket interior.
    const grd = ctx.createRadialGradient(px, py, 0, px, py, pW2);
    grd.addColorStop(0, '#000000'); grd.addColorStop(0.7, '#010108'); grd.addColorStop(1, '#010008');
    ctx.beginPath(); ctx.ellipse(px, py, pW2, pH2, 0, 0, Math.PI * 2);
    ctx.fillStyle = grd; ctx.fill();
    if (frac <= 0) return;

    // Arc path — reused for both ctx and glowCtx
    const steps = Math.ceil(frac * 80) + 1;
    const buildArc = (c) => {
      c.beginPath();
      for (let s = 0; s <= steps; s++) {
        const ang = -Math.PI / 2 + (s / steps) * frac * Math.PI * 2;
        const ex  = px + pW2 * Math.cos(ang), ey = py + pH2 * Math.sin(ang);
        s === 0 ? c.moveTo(ex, ey) : c.lineTo(ex, ey);
      }
    };

    // Crisp arc on entity canvas — no shadowBlur
    buildArc(ctx);
    ctx.strokeStyle = col; ctx.lineWidth = 1.8;
    ctx.stroke();

    // Thin glow arc — narrow lineWidth limits bleed into portal interior
    if (glowCtx) {
      buildArc(glowCtx);
      glowCtx.strokeStyle = col; glowCtx.lineWidth = 4;
      glowCtx.globalAlpha = 0.45;
      glowCtx.stroke();
      glowCtx.globalAlpha = 1;
    }

    if (frac < 1) {
      const ae = -Math.PI / 2 + frac * Math.PI * 2;
      const xe = px + pW2 * Math.cos(ae), ye = py + pH2 * Math.sin(ae);

      ctx.beginPath(); ctx.arc(xe, ye, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();

      if (glowCtx) {
        glowCtx.beginPath(); glowCtx.arc(xe, ye, 4.5, 0, Math.PI * 2);
        glowCtx.fillStyle = col; glowCtx.globalAlpha = 0.5; glowCtx.fill(); glowCtx.globalAlpha = 1;
      }
    }
  }

  dispose() {}
}
