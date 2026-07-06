/**
 * catalog-parser.js — parse the component catalog page into palette entries.
 *
 * Fetches the catalog page (same-origin, served by dev-cdn.js's World
 * catch-all) and walks its structural markup with DOMParser. Deliberately
 * keyed off structural CSS classes (.atlas-section / .atlas-entry / ...),
 * not the page's display brand name ("Atlas" is not final and may be
 * renamed later without touching this parser, so long as the DOM structure
 * holds).
 *
 * For each entry, the first line of its .atlas-entry-code <code> block
 * decides how it's draggable:
 *   - starts with "<rabble-" (a tag name)      -> kind: "element"
 *   - starts with "<" (any other tag)          -> kind: "markup"
 *   - anything else (a JS factory call, e.g.
 *     NeBuLA.ui.createEntityMini())            -> excluded from the palette
 *
 * component.html is captured verbatim from that first line (decoded HTML
 * entities), matching the layout-schema.js example exactly — including
 * "..." placeholder bodies for markup entries that take children. This is
 * what keeps a saved layout reproducible even if the catalog changes later.
 */

export const DEFAULT_CATALOG_URL = '/world/RaBbLE-Catalog.html';

const ELEMENT_TAG_RE = /^<rabble-[a-z-]+/;

/**
 * Parse an already-loaded Document (or DocumentFragment-like root) into
 * { sections: [{ id, label, entries: [{ sectionId, name, kind, html }] }] }.
 * Pure function — no fetch — so it's easy to point at any DOM root.
 */
export function parseCatalogDocument(root) {
  const sections = [];
  const sectionEls = root.querySelectorAll('.atlas-section');

  sectionEls.forEach(function (sectionEl) {
    const id = sectionEl.id || '';
    const headerEl = sectionEl.querySelector('.rabble-section-header');
    const label = headerEl ? headerEl.textContent.trim() : id;
    const entries = [];

    sectionEl.querySelectorAll('.atlas-entry').forEach(function (entryEl) {
      const nameEl = entryEl.querySelector('.atlas-entry-name');
      const codeEl = entryEl.querySelector('.atlas-entry-code');
      if (!nameEl || !codeEl) return;

      const name = nameEl.textContent.trim();
      const codeText = codeEl.textContent || '';
      const firstLine = codeText.split('\n')[0].trim();

      let kind;
      if (ELEMENT_TAG_RE.test(firstLine)) {
        kind = 'element';
      } else if (firstLine.charAt(0) === '<') {
        kind = 'markup';
      } else {
        // JS factory call (e.g. NeBuLA.ui.createEntityMini()) — produces a
        // detached node via a JS call, not markup/tag instantiation. Skip
        // rather than mis-render.
        return;
      }

      entries.push({ sectionId: id, name: name, kind: kind, html: firstLine });
    });

    if (entries.length) sections.push({ id: id, label: label, entries: entries });
  });

  return { sections: sections };
}

/** Fetch + parse the catalog page. Always hits the network (no cache). */
export async function parseCatalog(url) {
  url = url || DEFAULT_CATALOG_URL;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('catalog fetch failed: ' + res.status + ' ' + url);
  const text = await res.text();
  const doc = new DOMParser().parseFromString(text, 'text/html');
  return parseCatalogDocument(doc);
}

/** Manual re-parse, for a "Refresh Palette" button. Same as parseCatalog(). */
export async function refreshCatalog(url) {
  return parseCatalog(url);
}
