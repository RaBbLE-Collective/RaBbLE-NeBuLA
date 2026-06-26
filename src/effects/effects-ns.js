/**
 * effects/effects-ns.js — NeBuLA.effects namespace
 *
 * Re-exports the full effects API under canonical camelCase names.
 * This module is consumed via `export * as effects` in src/index.js,
 * placing everything at window.NeBuLA.effects.* in the IIFE build.
 *
 * Factory effects (target, opts) -> { start(), stop(), setParams(opts) }:
 *   starfield, streaks, constellation, haze
 *
 * Class effects (legacy API, instantiated with new):
 *   entropy (EntropyShader), ambientField (AmbientField), attractor (EntropyAttractor)
 */
export { EntropyShader  as entropy       } from './entropy-shader.js';
export { EntropyAttractor as attractor   } from './attractor.js';
export { AmbientField   as ambientField  } from './ambient-field.js';
export { starfield }                        from './starfield.js';
export { streaks, constellation, haze }    from './stubs.js';
