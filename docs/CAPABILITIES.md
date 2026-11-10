# Capabilities

Rendered from `config/capabilities.json` by `python3 scripts/capabilities.py --render`; edit the JSON, never this
file. Reference, not a state document: `NOW.md` and `docs/STATE.md` stay the only current-state documents.

Each capability says what it is for, the production stage it serves, when its choice is made today, its status,
and a keep, merge or retire proposal that is Krish's to decide.

## evidence

| Capability | For | Decided | Status | Proposal | Where | Overlaps |
|---|---|---|---|---|---|---|
| Inspiration tree collector (`inspo-collector`) | Every file in Content Inspo and Production Inspo becomes a 'likes' card | pre-script | working | keep | `inspirationhouse:src/collect/drive.ts` | content-watcher |
| Inspiration cards and tagger (`inspo-tagger`) | One card per file: kind, route, facets, frames, transcript | pre-script | working | keep | `inspirationhouse:src/tag/items.ts` | style-bank references |
| Understanding pass (`inspo-understanding`) | Measured production tags per liked clip: cut pace, camera moves, hook type, framing, speech pace | pre-script | working | keep | `inspirationhouse:src/tag/understand.ts` | quick-edit-reference-study |
| Signals vocabulary (`inspo-vocab`) | Fixed craft words for tagging cards | pre-script | working | merge | `inspirationhouse:src/signal/vocab.ts` | style-bank layers |
| ve study (`ve-study`) | Grammar card of one reference clip: cuts, pace, zooms, loudness, words per minute | pre-script | working | merge | `scripts/ve.py` | inspo-understanding |
| quick-edit reference study (`quick-edit-reference-study`) | Measures reference clips again for quick-edit | post-record | duplicate | retire | `scripts/quick-edit/references.py` | inspo-understanding |

## idea

| Capability | For | Decided | Status | Proposal | Where | Overlaps |
|---|---|---|---|---|---|---|
| Sunday inspiration block (`sunday-inspiration-block`) | Routed and liked cards feed the Sunday ideas run | pre-script | partial | keep | `apps/control-plane/api/_inspirationSources.ts` |  |
| Sunday per-idea style (`sunday-style-proposal`) | Each idea carries script, production and experiment format ids | pre-script | working | merge | `.agents/skills/plan-week/SKILL.md` | narrative-lock, look-step, pick-a-style |
| plan-week skill (`plan-week`) | Sunday ideas, picks, interview and narrative lock | pre-script | working | keep | `.agents/skills/plan-week/SKILL.md` |  |

## story

| Capability | For | Decided | Status | Proposal | Where | Overlaps |
|---|---|---|---|---|---|---|
| Narrative lock (`narrative-lock`) | Signed story with its style recipe and music bed | pre-script | working | keep | `.agents/skills/plan-week/references/sunday-room.md` | sunday-style-proposal |

## script

| Capability | For | Decided | Status | Proposal | Where | Overlaps |
|---|---|---|---|---|---|---|
| Script formats (`script-formats`) | 8 story shapes (head-to-head is the only one liked) | pre-script | partial | keep | `config/style-references.json` | editorial-formats |
| Editorial formats (`editorial-formats`) | Nine editorial formats used by drafting | pre-script | duplicate | merge | `apps/control-plane/api/_formats.ts` | script-formats |
| Length formats (`length-formats`) | 7 lengths from 15 seconds to 20 minutes, with word ceilings and shapes | pre-script | working | keep | `apps/control-plane/api/_video.ts` |  |
| Hook playbook (`hook-playbook`) | Hook formula per surface | pre-script | working | keep | `config/hook-playbook.json` | title-verdicts |
| make-piece skill (`make-piece`) | Scripts, storyboard, article, fact gate, publish page and pack for a picked piece | pre-record | working | keep | `.agents/skills/make-piece/SKILL.md` |  |
| Kill list (`kill-list`) | Words and moves never used | pre-record | working | keep | `vendor/makeyourmindup/kill-list` | copy-lint |
| Copy lint (`copy-lint`) | Word gate for every script and caption | pre-record | working | keep | `scripts/post-pack/copy_lint.py` | kill-list |

## direction

| Capability | For | Decided | Status | Proposal | Where | Overlaps |
|---|---|---|---|---|---|---|
| Style bank (`style-bank`) | 53 reusable modules in 11 layers (opening to motion); 52 untested | pre-script | partial | keep | `config/style-references.json` | techniques, devices |
| Techniques list (`techniques`) | Older list of production techniques | pre-script | duplicate | merge | `config/techniques.json` | style-bank |
| Production formats (`production-formats`) | 7 production treatments (face-with-proof is the only one liked) | pre-script | partial | keep | `config/style-references.json` | ve-formats |
| ve format files (`ve-formats`) | Five buildable formats with layers, devices, beats and QC | pre-record | partial | keep | `config/ve/formats` | production-formats |
| Production brief treatments (`production-brief`) | Treatments keyed on retired series | pre-record | broken | retire | `apps/control-plane/api/_productionBrief.ts` | ve-formats |
| Recipe: data-story Ladder (`ve-recipe-data-story`) | The one complete saved style, from the Mon 2 Nov cut | pre-script | working | keep | `config/ve/recipes/data-story.json` | video-styles |
| Video style catalogue (`video-styles`) | Complete styles (format, hook, length, visuals, motion, captions, sound) chosen before the script | pre-script | partial | keep | `config/video-styles.json` | style-bank, ve-formats, recipes |
| Golden frames (`golden-frames`) | Ten target frames for the design | pre-record | documented-only | keep | `config/ve/golden-frames.json` | design-lock |
| creative-direction.json (legacy) (`creative-direction-legacy`) | Per-beat picture, on-screen text and modules | pre-record | partial | merge | `scripts/post-pack/creative_direction.py` | ve-spec |
| ve spec v2 (`ve-spec`) | The one signed production spec for a ve cut | pre-record | working | keep | `packages/contracts/src/production-spec.ts` | creative-direction-legacy |
| ve init, lint and expect (`ve-init-lint-expect`) | Starts a spec, refuses bad specs, writes the expectations sheet | pre-record | working | keep | `scripts/velib/lint.py` |  |
| Storyboard (`storyboard`) | A mock frame per script line, signed before recording | pre-record | partial | keep | `.agents/skills/make-piece/SKILL.md` | creative-sheet |
| Creative sheet v4 (`creative-sheet`) | Subtitle, motion, idea, storyboard and thumbnail options on his take | post-record | partial | merge | `scripts/post-pack/board_v4.py` | storyboard |

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
| Studio V2 stations (`studio-v2`) | Job graph for 9:16 cuts | post-record | duplicate | retire | `docs/STUDIO.md` | produce-video, ve-cut |
| produce_day and the Sunday-night run (`produce-day`) | Scripted overnight cuts | post-record | partial | keep | `scripts/produce_day.py` |  |

## motion

| Capability | For | Decided | Status | Proposal | Where | Overlaps |
|---|---|---|---|---|---|---|
| Motion style bank (`motion-styles`) | One motion style per piece, from the motion layer | post-record | partial | keep | `apps/renderer/src/engine/kit/motion-profiles.json` | ve-styles |
| ve styles and Pick a style (`ve-styles`) | Mocks of the top motion styles on his take, then the Pick a style press | post-record | partial | merge | `scripts/ve.py` | video-styles |
| ve lab (`ve-lab`) | A reel of motion styles for comparison | any | working | keep | `docs/ve/lab` |  |

## artwork

| Capability | For | Decided | Status | Proposal | Where | Overlaps |
|---|---|---|---|---|---|---|
| Design lock and brand tokens (`design-lock`) | Grid, zones, type, colour and frozen key frames | pre-record | partial | keep | `config/ve/design-lock.json` | studio brand themes |
| Device library (`devices`) | The verbs FormatMaster draws (27) | pre-record | partial | keep | `config/ve/devices.json` | techniques |
| Codex cards (`codex-cards`) | Device and plate briefs Codex builds from | pre-record | partial | keep | `scripts/velib/cards.py` |  |

## sound

| Capability | For | Decided | Status | Proposal | Where | Overlaps |
|---|---|---|---|---|---|---|
| Music library ledger (`music-library`) | Approved tracks for beds (2 approved, 4 proposed) | pre-script | partial | keep | `config/music-library.json` |  |
| Music bed shape (`music-bed`) | One bed shape: loud open, steady under voice, louder end | any | working | keep | `config/music-bed.json` |  |
| Approved sound effects (`sfx-approved`) | Sound effects allowed in a cut | post-record | documented-only | keep | `config/sfx-approved.json` |  |

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
| ve qc, refs and Critic (`ve-qc`) | Mechanical checks, reference sheets and the non-producer Critic | post-cut | partial | keep | `scripts/ve.py` | quick-edit quality |
| channel_safe (`channel-safe`) | Platform UI safe zones, grid crop and account row | post-cut | partial | keep | `scripts/channel_safe.py` |  |

## filing

| Capability | For | Decided | Status | Proposal | Where | Overlaps |
|---|---|---|---|---|---|---|
| Archive, 3 Posts and the making record (`filing`) | Files each cut and records it on the piece | post-cut | working | keep | `scripts/post-pack/making.py` | ve file |

## board

| Capability | For | Decided | Status | Proposal | Where | Overlaps |
|---|---|---|---|---|---|---|
| Control Center Inspiration page (`cc-inspiration-page`) | Krish answers why he likes a card, routes it and sets trials | pre-script | working | keep | `control-center:src/components/inspiration` | board Inspiration tab |
| Board Look step (`look-step`) | Krish picks a production format; stored as meta.look | pre-script | partial | keep | `apps/control-plane/api/board/_handler.ts` | pick-a-style |
| Board production gates (`board-gates`) | Sign storyboard, Pick a style, Approve proof, Approve cut | any | partial | keep | `scripts/velib/gates.py` | cc-board |
| Control Center publish board (`cc-board`) | Krish's day tiles and presses; contract shared with the engine | any | partial | keep | `control-center:src/surfaces/content/board/contract.ts` | engine board page |

## feedback

| Capability | For | Decided | Status | Proposal | Where | Overlaps |
|---|---|---|---|---|---|---|
| Scores and Reject asset presses (`scores`) | Narrative and production scores per piece | post-publish | partial | keep | `docs/PUBLISH_BOARDS.md` | retro |
| Retro and production choices (`retro`) | Joins the choices made against the scores | post-publish | partial | keep | `inspirationhouse:src/retro/retro.ts` | scores |

## Totals

61 capabilities. Proposals: keep 49, merge 9, retire 3.
