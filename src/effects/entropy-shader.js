// Entropy shader — maps entity.entropy (0.0–1.0) to vertex displacement and color variance
// TODO: implement GLSL generation — see docs/EXTRACTION_ANALYSIS.md §2.3

/**
 * @typedef {Object} EntropyShaderConfig
 * @property {number} [displacementScale] - how much entropy displaces vertices (default 0.3)
 * @property {number} [colorVariance]     - how much entropy shifts hue (default 0.2)
 * @property {number} [animationSpeed]    - rate of entropy-driven animation (default 1.0)
 */

export class EntropyShader {
  /** @param {EntropyShaderConfig} [config] */
  constructor(config = {}) {
    this.displacementScale = config.displacementScale ?? 0.3;
    this.colorVariance     = config.colorVariance     ?? 0.2;
    this.animationSpeed    = config.animationSpeed    ?? 1.0;
  }

  /** @returns {string} GLSL vertex shader source */
  vertexShader() { throw new Error('EntropyShader.vertexShader() not yet implemented'); }

  /** @returns {string} GLSL fragment shader source */
  fragmentShader() { throw new Error('EntropyShader.fragmentShader() not yet implemented'); }
}
