// Connection tuning — 95px accounts for ±30px sinusoidal drift on each particle
const CONN_DIST_POST_BOOT   = 95;
const MAX_DRAWN_CONNECTIONS = 150;
const CONN_STEP             = 4;
const MAX_PRECOMPUTED_LINKS = 200;

export class ConnectionSystem {
  constructor() {
    this._links = [];
  }

  get links() { return this._links; }

  // Rebuild pre-computed link topology from particle target positions.
  // Called after init and after resize. O(n²) but happens once, not per-frame.
  rebuild(particles) {
    const links = [];
    const dist2 = CONN_DIST_POST_BOOT * CONN_DIST_POST_BOOT;
    for (let i = 0; i < particles.length && links.length < MAX_PRECOMPUTED_LINKS; i++) {
      for (let j = i + 1; j < particles.length && links.length < MAX_PRECOMPUTED_LINKS; j++) {
        const dx = particles[i].tx - particles[j].tx;
        const dy = particles[i].ty - particles[j].ty;
        if (dx * dx + dy * dy < dist2) links.push({ a: i, b: j });
      }
    }
    this._links = links;
  }

  update() {}

  // draw() — can be deferred by FrameBudget (priority: after eyes and portals)
  //
  // Boot: dynamic O(n²) check with growing radius + aggressive step/cap.
  // Post-boot: pre-computed links, O(MAX_PRECOMPUTED_LINKS) per frame.
  draw(ctx, _t, state, particles) {
    const { inBoot, convProg, settleBlend, entropy } = state;

    if (inBoot) {
      // connProgress blends convergence and settle — connections appear early
      // during convergence and strengthen through settle
      const connProgress = Math.max(convProg * 0.5, settleBlend);
      if (connProgress < 0.05) return;

      const connAlpha = connProgress * 0.13;
      // Radius grows with convergence: 35→82px. While scattered, few pairs
      // qualify at 35px so the inner loop exits almost immediately.
      const connDist  = 35 + connProgress * 47;
      const connDist2 = connDist * connDist;

      let drawn = 0;
      ctx.lineWidth = 0.4;
      ctx.strokeStyle = '#3377ee';
      ctx.globalAlpha = connAlpha;
      ctx.beginPath();
      // step=4 during early convergence (scattered = cheap), step=2 once settled
      const step = settleBlend > 0.5 ? 2 : CONN_STEP;
      for (let i = 0; i < particles.length && drawn < MAX_DRAWN_CONNECTIONS; i += step) {
        const pi = particles[i];
        for (let j = i + step; j < particles.length && drawn < MAX_DRAWN_CONNECTIONS; j += step) {
          const pj = particles[j];
          const dx = pi.rx - pj.rx, dy = pi.ry - pj.ry;
          if (dx * dx + dy * dy < connDist2) {
            ctx.moveTo(pi.rx, pi.ry); ctx.lineTo(pj.rx, pj.ry);
            drawn++;
          }
        }
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      if (!this._links.length) return;
      const connAlpha = 0.13 + entropy * 0.12;
      ctx.lineWidth = 0.4;
      ctx.strokeStyle = '#3377ee';
      ctx.globalAlpha = connAlpha;
      ctx.beginPath();
      for (let k = 0; k < this._links.length; k++) {
        const { a, b } = this._links[k];
        const pi = particles[a], pj = particles[b];
        if (!pi || !pj) continue;
        ctx.moveTo(pi.rx, pi.ry); ctx.lineTo(pj.rx, pj.ry);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  dispose() {}
}
