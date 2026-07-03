/**
 * three-loader.js — shared memoized Three.js CDN loader
 *
 * Centralizes the three@0.160.0 pin so every element that needs Three.js
 * (rabble-floor, rabble-graph, the ThreeJsBackend path off <rabble-entity>)
 * requests the SAME script tag instead of each racing to inject their own.
 * Before this existed, floor.js and graph.js each carried an identical
 * `ensureThree()` — duplicate ~600KB downloads and a "Multiple instances of
 * Three.js" console warning when both elements mounted on the same page.
 *
 * Usage:
 *   import { ensureThree } from '../utils/three-loader.js';
 *   const THREE = await ensureThree();
 */

export const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js';

let _threePromise = null;

/**
 * Resolve window.THREE, loading the CDN script exactly once no matter how
 * many callers ask concurrently. If THREE is already on window (another
 * loader, an inline script tag, a test harness), resolves immediately.
 *
 * @returns {Promise<object>} the global THREE namespace
 */
export function ensureThree() {
  if (typeof window !== 'undefined' && window.THREE) {
    return Promise.resolve(window.THREE);
  }
  if (_threePromise) return _threePromise;

  _threePromise = new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('[three-loader] no document available to inject Three.js script'));
      return;
    }
    // A script tag may already be in flight (e.g. a host page's own CDN tag
    // added before NeBuLA mounted) — reuse it instead of adding a second.
    const existing = document.querySelector(`script[src="${THREE_CDN}"]`);
    const onLoad  = () => (window.THREE ? resolve(window.THREE) : reject(new Error('[three-loader] THREE not set after script load')));
    const onError = () => reject(new Error('[three-loader] failed to load Three.js from CDN'));

    if (existing) {
      if (window.THREE) { resolve(window.THREE); return; }
      existing.addEventListener('load', onLoad);
      existing.addEventListener('error', onError);
      return;
    }

    const s = document.createElement('script');
    s.src = THREE_CDN;
    s.onload = onLoad;
    s.onerror = onError;
    document.head.appendChild(s);
  }).catch((err) => {
    _threePromise = null; // allow retry on next call rather than caching a permanent rejection
    throw err;
  });

  return _threePromise;
}

/**
 * Synchronous capability check — does this browser support WebGL at all?
 * Used by the <rabble-entity backend="threejs"> opt-in path to decide
 * whether it's worth even attempting to load Three.js.
 *
 * @returns {boolean}
 */
export function hasWebGL() {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}
