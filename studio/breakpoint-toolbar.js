/**
 * breakpoint-toolbar.js — Desktop / Tablet / Mobile switcher.
 *
 * Widths come from the layout document's own `breakpoints` array (not a
 * hardcoded constant here), since the schema is the single source of truth
 * for those values.
 */

export function createBreakpointToolbar(hostEl, layoutDoc, options) {
  options = options || {};
  const onChange = options.onChange;

  let breakpoints = layoutDoc.breakpoints;
  let currentId = breakpoints[0] ? breakpoints[0].id : null;

  function render() {
    hostEl.innerHTML = '';
    breakpoints.forEach(function (bp) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'studio-breakpoint-btn rabble-btn is-secondary' + (bp.id === currentId ? ' is-active' : '');
      btn.textContent = bp.label + ' · ' + bp.width;
      btn.addEventListener('click', function () {
        if (bp.id === currentId) return;
        currentId = bp.id;
        render();
        if (onChange) onChange(bp);
      });
      hostEl.appendChild(btn);
    });
  }

  render();

  return {
    getCurrentId: function () { return currentId; },
    /** Swap in a freshly loaded layout document's breakpoints (e.g. after Load). */
    setBreakpoints: function (doc) {
      breakpoints = doc.breakpoints;
      currentId = breakpoints[0] ? breakpoints[0].id : null;
      render();
    },
  };
}
