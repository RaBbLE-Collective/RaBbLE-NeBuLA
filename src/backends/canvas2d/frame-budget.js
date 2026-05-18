/**
 * FrameBudget — time-slice allocator with priority ordering.
 * Phase 1: passthrough stub. Phase 2 wires EMA cost tracking and skipping.
 *
 * Priority order: eyes > portals > connections > particles > ambient
 */
export class FrameBudget {
  canDraw(_systemName) { return true; }
  record(_systemName, _ms) {}
}
