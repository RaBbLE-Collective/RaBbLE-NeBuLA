# Visual Analysis: Current Render vs Concept Art

> **SUPERSEDED (S190).** Condensed per condense-not-delete — the full
> gap-analysis (eye shape, pupil inversion, eyebrow positioning, glow/shading
> deltas) described the pre-port Xperimental prototype (circular eyes,
> eyebrows, mouth tubes). None of that exists in the current implementation
> and none of it should be built.
>
> The current Three.js entity is `src/backends/threejs-backend.js`
> (tall-ellipse eyes, asymmetric portal sockets, shared
> `src/backends/eye-behavior.js` soul with the Canvas2D backend). Canonical
> visual spec: `RaBbLE-Aether/RaBbLE-Entity-Visual-Spec.md` (note: this target
> is referenced by several Grimoire docs but does not currently exist on disk
> — flagged for Mark, not fixed here as it's outside this pass's scope).
>
> Full original text (pre-condense) is recoverable from git history at this
> path as of commit prior to the S193/S194 architecture-audit cleanup pass.
