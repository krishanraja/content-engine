# Video style before script: the decision-ready map

Read-only synthesis. Sources: the five area maps and the critic pass. I re-checked three things:
- The bank holds 18 entries in the motion layer.
- There are 5 format files in `config/ve/formats/`.
- The five Sandcastles format names appear in none of the three repos. The phrase "insider access" turns up only once, as an incidental tag in `docs/research/2026-10-14-viral-hooks-corpus.md:233`.

"Inferred" marks claims the maps reached by reasoning and did not verify.

---

## A) Capability inventory

Duplicates are merged into one row. The **Decided** column is relative to the script (pre-script, pre-record or post-record).

### A1. Idea and style evidence

| Name | Purpose | Decided | Location | Status | Overlaps |
|---|---|---|---|---|---|
| Inspiration tree collector | Drive Content Inspo and Production Inspo files become `likes` evidence | pre-script | inspirationhouse `src/collect/drive.ts`, `src/config.ts:48-75` | working (all schedules need `TASTE_ENABLED`) | content-watcher |
| Inspiration cards and tagger | One card per file: kind, route, video reason, facets, 8 frames, transcript | pre-script | inspirationhouse `src/tag/items.ts`, `watch.ts`, `kinds.ts` | working | `config/style-references.json` references |
| Understanding pass | Measured production tags: cut pace, moves, hook face/cut/words, framing, talk-led or sound-led, speech pace | pre-script | inspirationhouse `src/tag/understand.ts:24-55` | working, **no consumer** | `scripts/quick-edit/references.py` study (measures the same clips again) |
| Signals vocab | Fixed craft vocabulary (opening through stage_format) | pre-script | inspirationhouse `src/signal/vocab.ts` | working | style-references layers, `_cards.ts` ROLES |
| CC Inspiration page | Krish answers why_like, routes, trials (record_like_this, reskin, borrow_format) | pre-script | control-center `src/components/inspiration/`, `src/lib/inspirationTrials.ts` | working | board Inspiration tab (read-only) |
| Sunday inspiration block | Routed, liked and study_style cards feed `must_cover` | pre-script | `apps/control-plane/api/_inspirationSources.ts` | working; line 12 points to `config/styles.json`, which does not exist | |
| `ve study` | Grammar card of one reference: cuts, pace, zooms, LUFS, wpm | pre-script | `scripts/ve.py:1613` | working | understanding pass, `references.py` |
| Instagram workbook, voice folder | Context only, never taste proof | pre-script | inspirationhouse `src/collect/instagram.ts`, `voiceFolder.ts` | working | |

### A2. Style banks (what a catalogue would be built from)

| Name | Purpose | Decided | Location | Status | Overlaps |
|---|---|---|---|---|---|
| Style bank | 53 modules in 11 layers (18 motion) | pre-script | `config/style-references.json` bank | partial: 52 of 53 marked `untested` | `config/techniques.json` (19), `config/ve/devices.json` |
| Script formats | 8 story shapes; only head-to-head is liked | pre-script | style-references `formats.script` | partial | `_formats.ts:29` (nine editorial formats) |
| Production formats | 7 treatments; only face-with-proof is liked | pre-script | style-references `formats.production` | partial | `config/ve/formats/*.json` (5), `_productionBrief.ts:11` (keyed on retired series) |
| Divergence rules | Variety floor across the week | pre-script | style-references `formats.divergence` | working | |
| Recipes | Per-piece module mix | pre-script | style-references `recipes` (1 entry, stale, from 16 Oct) | partial | `config/ve/recipes/data-story.json` |
| ve recipe: data-story | The only near-complete whole style (from the Mon 2 Nov cut) | post-cut (saved) | `config/ve/recipes/data-story.json` | working | |
| Length formats | 7 lengths, from 15 s to 20 min | pre-script | `apps/control-plane/api/_video.ts:37` | working | |
| Hook playbook, title verdicts | Hook formula per surface | pre-script | `config/hook-playbook.json`, `config/title-verdicts.json` | working | |
| Golden frames | 10 target frames | pre-record | `config/ve/golden-frames.json` | **all slots empty** | |
| Brand tokens and design lock | Grid, zones, type, colour, 14 frozen key frames | pre-record | `config/ve/design-lock.json`, `brand-tokens.json` | partial: face-with-proof 16:9 still draft | `config/studio.json` brand_themes |

### A3. Story, script and pre-record direction

| Name | Purpose | Decided | Location | Status | Overlaps |
|---|---|---|---|---|---|
| Sunday per-idea style | `{script, production, experiment}` on each idea | pre-script (1st time) | `.agents/skills/plan-week/SKILL.md:300-318` | working | Look step, lock Style recipe |
| Narrative lock | Signed story plus Style recipe and Music bed | pre-script (2nd time) | `plan-week/references/sunday-room.md:37-78` | working | |
| Look step (`meta.look`) | Krish picks a production format | pre-script (3rd time) | engine `board/_view.ts:177-206`, `_handler.ts:230-269`; CC `Evidence.tsx:105-126` | partial: production formats only; CC sends `experiment:null, inspiration:[]` (`api.ts:29`) | |
| Music bed pick | From approved ledger tracks | pre-script | `config/music-library.json` | partial: 2 approved, 4 stuck at `proposed` | |
| Script and hook rules | Hook keyword shown on screen in beat 1 | pre-record | `make-piece/SKILL.md:242-334`, `references/hook-and-share.md:13-14` | working | |
| Kill list, copy lint, A/B/C read-back | Word gates | pre-record | `vendor/makeyourmindup/kill-list/`, `scripts/post-pack/copy_lint.py` | working | |
| Approve scripts, then Teleprompter | Sends words and duration only | pre-record | `_teleprompter.ts`, `teleprompter_send.py` | working | |
| creative-direction.json (legacy) | Per-beat picture, on-screen text, modules | pre-record, re-timed post | `docs/CREATIVE_DIRECTION.md`, `scripts/post-pack/creative_direction.py` | partial: last file is 2026-11-04 | ve spec v2 |
| ve spec v2 | One signed spec | pre-record, then cuts post | `packages/contracts/src/production-spec.ts:213-255`; real files are `docs/plans/*/ve/spec.json` (4 exist) | working | legacy CD, `creative.json` |
| `ve init`, `ve lint`, `ve expect` | References by card id, refusals, expectations sheet | pre-record | `scripts/ve.py:1590,1647,1689`; `scripts/velib/lint.py`, `expect.py` | working; init ranking cannot use `teaches` | |
| Storyboard | Mock frame per line | pre-record (on paper) | `make-piece/SKILL.md:484-486`; one file only: `docs/plans/2026-11-11-wednesday/storyboard.md` | partial: hand-authored, frames sit in scratchpad, no writer in `ve.py` | creative sheet |
| Visual gate cover | Working-headline cover and thumbnails | pre-record, redrawn post | `scripts/post-pack/visual_gate.py` | working | Titles round, creative sheet F |
| Routed clips | Inspiration card with a named slot (`show_with_sound`) | pre-record | `/api/content-ideas/[id]/routed-clips` | working | |

### A4. Motion, artwork and devices

| Name | Purpose | Decided | Location | Status | Overlaps |
|---|---|---|---|---|---|
| Motion style bank / `style.motion` | One motion style per piece | pre-record (proposed), post-record (picked) | style-references motion layer; `apps/renderer/src/engine/kit/motion-profiles.json` | partial: 10 drawable, 7 need a device, full-visual untested | |
| `ve styles`, `ve lab` | Mocks of the top 3 styles on a take; lab reel | post-record (or on his last take) | `scripts/ve.py:1684,1788`; `config/ve/style-distinct.json` | styles: mocked only. lab: working, no verdict yet | creative sheet motion loops |
| Device library | Verbs FormatMaster draws | pre-record | `config/ve/devices.json` (27; docs say 19 or 14) | partial | `techniques.json` |
| Codex cards, `ve brief` | Devices and plates built from cards | pre-record and post | `scripts/velib/cards.py`, `codex_lane.py`; `docs/ve/cards/*` | partial: many cards undispatched or in v2 to v4 iterations | |
| Keyframes pack, character | Full-visual style, 65 poses | pre-record | `config/ve/character*.json`, `docs/ve/sources/keyframes.md` | documented-only | |
| Motion standard | Signed floor | pre-record | `docs/ve/MOTION_STANDARD.md` | partial: safe zones advisory only | |
| Intro sting, outro | Series sting on 16:9, hook first on 9:16 | pre-record (approved) | `config/intro-sting.json`, `config/story-intro-outro.json` | working | |
| Video cards, kit.py | Pictures that cut in | post-record | `scripts/pages/video_card.py`, `scripts/quick-edit/kit.py` | working | |

### A5. Post-record making (three makers)

| Name | Purpose | Decided | Location | Status | Overlaps |
|---|---|---|---|---|---|
| produce-video and quick-edit | Live route; the only one carrying 16:9 plus music | post-record | `.agents/skills/produce-video/SKILL.md` (964 lines), `scripts/quick-edit/make.py` | partial: no word captions, no reference gate, ignores `style.motion` | ve, Studio |
| ve S3-S8 | eyeline, ingest, conform, compile, proof, render, qc, file | post-record | `scripts/ve.py`, `scripts/velib/*` | shadow only: nothing filed | quick-edit |
| Studio V2 stations | Job graph, 9:16 only | brief to package | `docs/STUDIO.md:281-306`, `.agents/skills/mindmake-video/` | duplicate | both of the above |
| `produce_day.py` / Sunday-night run | Scripted overnight cuts | post-record | `scripts/produce_day.py`, `produce-video/references/sunday-night.md` | partial: always stops at review evidence | |
| Take matching | Places takes on piece and cut | post-record | `scripts/post-pack/recording_match.py`, `recording.py` | working | Studio ingest |
| Titles round | Words for titles and thumbnails | post-record (by rule) | `make-piece/references/titles-round.md`, `title_check.py` | working | |
| Creative sheet (v4) | Subtitle, motion, idea, storyboard and thumbnail options on his take | post-record | `docs/PUBLISH_BOARDS.md:318-376`, `board_v4.py` | partial: schema drift | pre-record storyboard |
| Music shape, sfx, voice-ab | Bed shape and receipts | post-record | `config/music-bed.json`, `config/sfx-approved.json` (empty) | partial | |
| Thumbnails (The Receipt) | Wide and tall covers | post-record | `scripts/pages/build.py --thumbs` | partial | creative sheet F |

### A6. QC, feedback and handoff

| Name | Purpose | Decided | Location | Status | Overlaps |
|---|---|---|---|---|---|
| Floor, failures, learnings | Rejections and guards | read pre-script, checked post-cut | `config/rejection-floor.json`, `config/failures.json` (88), `config/learnings.json` (95) | partial: three overlapping stores | Studio learning |
| ve qc, Critic, refgate | Mechanical checks plus Critic score of 8/10 | post-cut | `scripts/velib/*`, `.claude/agents/ve-critic.md` | partial: uncalibrated | quick-edit `quality.py` |
| channel_safe | UI safe zones | post-cut | `scripts/channel_safe.py` | warns only on quick-edit | `velib/qc_channel.py` |
| Board production gates | Sign storyboard, Pick a style, Approve proof, Approve cut | pre-record to post-cut | `board/_presses.ts`, `velib/gates.py` | engine page only; deploy not verified | |
| Scores, Reject asset presses | piece_scores, taste_rejection_inbox | post-publish | `PUBLISH_BOARDS.md:178-179` | engine page only, waits on migration | inspirationhouse retro |
| Retro, `PRODUCTION_CHOICES` | Choice vs score | post-publish | inspirationhouse `src/retro/retro.ts`; `_making.ts:120` | partial: does not record format or style ids | |
| File and making record | archive, 3 Posts, making.py | post-cut | `archive.py`, `send.py`, `making.py` | working (quick-edit) | `ve file` (separate write) |

---

## B) Today's flow vs the target flow

**Today** (Sunday clock: `plan-week/SKILL.md:77-84`):
1. Ideas tab: style ids per idea. **Style choice #1.**
2. Five presses, then the interview, then the lock: Style recipe and Music bed. **#2.**
3. Board Look step: production format only, recorded as `meta.look`. **#3.**
4. make-piece writes the scripts. The only visual rule in play is the hook keyword on screen (`hook-and-share.md:13-14`).
5. Approve scripts sends them to Teleprompter (words only). The storyboard "reminds" and does not block (`make-piece/SKILL.md:426-429`). In the clock, about 30 minutes sits between script approval and recording.
6. Recording.
7. Post-record, in this order: the Titles press (thumbnail words, headings), the creative sheet on his take (subtitles, motion loops, the one idea, storyboard, thumbnails), `ve styles` and Pick a style (**#4**, the motion style), video cards, proof, render, Approve cut.

**Where choices are made late (named):**
- **Motion style:** picked after recording on his take (`ve/SKILL.md:14`), or on an older take of another piece (`ve.py cmd_styles`).
- **Caption look:** the module is named pre-record, but the options appear on his frames after recording (`PUBLISH_BOARDS.md:320-325`).
- **Storyboard:** the Sign storyboard press "unlocks Recording" (`PUBLISH_BOARDS.md:255`), yet the v4 sheet replaces it after recording. The Wed 11 Nov storyboard and mocks were built from the 10 Nov takes (`docs/plans/2026-11-11-wednesday/storyboard.md:3-6`, `motion-mocks.md`).
- **Thumbnail and cover words:** post-record by house rule `TITLES_AFTER_RECORDING`. Covers are drawn twice or three times.
- **Sound effects and the big-moment sound:** post-record, and the approved list is empty.
- **Hook visual:** only a keyword rule. No hook shot exists pre-script.
- **Length:** fixed per cut (5 min / 90 s), never chosen with the style.
- **Shot and capture list:** only if `creative-direction.json` gets written (`capture:`). Nothing visual reaches Teleprompter.

**Target flow:**
1. Ideas: each idea proposes **one catalogue style id** (format, hook pattern, length, visual system, motion, captions, sound), with evidence cards.
2. Lock: Krish signs the story **and** the style id. That makes one choice where today there are three.
3. **Style press on the CC board, before the script.** It shows the style's reel, its stills and its evidence cards. Krish picks or swaps; it writes `meta.look.style_id` plus his words.
4. Script is written **to the style**: hook pattern, beat count, on-screen text slots and length come from the entry.
5. Storyboard is generated from the style plus the script, with mocks rendered from **library footage of that format** (not this piece's take). Sign storyboard plus scripts in one press. Teleprompter gets the words and a shot/capture list.
6. Record.
7. Post-record keeps only take choice, proof of the hardest beat, title words (still post-record by rule unless Krish relaxes it) and final approval.

---

## C) Correction loops a pre-script style decision would have prevented

All of these are from `config/failures.json` (line numbers). Each was caught at review or after publish, and each needed prevention at style or storyboard time.

| Failure | Caught | What a pre-script style entry fixes |
|---|---|---|
| production-improvised-visuals (846) | review | The style supplies the visual system before the script |
| F01 weak-initial-visuals, F05 motion-decorated, F06 numbers-lost-meaning, F07 brand-tokens-not-brand (952-1132) | review | A hook shot plus motion point types (number, comparison and so on) bound to the style |
| F08 captions-mishandled (1158), F28 captions-on-his-face (1773), F42 caption-repeats-the-title (2253) | review / publish | The caption look plus safe-zone layout belong to the style |
| F19 mechanically-valid-design-rejected (1465) | proof | The style is seen as a reel before any build |
| F21 openings-did-not-land (1534), F24 below house intro/bed/outro (1645) | review | The opening pattern belongs to the style |
| F26 designed-without-its-references (1720), F31 no-single-visual-idea (1846), F35 type-treatments-multiplied (1972), F36 off-day-wore-series-dress (2009) | review | The entry carries its reference cards, one idea slot, one type treatment and a series or off-day scope |
| F30 designed-blind-to-the-channel (1807), F43 cover-cut-by-the-grid (2288) | publish | Channel and grid safe zones designed in at style time (today they only warn, `make.py:3029-3043`) |
| F44 evidence-too-small-to-read (2328) | Scores press | Minimum evidence size per style |
| F20 / F40 bed swung or pumped (1505, 2157) | review | Sound is part of the style (bed shape is already fixed; the track and sfx are not) |
| analogy-drawn-as-a-picture (579), F41 mark-off-its-words (2218) | script / publish | Motion rules travel with the style |
| Codex card iterations: thu-5-nov v1 to v4, fri-13-nov 5b/6b, w11 polish; props needing recompile (`STATUS.md:65-66`) | after the cut | Devices built ahead for the catalogue, not per piece |

**Pattern:** about 45 craft failures were nearly all caught at the end of the pipeline, and their guards were added to render/QC code, often on ve only. That means quick-edit, the live route, lacks the guards for F26, F28, F31, F35, F36, F41, F42 and F44 (inferred from the guard file lists).

---

## D) Style catalogue seeds

**What one catalogue entry needs:** id; name; Sandcastles format (one of five); script format; hook pattern (from the hook playbook); length(s); production format; visual system (layout, key frames); motion style; caption look; sound (track mood, bed, sfx); opening and close; devices needed; example reel or stills; evidence cards (inspiration_items ids); measured grammar (cuts per minute, wpm, framing); never-list; Krish verdict; performance.

| Field | Existing stock | Gap |
|---|---|---|
| Format | Sandcastles' five formats (Insider access, Absurd real scene, It's about you, Changed this week, Resource drop) | **Not in any repo.** No mapping exists to `_formats.ts` (9), `formats.script` (8) or `formats.production` (7) |
| Script / hook | `formats.script` (8), `hook-playbook.json`, `title-verdicts.json` | Only head-to-head is liked |
| Production / visual | `formats.production` (7), `config/ve/formats/*.json` (5), design lock (14 key frames) | No shared id; `_productionBrief.ts` is keyed on retired series |
| Motion | 18 motion modules, 10 drawable; lab reel `docs/ve/lab/2026-11-04.json` | 7 need devices; lab has no verdict |
| Captions | house / word, georgia build, `kinetic-serif-captions` | Word build not in quick-edit; pager bug held by freeze (`STATUS.md:51`) |
| Sound | 2 approved tracks, bed shape, sting | 4 tracks stuck at `proposed`; sfx empty; no mood-to-style map |
| Length | `_video.ts:37` (7 lengths) | Not linked to style |
| Whole-style template | `config/ve/recipes/data-story.json` (1) | The only one |
| Visual proof | lab reel, `docs/ve/cards/*/ref`, worked storyboards | Golden frames empty; mocks sit in scratchpads |
| Evidence | 10 references (8 with no likes), inspiration cards, understanding tags | No join from bank module to card; `teaches` never written |
| Performance | One postmortem week (`docs/learning/2026-11-07-week-of-2-nov-postmortem.md`) | `PRODUCTION_CHOICES` lacks format/style ids; no platform ingest |

**Suggested first entries** (each built from existing stock):
1. **face-with-proof × head-to-head**, the proven pair.
2. **data-story "Ladder"**, from the recipe file.
3. **voice-led-pictures**.
4. **scoreboard-test**.
5. **two-passports** (35 views; trial).
6. **utility carousel-to-reel "Resource drop"** (the best performer, about 50x, per the postmortem).

Map each to one Sandcastles format and leave the rest as candidates.

---

## E) Control Center alignment

**State today:** the CC contract has only `run`, `open`, `prompt`, `review`, `research` and `look` (`control-center/src/surfaces/content/board/contract.ts:16-22`). Every other choice opens the engine page: the Ideas five, Approve scripts, Sign storyboard, Pick a style, Approve/Reject proof, Approve cut, Sign creative, Scores, Reject asset and Titles. The CC board still sits behind `?ui=next` (ADR-043:54-55).

**Where the style pick and approvals should live on the CC day path:**

| Path step | CC press (new or extended) | Writes | Engine route |
|---|---|---|---|
| Ideas (Sunday) | five presses, with the proposed style id visible | `board_documents picks/<day>` | existing engine press, needs a contract kind |
| Story | Sign lock (style id inside the lock) | lock file | existing |
| **Look → "Style"** | Pick style from a catalogue grid (reel, stills, evidence cards); attach cards; experiment; his words | `meta.look {style_id, script, production, motion, captions, sound, inspiration[], experiment, krish_words}` | extend `/look` (`_handler.ts:230-271`, which already accepts experiment and inspiration); fix `api.ts:29` |
| Storyboard + script | One "Approve storyboard and scripts" press, bound to both sha256s | `approvals` + `meta.making.gates.storyboard` | new contract kind; drop the "reminds" path (`_view.ts:214-215`) |
| Record | (none) | | |
| Cut | Approve proof, Approve cut, Titles, Reject asset | `meta.making.gates.*`, `taste_rejection_inbox` | add contract kinds |
| Publish / Archive | Scores | `piece_scores` | add a kind once the migration is applied |

**Data path back to Claude:**
1. A press writes `content_ideas.meta` (one record, shared over CC realtime; ADR-031).
2. If the press advances the step, the engine fires the allow-listed `repository_dispatch` (make-piece / produce-day) carrying `piece_id`. This replaces the clipboard `prompt` actions (`Board.tsx:40-42`).
3. The session reads `meta.look` and the gates via `GET /api/content-ideas/<id>/making` (`velib/gates.py`).
4. Krish's words go to `report_to_taste_engine`.
5. Fix the Titles press so it starts the Sunday-night run (`produce-video/SKILL.md:196-200`).

**Media:** look mocks and storyboard frames must be filed as `mock` / `storyboard` media (`contract.ts:40`) so the Style press shows pictures, not a copied mock prompt (`_view.ts:206`).

**Paired-change rule:** `parseView` refuses the whole feed when any day mismatches (`contract.ts:113-117`), so every engine field change ships with its CC contract change (ADR-043:37-41).

---

## F) Inspiration House integration

1. **Card to style id.** Add `style_ids[]` (or `teaches` plus a style) to `inspiration_items`. Give the CC Inspiration page a control to set it: "this teaches look / motion / captions / hook / pacing / layout for style X". This fills the never-written `teaches` column (migration `20261122090000`; `_cards.ts:107-130`).
2. **Use the measured tags.** `facets.understanding` holds cut pace, moves, hook type, framing and speech pace. Rank candidates on it (`_cards.ts formatOf` ignores it today) and fill a style entry's "measured grammar" by aggregating the cards linked to it.
3. **One measurement.** Retire the `references.py` study for clips that already have `content_reads`, or write a crosswalk between `cuts_per_minute` numbers and the `fast_cutting` buckets.
4. **One taxonomy crosswalk** across style-references layers, the signals vocab (`src/signal/vocab.ts`) and `_cards` ROLES. Add the five Sandcastles formats as a `stage_format`-level facet.
5. **Card on the board.** The board Inspiration tab gets "use for this piece", which writes `meta.look.inspiration[]`. Align `velib/board.py:26` (3 roles) with `_cards.ts` (6 roles).
6. **Close the loop.** `card_uses` (Critic score, krish_verdict) plus `piece_scores` feed the style entry's performance and verdict. Record style id in `PRODUCTION_CHOICES` (`_making.ts:120`) so the retro can join it.
7. **Sandcastles data.** Import it as a source (filename hint or workbook collector), labelled `observation`, never as taste proof.
8. Fix the stale pointer at `_inspirationSources.ts:12` (`config/styles.json` should be `config/style-references.json`).

---

## G) Cleanup candidates

**Duplicates**
- Three video makers (quick-edit, ve, Studio V2) plus four skill entry points (produce-video, ve, video-engine launcher, mindmake-video).
- Five format taxonomies: `_formats.ts`, `_video.ts`, `_productionBrief.ts`, style-references formats, `config/ve/formats`.
- Two direction files: legacy `creative-direction.json` and ve `spec.json` (the docs call it creative-direction.json v2; the files are named `spec.json`).
- Pre-record storyboard and the post-record v4 creative sheet (`creative/0-draft`, `creative-sheet/0` and `creative/1` in the doc).
- Style chosen four times (Ideas, lock, Look, Pick a style).
- Covers drawn up to three times.
- Two measurement pipelines for Production Inspo clips.
- Four feedback stores: failures, learnings, rejection-floor, Studio learning.
- Two boards: the engine page and the CC board. Also CC `#/week` Pick, which writes only `content_ideas` (ADR-042:86-89).
- CC Video Studio reviewer (`src/components/video-studio`, behind a flag, last checked 16 Oct).
- `ve file` and `making.py video` are two writes for one handoff.

**Dead or broken**
- `ve stills` exits 2.
- `ve sprint` is broken by the brief adapter (`STATUS.md:64`).
- Golden frames, `sfx-approved` and `config/ve/sfx-kits` are empty or absent.
- `_productionBrief.ts` and `studio.json approved_treatments` are keyed on retired series.
- The only style-references recipe is stale (16 Oct).
- `board_v4.py:273` expects a storyboard "as ve wrote it", but no writer exists.
- `src/lib/publishBoard.ts:1-7` carries a stale comment.
- `docs/engineering/PUBLISH-BOARD-WEB.md` describes an undeployed branch.

**Stale counts or labels**
- Devices are given as 19, 14 or 27 (actual is 27).
- Motion styles are given as 17 (actual is 18).
- `MAKING_OWNERS` video still says `Codex` (`_making.ts:766` plus the CC mirror).
- Possible mislabel: `_copyLint.ts:124` lints the pinned comment as `video_onscreen` (inferred).
- `floor.py:56-57` still describes a missing floor, and says "eight nevers" against 14 blocking.

**Unclear owner**
- `config/ve/crew/*`.
- `what_i_like_sheet` (only an id in the repo).
- `reference-cuts.json` aims (draft, not approved).
- The engine minutes cap of 300 was set by a session, not Krish.
- Off-day video route.
- Growth handoff after "Approve for publish".

---

## H) Open questions for Krish

1. **One pick:** should the style be chosen once, as a catalogue id signed inside the narrative lock and shown on the CC Look step, with the Ideas, Look and Pick a style choices folded into it?
2. **What counts as a "style":** is it the full bundle (format, hook, length, visuals, motion, captions, sound), or do captions and sound stay house-fixed across styles?
3. **Sandcastles:** where does the playbook data live? It is in no repo. Should its five formats become the top level of the catalogue, with the existing script and production formats under them?
4. **Mocks before recording:** may style mocks use library footage or a past take of the same format, rather than this piece's take?
5. **Titles:** does `TITLES_AFTER_RECORDING` stand? If so, thumbnails stay post-record, and only layout is decided pre-script.
6. **Route:** is ve or quick-edit the route for the next piece, and when does quick-edit retire? Many guards exist only on ve.
7. **CC cutover:** may every press (Ideas five, scripts, storyboard, proof, cut, Titles, Scores, Reject) move into the CC contract, with the engine page kept as archive only, and `?ui=next` dropped?
8. **Clipboard prompts:** should a press dispatch Claude directly (repository_dispatch) instead of copying a prompt?
9. **Inspiration tagging:** will you tag cards with "teaches X for style Y" on the Inspiration page, or should the engine propose that as a labelled guess for you to confirm?
10. **Activation:** are `TASTE_ENABLED`, `REJECTIONS_ENABLED` and the pending migrations (piece_scores, `20261122090000`) on?
11. **Off-day music:** promote goodie-bags, aspire, illusions and be-alone from `proposed` to approved? Your approval words are already on file.
12. **Catalogue scope:** retire Studio V2 and its station skill?