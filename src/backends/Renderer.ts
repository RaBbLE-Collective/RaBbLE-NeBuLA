import { Stream } from '../core/Stream';
import { PerformanceMetrics } from '../core/Types';

export abstract class Renderer {
  abstract render(streams: Stream[]): void;
  abstract resize(): void;
  abstract dispose(): void;
  abstract getPerformanceMetrics(): PerformanceMetrics;
}
