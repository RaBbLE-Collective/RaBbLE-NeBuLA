/**
 * Three.js Backend — Layer 2 Quantum Visualization Renderer
 *
 * Flat-Chaos stream architecture with entropy-driven custom shaders.
 * - InstancedMesh for 1000+ entities at 60fps
 * - Custom vertex/fragment shaders with per-instance attributes
 * - Two material types: flat (outlines, portals) and emissive (particles, aura)
 * - Entropy drives displacement, color variance, and emissive intensity
 *
 * NOTE: Three.js is a peer dependency loaded externally.
 */
import { Renderer } from './renderer.js';
import { EntropyShader } from '../effects/entropy-shader.js';
import { palette, hexToNormalizedRgb } from '../puppet/palette.js';

const MAX_INSTANCES = 2048;

export class ThreeJsBackend extends Renderer {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas, opts = {}) {
    super();
    if (!canvas) throw new Error('ThreeJsBackend requires HTMLCanvasElement');

    const THREE = typeof window !== 'undefined' && window.THREE;
    if (!THREE) {
      throw new Error('ThreeJsBackend requires Three.js loaded as a peer dependency.');
    }

    this._canvas = canvas;
    this._THREE = THREE;
    this._dpr = Math.min(window.devicePixelRatio || 1, 2);
    this._rafId = null;
    this._time = 0;
    this._entropy = 0.5;

    // Shader system
    this._shader = new EntropyShader({
      displacementScale: opts.displacementScale ?? 0.1,
      colorVariance: opts.colorVariance ?? 0.15,
      animationSpeed: opts.animationSpeed ?? 0.5,
    });

    // Scene
    this._scene = new THREE.Scene();
    const bgRgb = hexToNormalizedRgb(palette.bg);
    this._scene.background = new THREE.Color(bgRgb.r, bgRgb.g, bgRgb.b);
    this._scene.fog = new THREE.Fog(
      new THREE.Color(bgRgb.r, bgRgb.g, bgRgb.b), 2000, 3500
    );

    // Camera
    this._camera = new THREE.PerspectiveCamera(
      60, canvas.clientWidth / canvas.clientHeight, 0.1, 10000
    );
    this._camera.position.set(0, 0, 300);

    // Renderer
    this._renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: false, powerPreference: 'high-performance',
    });
    this._renderer.setPixelRatio(this._dpr);
    this._renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    // Lighting (ambient + directional for non-shader meshes)
    this._setupLighting();

    // Shader uniforms (shared across all custom materials)
    this._uniforms = {
      u_time:    { value: 0 },
      u_entropy: { value: 0.5 },
    };

    // Shader materials
    this._flatMaterial = this._createShaderMaterial('flat');
    this._emissiveMaterial = this._createShaderMaterial('emissive');

    // Geometry cache
    this._geometryCache = new Map();

    // Instanced mesh pools: keyed by "geomType_materialType"
    this._pools = new Map();

    // Entity → pool assignment tracking
    this._entityMap = new Map();

    // Performance
    this._frameCount = 0;
    this._fps = 60;
    this._lastMetricsTime = performance.now();

    window.addEventListener('resize', () => this.resize());
    this._startLoop();
  }

  _setupLighting() {
    const THREE = this._THREE;
    const violetRgb = hexToNormalizedRgb(palette.violet);
    this._scene.add(new THREE.AmbientLight(
      new THREE.Color(violetRgb.r, violetRgb.g, violetRgb.b), 0.5
    ));

    const magentaRgb = hexToNormalizedRgb(palette.magenta);
    const key = new THREE.DirectionalLight(
      new THREE.Color(magentaRgb.r, magentaRgb.g, magentaRgb.b), 1.2
    );
    key.position.set(500, 500, 500);
    this._scene.add(key);

    const cyanRgb = hexToNormalizedRgb(palette.cyan);
    const fill = new THREE.DirectionalLight(
      new THREE.Color(cyanRgb.r, cyanRgb.g, cyanRgb.b), 0.8
    );
    fill.position.set(-300, 200, 200);
    this._scene.add(fill);
  }

  _createShaderMaterial(type) {
    const THREE = this._THREE;
    const vertexShader = this._shader.vertexShader();
    const fragmentShader = type === 'emissive'
      ? this._shader.fragmentShaderEmissive()
      : this._shader.fragmentShaderFlat();

    return new THREE.ShaderMaterial({
      uniforms: this._uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
  }

  _getGeometry(type) {
    if (this._geometryCache.has(type)) return this._geometryCache.get(type);

    const THREE = this._THREE;
    let geom;
    switch (type) {
      case 'sphere':      geom = new THREE.IcosahedronGeometry(10, 3); break;
      case 'box':         geom = new THREE.BoxGeometry(10, 10, 10); break;
      case 'tetrahedron': geom = new THREE.TetrahedronGeometry(10, 1); break;
      case 'plane':       geom = new THREE.PlaneGeometry(10, 10); break;
      default:            geom = new THREE.SphereGeometry(10, 8, 8); break;
    }
    this._geometryCache.set(type, geom);
    return geom;
  }

  /**
   * Get or create an instanced mesh pool for a geometry+material combo.
   * Each pool has per-instance attribute buffers.
   */
  _getPool(geomType, matType) {
    const key = `${geomType}_${matType}`;
    if (this._pools.has(key)) return this._pools.get(key);

    const THREE = this._THREE;
    const geom = this._getGeometry(geomType);
    const mat = matType === 'emissive' ? this._emissiveMaterial : this._flatMaterial;

    const mesh = new THREE.InstancedMesh(geom, mat, MAX_INSTANCES);
    mesh.count = 0;
    mesh.frustumCulled = false;

    // Per-instance attributes
    const sizeAttr    = new THREE.InstancedBufferAttribute(new Float32Array(MAX_INSTANCES), 1);
    const opacityAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAX_INSTANCES), 1);
    const emissiveAttr= new THREE.InstancedBufferAttribute(new Float32Array(MAX_INSTANCES), 1);
    const colorAttr   = new THREE.InstancedBufferAttribute(new Float32Array(MAX_INSTANCES * 3), 3);

    // Set defaults
    for (let i = 0; i < MAX_INSTANCES; i++) {
      sizeAttr.setX(i, 1.0);
      opacityAttr.setX(i, 1.0);
      emissiveAttr.setX(i, 0.0);
      colorAttr.setXYZ(i, 1, 1, 1);
    }

    mesh.geometry.setAttribute('instanceSize', sizeAttr);
    mesh.geometry.setAttribute('instanceOpacity', opacityAttr);
    mesh.geometry.setAttribute('instanceEmissive', emissiveAttr);
    mesh.geometry.setAttribute('instanceColor', colorAttr);

    this._scene.add(mesh);
    const pool = { mesh, sizeAttr, opacityAttr, emissiveAttr, colorAttr, count: 0 };
    this._pools.set(key, pool);
    return pool;
  }

  /**
   * Render streams of entities (Flat-Chaos pattern).
   * Called each frame by the Runtime.
   * @param {import('../core/stream.js').Stream[]} streams
   */
  render(streams) {
    if (!streams || streams.length === 0) return;

    // Reset all pool counts
    for (const pool of this._pools.values()) pool.count = 0;
    this._entityMap.clear();

    const THREE = this._THREE;
    const matrix = new THREE.Matrix4();

    for (const stream of streams) {
      const entities = stream.getAll();
      for (const ent of entities) {
        const geomType = ent.geometry || 'sphere';
        const matType = (ent.entropy > 0.5 || ent.properties?.emissive) ? 'emissive' : 'flat';
        const pool = this._getPool(geomType, matType);

        if (pool.count >= MAX_INSTANCES) continue;

        const idx = pool.count++;
        const [x, y, z] = ent.position;
        const [sx, sy, sz] = ent.scale;

        matrix.makeScale(sx, sy, sz);
        matrix.setPosition(x, y, z);
        pool.mesh.setMatrixAt(idx, matrix);

        pool.sizeAttr.setX(idx, (sx + sy + sz) / 3);
        pool.opacityAttr.setX(idx, ent.opacity ?? 1.0);
        pool.emissiveAttr.setX(idx, ent.entropy * 0.8);

        if (ent.color) {
          pool.colorAttr.setXYZ(idx, ent.color[0], ent.color[1], ent.color[2]);
        } else {
          const rgb = hexToNormalizedRgb(palette.magenta);
          pool.colorAttr.setXYZ(idx, rgb.r, rgb.g, rgb.b);
        }
      }
    }

    // Finalize all pools
    for (const pool of this._pools.values()) {
      pool.mesh.count = pool.count;
      pool.mesh.instanceMatrix.needsUpdate = true;
      pool.sizeAttr.needsUpdate = true;
      pool.opacityAttr.needsUpdate = true;
      pool.emissiveAttr.needsUpdate = true;
      pool.colorAttr.needsUpdate = true;
    }
  }

  /** Set global entropy level (drives shader uniforms). */
  setEntropy(value) {
    this._entropy = Math.max(0, Math.min(1, value));
    this._uniforms.u_entropy.value = this._entropy;
  }

  _startLoop() {
    const animate = () => {
      this._time += 0.016 * this._shader.animationSpeed;
      this._uniforms.u_time.value = this._time;

      // Gentle camera orbit
      const elapsed = performance.now() * 0.00008;
      this._camera.position.x = Math.cos(elapsed) * 300;
      this._camera.position.z = Math.sin(elapsed) * 300;
      this._camera.lookAt(0, 0, 0);

      this._renderer.render(this._scene, this._camera);
      this._updateMetrics();
      this._rafId = requestAnimationFrame(animate);
    };
    this._rafId = requestAnimationFrame(animate);
  }

  _updateMetrics() {
    this._frameCount++;
    const now = performance.now();
    const elapsed = now - this._lastMetricsTime;
    if (elapsed >= 1000) {
      this._fps = Math.round(this._frameCount * 1000 / elapsed);
      this._frameCount = 0;
      this._lastMetricsTime = now;
    }
  }

  resize() {
    const w = this._canvas.clientWidth;
    const h = this._canvas.clientHeight;
    if (w === 0 || h === 0) return;
    this._camera.aspect = w / h;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(w, h);
  }

  dispose() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    for (const pool of this._pools.values()) {
      pool.mesh.geometry.dispose();
    }
    this._flatMaterial.dispose();
    this._emissiveMaterial.dispose();
    this._geometryCache.forEach(g => g.dispose());
    this._renderer.dispose();
  }

  getPerformanceMetrics() {
    let totalEntities = 0;
    for (const pool of this._pools.values()) totalEntities += pool.count;
    return {
      fps: this._fps,
      frameTime: 1000 / this._fps,
      entityCount: totalEntities,
      drawCalls: this._pools.size,
      pools: this._pools.size,
    };
  }
}
