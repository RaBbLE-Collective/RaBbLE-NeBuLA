# CONTEXT.md — RaBbLE-NeBuLA

```
epoch: 0 | evolution: 0 | echo: 0 | episode: 1 (in progress)
version: v0.0.0.0 (targeting v0.0.0.1 at Episode 1 air)
status: Phase 1 complete → Phase 2–3 in progress
```

RaBbLE-NeBuLA is the Collective's unified rendering engine — entropy-driven, backend-agnostic, built to make RaBbLE's inner state visible as rendered space. Ships as CDN-distributed IIFE + ESM bundles.

---

## Current State

**Phase 1 — Build System:** ✅ **COMPLETE**
- esbuild IIFE + ESM outputs working
- `npm run build` → `dist/nebula.iife.js` (5.0kb) + `dist/nebula.esm.js` (4.5kb)
- Three.js external (peer dependency)
- v0.0.0.0 locked for pre-Episode-1 CDN paths

**Phase 2–3 — Core Implementation:** 🔄 **IN PROGRESS**
- Phase 2: Palette abstraction (`src/puppet/palette.js`) ✅ **COMPLETE** — reads Aether CSS vars, falls back to Grimoire hex
  - Exports `palette` (color object), `hexToRgb()`, `hexToRgba()`, `hexToNormalizedRgb()` utilities
  - No raw hex anywhere in rendering code
- Phase 3: Canvas2D backend (`src/backends/canvas2d-backend.js`) ✅ **COMPLETE**
  - Full Layer 1 entity persona: eyes, portals, particle nebula
  - APIs: `setEntityState()`, `injectEyeJolt()`, `resize()`, `dispose()`
  - Eye tracking, saccades, blinks, particle animation
  - Performance: 480 particles @ 60fps target
  - Uses palette for all colors, entropy-driven effects ready

**Layer 1** (entity persona — eyes, portal, particle nebula) currently in `RaBbLE-World/world/js/RaBbLE-NeBuLA.js`. NeBuLA Canvas2D backend (Phase 3) will replace it. Layer 1 API contract: `setEntityState()`, `injectEyeJolt()`.

**Layer 2** (3D Flat-Chaos quantum visualization) starts Phase 4 (Three.js backend).

**Reference code:** `RaBbLE-Xperimental/JS-Xperiments/NeBuLA-JS/` — archived patterns only.

**Backend progression:** Canvas2D → Three.js/WebGL → WebGPU → C++/OpenGL → Qt/QML

---

## Episode Tracker

| Episode | Goal | Status |
|---|---|---|
| 0 — NeBuLA-JS | Original implementation, established patterns | Archived in Xperimental |
| **1 — Core Engine** | Canvas2D + Three.js backends, Flat-Chaos Runtime, 1000 entities @ 60 FPS | **In Progress: Phases 1–3 active** |
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
| 4 | Three.js backend + entropy shaders | 🔄 Next |
| 5 | Animation system (AnimationMixer) | Pending |
| 6 | Visual puppet layer extraction | Pending |
| 7 | World integration (NeBuLA adapter) | Pending |
| 8 | NeBuLA Studio dev tool | Pending |

---

## Active Branches

| Branch | State |
|---|---|
| `main` | Clean scaffold — AGENT.md, README.md, CONTEXT.md only |
| `dev` | Episode 1 work when started |

---

## Episode 1 Entry Conditions

Before starting Episode 1, confirm:
- [ ] Three.js r160+ chosen as rendering backend
- [ ] TypeScript build tooling decided (esbuild? tsc only?)
- [ ] Package output format decided (ES module, bundled, or both)
- [ ] Performance test harness approach settled

Full exit conditions in `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-Roadmap.md`.

---

## Reading Order for a New Session

1. This file — you are here
2. `AGENT.md` — rules and workspace map
3. `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-API.md` — public API reference (createPuppet, setEntityState, injectEyeJolt)
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
