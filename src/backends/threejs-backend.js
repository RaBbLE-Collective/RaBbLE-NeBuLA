/**
 * Three.js Backend — Layer 2 Quantum Visualization Renderer
 *
 * Flat-Chaos stream architecture with entropy-driven shading.
 * • InstancedMesh for efficient rendering of 1000+ entities @ 60fps
 * • Geometry cache: one BufferGeometry per primitive type
 * • Material cache: one MeshStandardMaterial per color config
 * • Entropy drives shader parameters: opacity, emissive intensity, scale
 */
import * as THREE from 'three';
import { Renderer } from './renderer.js';
import { palette, hexToNormalizedRgb, hexToRgb } from '../puppet/palette.js';

export class ThreeJsBackend extends Renderer {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    super();
    if (!canvas) throw new Error('ThreeJsBackend requires HTMLCanvasElement');

    this._canvas = canvas;
    this._dpr = window.devicePixelRatio || 1;
    this._rafId = null;

    // Three.js objects
    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(...this._rgbTuple(palette.bg));
    this._scene.fog = new THREE.Fog(
      new THREE.Color(...this._rgbTuple(palette.bg)),
      2000,
      3500
    );

    // Camera
    this._camera = new THREE.PerspectiveCamera(
      60,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      10000
    );
    this._camera.position.set(0, 0, 300);
    this._camera.lookAt(0, 0, 0);

    // Renderer
    this._renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this._renderer.setPixelRatio(this._dpr);
    this._renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this._renderer.shadowMap.enabled = true;
    this._renderer.shadowMap.type = THREE.PCFShadowShadowMap;

    // Lighting
    this._setupLighting();

    // Caches for geometry and materials
    this._geometryCache = new Map(); // type → BufferGeometry
    this._materialCache = new Map(); // "color_entropy" → MeshStandardMaterial
    this._instancedMeshes = new Map(); // "geom_mat" → InstancedMesh

    // Entity tracking
    this._entities = new Map(); // id → {mesh, index, entropy}
    this._entityCount = 0;

    // Performance metrics
    this._frameCount = 0;
    this._fps = 60;
    this._lastMetricsTime = performance.now();

    // Setup resize handler
    window.addEventListener('resize', () => this.resize());

    // Start animation loop
    this._startAnimationLoop();
  }

  /** Setup lighting for the scene */
  _setupLighting() {
    // Ambient light
    const ambientColor = palette.violet;
    const ambientIntensity = 0.5;
    this._scene.add(
      new THREE.AmbientLight(...this._rgbTuple(ambientColor), ambientIntensity)
    );

    // Key light (magenta)
    const keyLight = new THREE.DirectionalLight(...this._rgbTuple(palette.magenta), 1.2);
    keyLight.position.set(500, 500, 500);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.far = 2000;
    keyLight.shadow.camera.left = -1000;
    keyLight.shadow.camera.right = 1000;
    keyLight.shadow.camera.top = 1000;
    keyLight.shadow.camera.bottom = -1000;
    this._scene.add(keyLight);

    // Fill light (cyan)
    const fillLight = new THREE.DirectionalLight(...this._rgbTuple(palette.cyan), 0.8);
    fillLight.position.set(-300, 200, 200);
    this._scene.add(fillLight);
  }

  /** Convert hex color to RGB tuple (0-1 range) */
  _rgbTuple(hex) {
    const rgb = hexToNormalizedRgb(hex);
    return [rgb.r, rgb.g, rgb.b];
  }

  /** Get or create cached geometry */
  _getGeometry(type) {
    if (this._geometryCache.has(type)) {
      return this._geometryCache.get(type);
    }

    let geom;
    switch (type) {
      case 'sphere':
        geom = new THREE.IcosahedronGeometry(10, 3);
        break;
      case 'box':
        geom = new THREE.BoxGeometry(10, 10, 10);
        break;
      case 'octahedron':
        geom = new THREE.OctahedronGeometry(10, 2);
        break;
      case 'tetrahedron':
        geom = new THREE.TetrahedronGeometry(10, 1);
        break;
      default:
        geom = new THREE.SphereGeometry(10, 8, 8);
    }

    geom.computeBoundingSphere();
    this._geometryCache.set(type, geom);
    return geom;
  }

  /** Get or create cached material */
  _getMaterial(colorHex, entropy) {
    const key = `${colorHex}_${Math.round(entropy * 10)}`;
    if (this._materialCache.has(key)) {
      return this._materialCache.get(key);
    }

    const rgb = hexToNormalizedRgb(colorHex);
    const emissiveIntensity = Math.max(0.3, entropy) * 0.5;
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(rgb.r, rgb.g, rgb.b),
      emissive: new THREE.Color(rgb.r * emissiveIntensity, rgb.g * emissiveIntensity, rgb.b * emissiveIntensity),
      metalness: 0.3,
      roughness: 0.7 - entropy * 0.2,
      wireframe: entropy > 1.5,
    });
    material.castShadow = true;
    material.receiveShadow = true;
    this._materialCache.set(key, material);
    return material;
  }

  /** Start main animation loop */
  _startAnimationLoop() {
    const animate = () => {
      this._update();
      this._render();
      this._rafId = requestAnimationFrame(animate);
    };
    this._rafId = requestAnimationFrame(animate);
  }

  /** Update entity state each frame */
  _update() {
    // Gentle camera rotation for visual interest
    const elapsed = performance.now() * 0.0001;
    this._camera.position.x = Math.cos(elapsed) * 300;
    this._camera.position.z = Math.sin(elapsed) * 300;
    this._camera.lookAt(0, 0, 0);
  }

  /** Render the scene */
  _render() {
    this._renderer.render(this._scene, this._camera);
    this._frameCount++;
  }

  /**
   * Add or update an entity in the scene
   * @param {string} id - Unique entity ID
   * @param {string} type - Geometry type: 'sphere', 'box', etc.
   * @param {string} color - Hex color
   * @param {number} entropy - Entropy value (0+)
   * @param {THREE.Matrix4} matrix - Transform matrix
   */
  addEntity(id, type, color, entropy, matrix) {
    if (this._entities.has(id)) {
      this.updateEntity(id, color, entropy, matrix);
      return;
    }

    const geom = this._getGeometry(type);
    const mat = this._getMaterial(color, entropy);
    const key = `${type}_${color}`;

    let instancedMesh = this._instancedMeshes.get(key);
    if (!instancedMesh) {
      const count = 1024; // initial capacity
      instancedMesh = new THREE.InstancedMesh(geom, mat, count);
      instancedMesh.castShadow = true;
      instancedMesh.receiveShadow = true;
      this._scene.add(instancedMesh);
      this._instancedMeshes.set(key, instancedMesh);
    }

    const index = this._entityCount++;
    if (matrix) {
      instancedMesh.setMatrixAt(index, matrix);
      instancedMesh.instanceMatrix.needsUpdate = true;
    }

    this._entities.set(id, {
      mesh: instancedMesh,
      index,
      type,
      color,
      entropy,
    });
  }

  /**
   * Update an entity's state
   * @param {string} id - Entity ID
   * @param {string} color - New color (optional)
   * @param {number} entropy - New entropy (optional)
   * @param {THREE.Matrix4} matrix - New transform (optional)
   */
  updateEntity(id, color, entropy, matrix) {
    const entity = this._entities.get(id);
    if (!entity) return;

    if (matrix && entity.mesh) {
      entity.mesh.setMatrixAt(entity.index, matrix);
      entity.mesh.instanceMatrix.needsUpdate = true;
    }

    if (entropy !== undefined) {
      entity.entropy = entropy;
    }

    if (color && color !== entity.color) {
      // Recolor by updating material
      entity.color = color;
      const newMat = this._getMaterial(color, entropy || entity.entropy);
      entity.mesh.material = newMat;
    }
  }

  /**
   * Remove an entity from the scene
   * @param {string} id - Entity ID
   */
  removeEntity(id) {
    const entity = this._entities.get(id);
    if (entity) {
      // Note: actual removal from InstancedMesh requires reindexing all entities
      // For now, just remove from tracking
      this._entities.delete(id);
    }
  }

  /**
   * Render stream of entities (Flat-Chaos)
   * @param {Stream[]} streams - Array of entity streams
   */
  render(streams) {
    if (!streams || streams.length === 0) return;

    for (const stream of streams) {
      if (!stream.entities) continue;

      for (const ent of stream.entities) {
        const color = ent.color || palette.magenta;
        const entropy = ent.entropy || 0.5;
        const matrix = ent.matrix || new THREE.Matrix4();

        this.addEntity(ent.id, ent.type || 'sphere', color, entropy, matrix);
      }
    }
  }

  resize() {
    const w = this._canvas.clientWidth;
    const h = this._canvas.clientHeight;
    this._camera.aspect = w / h;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(w, h);
  }

  dispose() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    // Clean up Three.js resources
    this._geometryCache.forEach((g) => g.dispose());
    this._materialCache.forEach((m) => m.dispose());
    this._instancedMeshes.forEach((im) => im.geometry.dispose());
    this._renderer.dispose();
  }

  getPerformanceMetrics() {
    return {
      fps: this._fps,
      frameTime: 1000 / this._fps,
      entityCount: this._entities.size,
      drawCalls: this._instancedMeshes.size,
      materials: this._materialCache.size,
    };
  }
}
