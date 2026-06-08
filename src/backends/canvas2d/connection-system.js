// Connection tuning
const MAX_DRAWN_CONNECTIONS = 200;

// Post-boot topology — sparse "neural" web rather than dense radius-clustering.
// Each particle links to its K nearest neighbors (by stable target position),
// producing an organic synapse-like graph that stays sparse regardless of
// local particle density — the "living brain" feel at a fraction of the link
// count (and draw cost) of the old radius-capped approach.
const NEAREST_NEIGHBORS     = 2;
const MAX_PRECOMPUTED_LINKS = 320;

// Spatial hash constants for boot connection loop
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
    this._links = [];
    this._bootHash = null;
    this._bootHashAge = 0;
  }

  get links() { return this._links; }

  // Rebuild pre-computed link topology from particle target positions.
  // Called after init and after resize — O(n² log n) but happens once, not
  // per-frame, and n is small (≤300) so this is sub-millisecond.
  //
  // Each particle finds its K nearest neighbors by target position (stable
  // across frames — no per-frame recompute needed) and links to them, with
  // duplicate pairs (i links j, j also nearest to i) collapsed. The result
  // is a sparse, evenly-distributed synapse graph — "living brain" rather
  // than a dense mesh that clumps wherever particles happen to cluster.
  rebuild(particles) {
    const n = particles.length;
    const seen  = new Set();
    const links = [];

    for (let i = 0; i < n; i++) {
      const dists = [];
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const dx = particles[i].tx - particles[j].tx;
        const dy = particles[i].ty - particles[j].ty;
        dists.push([dx * dx + dy * dy, j]);
      }
      dists.sort((a, b) => a[0] - b[0]);

      for (let k = 0; k < NEAREST_NEIGHBORS && k < dists.length; k++) {
        const j = dists[k][1];
        const a = Math.min(i, j), b = Math.max(i, j);
        const key = a * n + b;
        if (seen.has(key)) continue;
        seen.add(key);
        links.push({ a, b });
        if (links.length >= MAX_PRECOMPUTED_LINKS) { this._links = links; return; }
      }
    }
    this._links = links;
  }

  update() {}

  // draw() — can be deferred by FrameBudget (priority: after eyes and portals)
  //
  // Boot: spatial hash O(n×k) check with growing radius + cap.
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
      // qualify at 35px so the hash lookup exits almost immediately.
      const connDist  = 35 + connProgress * 47;
      const connDist2 = connDist * connDist;

      // Rebuild spatial hash every HASH_REBUILD_INTERVAL frames
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
      ctx.lineWidth = 0.4;
      ctx.strokeStyle = '#3377ee';
      ctx.globalAlpha = connAlpha;
      ctx.beginPath();
      for (let i = 0; i < particles.length && drawn < MAX_DRAWN_CONNECTIONS; i++) {
        const pi = particles[i];
        const nearby = this._bootHash.neighbors(pi.rx, pi.ry);
        for (const j of nearby) {
          if (j <= i) continue;
          const pj = particles[j];
          const dx = pi.rx - pj.rx, dy = pi.ry - pj.ry;
          if (dx * dx + dy * dy < connDist2) {
            ctx.moveTo(pi.rx, pi.ry); ctx.lineTo(pj.rx, pj.ry);
            drawn++;
            if (drawn >= MAX_DRAWN_CONNECTIONS) break;
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

  dispose() {
    this._bootHash = null;
  }
}
