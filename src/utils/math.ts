export const TAU = Math.PI * 2;
export const PHI = Math.PI * (3 - Math.sqrt(5)); // Golden angle

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function distance3d(
  a: [number, number, number],
  b: [number, number, number]
): number {
  return Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 + (b[2] - a[2]) ** 2);
}
