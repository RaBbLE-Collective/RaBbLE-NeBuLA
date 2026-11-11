/** @import { Entity, GeometryType } from './types.js' */

let nextId = 0;

/**
 * @param {GeometryType} [geometry]
 * @param {[number,number,number]} [position]
 * @param {number} [entropy]
 * @returns {Entity}
 */
export function createEntity(geometry = 'sphere', position = [0, 0, 0], entropy = 0) {
  return {
    id: `entity_${nextId++}`,
    geometry,
    position,
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    entropy: Math.max(0, Math.min(1, entropy)),
    active: true,
  };
}

/**
 * @param {Entity} entity
 * @returns {Entity}
 */
export function cloneEntity(entity) {
  return {
    ...entity,
    id: `entity_${nextId++}`,
    position: [...entity.position],
    rotation: [...entity.rotation],
    scale: [...entity.scale],
    properties: entity.properties ? { ...entity.properties } : undefined,
  };
}
