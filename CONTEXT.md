# CONTEXT.md — RaBbLE-NeBuLA

```
epoch: 0 | status: active
version: 0.1.0 (Genesis; CDN path /v0.1.0/)
last session: 2026-11-11 (S324)
status: build phases 1–7 complete · Rearchitecture Phases 1–4 done · alive entity (2D+3D) live in World · Phase 5 (effects systems) next
```

RaBbLE-NeBuLA is the Collective's unified rendering engine — entropy-driven, backend-agnostic, built to make RaBbLE's inner state visible as rendered space. Ships as CDN-distributed IIFE + ESM bundles.

---

## Current State

**Phase 1 — Build System:** ✅ **COMPLETE**
- esbuild IIFE + ESM outputs working
- `npm run build` → `dist/nebula.iife.js` (5.0kb) + `dist/nebula.esm.js` (4.5kb)
- Three.js external (peer dependency)
- Versioned CDN paths are immutable: `/v0.0.0.1-rc.1/` (pre-semver) and `/v0.1.0/` (Genesis)

**Phase 2–5 — Core Implementation:** ✅ **COMPLETE**
- Phase 2: Palette abstraction (`src/puppet/palette.js`) ✅ — reads Aether CSS vars, falls back to Grimoire hex
- Phase 3: Canvas2D backend (`src/backends/canvas2d-backend.js`) ✅ — Layer 1 entity persona (eyes, portals, particles)
- Phase 4: Three.js backend (`src/backends/threejs-backend.js`) ✅ — Layer 2 quantum visualization
  - Flat-Chaos stream architecture with entropy-driven shading
  - Geometry cache (sphere, box, octahedron, tetrahedron)
  - Material cache with entropy-driven properties (roughness, emissive, wireframe)
  - InstancedMesh for 1000+ entities @ 60fps
  - Entity management: add, update, remove
  - Lighting: ambient + key + fill lights
  - Performance metrics tracking
- Phase 5: Animation system (`src/core/animation.js`) ✅ — AnimationMixer for smooth state transitions
  - Named states: `idle` (0.3), `thinking` (0.6), `speaking` (0.8)
  - Ease-in-out quadratic easing
  - Per-entity value interpolation
  - Integrated into Runtime animation loop

**Layer 1** (entity persona — eyes, portal, particle nebula) lives in `src/element.js` + `src/backends/canvas2d-backend.js`. Registered as `<rabble-entity>` custom element in the IIFE bundle. World loads it from `nebula.joinrabble.world/v<version>/nebula.iife.js` (locally, `/nebula/v0.0.0.0/` through `dev-serve.sh`).

**Layer 2** (Three.js entity) — **WIRED + ALIVE as of S190.** No longer "pending":
- `<rabble-entity backend="threejs">` opt-in on the custom element (`src/element.js`); WebGL capability check + silent fallback to Canvas2D when THREE unavailable.
- Shared memoized CDN loader `src/utils/three-loader.js` (three@0.160.0 pin centralized; floor/graph/entity all use it — no duplicate downloads, no "Multiple instances of Three.js" warning).
- One soul, two bodies: gaze/blink behavior (saccade table, spring pursuit, distraction drift, jolt, 4-state burst-blink FSM) extracted to `src/backends/eye-behavior.js`, consumed by BOTH `canvas2d/eye-system.js` and `threejs-backend.js`.
- Visual parity with the Canvas2D persona: asymmetric black portal sockets (cyan above left eye, magenta below right — never level), additive rim annuli + corona glow, densified violet-core→cyan-rim nebula (900 body + 320 aura instanced particles, 2 draw calls).
- API parity: `setEyeConfig` / `setParticleConfig` (documented no-op) / `setPortalVisible` / `getSnapshot` / `injectEyeJolt` on `ThreeJsBackend`.
- Side-by-side proof page: `examples/threejs-parity.html`.
- `NeBuLA.backends` now truthfully reports `['Canvas2D', 'Three.js']`; `NeBuLA.activeBackend` says which one is mounted.
- Note: `specs/render-gap-analysis.md` describes the DEAD pre-port prototype — superseded header added, do not implement from it.

**Reference code:** `RaBbLE-Xperimental/JS-Xperiments/NeBuLA-JS/` — archived patterns only.

**Backend progression:** Canvas2D → Three.js/WebGL → WebGPU → C++/OpenGL → Qt/QML

---

## Backend Roadmap

The old Episode numbering is retired (S322); members plan by milestone in `../RaBbLE-Grimoire/registry/epochs/current.epoch.yml`. The order below still holds.

| Stage | Goal | Status |
|---|---|---|
| NeBuLA-JS | Original implementation, established patterns | Archived in Xperimental |
| **Core Engine** | Canvas2D + Three.js backends, Flat-Chaos Runtime, 1000 entities @ 60 FPS | **Phases 1–7 done · Rearchitecture active** |
| Pattern Library | Built-in stream patterns, BaBbLE command layer | After Core Engine |
| Layer Integration | Wire entity state → NeBuLA entropy | After Pattern Library |
| World Integration | NeBuLA replaces rabble-entity.js in RaBbLE-World | Done: World renders `<rabble-entity backend="alive">` |
| WebGPU Backend | High-throughput rendering, 10,000 entities | Future |
| C++/OpenGL Backend | Native rendering, Plymouth splash, Qt/QML component | Future |

### Core Engine Phases

| Phase | Task | Status |
|---|---|---|
| 1 | Build system (esbuild IIFE + ESM) | ✅ Done |
| 2 | Palette abstraction (src/puppet/palette.js) | ✅ Done |
| 3 | Canvas2D backend (Canvas2dBackend.render) | ✅ Done |
| 4 | Three.js backend + entropy shaders | ✅ Done |
| 5 | Animation system (AnimationMixer) | ✅ Done |
| 6 | Visual puppet layer — `<rabble-entity>` element in `src/element.js` | ✅ Done |
| 7 | World integration — bundle loaded by World's `RaBbLE-nebula-loader.js` from the CDN (vendored S190 to S323) | ✅ Done |
| 8 | NeBuLA Studio dev tool | MVP built + verified (S198); delete/resize gizmos + visual palette added (S199) — see `RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-Studio.md`; inspector panel + undo/redo still open |

---

## Rearchitecture (active — supersedes Phase 8)

Full plan: `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-Rearchitecture.md`

| Phase | Task | Status |
|---|---|---|
| 1 | Module decomposition — extract canvas2d-backend.js into 6 system files | ✅ Done |
| 2 | Frame budgeting — EMA cost tracking, graceful degradation under load | ✅ Done |
| 3 | Spatial hash for connections — O(n × k) replace O(n²) | ✅ Done |
| 4 | Glow layer compositing — offscreen canvas, every-2-frame bloom | ✅ Done |
| 5 | Effects systems — absorb RaBbLE-bg.js into NeBuLA effect modules | Pending |
| 6 | World single-page app — WM applets, NeBuLA template pattern | Pending |
| 7 | Three.js decomposition — same system interface for 3D backend | Pending |

Known-good baseline: NeBuLA `34dee62`, World `aa66550` (42,676-byte bundle)

---

## Active Branches

| Branch | State |
|---|---|
| `main` | Stable: receives `release/X.Y.Z` by pull request, carries the `vX.Y.Z` tags |
| `new-horizons` | Working branch: all development |

---

Full exit conditions in `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-Roadmap.md`.

---

## Reading Order for a New Session

1. This file — you are here
2. `AGENT.md` — rules and workspace map
3. `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-API.md` — public API reference (`<rabble-entity>` element, setEntityState, injectEyeJolt)
4. `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-Roadmap.md` — stages and exit conditions
5. `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-Architecture.md` — layer model, Layer 1 API, Layer 2 primitives
6. `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-FlatChaos.md` — the core pattern to implement
7. `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-Plan.md` — step-by-step implementation guide (8 phases)

## Build & Distribution

**Build system:** esbuild (IIFE + ESM)  
**Output:** `dist/nebula.iife.js`, `dist/nebula.esm.js` + sourcemaps  
**Versioning:** semver from `package.json`; each bundle's first line names version and commit (`/*! NeBuLA 0.1.0+<sha> */`). Rules: `../RaBbLE-Grimoire/RaBbLE-Versioning.md`  
**Deploy:** `bash RaBbLE-Grimoire/spells/cloudflare-ctl.sh deploy nebula v<version>` from the Collective root (CI deploy is manual only, see the workflow note)  
**See:** `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-API.md`

## Scripts

```bash
npm run build          # Production: minified IIFE + ESM
npm run build:iife    # IIFE only
npm run build:esm     # ESM only
npm run build:dev     # Dev: sourcemaps, unminified
npm run typecheck     # Strict JSDoc check: known to fail (about 1,680 errors, never passed); not a release gate
```
