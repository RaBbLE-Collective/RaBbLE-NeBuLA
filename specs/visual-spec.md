# RaBbLE Entity — Visual Specification

A reproducible description of the visual identity of the **RaBbLE Entity**: the
twin-eyed particle being that appears across the Collective's surfaces (boot
splash, landing stage, chat header, OS wallpaper, and as miniature avatars in
the Grimoire). The goal of this document is that an agent or LLM, given only
this text, can recreate the entity in any rendering medium (canvas, SVG, WebGL,
even ASCII) and have it read unmistakably as **the same character**.

The canonical reference implementation is `world/js/RaBbLE-entity.js` (HTML5
canvas, ~700 lines). This doc distills the *visual idea* behind that code so
new implementations can vary the medium and palette without losing identity.

---

## TL;DR — the one-line identity

> A cluster of cool-blue stardust holding two bright **white-glowing eye-slits** —
> one with a **magenta halo, portal slung low**; the other with a **cyan halo,
> portal slung high**. The two orbs rest **level** with each other — it's their
> **portals** that are always mismatched (one above its eye, one below, never
> both on the same side), paired with the two eyes always taking **opposite
> colors**. That portal asymmetry plus that color opposition is the character —
> not the eyes' vertical position (ruling, 2026-09-26, see Revision History).

If you remember nothing else: **white eyes, neon outline, mismatched portal
heights, opposed colors.** Everything else is decoration.

---

## Anatomy

The entity is composed of, from back to front:

1. **Nebula** — a soft particle cluster (the "body").
2. **Particle connections** — faint mesh lines between nearby particles, visible
   only after the entity has "settled" (post-boot).
3. **Portal slits** — two wide-flat dark ellipses (one per eye), each ringed
   with a thin glowing arc in that eye's signature color.
4. **Halos** — soft colored radial bloom around each eye orb.
5. **Eye orbs** — two tall vertical ellipses, white-blue fill, neon stroke +
   glow. The face.

There is **no body, no mouth, no limbs, no head outline.** The nebula *is* the
body. The eyes are the only "face" feature. Do not add eyebrows, eyelashes,
nostrils, or any other anthropomorphic element. The entity is a void with eyes
in it.

---

## The eyes — the load-bearing detail

### Shape

Each eye is a **tall vertical ellipse** — definitely *not* a circle. Aspect
ratio is roughly **1 : 1.85** (width : height). In the canvas reference the
semi-axes are 15 × 28 px (so the orb is 30 wide × 56 tall in a 460-px-wide
field). Think pill, capsule, fluorescent tube — not eyeball, not pupil.

### Fill

The orb is filled with **near-white with a faint cool-blue tint** — the
reference uses `#f8faff`. This is the *only* warm/light surface in the entire
design. Everything else is void or neon outline. The fill is **solid**, not
gradient: the eye reads as a glowing white slab seen through neon glass.

### Stroke

A **thin** (~1–2 px at canvas scale, ~0.3 user-units at SVG-scale-60) stroke
in the eye's signature color sits directly on the ellipse edge. The stroke
is paired with a **stacked drop-shadow glow** in the same color — a tight
inner halo plus a wider diffuse one. In CSS:

```css
filter: drop-shadow(0 0 6px var(--color))
        drop-shadow(0 0 14px var(--color));
```

In canvas: `shadowBlur = 18 + 10·sin(t·0.028)` — i.e. the stroke glow **pulses
slowly between roughly 18 and 28 px of blur**. Do not animate this fast. It
should breathe, not flicker.

### Color rule — the eyes are always two different colors

The canonical pair is **magenta `#ff2d78` (left) + cyan `#00f5ff` (right)**.
Every other entity in the Collective is a re-palette of this base, but the
rule holds: **left eye and right eye are never the same color.** They are
always two complementary neons from the RaBbLE palette. The contrast is what
makes the entity feel *alive* rather than symmetrical.

Sample palettes used in the Grimoire (left → right):

| Entity     | Left          | Right         |
|------------|---------------|---------------|
| RaBbLE     | magenta       | cyan          |
| Aether     | pink          | magenta       |
| NeBuLA     | violet        | cyan          |
| sCoRE      | cyan          | violet        |
| ScRibLE    | magenta       | pink          |
| OS         | cyan          | magenta       |

If you are choosing fresh colors, pick **two neons that are clearly distinct
in hue, both saturated, both at full luminance.** No earth tones. No
desaturated tints. No matching pair.

**Which color sits on which side is NOT canonical** (ruling, S190). A
left/right swap reads as expression or a change signal, not an identity
error. The invariant is only that the two eyes differ — renderers do not
need to preserve side assignment across backends or states.

---

## The portal slits — *the* visual signature

This is the most-frequently-missed detail when the entity is recreated. **Read
this section twice.**

### What they are

Each eye has an associated **portal slit**: a wide, flat ellipse, much wider
than the eye and much shorter. Inside the slit the void shows through (dark,
fading to fully transparent at the edges). The rim of the slit is a thin
glowing arc in the same color as that eye.

Aspect ratio of the slit ≈ **3.3 : 1** (wide and flat). In the canvas
reference, the slit is 62 wide × 19 tall (semi-axes 31 × 9.5), vs. the orb's
30 × 56. So the slit is **roughly 2× the width of the orb but only 1/3 of its
height**. The slit clearly "frames" the orb but doesn't enclose it.

### THE asymmetric placement

Here is the load-bearing rule:

- The **left eye's portal sits BELOW the orb's centerline** — offset down by
  roughly 0.44 of the orb's full height (≈ 44% of EYE_H).
- The **right eye's portal sits ABOVE the orb's centerline** — offset up by
  the same amount.

The two orbs themselves are on a **shared horizontal centerline** — they are
level with each other. It is the **portals that are vertically mismatched.**

Visually, this means: the left orb appears to be "rising up out of" its
portal-slit, with a glowing magenta ring cutting through its lower third. The
right orb appears to be "sinking down into" its portal-slit, with a glowing
cyan ring cutting through its upper third. Together the two glowing rings
form a diagonal axis from lower-left to upper-right.

### Why it matters

A symmetric placement (both portals below, both above, both at center) makes
the entity look like a generic two-eyed cartoon mascot. The asymmetric
placement is what makes it feel like something *peering through* the void
from beyond — like the orbs are eyes belonging to a creature that is mostly
not in our dimension, and the two visible holes happen not to line up.

It also gives the entity an **off-axis tilt** that reads as alert / attentive
without any other animation.

**On eye-leveling specifically:** the orbs sit level with each other at rest
(zero-input idle pose) — this was always the geometry (see the Geometry
summary table below), the TL;DR simply used to say the opposite. Once
animated (gaze drift, saccades, mood), the orbs may float slightly off that
shared line — leveling is the rest pose, not an enforced constraint either
way. Portal asymmetry and color opposition are the invariants; eye height is
not.

### Don't confuse the two parts

| Part        | Shape           | Fill                                    | Stroke                                  | Role                |
|-------------|-----------------|-----------------------------------------|------------------------------------------|---------------------|
| Eye orb     | tall ellipse    | solid white-blue (`#f8faff`)            | thin neon stroke + 2-layer drop-shadow   | the "face"          |
| Portal slit | wide flat ellipse| dark radial (void → transparent)        | thin neon rim, same color as its eye     | the asymmetry mark  |

---

## The halos

Each eye additionally has a **soft outer halo** — a wide radial bloom in the
eye's color, low opacity (~30% at center, transparent at edge), radius
roughly 80% of the orb height. The halo is centered on the orb (not the
portal), so it bleeds out into the surrounding nebula and tints the
nearby particles in that eye's color.

Halo intensity **pulses slowly** in sync with the stroke glow.

---

## The nebula (body)

The "body" of the entity is a cluster of ~400–500 small glowing particles
arranged roughly in an ellipse around the eyes, denser at center and falling
off softly toward the edges. There is **no hard outline** — the body has no
silhouette, only a density gradient.

### Particle palette

Cool-only. Sampled from these hex values (use this whole set, no warm
substitutes):

```
#1a4aaa  #2255cc  #3377ee  #4499ff  #55aaff   ← blue tier
#00bbdd  #00eeff  #33ddf0  #55ccee            ← cyan tier
#5533aa  #7744cc  #9944dd  #aa44cc  #bb55dd   ← violet tier
#ffffff  #ddeeff  #ccddff  #aabbee            ← white/highlight tier
#0a1a55  #0d2277  #112299                     ← deep-blue underlayer
```

Roughly half the particles glow (drop-shadow halo, blur 14–28px); the other
half are flat dots. The glowing half does the heavy lifting visually.

### Particle size

A wide range: smallest are ~1 px, largest ~12 px. Larger ones are rarer.
**Resist the temptation to make them uniform.** The size variance is what
makes the cluster read as "stardust" rather than "dot grid."

### Distribution

Polar-random around a center: `r = (random^0.52) · 130px`, `a = random·2π`.
The exponent of 0.52 weights particles toward the center but leaves enough
in the outskirts to soften the edge. Vertical squash factor ≈ 0.8 (so the
cluster is wider than it is tall).

### Density falloff

Each particle's alpha multiplies by `max(0, 1 − distance / 155px)`. At
~155 px from center the particles are invisible. This is the soft edge.

### Motion

- Each particle has a **personal phase** and drifts on a low-frequency
  sin/cos pattern around its target position.
- After "settle," particles **don't return to their target** but instead
  orbit slightly around it.
- Each particle's alpha **pulses** at its phase rate (`0.62 + 0.38·sin(phase·2 + t·0.015)`).
- Particles within ~62 px of each other are connected by **very faint
  straight lines** (line alpha ~0.13) — this creates the visible "mesh"
  in the cluster.

### Breathing

The whole entity has a 6 s **scale + brightness pulse** — scale 1.00 ↔ 1.04,
brightness 1.00 ↔ 1.08, ease-in-out, infinite. Subtle, but it's what keeps
the entity from feeling static.

---

## Behavior (motion design)

These behaviors are part of the identity at full-size; at thumbnail size
some can be skipped.

### Gaze

Both eyes track in unison (they always point the same direction). At rest the
eyes drift on a low-frequency two-component sinusoid. Occasional **saccades**
snap them to a target position from a small table of biases (corners,
cardinal directions, center) and hold for 25–150 frames before unclamping.
Roughly every 2–4 seconds a **distraction** pulls them off-target briefly and
then springs them back.

If a cursor is within ~600 px the eyes lean toward it (weighted ~50/50 with
the saccade target). On click the eyes **jolt** in the click direction and
decay back over ~10 frames.

The eye orbs travel inside their portal's bounds — they are **clamped to an
ellipse** matching the portal's interior so they never appear to leave the
slit.

### Blinking

Implemented as a **`scaleY` collapse** of the orb (scaleY 1 → 0.12 → 1). The
portal and halo do not blink — only the white orb collapses to a thin
horizontal line, then re-expands. Both eyes blink in sync.

The blink schedule is a **burst-then-rest pattern**:

- 5 rapid blinks (~8-frame gap, gap multiplied by 1.55× each blink so it
  decelerates) → then a long rest of 3–7 seconds → repeat.

This is *the* RaBbLE blink rhythm: not metronomic, not random, but
**clustered**. It reads as a creature trying not to blink and then losing
the battle in a small burst.

### Emergence (boot only)

When the entity wakes from cold (boot mode), the sequence is:

1. **Particles converge** from offscreen positions toward their target
   positions over ~2.8 s.
2. **Portal arcs draw** themselves, starting at the top of each ellipse and
   sweeping clockwise to complete the ring over ~2.2 s (slightly staggered
   between left and right). A bright white **leading dot** sits at the
   drawing front.
3. **Eyes emerge** from the portal slits over ~1.2 s — clipped to a growing
   slit-shaped mask, sliding from the portal position up/down to their rest
   position.
4. Once fully open, the **burst-blink** kicks in (see above) and the entity
   is "alive."

Skip this entire sequence for idle / thumbnail / non-boot contexts. Eyes
appear instantly at rest.

### Entity states

The live NeBuLA renderer currently exposes three states (`idle | thinking |
speaking`) that modulate the waveform amplitude / frequency (when shown). The
waveform is disabled in the stable build, so for most purposes you can
ignore states in the *current* implementation — but see below for the
reconciled state model this doc now specifies going forward.

#### Reconciled mood + Aether-state model (2026-09-26, from the animation rig)

The entity moves through five **moods**, on its own, rather than firing at
random:

```
Idle → Ponder → Process (70%) → Insight (60%) → Idle
Ponder → Idle (30%)      Process → Ponder (40%)
Idle/Ponder → Curious (cursor or touch) → Idle (2.5s without input)
```

Curious can interrupt any mood except Insight.

| Mood | Lasts | Eyes | Surroundings |
|---|---|---|---|
| Idle | 4–8s | slow wander, small random glances | normal lightning, rare big shockwave |
| Ponder | 5–9s | look up/aside, head tilts that way, that eye squints more | activation waves roll inward, rings rise/sink through portals, orb slows |
| Process | 3–5s | quick darting glances, like reading | synapse sparks inside orb, faster pulses, orb spins/brightens |
| Insight | 2.8s | go wide, then squint + blink | center flash, pulses/bolts stream to horizons |
| Curious | while interacting | track cursor/finger, head tilts toward it | mesh nodes push away from pointer |

Separately, the **Aether states** (`idle | listening | speaking`) drive the
portal-flip behavior on top of whichever mood is active:

| State | Portals |
|---|---|
| Idle | resting asymmetry — one above its eye, one below |
| Listening | flip — the portal above moves below, and vice versa |
| Speaking | both move further from their eyes, exaggerating the asymmetry |

**`listening` is a newly-defined Aether state as of this revision** — the
live renderer only implements `idle | thinking | speaking` today. Wiring
`listening` (and the five-mood layer above it) into
`RaBbLE-NeBuLA/src/backends/canvas2d-backend.js` + `eye-behavior.js` is real
feature work, not yet done — treat this section as the target spec for that
future session, not a description of current behavior.

Other event-driven reactions (apply in any mood): lightning strike (both
eyes snap toward the impact, that side's eye flinches/recoils/flares),
shockwave (widen + flare, then squint + double-blink ~0.5s later), high
energy (dilate, brighter glow, tremble, more frequent blinks), heartbeat
(46–110 bpm pulse on the core glow/halos depending on excitement).

---

## Animation rig (machine-readable manifest)

As of 2026-09-26 the entity has a script-free SVG rig plus a JSON parameter
manifest, living in `RaBbLE-NeBuLA/specs/rig/`:

- **`entity-rig.svg`** — every moving part is a named group carrying
  `data-pivot="x y"` (in its parent's coordinate space). Apply transforms as
  translate-to-pivot → rotate/scale → translate-back. Hierarchy nests:
  `entity > entity-body > eye-left (clipped) > eye-left-gaze > eye-left-lid`,
  so a blink never fights a glance.
- **`entity-rig.json`** — lists every parameter (target group, what it
  drives, range) and the palette, keyed to the same group ids.
- **`entity-rig-demo.html`** — a complete, working reference render driving
  the rig (mood state machine, lightning/shockwave events, adaptive
  frame-budget quality scaling). Reference only — not wired into the
  production Canvas2D/Three.js backends.

Rig conventions worth knowing before touching any of the three files:

- **Poles**: every pole-colored element carries `data-pole="a"` or `"b"`.
  Recolor by pole, never by hex — this is what lets an entity's colors swap
  sides or re-theme without touching geometry.
- **Tiers**: every layer carries `data-tier` (`core`, `aura`, or
  `environment`). Core (eyes + portals) must always render; aura (nebula,
  wireframe orb, orbit rings, lightning lens, neural mesh, particles) is
  optional but on-model; environment (background, grid) is replaceable.
- **Spawners**: empty groups with `data-spawn` are where an engine
  instantiates particles/bolts/thought-rings/synapses from `<defs>` templates
  (`#tpl-mote`, `#tpl-ember`, `#tpl-spark`, `#tpl-flash`, `#tpl-pulse`).
- **Occlusion**: each eye clips via `clip-path="url(#occlude-eye-*)"`; each
  portal has a front-rim overlay (`portal-*-rim-over`) drawn after the orb,
  active only while that portal is below its orb. This follows the portal's
  *position*, not its color, so it holds when poles swap or portals flip.
- **Porting notes**: plain JS/GSAP/anime.js can inline the SVG and drive
  groups by id directly (works as-is). Rive/Lottie/Unity/Godot/Unreal need
  the procedural parts (mesh, lightning, particles, sphere) regenerated
  in-engine from the manifest's formulas — the rig stores base shapes and
  regeneration formulas for those, not baked frames.

Full guide (proportions reconciliation, glow-construction recipes, blink
timing, do/don't table): `The Entity: Visual Guide and Animation Rig`,
archived in `RaBbLE-BaBbLE/reliquary/2026-09-26-entity-harness/`.

---

## Geometry summary (one table to rule them all)

For a canvas roughly **460 wide × 320 tall**, with center at
`(cx, cy) = (230, 150)`:

| Symbol           | Value          | Meaning                                      |
|------------------|----------------|----------------------------------------------|
| `baseY`          | `cy − 6`       | vertical center of both eye orbs             |
| `EYE_GAP`        | 36 px          | horizontal distance from `cx` to each orb    |
| `EYE_W` × `EYE_H`| 30 × 56 px     | full orb size (tall ellipse)                 |
| `PORTAL_W` × `PORTAL_H` | 62 × 19 px | full portal-slit size (wide flat ellipse)  |
| left portal Y    | `baseY + EYE_H·0.44` ≈ `baseY + 24.6` | portal hangs **below** left orb |
| right portal Y   | `baseY − EYE_H·0.44` ≈ `baseY − 24.6` | portal hangs **above** right orb |
| left orb color   | `#ff2d78`      | magenta                                       |
| right orb color  | `#00f5ff`      | cyan                                          |
| orb fill         | `#f8faff`      | white-with-cool-blue-tint                     |
| particle count   | 480            | reduce to ~36 for thumbnails                  |
| nebula radius    | 130 px         | target cluster radius                         |
| nebula falloff   | 155 px         | alpha-zero radius                             |

All proportions scale linearly. For a 60×40 SVG thumbnail (factor ~0.13):
orb 4×7, portal 8×2.5, gap 4.8, portal vertical offset ±3.2. Same shape, same
asymmetry, fewer particles.

---

## What "wrong" looks like

These are the failure modes the visual identity is supposed to rule out.
If you see your reproduction doing any of these, it's not the entity yet:

- **Round / circular eyes.** The eyes must be vertically elongated. A circle
  reads as a generic cartoon eyeball.
- **Symmetric portal placement.** Both portals at center, or both at the
  same y. This kills the character.
- **Filled gradient orb (white→color).** The orb is *solid* near-white. The
  color lives in the stroke and the halo, not the fill. A gradient orb
  reads as "glowing pearl" not "white slab with neon outline."
- **Same color on both eyes.** Even a tasteful matched pair breaks
  identity. Always two different neons.
- **Warm or earth-toned particles.** The nebula is cool-only. No orange, no
  beige, no sepia.
- **Hard-edged body silhouette.** The nebula has no border. If you can trace
  the body's outline, it's wrong.
- **Emoji or face glyphs nearby.** The entity carries its own affect. Don't
  decorate it with smileys, sparkles, hearts, etc.
- **Eyes that look in opposite directions.** Both eyes always track in
  unison. They are not googly.
- **Metronomic blinking.** Blinks must come in bursts with long rests.

---

## Minimum-viable still rendering

If you can only afford a single static frame (no animation), prioritize in
this order:

1. The **two tall white-blue eye orbs** with neon stroke + glow.
2. The **asymmetric portal slits** in the right colors below/above each orb.
3. The **nebula haze** behind them (a radial-gradient blob is fine if you
   can't afford individual particles).
4. The **outer halos** around each eye.
5. The individual **particles**.
6. The **particle connection mesh**.

Stop at any point — the first three are enough for the entity to be
recognizable. Items 4-6 are atmosphere.

---

## Reference assets

- Canonical implementation: `world/js/RaBbLE-entity.js` (HTML5 canvas)
- Live reference screenshot: `scraps/entity-reference.png`
- Miniature SVG re-implementation (for thumbnail use):
  `EntityCreature` in `grimoire-variants.jsx` — useful as a worked example
  of the geometry table scaled to a 60×40 viewBox.
- Brand mark (related but not the same thing): `aether/assets/RaBbLE-OS_ICON.png`
- Animation rig + reference engine (2026-09-26): `RaBbLE-NeBuLA/specs/rig/`
  (`entity-rig.svg`, `entity-rig.json`, `entity-rig-demo.html`) — see
  "Animation rig" section above.
- Full visual guide + an alternate non-canonical concept render: archived in
  `RaBbLE-BaBbLE/reliquary/2026-09-26-entity-harness/`.

---

## Revision History

- **2026-09-26** — Integrated the entity animation rig (`entity-rig.svg` /
  `.json` / demo engine) and its accompanying guide. Added the reconciled
  five-mood behavior model + `listening` Aether state (new — not yet
  implemented in the live renderer) and the "Animation rig" section.
  **Resolved a standing inconsistency**: this doc's own detailed geometry
  section always specified the eye orbs as level with each other (shared
  horizontal centerline, only the portals mismatched) — but the TL;DR
  headline said "the two eyes are never level," contradicting it. Mark's
  ruling on review: portal asymmetry (always one above/one below, never
  both the same side) and eye/portal color opposition are the
  character-defining, invariant traits — not eye vertical position. Eyes
  rest level at zero-input idle and may drift once animated, but leveling
  itself is not an enforced rule either way. TL;DR and the asymmetric-
  placement section updated to state this correctly and consistently.

---

## Doc-fidelity verification

To confirm this document is self-sufficient, a static SVG was rendered using
**only** the rules and geometry table above (no peeking at the canvas source).
Side-by-side with the live canvas reference:

![Canvas reference vs doc-derived SVG](./entity-doc-compare.png)

Left: live canvas (`world/js/RaBbLE-entity.js`, ~480 particles, animated).
Right: static SVG built from this spec alone (~240 particles, no animation).

Identity reads clearly across both:

- Two tall white-blue eye orbs on a shared horizontal centerline ✓
- Left eye magenta, right eye cyan (the canonical pair) ✓
- Asymmetric portal slits — magenta below the left orb, cyan above the right ✓
- Cool-only particle nebula with soft falloff ✓
- Faint connection mesh between nearby particles ✓
- Soft outer halos bleeding into the nebula ✓

The static SVG is missing only the time-domain behaviors (gaze, blink, breathe,
particle drift), which the spec describes separately under **Behavior**.
