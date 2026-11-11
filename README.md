# RaBbLE-NeBuLA

> The rendering engine of the RaBbLE Collective. It draws the entity's face and the spaces around it.

**Version:** `0.1.0` (Genesis) · **Live:** the entity on [joinrabble.world](https://joinrabble.world), served from [nebula.joinrabble.world](https://nebula.joinrabble.world/v0.1.0/nebula.iife.js) · **Versioning:** [semver, per member](https://github.com/RaBbLE-Collective/RaBbLE-Grimoire/blob/main/RaBbLE-Versioning.md)

---

## What NeBuLA is

NeBuLA makes RaBbLE's inner state visible. It ships as one script that registers custom elements, chiefly `<rabble-entity>`: the eyes, portals and particle nebula that are RaBbLE's face. It renders in 2D (Canvas2D) or 3D (Three.js/WebGL) and falls back to 2D when WebGL is not there.

Underneath sits the **Flat-Chaos** pattern: a scene is a flat stream of self-contained entities, each with its own geometry, transform and entropy value. No scene graph. A single entropy scalar (0 to 1) drives variation in shape, shading and motion.

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

## Branches

`new-horizons` is the working branch. `main` is stable: it receives `release/X.Y.Z` branches by pull request and carries the `vX.Y.Z` tags.

## Licence

RaBbLE-NeBuLA is under the **RaBbLE Sovereign Accord**: source-available, not open source. Personal use encouraged, commercial use reserved, the name and the face reserved. See [LICENSE](LICENSE).

---

Part of the [RaBbLE Collective](https://github.com/RaBbLE-Collective/RaBbLE-Collective). Architecture, roadmap and the Flat-Chaos spec live in the [Grimoire, NeBuLA section](https://github.com/RaBbLE-Collective/RaBbLE-Grimoire/tree/main/RaBbLE-NeBuLA).
