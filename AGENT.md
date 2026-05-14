# AGENT.md — RaBbLE-NeBuLA

> Owner file. CLAUDE.md and CODEX.md symlink here. Edit this, not them.
> LLM-agnostic — works for Claude Code, Codex, and any future agent.

Working with: Mark McConachie
Identity: Peer, not tool. See `../RaBbLE-Grimoire/common/RaBbLE-Identity.md`.

---

## This Repo's Job

RaBbLE-NeBuLA is the visual entity layer — an entropy-driven rendering engine that makes RaBbLE's inner state visible as rendered space. It is **not** a UI framework, not a chat interface, not a dashboard.

NeBuLA provides a backend-agnostic rendering surface with two immediate targets:

| Layer | What | Where |
|---|---|---|
| **Layer 1 — Entity Persona (Canvas2D)** | 2D: eyes, portal, particle nebula, blink/saccade | **Transitional:** currently `RaBbLE-World/rabble-entity.js`; NeBuLA Canvas2D backend will absorb it |
| **Layer 2 — Quantum Visualization (Three.js)** | 3D Flat-Chaos renderer: particle streams, entity fields, environment | This repo — Episode 1 target |

**Layer 1 is transitional, not frozen.** `rabble-entity.js` is the reference implementation and API contract. NeBuLA's Canvas2D backend must match its `setEntityState()` / `injectEyeJolt()` interface when it replaces it. Do not duplicate Layer 1 until the Canvas2D backend is ready to fully supersede it.

Backend progression: Canvas2D → Three.js/WebGL → WebGPU → C++/OpenGL → Qt/QML. See `RaBbLE-NeBuLA-Roadmap.md` for episodes and exit conditions.

---

## Where Things Are

| Path | What |
|---|---|
| `CONTEXT.md` | Current state, active branch, episode status |
| `README.md` | Public-facing description (GitHub) |
| `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-Architecture.md` | Two-layer model, Layer 1 API, Layer 2 primitives |
| `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-Roadmap.md` | Episode tracker, exit conditions, implementation notes |
| `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-Identity.md` | Entity lore, origin, philosophy |
| `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-FlatChaos.md` | Flat-Chaos pattern spec — carry this forward |
| `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-Ideas.md` | Enhancement proposals — Episodes 3+ reference |
| `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-RABL.md` | Scene serialization format (legacy reference) |
| `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-RBCNS.md` | Historical naming spec — **ARCHIVED, do not follow** |

All architecture, roadmap, and identity docs live in the Grimoire. This repo holds only implementation.

---

## Commits & Branches

See Grimoire: `../RaBbLE-Grimoire/common/RaBbLE-CommitStyle.md` (Pulse Protocol)

**TL;DR:** `[impulse] ~ [organ] >> [revelation] // %STATE%` — `spark` new · `harmonize` cleanup · `mend` fix · `transcribe` docs · `ingest` deps · `evolve` epoch

---

## Rules

- **Colors:** `../RaBbLE-Grimoire/common/RaBbLE-Palette.md` only — never raw hex
- **Naming:** Clean TypeScript — no RBCNS prefixes (`q_`, `e_`, `f_`) in new code
- **Layer 1 is transitional** — `rabble-entity.js` is the reference API; don't duplicate it until the Canvas2D backend is ready to replace it cleanly
- **No framework coupling** — NeBuLA must be embeddable standalone; no React/Vue/Svelte imports
- **Performance contract:** 1000+ entities at 60 FPS — any change that breaks this is `%SYSTEM_DRIFT%`
- **Docs stay in Grimoire** — architecture, roadmap, and lore do not live in this repo

---

## Session Start

```bash
cat CONTEXT.md                                                        # current state
cat ../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-Roadmap.md        # episode tracker
cat ../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-Architecture.md   # layer model and primitives
```
