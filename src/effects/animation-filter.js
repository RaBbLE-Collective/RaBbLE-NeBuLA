/**
 * AnimationFilter — procedural per-entity animations.
 * Types: blink, dart, pulse, orbit, wave.
 * Each filter transforms entity position/scale based on time + entropy.
 */

export class AnimationFilter {
  /**
   * @param {'blink'|'dart'|'pulse'|'orbit'|'wave'} type
   * @param {Object} [opts]
   * @param {number} [opts.cycle] - cycle duration in seconds (default 4)
   * @param {number} [opts.amplitude] - movement amplitude (default 1)
   */
  constructor(type, opts = {}) {
    this.type = type;
    this.cycle = opts.cycle ?? 4.0;
    this.amplitude = opts.amplitude ?? 1.0;
    this._time = 0;
  }

  /**
   * Advance time and apply filter to all entities in a stream.
   * @param {import('../core/stream.js').Stream} stream
   * @param {number} dt - delta time in seconds
   */
  apply(stream, dt) {
    this._time += dt;
    if (this._time > 10000) this._time = 0;

    const entities = stream.getAll();
    for (let i = 0; i < entities.length; i++) {
      this._applyToEntity(entities[i], i);
    }
  }

  _applyToEntity(entity, index) {
    switch (this.type) {
      case 'blink': return this._blink(entity, index);
      case 'dart':  return this._dart(entity, index);
      case 'pulse': return this._pulse(entity, index);
      case 'orbit': return this._orbit(entity, index);
      case 'wave':  return this._wave(entity, index);
    }
  }

  _blink(entity, index) {
    const phase = (this._time % this.cycle) / this.cycle;
    let sy = 1.0;
    if (phase < 0.1) {
      sy = 1.0 - (phase / 0.1) * 0.9;
    } else if (phase < 0.15) {
      sy = 0.1;
    } else if (phase < 0.25) {
      sy = 0.1 + ((phase - 0.15) / 0.1) * 0.9;
    }
    entity.scale[1] = sy;
  }

  _dart(entity, index) {
    const offset = index * 0.7;
    const phase = ((this._time + offset) % this.cycle) / this.cycle;
    if (phase > 0.85 && phase < 0.95) {
      const t = (phase - 0.85) / 0.1;
      const jolt = Math.sin(t * Math.PI) * this.amplitude * 2;
      entity.position[0] += jolt * (index % 2 === 0 ? 1 : -1);
    }
  }

  _pulse(entity, _index) {
    const t = Math.sin(this._time * Math.PI * 2 / this.cycle);
    const s = 1.0 + t * 0.15 * this.amplitude * entity.entropy;
    entity.scale[0] = s;
    entity.scale[1] = s;
    entity.scale[2] = s;
  }

  _orbit(entity, index) {
    const offset = (index / 10) * Math.PI * 2;
    const angle = this._time * (Math.PI * 2 / this.cycle) + offset;
    const r = this.amplitude * (1 + entity.entropy);
    entity.position[0] += Math.cos(angle) * r * 0.01;
    entity.position[2] += Math.sin(angle) * r * 0.01;
  }

  _wave(entity, index) {
    const phase = this._time * (Math.PI * 2 / this.cycle) + index * 0.3;
    entity.position[1] += Math.sin(phase) * this.amplitude * 0.05;
  }
}
