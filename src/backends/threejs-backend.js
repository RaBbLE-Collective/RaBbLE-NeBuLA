/**
 * Three.js Backend — Layer 2 Quantum Visualization Renderer
 *
 * Renders the full RaBbLE entity in 3D: particle nebula, connection lines,
 * portal arcs, eyes with tracking/blinking, and boot animation.
 * Mirrors the Canvas2D entity but with orbit capability.
 *
 * NOTE: Three.js is a peer dependency loaded externally.
 */
import { Renderer } from './renderer.js';
import { BootSequence } from '../core/boot-sequence.js';
import { palette, hexToNormalizedRgb } from '../puppet/palette.js';

const MAX_INSTANCES = 4096;
// Density tuned down from 2000/600 — the dense cloud read as a solid blob and
// buried the eyes. Fewer, smaller, additively-blended particles give an airy
// luminous nebula you can see the eyes through.
const BODY_COUNT = 650;
const AURA_COUNT = 220;

export class ThreeJsBackend extends Renderer {
  constructor(canvas, opts = {}) {
    super();
    if (!canvas) throw new Error('ThreeJsBackend requires HTMLCanvasElement');

    const THREE = typeof window !== 'undefined' && window.THREE;
    if (!THREE) throw new Error('ThreeJsBackend requires Three.js loaded as a peer dependency.');

    this._canvas = canvas;
    this._THREE = THREE;
    this._dpr = Math.min(window.devicePixelRatio || 1, 2);
    this._rafId = null;
    this._time = 0;
    this._entropy = 0.3;
    this._state = 'idle';

    // Boot
    this._bootSeq = new BootSequence();
    this._inBoot = false;
    this._bootParticlePositions = null;

    // Blink state
    this._blinkScale = 1.0;
    this._lastBlinkTime = 0;
    this._nextBlinkDelay = 3.5 + Math.random() * 2;
    this._isBlinking = false;
    this._blinkStartTime = 0;
    this._eyeOpenProgress = 1.0;

    // Eye tracking
    this._mouseX = 0;
    this._mouseY = 0;
    this._eyeTargetX = 0;
    this._eyeTargetY = 0;
    this._eyeCurrentX = 0;
    this._eyeCurrentY = 0;

    // Scene
    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(0x020008);
    this._scene.fog = new THREE.Fog(0x020008, 40, 120);

    // Camera
    this._camera = new THREE.PerspectiveCamera(
      65, canvas.clientWidth / canvas.clientHeight, 0.1, 1000
    );
    this._camera.position.set(0, 0.3, 6);

    // Renderer
    this._renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: false, powerPreference: 'high-performance',
    });
    this._renderer.setPixelRatio(this._dpr);
    this._renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    // Orbit state (manual implementation — no OrbitControls dependency)
    this._orbitTheta = 0;
    this._orbitPhi = Math.PI / 2;
    this._orbitRadius = 6;
    this._orbitTarget = new THREE.Vector3(0, 0.3, 0);
    this._isDragging = false;
    this._lastPointerX = 0;
    this._lastPointerY = 0;
    this._autoRotateSpeed = 0.0001;
    this._setupOrbitControls();

    // Groups
    this._entityGroup = new THREE.Group();
    this._eyeGroup = new THREE.Group();
    this._portalGroup = new THREE.Group();
    this._connectionGroup = new THREE.Group();
    this._scene.add(this._entityGroup);
    this._scene.add(this._connectionGroup);
    this._scene.add(this._portalGroup);
    this._scene.add(this._eyeGroup);

    // Build entity
    this._buildParticles();
    this._buildEyes();
    this._buildPortals();
    this._buildConnections();

    // Mouse tracking for eyes
    this._setupMouseTracking();

    // Performance
    this._frameCount = 0;
    this._fps = 60;
    this._lastMetricsTime = performance.now();

    window.addEventListener('resize', () => this.resize());
    this._startLoop();
  }

  // ── Orbit Controls (manual) ─────────────────────────────────────────────

  _setupOrbitControls() {
    const canvas = this._canvas;

    canvas.addEventListener('pointerdown', (e) => {
      this._isDragging = true;
      this._lastPointerX = e.clientX;
      this._lastPointerY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!this._isDragging) return;
      const dx = e.clientX - this._lastPointerX;
      const dy = e.clientY - this._lastPointerY;
      this._lastPointerX = e.clientX;
      this._lastPointerY = e.clientY;

      this._orbitTheta -= dx * 0.005;
      this._orbitPhi = Math.max(0.3, Math.min(Math.PI - 0.3, this._orbitPhi - dy * 0.005));
    });

    canvas.addEventListener('pointerup', (e) => {
      this._isDragging = false;
      canvas.releasePointerCapture(e.pointerId);
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this._orbitRadius = Math.max(3, Math.min(20, this._orbitRadius + e.deltaY * 0.005));
    }, { passive: false });
  }

  _updateCamera() {
    if (!this._isDragging) {
      this._orbitTheta += this._autoRotateSpeed;
    }

    const r = this._orbitRadius;
    const theta = this._orbitTheta;
    const phi = this._orbitPhi;

    this._camera.position.set(
      this._orbitTarget.x + r * Math.sin(phi) * Math.sin(theta),
      this._orbitTarget.y + r * Math.cos(phi),
      this._orbitTarget.z + r * Math.sin(phi) * Math.cos(theta)
    );
    this._camera.lookAt(this._orbitTarget);
  }

  // ── Mouse tracking for eyes ─────────────────────────────────────────────

  _setupMouseTracking() {
    document.addEventListener('mousemove', (e) => {
      this._mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      this._mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    });
  }

  // ── Particle system ─────────────────────────────────────────────────────

  _buildParticles() {
    const THREE = this._THREE;

    // Body particles — instanced spheres
    const bodyGeom = new THREE.SphereGeometry(0.5, 8, 8);
    // Additive blending — overlapping particles add light (glowing gas) instead of
    // stacking as opaque plastic spheres. This is what makes the cloud read as a
    // nebula rather than a solid mass.
    const bodyMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this._bodyMesh = new THREE.InstancedMesh(bodyGeom, bodyMat, BODY_COUNT);
    this._bodyMesh.frustumCulled = false;
    this._bodyMesh.count = BODY_COUNT;

    // Per-instance color — driven by the RaBbLE palette (no raw hex).
    // Core is violet, fading to electric cyan at the rim, with hot-magenta and
    // white-spark accents. This is the signature neon identity, not the old
    // muted purple→blue ramp.
    const violet = hexToNormalizedRgb(palette.violet);   // #bf5fff
    const cyan   = hexToNormalizedRgb(palette.cyan);      // #00f5ff
    const magenta = hexToNormalizedRgb(palette.magenta);  // #ff2d78
    const spark  = { r: 0.86, g: 0.92, b: 1.0 };          // white-blue highlight

    const bodyColors = new Float32Array(BODY_COUNT * 3);
    this._bodyData = [];

    for (let i = 0; i < BODY_COUNT; i++) {
      const r = 0.3 + Math.pow(Math.random(), 0.45) * 1.7;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const normDist = r / 2.0;

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      // Violet core → cyan rim
      let cr = violet.r + (cyan.r - violet.r) * normDist;
      let cg = violet.g + (cyan.g - violet.g) * normDist;
      let cb = violet.b + (cyan.b - violet.b) * normDist;

      const rnd = Math.random();
      if (rnd < 0.12)      { cr = spark.r;   cg = spark.g;   cb = spark.b; }
      else if (rnd < 0.26) { cr = magenta.r; cg = magenta.g; cb = magenta.b; }

      const s = 0.035 + Math.random() * 0.10;
      const opacity = 0.7 - normDist * 0.3;

      bodyColors[i * 3] = cr;
      bodyColors[i * 3 + 1] = cg;
      bodyColors[i * 3 + 2] = cb;

      this._bodyData.push({ x, y, z, s, opacity, phase: Math.random() * Math.PI * 2 });
    }

    this._bodyMesh.instanceColor = new THREE.InstancedBufferAttribute(bodyColors, 3);
    this._entityGroup.add(this._bodyMesh);

    // Aura particles
    const auraGeom = new THREE.SphereGeometry(0.5, 6, 6);
    const auraMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this._auraMesh = new THREE.InstancedMesh(auraGeom, auraMat, AURA_COUNT);
    this._auraMesh.frustumCulled = false;
    this._auraMesh.count = AURA_COUNT;

    const auraColors = new Float32Array(AURA_COUNT * 3);
    this._auraData = [];

    // Palette-driven aura tints — violet / cyan / magenta / white spark.
    const auraColorOptions = [
      [violet.r,  violet.g,  violet.b],
      [cyan.r,    cyan.g,    cyan.b],
      [magenta.r, magenta.g, magenta.b],
      [0.86,      0.92,      1.0],
    ];

    for (let i = 0; i < AURA_COUNT; i++) {
      const r = 2.2 + Math.random() * 4.0;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      const s = 0.025 + Math.random() * 0.07;
      const opacity = 0.2 + Math.random() * 0.4;
      const color = auraColorOptions[Math.floor(Math.random() * auraColorOptions.length)];

      auraColors[i * 3] = color[0];
      auraColors[i * 3 + 1] = color[1];
      auraColors[i * 3 + 2] = color[2];

      this._auraData.push({ x, y, z, s, opacity, phase: Math.random() * Math.PI * 2 });
    }

    this._auraMesh.instanceColor = new THREE.InstancedBufferAttribute(auraColors, 3);
    this._entityGroup.add(this._auraMesh);

    this._updateParticleMatrices(1.0);
  }

  _updateParticleMatrices(convergence) {
    const THREE = this._THREE;
    const matrix = new THREE.Matrix4();
    const t = this._time;

    for (let i = 0; i < BODY_COUNT; i++) {
      const d = this._bodyData[i];
      const entropyMul = 1 + this._entropy * 0.5;
      const drift = 0.15 * entropyMul;

      let px = d.x + Math.sin(d.phase + t * 0.3) * drift;
      let py = d.y + Math.cos(d.phase * 0.7 + t * 0.2) * drift * 0.8;
      let pz = d.z + Math.sin(d.phase * 1.3 + t * 0.25) * drift * 0.6;

      if (convergence < 1) {
        const scatter = (1 - convergence) * 12;
        px = px * convergence + (Math.sin(i * 0.1) * scatter) * (1 - convergence);
        py = py * convergence + (Math.cos(i * 0.13) * scatter) * (1 - convergence);
        pz = pz * convergence + (Math.sin(i * 0.17) * scatter) * (1 - convergence);
      }

      const s = d.s;
      matrix.makeScale(s, s, s);
      matrix.setPosition(px, py, pz);
      this._bodyMesh.setMatrixAt(i, matrix);
    }
    this._bodyMesh.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < AURA_COUNT; i++) {
      const d = this._auraData[i];
      const entropyMul = 1 + this._entropy * 0.8;
      const drift = 0.3 * entropyMul;

      let px = d.x + Math.sin(d.phase + t * 0.15) * drift;
      let py = d.y + Math.cos(d.phase * 0.6 + t * 0.12) * drift;
      let pz = d.z + Math.sin(d.phase * 1.1 + t * 0.18) * drift * 0.7;

      if (convergence < 1) {
        const scatter = (1 - convergence) * 18;
        px = px * convergence + (Math.cos(i * 0.09) * scatter) * (1 - convergence);
        py = py * convergence + (Math.sin(i * 0.11) * scatter) * (1 - convergence);
        pz = pz * convergence + (Math.cos(i * 0.14) * scatter) * (1 - convergence);
      }

      const s = d.s;
      matrix.makeScale(s, s, s);
      matrix.setPosition(px, py, pz);
      this._auraMesh.setMatrixAt(i, matrix);
    }
    this._auraMesh.instanceMatrix.needsUpdate = true;
  }

  // ── Connection lines ────────────────────────────────────────────────────

  _buildConnections() {
    const THREE = this._THREE;
    const maxLines = 200;
    const positions = new Float32Array(maxLines * 6);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setDrawRange(0, 0);

    const mat = new THREE.LineBasicMaterial({
      color: 0x4499ff,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });

    this._connectionGeom = geom;
    this._connectionPositions = positions;
    this._connectionMaxLines = maxLines;
    this._connectionLines = new THREE.LineSegments(geom, mat);
    this._connectionGroup.add(this._connectionLines);
  }

  _updateConnections(convergence) {
    if (convergence < 0.2) {
      this._connectionGeom.setDrawRange(0, 0);
      return;
    }

    const positions = this._connectionPositions;
    const maxDist = 1.2 + this._entropy * 0.8;
    let lineCount = 0;
    const max = this._connectionMaxLines;
    const t = this._time;

    // Sample subset of body particles for connections
    const step = Math.max(1, Math.floor(BODY_COUNT / 120));
    for (let i = 0; i < BODY_COUNT && lineCount < max; i += step) {
      const di = this._bodyData[i];
      const drift = 0.15 * (1 + this._entropy * 0.5);
      const pix = di.x + Math.sin(di.phase + t * 0.3) * drift;
      const piy = di.y + Math.cos(di.phase * 0.7 + t * 0.2) * drift * 0.8;
      const piz = di.z + Math.sin(di.phase * 1.3 + t * 0.25) * drift * 0.6;

      for (let j = i + step; j < BODY_COUNT && lineCount < max; j += step) {
        const dj = this._bodyData[j];
        const pjx = dj.x + Math.sin(dj.phase + t * 0.3) * drift;
        const pjy = dj.y + Math.cos(dj.phase * 0.7 + t * 0.2) * drift * 0.8;
        const pjz = dj.z + Math.sin(dj.phase * 1.3 + t * 0.25) * drift * 0.6;

        const dx = pix - pjx, dy = piy - pjy, dz = piz - pjz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < maxDist) {
          const idx = lineCount * 6;
          positions[idx] = pix; positions[idx + 1] = piy; positions[idx + 2] = piz;
          positions[idx + 3] = pjx; positions[idx + 4] = pjy; positions[idx + 5] = pjz;
          lineCount++;
        }
      }
    }

    this._connectionGeom.attributes.position.needsUpdate = true;
    this._connectionGeom.setDrawRange(0, lineCount * 2);
    this._connectionLines.material.opacity = convergence * (0.08 + this._entropy * 0.12);
  }

  // ── Eyes ────────────────────────────────────────────────────────────────

  _buildEyes() {
    const THREE = this._THREE;
    // Proportions matched to RaBbLE4K.png reference (eye W:H ≈ 121:445 — tall
    // narrow ovals; portals are equal-size flattened ellipses, cyan above the
    // left eye, magenta below the right)
    const eyeConfig = {
      xRadius: 0.18,
      yRadius: 0.52,
      leftPos: { x: -0.38, y: 0.55, z: 1.6 },
      rightPos: { x: 0.38, y: 0.55, z: 1.6 },
      portalScale: 2.1,
      portalHeightScale: 0.5,
    };
    this._eyeConfig = eyeConfig;

    // Each eye: portal (dark) + white ellipse
    const ellipseShape = (xr, yr) => {
      const shape = new THREE.Shape();
      shape.ellipse(0, 0, xr, yr, 0, Math.PI * 2, false, 0);
      return shape;
    };

    // Portal meshes (dark ellipses behind eyes) — equal size both sides
    const portalGeom = new THREE.ShapeGeometry(
      ellipseShape(eyeConfig.xRadius * eyeConfig.portalScale, eyeConfig.yRadius * eyeConfig.portalHeightScale)
    );
    const portalMat = new THREE.MeshBasicMaterial({
      color: 0x010108,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    portalMat.userData.baseOpacity = 0.95;

    this._leftPortal = new THREE.Mesh(portalGeom, portalMat.clone());
    this._rightPortal = new THREE.Mesh(portalGeom, portalMat.clone());
    this._leftPortal.renderOrder = 10; this._rightPortal.renderOrder = 10;
    // Reference portrait: cyan (left) eye's portal sits above it, magenta (right) eye's below
    this._leftPortal.position.set(eyeConfig.leftPos.x, eyeConfig.leftPos.y + 0.15, eyeConfig.leftPos.z - 0.02);
    this._rightPortal.position.set(eyeConfig.rightPos.x, eyeConfig.rightPos.y - 0.15, eyeConfig.rightPos.z - 0.02);
    this._eyeGroup.add(this._leftPortal);
    this._eyeGroup.add(this._rightPortal);

    // cyan rings the left eye, magenta the right (reference portrait)
    const magRgb  = hexToNormalizedRgb(palette.magenta);
    const cyanRgb = hexToNormalizedRgb(palette.cyan);
    const cyanCol = new THREE.Color(cyanRgb.r, cyanRgb.g, cyanRgb.b);
    const magCol  = new THREE.Color(magRgb.r,  magRgb.g,  magRgb.b);

    // Additive glow-ellipse helper — ported from the Grimoire-Graph eye treatment,
    // which layers an outer corona, an inner colour tint, and a ring halo over the
    // opaque white. depthTest:false + renderOrder keeps the eyes crisp and always
    // on top of the particle nebula. userData.baseOpacity lets the boot fade scale
    // each layer relative to its design opacity instead of flattening them to 1.
    const glowEllipse = (xr, yr, color, opacity, order) => {
      const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthTest: false, depthWrite: false,
      });
      mat.userData.baseOpacity = opacity;
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(ellipseShape(xr, yr)), mat);
      mesh.renderOrder = order;
      return mesh;
    };

    const xr = eyeConfig.xRadius, yr = eyeConfig.yRadius;

    // Outer corona — large soft additive halo tinting the whole eye area
    this._leftCorona  = glowEllipse(xr * 2.3, yr * 1.5, cyanCol, 0.13, 9);
    this._rightCorona = glowEllipse(xr * 2.3, yr * 1.5, magCol,  0.13, 9);

    // Eye whites — opaque, on top of corona
    const eyeMat = new THREE.MeshBasicMaterial({
      color: 0xf8faff, transparent: true, opacity: 1.0,
      side: THREE.DoubleSide, depthTest: false, depthWrite: false,
    });
    eyeMat.userData.baseOpacity = 1.0;
    const eyeGeom = new THREE.ShapeGeometry(ellipseShape(xr, yr));
    this._leftEye  = new THREE.Mesh(eyeGeom, eyeMat.clone());
    this._rightEye = new THREE.Mesh(eyeGeom, eyeMat.clone());
    this._leftEye.renderOrder = 11; this._rightEye.renderOrder = 11;

    // Inner colour tint — additive over the white core
    this._leftInner  = glowEllipse(xr * 1.18, yr * 1.08, cyanCol, 0.30, 12);
    this._rightInner = glowEllipse(xr * 1.18, yr * 1.08, magCol,  0.30, 12);

    // Ring halo — additive band just outside the eye edge
    this._leftRingGlow  = glowEllipse(xr * 1.55, yr * 1.32, cyanCol, 0.22, 11);
    this._rightRingGlow = glowEllipse(xr * 1.55, yr * 1.32, magCol,  0.22, 11);

    // Crisp outline rings
    const ringGeom = (rx, ry) => {
      const points = [];
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(a) * rx, Math.sin(a) * ry, 0));
      }
      return new THREE.BufferGeometry().setFromPoints(points);
    };
    const ringMat = (color) => {
      const m = new THREE.LineBasicMaterial({
        color, transparent: true, opacity: 0.85, linewidth: 2,
        depthTest: false, depthWrite: false,
      });
      m.userData.baseOpacity = 0.85;
      return m;
    };
    this._leftRing  = new THREE.Line(ringGeom(xr * 1.08, yr * 1.08), ringMat(cyanCol));
    this._rightRing = new THREE.Line(ringGeom(xr * 1.08, yr * 1.08), ringMat(magCol));
    this._leftRing.renderOrder = 13; this._rightRing.renderOrder = 13;

    // Arrays drive position / blink / orientation in _updateEyes (back → front)
    this._leftEyeMeshes  = [this._leftCorona,  this._leftEye,  this._leftRingGlow,  this._leftInner,  this._leftRing];
    this._rightEyeMeshes = [this._rightCorona, this._rightEye, this._rightRingGlow, this._rightInner, this._rightRing];
    for (const m of this._leftEyeMeshes)  this._eyeGroup.add(m);
    for (const m of this._rightEyeMeshes) this._eyeGroup.add(m);
  }

  _updateEyes() {
    const t = performance.now() / 1000;

    // Blink
    if (!this._isBlinking && (t - this._lastBlinkTime) >= this._nextBlinkDelay) {
      this._isBlinking = true;
      this._blinkStartTime = t;
      this._nextBlinkDelay = 3.5 + Math.random() * 2;
    }

    if (this._isBlinking) {
      const elapsed = t - this._blinkStartTime;
      const dur = 0.25;
      if (elapsed < dur * 0.4) {
        this._blinkScale = 1.0 - (elapsed / (dur * 0.4)) * 0.9;
      } else if (elapsed < dur * 0.6) {
        this._blinkScale = 0.1;
      } else if (elapsed < dur) {
        this._blinkScale = 0.1 + ((elapsed - dur * 0.6) / (dur * 0.4)) * 0.9;
      } else {
        this._isBlinking = false;
        this._lastBlinkTime = t;
        this._blinkScale = 1.0;
      }
    }

    // Mouse tracking (smooth lerp)
    const lerp = 0.06;
    this._eyeCurrentX += (this._mouseX * 0.12 - this._eyeCurrentX) * lerp;
    this._eyeCurrentY += (this._mouseY * 0.08 - this._eyeCurrentY) * lerp;

    const cfg = this._eyeConfig;
    const ox = this._eyeCurrentX;
    const oy = this._eyeCurrentY;

    // Apply blink as Y-scale and eye offset — to every layer of each eye.
    const bs = this._blinkScale * this._eyeOpenProgress;
    const q  = this._camera.quaternion;

    for (const m of this._leftEyeMeshes) {
      m.position.set(cfg.leftPos.x + ox, cfg.leftPos.y + oy, cfg.leftPos.z);
      m.scale.set(1, bs, 1);
      m.quaternion.copy(q);
    }
    for (const m of this._rightEyeMeshes) {
      m.position.set(cfg.rightPos.x + ox, cfg.rightPos.y + oy, cfg.rightPos.z);
      m.scale.set(1, bs, 1);
      m.quaternion.copy(q);
    }

    // Portals always face camera (positioned separately below)
    this._leftPortal.quaternion.copy(q);
    this._rightPortal.quaternion.copy(q);

    this._leftPortal.position.set(cfg.leftPos.x + ox, cfg.leftPos.y - 0.15 + oy, cfg.leftPos.z - 0.02);
    this._rightPortal.position.set(cfg.rightPos.x + ox, cfg.rightPos.y + 0.15 + oy, cfg.rightPos.z - 0.02);
  }

  // ── Portals (swirling arcs) ─────────────────────────────────────────────

  _buildPortals() {
    const THREE = this._THREE;
    const magRgb = hexToNormalizedRgb(palette.magenta);
    const cyanRgb = hexToNormalizedRgb(palette.cyan);

    // Left portal arc (magenta)
    this._leftPortalArc = this._createPortalArc(
      new THREE.Color(magRgb.r, magRgb.g, magRgb.b),
      { x: -0.38, y: 0.40, z: 1.55 },
      0.45, 0.16
    );
    this._portalGroup.add(this._leftPortalArc.line);

    // Right portal arc (cyan)
    this._rightPortalArc = this._createPortalArc(
      new THREE.Color(cyanRgb.r, cyanRgb.g, cyanRgb.b),
      { x: 0.38, y: 0.70, z: 1.55 },
      0.45, 0.16
    );
    this._portalGroup.add(this._rightPortalArc.line);
  }

  _createPortalArc(color, center, xr, yr) {
    const THREE = this._THREE;
    const segments = 80;
    const positions = new Float32Array((segments + 1) * 3);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });

    const line = new THREE.Line(geom, mat);
    return { line, positions, segments, center, xr, yr, progress: 0 };
  }

  _updatePortals(portalProgress) {
    const update = (arc, progress) => {
      const pts = arc.segments;
      const drawn = Math.floor(progress * pts);
      for (let i = 0; i <= pts; i++) {
        const a = (i / pts) * Math.PI * 2;
        if (i <= drawn) {
          arc.positions[i * 3] = arc.center.x + Math.cos(a) * arc.xr;
          arc.positions[i * 3 + 1] = arc.center.y + Math.sin(a) * arc.yr;
          arc.positions[i * 3 + 2] = arc.center.z;
        } else {
          // Hide undrawn segments at same point
          arc.positions[i * 3] = arc.positions[drawn * 3] || arc.center.x;
          arc.positions[i * 3 + 1] = arc.positions[drawn * 3 + 1] || arc.center.y;
          arc.positions[i * 3 + 2] = arc.center.z;
        }
      }
      arc.line.geometry.attributes.position.needsUpdate = true;
      arc.line.material.opacity = Math.min(1, progress * 2) * 0.85;
      arc.line.quaternion.copy(this._camera.quaternion);
    };

    update(this._leftPortalArc, portalProgress);
    update(this._rightPortalArc, Math.max(0, portalProgress - 0.08) * 1.09);
  }

  // ── Boot animation ──────────────────────────────────────────────────────

  triggerBoot() {
    this._inBoot = true;
    this._bootSeq.reset();
    this._eyeOpenProgress = 0;
    this._lastBlinkTime = performance.now() / 1000;
  }

  // ── Main loop ───────────────────────────────────────────────────────────

  _startLoop() {
    const animate = () => {
      this._time += 0.016;

      // Boot timeline
      if (this._inBoot) {
        this._bootSeq.step();
        if (!this._bootSeq.isActive()) this._inBoot = false;
      }

      const convergence = this._inBoot ? this._bootSeq.getConvergenceProgress() : 1;
      const portalProgress = this._inBoot ? this._bootSeq.getPortalProgress() : 1;
      const eyesProgress = this._inBoot ? this._bootSeq.getEyesProgress() : 1;

      // Eye open progress during boot
      if (this._inBoot) {
        this._eyeOpenProgress = this._bootSeq.getEyeOpenProgress();
      } else {
        this._eyeOpenProgress = 1.0;
      }

      // Visibility during boot
      const showPortals = !this._inBoot || this._bootSeq.timeline > this._bootSeq.T_PORTALS_START;
      const showEyes = !this._inBoot || this._bootSeq.timeline > this._bootSeq.T_EYES_START;

      this._portalGroup.visible = showPortals;
      this._eyeGroup.visible = showEyes;

      if (showEyes) {
        this._eyeGroup.children.forEach(c => {
          if (c.material) {
            const base = c.material.userData.baseOpacity ?? 1;
            c.material.opacity = base * eyesProgress;
          }
        });
      }

      // Update systems
      this._updateCamera();
      this._updateParticleMatrices(convergence);
      this._updateConnections(convergence);
      if (showPortals) this._updatePortals(portalProgress);
      if (showEyes) this._updateEyes();

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

  // ── Public API ──────────────────────────────────────────────────────────

  setEntropy(value) {
    this._entropy = Math.max(0, Math.min(1, value));
  }

  setEntityState(state) {
    this._state = state;
    // Map persona state → entropy so the nebula visibly reacts (mirrors Canvas2D).
    const e = state === 'thinking' ? 0.6 : state === 'speaking' ? 0.8 : 0.3;
    this.setEntropy(e);
  }

  render() {}

  resize() {
    const w = this._canvas.clientWidth;
    const h = this._canvas.clientHeight;
    if (w === 0 || h === 0) return;
    this._camera.aspect = w / h;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(w, h);
  }

  pause() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  }

  resume() {
    if (!this._rafId) this._startLoop();
  }

  dispose() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    this._renderer.dispose();
  }

  getPerformanceMetrics() {
    return {
      fps: this._fps,
      entityCount: BODY_COUNT + AURA_COUNT,
      pools: 2,
    };
  }
}
