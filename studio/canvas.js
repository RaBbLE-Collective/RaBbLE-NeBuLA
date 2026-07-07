/**
 * canvas.js — the drop target and instance manager.
 *
 * Holds the current layoutDoc in memory, renders it via renderer.js's
 * renderLayout({ editable: true }), and decorates the rendered output with
 * selection + drag-to-reorder chrome (dnd.js) — the decoration renderer.js
 * deliberately stays ignorant of. On any mutation (drop, reorder, delete,
 * resize, breakpoint switch) it re-renders and autosaves.
 */

import { renderLayout } from './renderer.js';
import { makeDropZone, makeInstanceDraggable } from './dnd.js';
import { attachInstanceControls } from './instance-controls.js';
import { genInstanceId } from './layout-schema.js';
import { autosaveLayout } from './layout-store.js';

export function createCanvas(hostEl, options) {
  options = options || {};

  let layoutDoc = options.initialLayout;
  let currentBreakpoint = layoutDoc.breakpoints[0] ? layoutDoc.breakpoints[0].id : 'desktop';
  let selectedId = null;
  let activeControls = null;
  const onChange = options.onChange;

  function applyFrameWidth() {
    const bp = layoutDoc.breakpoints.find(function (b) { return b.id === currentBreakpoint; });
    hostEl.style.width = (bp ? bp.width : 1280) + 'px';
  }

  function nextOrder() {
    if (!layoutDoc.instances.length) return 0;
    return Math.max.apply(null, layoutDoc.instances.map(function (i) { return i.order; })) + 1;
  }

  function reindexOrder() {
    layoutDoc.instances.forEach(function (inst, i) { inst.order = i; });
  }

  function emptyStyleOverrides() {
    const overrides = {};
    layoutDoc.breakpoints.forEach(function (bp) { overrides[bp.id] = {}; });
    return overrides;
  }

  function insertInstance(instance, beforeId) {
    if (beforeId == null) {
      layoutDoc.instances.push(instance);
    } else {
      const idx = layoutDoc.instances.findIndex(function (i) { return i.id === beforeId; });
      if (idx === -1) layoutDoc.instances.push(instance);
      else layoutDoc.instances.splice(idx, 0, instance);
    }
    reindexOrder();
    afterChange();
  }

  function handleDropComponent(descriptor, beforeId) {
    const instance = {
      id: genInstanceId(),
      component: {
        source: descriptor.source || 'atlas',
        sectionId: descriptor.sectionId || '',
        name: descriptor.name || '',
        kind: descriptor.kind,
        html: descriptor.html,
      },
      attrs: {},
      styleOverrides: emptyStyleOverrides(),
      order: nextOrder(),
    };
    insertInstance(instance, beforeId);
  }

  function handleReorder(instanceId, beforeId) {
    if (instanceId === beforeId) return;
    const idx = layoutDoc.instances.findIndex(function (i) { return i.id === instanceId; });
    if (idx === -1) return;
    const moved = layoutDoc.instances.splice(idx, 1)[0];

    if (beforeId == null) {
      layoutDoc.instances.push(moved);
    } else {
      const targetIdx = layoutDoc.instances.findIndex(function (i) { return i.id === beforeId; });
      if (targetIdx === -1) layoutDoc.instances.push(moved);
      else layoutDoc.instances.splice(targetIdx, 0, moved);
    }
    reindexOrder();
    afterChange();
  }

  function deleteInstance(id) {
    const idx = layoutDoc.instances.findIndex(function (i) { return i.id === id; });
    if (idx === -1) return;
    layoutDoc.instances.splice(idx, 1);
    reindexOrder();
    if (selectedId === id) selectedId = null;
    afterChange();
  }

  function commitResize(id, size) {
    const inst = layoutDoc.instances.find(function (i) { return i.id === id; });
    if (!inst) return;
    if (!inst.styleOverrides[currentBreakpoint]) inst.styleOverrides[currentBreakpoint] = {};
    if (size.width) inst.styleOverrides[currentBreakpoint].width = size.width;
    if (size.height) inst.styleOverrides[currentBreakpoint].height = size.height;
    afterChange();
  }

  function mountControlsForSelection() {
    if (activeControls) {
      activeControls.destroy();
      activeControls = null;
    }
    if (!selectedId) return;
    const el = hostEl.querySelector('[data-instance-id="' + selectedId + '"]');
    if (!el) return;
    activeControls = attachInstanceControls(el, {
      onDelete: function () { deleteInstance(selectedId); },
      onResizeCommit: function (size) { commitResize(selectedId, size); },
    });
  }

  function updateSelectionClasses() {
    hostEl.querySelectorAll('[data-instance-id]').forEach(function (el) {
      el.classList.toggle('is-selected', el.dataset.instanceId === selectedId);
    });
    mountControlsForSelection();
  }

  function selectInstance(id) {
    selectedId = id;
    updateSelectionClasses();
  }

  function render() {
    renderLayout(layoutDoc, currentBreakpoint, hostEl, { editable: true });
    hostEl.querySelectorAll('[data-instance-id]').forEach(function (el) {
      makeInstanceDraggable(el, el.dataset.instanceId);
      el.addEventListener('click', function (ev) {
        ev.stopPropagation();
        selectInstance(el.dataset.instanceId);
      });
    });
    updateSelectionClasses();
  }

  function afterChange() {
    layoutDoc.meta.updatedAt = new Date().toISOString();
    render();
    autosaveLayout(layoutDoc);
    if (onChange) onChange(layoutDoc);
  }

  makeDropZone(hostEl, {
    onDropComponent: handleDropComponent,
    onReorder: handleReorder,
  });

  hostEl.addEventListener('click', function () { selectInstance(null); });

  document.addEventListener('keydown', function (ev) {
    if (!selectedId) return;
    if (ev.key !== 'Delete' && ev.key !== 'Backspace') return;
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
    ev.preventDefault();
    deleteInstance(selectedId);
  });

  applyFrameWidth();
  render();

  return {
    getLayout: function () { return layoutDoc; },
    setLayout: function (doc) {
      layoutDoc = doc;
      currentBreakpoint = layoutDoc.breakpoints[0] ? layoutDoc.breakpoints[0].id : 'desktop';
      selectedId = null;
      applyFrameWidth();
      render();
    },
    setBreakpoint: function (bp) {
      currentBreakpoint = bp.id;
      applyFrameWidth();
      render();
    },
    getSelectedId: function () { return selectedId; },
    deleteSelected: function () { if (selectedId) deleteInstance(selectedId); },
  };
}
