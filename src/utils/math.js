export const TAU = Math.PI * 2;
export const PHI_GOLDEN = Math.PI * (3 - Math.sqrt(5)); // golden angle

/** @param {number} v @param {number} min @param {number} max @returns {number} */
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/** @param {number} a @param {number} b @param {number} t @returns {number} */
export const lerp = (a, b, t) => a + (b - a) * t;

/** @param {number} min @param {number} max @returns {number} */
export const randomInRange = (min, max) => min + Math.random() * (max - min);

/** @param {number} deg @returns {number} */
export const degToRad = deg => (deg * Math.PI) / 180;

/**
 * @param {[number,number,number]} a
 * @param {[number,number,number]} b
 * @returns {number}
 */
export const distance3d = (a, b) =>
  Math.sqrt((b[0]-a[0])**2 + (b[1]-a[1])**2 + (b[2]-a[2])**2);
