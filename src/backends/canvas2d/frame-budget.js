/**
 * FrameBudget — EMA-smoothed time-slice allocator with priority ordering.
 *
 * Target: 14ms (leaves ~2.7ms browser overhead at 60fps).
 * Priority: eyes > portals > connections > particles > ambient.
 * Eyes and portals always draw. Connections and particles are budgeted.
 *
 * Usage:
 *   budget.beginFrame()           // call at start of _draw()
 *   budget.canDraw('particles', 2)  // check + maybe skip (maxSkips=2 → 20fps floor)
 *   budget.record('particles', ms)  // call after each system draws
 */

const TARGET_MS = 14;
const EMA_ALPHA = 0.15;  // ~7-frame smoothing window

export class FrameBudget {
  constructor(targetMs = TARGET_MS) {
    this._target    = targetMs;
    this._costs     = {};   // EMA draw cost per named system (ms)
    this._skips     = {};   // consecutive skip count per system
    this._remaining = targetMs;
  }

  // Call at the start of each _draw(). Reserves budget for always-draw systems
  // (eyes + portals) based on their EMA cost from previous frames.
  beginFrame() {
    const reserved = (this._costs['eyes'] ?? 0) + (this._costs['portals'] ?? 0);
    this._remaining = Math.max(0, this._target - reserved);
  }

  // Returns predicted cost for next frame (EMA of historical draw times).
  predicted(name) { return this._costs[name] ?? 0; }

  // Returns true if system should draw this frame.
  //   maxSkips: maximum consecutive frames to skip. Infinity = can skip indefinitely.
  //   2 → draw at least every 3rd frame (20fps floor at 60fps).
  canDraw(name, maxSkips = Infinity) {
    if ((this._skips[name] ?? 0) >= maxSkips) return true;  // floor: force draw
    if (this.predicted(name) > this._remaining) {
      this._skips[name] = (this._skips[name] ?? 0) + 1;
      return false;
    }
    return true;
  }

  // Call after a system actually draws with its real elapsed ms.
  // Deducts from remaining budget and updates EMA.
  record(name, ms) {
    this._costs[name] = EMA_ALPHA * ms + (1 - EMA_ALPHA) * (this._costs[name] ?? ms);
    this._skips[name] = 0;
    // Only deduct from the shared pool for budgeted systems
    if (name !== 'eyes' && name !== 'portals') {
      this._remaining = Math.max(0, this._remaining - ms);
    }
  }

  get metrics() {
    return {
      costs:     { ...this._costs },
      remaining: this._remaining,
      target:    this._target,
    };
  }
}
