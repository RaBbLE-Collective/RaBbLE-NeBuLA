/**
 * entity-mini.js — SVG mini-entity renderer
 *
 * Creates a scaled-down twin of <rabble-entity>: particle haze + twin orb-eyes
 * in opposing portal slits. Each Collective entity has its own palette so they
 * read as distinct beings.
 *
 * Usage:
 *   const mini = createEntityMini('e-aether', { size: 48 });
 *   container.appendChild(mini.el);
 *   mini.destroy();
 */

let _uid = 0;

/** Canonical entity color palettes. Left/right eye + haze + particle dots. */
export const ENTITY_PALETTES = {
  'e-rabble':   { left: '#ff2d78', right: '#00f5ff', haze: '#bf5fff', dots: ['#bf5fff', '#3377ee', '#ff79c6', '#ffffff'] },
  'e-aether':   { left: '#ff79c6', right: '#ff2d78', haze: '#ff2d78', dots: ['#bf5fff', '#ff2d78', '#ff79c6', '#ffffff'] },
  'e-nebula':   { left: '#bf5fff', right: '#00f5ff', haze: '#7744cc', dots: ['#7744cc', '#3377ee', '#aabbee', '#bf5fff'] },
  'e-score':    { left: '#50fa7b', right: '#00f5ff', haze: '#1a4aaa', dots: ['#1a4aaa', '#00bbdd', '#50fa7b', '#00eeff'] },
  'e-scribble': { left: '#ff79c6', right: '#bf5fff', haze: '#9944dd', dots: ['#9944dd', '#ff79c6', '#bf5fff', '#ffffff'] },
  'e-os':       { left: '#bf5fff', right: '#00f5ff', haze: '#5533aa', dots: ['#5533aa', '#00eeff', '#aabbee', '#3377ee'] },
};

/**
 * Deterministic dot layout — same seed produces the same particle field every
 * render, preventing layout thrash when the component re-mounts.
 */
function buildDots(seed, count) {
  const dots = [];
  for (let i = 0; i < count; i++) {
    const a = ((Math.sin(i * 12.9898 + seed) * 43758.5453) % 1 + 1) % 1;
    const b = ((Math.sin(i * 78.2330 + seed) * 43758.5453) % 1 + 1) % 1;
    const c = ((Math.sin(i * 39.3460 + seed) * 43758.5453) % 1 + 1) % 1;
    const ang = a * Math.PI * 2;
    const rad = Math.pow(b, 0.55);
    dots.push({
      x: 30 + Math.cos(ang) * rad * 24,
      y: 22 + Math.sin(ang) * rad * 13,
      r: 0.35 + c * 1.0,
      delay: a * 5,
      dur:   3   + c * 3,
    });
  }
  return dots;
}

/**
 * @param {string} entityId   — e.g. 'e-aether', 'e-nebula'
 * @param {object} [opts]
 * @param {number} [opts.size=34]          — width in px; height is size*(40/60)
 * @param {boolean} [opts.dense=false]     — 36 vs 14 particles
 * @param {boolean} [opts.holographic=false] — adds scanline overlay
 * @param {boolean} [opts.blinking=false]  — CSS blink animation on orbs
 * @returns {{ el: HTMLElement, destroy: () => void }}
 */
export function createEntityMini(entityId, opts = {}) {
  const { size = 34, dense = false, holographic = false, blinking = false } = opts;
  const palette = ENTITY_PALETTES[entityId] || ENTITY_PALETTES['e-rabble'];
  const seed    = (entityId.charCodeAt(2) || 7);
  const count   = dense ? 36 : 14;
  const dots    = buildDots(seed, count);
  const uid     = `em${_uid++}`;
  const w       = size;
  const h       = Math.round(size * (40 / 60));

  // Geometry mirrors Canvas2D backend proportions (scaled to 60×40 viewBox)
  const cx       = 30, baseY = 19;
  const eyeGap   = 4.8, eyeRx = 1.95, eyeRy = 3.55;
  const portalRx = 4.0, portalRy = 1.25, portalDY = 3.2;
  const haloR    = 5.8;
  const lx = cx - eyeGap, rx = cx + eyeGap;
  const lPortalY = baseY + portalDY, rPortalY = baseY - portalDY;

  const dotsSvg = dots.map((d, i) => {
    const fill = palette.dots[i % palette.dots.length];
    return `<circle cx="${d.x.toFixed(2)}" cy="${d.y.toFixed(2)}" r="${d.r.toFixed(2)}"
      fill="${fill}" class="ec-dot"
      style="animation-delay:-${d.delay.toFixed(2)}s;animation-duration:${d.dur.toFixed(2)}s"/>`;
  }).join('');

  const el = document.createElement('span');
  el.className = 'entity-creature' + (holographic ? ' is-holo' : '') + (blinking ? ' is-blink' : '');
  el.style.cssText = `width:${w}px;height:${h}px;--ec-left:${palette.left};--ec-right:${palette.right}`;

  el.innerHTML = `
<svg viewBox="0 0 60 40" class="ec-svg" aria-hidden="true">
  <defs>
    <radialGradient id="${uid}-haze" cx="50%" cy="55%" r="50%">
      <stop offset="0%"   stop-color="${palette.haze}" stop-opacity="0.50"/>
      <stop offset="55%"  stop-color="${palette.haze}" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="${palette.haze}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${uid}-portal" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="#010108"/>
      <stop offset="65%"  stop-color="#05050e"/>
      <stop offset="100%" stop-color="#010108" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${uid}-haloL" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="${palette.left}"  stop-opacity="0.30"/>
      <stop offset="100%" stop-color="${palette.left}"  stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${uid}-haloR" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="${palette.right}" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="${palette.right}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Nebula haze -->
  <ellipse cx="30" cy="22" rx="27" ry="17" fill="url(#${uid}-haze)"/>

  <!-- Particle field -->
  ${dotsSvg}

  <!-- Portal slits — left below, right above (asymmetric offset) -->
  <ellipse cx="${lx}" cy="${lPortalY}" rx="${portalRx}" ry="${portalRy}" fill="url(#${uid}-portal)"/>
  <ellipse cx="${rx}" cy="${rPortalY}" rx="${portalRx}" ry="${portalRy}" fill="url(#${uid}-portal)"/>
  <ellipse cx="${lx}" cy="${lPortalY}" rx="${portalRx}" ry="${portalRy}"
    fill="none" stroke="${palette.left}" stroke-width="0.25" opacity="0.7"
    style="filter:drop-shadow(0 0 0.8px ${palette.left})"/>
  <ellipse cx="${rx}" cy="${rPortalY}" rx="${portalRx}" ry="${portalRy}"
    fill="none" stroke="${palette.right}" stroke-width="0.25" opacity="0.7"
    style="filter:drop-shadow(0 0 0.8px ${palette.right})"/>

  <!-- Outer halos -->
  <circle cx="${lx}" cy="${baseY}" r="${haloR}" fill="url(#${uid}-haloL)"/>
  <circle cx="${rx}" cy="${baseY}" r="${haloR}" fill="url(#${uid}-haloR)"/>

  <!-- Eye orbs -->
  <g class="ec-orb-wrap ec-orb-wrap--left">
    <ellipse cx="${lx}" cy="${baseY}" rx="${eyeRx}" ry="${eyeRy}"
      fill="#f8faff" stroke="${palette.left}" stroke-width="0.32"
      style="filter:drop-shadow(0 0 1.4px ${palette.left}) drop-shadow(0 0 0.6px ${palette.left})"/>
  </g>
  <g class="ec-orb-wrap ec-orb-wrap--right">
    <ellipse cx="${rx}" cy="${baseY}" rx="${eyeRx}" ry="${eyeRy}"
      fill="#f8faff" stroke="${palette.right}" stroke-width="0.32"
      style="filter:drop-shadow(0 0 1.4px ${palette.right}) drop-shadow(0 0 0.6px ${palette.right})"/>
  </g>
</svg>
${holographic ? '<span class="ec-scanlines" aria-hidden="true"></span>' : ''}`;

  return {
    el,
    destroy() { el.remove(); },
  };
}
