import { Renderer } from './Renderer';
import { Stream } from '../core/Stream';
import { PerformanceMetrics } from '../core/Types';

// TODO: implement Three.js InstancedMesh backend
// Key references: EXTRACTION_ANALYSIS.md §2.1, §2.2
export class ThreeJsBackend extends Renderer {
  render(_streams: Stream[]): void {
    throw new Error('ThreeJsBackend not yet implemented');
  }

  resize(): void {}

  dispose(): void {}

  getPerformanceMetrics(): PerformanceMetrics {
    return { fps: 0, frameTime: 0, drawCalls: 0, triangles: 0 };
  }
}
