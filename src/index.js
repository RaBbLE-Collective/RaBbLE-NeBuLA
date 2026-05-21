// Side effect: registers <rabble-entity> custom element
import './element.js';

export * from './core/index.js';
export * from './patterns/index.js';
export * from './effects/index.js';
export * from './backends/index.js';

// ui — SVG effect factories (entity-mini, grimoire-ring, grimoire-eye)
// Accessible as window.NeBuLA.ui.createEntityMini etc. in the IIFE build.
export * as ui from './ui/index.js';

// NeBuLA namespace shape — these become window.NeBuLA.version etc. in the IIFE build.
// _instance, particleCount, glowScale, renderDpr are written at runtime by element.js.
export const version  = '0.0.0.0';
export const backend  = 'Canvas2D';
export const backends = ['Canvas2D'];
