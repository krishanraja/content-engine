# The method, adapted to the house

What the method in `.agents/skills/motion-designer/references/method.md` becomes in ve, and what it never does here.
Every number is a house number, with the file that holds it. Where a reference or a habit asks for something else, the
house wins.

## The house numbers

| What | In ve | Held by |
|---|---|---|
| Frame rate | 30 fps; every timing here is in frames at 30 | `config/ve/design-lock.json` (canvas) |
| An entrance | settles in 4 to 10 frames, 0 to 500 px, at most 12% overshoot; the house look 4 to 7 frames and 40 to 60 px | `docs/ve/MOTION_STANDARD.md`; the style's profile |
| An accent (a highlight, ring, underline, scribble or pulse on the active thing) | lands within 10 frames, then holds | the design lock's scribble draws on in 10 frames |
| Typing | 25 to 40 characters a second, finished before its span ends | MOTION_STANDARD.md, engine notes |
| Type size | nothing under 30 px; evidence words at least 40 px tall at the beat's key frame; a headline on a graphic beat at least 96 px | the design lock (`min_text_px`); `ve qc` `evidence.readable` (F44); MOTION_STANDARD rule 2 |
| A hold | never more than 3.5 s without a change; a hold still breathes | MOTION_STANDARD.md, Motion |
| Events | at least one every 3 s of a beat, each on the word that names it | `ve lint` `motion.event_cadence` |
| The safe screen | words and the point of a graphic inside every channel's safe area | MOTION_STANDARD.md, Channels; `ve qc` `channel.safe_zones` |

## The story arc, mapped onto beat roles

STORY_ARC: one story, opening on one clear question, each beat setting it up or answering it. In the spec that is each
beat's `role`:

| Role | What the beat does | Motion |
|---|---|---|
| `hook` | asks the question on frame 0 (HOOK_IS_THE_INTRO: nothing before it, ever) | the first event within the first 4 words (`story.hook_event`); a motion-designed statement that grabs |
| `anchor` | a fact the viewer can point at | the real artifact or the data device, changing state on the words |
| `bridge` | carries the thought to the next anchor | a lighter beat that ends on a cue into the next |
| `pivot` | the turn | one designed move: a zoom out, a carry into a new frame |
| `payoff` | the answer, exactly once (`story.one_payoff`) | the one big moment; mint on the result |
| `call` | only when Krish asked for a prediction on the piece (`spec.call`); no piece needs one (Ruling, Krish, 2026-11-19) | calm; the call reads and holds |

Anchors and bridges alternate (`story.alternation`). The close comes from `config/brand-palette.json` (the tall cut's one
statement beat of at most 2 s, the wide cut's statement card) and the engine draws it. The plan never adds a close, an
outro or a second opening of its own (floor 7: one opening, one close).

## His words and pauses are the clock

Every event's `at_w` is the word that names the change. Every handover falls in one of his pauses. Nothing is timed to
the music: the bed sits under him (MUSIC_BED) and never sets when a picture moves.

## Refused, each with the house rule it breaks

| Refused | Why |
|---|---|
| A white stage | Grounds are ink with the theme's light wash, never flat white (MOTION_STANDARD.md, Look; `config/ve/design-lock.json` colour_rules, ground ink). |
| Violet or coral as an accent | Mint is the answer colour; a series colour is identity only, never a status or a warning (design lock colour_rules); an off day never wears lilac or coral (`config/brand-palette.json`, colour). |
| A font outside `config/ve/fonts.json` | The house faces are Anton, Archivo, Fraunces and IBM Plex Mono; the brand grows only by a proposal to Krish, never into an AI cliché (MOTION_STANDARD.md, "The brand may evolve"). |
| Small UI in big empty space | A device on a graphic beat spans 80 to 90% of the width (MOTION_STANDARD rule 1); the frame outside the captions is at least 80% filled (design lock `fill_min_pct`). |
| A sound on every hit | One sound, on the big moment only (THE_BAR ruling 11; `ve lint` `sound.one_moment`); nothing plays before Krish approves it by ear. |
| Music not from the licensed ledger | Only an approved track in `config/music-library.json` (MUSIC_BED). |
| Lockups (a logo or title lockup reveal) | The brand book places the marks and the engine draws them; no mark over a tall cut's animated content (MOTION_STANDARD rule 3); one opening, one close (floor 7). The one title lockup is the engine's own (title/TitleMoment.tsx: one full frame, the wordmark inside it; Ruling, Krish, 2026-11-19); a plan never adds another. |
| Sparkles | An AI cliché (MOTION_STANDARD.md, "The brand may evolve, never into an AI cliché"). |
| Shimmer loaders | A loop with no cue (F05; `ve qc` `motion.periodicity`), and an AI cliché. |
| Recreated interfaces | Show the real thing (F32: `ve lint` refuses a device that re-types a real artifact's words); real logos and pages, never redrawn (floor 6). |
| Invented numbers | Nothing made up (floor 2); every figure comes from a dataset in the spec with its producer. |
| Per-video scenes or scaffolds | One signed spec; no per-piece compositions, render scripts or code (CLAUDE.md; the ve skill, step 7). |
| Any pace target | Rates and counts describe the references and are never the bar (`docs/production/THE_BAR.md`, "What is not the bar"); `ve pace` flags and never refuses. |
