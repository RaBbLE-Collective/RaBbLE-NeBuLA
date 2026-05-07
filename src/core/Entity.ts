import { Entity as IEntity, GeometryType } from './Types';

let nextId = 0;

export function createEntity(
  geometry: GeometryType = 'sphere',
  position: [number, number, number] = [0, 0, 0],
  entropy: number = 0
): IEntity {
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

export function cloneEntity(entity: IEntity): IEntity {
  return {
    ...entity,
    id: `entity_${nextId++}`,
    position: [...entity.position] as [number, number, number],
    rotation: [...entity.rotation] as [number, number, number],
    scale: [...entity.scale] as [number, number, number],
    properties: entity.properties ? { ...entity.properties } : undefined,
  };
}
