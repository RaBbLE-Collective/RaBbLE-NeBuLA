/**
 * elements/doors.js — <rabble-doors> custom element (P5 stub)
 *
 * Stub registration so the API surface exists for the catalog.
 * The Chrysalis Liminal orbital-doors concept (six portal doors on
 * elliptical paths) is the eventual source. Full implementation is
 * post-EP1 scope.
 *
 * Attributes (reserved, not yet reactive):
 *   count    — number of doors (default 6)
 *   speed    — orbit speed factor (default 1.0)
 *   compact  — boolean, collapses to grid layout
 *
 * Events:
 *   rabble-doors-enter  — pointer enters a door; detail: { id, name, url }
 *   rabble-doors-leave  — pointer leaves a door
 *   rabble-doors-trace  — user has traced all doors (genius resonance)
 *
 * Methods:
 *   setDoors(portals[])   — array of { id, name, url, glyph, accent }
 *   setSpeed(factor)
 *   setEntityState(state) — 'idle'|'resonant'|'glitch'
 */
class RaBbLEDoorsElement extends HTMLElement {
  connectedCallback() {
    if (this._connected) return;
    this._connected = true;

    if (!this._silent) {
      console.warn('[rabble-doors] stub element — full orbital-door implementation is post-EP1');
    }

    // Minimal placeholder so the element renders something
    if (!this.style.display) this.style.display = 'block';
    this.setAttribute('aria-label', 'rabble-doors (stub)');
  }

  disconnectedCallback() {
    this._connected = false;
  }

  /** @param {Array<{id:string, name:string, url:string, glyph:string, accent:string}>} portals */
  setDoors(_portals) {
    // stub
  }

  /** @param {number} factor */
  setSpeed(_factor) {
    // stub
  }

  /** @param {'idle'|'resonant'|'glitch'} state */
  setEntityState(_state) {
    // stub
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('rabble-doors')) {
  customElements.define('rabble-doors', RaBbLEDoorsElement);
}
