/** @import { Stream } from '../core/stream.js' */
import { Renderer } from './renderer.js';

// Canvas 2D fallback — no WebGL required, projects entity positions to screen
// TODO: implement 2D projection + entropy-driven fill/stroke variation
export class Canvas2dBackend extends Renderer {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    super();
    this._ctx = canvas.getContext('2d');
  }

  /** @param {Stream[]} _streams */
  render(_streams) {
    throw new Error('Canvas2dBackend not yet implemented');
  }

  resize() {}
  dispose() {}
  getPerformanceMetrics() { return { fps: 0, frameTime: 0, drawCalls: 0, triangles: 0 }; }
}
