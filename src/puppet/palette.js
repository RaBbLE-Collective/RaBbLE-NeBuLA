/**
 * NeBuLA Palette — Color management for entropy-driven rendering
 *
 * Single source of truth: RaBbLE-Grimoire/common/RaBbLE-Palette.md
 * Reading strategy:
 *   1. Try CSS custom properties from loaded Aether CSS
 *   2. Fall back to canonical hex values from Grimoire
 *   3. Never embed raw hex values in rendering code
 *
 * Aether publishes these as CSS variables:
 *   --rabble-primary:   #ff2d78 (magenta)
 *   --rabble-secondary: #00f5ff (cyan)
 *   --rabble-tertiary:  #bf5fff (violet)
 *   etc.
 *
 * If Aether CSS is not loaded (e.g., in a server-side context), we gracefully
 * fall back to the Grimoire constants defined below.
 */

// Canonical palette from RaBbLE-Grimoire/common/RaBbLE-Palette.md
// These are the fallback values when CSS variables are not available.
const GRIMOIRE_PALETTE = {
  // Core neons (primary identity colors)
  magenta:  '#ff2d78', // Hot magenta — primary neon, signature color
  cyan:     '#00f5ff', // Electric cyan — secondary neon
  violet:   '#bf5fff', // Soft violet — tertiary neon
  pink:     '#ff79c6', // Outrun pink — grid/horizon color

  // Backgrounds (the void)
  bg:       '#0a0010', // Deep void — primary background
  surface:  '#12132a', // Slightly elevated surface
  raised:   '#1a1b2e', // Cards, input fields, popups
  border:   '#2a2840', // Inactive borders, dividers

  // Text (the signal)
  text:     '#e8e6f0', // Primary readable text
  muted:    '#6b6880', // Secondary, dimmed text

  // Semantic
  red:      '#e05c6f', // Error / urgent
  green:    '#50fa7b', // Success
  yellow:   '#f1fa8c', // Warning / staged
};

// CSS custom property names (published by Aether)
// These map to Aether's rabble-palette.css custom properties.
const CSS_VAR_MAP = {
  magenta:  '--rabble-primary',
  cyan:     '--rabble-secondary',
  violet:   '--rabble-tertiary',
  pink:     '--rabble-grid',
  bg:       '--rabble-bg',
  surface:  '--rabble-surface',
  raised:   '--rabble-raised',
  border:   '--rabble-border',
  text:     '--rabble-text',
  muted:    '--rabble-muted',
  red:      '--rabble-error',
  green:    '--rabble-success',
  yellow:   '--rabble-warning',
};

/**
 * Create the palette object by reading from CSS variables (Aether)
 * with fallback to Grimoire constants.
 *
 * @returns {Object} Palette object with color names as keys, hex values as values
 */
function createPalette() {
  const palette = {};

  for (const [colorName, cssVarName] of Object.entries(CSS_VAR_MAP)) {
    const cssValue = readCSSVar(cssVarName);
    // Use CSS value if found, otherwise use Grimoire fallback
    palette[colorName] = cssValue || GRIMOIRE_PALETTE[colorName];
  }

  return palette;
}

/**
 * Read a CSS custom property value from the root element.
 * Returns null if not found or if running in a non-browser context.
 *
 * @param {string} varName - CSS variable name (e.g., '--rabble-primary')
 * @returns {string|null} Hex color value or null
 */
function readCSSVar(varName) {
  // Guard against non-browser contexts (SSR, Node)
  if (typeof window === 'undefined' || !document?.documentElement) {
    return null;
  }

  try {
    const computedStyle = getComputedStyle(document.documentElement);
    const value = computedStyle.getPropertyValue(varName).trim();
    return value || null;
  } catch {
    return null;
  }
}

/**
 * Palette instance — initialized on module load.
 * This is the main export. Use this object wherever NeBuLA needs colors.
 *
 * Example:
 *   import { palette } from './palette.js';
 *   ctx.fillStyle = palette.magenta;
 *   ctx.strokeStyle = palette.cyan;
 */
export const palette = createPalette();

/**
 * Utility: Convert hex color to RGB object for Canvas operations.
 *
 * @param {string} hex - Hex color (e.g., '#ff2d78')
 * @returns {Object} {r, g, b} with values 0-255
 */
export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}

/**
 * Utility: Convert hex to RGBA with alpha.
 * Useful for blending and transparency effects in Canvas2D.
 *
 * @param {string} hex - Hex color
 * @param {number} alpha - Alpha value 0-1
 * @returns {string} CSS rgba() string
 */
export function hexToRgba(hex, alpha) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex; // fallback to original if parsing fails
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * Utility: Convert hex to normalized RGB for WebGL/Three.js (0-1 range).
 * Three.js Color expects values 0-1, not 0-255.
 *
 * @param {string} hex - Hex color
 * @returns {Object} {r, g, b} with values 0-1
 */
export function hexToNormalizedRgb(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return { r: 1, g: 1, b: 1 }; // white fallback
  return {
    r: rgb.r / 255,
    g: rgb.g / 255,
    b: rgb.b / 255,
  };
}

// Export fallback palette for debugging/testing
export const FALLBACK_PALETTE = GRIMOIRE_PALETTE;
