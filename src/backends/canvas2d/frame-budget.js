/**
 * FrameBudget — EMA-smoothed time-slice allocator with priority ordering.
 *
 * Target: 14ms (leaves ~2.7ms browser overhead at 60fps).
 * Priority: eyes > portals > connections > particles > ambient.
 * Eyes and portals always draw. Connections are budgeted (binary skip).
 * Particles always draw — glow (shadowBlur) is degraded instead of skipping,
 * which avoids the flicker caused by frame-level particle omission.
 *
 * Usage:
 *   budget.beginFrame()                    // at start of _draw()
 *   budget.canGlow()                       // false when particles predicted over budget
 *   budget.canDraw('connections')          // binary skip for connections
 *   budget.record('particles', ms)         // after each system draws
 */

const TARGET_MS = 14;
const EMA_ALPHA = 0.15;  // ~7-frame smoothing window

export class FrameBudget {
  constructor(targetMs = TARGET_MS) {
    this._target      = targetMs;
    this._costs       = {};   // EMA draw cost per named system (ms)
    this._skips       = {};   // consecutive skip count per system
    this._remaining   = targetMs;
    this._glowAllowed = true;
  }

  // Call at the start of each _draw().
  // Reserves budget for always-draw systems (eyes + portals).
  // Pre-computes glow allowance for this frame based on predicted particle cost.
  beginFrame() {
    const reservedAlwaysDraw = (this._costs['eyes'] ?? 0) + (this._costs['portals'] ?? 0);
    this._remaining   = Math.max(0, this._target - reservedAlwaysDraw);
    // Glow allowed when predicted particle cost fits within the available pool.
    // When over budget, dropping shadowBlur cuts particle draw time by ~50-60%.
    this._glowAllowed = (this._costs['particles'] ?? 0) <= this._remaining;
  }

  // Returns false when particle draw cost is predicted to exceed budget.
  // Caller should skip shadowBlur calls — particles still draw (no flicker).
  canGlow() { return this._glowAllowed; }

  // Binary skip for connections. maxSkips=Infinity means no floor.
  // Connections can be fully dropped without flickering (thin lines, not filled shapes).
  canDraw(name, maxSkips = Infinity) {
    if ((this._skips[name] ?? 0) >= maxSkips) return true;
    if ((this._costs[name] ?? 0) > this._remaining) {
      this._skips[name] = (this._skips[name] ?? 0) + 1;
      return false;
    }
    return true;
  }

  // Call after a system actually draws with its real elapsed ms.
  record(name, ms) {
    this._costs[name] = EMA_ALPHA * ms + (1 - EMA_ALPHA) * (this._costs[name] ?? ms);
    this._skips[name] = 0;
    if (name !== 'eyes' && name !== 'portals') {
      this._remaining = Math.max(0, this._remaining - ms);
    }
  }

  get metrics() {
    return {
      costs:       { ...this._costs },
      remaining:   this._remaining,
      target:      this._target,
      glowAllowed: this._glowAllowed,
    };
  }
}
