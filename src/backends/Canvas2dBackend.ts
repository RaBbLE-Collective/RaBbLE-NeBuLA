import { Renderer } from './Renderer';
import { Stream } from '../core/Stream';
import { PerformanceMetrics } from '../core/Types';

// Canvas 2D fallback — no WebGL required
// TODO: implement 2D projection of entity positions + entropy-driven styling
export class Canvas2dBackend extends Renderer {
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    super();
    this.ctx = canvas.getContext('2d')!;
  }

  render(_streams: Stream[]): void {
    throw new Error('Canvas2dBackend not yet implemented');
  }

  resize(): void {}

  dispose(): void {}

  getPerformanceMetrics(): PerformanceMetrics {
    return { fps: 0, frameTime: 0, drawCalls: 0, triangles: 0 };
  }
}
