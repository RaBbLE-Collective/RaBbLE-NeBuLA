/**
 * element.js — <rabble-entity> custom element
 *
 * Registers rabble-entity. Defaults to Canvas2dBackend; backend="alive" mounts
 * the alive entity (2D+3D, host-driven boot, moods; see backends/alive-backend.js
 * and RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-API.md). Opt into the
 * Three.js Layer 2 renderer with backend="threejs" (falls back silently to
 * Canvas2D when WebGL is unavailable or Three.js fails to load — mirrors
 * the degradation pattern in elements/floor.js and elements/graph.js).
 * Side effect: customElements.define fires on import.
 *
 * The element owns canvas sizing (overscan, DPR cap, ResizeObserver) and
 * delegates all rendering to the selected backend. On connect it writes
 * window.NeBuLA._instance and the perf metrics so World can read them.
 *
 * HTML attributes:
 *   backend         'canvas2d'|'threejs'|'alive'  default: 'canvas2d'
 *   alive only: autoboot, autonomous, dimension ('2d'|'3d'), track-window, hold-to-listen,
 *               skippable, step-timeout, tagline, ready-line, portal-a, portal-b,
 *               state, mood, emotion (live: changing these attributes drives the entity)
 *   mode           'idle'|'boot'   default: 'idle'
 *   particle-count  number         default: 260 (capped centrally at 300, 160 on mobile)
 *   overscan        number         default: 2.35  (capped for mobile/small)
 *   interactive     bool           default: true
 *   show-waveform   bool           default: false
 *   fallback-width  number         default: 460
 *   fallback-height number         default: 320
 */
import { Canvas2dBackend } from './backends/canvas2d-backend.js';
import { ThreeJsBackend } from './backends/threejs-backend.js';
import { ensureThree, hasWebGL } from './utils/three-loader.js';
import { createAlive } from './backends/alive-backend.js';

function parseBool(v, fallback) {
  if (v == null) return fallback;
  return v !== 'false' && v !== '0';
}

const ALIVE_LIVE_ATTRS = ['state', 'mood', 'emotion', 'dimension', 'portal-a', 'portal-b'];

class RaBbLEEntityElement extends HTMLElement {
  static get observedAttributes() { return ALIVE_LIVE_ATTRS; }

  attributeChangedCallback(name, oldV, newV) {
    if (!this._alive || oldV === newV || newV == null) return;
    if (name === 'state') this._alive.setState(newV);
    else if (name === 'mood') this._alive.setMood(newV);
    else if (name === 'emotion') this._alive.setEmotion(newV);
    else if (name === 'dimension') this._alive.setDimension(newV);
    else this._alive.setPortals(this.getAttribute('portal-a') || 'cyan', this.getAttribute('portal-b') || 'magenta');
  }

  connectedCallback() {
    if (this._connected) return;
    this._connected = true;

    if ((this.getAttribute('backend') || '').toLowerCase() === 'alive') { this._mountAlive(); return; }

    this.classList.add('rabble-entity-host');
    this.style.position = this.style.position || 'relative';
    this.style.display  = this.style.display  || 'block';
    this.style.overflow = 'visible';
    // z-index:1 creates a proper stacking context above AmbientField's fixed z:0 canvases.
    if (!this.style.zIndex) this.style.zIndex = '1';
    // isolation:isolate forces all three canvases to composite into an offscreen group
    // first (respecting internal z-order), then places the result on the page.
    // Without it, Chrome's GPU compositor promotes the glow canvas (which has CSS
    // filter:blur) to a separate layer that composites AFTER the entity canvas (z:2)
    // despite having lower z-index — causing glow bokeh to appear through the opaque
    // portal fill. isolation:isolate prevents the internal blend modes from bleeding
    // through to the page backdrop before the group is fully resolved.
    this.style.isolation = 'isolate';

    // Three stacked canvases — composited by the browser's GPU compositor.
    // Field (z:0) — flat particles + connections; CPU-heavy, throttle-able.
    // Glow (z:1)  — bloom particles only; CSS filter:blur on the DOM element
    //               so the blur runs on the compositor thread, never JS/Skia.
    // Entity (z:2) — eyes + portals; always draws first, never delayed by field.
    const layerStyle = (z) =>
      'position:absolute;left:50%;top:50%;' +
      'transform:translate(-50%,-50%);' +
      `pointer-events:none;z-index:${z};background:transparent`;

    this._fieldCanvas  = document.createElement('canvas');
    this._fieldCanvas.className = 'rabble-entity-canvas rabble-entity-canvas--field';
    this._fieldCanvas.style.cssText = layerStyle(0);
    this.appendChild(this._fieldCanvas);

    this._glowCanvas = document.createElement('canvas');
    this._glowCanvas.className = 'rabble-entity-canvas rabble-entity-canvas--glow';
    this._glowCanvas.style.cssText = layerStyle(1) + ';filter:blur(5px)';
    this.appendChild(this._glowCanvas);

    this._canvas = document.createElement('canvas');
    this._canvas.className = 'rabble-entity-canvas rabble-entity-canvas--entity';
    this._canvas.style.cssText = layerStyle(2);
    this.appendChild(this._canvas);

    // Mobile performance: cap DPR and reduce glow on high-DPR small screens
    const rawDpr    = window.devicePixelRatio || 1;
    const isMobile  = rawDpr > 1.5 && (window.innerWidth < 800 || window.innerHeight < 600);
    const perfDpr   = isMobile ? Math.min(1.5, rawDpr) : rawDpr;
    const glowScale = isMobile ? 0.35 : 1.0;

    this._perfDpr = perfDpr;

    this._resize = () => {
      const rect      = this.getBoundingClientRect();
      const fallbackW = parseFloat(this.getAttribute('fallback-width')  || '460');
      const fallbackH = parseFloat(this.getAttribute('fallback-height') || '320');
      const hostW     = rect.width  || this.offsetWidth  || fallbackW;
      const hostH     = rect.height || this.offsetHeight || fallbackH;

      const rawOverscan = parseFloat(this.getAttribute('overscan') || '2.35');
      const overscan = window.innerHeight < 500
        ? Math.min(1.2, rawOverscan)
        : (hostW < 220 || hostH < 160) ? Math.min(1.8, rawOverscan) : rawOverscan;

      const cssW = Math.max(1, Math.round(hostW * overscan));
      const cssH = Math.max(1, Math.round(hostH * overscan));
      const devW = Math.round(cssW * perfDpr);
      const devH = Math.round(cssH * perfDpr);

      for (const c of [this._fieldCanvas, this._glowCanvas, this._canvas]) {
        if (c.width  !== devW) c.width  = devW;
        if (c.height !== devH) c.height = devH;
        c.style.width  = cssW + 'px';
        c.style.height = cssH + 'px';
      }

      if (this._backend) this._backend.resize();
    };

    this._ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(this._resize) : null;
    if (this._ro) this._ro.observe(this);
    window.addEventListener('resize', this._resize);
    this._resize();
    requestAnimationFrame(this._resize);

    // NeBuLA owns particle-system performance — cap centrally so any host
    // page's request lands in the "living brain" range (sparse field, fluid
    // motion) rather than the old dense-nebula range that bogged down the
    // shared GPU/CPU budget. 150 desktop ceiling; Three.js backend is the
    // right path for higher counts (instanced rendering, one draw call).
    const requested     = parseInt(this.getAttribute('particle-count') || '150', 10);
    const particleCount = Math.min(isMobile ? 100 : 150, requested);

    const mountCanvas2d = () => {
      this._backend = new Canvas2dBackend(this._canvas, {
        fieldCanvas:   this._fieldCanvas,
        glowCanvas:    this._glowCanvas,
        mode:          this.getAttribute('mode') || 'idle',
        particleCount,
        transparent:   true,
        interactive:   parseBool(this.getAttribute('interactive'),   true),
        showWaveform:  parseBool(this.getAttribute('show-waveform'), false),
        dpr:           perfDpr,
        glowScale,
        onReady: () => {
          this.dispatchEvent(new CustomEvent('entity-ready', { bubbles: true }));
          window.dispatchEvent(new CustomEvent('rabble:entity-ready'));
        },
      });
      this._exposeInstance(particleCount, glowScale, perfDpr, 'Canvas2D');
    };

    const requestedBackend = (this.getAttribute('backend') || 'canvas2d').toLowerCase();

    if (requestedBackend === 'threejs') {
      if (!hasWebGL()) {
        console.warn('[rabble-entity] backend="threejs" requested but WebGL is unavailable; falling back to Canvas2D.');
        mountCanvas2d();
      } else {
        ensureThree()
          .then(() => {
            if (!this._connected) return; // disconnected while Three.js was loading
            // Entity canvas is pointer-events:none by default (Canvas2D reads
            // mouse from window) — the 3JS backend's orbit/wheel controls
            // listen on the canvas itself, so re-enable events for it.
            if (parseBool(this.getAttribute('interactive'), true)) {
              this._canvas.style.pointerEvents = 'auto';
            }
            this._backend = new ThreeJsBackend(this._canvas, {});
            if ((this.getAttribute('mode') || 'idle') === 'boot') this._backend.triggerBoot();
            this._exposeInstance(particleCount, glowScale, perfDpr, 'Three.js');
            this.dispatchEvent(new CustomEvent('entity-ready', { bubbles: true }));
            window.dispatchEvent(new CustomEvent('rabble:entity-ready'));
            requestAnimationFrame(this._resize);
          })
          .catch((err) => {
            console.warn('[rabble-entity] Three.js backend failed to load, falling back to Canvas2D:', err.message);
            if (this._connected) mountCanvas2d();
          });
      }
    } else {
      mountCanvas2d();
    }

    requestAnimationFrame(this._resize);
  }

  // The alive entity paints a whole scene (field, grid, face) and fills its host; the host page sizes it.
  _mountAlive() {
    this.classList.add('rabble-entity-host', 'rabble-entity-host--alive');
    if (getComputedStyle(this).position === 'static') this.style.position = 'relative';
    if (getComputedStyle(this).display === 'inline') this.style.display = 'block';
    const a = (n) => this.getAttribute(n);
    const num = (n) => (a(n) == null ? undefined : parseFloat(a(n)));
    this._alive = this._backend = createAlive(this, {
      autoboot:     parseBool(a('autoboot'), false),
      autonomous:   parseBool(a('autonomous'), true),
      dimension:    a('dimension') || '2d',
      interactive:  parseBool(a('interactive'), true),
      trackWindow:  parseBool(a('track-window'), true),
      holdToListen: parseBool(a('hold-to-listen'), false),
      skippable:    parseBool(a('skippable'), true),
      stepTimeout:  num('step-timeout'),
      tagline:      a('tagline') == null ? undefined : a('tagline'),
      readyLine:    a('ready-line') || undefined,
      portalA:      a('portal-a') || undefined,
      portalB:      a('portal-b') || undefined,
    });
    if (a('emotion')) this._alive.setEmotion(a('emotion'));
    if (a('mood')) this._alive.setMood(a('mood'));
    if (a('state')) this._alive.setState(a('state'));
    this._exposeInstance(0, 1, window.devicePixelRatio || 1, 'Alive');
    this.dispatchEvent(new CustomEvent('entity-ready', { bubbles: true }));
    window.dispatchEvent(new CustomEvent('rabble:entity-ready'));
  }

  // ---- alive contract (no-ops on the legacy backends)
  boot(o)             { return this._alive ? this._alive.boot(o) : (this.triggerBoot(), Promise.resolve()); }
  completeStep(id)    { return this._alive ? this._alive.completeStep(id) : false; }
  failStep(id, r)     { return this._alive ? this._alive.failStep(id, r) : false; }
  skip()              { if (this._alive) this._alive.skip(); }
  setState(s)         { if (this._alive) this._alive.setState(s); else this.setEntityState(s); }
  setMood(m, o)       { if (this._alive) this._alive.setMood(m, o); }
  setEmotion(e, o)    { if (this._alive) this._alive.setEmotion(e, o); }
  setPortals(a, b)    { return this._alive ? this._alive.setPortals(a, b) : false; }
  getPortals()        { return this._alive ? this._alive.getPortals() : null; }
  pulse(kind)         { if (this._alive) this._alive.pulse(kind); }
  attend(x, y, d)     { if (this._alive) this._alive.attend(x, y, d); }
  setDimension(d)     { if (this._alive) this._alive.setDimension(d); }

  _exposeInstance(particleCount, glowScale, perfDpr, backendName) {
    if (window.NeBuLA) {
      window.NeBuLA._instance     = this._backend;
      window.NeBuLA.particleCount = particleCount;
      window.NeBuLA.glowScale     = glowScale;
      window.NeBuLA.renderDpr     = perfDpr;
      window.NeBuLA.activeBackend = backendName;
    }
  }

  disconnectedCallback() {
    if (this._alive) {
      this._alive.dispose();
      if (window.NeBuLA && window.NeBuLA._instance === this._alive) window.NeBuLA._instance = null;
      this._alive = this._backend = null;
      this._connected = false;
      return;
    }
    if (this._ro) this._ro.disconnect();
    window.removeEventListener('resize', this._resize);
    if (this._backend) this._backend.dispose();
    if (window.NeBuLA && window.NeBuLA._instance === this._backend) {
      window.NeBuLA._instance = null;
    }
    this._connected = false;
  }

  setEntityState(s) {
    if (this._backend) this._backend.setEntityState(s);
    else this.setAttribute('state', s);
  }

  injectEyeJolt(dx, dy) {
    if (this._backend) this._backend.injectEyeJolt(dx, dy);
  }

  setEntropy(val) {
    if (this._backend) this._backend.setEntropy(val);
  }

  triggerBoot() {
    if (this._backend) this._backend.triggerBoot();
  }

  pause() {
    if (this._backend) this._backend.pause();
  }

  resume() {
    if (this._backend) this._backend.resume();
  }

  setEyeConfig(cfg) {
    if (this._backend) this._backend.setEyeConfig(cfg);
  }

  setParticleConfig(cfg) {
    if (this._backend) this._backend.setParticleConfig(cfg);
  }

  setPortalVisible(visible) {
    if (this._backend) this._backend.setPortalVisible(visible);
  }

  getSnapshot() {
    return this._backend ? this._backend.getSnapshot() : null;
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('rabble-entity')) {
  customElements.define('rabble-entity', RaBbLEEntityElement);
}
