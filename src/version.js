/** NeBuLA version (semver). Read from package.json, the one source; esbuild inlines only this field
 *  at build time. Separate module so backends can read it without importing index.js. */
export { version } from '../package.json';
