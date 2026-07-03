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
import { EyeBehavior, EYE_W, EYE_H, PORTAL_W, PORTAL_H, PORTAL_OFFSET_RATIO, MAX_OFF } from './eye-behavior.js';

const MAX_INSTANCES = 4096;
// S190: re-densified from the 650/220 low tuned for the old bloom-heavy pass —
// with additive-only blending (no postprocessing bloom pass) more particles
// read as depth rather than a blob, closer to the Canvas2D nebula's dense
// bokeh feel. Verify with getPerformanceMetrics() if this needs to come back down.
const BODY_COUNT = 900;
const AURA_COUNT = 320;

// Converts EyeBehavior's DOM-pixel-equivalent gaze offset (MAX_OFF-scaled,
// up to ~MAX_OFF*2.5 during a jolt) into Three.js world units. Tuned so a
// full saccade reaches roughly 70% of the portal's interior — matches the
// feel of Canvas2D's cp() clamp without duplicating its ellipse-clamp math.
const GAZE_WORLD_SCALE = 0.01;

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
    this._frameT = 0; // frame-tick counter for EyeBehavior (1/frame, matches Canvas2D's this._t)

    // Gaze + blink — shared "soul" with Canvas2dBackend (see eye-behavior.js).
    // Also gives Three.js jolt-on-click for free, which the old ad hoc mouse-
    // lerp tracking never had.
    this._behavior = new EyeBehavior({ canvas });
    this._behavior.setupMouseTracking();

    // Scene
    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(0x020008);
    this._scene.fog = new THREE.Fog(0x020008, 40, 120);

    // Camera
    this._camera = new THREE.PerspectiveCamera(
      65, canvas.clientWidth / canvas.clientHeight, 0.1, 1000
    );
    // 4.6 (was 6) — brings the face to ~1/3 of frame height like the
    // Canvas2D reference; the nebula fills the frame instead of floating
    // as a distant ball (WS-B parity).
    this._camera.position.set(0, 0.3, 4.6);

    // Renderer
    this._renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: false, powerPreference: 'high-performance',
    });
    this._renderer.setPixelRatio(this._dpr);
    this._renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    // Orbit state (manual implementation — no OrbitControls dependency)
    this._orbitTheta = 0;
    this._orbitPhi = Math.PI / 2;
    this._orbitRadius = 4.6;
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

    // Performance
    this._frameCount = 0;
    this._fps = 60;
    this._lastMetricsTime = performance.now();

    this._onWindowResize = () => this.resize();
    window.addEventListener('resize', this._onWindowResize);
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
      opacity: 0.46,
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

      // Canvas2D parity: cluster squashed vertically (×0.8 like the 2D
      // nebula) and lifted toward the face (+0.3) so the body centers
      // between the eyes rather than hanging below them.
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta) * 0.8 + 0.3;
      const z = r * Math.cos(phi);

      // Violet core → cyan rim. The ^1.4 bias keeps the core reading VIOLET
      // (additive stacking at the center otherwise washes it to white) with
      // cyan taking over only near the rim — the Canvas2D nebula's signature.
      const mix = Math.pow(normDist, 1.4);
      let cr = violet.r + (cyan.r - violet.r) * mix;
      let cg = violet.g + (cyan.g - violet.g) * mix;
      let cb = violet.b + (cyan.b - violet.b) * mix;

      const rnd = Math.random();
      if (rnd < 0.08)      { cr = spark.r;   cg = spark.g;   cb = spark.b; }
      else if (rnd < 0.22) { cr = magenta.r; cg = magenta.g; cb = magenta.b; }

      // Smaller than the pre-parity 0.035–0.135 range — with the camera at
      // 4.6 and the higher count, big bright spheres washed the face out.
      const s = 0.028 + Math.random() * 0.075;
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
      const y = r * Math.sin(phi) * Math.sin(theta) * 0.85 + 0.3;
      let z = r * Math.cos(phi);
      // Keep the halo out of the camera's lap: with the camera at z 4.6, an
      // aura particle spawned near z 4 sits fractions of a unit from the lens
      // and blows up into a giant faceted blob (S190 orchestrator review).
      // Mirror anything past z 2.0 into the back hemisphere — same density,
      // but the space between the face (z 1.6) and the camera stays clear.
      if (z > 2.0) z = -z;

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
    // Proportions match the Canvas2D canonical constants (eye-behavior.js):
    // PORTAL_W/EYE_W ≈ 2.37 (portal much WIDER than the eye), PORTAL_H/EYE_H
    // ≈ 0.25 (portal much FLATTER than the eye) — a wide flat socket the tall
    // eye rises out of, not an equal-size ring. Portal offset is
    // PORTAL_OFFSET_RATIO (0.44) of the eye's FULL height: left/cyan portal
    // sits ABOVE its eye, right/magenta portal sits BELOW — matching
    // Canvas2D's asymmetry (never level; see RaBbLE-Entity-Visual-Spec.md).
    const eyeConfig = {
      xRadius: 0.18,
      yRadius: 0.52,
      leftPos: { x: -0.38, y: 0.55, z: 1.6 },
      rightPos: { x: 0.38, y: 0.55, z: 1.6 },
      portalScale: PORTAL_W / EYE_W,
      portalHeightScale: PORTAL_H / EYE_H,
      portalOffsetY: PORTAL_OFFSET_RATIO * (0.52 * 2),
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
      opacity: 1.0, // fully opaque — the socket interior must read as void (Canvas2D parity)
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    portalMat.userData.baseOpacity = 1.0;

    this._leftPortal = new THREE.Mesh(portalGeom, portalMat.clone());
    this._rightPortal = new THREE.Mesh(portalGeom, portalMat.clone());
    this._leftPortal.renderOrder = 10; this._rightPortal.renderOrder = 10;
    // Reference portrait: cyan (left) eye's portal sits above it, magenta (right) eye's below
    this._leftPortal.position.set(eyeConfig.leftPos.x, eyeConfig.leftPos.y + eyeConfig.portalOffsetY, eyeConfig.leftPos.z - 0.02);
    this._rightPortal.position.set(eyeConfig.rightPos.x, eyeConfig.rightPos.y - eyeConfig.portalOffsetY, eyeConfig.rightPos.z - 0.02);
    this._eyeGroup.add(this._leftPortal);
    this._eyeGroup.add(this._rightPortal);

    // cyan rings the left eye, magenta the right (reference portrait)
    const magRgb  = hexToNormalizedRgb(palette.magenta);
    const cyanRgb = hexToNormalizedRgb(palette.cyan);
    const cyanCol = new THREE.Color(cyanRgb.r, cyanRgb.g, cyanRgb.b);
    const magCol  = new THREE.Color(magRgb.r,  magRgb.g,  magRgb.b);

    // Socket rim glow — additive elliptical annulus hugging the socket edge.
    // WebGL LineBasicMaterial is hard-capped at 1px, so the sweep arc alone
    // reads as a hairline; this annulus is what makes the rim glow like
    // Canvas2D's two-pass blurred portal stroke (floor.js portal treatment).
    const pXr = eyeConfig.xRadius * eyeConfig.portalScale;
    const pYr = eyeConfig.yRadius * eyeConfig.portalHeightScale;
    const annulus = (color, opacity) => {
      const shape = new THREE.Shape();
      shape.absellipse(0, 0, pXr * 1.07, pYr * 1.24, 0, Math.PI * 2, false, 0);
      const hole = new THREE.Path();
      hole.absellipse(0, 0, pXr * 0.955, pYr * 0.84, 0, Math.PI * 2, false, 0);
      shape.holes.push(hole);
      const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthTest: false, depthWrite: false,
      });
      mat.userData.baseOpacity = opacity;
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape, 48), mat);
      mesh.renderOrder = 12;
      return mesh;
    };
    this._leftPortalRim  = annulus(cyanCol, 0.42);
    this._rightPortalRim = annulus(magCol,  0.42);
    this._eyeGroup.add(this._leftPortalRim);
    this._eyeGroup.add(this._rightPortalRim);

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

    // Outer corona — large soft additive halo tinting the whole eye area.
    // S190: strengthened from 0.13 to close the glow gap vs Canvas2D's
    // separate CSS-blurred glow canvas (WS-B glow/bloom parity).
    this._leftCorona  = glowEllipse(xr * 2.3, yr * 1.5, cyanCol, 0.20, 9);
    this._rightCorona = glowEllipse(xr * 2.3, yr * 1.5, magCol,  0.20, 9);

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
    this._leftInner  = glowEllipse(xr * 1.18, yr * 1.08, cyanCol, 0.36, 12);
    this._rightInner = glowEllipse(xr * 1.18, yr * 1.08, magCol,  0.36, 12);

    // Ring halo — additive band just outside the eye edge
    this._leftRingGlow  = glowEllipse(xr * 1.55, yr * 1.32, cyanCol, 0.28, 11);
    this._rightRingGlow = glowEllipse(xr * 1.55, yr * 1.32, magCol,  0.28, 11);

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

  // Gaze physics + blink FSM live in EyeBehavior (shared with Canvas2dBackend
  // — "one soul, two bodies"). This just projects the behavior's abstract
  // DOM-pixel-equivalent output into Three.js world-space position/scale.
  _updateEyes() {
    const behavior = this._behavior;

    // Blink: same formula as Canvas2dBackend's draw() — blinkT collapses the
    // orb toward a horizontal line (scaleY), eyeOpenProgress gates it during
    // the boot emergence phase (blinkMachine === 1).
    const emergeScale = behavior.blinkMachine === 1 ? behavior.eyeOpenProgress : 1.0;
    const bs = (1 - behavior.blinkT * 0.93) * emergeScale;

    const cfg = this._eyeConfig;
    const ox = behavior.eyeCurX * GAZE_WORLD_SCALE;
    const oy = behavior.eyeCurY * GAZE_WORLD_SCALE;
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

    // Portals always face camera (positioned separately below). Same
    // asymmetry as _buildEyes: left/cyan portal above, right/magenta below.
    const lpx = cfg.leftPos.x + ox,  lpy = cfg.leftPos.y + cfg.portalOffsetY + oy;
    const rpx = cfg.rightPos.x + ox, rpy = cfg.rightPos.y - cfg.portalOffsetY + oy;
    for (const [m, px, py, z] of [
      [this._leftPortal,     lpx, lpy, cfg.leftPos.z - 0.02],
      [this._rightPortal,    rpx, rpy, cfg.rightPos.z - 0.02],
      [this._leftPortalRim,  lpx, lpy, cfg.leftPos.z - 0.015],
      [this._rightPortalRim, rpx, rpy, cfg.rightPos.z - 0.015],
    ]) {
      m.position.set(px, py, z);
      m.quaternion.copy(q);
    }
  }

  // ── Portals (swirling arcs) ─────────────────────────────────────────────

  _buildPortals() {
    const THREE = this._THREE;
    const magRgb = hexToNormalizedRgb(palette.magenta);
    const cyanRgb = hexToNormalizedRgb(palette.cyan);
    const cfg = this._eyeConfig;

    // Arc rims sit exactly on the socket-ellipse edges built in _buildEyes:
    // same centers (eye pos ± portalOffsetY), same radii, same color side
    // (cyan left, magenta right). During boot they sweep-draw the rim; after
    // boot they stay as the socket's glowing ring — mirroring Canvas2D's
    // PortalSystem where the boot arc IS the resting rim at frac = 1.
    const xr = cfg.xRadius * cfg.portalScale;
    const yr = cfg.yRadius * cfg.portalHeightScale;

    // Left portal arc (cyan — matches the left eye/socket)
    this._leftPortalArc = this._createPortalArc(
      new THREE.Color(cyanRgb.r, cyanRgb.g, cyanRgb.b),
      { x: cfg.leftPos.x, y: cfg.leftPos.y + cfg.portalOffsetY, z: cfg.leftPos.z - 0.01 },
      xr, yr
    );
    this._portalGroup.add(this._leftPortalArc.line);

    // Right portal arc (magenta — matches the right eye/socket)
    this._rightPortalArc = this._createPortalArc(
      new THREE.Color(magRgb.r, magRgb.g, magRgb.b),
      { x: cfg.rightPos.x, y: cfg.rightPos.y - cfg.portalOffsetY, z: cfg.rightPos.z - 0.01 },
      xr, yr
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
      depthTest: false,
      depthWrite: false,
    });

    const line = new THREE.Line(geom, mat);
    // Render after the socket fills (renderOrder 10) so the rim never gets
    // painted over by the opaque socket ellipse it sits on.
    line.renderOrder = 13;
    return { line, positions, segments, center, xr, yr, progress: 0 };
  }

  _updatePortals(portalProgress) {
    // Rims follow the same gaze offset as the sockets in _updateEyes so they
    // stay welded to the socket ellipses while the whole face drifts.
    const ox = this._behavior.eyeCurX * GAZE_WORLD_SCALE;
    const oy = this._behavior.eyeCurY * GAZE_WORLD_SCALE;

    const update = (arc, progress) => {
      const pts = arc.segments;
      const drawn = Math.floor(Math.min(1, progress) * pts);
      // Geometry is baked in LOCAL space (centered on origin) so the camera-
      // facing quaternion rotates the rim about its own center; world
      // placement happens via line.position below.
      for (let i = 0; i <= pts; i++) {
        // Sweep starts at the top of the ellipse (−π/2) like Canvas2D's boot arc
        const a = -Math.PI / 2 + (i / pts) * Math.PI * 2;
        if (i <= drawn) {
          arc.positions[i * 3] = Math.cos(a) * arc.xr;
          arc.positions[i * 3 + 1] = Math.sin(a) * arc.yr;
          arc.positions[i * 3 + 2] = 0;
        } else {
          // Hide undrawn segments at same point
          arc.positions[i * 3] = arc.positions[drawn * 3] || 0;
          arc.positions[i * 3 + 1] = arc.positions[drawn * 3 + 1] || 0;
          arc.positions[i * 3 + 2] = 0;
        }
      }
      arc.line.geometry.attributes.position.needsUpdate = true;
      arc.line.material.opacity = Math.min(1, progress * 2) * 0.85;
      arc.line.position.set(arc.center.x + ox, arc.center.y + oy, arc.center.z);
      arc.line.quaternion.copy(this._camera.quaternion);
    };

    update(this._leftPortalArc, portalProgress);
    update(this._rightPortalArc, Math.max(0, portalProgress - 0.08) * 1.09);
  }

  // ── Boot animation ──────────────────────────────────────────────────────

  triggerBoot() {
    this._inBoot = true;
    this._bootSeq.reset();
    this._behavior.initBoot();
  }

  // ── Main loop ───────────────────────────────────────────────────────────

  _startLoop() {
    const animate = () => {
      this._time += 0.016;
      this._frameT++;

      // Boot timeline
      if (this._inBoot) {
        this._bootSeq.step();
        if (!this._bootSeq.isActive()) this._inBoot = false;
      }

      const convergence = this._inBoot ? this._bootSeq.getConvergenceProgress() : 1;
      const portalProgress = this._inBoot ? this._bootSeq.getPortalProgress() : 1;
      const eyesProgress = this._inBoot ? this._bootSeq.getEyesProgress() : 1;

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

      // Gaze physics + blink FSM (shared EyeBehavior) — cx/cy approximate the
      // entity's on-screen center as canvas-local pixels, matching the
      // coordinate space setupMouseTracking() reads mouse events in.
      const rect = this._canvas.getBoundingClientRect();
      this._behavior.update(this._frameT, { inBoot: this._inBoot, bootSeq: this._bootSeq }, rect.width / 2, rect.height / 2);

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
    this._behavior.setEntityState(state);
    // Map persona state → entropy so the nebula visibly reacts (mirrors Canvas2D).
    const e = state === 'thinking' ? 0.6 : state === 'speaking' ? 0.8 : 0.3;
    this.setEntropy(e);
  }

  // Direct jolt injection (e.g. from a chat surface reacting to a click) —
  // same contract as Canvas2dBackend.injectEyeJolt: dx/dy in [-1, 1].
  injectEyeJolt(dx, dy) {
    this._behavior.injectJolt(dx, dy);
  }

  // ── API parity with Canvas2dBackend ─────────────────────────────────────
  // These fill in the gaps documented in the EP1 Liminal Experience Plan
  // (WS-A item 4). Canvas2D's setEyeConfig tunes saccade/blink timing —
  // that lives in EyeBehavior now, so it Just Works here too. Particle
  // config and portal visibility are Three.js-specific no-ops or partial
  // implementations, documented rather than silently missing.

  // Forwards to the shared EyeBehavior (saccadeMode, blink/distraction
  // timing, spring/damping). Three.js has no separate waveform config.
  setEyeConfig(cfg) {
    if (this._behavior) this._behavior.setConfig(cfg);
  }

  // Documented no-op: the Three.js nebula's density/size are fixed at
  // construction time (instanced buffers sized to BODY_COUNT/AURA_COUNT).
  // Live re-tuning would require rebuilding the InstancedMesh; not needed
  // for EP1 — Canvas2D is the tunable reference implementation.
  setParticleConfig(_cfg) {
    // no-op — see comment above
  }

  setPortalVisible(visible) {
    if (this._portalGroup) this._portalGroup.visible = !!visible;
    this._portalsForcedHidden = !visible;
  }

  // Serializable snapshot of current tunable state — mirrors
  // Canvas2dBackend.getSnapshot() shape so a shared inspector/debug panel
  // can read either backend the same way.
  getSnapshot() {
    return {
      entityState:   this._state || 'idle',
      entropy:       this._entropy ?? 0.3,
      portalVisible: this._portalGroup ? this._portalGroup.visible : true,
      eye:           this._behavior ? this._behavior.getConfig() : {},
      particle:      { bodyCount: BODY_COUNT, auraCount: AURA_COUNT },
      backend:       'Three.js',
    };
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
    if (this._onWindowResize) window.removeEventListener('resize', this._onWindowResize);
    if (this._behavior) this._behavior.dispose();
    this._renderer.dispose();
  }

  getPerformanceMetrics() {
    return {
      fps: this._fps,
      entityCount: BODY_COUNT + AURA_COUNT,
      pools: 2,
      backend: 'Three.js',
    };
  }
}
