/**
 * palette-panel.js — renders the draggable component palette.
 *
 * Parses the catalog once on load, groups entries by section, and renders a
 * draggable card per entry (dnd.js handles the actual drag payload). A
 * "Refresh Palette" button re-parses on demand, for when the catalog page
 * gains new components mid-session.
 */

import { parseCatalog, refreshCatalog, DEFAULT_CATALOG_URL } from './catalog-parser.js';
import { makePaletteDraggable } from './dnd.js';

function escapeText(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderCatalog(hostEl, catalog, onRefreshClick) {
  hostEl.innerHTML = '';

  const refreshBtn = document.createElement('button');
  refreshBtn.type = 'button';
  refreshBtn.className = 'studio-palette-refresh rabble-btn is-secondary';
  refreshBtn.textContent = 'Refresh Palette';
  refreshBtn.addEventListener('click', function () {
    onRefreshClick(refreshBtn);
  });
  hostEl.appendChild(refreshBtn);

  if (!catalog.sections.length) {
    const empty = document.createElement('p');
    empty.className = 'studio-palette-empty';
    empty.textContent = 'No draggable components found in the catalog.';
    hostEl.appendChild(empty);
    return;
  }

  catalog.sections.forEach(function (section) {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'studio-palette-section';

    const heading = document.createElement('div');
    heading.className = 'studio-palette-section-label';
    heading.textContent = section.label;
    sectionEl.appendChild(heading);

    section.entries.forEach(function (entry) {
      const card = document.createElement('div');
      card.className = 'studio-palette-entry';
      card.innerHTML =
        '<span class="studio-palette-entry-name">' + escapeText(entry.name) + '</span>' +
        '<span class="studio-palette-entry-kind rabble-badge rabble-accent-' +
        (entry.kind === 'element' ? 'cyan' : 'magenta') + '">' + entry.kind + '</span>';

      makePaletteDraggable(card, function () {
        return {
          source: 'atlas',
          sectionId: entry.sectionId,
          name: entry.name,
          kind: entry.kind,
          html: entry.html,
        };
      });

      sectionEl.appendChild(card);
    });

    hostEl.appendChild(sectionEl);
  });
}

/**
 * @param {HTMLElement} hostEl
 * @param {{ catalogUrl?: string }} [options]
 * @returns {{ refresh: () => Promise<void> }}
 */
export function createPalettePanel(hostEl, options) {
  options = options || {};
  const catalogUrl = options.catalogUrl || DEFAULT_CATALOG_URL;

  async function doRefresh(refreshBtn) {
    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Refreshing...';
    }
    try {
      const catalog = await refreshCatalog(catalogUrl);
      renderCatalog(hostEl, catalog, doRefresh);
    } catch (err) {
      console.error('[nebula-studio] palette refresh failed', err);
      hostEl.innerHTML = '<p class="studio-palette-empty">Could not load catalog: ' + escapeText(err.message) + '</p>';
    }
  }

  async function init() {
    try {
      const catalog = await parseCatalog(catalogUrl);
      renderCatalog(hostEl, catalog, doRefresh);
    } catch (err) {
      console.error('[nebula-studio] palette load failed', err);
      hostEl.innerHTML = '<p class="studio-palette-empty">Could not load catalog: ' + escapeText(err.message) + '</p>';
    }
  }

  init();

  return { refresh: function () { return doRefresh(null); } };
}
