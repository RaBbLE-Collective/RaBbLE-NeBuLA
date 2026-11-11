/**
 * dnd.js — hand-rolled native HTML5 drag-and-drop helper.
 *
 * No vendored DnD library: zero DnD code existed anywhere in this codebase
 * before this file (verified across BaBbLE's two prototypes and Chrysalis's
 * legacy Studio), and the MVP interaction (palette -> canvas append,
 * in-canvas reorder) is exactly what the native API covers in any evergreen
 * desktop browser.
 *
 * Two payload kinds travel over dataTransfer, each under its own custom MIME
 * type so a drop handler can tell them apart without inspecting content:
 *   - PALETTE_TYPE: a component descriptor dragged from the palette
 *   - REORDER_TYPE: an instance id being dragged within the canvas
 */

const PALETTE_TYPE = 'application/x-nebula-palette';
const REORDER_TYPE = 'application/x-nebula-reorder';

/** Make a palette entry draggable. getDescriptor() is called at dragstart time. */
export function makePaletteDraggable(el, getDescriptor) {
  el.draggable = true;
  el.addEventListener('dragstart', function (ev) {
    const descriptor = getDescriptor();
    ev.dataTransfer.setData(PALETTE_TYPE, JSON.stringify(descriptor));
    ev.dataTransfer.effectAllowed = 'copy';
  });
}

/** Make a placed canvas instance draggable, for in-canvas reordering. */
export function makeInstanceDraggable(el, instanceId) {
  el.draggable = true;
  el.addEventListener('dragstart', function (ev) {
    ev.dataTransfer.setData(REORDER_TYPE, JSON.stringify({ instanceId: instanceId }));
    ev.dataTransfer.effectAllowed = 'move';
    el.classList.add('is-dragging');
  });
  el.addEventListener('dragend', function () {
    el.classList.remove('is-dragging');
  });
}

/**
 * Wire hostEl up as a drop target for both payload kinds.
 * onDropComponent(descriptor, beforeInstanceId|null)
 * onReorder(instanceId, beforeInstanceId|null)
 * beforeInstanceId is null when the drop lands after the last placed instance.
 */
export function makeDropZone(hostEl, handlers) {
  handlers = handlers || {};

  hostEl.addEventListener('dragover', function (ev) {
    ev.preventDefault();
    const types = ev.dataTransfer.types || [];
    ev.dataTransfer.dropEffect = Array.prototype.indexOf.call(types, REORDER_TYPE) !== -1 ? 'move' : 'copy';
  });

  hostEl.addEventListener('drop', function (ev) {
    ev.preventDefault();
    const beforeId = findDropTargetInstanceId(hostEl, ev.clientY);

    const reorderRaw = ev.dataTransfer.getData(REORDER_TYPE);
    if (reorderRaw) {
      try {
        const payload = JSON.parse(reorderRaw);
        if (handlers.onReorder) handlers.onReorder(payload.instanceId, beforeId);
      } catch (err) {
        console.warn('[nebula-studio] malformed reorder payload', err);
      }
      return;
    }

    const paletteRaw = ev.dataTransfer.getData(PALETTE_TYPE);
    if (paletteRaw) {
      try {
        const descriptor = JSON.parse(paletteRaw);
        if (handlers.onDropComponent) handlers.onDropComponent(descriptor, beforeId);
      } catch (err) {
        console.warn('[nebula-studio] malformed palette payload', err);
      }
    }
  });
}

/** Find which placed instance (if any) the pointer is above the midpoint of. */
function findDropTargetInstanceId(hostEl, clientY) {
  const items = Array.prototype.slice.call(hostEl.querySelectorAll('[data-instance-id]'));
  for (let i = 0; i < items.length; i++) {
    const rect = items[i].getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) return items[i].dataset.instanceId;
  }
  return null;
}
