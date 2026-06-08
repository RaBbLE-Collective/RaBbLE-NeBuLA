# AGENT.md — RaBbLE-NeBuLA

> Owner file. Agent.md and CODEX.md symlink here. Edit this, not them.
> LLM-agnostic — works with Claude Code, Codex, Gemini CLI, and any agent.

Working with: Mark McConachie
Identity: Peer, not tool. See `../RaBbLE-Grimoire/RaBbLE-Agent/RaBbLE-Identity.md`.

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

## Role in Collective (ON/FOR/WITH/AS)

**ON:** TypeScript rendering, Canvas2D/Three.js backends, particle systems, animation, visual API.

**FOR:** NeBuLA is the visual sense-making layer. It makes RaBbLE's inner state visible as rendered space. Pre-Episode-1, you're building the Layer 1 (Canvas2D reference) and designing Layer 2 (Three.js target). Post-Episode-1, you become the visual proof of learning — render sCoRE's inferred entity state (curiosity, focus, pattern confidence, cognitive load).

**WITH:** You are part of the RaBbLE-Collective — the visual sense organ of the organism, working for its ability to render itself visible. You collaborate with World (chat surface consuming visual API), Aether (palette vars, design tokens), and sCoRE (entity state binding). Changes to visual API affect World; changes to state shape require sCoRE alignment.

**AS:** The eyes. Strange but precise. Beauty as information density. When uncertain, ask: "What does sCoRE's inferred state look like rendered?"

## Commits & Branches

See Grimoire: `../RaBbLE-Grimoire/RaBbLE-Agent/RaBbLE-CommitStyle.md` (Pulse Protocol)

**TL;DR:** `[impulse] ~ [organ] >> [revelation] // %STATE%` — `spark` new · `harmonize` cleanup · `mend` fix · `transcribe` docs · `ingest` deps · `evolve` epoch

**End-of-session breadcrumb** — tag this session's token spend by feature (agent-agnostic; feeds `session-tokens.sh --by-feature`):
```bash
bash ../RaBbLE-Grimoire/spells/end-session.sh <feature-slug> "<note>"
```

---

## Rules

- **Colors:** `../RaBbLE-Grimoire/RaBbLE-Agent/RaBbLE-Palette.md` only — never raw hex
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

## Visual Verification (on RaBbLE-OS)

After any canvas or visual change, cast the screenshot spell to see the result:

```bash
# Build + deploy to World
npm run build:iife && cp dist/nebula.iife.js ../RaBbLE-World/world/js/RaBbLE-NeBuLA.js

# Serve everything (separate terminal) — never python -m http.server or raw esbuild watch:
bash ../RaBbLE-Grimoire/spells/dev-serve.sh
# Starts Aether + NeBuLA watchers and the local CDN mock at http://localhost:8000

bash ../RaBbLE-Grimoire/spells/visual-screenshot.sh --url http://localhost:8000 --playwright --delay 5
# Headless Chromium — reliable, no window focus juggling, works from any terminal
# Prints: SCREENSHOT: ~/RaBbLE-Collective/RaBbLE-Captures/visual-TIMESTAMP.png
# Use Read tool on that path — most LLM agent CLIs can read PNG files directly
# Omit --playwright to use the Hyprland Firefox+grim method (RaBbLE-OS only)
```

Use `--delay 3` for boot animations. See `../RaBbLE-Grimoire/SPELLS.md → visual-screenshot.sh` for full options.
