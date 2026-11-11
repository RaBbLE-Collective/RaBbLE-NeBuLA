// Connection tuning — radius-based "synapse" mesh.
//
// Restored from the deployed reference renderer (the look on joinrabble.world):
// every particle pair within `connDist` gets a line whose alpha fades with
// distance and whose colour is inherited from the source particle. This is what
// gives the nebula its dense, living-brain feel — far richer than a sparse
// flat-blue K-nearest graph.
//
// Cost is kept in budget by stepping every other particle (STEP = 2): the pair
// count drops to ≈ (n/2)² while the visual density is indistinguishable, and the
// backend gates the whole field layer through FrameBudget on slow frames.
const STEP = 2;

// Boot connection loop — spatial hash so the growing-radius check stays O(n×k).
const MAX_DRAWN_CONNECTIONS = 200;
const HASH_CELL_SIZE        = 100;   // slightly larger than max boot connDist (82px)
const HASH_REBUILD_INTERVAL = 4;     // frames between hash rebuilds

class SpatialHash {
  constructor(cellSize) { this._cellSize = cellSize; this._cells = new Map(); }
  clear() { this._cells.clear(); }
  insert(idx, px, py) {
    const key = `${Math.floor(px / this._cellSize)},${Math.floor(py / this._cellSize)}`;
    if (!this._cells.has(key)) this._cells.set(key, []);
    this._cells.get(key).push(idx);
  }
  neighbors(px, py) {
    const cx = Math.floor(px / this._cellSize), cy = Math.floor(py / this._cellSize);
    const r = [];
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const c = this._cells.get(`${cx+dx},${cy+dy}`);
        if (c) for (const i of c) r.push(i);
      }
    return r;
  }
}

export class ConnectionSystem {
  constructor() {
    this._bootHash    = null;
    this._bootHashAge = 0;
  }

  // Radius mesh is evaluated live each frame — no precomputed topology to keep.
  rebuild() {}
  update() {}

  // draw() — can be deferred by FrameBudget (priority: after eyes and portals).
  // Particle render positions are read from rx/ry (drift already baked in by
  // ParticleSystem.update), so connections track exactly what the dots draw.
  draw(ctx, _t, state, particles) {
    const { inBoot, convProg, settleBlend, entropy } = state;

    if (inBoot) {
      // During convergence connections appear early and strengthen through settle.
      const connProgress = Math.max(convProg * 0.5, settleBlend);
      if (connProgress < 0.05) return;

      const connAlpha = connProgress * 0.15;
      // Radius grows with convergence: 35→82px. While scattered, few pairs
      // qualify at 35px so the hash lookup exits almost immediately.
      const connDist  = 35 + connProgress * 47;
      const connDist2 = connDist * connDist;

      if (this._bootHash === null || this._bootHashAge >= HASH_REBUILD_INTERVAL) {
        if (this._bootHash === null) this._bootHash = new SpatialHash(HASH_CELL_SIZE);
        this._bootHash.clear();
        for (let i = 0; i < particles.length; i++) {
          this._bootHash.insert(i, particles[i].rx, particles[i].ry);
        }
        this._bootHashAge = 0;
      } else {
        this._bootHashAge++;
      }

      let drawn = 0;
      ctx.lineWidth = 0.55;
      for (let i = 0; i < particles.length && drawn < MAX_DRAWN_CONNECTIONS; i++) {
        const pi = particles[i];
        const nearby = this._bootHash.neighbors(pi.rx, pi.ry);
        for (const j of nearby) {
          if (j <= i) continue;
          const pj = particles[j];
          const dx = pi.rx - pj.rx, dy = pi.ry - pj.ry;
          const d2 = dx * dx + dy * dy;
          if (d2 < connDist2) {
            const dist = Math.sqrt(d2);
            ctx.beginPath();
            ctx.moveTo(pi.rx, pi.ry); ctx.lineTo(pj.rx, pj.ry);
            ctx.strokeStyle = pi.color;
            ctx.globalAlpha = connAlpha * (1 - dist / connDist);
            ctx.stroke();
            drawn++;
            if (drawn >= MAX_DRAWN_CONNECTIONS) break;
          }
        }
      }
      ctx.globalAlpha = 1;
    } else {
      // Post-boot idle — dense radius mesh, per-particle colour, distance fade.
      // Squared distance fade (f*f) concentrates opacity on close pairs so the
      // synapses read as crisp short links rather than a uniform faint haze —
      // a denser, more legible "living brain" graph.
      const baseAlpha = settleBlend * 0.18 + entropy * 0.14;
      const connDist  = 62 + settleBlend * 20;   // 82px once fully settled
      const connDist2 = connDist * connDist;
      const pts = particles;
      ctx.lineWidth = 0.55;
      for (let a = 0; a < pts.length; a += STEP) {
        const pa = pts[a];
        for (let b = a + STEP; b < pts.length; b += STEP) {
          const pb = pts[b];
          const dx = pa.rx - pb.rx, dy = pa.ry - pb.ry;
          const d2 = dx * dx + dy * dy;
          if (d2 >= connDist2) continue;
          const dist = Math.sqrt(d2);
          const f = 1 - dist / connDist;
          ctx.beginPath();
          ctx.moveTo(pa.rx, pa.ry); ctx.lineTo(pb.rx, pb.ry);
          ctx.strokeStyle = pa.color;
          ctx.globalAlpha = baseAlpha * f * f;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  dispose() {
    this._bootHash = null;
  }
}
