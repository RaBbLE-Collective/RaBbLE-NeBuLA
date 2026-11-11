/**
 * BootSequence — Standalone boot timeline for Canvas2D and Three.js backends
 * Defines the complete boot animation: particle convergence, portal arcs, eye emergence
 * Duration: ~200ms (in frame ticks) at 60 FPS = ~3.3 seconds wall-clock
 */

export class BootSequence {
  constructor() {
    // Boot timeline (in frame ticks, where 60 ticks = ~1s at 60 FPS)
    this.T_CONVERGE_END  = 2.8 * 60;   // Particles converge toward center
    this.T_PORTALS_START = 0.4 * 60;   // Portal arcs begin drawing
    this.T_PORTALS_END   = 2.6 * 60;   // Portal arcs complete
    this.T_EYES_START    = 1.4 * 60;   // Eyes begin fading in
    this.T_EYES_OPEN     = 2.6 * 60;   // Eyes fully open
    this.T_EYES_FULL     = 3.2 * 60;   // Full emergence complete

    // Blink burst sequence (happens after eyes open)
    // Machine states: 0=waiting, 1=opening, 2=burst-blinking, 3=normal-blinking
    this.BURST_TOTAL = 5;
    this.BLINK_HOLD_AFTER_OPEN = 8;    // Frames to hold before first blink burst
    this.BLINK_DELAY_BETWEEN_BURSTS = 180;
    this.BLINK_DELAY_AFTER_BURSTS = 100;

    // State tracking
    this.isRunning = false;
    this.timeline = 0;
  }

  /**
   * Reset boot timeline to start (t=0)
   */
  reset() {
    this.timeline = 0;
    this.isRunning = true;
  }

  /**
   * Step the boot timeline forward
   * @param {number} deltaFrames - Frames to advance (typically 1 per frame at 60 FPS)
   */
  step(deltaFrames = 1) {
    if (this.isRunning) {
      this.timeline += deltaFrames;
      // Boot completes at T_EYES_FULL
      if (this.timeline > this.T_EYES_FULL + 60) {
        this.isRunning = false;
      }
    }
  }

  /**
   * Get progress of particle convergence (0 to 1)
   */
  getConvergenceProgress() {
    return this.timeline > this.T_CONVERGE_END ? 1 : Math.min(1, this.timeline / this.T_CONVERGE_END);
  }

  /**
   * Get progress of portal arc drawing (0 to 1)
   */
  getPortalProgress() {
    if (this.timeline < this.T_PORTALS_START) return 0;
    if (this.timeline >= this.T_PORTALS_END) return 1;
    return (this.timeline - this.T_PORTALS_START) / (this.T_PORTALS_END - this.T_PORTALS_START);
  }

  /**
   * Get progress of eye emergence and opening (0 to 1)
   */
  getEyesProgress() {
    if (this.timeline < this.T_EYES_START) return 0;
    if (this.timeline >= this.T_EYES_FULL) return 1;
    return (this.timeline - this.T_EYES_START) / (this.T_EYES_FULL - this.T_EYES_START);
  }

  /**
   * Get progress of eye opening (fade-in phase, 0 to 1)
   * Used for the emerge animation from closed to open
   */
  getEyeOpenProgress() {
    if (this.timeline < this.T_EYES_START) return 0;
    if (this.timeline >= this.T_EYES_OPEN) return 1;
    return (this.timeline - this.T_EYES_START) / (this.T_EYES_OPEN - this.T_EYES_START);
  }

  /**
   * Get current boot phase as a string
   */
  getPhase() {
    if (this.timeline < this.T_PORTALS_START) return 'converging';
    if (this.timeline < this.T_PORTALS_END) return 'portals';
    if (this.timeline < this.T_EYES_START) return 'portal-steady';
    if (this.timeline < this.T_EYES_OPEN) return 'eyes-opening';
    if (this.timeline < this.T_EYES_FULL) return 'eyes-settling';
    return 'complete';
  }

  /**
   * Check if boot is still active
   */
  isActive() {
    return this.isRunning && this.timeline <= this.T_EYES_FULL;
  }
}

export default BootSequence;
