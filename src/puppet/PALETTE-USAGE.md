# NeBuLA Palette Usage Guide

This document describes how to use the palette abstraction in NeBuLA rendering code.

## Overview

`palette.js` provides a single interface for all colors used in NeBuLA:

1. **Reads from Aether CSS variables** (if loaded)
2. **Falls back to Grimoire hex constants** (if CSS not available)
3. **Exports utilities** for Canvas2D and Three.js color operations

**Key rule:** Never embed raw hex values in rendering code. Always use the palette.

## Basic Usage

### Canvas2D Rendering

```javascript
import { palette, hexToRgba } from './palette.js';

function drawEntity(ctx, entity) {
  // Use palette colors directly
  ctx.fillStyle = palette.magenta;
  ctx.strokeStyle = palette.cyan;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.arc(entity.x, entity.y, entity.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawWithTransparency(ctx, entity) {
  // Use utility for alpha blending
  ctx.fillStyle = hexToRgba(palette.violet, 0.8);
  ctx.fillRect(entity.x, entity.y, entity.width, entity.height);
}
```

### Three.js Rendering

```javascript
import { palette, hexToNormalizedRgb } from './palette.js';
import * as THREE from 'three';

function createMaterial(baseColor) {
  const rgb = hexToNormalizedRgb(palette[baseColor]);
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(rgb.r, rgb.g, rgb.b),
    emissive: new THREE.Color(rgb.r * 0.5, rgb.g * 0.5, rgb.b * 0.5),
  });
}

const magnetaMat = createMaterial('magenta');
const cyanMat = createMaterial('cyan');
```

## Available Colors

The palette object exports these color names (all from Grimoire):

```javascript
// Core neons (primary identity)
palette.magenta   // #ff2d78 — hot magenta, signature
palette.cyan      // #00f5ff — electric cyan
palette.violet    // #bf5fff — soft violet
palette.pink      // #ff79c6 — outrun pink

// Backgrounds (the void)
palette.bg        // #0a0010 — deep void
palette.surface   // #12132a — elevated surface
palette.raised    // #1a1b2e — cards, inputs, popups
palette.border    // #2a2840 — inactive borders

// Text (the signal)
palette.text      // #e8e6f0 — primary readable text
palette.muted     // #6b6880 — secondary, dimmed

// Semantic
palette.red       // #e05c6f — error / urgent
palette.green     // #50fa7b — success
palette.yellow    // #f1fa8c — warning
```

## Utility Functions

### `hexToRgb(hex)`

Convert hex to RGB object (0-255 range). For Canvas2D operations.

```javascript
import { hexToRgb } from './palette.js';

const rgb = hexToRgb('#ff2d78');
// → { r: 255, g: 45, b: 120 }

ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
```

### `hexToRgba(hex, alpha)`

Convert hex to CSS rgba() string with alpha. For transparent Canvas2D fills/strokes.

```javascript
import { hexToRgba } from './palette.js';

ctx.fillStyle = hexToRgba(palette.magenta, 0.5);
// → rgba(255, 45, 120, 0.5)
```

### `hexToNormalizedRgb(hex)`

Convert hex to normalized RGB (0-1 range). **Required for Three.js Color objects.**

```javascript
import { hexToNormalizedRgb } from './palette.js';
import * as THREE from 'three';

const rgb = hexToNormalizedRgb(palette.cyan);
// → { r: 0, g: 0.961, b: 1 }

const color = new THREE.Color(rgb.r, rgb.g, rgb.b);
```

## Fallback Behavior

If Aether CSS is not loaded (e.g., in tests, SSR, or headless contexts), the palette falls back to Grimoire constants:

```javascript
import { palette, FALLBACK_PALETTE } from './palette.js';

// In a headless context (no DOM):
// palette === FALLBACK_PALETTE
// All values read from Grimoire hex constants

console.log(palette.magenta); // '#ff2d78' (Grimoire default)
```

To debug whether CSS variables were successfully loaded:

```javascript
const cssLoaded = palette.magenta !== FALLBACK_PALETTE.magenta;
console.log(`CSS variables loaded: ${cssLoaded}`);
```

## Example: Entropy-Driven Color Effects

Entropy (entity state) can influence color properties. Use the palette as a base:

```javascript
import { palette, hexToRgba } from './palette.js';

function getEntityColor(state, entropy) {
  // Base color from palette
  const baseColor = palette.magenta;

  // Modulate alpha based on entropy (blur effect)
  const alpha = 0.5 + (entropy * 0.5); // 0.5 to 1.0
  return hexToRgba(baseColor, alpha);
}

function drawEntropyEffect(ctx, entity) {
  ctx.fillStyle = getEntityColor(entity.state, entity.entropy);
  ctx.fillRect(entity.x, entity.y, entity.width, entity.height);
}
```

## Testing

For unit tests, use `FALLBACK_PALETTE` directly (no CSS to load):

```javascript
import { FALLBACK_PALETTE, hexToRgb } from './palette.js';

test('hexToRgb converts magenta correctly', () => {
  const rgb = hexToRgb(FALLBACK_PALETTE.magenta);
  expect(rgb).toEqual({ r: 255, g: 45, b: 120 });
});
```

## Performance Considerations

- Palette is created once at module load
- CSS variable reading happens once (on initialization)
- No color conversions in hot loops — pre-compute colors in setup, reuse in draw loops

```javascript
// ✓ Good
const colors = {
  bg: palette.bg,
  neon: palette.magenta,
  highlight: hexToRgba(palette.cyan, 0.8),
};

function render(entity) {
  ctx.fillStyle = colors.neon;
  // ... draw
}

// ✗ Avoid
function render(entity) {
  ctx.fillStyle = hexToRgba(palette.cyan, 0.8); // computed every frame
  // ... draw
}
```

## Single Source of Truth

Remember:
- **Canonical palette:** `RaBbLE-Grimoire/common/RaBbLE-Palette.md`
- **CSS publication:** `RaBbLE-Aether/assets/palette/rabble-palette.css` (custom properties)
- **NeBuLA consumption:** `RaBbLE-NeBuLA/src/puppet/palette.js` (this file)

If you need to change a color, edit the Grimoire palette first, then propagate to Aether, then NeBuLA automatically picks it up from CSS variables.
