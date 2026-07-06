/**
 * layout-store.js — save/load a NeBuLA Studio layout document.
 *
 * Save triggers a JSON file download (mirrors exportAnimation() /
 * importAnimation() in RaBbLE-BaBbLE/prototypes/animation-studio.html: a
 * data-URI anchor, clicked programmatically, then removed). Load accepts a
 * File (from an <input type="file">), parses it, and runs it through
 * layout-schema.js's validate() before handing it back — a malformed or
 * stale-schema file is rejected rather than silently rendered.
 *
 * Also provides a localStorage autosave so an in-progress layout survives a
 * page refresh.
 */

import { validate } from './layout-schema.js';

export const AUTOSAVE_KEY = 'nebula-studio-autosave';

/** Trigger a JSON file download of the given layout document. */
export function saveLayout(layoutDoc) {
  const json = JSON.stringify(layoutDoc, null, 2);
  const dataStr = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);

  const rawTitle = (layoutDoc && layoutDoc.meta && layoutDoc.meta.title) || 'layout';
  const filename = rawTitle
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'layout';

  const anchor = document.createElement('a');
  anchor.setAttribute('href', dataStr);
  anchor.setAttribute('download', filename + '.json');
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/**
 * Read + parse + validate a File into a layout document.
 * @returns {Promise<object>} resolves with the validated layout document
 */
export function loadLayoutFromFile(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function (ev) {
      let doc;
      try {
        doc = JSON.parse(ev.target.result);
      } catch (err) {
        reject(new Error('file is not valid JSON'));
        return;
      }
      const result = validate(doc);
      if (!result.valid) {
        reject(new Error('layout failed validation: ' + result.errors.join('; ')));
        return;
      }
      resolve(doc);
    };
    reader.onerror = function () {
      reject(new Error('could not read file'));
    };
    reader.readAsText(file);
  });
}

/** Persist the current layout to localStorage. Best-effort, never throws. */
export function autosaveLayout(layoutDoc) {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(layoutDoc));
  } catch (err) {
    console.warn('[nebula-studio] autosave failed', err);
  }
}

/**
 * Read the autosaved layout, if any and still schema-valid.
 * @returns {object|null}
 */
export function loadAutosave() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const doc = JSON.parse(raw);
    const result = validate(doc);
    if (!result.valid) {
      console.warn('[nebula-studio] autosaved layout failed validation, ignoring', result.errors);
      return null;
    }
    return doc;
  } catch (err) {
    console.warn('[nebula-studio] could not read autosave', err);
    return null;
  }
}
