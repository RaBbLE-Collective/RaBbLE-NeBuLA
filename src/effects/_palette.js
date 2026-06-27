/**
 * effects/_palette.js — shared palette resolution for Canvas2D effects.
 *
 * Effects render to canvas and cannot use CSS var() directly, so they read
 * the Aether palette CSS custom properties at runtime and convert to rgb/rgba.
 * Single source: --magenta / --cyan / --violet / --pink / --text from Aether.
 */

export function resolvePalette(el) {
  const cs = getComputedStyle(el || document.documentElement);
  const v  = (n, fb) => { const val = cs.getPropertyValue(n).trim(); return val || fb; };
  return {
    magenta: v('--magenta', '#ff2d78'),
    cyan:    v('--cyan',    '#00f5ff'),
    violet:  v('--violet',  '#bf5fff'),
    pink:    v('--pink',    '#ff79c6'),
    text:    v('--text',    '#e8e6f0'),
  };
}

export function hexSolid(hex) {
  if (!hex || hex[0] !== '#') return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r},${g},${b})`;
}

export function hexAlpha(hex, a) {
  if (!hex || hex[0] !== '#') return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}
