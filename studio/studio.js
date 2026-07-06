/**
 * studio.js — NeBuLA Studio entry point.
 *
 * Wires catalog-parser -> palette-panel, layout-schema -> canvas,
 * breakpoint-toolbar -> canvas, layout-store Save/Load -> canvas.
 *
 * Loaded as a plain ESM <script type="module">, no bundler. NeBuLA's iife
 * bundle (registering <rabble-*> custom elements) and Aether's CSS are
 * loaded by <link>/<script> tags in index.html, ahead of this module.
 */

import { createEmptyLayout } from './layout-schema.js';
import { createCanvas } from './canvas.js';
import { createPalettePanel } from './palette-panel.js';
import { createBreakpointToolbar } from './breakpoint-toolbar.js';
import { saveLayout, loadLayoutFromFile, loadAutosave } from './layout-store.js';

function init() {
  const paletteEl = document.getElementById('studio-palette');
  const canvasEl = document.getElementById('studio-canvas');
  const toolbarEl = document.getElementById('studio-breakpoint-toolbar');
  const saveBtn = document.getElementById('studio-save-btn');
  const loadBtn = document.getElementById('studio-load-btn');
  const loadInput = document.getElementById('studio-load-input');

  const restored = loadAutosave();
  const initialLayout = restored || createEmptyLayout();

  const canvas = createCanvas(canvasEl, { initialLayout: initialLayout });

  createPalettePanel(paletteEl);

  const toolbar = createBreakpointToolbar(toolbarEl, canvas.getLayout(), {
    onChange: function (bp) { canvas.setBreakpoint(bp); },
  });

  saveBtn.addEventListener('click', function () {
    saveLayout(canvas.getLayout());
  });

  loadBtn.addEventListener('click', function () {
    loadInput.click();
  });

  loadInput.addEventListener('change', async function (ev) {
    const file = ev.target.files[0];
    if (!file) return;
    try {
      const doc = await loadLayoutFromFile(file);
      canvas.setLayout(doc);
      toolbar.setBreakpoints(doc);
    } catch (err) {
      console.error('[nebula-studio] load failed', err);
      window.alert('Could not load layout. ' + err.message);
    } finally {
      loadInput.value = '';
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
