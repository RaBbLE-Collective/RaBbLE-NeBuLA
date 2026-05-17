/**
 * element.js — <rabble-entity> custom element
 *
 * Registers rabble-entity against Canvas2dBackend.
 * Side effect: customElements.define fires on import.
 *
 * The element owns canvas sizing (overscan, DPR cap, ResizeObserver) and
 * delegates all rendering to Canvas2dBackend. On connect it writes
 * window.NeBuLA._instance and the perf metrics so World can read them.
 *
 * HTML attributes:
 *   mode           'idle'|'boot'   default: 'idle'
 *   particle-count  number         default: 480
 *   overscan        number         default: 2.35  (capped for mobile/small)
 *   interactive     bool           default: true
 *   show-waveform   bool           default: false
 *   fallback-width  number         default: 460
 *   fallback-height number         default: 320
 */
import { Canvas2dBackend } from './backends/canvas2d-backend.js';

function parseBool(v, fallback) {
  if (v == null) return fallback;
  return v !== 'false' && v !== '0';
}

class RaBbLEEntityElement extends HTMLElement {
  connectedCallback() {
    if (this._connected) return;
    this._connected = true;

    this.classList.add('rabble-entity-host');
    this.style.position = this.style.position || 'relative';
    this.style.display  = this.style.display  || 'block';
    this.style.overflow = 'visible';

    this._canvas = document.createElement('canvas');
    this._canvas.className           = 'rabble-entity-canvas';
    this._canvas.style.cssText       =
      'position:absolute;left:50%;top:50%;' +
      'transform:translate(-50%,-50%);' +
      'pointer-events:none;z-index:0;background:transparent';
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

      if (this._canvas.width  !== devW) this._canvas.width  = devW;
      if (this._canvas.height !== devH) this._canvas.height = devH;
      this._canvas.style.width  = cssW + 'px';
      this._canvas.style.height = cssH + 'px';

      if (this._backend) this._backend.resize();
    };

    this._ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(this._resize) : null;
    if (this._ro) this._ro.observe(this);
    window.addEventListener('resize', this._resize);
    this._resize();
    requestAnimationFrame(this._resize);

    const requested     = parseInt(this.getAttribute('particle-count') || '480', 10);
    const particleCount = isMobile ? Math.min(220, requested) : requested;

    this._backend = new Canvas2dBackend(this._canvas, {
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

    // Expose runtime metrics on the NeBuLA namespace
    if (window.NeBuLA) {
      window.NeBuLA._instance    = this._backend;
      window.NeBuLA.particleCount = particleCount;
      window.NeBuLA.glowScale     = glowScale;
      window.NeBuLA.renderDpr     = perfDpr;
    }

    requestAnimationFrame(this._resize);
  }

  disconnectedCallback() {
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
}

if (typeof customElements !== 'undefined' && !customElements.get('rabble-entity')) {
  customElements.define('rabble-entity', RaBbLEEntityElement);
}
