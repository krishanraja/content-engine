# Creative direction: the one brief production renders from

Video is made with the ve engine (`docs/ve/ENGINE.md`, `docs/ve/RUNBOOK.md`); the quick-edit path stays the fallback until ve passes Phase 3.

For `schema_version: 2`, use ve's spec, `python scripts/ve.py lint <spec.json>` and the protocol in `docs/ve/ENGINE.md`. Beat spans and events use word indexes; layouts and devices come from `config/ve/` and `apps/renderer/src/engine/`. The `creative_direction.py` template, `signed` block, field list and quick-edit checks below describe the legacy direction contract, not schema 2. Keep the editorial ownership and independent review requirements for both paths.

Krish, 2026-10-24: "Once the videos are recorded, Claude gets the scripts and the visual creative direction locked so
that codex can take over on the video production, and ensures that it does a great job of producing the final publish
board. the copy of the article and what goes in the visuals etc is all Claude responsibility."

Why it exists: Wednesday 21 October went to production with no direction, and the production session improvised the
visuals: 38 one-off Python scripts, rounds of brand, framing and crowding repairs, then an article and a short Krish
scrapped (`docs/plans/2026-10-21-wednesday/FAILURE_REPORT_2026-10-24.md`). Friday 23 October had a direction written
before he recorded (`docs/plans/2026-10-23-friday/creative-direction.md`). This standard makes Friday's way the only way.

## Who does what

| Step | Who | What |
|---|---|---|
| Sunday morning | Claude, with Krish | The story for each day, one question at a time. The style for each piece, from the formats on its idea card (`config/style-references.json`, `formats`). |
| Sunday, before he records | Claude | The scripts, checked (`story_check.py`, two fresh readers), sent to Teleprompter. The creative direction for every cut, every beat. The article copy and every article visual. |
| Sunday, recording | Krish | Both takes per piece, as the direction says (on camera or voiceover). |
| After he records | Claude | Line the takes up (`narration_diff.py`), re-time the beats to what he said, build the storyboard from real captures, put it on the day's Brief step. The storyboard shows both lead pictures as stills, the series picture from the brand book and a story object, with Claude's pick marked (`creative_direction.py choices`; Krish picked: "Choose per piece", 29 Oct). What he says off-script is his natural speech, not slips (Krish, 2026-10-26: "That's just how I talk"): propose a cut only for a serious flaw, only where it cuts cleanly, and only after hearing it. |
| His sign-off | Krish | He signs the storyboard in his own words. The words go into `signed` with the hash of each script (`creative_direction.py hash`). His signature accepts Claude's lead-picture pick unless he ticks the other (`production_choices.lead_picture.ticked`); no storyboard waits on a tick. Then `making.py <piece> choices creative-direction.json` records the choices under test on the piece; if he has a cut open another way, `--opening` records what it used, so the making record stays the one home for these choices. |
| Production | Codex (or any session) | Renders exactly the signed direction through `produce-video`. It never invents a visual, a caption, a figure or a style. A gap goes back to Claude. |
| Review | A reviewer who did not make the cut | Watches every cut at full size and listens across every join, against `acceptance`. Reports fact, transport and editorial status separately. |
| The board | Claude | The day's Publish step through `week_board.py`'s own inputs. |

## The file

`docs/plans/<plan>/creative-direction.json`, beside the piece's `post.json`. Start one from a script with:

```bash
python3 scripts/post-pack/creative_direction.py template docs/plans/PLAN --cut long --script SCRIPT.md [--take voiceover]
python3 scripts/post-pack/creative_direction.py check docs/plans/PLAN/creative-direction.json --script long=SCRIPT.md
python3 scripts/post-pack/creative_direction.py hash SCRIPT.md        # what his signature binds to
```

- `style`: the script and production format he picked, from the bank.
- `brand`: the series, a `reference` (an approved earlier frame or board, a path or a link), the captions module and
  the intro sting.
- `cuts.<long|short|feature>`: the `take` (on_camera or voiceover) and its `beats`. Each beat has:
  - `words`: the exact words it sits under. All the beats together are the script, word for word, in order.
  - `point`: what the beat makes the viewer understand. A picture with no point is a gimmick (house rule
    `VISUAL_EXPLAINS`).
  - `picture`: its `kind` (face, screen, chart, card, photo, footage, logo, document), `what` is on screen, its
    `source` (an https link, a repository path, or `capture:<what he records>`) and the `source_label` shown on screen.
  - `on_screen_text`: at most 12 words.
  - `modules`: bank modules this beat uses.
- `max_face_share`: his face is at most this share of a cut's beats (0.6 by default; Krish, 2026-10-23: "not have my
  face in absolutely everything"). A voiceover take has none.
- `article.visuals`: each article figure's point, the reader's question it answers, and its source.
- `production_choices`: the choices Krish put under test, to be judged on real engagement (`docs/production/THE_BAR.md`,
  "Under test"; the defaults and options live in `config/reference-cuts.json` `under_test`, and the template starts from
  them). `opening` (`hook_is_intro`: the hook is the intro); `lead_picture`, with a `series_picture` and a
  `story_object`, each `what` and a `still` path, Claude's `proposed` pick and his `ticked` one when he ticks the other;
  `big_moment_sound` (`none` until he approves a small set by ear, then `big_moment_only`). Never a refusal: `check`
  passes a direction whatever these hold, a missing tick included.
- `acceptance`: the standard list, unchanged. It is what the reviewer signs against.
- `signed`: `{"by": "Krish", "said": "<his words>", "on": "YYYY-MM-DD", "script_sha256": {"long": ..., "short": ...}}`.

## What refuses what

- `creative_direction.py check` refuses a direction that leaves a spoken word without a beat, a picture without its
  source, a beat without its point, more than 12 words on screen, a module or format that is not in the bank, his face
  in a voiceover take or in too many beats, or no brand reference.
- `scripts/quick-edit/kit.py` refuses to draw a kit for any piece dated from 26 October 2026 without a direction that
  passes `check --for-render` for that cut's exact words: signed by Krish, on a script that has not changed since.
- `scripts/quick-edit/make.py` refuses to render a config whose direction is missing, or changed by even a byte since
  kit.py checked it.

## Production's rules (Codex reads these first)

1. Read this file, the piece's `creative-direction.json`, then `.agents/skills/produce-video/SKILL.md`.
2. Render only what the direction says. When a beat cannot be made as written (a capture is missing, a source is
   wrong), stop and say which beat and why. Claude changes the direction and Krish signs again.
3. Never publish, sign in to a publishing platform, or ask Krish for a login code. The board is fed; Krish publishes.
4. Never call a cut ready from receipts. Ready is the reviewer's pass against `acceptance`, with fact, transport and
   editorial status each reported.
5. Never write a script that patches or feeds the board by hand (`npm run check:board-layout` refuses one).
