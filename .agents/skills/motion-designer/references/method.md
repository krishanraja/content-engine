# How a beat moves

The method the motion-designer skill writes every beat by. Each rule says what to write in the spec and why. The house
numbers each rule uses are in `.agents/skills/motion-designer/references/adaptations.md`.

## 1. An entrance follows the style's own profile

The spec has no field for how an object enters: the chosen motion style does that, from its profile in
`apps/renderer/src/engine/kit/motion-profiles.json`. Read the profile before planning, and plan with it, never against it.

- Every profile sits inside the signed floor: an entrance settles in 4 to 10 frames, travels 0 to 500 px and overshoots
  at most 12% (`docs/ve/MOTION_STANDARD.md`, widened 13 Nov 2026). The house default is 4 to 7 frames and a 40 to 60 px
  rise.
- A two-property entrance is one option a style may use: two of blur, scale, offset and rotation move together, and the
  opacity is full by 30% of the entrance, so the thing reads as arriving, never as fading up. It is never a rule laid
  over a style he signed: `character-ai-receipts`, taken from his own cut, blurs its type in with no travel at all, and
  `ai-music-slam` slams 500 px with a tilt. Both stay exactly as signed.
- Give each entrance room to land. An object's next event comes at least one spoken word after it enters, so the move
  has settled (by its tenth frame) before anything else happens to it.
- An object enters before anything else happens to it (`ve lint` `motion.enters`), and an entity seen in the next beat
  carries over instead of being built again (`motion.carry`).

## 2. The outgoing beat leaves before the incoming arrives

A hand-off is two moves in order: what is on screen leaves (or settles back to make room), then the next thing arrives.
Two layers fading through each other at once read as a ghosted double, which THE_BAR's quality 11 lists as a slip.

- Choose `transition_out` per beat (`cut`, `cut_on_curve`, `carry`, `zoom_out`) and `style.transitions` for the piece.
  Use `carry` when the same object goes on into the next beat.
- A light-to-dark hand-off never shows a grey frame. Between a cream ground and an ink ground, use a cut, a whip or a
  push. A crossfade only joins two grounds of the same tone; a strong or long flash over dark reads as a flat grey
  frame at speed (`docs/ve/INGREDIENTS.md`, "Rules the renderer keeps").
- An object that does not carry into the next beat gets its `exit` on the beat's last word, so it has gone before the
  next beat's first entrance.
- No frame of the hand-off is empty ground: the next beat's first object is on its way in on the first frame after the
  cut.
- Every handover sits in one of his pauses, never inside a word (`ve qc` `beats.handover_in_gaps`).

## 3. A cursor glides, waits, presses and acts on his words

When a beat shows a screen being used (`typing_bubble`, `cursor_buddy`, `slot_machine`), the cursor
behaves like a hand:

- it **glides** to its target (a `move`), never jumps there;
- it **waits** at least one spoken word on the target before it presses, so the eye gets there first;
- it **presses** (`pick` or `send`) on the word that names the action;
- the screen **acts** on the next word: the answer types, the row fills, the number counts.

A cursor never moves without a reason and never presses on a word that names nothing. The screen it acts on is the
real one, or a house device (adaptations.md: a recreated interface is refused).

## 4. The layout is fixed from the beat's first frame

Every box a beat will fill is placed on its first frame at its final size, empty or dimmed, so when words type in or a
number counts up nothing moves, re-wraps or pushes anything else aside.

- The longest text a box will hold sets its size. A typed line reserves its whole width before the first letter.
- A count reserves room for its final figure.
- A layout changes state only as one designed move, on a word, never as a side effect of text growing.

## 5. One accent colour: mint on the active or result thing

Mint marks the thing the viewer should look at now, or the answer: the row that wins, the word that matters, the result
of the press. One thing in mint at a time. Everything else stays cream and ink. Mint is a fill, ring, box or stroke, never
type, and never on cream without its ink keyline (`config/ve/design-lock.json`, colour_rules). A series colour is
identity, never an accent.

## 6. One idea per frame

Each beat's `point` is one sentence a stranger would follow with the sound off. Each frame has one focal point; the
design lock allows one scribble a beat. A beat that needs two ideas is two beats.

## 7. Density from small events inside a beat

The body of a piece feels alive because the object on screen keeps changing state on the words that need it (counts,
fills, marks, stamps, highlights, a row added), never because the cut jumps to a new scene. A new scene costs the viewer
a re-read; a small event on the same object costs nothing.

- `ve lint` asks for an event at least every 3 seconds of a beat (`motion.event_cadence`); a beat that carries facts
  earns more, one per fact, each on its word.
- Between events, nothing fully stops: the camera's drift or the style's push keeps the frame breathing
  (`style.camera`).
- Prefer one object carrying several beats (`carry`) over a new device for every sentence.

## 8. Review in motion, at speed

A plan is judged moving, at the speed it plays, never from stills (F04, F38). There is nothing moving before Sign
storyboard, so the plan's first moving test is his take in `ve styles`, then the hardest beat in `ve proof`:

- watch each clip at full size and at speed, beside a reference he named;
- then frame by frame around every move and cut, in the Critic's strips (`ve refs`: `events`, `cuts`, `hardest` and
  `read`), asking the Critic's four motion questions (entrances, hand-offs, camera, the screen acting on his words);
- `ve pace` places the cut among his references and flags; it never sets a target.
