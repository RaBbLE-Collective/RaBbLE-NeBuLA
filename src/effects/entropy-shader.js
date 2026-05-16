/**
 * EntropyShader — GLSL shader pair for entropy-driven instanced rendering.
 * Vertex shader: per-instance size/opacity/emissive + entropy displacement.
 * Fragment shaders: flat (no glow) and emissive (glow) variants.
 */

export class EntropyShader {
  constructor(config = {}) {
    this.displacementScale = config.displacementScale ?? 0.1;
    this.colorVariance     = config.colorVariance     ?? 0.15;
    this.animationSpeed    = config.animationSpeed    ?? 0.5;
  }

  vertexShader() {
    return `
      attribute float instanceSize;
      attribute float instanceOpacity;
      attribute float instanceEmissive;
      attribute vec3 instanceColor;

      uniform float u_time;
      uniform float u_entropy;

      varying float v_instanceOpacity;
      varying float v_instanceEmissive;
      varying vec3 v_instanceColor;
      varying vec3 v_position;
      varying vec3 v_normal;

      void main() {
        v_instanceOpacity = instanceOpacity;
        v_instanceEmissive = instanceEmissive;
        v_instanceColor = instanceColor;
        v_position = position;
        v_normal = normal;

        float noise = sin(position.x * 2.0 + u_time) * cos(position.y * 2.0 + u_time * 1.5);
        float displacement = noise * u_entropy * ${this.displacementScale.toFixed(3)};

        vec3 transformed = position * instanceSize + normal * displacement;

        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(transformed, 1.0);
      }
    `;
  }

  fragmentShaderFlat() {
    return `
      precision highp float;

      uniform float u_time;
      uniform float u_entropy;

      varying float v_instanceOpacity;
      varying float v_instanceEmissive;
      varying vec3 v_instanceColor;
      varying vec3 v_position;
      varying vec3 v_normal;

      void main() {
        vec3 color = v_instanceColor;

        vec3 entropyColor = vec3(
          sin(v_position.x * 2.0 + u_time) * 0.5 + 0.5,
          cos(v_position.y * 2.0 + u_time * 1.5) * 0.5 + 0.5,
          sin(v_position.z * 2.0 + u_time * 0.8) * 0.5 + 0.5
        );
        color = mix(color, entropyColor, u_entropy * ${this.colorVariance.toFixed(3)} * 0.33);

        gl_FragColor = vec4(color, v_instanceOpacity);
      }
    `;
  }

  fragmentShaderEmissive() {
    return `
      precision highp float;

      uniform float u_time;
      uniform float u_entropy;

      varying float v_instanceOpacity;
      varying float v_instanceEmissive;
      varying vec3 v_instanceColor;
      varying vec3 v_position;
      varying vec3 v_normal;

      void main() {
        vec3 color = v_instanceColor;

        vec3 entropyColor = vec3(
          sin(v_position.x * 2.0 + u_time) * 0.5 + 0.5,
          cos(v_position.y * 2.0 + u_time * 1.5) * 0.5 + 0.5,
          sin(v_position.z * 2.0 + u_time * 0.8) * 0.5 + 0.5
        );
        color = mix(color, entropyColor, u_entropy * ${this.colorVariance.toFixed(3)});

        color += color * v_instanceEmissive * 2.0;

        gl_FragColor = vec4(color, v_instanceOpacity);
      }
    `;
  }
}
