/**
 * grimoire-ring.js — animated SVG rune ring for the Grimoire applet
 *
 * Three concentric layers spinning at different speeds/directions, 12 unicode
 * runes around the perimeter, and a swappable center slot. Color is driven by
 * the CSS custom property --ring-color so a single setProperty() call updates
 * all SVG strokes, fills, and text shadows that reference var(--ring-color).
 *
 * Usage:
 *   const ring = createGrimoireRing();
 *   container.appendChild(ring.el);
 *   ring.setColor('#00f5ff');
 *   ring.setCenter(someElement);  // swap the center content
 *   ring.setSummoning(true);      // accelerate ring + add is-summoning class
 *   ring.destroy();
 */

const RUNES = ['◈', '∿', '⌬', '※', '◇', '◆', '⌘', '◉', '✸', '⬡', '◎', '▸'];

function buildRuneSpans() {
  return RUNES.map((r, i) => {
    const a = (i / RUNES.length) * 360;
    return `<span class="sc-ring-rune"
      style="transform:rotate(${a}deg) translateY(-118px) rotate(${-a}deg);
             color:var(--ring-color);text-shadow:0 0 5px var(--ring-color)"
      >${r}</span>`;
  }).join('');
}

/**
 * @param {object} [opts]
 * @param {string} [opts.color='#bf5fff']
 * @returns {{
 *   el: HTMLElement,
 *   centerEl: HTMLElement,
 *   setColor(c:string): void,
 *   setSummoning(b:boolean): void,
 *   setCenter(node:Node): void,
 *   destroy(): void,
 * }}
 */
export function createGrimoireRing(opts = {}) {
  const { color = '#bf5fff' } = opts;

  const el = document.createElement('div');
  el.className = 'sc-ring';
  el.style.setProperty('--ring-color', color);

  // Tick marks around the outer ring
  const ticks = Array.from({ length: 24 }, (_, i) => {
    const a  = (i / 24) * Math.PI * 2;
    const r1 = i % 6 === 0 ? 84 : 86;
    const r2 = 92;
    const x1 = (100 + Math.cos(a) * r1).toFixed(2), y1 = (100 + Math.sin(a) * r1).toFixed(2);
    const x2 = (100 + Math.cos(a) * r2).toFixed(2), y2 = (100 + Math.sin(a) * r2).toFixed(2);
    const w  = i % 6 === 0 ? '0.9' : '0.3';
    const op = i % 6 === 0 ? '0.95' : '0.4';
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
      style="stroke:var(--ring-color)" stroke-width="${w}" opacity="${op}"/>`;
  }).join('');

  el.innerHTML = `
<div class="sc-ring-halo"></div>

<svg viewBox="0 0 200 200" class="sc-ring-svg" aria-hidden="true">
  <defs>
    <radialGradient id="sc-ring-floor" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="var(--ring-color)" stop-opacity="0.10"/>
      <stop offset="70%"  stop-color="var(--ring-color)" stop-opacity="0.02"/>
      <stop offset="100%" stop-color="var(--ring-color)" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- inner floor wash -->
  <circle cx="100" cy="100" r="78" fill="url(#sc-ring-floor)"/>

  <!-- outer solid ring -->
  <circle cx="100" cy="100" r="92" fill="none"
    style="stroke:var(--ring-color);filter:drop-shadow(0 0 6px var(--ring-color))"
    stroke-width="0.7" opacity="0.45"/>

  <!-- counter-rotating dashed inner rings -->
  <g class="sc-ring-counter">
    <circle cx="100" cy="100" r="70" fill="none"
      style="stroke:var(--ring-color)" stroke-width="0.5" stroke-dasharray="2 5" opacity="0.55"/>
    <circle cx="100" cy="100" r="62" fill="none"
      style="stroke:var(--ring-color)" stroke-width="0.3" stroke-dasharray="1 4" opacity="0.45"/>
  </g>

  <!-- rotating mid ring with tick marks -->
  <g class="sc-ring-rotate">
    <circle cx="100" cy="100" r="82" fill="none"
      style="stroke:var(--ring-color)" stroke-width="0.4" stroke-dasharray="1 8" opacity="0.75"/>
    ${ticks}
  </g>

  <!-- axis crosshairs -->
  <line x1="100" y1="8"   x2="100" y2="22"  style="stroke:var(--ring-color)" stroke-width="0.6" opacity="0.7"/>
  <line x1="100" y1="178" x2="100" y2="192" style="stroke:var(--ring-color)" stroke-width="0.6" opacity="0.7"/>
  <line x1="8"   y1="100" x2="22"  y2="100" style="stroke:var(--ring-color)" stroke-width="0.6" opacity="0.7"/>
  <line x1="178" y1="100" x2="192" y2="100" style="stroke:var(--ring-color)" stroke-width="0.6" opacity="0.7"/>
</svg>

<!-- Rune perimeter -->
<div class="sc-ring-runes">${buildRuneSpans()}</div>

<!-- Center content slot (swapped by setCenter) -->
<div class="sc-ring-center"></div>`;

  const centerSlot = el.querySelector('.sc-ring-center');

  function setColor(c) {
    el.style.setProperty('--ring-color', c);
    // Update rune text-shadow (inline style) by re-stamping the rune spans
    const runesWrap = el.querySelector('.sc-ring-runes');
    if (runesWrap) runesWrap.innerHTML = buildRuneSpans();
  }

  function setSummoning(active) {
    el.classList.toggle('is-summoning', active);
  }

  /** Replace the ring center with any DOM node (AmbientEye or HologramSigil). */
  function setCenter(node) {
    centerSlot.innerHTML = '';
    if (node) centerSlot.appendChild(node);
  }

  function destroy() { el.remove(); }

  return { el, centerEl: centerSlot, setColor, setSummoning, setCenter, destroy };
}
