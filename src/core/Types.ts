export type GeometryType = 'sphere' | 'box' | 'tetrahedron' | 'plane' | 'custom';

export interface Entity {
  id: string;
  geometry: GeometryType;
  geometryData?: unknown;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  matrix?: Float32Array;
  entropy: number;
  color?: [number, number, number];
  opacity?: number;
  lifetime?: number;
  age?: number;
  active?: boolean;
  properties?: Record<string, unknown>;
}

export interface RuntimeStats {
  totalEntities: number;
  activeStreams: number;
  averageEntropy: number;
  fps: number;
  frameTime: number;
  memoryUsage: {
    heap: number;
    entities: number;
  };
}

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  drawCalls: number;
  triangles: number;
}

export interface MaterialConfig {
  color?: [number, number, number];
  opacity?: number;
  wireframe?: boolean;
}
