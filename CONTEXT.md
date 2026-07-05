# CONTEXT.md — RaBbLE-NeBuLA

```
epoch: 0 | evolution: 0 | echo: 0 | episode: 1 (in progress)
version: v0.0.0.0 (targeting v0.0.0.1 at Episode 1 air)
last session: 2026-07-03 (S190)
status: Ep1 Phases 1–7 complete · Rearchitecture Phases 1–4 done · Three.js entity WIRED + ALIVE (S190) · Phase 5 (effects systems) next
```

RaBbLE-NeBuLA is the Collective's unified rendering engine — entropy-driven, backend-agnostic, built to make RaBbLE's inner state visible as rendered space. Ships as CDN-distributed IIFE + ESM bundles.

---

## Current State

**Phase 1 — Build System:** ✅ **COMPLETE**
- esbuild IIFE + ESM outputs working
- `npm run build` → `dist/nebula.iife.js` (5.0kb) + `dist/nebula.esm.js` (4.5kb)
- Three.js external (peer dependency)
- v0.0.0.0 locked for pre-Episode-1 CDN paths

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

**Layer 1** (entity persona — eyes, portal, particle nebula) lives in `src/element.js` + `src/backends/canvas2d-backend.js`. Registered as `<rabble-entity>` custom element in the IIFE bundle. World loads it via `/nebula/v0.0.0.0/nebula.iife.js`.

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

## Episode Tracker

| Episode | Goal | Status |
|---|---|---|
| 0 — NeBuLA-JS | Original implementation, established patterns | Archived in Xperimental |
| **1 — Core Engine** | Canvas2D + Three.js backends, Flat-Chaos Runtime, 1000 entities @ 60 FPS | **Phases 1–7 done · Rearchitecture active** |
| 2 — Pattern Library | Built-in stream patterns, BaBbLE command layer | Blocked on Ep1 completion |
| 3 — Layer Integration | Wire entity state → NeBuLA entropy | Blocked on Ep2 |
| 4 — World Integration | NeBuLA replaces rabble-entity.js in RaBbLE-World | Blocked on Ep3 |
| 5 — WebGPU Backend | High-throughput rendering, 10,000 entities | Future |
| 6 — C++/OpenGL Backend | Native rendering, Plymouth splash, Qt/QML component | Future |

### Episode 1 Phases

| Phase | Task | Status |
|---|---|---|
| 1 | Build system (esbuild IIFE + ESM) | ✅ Done |
| 2 | Palette abstraction (src/puppet/palette.js) | ✅ Done |
| 3 | Canvas2D backend (Canvas2dBackend.render) | ✅ Done |
| 4 | Three.js backend + entropy shaders | ✅ Done |
| 5 | Animation system (AnimationMixer) | ✅ Done |
| 6 | Visual puppet layer — `<rabble-entity>` element in `src/element.js` | ✅ Done |
| 7 | World integration — bundle loaded by `RaBbLE-NeBuLA.js` loader | ✅ Done |
| 8 | NeBuLA Studio dev tool | Deferred — Rearchitecture first |

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
| `main` | Clean scaffold — AGENT.md, README.md, CONTEXT.md only |
| `dev` | Episode 1 work + rearchitecture |

---

Full exit conditions in `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-Roadmap.md`.

---

## Reading Order for a New Session

1. This file — you are here
2. `AGENT.md` — rules and workspace map
3. `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-API.md` — public API reference (`<rabble-entity>` element, setEntityState, injectEyeJolt)
4. `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-Roadmap.md` — episode tracker and exit conditions
5. `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-Architecture.md` — layer model, Layer 1 API, Layer 2 primitives
6. `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-FlatChaos.md` — the core pattern to implement
7. `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-Plan.md` — step-by-step implementation guide (8 phases)

## Build & Distribution

**Build system:** esbuild (IIFE + ESM)  
**Output:** `dist/nebula.iife.js`, `dist/nebula.esm.js` + sourcemaps  
**CDN versioning:** Five-Es (`v0.0.0` pre-Episode-1, `v0.0.0.1` after air)  
**See:** `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-API.md`

## Scripts

```bash
npm run build          # Production: minified IIFE + ESM
npm run build:iife    # IIFE only
npm run build:esm     # ESM only
npm run build:dev     # Dev: sourcemaps, unminified
npm run typecheck     # Verify JSDoc types
```
