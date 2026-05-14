# CONTEXT.md — RaBbLE-NeBuLA

```
echo: 0 — in progress | episode: 1 — not started | status: scaffold
```

RaBbLE-NeBuLA is the Collective's unified rendering engine — entropy-driven, backend-agnostic, built to make RaBbLE's inner state visible as rendered space.

---

## Current State

**Layer 1** (entity persona — eyes, portal, particle nebula) lives in `RaBbLE-World/rabble-entity.js` as a transitional reference implementation. NeBuLA's Canvas2D backend will eventually supersede it. Until then, the Layer 1 public API (`setEntityState`, `injectEyeJolt`) is the interface contract NeBuLA must match.

**Layer 2** (3D Flat-Chaos quantum visualization) is **not yet started**. This repo is a scaffold waiting for Episode 1 to begin.

**Reference code:** `RaBbLE-Xperimental/JS-Xperiments/NeBuLA-JS/` is archived — the original NeBuLA and RaBbLE WebOS concepts live there. Patterns are reference only; do not build on that codebase.

**Backend progression:** Canvas2D → Three.js/WebGL → WebGPU → C++/OpenGL → Qt/QML

---

## Episode Tracker

| Episode | Goal | Status |
|---|---|---|
| 0 — NeBuLA-JS | Original implementation, established patterns | Archived in Xperimental |
| **1 — Core Engine** | Canvas2D + Three.js backends, Flat-Chaos Runtime, 1000 entities @ 60 FPS | **Not started** |
| 2 — Pattern Library | Built-in stream patterns, BaBbLE command layer | Blocked on Ep1 |
| 3 — Layer Integration | Wire entity state → NeBuLA entropy | Blocked on Ep2 |
| 4 — World Integration | NeBuLA replaces rabble-entity.js in RaBbLE-World | Blocked on Ep3 |
| 5 — WebGPU Backend | High-throughput rendering, 10,000 entities | Future |
| 6 — C++/OpenGL Backend | Native rendering, Plymouth splash, Qt/QML component | Future |

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
3. `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-Roadmap.md` — episode tracker and exit conditions
4. `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-Architecture.md` — layer model, Layer 1 API, Layer 2 primitives
5. `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-FlatChaos.md` — the core pattern to implement
