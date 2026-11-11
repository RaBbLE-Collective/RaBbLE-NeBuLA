/**
 * renderer.js — pure JSON layout -> DOM renderer.
 *
 * renderLayout(layoutDoc, breakpointId, hostEl, { editable }) rebuilds
 * hostEl's children from layoutDoc.instances (in `order`), applying that
 * breakpoint's styleOverrides as inline styles.
 *
 * Deliberately has no idea about selection outlines or drag handles — those
 * are canvas.js's job, decorating around this function's output. This
 * function is meant to be reused unchanged by a later HTML-export phase
 * (Phase 3, not built yet) with { editable: false }, which is why "editable"
 * only controls studio-only DOM hooks (data-instance-id, dataset.kind), not
 * any visual chrome.
 *
 * For kind: "element" instances, every one gets wrapped with a fixed
 * min-height (an Aether spacing token) before the live custom element is
 * appended — a single blanket rule, not per-tag special-casing, so any
 * future async NeBuLA element (Three.js-backed like <rabble-floor> /
 * <rabble-graph>, or synchronous like <rabble-doors>) is covered without
 * layout collapsing to 0px while it loads.
 */

const ELEMENT_PLACEHOLDER_MIN_HEIGHT = 'var(--rabble-space-8)';

/**
 * Parse a single-tag-usage HTML string (e.g. `<rabble-doors count="6"></rabble-doors>`)
 * into { tagName, attributes }. Uses a <template> so custom-element upgrade
 * happens naturally once the parsed tag is recreated via document.createElement.
 */
function parseElementMarkup(html) {
  const template = document.createElement('template');
  template.innerHTML = (html || '').trim();
  const sourceEl = template.content.firstElementChild;
  if (!sourceEl) return null;
  return { tagName: sourceEl.tagName.toLowerCase(), attributes: Array.from(sourceEl.attributes) };
}

function applyStyleOverrides(el, overrides) {
  if (!overrides) return;
  Object.keys(overrides).forEach(function (prop) {
    el.style[prop] = overrides[prop];
  });
}

/**
 * @param {object} layoutDoc
 * @param {string} breakpointId
 * @param {HTMLElement} hostEl
 * @param {{ editable?: boolean }} [options]
 * @returns {HTMLElement} hostEl, for convenience chaining
 */
export function renderLayout(layoutDoc, breakpointId, hostEl, options) {
  options = options || {};
  const editable = !!options.editable;

  hostEl.innerHTML = '';

  const instances = (layoutDoc.instances || []).slice().sort(function (a, b) {
    return a.order - b.order;
  });

  instances.forEach(function (instance) {
    const wrapper = document.createElement('div');
    wrapper.className = 'nebula-studio-instance';

    if (editable) {
      wrapper.dataset.instanceId = instance.id;
      wrapper.dataset.kind = instance.component.kind;
    }

    const overrides = instance.styleOverrides ? instance.styleOverrides[breakpointId] : null;

    if (instance.component.kind === 'element') {
      wrapper.style.minHeight = ELEMENT_PLACEHOLDER_MIN_HEIGHT;
      applyStyleOverrides(wrapper, overrides);

      const parsed = parseElementMarkup(instance.component.html);
      if (parsed) {
        const el = document.createElement(parsed.tagName);
        parsed.attributes.forEach(function (attr) {
          el.setAttribute(attr.name, attr.value);
        });
        wrapper.appendChild(el);
      }
    } else {
      applyStyleOverrides(wrapper, overrides);
      wrapper.innerHTML = instance.component.html;
    }

    hostEl.appendChild(wrapper);
  });

  return hostEl;
}
