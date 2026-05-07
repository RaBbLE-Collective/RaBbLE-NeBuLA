// Entropy shader — maps entity.entropy (0.0–1.0) to vertex displacement and color variation
// TODO: implement GLSL vertex/fragment shader generation
// Reference: EXTRACTION_ANALYSIS.md §2.3

export interface EntropyShaderConfig {
  displacementScale?: number; // How much entropy displaces vertices
  colorVariance?: number;     // How much entropy shifts hue
  animationSpeed?: number;    // Rate of entropy-driven animation
}

export class EntropyShader {
  config: Required<EntropyShaderConfig>;

  constructor(config: EntropyShaderConfig = {}) {
    this.config = {
      displacementScale: config.displacementScale ?? 0.3,
      colorVariance: config.colorVariance ?? 0.2,
      animationSpeed: config.animationSpeed ?? 1.0,
    };
  }

  // Returns GLSL vertex shader source
  vertexShader(): string {
    throw new Error('EntropyShader.vertexShader() not yet implemented');
  }

  // Returns GLSL fragment shader source
  fragmentShader(): string {
    throw new Error('EntropyShader.fragmentShader() not yet implemented');
  }
}
