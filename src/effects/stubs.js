/**
 * effects/stubs.js — P5 stub effects
 *
 * Minimal API-surface stubs for effects that are conceptual in Chrysalis
 * (streaks, constellation, haze) but not yet implemented. Each returns a
 * valid handle object so Track C / Catalog code can reference them without
 * runtime errors. Full implementations are post-EP1 scope.
 *
 * All follow the factory convention: (target, opts) -> { start(), stop(), setParams(opts) }
 */

function _stubHandle(name) {
  if (typeof console !== 'undefined') {
    console.info(`[nebula.effects.${name}] stub — full implementation is post-EP1`);
  }
  return {
    start()         {},
    stop()          {},
    setParams(_o)   {},
  };
}

/**
 * nebula.effects.streaks — rare signal-streak transmissions crossing the canvas.
 * Source: Chrysalis liminal.js (signal streaks section). Post-EP1 full build.
 * @param {HTMLElement} target
 * @param {object} opts  { speed, color, rate }
 */
export function streaks(target, opts) {
  void target; void opts;
  return _stubHandle('streaks');
}

/**
 * nebula.effects.constellation — cursor-reactive star-connection lines.
 * Source: Chrysalis liminal.js (constellation reach section). Post-EP1 full build.
 * @param {HTMLElement} target
 * @param {object} opts  { seedPoints, connectRadius, color }
 */
export function constellation(target, opts) {
  void target; void opts;
  return _stubHandle('constellation');
}

/**
 * nebula.effects.haze — slow-drifting radial nebula blobs (gradient fog layer).
 * Source: Chrysalis liminal.js (drawHaze + haze canvas section). Post-EP1 full build.
 * @param {HTMLElement} target
 * @param {object} opts  { palette, opacity, speed }
 */
export function haze(target, opts) {
  void target; void opts;
  return _stubHandle('haze');
}
