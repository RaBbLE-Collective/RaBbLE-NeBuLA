# CONTEXT.md — RaBbLE-NeBuLA

```
epoch: 0 | episode: 1 — not started | status: scaffold
```

RaBbLE-NeBuLA is the entropy-driven rendering layer of the Collective.

---

## Current State

Layer 1 (entity persona — eyes, portal, particle nebula) is **stable** in `RaBbLE-World/rabble-entity.js`. Do not touch it from here.

Layer 2 (3D Flat-Chaos quantum visualization) is **not yet started**. This repo is a scaffold waiting for Episode 1 to begin.

The NeBuLA-JS implementation in `RaBbLE-Xperimental/JS-Xperiments/NeBuLA-JS/` is **archived** — use it as an architectural reference, not a code base.

---

## Episode Tracker

| Episode | Goal | Status |
|---|---|---|
| 0 — NeBuLA-JS | Original implementation, established patterns | Archived in Xperimental |
| **1 — Core Engine** | ES module engine, Flat-Chaos Runtime, Three.js r160+, 1000 entities @ 60 FPS | **Not started** |
| 2 — Pattern Library | Built-in stream patterns, BaBbLE command layer | Blocked on Ep1 |
| 3 — Layer Integration | Wire entity state → NeBuLA entropy | Blocked on Ep2 |
| 4 — World Integration | NeBuLA as background canvas in RaBbLE-World | Blocked on Ep3 |

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
