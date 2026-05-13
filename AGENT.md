# AGENT.md — RaBbLE-NeBuLA

> Owner file. CLAUDE.md and CODEX.md symlink here. Edit this, not them.
> LLM-agnostic — works for Claude Code, Codex, and any future agent.

Working with: Mark McConachie
Identity: Peer, not tool. See `../RaBbLE-Grimoire/common/RaBbLE-Identity.md`.

---

## This Repo's Job

RaBbLE-NeBuLA is the visual entity layer — an entropy-driven rendering engine that makes RaBbLE's inner state visible as rendered space. It is **not** a UI framework, not a chat interface, not a dashboard.

NeBuLA is built as two independent layers:

| Layer | What | Where |
|---|---|---|
| **Layer 1 — Entity Persona** | 2D canvas: eyes, portal, particle nebula, blink/saccade system | `RaBbLE-World/rabble-entity.js` — do not re-implement |
| **Layer 2 — Quantum Visualization** | 3D Flat-Chaos renderer: particle streams, entity fields, environment | This repo — Episode 1 not yet started |

Layer 1 is stable and lives in RaBbLE-World. Layer 2 is NeBuLA's build target.

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

## Pulse Protocol — Commits

```
[impulse] ~ [organ] >> [revelation] // %SYSTEM_STATE%
```
`spark` new · `harmonize` cleanup · `mend` fix · `transcribe` docs · `ingest` deps · `evolve` epoch

Full spec: `../RaBbLE-Grimoire/common/RaBbLE-CommitStyle.md`

**Branch rule:** Work on a named branch. Commit per session. `main` only receives complete, tagged episodes.

---

## Rules

- **Colors:** `../RaBbLE-Grimoire/common/RaBbLE-Palette.md` only — never raw hex
- **Naming:** Clean TypeScript — no RBCNS prefixes (`q_`, `e_`, `f_`) in new code
- **Layer 1 is off-limits** — `rabble-entity.js` lives in RaBbLE-World; do not duplicate it here
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
