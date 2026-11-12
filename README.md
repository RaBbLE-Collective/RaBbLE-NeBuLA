# RaBbLE-NeBuLA

The animation engine behind RaBbLE's face. Drop one script into a page and the `<rabble-entity>` element draws the eyes, portals and particle nebula, in 2D (Canvas2D) or 3D (Three.js), falling back to 2D when WebGL is not there.

**Genesis release `0.1.0`** · Live on [joinrabble.world](https://joinrabble.world), served from [nebula.joinrabble.world](https://nebula.joinrabble.world/v0.1.0/nebula.iife.js)

## Quickstart

Load Aether for the palette, then NeBuLA, then place the entity:

```html
<link rel="stylesheet" href="https://aether.joinrabble.world/v0.1.0/aether.min.css">
<script src="https://nebula.joinrabble.world/v0.1.0/nebula.iife.js"></script>

<rabble-entity backend="alive" autoboot></rabble-entity>
```

`backend="alive"` is the full entity (2D and 3D, boot sequence, moods). Change its `state`, `mood` or `emotion` attribute and the entity follows. `backend="canvas2d"` (the default) and `backend="threejs"` are the plain renderers. Three.js is loaded on demand from a pinned CDN copy.

The same build is available as an ES module at `/v0.1.0/nebula.esm.js`:

```js
import { Runtime, PatternGenerator } from 'https://nebula.joinrabble.world/v0.1.0/nebula.esm.js';

const runtime = new Runtime('#canvas');
const stream = runtime.createStream('scene');
PatternGenerator.organic(200, 'sphere').forEach(e => stream.add(e));
runtime.start();
```

`window.NeBuLA.version` (IIFE) or the `version` export reports the running version, and each bundle's first line names version and commit (`/*! NeBuLA 0.1.0+bac31e0 */`).

Full element and API reference: [RaBbLE-NeBuLA-API.md](https://github.com/RaBbLE-Collective/RaBbLE-Grimoire/blob/main/RaBbLE-NeBuLA/RaBbLE-NeBuLA-API.md).

## What else is here

| Path | What |
|---|---|
| `src/element.js`, `src/elements/` | `<rabble-entity>`, `<rabble-floor>`, `<rabble-doors>`, `<rabble-graph>` |
| `src/backends/` | Canvas2D, Three.js and alive backends |
| `src/core/`, `src/patterns/` | Flat-Chaos runtime, streams, pattern generators |
| `studio/` | NeBuLA Studio: drag-and-drop page builder for composing pages from Aether and NeBuLA components |
| `examples/` | Proof pages, such as the 2D/3D parity page |

## Development

```bash
npm install
npm run build            # dist/nebula.iife.js + dist/nebula.esm.js (minified)
npm run build:dev        # IIFE with sourcemaps
npm run build:versioned  # both, copied to dist/v<package version>/
```

Inside the Collective, use the Grimoire's `spells/dev-serve.sh` to serve NeBuLA to World locally.

`npm run typecheck` runs a strict JSDoc check that does not pass yet (known, not a release gate).

## Deployment

Deploys run from a local checkout. They do not run on push:

```bash
# from the Collective root
bash RaBbLE-Grimoire/spells/cloudflare-ctl.sh deploy nebula v0.1.0
```

The `rabble-nebula` Worker serves the whole `dist/` folder, including every earlier version path, so the GitHub workflow can only be started by hand (see the note in `.github/workflows/deploy.yml`).

## More

The Flat-Chaos spec, architecture and roadmap are in the [Grimoire, NeBuLA section](https://github.com/RaBbLE-Collective/RaBbLE-Grimoire/tree/main/RaBbLE-NeBuLA).

## Licence

Source-available under the RaBbLE Sovereign Accord: free for personal use, commercial use by agreement. See [LICENSE](LICENSE).

