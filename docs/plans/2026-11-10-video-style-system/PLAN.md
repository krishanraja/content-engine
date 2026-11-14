# Plan: video style decided before the script (step 1, inventory and style catalogue)

> **Superseded in part (10 Nov 2026).** Krish rejected the 9-entry catalogue in step 1.2: "its not really a style catalogue is it? Its just a summary of the misfit hodgepodge in there." It was withdrawn. The catalogue design is now `STYLE-CATALOGUE.md`. The capability register (step 1.1) stands.

## Context

Krish's ask: today the engine goes idea, then script, then recording, then craft. Motion, artwork, captions, sound and look are worked out after the recording, so production is a run of corrections. He wants the whole video designed up front from what works, chosen from a catalogue of complete video styles he can see. He also wants every capability cleaned up, modular, and labelled with its purpose and production stage. Control Center's publish board is where he makes these choices and hands them back to Claude. Inspiration House holds the videos he liked.

He chose **inventory plus style catalogue first, with no pipeline changes yet**.

The 8-agent read-only map (full text: `docs/plans/2026-11-10-video-style-system/capability-map.md`) found:
- **Style is chosen four times:** on the Ideas tab, in the narrative lock, at the board Look step, and in `ve styles` with Pick a style. The motion style, caption look, storyboard and sfx are all settled after recording.
- **About 45 craft failures were caught at review or after publish:** F01, F05 to F08, F19, F21, F26, F28, F30, F31, F35, F36, F40 to F44. Their guards went into render/QC code, often ve-only.
- **The stock exists but is scattered:**
  - 53 bank modules, 52 of them untested
  - 5 format taxonomies
  - 1 whole-style recipe (`config/ve/recipes/data-story.json`)
  - 3 video makers
  - 4 feedback stores
- **The Sandcastles five formats are in no repo.**
- **Inspiration House** measures each liked clip (`facets.understanding`), but nothing reads it, and the `teaches` column is never written.
- **The Control Center board contract** carries only `look` among the production choices. Every other press opens the engine page.

## Step 1: what this session builds (all in content-engine; no CC or ve behaviour change)

1. **Capability registry:** `config/capabilities.json`, plus a generated `docs/CAPABILITIES.md` that is reference, not a state doc.
   - One entry per capability: `id`, `name`, `purpose`, `stage` (fixed vocabulary from idea to performance), `decided` (pre-script, pre-record, post-record or post-cut), `location`, `status` (working, partial, broken, duplicate or documented-only), `owner`, `overlaps`, `keep|merge|retire` (a proposal for Krish, never applied).
   - Seeded from synthesis section A, with every row re-verified against the code before it goes in.
   - Covers all three repos. Control Center and Inspiration House rows point by repo and path.
   - A small script, `scripts/capabilities.py`, validates the schema, checks that every `location` path exists in content-engine, renders the doc, and joins `npm run verify` through a `check:capabilities` entry.
   - Reuse: the pattern of `scripts/floor.py` and `scripts/check_failures.py` (a JSON register plus a CLI reader).

2. **Video style catalogue:** `config/video-styles.json`.
   - One entry is a complete style:
     - `id`, `name`
     - the Sandcastles format (Insider access, Absurd real scene, It's about you, Changed this week, Resource drop)
     - `script_format`, mapped to `style-references.json` `formats.script`
     - `hook_pattern`, from `config/hook-playbook.json`
     - `lengths`, from `_video.ts:37`
     - `production_format`, pointing at `config/ve/formats/*` and `formats.production`
     - `motion_style`, from the style-references motion layer
     - `caption_look`
     - `sound` (track mood, the bed from `config/music-bed.json`, sfx)
     - `opening` and `close`
     - `devices`, from `config/ve/devices.json`
     - `evidence` (inspiration_items ids, the Sandcastles examples, the postmortem)
     - `measured_grammar` (cuts per minute, wpm, framing), aggregated from the linked Inspiration cards
     - `never`
     - `prevents` (which `failures.json` ids it designs out)
     - `krish_verdict` (always `untested` until he rates it)
   - Six seed entries, from synthesis section D:
     - face-with-proof × head-to-head
     - data-story Ladder
     - voice-led-pictures
     - scoreboard-test
     - two-passports (trial)
     - the utility Resource drop
   - Each is mapped to one Sandcastles format. Insider access and Absurd real scene are added as candidates, since Krish's strongest bet per the playbook is Insider access.
   - The playbook is filed at `docs/research/2026-11-10-short-form-video-playbook.md` as an `observation` source, never taste proof.
   - Validated by the same script, which checks cross-references: every id it points at must exist in the bank, the formats, the devices and the hook playbook.

3. **Catalogue view he can see:** `scripts/video_styles.py render`, which writes one page per style:
   - the stills from the linked Inspiration cards (their 8 frames)
   - the measured grammar
   - what the style prevents
   - what is missing to make it buildable

   It goes to his Drive the agreed way, as files he opens. Claude artifacts are banned (AGENTS rule 3). The live picker on the Control Center board is step 2.

4. **Record and close out:**
   - `NOW.md` gets its single next action.
   - A `now-notes/` entry.
   - Commit on `claude/admiring-rubin-fghhvo`, `npm run verify`, push. The PR auto-merges.
   - The capability map and catalogue go to Krish with `SendUserFile`.

## Step 2 (after he reviews step 1; separate approval)

- **Fold the four style choices into one catalogue `style_id`,** signed in the narrative lock and shown on a CC **Style** press. This extends `/look` (`apps/control-plane/api/board/_handler.ts:230-271`) and the CC contract (`control-center/src/surfaces/content/board/contract.ts`), and fixes `api.ts:29`. These are paired changes per ADR-043.
- **Write scripts to the style,** and generate the storyboard from style plus script before recording.
- **File inspiration on the piece, at the moment it matters.** Krish, 2026-11-10: "My workflow never really lets me file my own inspiration and research against that post at the right time, and it go into a separate Google Drive folder."
  - Today a card can carry `piece_id`, but only after the file reaches the general Content Inspo or Production Inspo folders and he answers it on the Control Center Inspiration page.
  - Target: a drop point on each piece in Control Center (Story, Look and Storyboard steps) that files the link or file as that piece's inspiration, puts it in the right Drive folder, and sets `piece_id` and the style it teaches. The session making the piece then reads it first.
- **Inspiration House:** add `style_ids` and `teaches` on cards, read `facets.understanding`, and record `style_id` in `PRODUCTION_CHOICES` so the retro learns which style performs.
- **Cleanup proposals from synthesis G,** each put to Krish one at a time.

## Defaults I'm taking (say if wrong)

- A "style" is the full bundle. Captions and sound sit inside it, but default to the house look.
- The Sandcastles five formats are the top level, with the existing script and production formats beneath them.
- `TITLES_AFTER_RECORDING` stands: only thumbnail layout is decided before the script.

## Verification

- Run `python3 scripts/capabilities.py check` and `python3 scripts/video_styles.py check`. Both must pass, with every referenced path and id resolving.
- Re-verify each registry row against code. A fresh `reviewer` agent spot-checks 15 random rows.
- Run `npm run verify` green before the push.
- Krish opens the rendered catalogue pages. Nothing is called done until he has seen them.
