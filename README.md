# RaBbLE-NeBuLA

Entropy-driven, embeddable JavaScript rendering engine for the RaBbLE ecosystem.

NeBuLA is a clean, modular renderer built around the **Flat-Chaos pattern**: a flat stream of
self-contained entities, each carrying its own geometry, transform, and entropy value. No scene
graphs. No rigid hierarchies. Order emerges from controlled chaos.

## Core Ideas

- **Flat-Chaos Architecture** — Scenes are flat arrays of entities. Complexity emerges from composition, not nesting.
- **Entropy as Parameter** — A single scalar (0.0–1.0) drives organic variation across geometry, shaders, and animation.
- **Instanced Rendering** — Thousands of unique entities at 60 FPS via GPU instancing.
- **Embeddable** — Drop into any page or app. No framework coupling. Works standalone.
- **Backend-Agnostic** — Three.js default, Canvas2D fallback, WebGPU future.

## Philosophy

The philosophy behind NeBuLA — entropy-driven development, emergence over design, the maker
spirit — lives in the **RaBbLE Grimoire**.

See: [`RaBbLE-Grimoire`](https://github.com/RaBbLE-Collective/RaBbLE-Grimoire)

## Branches

| Branch | Purpose |
|--------|---------|
| `main` | Orientation stub |
| `new-horizons` | Active development |

## Quick Start

```typescript
import { Runtime, PatternGenerator } from 'rabble-nebula';

const runtime = new Runtime('#canvas');
const stream = runtime.createStream('scene');

PatternGenerator.organic(200, 'sphere').forEach(e => stream.add(e));

runtime.start();
```

## Status

Active development on `new-horizons`. Architecture and roadmap live in the Grimoire:
`RaBbLE-Grimoire/RaBbLE-NeBuLA/`.

## License

RaBbLE-NeBuLA is licensed under the **RaBbLE Sovereign Accord** (source-available, not open source): see [`LICENSE`](LICENSE).

- **Personal use:** Encouraged. Modify, fork, create.
- **Attribution:** Keep the lineage intact. Mention RaBbLE.
- **Commercial use:** Reserved. Contact the Copyright Holder for a pact.

