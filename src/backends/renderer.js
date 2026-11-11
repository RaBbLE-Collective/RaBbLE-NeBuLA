/** @import { Stream } from '../core/stream.js' */
/** @import { PerformanceMetrics } from '../core/types.js' */

/**
 * Abstract base for rendering backends.
 * Subclass this to add Three.js, Canvas2D, WebGPU, etc.
 */
export class Renderer {
  /** @param {Stream[]} _streams */
  render(_streams) { throw new Error('render() not implemented'); }

  resize() { throw new Error('resize() not implemented'); }

  dispose() { throw new Error('dispose() not implemented'); }

  /** @returns {PerformanceMetrics} */
  getPerformanceMetrics() { throw new Error('getPerformanceMetrics() not implemented'); }
}
