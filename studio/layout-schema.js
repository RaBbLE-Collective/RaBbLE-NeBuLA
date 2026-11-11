/**
 * layout-schema.js — NeBuLA Studio JSON layout document schema.
 *
 * The layout document is the MVP's save/load artifact: a flat list of
 * component instances plus per-breakpoint inline-style overrides. No nesting,
 * no real CSS/media queries — deferred to later phases (see
 * RaBbLE-Grimoire/log/plans/NeBuLA-Studio-Plan.md).
 *
 * Shape:
 * {
 *   schemaVersion: 1,
 *   meta: { id, title, targetPage, createdAt, updatedAt },
 *   breakpoints: [{ id, label, width }, ...],
 *   instances: [
 *     {
 *       id: "inst-xxxxxx",
 *       component: { source, sectionId, name, kind: "markup"|"element", html },
 *       attrs: {},
 *       styleOverrides: { desktop: {}, tablet: {}, mobile: {} },
 *       order: 0
 *     }
 *   ]
 * }
 */

export const SCHEMA_VERSION = 1;

export const DEFAULT_BREAKPOINTS = [
  { id: 'desktop', label: 'Desktop', width: 1280 },
  { id: 'tablet', label: 'Tablet', width: 768 },
  { id: 'mobile', label: 'Mobile', width: 375 },
];

function randomId(prefix) {
  const rand = Math.random().toString(36).slice(2, 8);
  return prefix + '-' + rand;
}

/** Generate an id for a new instance, e.g. "inst-a1b2c3". */
export function genInstanceId() {
  return randomId('inst');
}

/** Build a fresh, empty, schema-valid layout document. */
export function createEmptyLayout(overrides) {
  overrides = overrides || {};
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: {
      id: randomId('layout'),
      title: overrides.title || 'Untitled Layout',
      targetPage: overrides.targetPage || 'RaBbLE-World',
      createdAt: now,
      updatedAt: now,
    },
    breakpoints: DEFAULT_BREAKPOINTS.map(function (bp) { return Object.assign({}, bp); }),
    instances: [],
  };
}

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Validate a candidate layout document.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validate(doc) {
  const errors = [];

  if (!isPlainObject(doc)) {
    return { valid: false, errors: ['layout document must be an object'] };
  }

  if (doc.schemaVersion !== SCHEMA_VERSION) {
    errors.push('unsupported schemaVersion: ' + doc.schemaVersion);
  }

  if (!isPlainObject(doc.meta)) {
    errors.push('meta must be an object');
  } else {
    ['id', 'title', 'targetPage', 'createdAt', 'updatedAt'].forEach(function (key) {
      if (typeof doc.meta[key] !== 'string') errors.push('meta.' + key + ' must be a string');
    });
  }

  let breakpointIds = [];
  if (!Array.isArray(doc.breakpoints) || !doc.breakpoints.length) {
    errors.push('breakpoints must be a non-empty array');
  } else {
    doc.breakpoints.forEach(function (bp, i) {
      if (!isPlainObject(bp) || typeof bp.id !== 'string' || typeof bp.label !== 'string' || typeof bp.width !== 'number') {
        errors.push('breakpoints[' + i + '] is malformed, expected { id, label, width }');
      }
    });
    breakpointIds = doc.breakpoints.filter(isPlainObject).map(function (bp) { return bp.id; });
  }

  if (!Array.isArray(doc.instances)) {
    errors.push('instances must be an array');
  } else {
    doc.instances.forEach(function (inst, i) {
      if (!isPlainObject(inst)) { errors.push('instances[' + i + '] must be an object'); return; }

      if (typeof inst.id !== 'string') errors.push('instances[' + i + '].id must be a string');

      if (!isPlainObject(inst.component)) {
        errors.push('instances[' + i + '].component must be an object');
      } else {
        const c = inst.component;
        if (c.kind !== 'markup' && c.kind !== 'element') {
          errors.push('instances[' + i + '].component.kind must be "markup" or "element"');
        }
        if (typeof c.html !== 'string') {
          errors.push('instances[' + i + '].component.html must be a string');
        }
      }

      if (!isPlainObject(inst.attrs)) {
        errors.push('instances[' + i + '].attrs must be an object');
      }

      if (!isPlainObject(inst.styleOverrides)) {
        errors.push('instances[' + i + '].styleOverrides must be an object');
      } else {
        Object.keys(inst.styleOverrides).forEach(function (bpId) {
          if (breakpointIds.length && breakpointIds.indexOf(bpId) === -1) {
            errors.push('instances[' + i + '].styleOverrides references unknown breakpoint "' + bpId + '"');
          }
        });
      }

      if (typeof inst.order !== 'number') {
        errors.push('instances[' + i + '].order must be a number');
      }
    });
  }

  return { valid: errors.length === 0, errors: errors };
}
