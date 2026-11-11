/**
 * EntropyAttractor — entropy-based attraction/repulsion system.
 * High-entropy entities repel; low-entropy attract. Creates emergent flocking.
 */

export class EntropyAttractor {
  constructor(opts = {}) {
    this.strength  = opts.strength  ?? 0.3;
    this.threshold = opts.threshold ?? 0.6;
    this.radius    = opts.radius    ?? 5.0;
    this._minDist  = 0.5;
  }

  /**
   * Apply attraction/repulsion forces to all entities in a stream.
   * Mutates entity positions in-place.
   * @param {import('../core/stream.js').Stream} stream
   * @param {number} dt - delta time in seconds
   */
  apply(stream, dt) {
    const entities = stream.getAll();
    const len = entities.length;
    if (len < 2) return;

    const forces = new Array(len);
    for (let i = 0; i < len; i++) forces[i] = [0, 0, 0];

    for (let i = 0; i < len; i++) {
      const a = entities[i];
      for (let j = i + 1; j < len; j++) {
        const b = entities[j];
        const dx = b.position[0] - a.position[0];
        const dy = b.position[1] - a.position[1];
        const dz = b.position[2] - a.position[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < this._minDist || dist > this.radius) continue;

        const avgEntropy = (a.entropy + b.entropy) * 0.5;
        const sign = avgEntropy > this.threshold ? -1 : 1;
        const magnitude = sign * this.strength * (1 - dist / this.radius) * dt;

        const nx = dx / dist;
        const ny = dy / dist;
        const nz = dz / dist;

        forces[i][0] += nx * magnitude;
        forces[i][1] += ny * magnitude;
        forces[i][2] += nz * magnitude;
        forces[j][0] -= nx * magnitude;
        forces[j][1] -= ny * magnitude;
        forces[j][2] -= nz * magnitude;
      }
    }

    for (let i = 0; i < len; i++) {
      entities[i].position[0] += forces[i][0];
      entities[i].position[1] += forces[i][1];
      entities[i].position[2] += forces[i][2];
    }
  }
}
