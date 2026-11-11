# Entity animation rig

Landed 2026-09-26 from `RaBbLE-BaBbLE/intake/`. Full spec context:
`RaBbLE-Aether/RaBbLE-Entity-Visual-Spec.md` → "Animation rig" section.

- `entity-rig.svg` — the rig: 450 named/pivoted groups, `data-pole="a"/"b"`
  color tags, `data-tier="core"|"aura"|"environment"`, spawner templates.
- `entity-rig.json` — the manifest: hierarchy, every parameter (target group,
  what it drives, range), palette.
- `entity-rig-demo.html` — a complete, self-contained reference render
  driving the rig (five-mood state machine, lightning/shockwave events,
  adaptive frame-budget quality scaling). Open directly in a browser
  (`file://`) — no build step, no external deps.

**This is reference material, not production code.** Nothing here is wired
into `src/backends/canvas2d-backend.js` or `src/backends/eye-behavior.js`.
Porting the rig's mood state machine and `listening` state into the live
renderer is future work — see the visual-spec's "Reconciled mood + Aether-
state model" section for the target behavior.
