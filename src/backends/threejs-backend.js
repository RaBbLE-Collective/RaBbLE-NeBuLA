/** @import { Stream } from '../core/stream.js' */
import { Renderer } from './renderer.js';

// Three.js InstancedMesh backend — primary rendering path
// TODO: implement — see docs/EXTRACTION_ANALYSIS.md §2.1 and §2.2 for architecture
// Key decisions:
//   - geometry cache: one BufferGeometry per GeometryType, shared across all streams
//   - material cache: one MeshStandardMaterial per color config
//   - one InstancedMesh per (geometry, material) pair, re-sized as entity count grows
//   - entity.matrix updated each frame via setMatrixAt()
export class ThreeJsBackend extends Renderer {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    super();
    this._canvas = canvas;
    // TODO: init THREE.WebGLRenderer, scene, camera
  }

  /** @param {Stream[]} _streams */
  render(_streams) {
    throw new Error('ThreeJsBackend not yet implemented');
  }

  resize() {}
  dispose() {}
  getPerformanceMetrics() { return { fps: 0, frameTime: 0, drawCalls: 0, triangles: 0 }; }
}
