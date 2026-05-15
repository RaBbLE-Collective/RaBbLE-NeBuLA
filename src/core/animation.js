/**
 * AnimationMixer — smooth entropy state transitions
 *
 * Maps entity states (idle, thinking, speaking) to entropy values,
 * and animates smooth transitions between them.
 */

const STATE_ENTROPY = {
  idle:     0.3,
  thinking: 0.6,
  speaking: 0.8,
};

export class AnimationMixer {
  constructor() {
    /** @type {Map<import('./stream.js').Stream, {stream: import('./stream.js').Stream, target: number, duration: number, elapsed: number, startValues: number[]}>} */
    this._transitions = new Map();
  }

  /**
   * Start a smooth entropy transition for all entities in a stream.
   * @param {import('./stream.js').Stream} stream
   * @param {'idle'|'thinking'|'speaking'|number} toState - named state or direct entropy 0.0-1.0
   * @param {number} durationMs - animation duration
   */
  transition(stream, toState, durationMs = 800) {
    const target = typeof toState === 'number' ? toState : (STATE_ENTROPY[toState] ?? 0.3);
    const entities = stream.getAll();
    this._transitions.set(stream, {
      stream,
      target,
      duration: durationMs,
      elapsed: 0,
      startValues: entities.map(e => e.entropy),
    });
  }

  /**
   * Update all active transitions.
   * Call this every frame from the runtime.
   * @param {number} deltaMs - milliseconds since last frame
   */
  update(deltaMs) {
    for (const [stream, tx] of this._transitions) {
      tx.elapsed += deltaMs;
      const t = Math.min(tx.elapsed / tx.duration, 1);
      // Ease-in-out quadratic easing curve
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      const entities = stream.getAll();
      for (let i = 0; i < entities.length; i++) {
        const start = tx.startValues[i] ?? 0.5;
        entities[i].entropy = start + (tx.target - start) * eased;
      }

      if (t >= 1) this._transitions.delete(stream);
    }
  }

  /** Get the current state entropy value. Used for debugging. */
  getStateEntropy(state) {
    return STATE_ENTROPY[state] ?? state;
  }
}
