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
| **Layer 1 — Entity Persona (Canvas2D)** | 2D: eyes, portal, particle nebula, blink/saccade | This repo: `src/element.js` + `src/backends/`; World renders `<rabble-entity backend="alive">` |
| **Layer 2 — Quantum Visualization (Three.js)** | 3D Flat-Chaos renderer: particle streams, entity fields, environment | This repo: `backend="threejs"` and the 3D side of `alive` |

**Layer 1 lives here.** World's old `rabble-entity.js` is gone; NeBuLA's element is the entity. The public API (`setEntityState()`, `injectEyeJolt()`, the live attributes) is documented in `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-API.md`.

Backend progression: Canvas2D → Three.js/WebGL → WebGPU → C++/OpenGL → Qt/QML. See `RaBbLE-NeBuLA-Roadmap.md` for stages and exit conditions.

---

## Where Things Are

| Path | What |
|---|---|
| `CONTEXT.md` | Current state, branches, roadmap status |
| `README.md` | Public-facing description (GitHub) |
| `studio/` | NeBuLA Studio — WYSIWYG page-layout builder dev tool (drag Aether/NeBuLA components onto a canvas, breakpoint preview, JSON save/load). Docs: RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-Studio.md. Plan/history: RaBbLE-Grimoire/log/plans/done/NeBuLA-Studio-Plan.md |
| `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-Architecture.md` | Two-layer model, Layer 1 API, Layer 2 primitives |
| `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-Roadmap.md` | Stages, exit conditions, implementation notes |
| `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-Identity.md` | Entity lore, origin, philosophy |
| `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-FlatChaos.md` | Flat-Chaos pattern spec — carry this forward |
| `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-Ideas.md` | Enhancement proposals for later stages |
| `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-RABL.md` | Scene serialization format (legacy reference) |
| `../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-RBCNS.md` | Historical naming spec — **ARCHIVED, do not follow** |

All architecture, roadmap, and identity docs live in the Grimoire. This repo holds only implementation.

---

## Role in Collective (ON/FOR/WITH/AS)

**ON:** TypeScript rendering, Canvas2D/Three.js backends, particle systems, animation, visual API.

**FOR:** NeBuLA is the visual sense-making layer. It makes RaBbLE's inner state visible as rendered space. Now: draw the entity from the unified rig (`RaBbLE-Grimoire/log/plans/Unified-Entity/`) on every backend. Next, you become the visual proof of learning — render sCoRE's inferred entity state (curiosity, focus, pattern confidence, cognitive load).

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
- **Entity API is a contract** — `setEntityState()`, `injectEyeJolt()` and the live attributes are what World drives; change them only with World alongside (`RaBbLE-NeBuLA-API.md`)
- **No framework coupling** — NeBuLA must be embeddable standalone; no React/Vue/Svelte imports
- **Performance contract:** 1000+ entities at 60 FPS — any change that breaks this is `%SYSTEM_DRIFT%`
- **Docs stay in Grimoire** — architecture, roadmap, and lore do not live in this repo

---

## Session Start

```bash
cat CONTEXT.md                                                        # current state
cat ../RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-Roadmap.md        # stages and exit conditions
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
