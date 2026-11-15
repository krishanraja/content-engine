# Source: Keyframes full-visual + character, 0.2.13

**Ownership.** Krish's own, given to him licence-free (Krish, 2026-11-06: "its been given to me license free, terms
allow it, no need to vendor it - its mine now"). No vendor copy lives in this repository. What we adopt is rewritten as
ve's own code and docs, and each adopted entry carries `source: "keyframes@0.2.13"`.

**The original.**
- File: `full-visual-character-0.2.13.zip`, 849 files, 34 MB, sha256
  `6b1a72cba867fdca61c385188db4469e048ac417fb2c02d6728934064f6ac3b7`.
- Its reference home is Drive, `Ventures > Inspiration > Production Inspo` (`1QxrzxISYFXq0er0DG0XSapm7qhvuRmh-`).
  That upload is still to be done from a home computer: the cloud session that wrote this note could not move a 34 MB
  binary through the Drive connector.
- A later release is read against this page. Re-port only the capabilities whose source changed. Nothing replaces a
  capability on its own.

## What the pack is

A self-contained studio. It has:
- a Remotion 4.0.522 engine (`engine/full-visual/`);
- 14 skills, mirrored for Claude, Codex (`.agents`) and Grok;
- its own SessionStart hooks and permissions;
- a workspace web app;
- a bootstrap that downloads Node and ffmpeg;
- a whisper model;
- four worked example reels;
- the `character` pack, which draws the creator as an acting cartoon with GPT Image.

Its method is one bespoke scene file per reel, written by many builders at once, with the transcript as the only
approval. ve keeps its own method (one signed spec, devices from cards, Gates 1 to 3), so the pack's method was not
installed. Its repertoire was.

## Adopted

| Capability | ve home | Status |
|---|---|---|
| The craft: picture, motion, caption, hook, never-list, builder method | `_corpus/keyframes-full-visual.md` | reference |
| Full-visual motion style | `config/style-references.json`, bank id `full-visual` (motion layer) | untested; drawable today through its motion profile (`apps/renderer/src/engine/kit/motion-profiles.json`, inside the signed floor) and four built devices (kinetic_stat, evidence_card, hand_phone_stage, headline); the picker offers it, and Krish's verdict decides |
| A picture hands over only in a pause of 0.15 s or more | `scripts/velib/qc_gates.py` `handover_in_gaps`; ve qc row `beats.handover_in_gaps` | advisory on every format; counted where a format's `qc` names `handover_gap_ms` |
| No bare ground at a beat edge: the stage band (without header and caption) carries a picture within 3 frames of every edge | `scripts/velib/qc_ground.py`; ve qc row `ground.not_bare` | a shadow row on every format; counted where a format's `qc` sets `bare_ground: true` |
| Build caption: the page grows word by word, with the key word boxed | card `docs/ve/cards/keyframes/ve-kf-1-caption-build.md` | card written; not dispatched |
| The character: his own cartoon, about 60 poses that talk and blink, acting at the bottom of a cut (adopted 2026-11-09; Krish: "I will put a character in to it as well later this week, so ensure that is ready too.") | craft `_corpus/keyframes-character.md`; manifest `config/ve/character.json`; poses `config/ve/character-poses.json`; gate `scripts/velib/character.py` (ve lint `character.*`) and the optional `spec.character` | drawn and approved: base v2 approved 9 Nov ("yes"), all 65 poses drawn closed, open and blink on 10 Nov and filed in his brand kit (`1 Brand kit (permanent)/character/krish/`, never git); `config/ve/character.json` says ready; a spec naming it is refused only until `character_layer` is registered |
| Reading, checking and staging the drawn library for a cut (it draws nothing) | card `docs/ve/cards/keyframes/ve-kf-6-character-library.md` | card rewritten for the drawn library 15 Nov; not dispatched |
| The character layer: pose per idea, his voice moving the mouth, blinks, clear of every channel's buttons; 9:16 only, never in the hook, each pose picked for its beat's point (`.agents/skills/motion-designer/references/character.md`) | card `docs/ve/cards/keyframes/ve-kf-7-character-layer.md` | card brought up to date 15 Nov; not dispatched; waits on ve-kf-6 |

## Next, one card or change at a time

Cards written in `docs/ve/cards/keyframes/`, none dispatched yet (dispatch spends Codex allowance and waits for Krish):

| Card | Builds | After it lands |
|---|---|---|
| `ve-kf-1-caption-build` | `captionStyle: 'build'` in the renderer | compile emits `build` for `style.motion: full-visual`; `ve qc` learns its caption region |
| `ve-kf-2-kit-verbs` | `countTo`, `typeOn`, `drawPath`, `mix`, `cursorPath` in `kit/verbs.ts` | cards 4 and 5, `ve-mg-1` and `ve-mg-3` use them |
| `ve-kf-3-cutaway-section` | device: a real object opens to show its layers | routed into the `full-visual` style |
| `ve-kf-4-count-roll` | device: a number rolls to its word on the real thing | routed into the style |
| `ve-kf-5-cursor-path` | device: a real interface used on his words (the cursor waits, presses with a mint ripple, glides, and shows it is busy after a send) | routed into the `living-ui` style (moved 15 Nov), beside the cards in `docs/ve/cards/living-ui/` |

Then a trial format, `full-visual`:
- no presenter, 9:16;
- his own voice-over, the build caption and the house bed;
- `qc.longest_still_s` 1.2, `qc.handover_gap_ms` 150 and `qc.bare_ground: true`, so both shadow rows count;
- `status: trial` until a Gate 2 press on a real piece.

Then the first real how-it-works Short in it.

The character, in order (each step waits on the one before):
1. Done, 9 to 10 Nov: his photo, the base, his yes on base v2, and the 65 poses drawn and filed in his brand kit.
2. `ve-kf-6-character-library`: read, check and stage the drawn library (code only; it draws nothing).
3. `ve-kf-7-character-layer`, then a Gate 2 look on a real 9:16 cut.

## Deliberately left out, and why

| Left out | Why |
|---|---|
| `.claude/`, `.agents/`, `.grok/`, `.cursor/`, `.gemini/`, `.codex/` and their hooks | They would collide with this repository's skills and guard hooks (`.claude/settings.json`) and widen permissions (`acceptEdits`, `npm install *`, `network_access = true`). |
| The bootstrap's binary downloads and the workspace app | ve has its own doctor and runners. |
| The ElevenLabs, OpenAI or Fish key in `.env.local`, and the synthetic voice | Secret guard; Krish records his own voice. |
| `@composio/core` | No new dependency without a need. |
| Example stills, reels, fonts and the whisper model | We never commit media. They stay in the original zip. |
| Bespoke per-reel scenes, and five hooks rendered as five videos | One signed spec. Alternate hooks wait for a format change. |
| The `character` pack's own scripts, rig, workspace page, OpenAI-key route and drawing in code | ve rewrites the craft as its own config, gate and two cards. The image route is Codex on his ChatGPT subscription only; drawing in code looks much worse. The style image and example sheet stay in the original zip and his library, never in git. |
