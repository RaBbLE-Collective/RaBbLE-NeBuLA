/** @import { Entity, GeometryType } from '../core/types.js' */
import { createEntity } from '../core/entity.js';

const PHI = Math.PI * (3 - Math.sqrt(5)); // golden angle

export const PatternGenerator = {
  /**
   * Golden-angle spiral — organic, non-repeating distribution.
   * @param {number} count
   * @param {GeometryType} [geometry]
   * @param {number} [radius]
   * @returns {Entity[]}
   */
  organic(count, geometry = 'sphere', radius = 5) {
    return Array.from({ length: count }, (_, i) => {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(1 - y * y) * radius;
      const theta = PHI * i;
      return createEntity(geometry, [r * Math.cos(theta), y * radius, r * Math.sin(theta)], i / count);
    });
  },

  /**
   * Uniform 3D grid.
   * @param {number} cols
   * @param {number} rows
   * @param {number} depth
   * @param {GeometryType} [geometry]
   * @param {number} [spacing]
   * @returns {Entity[]}
   */
  lattice(cols, rows, depth, geometry = 'box', spacing = 1) {
    const entities = [];
    for (let z = 0; z < depth; z++)
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++)
          entities.push(createEntity(geometry, [x * spacing, y * spacing, z * spacing], 0));
    return entities;
  },

  /**
   * Random particle cloud.
   * @param {number} count
   * @param {GeometryType} [geometry]
   * @param {number} [spread]
   * @returns {Entity[]}
   */
  swarm(count, geometry = 'sphere', spread = 10) {
    return Array.from({ length: count }, () =>
      createEntity(
        geometry,
        [(Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread],
        Math.random()
      )
    );
  },

  /**
   * Logarithmic spiral arms.
   * @param {number} count
   * @param {GeometryType} [geometry]
   * @param {number} [arms]
   * @param {number} [spread]
   * @returns {Entity[]}
   */
  galaxy(count, geometry = 'sphere', arms = 2, spread = 0.5) {
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
