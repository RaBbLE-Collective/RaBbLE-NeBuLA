import { Stream } from './Stream';
import { RuntimeStats, PerformanceMetrics } from './Types';
import { Renderer } from '../backends/Renderer';

export class Runtime {
  streams: Map<string, Stream> = new Map();
  backend!: Renderer;

  private running = false;
  private frameId: number | null = null;
  private lastFrameTime = 0;
  private fps = 0;
  private frameTime = 0;
  private eventHandlers: Map<string, Function[]> = new Map();

  constructor(_canvas: HTMLCanvasElement | string) {
    // Backend initialization deferred to subclass or factory
    // TODO: auto-detect and instantiate ThreeJsBackend
  }

  createStream(id: string): Stream {
    const stream = new Stream();
    this.streams.set(id, stream);
    return stream;
  }

  deleteStream(id: string): void {
    this.streams.delete(id);
  }

  getStream(id: string): Stream | undefined {
    return this.streams.get(id);
  }

  listStreams(): string[] {
    return Array.from(this.streams.keys());
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.loop(performance.now());
  }

  stop(): void {
    this.running = false;
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  getStats(): RuntimeStats {
    const allEntities = Array.from(this.streams.values()).flatMap(s => s.getAll());
    const avgEntropy = allEntities.length > 0
      ? allEntities.reduce((sum, e) => sum + e.entropy, 0) / allEntities.length
      : 0;

    return {
      totalEntities: allEntities.length,
      activeStreams: this.streams.size,
      averageEntropy: avgEntropy,
      fps: this.fps,
      frameTime: this.frameTime,
      memoryUsage: { heap: 0, entities: allEntities.length },
    };
  }

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) this.eventHandlers.set(event, []);
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      this.eventHandlers.set(event, handlers.filter(h => h !== handler));
    }
  }

  private emit(event: string, ...args: unknown[]): void {
    this.eventHandlers.get(event)?.forEach(h => h(...args));
  }

  private loop(timestamp: number): void {
    if (!this.running) return;

    this.frameTime = timestamp - this.lastFrameTime;
    this.fps = this.frameTime > 0 ? 1000 / this.frameTime : 0;
    this.lastFrameTime = timestamp;

    this.emit('frame', timestamp);

    if (this.backend) {
      this.backend.render(Array.from(this.streams.values()));
    }

    this.frameId = requestAnimationFrame(t => this.loop(t));
  }
}
