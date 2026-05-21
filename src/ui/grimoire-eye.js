/**
 * grimoire-eye.js — SVG entity eye renderers for the Grimoire applet
 *
 * createGrimoireEye()  — the "Watching Entity" header eye: blinks on a random
 *   schedule, contracts its pupil and shifts color during a summon ritual.
 *
 * createAmbientEye()   — the ring-center ambient entity at rest: slow pupil
 *   pulse, iris drift, no interaction.
 *
 * Both return { el, ...controls, destroy() }. Color is driven by the CSS
 * custom property --eye-color so a single setProperty() call updates all
 * SVG strokes/fills that reference var(--eye-color) via inline style.
 */

let _uid = 0;

/**
 * @param {object} [opts]
 * @param {string} [opts.color='#bf5fff']
 * @returns {{ el: HTMLElement, setColor(c:string):void, setSummoning(b:boolean):void, triggerBlink():void, startBlinkLoop():()=>void, destroy():void }}
 */
export function createGrimoireEye(opts = {}) {
  const { color = '#bf5fff' } = opts;
  const uid = `ge${_uid++}`;

  const el = document.createElement('div');
  el.className = 'sc-eye';
  el.style.setProperty('--eye-color', color);

  el.innerHTML = `
<svg viewBox="0 0 40 40" class="sc-eye-svg" aria-hidden="true">
  <defs>
    <radialGradient id="${uid}-iris" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="var(--eye-color)" stop-opacity="0"/>
      <stop offset="60%"  stop-color="var(--eye-color)" stop-opacity="0"/>
      <stop offset="100%" stop-color="var(--eye-color)" stop-opacity="0.55"/>
    </radialGradient>
  </defs>
  <!-- outer ring -->
  <circle cx="20" cy="20" r="14" fill="none"
    style="stroke:var(--eye-color);filter:drop-shadow(0 0 3px var(--eye-color))"
    stroke-width="0.7" opacity="0.85"/>
  <!-- iris glow -->
  <circle cx="20" cy="20" r="12" fill="url(#${uid}-iris)"/>
  <!-- dashed counter-rotating mid ring -->
  <g class="sc-eye-spin">
    <circle cx="20" cy="20" r="9" fill="none"
      style="stroke:var(--eye-color)" stroke-width="0.4" stroke-dasharray="1 2" opacity="0.8"/>
  </g>
  <!-- pupil -->
  <circle class="sc-eye-pupil" cx="20" cy="20" r="3.4"
    style="fill:var(--eye-color);filter:drop-shadow(0 0 4px var(--eye-color));transition:r 240ms"/>
  <!-- eyelid (slides in on .is-blink) -->
  <rect class="sc-eye-lid" x="3" y="2" width="34" height="36" rx="14" fill="#03000b"/>
</svg>
<div class="sc-eye-label">
  <div class="sc-eye-name">RaBbLE</div>
  <div class="sc-eye-state">watching</div>
</div>`;

  const pupil    = el.querySelector('.sc-eye-pupil');
  const stateEl  = el.querySelector('.sc-eye-state');
  let _blinkTimer = null;

  function setColor(c) {
    el.style.setProperty('--eye-color', c);
  }

  function setSummoning(active) {
    el.classList.toggle('is-alert', active);
    if (pupil) pupil.setAttribute('r', active ? '2.2' : '3.4');
    if (stateEl) stateEl.textContent = active ? 'witnessing' : 'watching';
  }

  function triggerBlink() {
    el.classList.add('is-blink');
    setTimeout(() => el.classList.remove('is-blink'), 140);
  }

  /** Starts the random blink loop. Returns a cancel function. */
  function startBlinkLoop() {
    let cancelled = false;
    function schedule() {
      if (cancelled) return;
      _blinkTimer = setTimeout(() => {
        triggerBlink();
        schedule();
      }, 2400 + Math.random() * 3600);
    }
    schedule();
    return function cancel() {
      cancelled = true;
      clearTimeout(_blinkTimer);
    };
  }

  function destroy() {
    clearTimeout(_blinkTimer);
    el.remove();
  }

  return { el, setColor, setSummoning, triggerBlink, startBlinkLoop, destroy };
}


/**
 * @returns {{ el: HTMLElement, destroy: () => void }}
 */
export function createAmbientEye() {
  const el = document.createElement('div');
  el.className = 'sc-ambient';

  el.innerHTML = `
<svg viewBox="0 0 60 60" class="sc-ambient-svg" aria-hidden="true">
  <circle cx="30" cy="30" r="22" fill="none" stroke="#bf5fff" stroke-width="0.5" opacity="0.5"/>
  <circle cx="30" cy="30" r="16" fill="none" stroke="#bf5fff" stroke-width="0.4"
    stroke-dasharray="1 2" opacity="0.6" class="sc-ambient-iris"/>
  <circle cx="30" cy="30" r="6" fill="#bf5fff"
    style="filter:drop-shadow(0 0 6px #bf5fff)" class="sc-ambient-pupil"/>
</svg>`;

  return {
    el,
    destroy() { el.remove(); },
  };
}
