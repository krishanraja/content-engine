---
name: motion-designer
description: "Write a ve piece's per-beat motion plan into its spec before Krish's Sign storyboard press: the one visual idea, the motion style he picked or is offered, the transitions, camera, energy and layout, and for every beat its point, layout, events on the words that name them and how it hands over, with any per-scene note in the storyboard document. Use when the ve skill's step 6 points here, or when a ve piece's beats need planning or re-planning before he signs the storyboard. Not for picking the style for him (his lock's recipe), rendering, the proof, the Critic's review, thumbnails, carousels or the cartoon character's drawings."
model: opus
---

# Plan the motion, beat by beat

The one job: before Krish presses Sign storyboard, write how every beat of every cut moves, into the spec he will
sign. The plan uses the fields the spec already has; nothing here changes the schema, writes per-piece code, or makes a
scene file. A note the spec has no field for goes in the storyboard document (`<ve dir>/storyboard.md`, beside
`expect.md`), one short paragraph per beat.

The plan answers to the house, never the other way round:

- **The signed motion standard** (`docs/ve/MOTION_STANDARD.md`) is the floor every cut holds.
- **His style pick.** `style.motion.module` is his lock's recipe, never put to him again after he records;
  never a style in `meta.style.rejected`. Its profile in `apps/renderer/src/engine/kit/motion-profiles.json` (read it,
  never edit it) sets how things enter. This skill plans inside it.
- **House rules.** HOOK_IS_THE_INTRO: every cut opens on its hook, nothing before it, one close.
- **The first two seconds of a vertical** (house rule FIRST_TWO_SECONDS; Ruling, Krish, 2026-11-16, of Growth's audience
  brief: "apply 1 to 6 from the next piece you make this week"). On a 9:16 cut the hook beat's first frame shows the
  piece's one named thing, and its first event lands by the hook's second word, so words are on screen inside the
  first second: `ve lint` (`story.hook_event`) refuses it later, and `dialogue.short_max` refuses a short past
  SHORT_CUT's 35 seconds. Plan the opening for a stranger scrolling with the sound off ("The UK number two": 35.7 in
  100 past 2 seconds).
  STORY_ARC: one story, each beat setting up or answering its question. VISUAL_EXPLAINS: a moving picture exists only to
  make one point land faster than the words. MUSIC_BED: only licensed music from the ledger, never a clock.
- **His words are the clock.** Every event sits on the word that names it; every handover sits in a pause.

## Before anything

1. `python3 scripts/check_failures.py --piece <piece>`, `python3 scripts/floor.py --format long_video --piece <piece>`
   and `--format short_video`, then `python3 scripts/preflight.py <piece> --skill motion-designer`. Read Krish's
   approved taste for makeyourmindup (`get_approved_taste`) where the connector offers it.
2. Read the signed narrative lock, both scripts as he will say them, the spec as it stands, `docs/ve/MOTION_STANDARD.md`
   and `docs/ve/INGREDIENTS.md` ("How a session uses it").
3. Read `.agents/skills/motion-designer/references/method.md` (how a beat moves) and
   `.agents/skills/motion-designer/references/adaptations.md` (the house numbers and what is refused) before writing a
   beat.

## 1. The piece's choices

First read what his inspiration says: `.agents/skills/motion-designer/references/board-reads.md`.

Set each with its `reason` in one plain line (`.agents/skills/motion-designer/references/plan-template.md`):

- `style.idea`: the one object, what each move means, the never-list, the real artifact shown as itself; every beat serves it.
  Before Sign storyboard: `.agents/skills/motion-designer/references/pre-critic.md` (`ve critic --pre`).
- `style.motion`: his pick, or before he records the proposal from
  `python3 scripts/post-pack/creative_direction.py motion --points ... --format ...`.
- `style.transitions`, `style.camera`, `style.energy`: chosen apart from the motion style (INGREDIENTS.md).
- `style.layout`: ONE staging per cut, `band`, `stage` or `anchor` (9:16 only; `style.layout.cuts`), with the recipe
  (Ruling, Krish, 2026-11-20); only title, chapter, end card, anchor plates break it. Nothing generated.
  INGREDIENTS.md "Shot grammar".
- Captions are their own choice (`style.captions`); the plan keeps their band clear and never repeats their words.

## 2. Every beat

For each beat of each cut, in order, write: `role`, `span` (his words), `point` (one idea, one sentence a stranger
would follow muted), `layout`, `uses`, `events` (each `at_w` on the word that names the change) and `transition_out`.
Then `ve shots <spec>` writes each beat's `shot` and the shot table in `storyboard.md`.
Follow the method's rules 1 to 7 (`method.md`, read in "Before anything"): the style's own entrances inside the
signed floor, the outgoing beat gone before the incoming, a cursor on his words, every box at its final size from the
first frame, one mint accent, one idea per frame, density from small events, never more scenes.

When the beat that is hardest to make move is not the one the proof rule would pick (most distinct devices), name it in
`style.proof.beat` and say why in the storyboard document.

## 3. The cartoon character

Only when `spec.character` names one and `ve lint` accepts it: `.agents/skills/motion-designer/references/character.md`.

## 4. Check the plan

1. `python scripts/ve.py lint <spec>` is clean.
2. Read every beat against the self-check in `.agents/skills/motion-designer/references/plan-template.md`. A beat that
   fails one is rewritten, never waved through.
3. `python scripts/ve.py expect <spec>` writes `expect.md`; the storyboard document sits beside it. Both go to his
   Sign storyboard press on the board. One press; never ask in chat.

## 5. After he records

The plan is judged moving, at speed, never from stills (F04, F38): at `ve styles` and `ve proof` (the ve skill)
watch each clip at full size and at speed, then frame by frame around each move and cut in the Critic's strips
(`ve refs`). When the proof shows a beat that does not land, change the spec here and lint again: at most two fix
loops, then record the gap for the final review. `ve pace` only flags; it is never a target.

## Allowed asks

None after Sign storyboard (Ruling, Krish, 2026-11-19): `.agents/skills/ve/references/allowed-asks.md`.

## Refused, whatever a reference shows

All of `.agents/skills/motion-designer/references/adaptations.md`: a white stage, violet or coral accents, an outside font,
small UI, a sound on every hit, unlicensed music, lockups, sparkles, shimmer loaders, recreated UIs, invented numbers,
per-video scenes, any pace target.

## Walls

Nothing here renders a paid asset, dispatches Codex, sends, posts, publishes or spends. A move the library cannot
draw is a gap in the storyboard document; its card waits for the ve skill (step 7). No outside picture enters the repo.
