// Side effects: register all custom elements on load.
import './element.js';           // <rabble-entity>
import './elements/floor.js';    // <rabble-floor>  (Three.js Grimoire floor)
import './elements/graph.js';    // <rabble-graph>  (Three.js knowledge graph)
import './elements/doors.js';    // <rabble-doors>  (orbit engine, fully implemented)

export * from './core/index.js';
export * from './patterns/index.js';
export * from './effects/index.js';
export * from './backends/index.js';

// ui — DOM/SVG factories. Accessible as window.NeBuLA.ui.* in the IIFE build.
//   createEntityMini, createGrimoireEye, createAmbientEye, createGrimoireRing
export * as ui from './ui/index.js';

// effects — parameterized rendering effects. Accessible as window.NeBuLA.effects.* .
//   entropy (EntropyShader class), ambientField (AmbientField class),
//   attractor (EntropyAttractor class), AnimationFilter class,
//   starfield(target, opts) -> handle,
//   streaks/constellation/haze(target, opts) -> handle
export * as effects from './effects/effects-ns.js';

// NeBuLA namespace shape — these become window.NeBuLA.version etc. in the IIFE build.
// _instance, particleCount, glowScale, renderDpr, activeBackend are written at
// runtime by element.js once <rabble-entity> connects and picks a backend.
export const version  = '0.0.0.0';
export const backend  = 'Canvas2D';                 // default backend; see activeBackend for what's actually mounted
export const backends = ['Canvas2D', 'Three.js'];    // Three.js is opt-in via <rabble-entity backend="threejs">, S190
