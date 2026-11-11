/** @import { Entity, GeometryType } from './types.js' */

export class Stream {
  constructor() {
    /** @type {Entity[]} */
    this.entities = [];
  }

  /** @param {Entity} entity */
  add(entity) { this.entities.push(entity); }

  /** @param {string} id */
  remove(id) { this.entities = this.entities.filter(e => e.id !== id); }

  clear() { this.entities = []; }

  /** @param {string} id @returns {Entity|undefined} */
  get(id) { return this.entities.find(e => e.id === id); }

  /** @returns {Entity[]} */
  getAll() { return this.entities; }

  /** @param {GeometryType} type @returns {Entity[]} */
  getByGeometry(type) { return this.entities.filter(e => e.geometry === type); }

  /** @returns {number} */
  count() { return this.entities.length; }

  /** @param {(e: Entity) => Entity} fn */
  transform(fn) { this.entities = this.entities.map(fn); }

  /** @param {(e: Entity) => boolean} fn @returns {Stream} */
  filter(fn) {
    const result = new Stream();
    result.entities = this.entities.filter(fn);
    return result;
  }

  /** @template T @param {(e: Entity) => T} fn @returns {T[]} */
  map(fn) { return this.entities.map(fn); }

  /** @param {(e: Entity) => void} fn */
  forEach(fn) { this.entities.forEach(fn); }

  /** @returns {number} */
  getAverageEntropy() {
    if (this.entities.length === 0) return 0;
    return this.entities.reduce((sum, e) => sum + e.entropy, 0) / this.entities.length;
  }

  /** @returns {number} */
  getActivationRate() {
    if (this.entities.length === 0) return 0;
    return this.entities.filter(e => e.active !== false).length / this.entities.length;
  }

  /** @returns {string} */
  toJSON() { return JSON.stringify(this.entities); }

  /** @param {string} json @returns {Stream} */
  static fromJSON(json) {
    const stream = new Stream();
    stream.entities = JSON.parse(json);
    return stream;
  }

  /** @param {Stream[]} streams @returns {Stream} */
  static combine(streams) {
    const result = new Stream();
    result.entities = streams.flatMap(s => s.entities);
    return result;
  }
}
