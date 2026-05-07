import { Entity, GeometryType } from '../core/Types';
import { createEntity } from '../core/Entity';

export const PatternGenerator = {
  // Golden-angle spiral — organic, non-repeating distribution
  organic(count: number, geometry: GeometryType = 'sphere', radius: number = 5): Entity[] {
    const PHI = Math.PI * (3 - Math.sqrt(5));
    return Array.from({ length: count }, (_, i) => {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(1 - y * y) * radius;
      const theta = PHI * i;
      return createEntity(geometry, [r * Math.cos(theta), y * radius, r * Math.sin(theta)], i / count);
    });
  },

  // Uniform 3D grid
  lattice(cols: number, rows: number, depth: number, geometry: GeometryType = 'box', spacing: number = 1): Entity[] {
    const entities: Entity[] = [];
    for (let z = 0; z < depth; z++) {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          entities.push(createEntity(geometry, [x * spacing, y * spacing, z * spacing], 0));
        }
      }
    }
    return entities;
  },

  // Random particle cloud
  swarm(count: number, geometry: GeometryType = 'sphere', spread: number = 10): Entity[] {
    return Array.from({ length: count }, () =>
      createEntity(
        geometry,
        [(Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread],
        Math.random()
      )
    );
  },

  // Logarithmic spiral arms
  galaxy(count: number, geometry: GeometryType = 'sphere', arms: number = 2, spread: number = 0.5): Entity[] {
    return Array.from({ length: count }, (_, i) => {
      const arm = i % arms;
      const t = (i / count) * Math.PI * 4;
      const r = t * 0.5;
      const angle = t + (arm * Math.PI * 2) / arms;
      const scatter = (Math.random() - 0.5) * spread;
      return createEntity(
        geometry,
        [Math.cos(angle + scatter) * r, (Math.random() - 0.5) * spread, Math.sin(angle + scatter) * r],
        Math.random() * 0.5
      );
    });
  },
};
