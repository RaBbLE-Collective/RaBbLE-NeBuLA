/** @import { RuntimeStats } from './types.js' */
import { Stream } from './stream.js';
import { AnimationMixer } from './animation.js';

export class Runtime {
  /**
   * @param {HTMLCanvasElement|string} canvas - element or CSS selector
   */
  constructor(canvas) {
    /** @type {Map<string, Stream>} */
    this.streams = new Map();

    /** @type {import('../backends/renderer.js').Renderer|null} */
    this.backend = null;

    /** @type {AnimationMixer} */
    this.animator = new AnimationMixer();

    this._canvas = typeof canvas === 'string' ? document.querySelector(canvas) : canvas;
    this._running = false;
    this._frameId = null;
    this._lastFrameTime = 0;
    this._fps = 0;
    this._frameTime = 0;

    /** @type {Map<string, Function[]>} */
    this._handlers = new Map();
  }

  /** @param {string} id @returns {Stream} */
  createStream(id) {
    const stream = new Stream();
    this.streams.set(id, stream);
    return stream;
  }

  /** @param {string} id */
  deleteStream(id) { this.streams.delete(id); }

  /** @param {string} id @returns {Stream|undefined} */
  getStream(id) { return this.streams.get(id); }

  /** @returns {string[]} */
  listStreams() { return Array.from(this.streams.keys()); }

  start() {
    if (this._running) return;
    this._running = true;
    this._loop(performance.now());
  }

  stop() {
    this._running = false;
    if (this._frameId !== null) cancelAnimationFrame(this._frameId);
    this._frameId = null;
  }

  /** @returns {boolean} */
  isRunning() { return this._running; }

  /** @returns {RuntimeStats} */
  getStats() {
    const all = Array.from(this.streams.values()).flatMap(s => s.getAll());
    const avgEntropy = all.length > 0
      ? all.reduce((sum, e) => sum + e.entropy, 0) / all.length
      : 0;
    return {
      totalEntities: all.length,
      activeStreams: this.streams.size,
      averageEntropy: avgEntropy,
      fps: this._fps,
      frameTime: this._frameTime,
      memoryUsage: { heap: 0, entities: all.length },
    };
  }

  /** @param {string} event @param {Function} handler */
  on(event, handler) {
    if (!this._handlers.has(event)) this._handlers.set(event, []);
    this._handlers.get(event).push(handler);
  }

  /** @param {string} event @param {Function} handler */
  off(event, handler) {
    const handlers = this._handlers.get(event);
    if (handlers) this._handlers.set(event, handlers.filter(h => h !== handler));
  }

  /** @param {string} event @param {...unknown} args */
  _emit(event, ...args) {
    this._handlers.get(event)?.forEach(h => h(...args));
  }

  /** @param {number} timestamp */
  _loop(timestamp) {
    if (!this._running) return;
    this._frameTime = timestamp - this._lastFrameTime;
    this._fps = this._frameTime > 0 ? 1000 / this._frameTime : 0;
    this._lastFrameTime = timestamp;

    // Update all active animations before rendering
    this.animator.update(this._frameTime);

    this._emit('frame', timestamp);
    this.backend?.render(Array.from(this.streams.values()));

    this._frameId = requestAnimationFrame(t => this._loop(t));
  }
}
