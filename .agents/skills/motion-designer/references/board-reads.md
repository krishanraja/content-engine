# What the inspiration board points to

Reference for `.agents/skills/motion-designer/SKILL.md`, step 1, before offering or choosing a motion style, caption
style, transitions, camera or energy.

1. Read the board's candidates for the piece: `GET /api/inspiration/candidates?role=motion`, then `role=captions` and
   `role=pacing` (pass `format=` when the clip's format is known).
2. Each candidate carries `style`, the engine's read of the card in this repository's ids (captions, motion,
   transitions, camera, energy), and `grounded_in`, which of his own fields on the card (why_here, why_like, would_do)
   it was built on.
3. A read grounded in his words (`style.grounded: true`) is his steer, not a guess (Krish, 2026-11-17: "If I put actual
   feedback in the inspiration board as to why I like something, that is not really a guess is it?"): prefer the ids
   it points to, and name the card (its `label` and id) in each `reason`.
4. A bare read (`grounded: false`) is a guess, one input among the rest.
5. His press still decides: never set `style.motion` past his Pick a style press, and offer, never pick, before it.
