import { Entity, GeometryType } from './Types';

export class Stream {
  entities: Entity[] = [];

  add(entity: Entity): void {
    this.entities.push(entity);
  }

  remove(id: string): void {
    this.entities = this.entities.filter(e => e.id !== id);
  }

  clear(): void {
    this.entities = [];
  }

  get(id: string): Entity | undefined {
    return this.entities.find(e => e.id === id);
  }

  getAll(): Entity[] {
    return this.entities;
  }

  getByGeometry(type: GeometryType): Entity[] {
    return this.entities.filter(e => e.geometry === type);
  }

  count(): number {
    return this.entities.length;
  }

  transform(fn: (e: Entity) => Entity): void {
    this.entities = this.entities.map(fn);
  }

  filter(fn: (e: Entity) => boolean): Stream {
    const result = new Stream();
    result.entities = this.entities.filter(fn);
    return result;
  }

  map<T>(fn: (e: Entity) => T): T[] {
    return this.entities.map(fn);
  }

  forEach(fn: (e: Entity) => void): void {
    this.entities.forEach(fn);
  }

  getAverageEntropy(): number {
    if (this.entities.length === 0) return 0;
    return this.entities.reduce((sum, e) => sum + e.entropy, 0) / this.entities.length;
  }

  getActivationRate(): number {
    if (this.entities.length === 0) return 0;
    const active = this.entities.filter(e => e.active !== false).length;
    return active / this.entities.length;
  }

  toJSON(): string {
    return JSON.stringify(this.entities);
  }

  static fromJSON(json: string): Stream {
    const stream = new Stream();
    stream.entities = JSON.parse(json);
    return stream;
  }

  static combine(streams: Stream[]): Stream {
    const result = new Stream();
    result.entities = streams.flatMap(s => s.entities);
    return result;
  }
}
