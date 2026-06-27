/**
 * elements/doors.js — <rabble-doors> custom element (orbit engine)
 *
 * N threshold doors on elliptical paths around a central core, passing behind
 * and in front of it (squashed cosmic disc). Ported from Chrysalis
 * RaBbLE-liminal.js: buildPortals() (:400–429) + layoutOrbits() (:431–457).
 *
 * Self-contained: builds its own DOM doors and animates them. Accent colors
 * come from Aether palette CSS vars (--magenta/--cyan/--violet/--pink) — the
 * door's accent is applied as `var(<accent>)`, never raw hex.
 *
 * Usage:
 *   <rabble-doors count="6" speed="1"></rabble-doors>
 *   el.setDoors([{ id, name, url, glyph, accent, organ }]);
 *   el.setSpeed(0.2);
 *   el.setEntityState('glitch');  // 'idle' | 'resonant' | 'glitch'
 *
 * Attributes (reactive):
 *   count   — number of doors (default 6; ignored once setDoors() supplies a set)
 *   speed   — orbit speed factor (default 1.0)
 *
 * Events (bubbles + composed):
 *   rabble-doors-enter  — pointer/focus enters a door; detail: { id, name, url }
 *   rabble-doors-leave  — pointer/focus leaves a door
 *   rabble-doors-trace  — every door has been visited; detail: { count }
 *
 * Methods:
 *   setDoors(portals[])   — [{ id, name, url, glyph, accent, organ }]
 *   setSpeed(factor)
 *   setEntityState(state) — 'idle' | 'resonant' | 'glitch'
 */

const DEFAULT_ACCENTS = ['--magenta', '--cyan', '--violet', '--pink'];
const DEFAULT_GLYPHS   = ['✦', '⬡', '◈', '▣', '◌', '◐'];

function defaultDoors(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id:     'door-' + i,
      name:   'threshold ' + (i + 1),
      url:    '#',
      glyph:  DEFAULT_GLYPHS[i % DEFAULT_GLYPHS.length],
      accent: DEFAULT_ACCENTS[i % DEFAULT_ACCENTS.length],
      organ:  '',
    });
  }
  return out;
}

class RaBbLEDoorsElement extends HTMLElement {
  static get observedAttributes() { return ['count', 'speed']; }

  connectedCallback() {
    if (this._connected) return;
    this._connected = true;

    this.style.display  = this.style.display || 'block';
    this.style.position = 'relative';
    this.style.overflow = this.style.overflow || 'visible';
    this.setAttribute('aria-label', 'rabble-doors orbit');

    this._slow       = 1;
    this._slowTarget = parseFloat(this.getAttribute('speed'));
    if (isNaN(this._slowTarget)) this._slowTarget = 1;
    this._entityState  = 'idle';
    this._visited      = {};
    this._traced       = false;
    this._lastTs       = performance.now();
    this._running      = true;
    this._prefersStill = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const n = parseInt(this.getAttribute('count'), 10);
    const portals = this._pendingDoors || defaultDoors(isNaN(n) ? 6 : n);
    this._pendingDoors = null;
    this._build(portals);
    this._animate(performance.now());
  }

  disconnectedCallback() {
    this._running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._connected = false;
  }

  attributeChangedCallback(name, _old, val) {
    if (name === 'speed') {
      const f = parseFloat(val);
      if (!isNaN(f)) this._slowTarget = f;
    } else if (name === 'count' && this._connected && !this._userDoors) {
      const n = parseInt(val, 10);
      if (!isNaN(n)) this._build(defaultDoors(n));
    }
  }

  _build(portals) {
    // Tear down any prior doors
    if (this._nodes) this._nodes.forEach(nd => nd.el.remove());
    this._nodes   = [];
    this._visited = {};
    this._traced  = false;

    const N = portals.length;
    portals.forEach((p, i) => {
      const a = document.createElement('a');
      a.className = 'rabble-door';
      a.href = p.url || '#';
      a.id = 'rabble-door-' + p.id;
      a.setAttribute('aria-label', p.name + (p.organ ? ' — ' + p.organ : ''));
      a.style.cssText =
        'position:absolute;left:0;top:0;display:flex;flex-direction:column;' +
        'align-items:center;gap:6px;text-decoration:none;will-change:transform,opacity;';
      const accent = 'var(' + (p.accent || '--magenta') + ')';
      a.style.setProperty('--rabble-door-accent', accent);
      a.innerHTML =
        '<span class="rabble-door-orb" aria-hidden="true" style="display:flex;align-items:center;' +
        'justify-content:center;width:46px;height:46px;border-radius:50%;font-size:20px;' +
        'color:' + accent + ';border:1px solid ' + accent + ';' +
        'background:color-mix(in srgb, ' + accent + ' 12%, transparent);' +
        'box-shadow:0 0 18px color-mix(in srgb, ' + accent + ' 45%, transparent);">' +
        (p.glyph || '✦') + '</span>' +
        '<span class="rabble-door-label" style="font-size:11px;color:' + accent + ';' +
        'white-space:nowrap;font-family:var(--rc-font-mono,monospace);">' + (p.name || '') + '</span>';

      const onIn = () => {
        this._slowTarget = 0.08;
        this.dispatchEvent(new CustomEvent('rabble-doors-enter', {
          bubbles: true, composed: true, detail: { id: p.id, name: p.name, url: p.url },
        }));
        if (!this._visited[p.id]) { this._visited[p.id] = true; this._checkTrace(N); }
      };
      const onOut = () => {
        this._slowTarget = parseFloat(this.getAttribute('speed'));
        if (isNaN(this._slowTarget)) this._slowTarget = 1;
        this.dispatchEvent(new CustomEvent('rabble-doors-leave', { bubbles: true, composed: true }));
      };
      a.addEventListener('mouseenter', onIn);
      a.addEventListener('focus', onIn);
      a.addEventListener('mouseleave', onOut);
      a.addEventListener('blur', onOut);

      this.appendChild(a);
      this._nodes.push({
        el: a,
        portal: p,
        theta: (Math.PI * 2 / N) * i - Math.PI / 2,
        omega: 0.05 + 0.011 * (N - i),  // inner doors move faster
        ring:  0.55 + 0.085 * i,        // radius ladder
        _zi: null, _op: null,
      });
    });
  }

  _checkTrace(N) {
    if (this._traced) return;
    if (Object.keys(this._visited).length < N) return;
    this._traced = true;
    this.dispatchEvent(new CustomEvent('rabble-doors-trace', {
      bubbles: true, composed: true, detail: { count: N },
    }));
  }

  _layout(dt) {
    const w  = this.clientWidth  || window.innerWidth;
    const h  = this.clientHeight || window.innerHeight;
    const cx = w / 2, cy = h / 2;
    const base = Math.min(w * 0.40, h * 0.55);

    this._slow += (this._slowTarget - this._slow) * 0.06;
    const glitching = this._entityState === 'glitch';

    for (let i = 0; i < this._nodes.length; i++) {
      const n = this._nodes[i];
      if (!this._prefersStill) {
        const wob = glitching ? Math.sin(performance.now() * 0.02 + i) * 0.06 : 0;
        n.theta += (n.omega * this._slow + wob) * dt;
      }
      const r = base * n.ring;
      const x = cx + Math.cos(n.theta) * r;
      const y = cy + Math.sin(n.theta) * r * 0.42;   // squashed plane — cosmic disc
      const depth = (Math.sin(n.theta) + 1) / 2;       // 0 = behind, 1 = in front
      const scale = 0.78 + depth * 0.30;

      n.el.style.transform =
        'translate3d(' + (x | 0) + 'px,' + (y | 0) + 'px,0) translate(-50%,-50%) scale(' + scale.toFixed(3) + ')';
      const zi = depth > 0.5 ? 30 : 10;
      if (n._zi !== zi) { n._zi = zi; n.el.style.zIndex = zi; }
      const op = (0.55 + depth * 0.45).toFixed(2);
      if (n._op !== op) { n._op = op; n.el.style.opacity = op; }
    }
  }

  _animate(ts) {
    if (!this._running) return;
    this._rafId = requestAnimationFrame((t) => this._animate(t));
    const dt = Math.min((ts - this._lastTs) / 16.6667, 3);  // frames elapsed, capped
    this._lastTs = ts;
    this._layout(dt);
  }

  /** @param {Array<{id:string,name:string,url:string,glyph:string,accent:string,organ:string}>} portals */
  setDoors(portals) {
    if (!Array.isArray(portals) || !portals.length) return;
    this._userDoors = true;
    if (this._connected) this._build(portals);
    else this._pendingDoors = portals;
  }

  /** @param {number} factor */
  setSpeed(factor) {
    const f = parseFloat(factor);
    if (!isNaN(f)) { this._slowTarget = f; this.setAttribute('speed', String(f)); }
  }

  /** @param {'idle'|'resonant'|'glitch'} state */
  setEntityState(state) {
    this._entityState = String(state || 'idle').toLowerCase();
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('rabble-doors')) {
  customElements.define('rabble-doors', RaBbLEDoorsElement);
}
