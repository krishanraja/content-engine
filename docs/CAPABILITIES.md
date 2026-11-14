# Capabilities

Rendered from `config/capabilities.json` by `python3 scripts/capabilities.py --render`; edit the JSON, never this
file. Reference, not a state document: `NOW.md` and `docs/STATE.md` stay the only current-state documents.

Each capability says what it is for, the production stage it serves, when its choice is made today, its status,
and a keep, merge or retire proposal that is Krish's to decide.

## evidence

| Capability | For | Decided | Status | Proposal | Where | Overlaps |
|---|---|---|---|---|---|---|
| Inspiration tree collector (`inspo-collector`) | Every file in Content Inspo and Production Inspo becomes a 'likes' card | pre-script | working | keep | `inspirationhouse:src/collect/drive.ts` |  |
| Inspiration cards and tagger (`inspo-tagger`) | One card per file: kind, route, facets, frames, transcript | pre-script | working | keep | `inspirationhouse:src/tag/items.ts` | style-bank |
| Understanding pass (`inspo-understanding`) | Measured production tags per liked clip: cut pace, camera moves, hook type, framing, speech pace | pre-script | working | keep | `inspirationhouse:src/tag/understand.ts` | quick-edit-reference-study |
| Signals vocabulary (`inspo-vocab`) | Fixed craft words for tagging cards | pre-script | working | merge | `inspirationhouse:src/signal/vocab.ts` | style-bank |
| Inspiration filed against a piece (`piece-inspiration`) | A card can name the piece it is research for, but only after the file is dropped in the general inspiration Drive folders and answered on the Inspiration page; there is no way to file inspiration or research on the piece itself while it is being made (Krish, 2026-11-10) | pre-script | partial | keep | `control-center:src/components/inspiration` | cc-inspiration-page, inspo-collector |
| ve study (`ve-study`) | Grammar card of one reference clip: cuts, pace, zooms, loudness, words per minute | pre-script | working | keep | `scripts/ve.py` | quick-edit-reference-study |
| Reference library (references.py) (`quick-edit-reference-study`) | The shared reference measurement and transport library (publish, fetch, study) under ve study and the reference gate | pre-script | working | keep | `scripts/quick-edit/references.py` | ve-study |

## idea

| Capability | For | Decided | Status | Proposal | Where | Overlaps |
|---|---|---|---|---|---|---|
| Sunday inspiration block (`sunday-inspiration-block`) | Routed and liked cards feed the Sunday ideas run | pre-script | partial | keep | `apps/control-plane/api/_inspirationSources.ts` |  |
| Sunday per-idea style (`sunday-style-proposal`) | Each idea carries script, production and experiment format ids | pre-script | working | merge | `.agents/skills/plan-week/SKILL.md` | narrative-lock, look-step, ve-styles |
| plan-week skill (`plan-week`) | Sunday ideas, picks, interview and narrative lock | pre-script | working | keep | `.agents/skills/plan-week/SKILL.md` |  |

## story

| Capability | For | Decided | Status | Proposal | Where | Overlaps |
|---|---|---|---|---|---|---|
| Narrative lock (`narrative-lock`) | Signed story with its style recipe and music bed | pre-script | working | keep | `.agents/skills/plan-week/references/sunday-room.md` | sunday-style-proposal |

## script

| Capability | For | Decided | Status | Proposal | Where | Overlaps |
|---|---|---|---|---|---|---|
| Script formats (`script-formats`) | 8 story shapes (head-to-head is the only one liked) | pre-script | partial | keep | `config/style-references.json` | editorial-formats |
| Editorial formats (`editorial-formats`) | Nine slate formats used by judging, week options and drafting | pre-script | working | decide | `apps/control-plane/api/_formats.ts` | script-formats |
| Length formats (`length-formats`) | 7 lengths from 15 seconds to 20 minutes, with word ceilings and shapes | pre-script | working | keep | `apps/control-plane/api/_video.ts` |  |
| Hook playbook (`hook-playbook`) | Hook formula per surface | pre-script | working | keep | `config/hook-playbook.json` | title-verdicts |
| make-piece skill (`make-piece`) | Scripts, storyboard, article, fact gate, publish page and pack for a picked piece | pre-record | working | keep | `.agents/skills/make-piece/SKILL.md` |  |
| Kill list (`kill-list`) | Words and moves never used | pre-record | working | keep | `vendor/makeyourmindup/kill-list` | copy-lint |
| Copy lint (`copy-lint`) | Word gate for every script and caption | pre-record | working | keep | `scripts/post-pack/copy_lint.py` | kill-list |

## direction

| Capability | For | Decided | Status | Proposal | Where | Overlaps |
|---|---|---|---|---|---|---|
| Style bank (`style-bank`) | 53 reusable modules in 11 layers (opening to motion); 52 untested | pre-script | partial | keep | `config/style-references.json` | techniques, devices |
| Technique registry (`techniques`) | The Studio runner's technique registry and the renderer's device adapter map | pre-script | working | decide | `config/techniques.json` | style-bank, devices, studio-v2 |
| Production formats (`production-formats`) | 7 production treatments (face-with-proof is the only one liked) | pre-script | partial | keep | `config/style-references.json` | ve-formats |
| ve format files (`ve-formats`) | Five buildable formats with layers, devices, beats and QC | pre-record | partial | keep | `config/ve/formats` | production-formats |
| Production brief treatments (`production-brief`) | Production approval hash and the brief bridge from a routed piece to a Studio job; editorial formats by series (live subchannels plus the retired pair) | pre-record | partial | keep | `apps/control-plane/api/_productionBrief.ts` | ve-formats |
| Recipe: data-story Ladder (`ve-recipe-data-story`) | The one complete saved style, from the Mon 2 Nov cut | pre-script | working | keep | `config/ve/recipes/data-story.json` | video-styles |
| Style catalogue and the style lab (`video-styles`) | Looks only, each a full style folder (essence, rendering, colour, type, motion, layout, sound, native moves, demo film on the house test script), picked separately from the story format and the moves. Five of the twelve are built in the style lab and render whole cuts tall and wide on his take (The Ladder, The Living Screen, The Evidence Desk, Swiss Kinetic Type, Dark Keynote); a style reaches ve through a bank entry, Codex cards and a device | pre-script | partial | keep | `lab/styles/README.md` | style-bank, ve-recipe-data-story, motion-styles |
| Golden frames (`golden-frames`) | 5 to 10 moments Krish names from Production Inspo that the Critic ranks against; none named yet | pre-record | partial | keep | `config/ve/golden-frames.json` | design-lock |
| creative-direction.json (legacy) (`creative-direction-legacy`) | Per-beat picture, on-screen text and modules | pre-record | partial | merge | `scripts/post-pack/creative_direction.py` | ve-spec |
| ve spec v2 (`ve-spec`) | The one signed production spec for a ve cut | pre-record | working | keep | `packages/contracts/src/production-spec.ts` | creative-direction-legacy |
| ve init, lint and expect (`ve-init-lint-expect`) | Starts a spec, refuses bad specs, writes the expectations sheet | pre-record | working | keep | `scripts/velib/lint.py` |  |
| Storyboard (`storyboard`) | A mock frame per script line, signed before recording | pre-record | partial | keep | `.agents/skills/make-piece/SKILL.md` | creative-sheet |
| Creative sheet v4 (`creative-sheet`) | Subtitle, motion, idea, storyboard and thumbnail options on his take | post-record | partial | merge | `apps/control-plane/api/board/_presses.ts` | storyboard |

## pre-record

| Capability | For | Decided | Status | Proposal | Where | Overlaps |
|---|---|---|---|---|---|---|
| Teleprompter send (`teleprompter-send`) | Sends approved script words to teleprompter.com | pre-record | working | keep | `scripts/post-pack/teleprompter_send.py` |  |

## ingest

| Capability | For | Decided | Status | Proposal | Where | Overlaps |
|---|---|---|---|---|---|---|
| Take matching (`take-matching`) | Places each recorded take on its piece and cut | post-record | working | keep | `scripts/post-pack/recording_match.py` |  |

## cut

| Capability | For | Decided | Status | Proposal | Where | Overlaps |
|---|---|---|---|---|---|---|
| produce-video and quick-edit (`produce-video`) | The live route: takes to 16:9 and 9:16 cuts with music and thumbnails | post-record | partial | keep | `scripts/quick-edit/make.py` | ve-cut, studio-v2 |
| ve S3 to S8 (`ve-cut`) | Eyeline, ingest, conform, compile, proof, render, QC, file | post-record | partial | keep | `scripts/ve.py` | produce-video |
| Studio V2 stations (`studio-v2`) | Job-based Studio: 9:16 cuts, carousels, hash-bound approval gates and the mindmake-studio MCP stations | post-record | working | decide | `packages/core/src/runner.ts` | produce-video, ve-cut |
| produce_day and the Sunday-night run (`produce-day`) | Scripted overnight cuts | post-record | partial | keep | `scripts/produce_day.py` |  |

## motion

| Capability | For | Decided | Status | Proposal | Where | Overlaps |
|---|---|---|---|---|---|---|
| Motion style bank (`motion-styles`) | One motion style per piece, from the motion layer; apps/renderer/src/engine/kit/motion-profiles.json says how each is drawn, and a style whose device is not built yet (needs_device: The Ladder, The Living Screen and seven more) renders in house motion until its card lands | pre-record | partial | keep | `config/style-references.json` | ve-styles |
| ve styles and Pick a style (`ve-styles`) | Mocks of the top motion styles on his take, then the Pick a style press | post-record | partial | merge | `scripts/ve.py` | video-styles, motion-styles |
| ve lab (`ve-lab`) | A reel of motion styles for comparison | any | working | keep | `docs/ve/lab` |  |
| Moves library (`lab-moves`) | The house moves (count on a part, street drop, live chart, freeze-circle-magnify and the rest), each a deterministic draw from t, kept once in packages/moves (@mymu/moves) and imported by the style lab and ve; lab/moves keeps the gallery, the check and re-exports | pre-record | working | keep | `packages/moves/README.md` | video-styles |

## artwork

| Capability | For | Decided | Status | Proposal | Where | Overlaps |
|---|---|---|---|---|---|---|
| Design lock and brand tokens (`design-lock`) | Grid, zones, type, colour and frozen key frames | pre-record | partial | keep | `config/ve/design-lock.json` |  |
| Device library (`devices`) | The verbs FormatMaster draws (27) | pre-record | partial | keep | `config/ve/devices.json` | techniques |
| Codex cards (`codex-cards`) | Device and plate briefs Codex builds from | pre-record | partial | keep | `scripts/velib/cards.py` |  |

## captions

| Capability | For | Decided | Status | Proposal | Where | Overlaps |
|---|---|---|---|---|---|---|
| Caption styles (`caption-styles`) | Fifteen caption styles a spec picks with brand.caption_theme (art-directed, his pick; cinematic, Audrey's system; thirteen house rebuilds), drawn from ve's caption pages in the house faces and tokens inside every channel's safe area; proved on stills, not yet on his take | pre-record | partial | keep | `apps/renderer/src/engine/captions/themes.tsx` |  |

## sound

| Capability | For | Decided | Status | Proposal | Where | Overlaps |
|---|---|---|---|---|---|---|
| Music library ledger (`music-library`) | Approved tracks for beds (2 approved, 4 proposed) | pre-script | partial | keep | `config/music-library.json` |  |
| Music bed shape (`music-bed`) | One bed shape: loud open, steady under voice, louder end | any | working | keep | `config/music-bed.json` |  |
| Approved sound effects (`sfx-approved`) | The gate that refuses any sound not listed by id and sha256; the set is empty until Krish approves sounds by ear | post-record | partial | keep | `config/sfx-approved.json` |  |

## cover

| Capability | For | Decided | Status | Proposal | Where | Overlaps |
|---|---|---|---|---|---|---|
| Title verdicts (`title-verdicts`) | Krish's verdicts on titles | post-record | working | keep | `config/title-verdicts.json` | hook-playbook |
| Visual gate cover (`visual-gate`) | Working-headline cover and thumbnails | pre-record | working | merge | `scripts/post-pack/visual_gate.py` | thumbnails, creative-sheet |
| Titles round (`titles-round`) | Words for titles and thumbnails, after recording | post-record | working | keep | `scripts/post-pack/title_check.py` |  |
| Thumbnails (The Receipt) (`thumbnails`) | Wide and tall covers | post-record | partial | keep | `scripts/pages/build.py` | visual-gate |

## qc

| Capability | For | Decided | Status | Proposal | Where | Overlaps |
|---|---|---|---|---|---|---|
| Rejection floor (`floor`) | What Krish rejected and the standards nothing falls beneath | any | working | keep | `scripts/floor.py` | failures, learnings |
| Failures register (`failures`) | Every failure and its guard | any | working | keep | `config/failures.json` | floor, learnings |
| Learnings register (`learnings`) | Say nothing twice | any | working | keep | `config/learnings.json` | failures |
| ve qc, refs and Critic (`ve-qc`) | Mechanical checks, reference sheets and the non-producer Critic | post-cut | partial | keep | `scripts/ve.py` |  |
| channel_safe (`channel-safe`) | Platform UI safe zones, grid crop and account row. Since 11 Nov 2026 every tall template uses the whole safe screen (key content from y 280, x 60 to 860, captions above y 1320); ve qc counts the row and quick-edit holds a caption band under a channel's buttons | post-cut | working | keep | `scripts/channel_safe.py` |  |

## filing

| Capability | For | Decided | Status | Proposal | Where | Overlaps |
|---|---|---|---|---|---|---|
| Archive, 3 Posts and the making record (`filing`) | Files each cut and records it on the piece | post-cut | working | keep | `scripts/post-pack/making.py` |  |
| Publication watcher and catalogue (`publication-watch`) | Hourly, reads the Substack archive and the @makeyourmind-up YouTube feed, matches each upload to its piece and records it; GET /api/publish/catalogue serves every published piece with its video, Short and thumbnail to makeyourmindup.ai, which updates by itself | post-publish | working | keep | `apps/control-plane/api/publish/watch.ts` |  |

## board

| Capability | For | Decided | Status | Proposal | Where | Overlaps |
|---|---|---|---|---|---|---|
| Control Center Inspiration page (`cc-inspiration-page`) | Krish answers why he likes a card, routes it and sets trials | pre-script | working | keep | `control-center:src/components/inspiration` |  |
| Board Look step (`look-step`) | Krish picks a production format; stored as meta.look | pre-script | partial | keep | `apps/control-plane/api/board/_handler.ts` | ve-styles |
| Board production gates (`board-gates`) | Sign storyboard, Pick a style, Approve proof, Approve cut | any | partial | keep | `scripts/velib/gates.py` | cc-board |
| Control Center publish board (`cc-board`) | Krish's day tiles and presses; contract shared with the engine | any | partial | keep | `control-center:src/surfaces/content/board/contract.ts` | board-gates |

## feedback

| Capability | For | Decided | Status | Proposal | Where | Overlaps |
|---|---|---|---|---|---|---|
| Scores and Reject asset presses (`scores`) | Narrative and production scores per piece | post-publish | partial | keep | `docs/PUBLISH_BOARDS.md` | retro |
| Retro and production choices (`retro`) | Joins the choices made against the scores | post-publish | partial | keep | `inspirationhouse:src/retro/retro.ts` | scores |

## Totals

65 capabilities. Proposals: keep 56, merge 6, retire 0, decide 3.
