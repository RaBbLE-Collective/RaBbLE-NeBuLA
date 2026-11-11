/**
 * instance-controls.js — overlay chrome for the currently selected instance.
 *
 * canvas.js mounts one of these onto the selected instance's wrapper element
 * (and destroys it on deselect/re-render) — a delete button and edge/corner
 * resize handles. Resize drags mutate the wrapper's inline style live for
 * immediate feedback via plain mousedown/mousemove/mouseup (not HTML5 DnD,
 * which is already spoken for by dnd.js's drag-to-reorder on the same
 * wrapper); the final size is only reported back via onResizeCommit on
 * mouseup, matching the rest of the app's "commit on change, not per-frame"
 * pattern. draggable is explicitly forced false on every control element so
 * a mousedown here can't be reinterpreted as a native drag on the
 * draggable="true" wrapper underneath.
 */

const HANDLE_DIRS = ['e', 's', 'se'];

export function attachInstanceControls(wrapperEl, options) {
  options = options || {};

  const overlay = document.createElement('div');
  overlay.className = 'nebula-studio-controls';
  overlay.draggable = false;

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'nebula-studio-control-delete';
  deleteBtn.draggable = false;
  deleteBtn.title = 'Delete';
  deleteBtn.textContent = '×';
  deleteBtn.addEventListener('click', function (ev) {
    ev.stopPropagation();
    if (options.onDelete) options.onDelete();
  });
  overlay.appendChild(deleteBtn);

  function startResize(dir, startEv) {
    startEv.preventDefault();
    startEv.stopPropagation();

    const startX = startEv.clientX;
    const startY = startEv.clientY;
    const startRect = wrapperEl.getBoundingClientRect();

    function onMove(mv) {
      const dx = mv.clientX - startX;
      const dy = mv.clientY - startY;
      if (dir.indexOf('e') !== -1) {
        wrapperEl.style.width = Math.max(20, Math.round(startRect.width + dx)) + 'px';
      }
      if (dir.indexOf('s') !== -1) {
        wrapperEl.style.height = Math.max(20, Math.round(startRect.height + dy)) + 'px';
      }
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (options.onResizeCommit) {
        const size = {};
        if (dir.indexOf('e') !== -1) size.width = wrapperEl.style.width;
        if (dir.indexOf('s') !== -1) size.height = wrapperEl.style.height;
        options.onResizeCommit(size);
      }
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  HANDLE_DIRS.forEach(function (dir) {
    const handle = document.createElement('div');
    handle.className = 'nebula-studio-resize-handle nebula-studio-resize-' + dir;
    handle.draggable = false;
    handle.addEventListener('mousedown', function (ev) { startResize(dir, ev); });
    overlay.appendChild(handle);
  });

  wrapperEl.appendChild(overlay);

  return {
    destroy: function () { overlay.remove(); },
  };
}
