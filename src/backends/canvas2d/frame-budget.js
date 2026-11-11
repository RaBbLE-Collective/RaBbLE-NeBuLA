/**
 * FrameBudget — EMA-smoothed time-slice allocator with priority ordering.
 *
 * Target: 14ms (leaves ~2.7ms browser overhead at 60fps).
 * Priority: eyes > portals > connections > particles > ambient.
 * Eyes and portals always draw. Connections are budgeted (binary skip).
 * Particles always draw — glow (shadowBlur) is degraded instead of skipping.
 *
 * All skip/allow decisions are made in beginFrame() from EMA predicted costs,
 * BEFORE any system draws. This prevents volatile per-frame remaining from
 * causing oscillation (e.g. connections getting starved by glow frames).
 *
 * Usage:
 *   budget.beginFrame()                // at start of _draw()
 *   budget.canGlow()                   // false when particles predicted over budget
 *   budget.canDraw('connections')      // stable pre-frame decision
 *   budget.record('particles', ms)     // after each system draws
 */

const TARGET_MS = 14;
const EMA_ALPHA = 0.15;  // ~7-frame smoothing window

export class FrameBudget {
  constructor(targetMs = TARGET_MS) {
    this._target             = targetMs;
    this._costs              = {};     // EMA draw cost per named system (ms)
    this._skips              = {};     // consecutive skip count per system
    this._remaining          = targetMs;
    this._glowAllowed        = true;
    this._connectionsAllowed = true;
  }

  // Call at the start of each _draw().
  // Pre-computes all skip/allow decisions from EMA predicted costs.
  // Using predicted rather than actual-this-frame prevents volatile remaining
  // from causing connections to get starved on glow-on frames.
  beginFrame() {
    const reservedAlways     = (this._costs['eyes'] ?? 0) + (this._costs['portals'] ?? 0);
    const predictedParticles = this._costs['particles'] ?? 0;
    this._remaining          = Math.max(0, this._target - reservedAlways);

    // Glow: hysteresis prevents oscillation at the boundary.
    // Turn off when particles predicted over budget; turn back on at 75% of budget.
    if (this._glowAllowed) {
      if (predictedParticles > this._remaining) this._glowAllowed = false;
    } else {
      if (predictedParticles < this._remaining * 0.75) this._glowAllowed = true;
    }

    // Connections: stable decision using no-glow particle estimate.
    // When glow is off, particles run ~3-4ms regardless of EMA history.
    // This prevents glow oscillation from starving connections.
    const flatParticles       = this._glowAllowed ? predictedParticles : Math.min(predictedParticles, 4);
    const predictedConns      = this._costs['connections'] ?? 0;
    this._connectionsAllowed  = (reservedAlways + flatParticles + predictedConns) <= this._target;
  }

  // Returns false when predicted particle cost exceeds the frame budget.
  // Caller skips shadowBlur — particles still draw every frame (no flicker).
  canGlow() { return this._glowAllowed; }

  // True when the field was skipped last frame — caller should also skip the
  // physics update so particle sin/cos never burns the eyes' frame budget.
  shouldSkipFieldUpdate() { return (this._skips['field'] ?? 0) > 0; }

  // Returns false when connections + everything else is predicted to exceed budget.
  // Uses a stable pre-frame decision so connections aren't starved by glow frames.
  canDraw(name, maxSkips = Infinity) {
    if (name === 'connections') {
      if ((this._skips[name] ?? 0) >= maxSkips) return true;
      if (!this._connectionsAllowed) {
        this._skips[name] = (this._skips[name] ?? 0) + 1;
        return false;
      }
      this._skips[name] = 0;
      return true;
    }
    // Generic path for future budgeted systems
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
      costs:            { ...this._costs },
      remaining:        this._remaining,
      target:           this._target,
      glowAllowed:      this._glowAllowed,
      connectionsAllowed: this._connectionsAllowed,
    };
  }
}
