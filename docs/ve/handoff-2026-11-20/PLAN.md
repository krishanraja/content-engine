# Video production: one-shot pipeline plan

## Context

All three of this week's videos missed their deadlines: Tue 17 "AI Midterms" (b019dbf8, 14 renders, unfinished), Wed 18 "Build or Buy" (db9f9f6a, ~27 h, 10 renders, still fixing after the critic) and Fri 20 "AI Auditor" (c00cd4e0, 61 critic runs, the long cut never rendered). Together that is about 50 h of session time and 30 to 45 actions from Krish per piece. It moves the North Star (U4: 3 of 12 assets this week) and the horizon's "under an hour a week deciding".

The audit (workflow wf_197b0305-684: 9 agents, transcripts plus code, each root cause checked by a sceptical verifier; full report at scratchpad/plan.md) ranks the causes:
1. **Engine and rules change under an in-flight piece** (~5 to 7 h per video). `bind_unshown` applies new rules to unshown cuts (`showgate.py:63-74`). Every renderer fix moves the whole `apps/renderer/src` hash and needs a typed approval (`guards.py:67-79`, `:308-322`): about 17 on Wed 18 alone. A date-only approval is read as midnight (`guards.py:375-379`).
2. **Styles combined with no compatibility proof** (~4 h per video). There are 27 caption styles over 14 motion styles (`docs/ve/INGREDIENTS.md`), 21 of 23 motion entries are untested, and only one recipe exists. Lint forces word captions (`lint.py:248-250`) that compile turns off (`compile.py:634`).
3. **Facts typed by hand, or never checked before render.** Vertical takes on 16:9 (`production-spec.ts:163-165`; ~10 h on Wed 18), off-day titles exempt (`lint.py:318-320`), and beds, logo bounds and credits not checked at `ve expect`.
4. **Checks after render, duplicated, and failing the engine's own output.** QC keeps four hand copies of the renderer's geometry, OCR can't read styled type, the plain-frame guard refused the palette close, the pre-critic is bound to the whole spec (61 runs), and words-vs-script is checked 7 times. The 18 Nov screenshots show the same pattern: deterministic faults (15 to 20 px type, a cropped headline, "395312") found by a post-render critic that lacked motion strips and couldn't see the recorded approvals.
5. **Learnings kept as prose come back.** "No icons" is labelled `lint_refuse` but is only a checklist row, the rejected Thu 5 stills are still in `fixtures/ve/design-lock/rejected/`, and `off.day` text is checklist-only. Learnings that became code held.

Hypotheses answered:
- **Caption/motion coupling:** partly. The fault is decoupling with no proof.
- **The brief:** partly. ~35 to 40% of the hours were removable at sign-off, by measured facts, not more prose.
- **Missing machinery:** yes. No take-frame probe, no `ve spec`, a stub `ve stills`, null overnight steps.
- **Conflicting parts:** yes, the biggest cause. Four post-record routes, four short lengths.
- **Standards too low:** no on paper, but each piece invents its look from untested parts.
- **Learnings:** yes, where they are prose.
- **Circular checks:** yes.

## Rulings to record (Krish, 2026-11-19, in the acting commit bodies)
- **Rules and engine freeze at Sign storyboard.** A new rule or fix binds from the next piece. `bind_unshown` goes.
- **Third-party logo cards are allowed as evidence inside a sourced card.** Our own mark and icon appear only on the title frame and the close.
- **The style menu is proven recipes plus one named experiment slot.** An experiment must be proven on a real take before Sign storyboard. This narrows the 13 Nov decoupling ruling at the menu; the decoupling stays in the code.
- **The tall close is the 9:16 intro sting** (artifact FnDVNoCk1CqxGKTHRYENKH) with "Built to help you decide." layered on. This supersedes "sting_held_as_outro" as retired (`config/brand-palette.json:173`).

## No approvals during production (Krish, 2026-11-19, rejecting the first draft)
His words: "We need to eliminate the 4 million approvals like this that I'm required to make. It basically means I have to sit there for 7 hours waiting for the next stupid fucking approval to give and the engine refuses to move on."

The rule: between Sign storyboard and the final review, the engine never stops to wait for him. Every approval the sessions asked for this week is removed by one of these:

| Approval asked this week | How it goes |
|---|---|
| "approve the engine change" / hash approvals (5 + ~17 + ~9) | Pin at `ve expect` (PR 5). A fix lands for the next piece, or follows main automatically when the house golden test passes. Never asked. |
| New rule binding mid-piece | Rules freeze at storyboard (PR 6). Never asked. |
| Waivers for QC/OCR false failures | QC reads the renderer's boxes (PR 10). A check that fails on the engine's own output is a bug to log, not an ask. |
| Spend: credits, Maxine, generation, SFX, music | One credit ceiling signed at the lock covers the piece. The engine spends inside it with no ask and stops only at the ceiling. |
| Approve proof (blocking) | Becomes a non-blocking preview. The engine goes straight on to the final render; he can look at the proof but never has to. |
| Titles, thumbnail, cover, speed-up, voice, plan swaps, "for his ear" lines | The engine takes the recipe's default and records it. Every such choice lands as one line on the final review screen, where he can change any of it in one press. |
| Critic opinions (taste, "doesn't carry the idea") | A deterministic floor failure is fixed automatically. A model-critic opinion never blocks: it shows as a note on the final screen. Whole-piece creative calls are made at storyboard. |
| "final approve long 746e5208" / "final approve short 1849930a" typed in chat before a file may be filed | **Filing to his own post folder needs no approval at all**: it is not publishing. `ve file` files every finished cut as soon as QC passes (the validation receipt drops its `krish_final` requirement), so he reviews files already sitting in Drive. His one final Approve press on the board, bound to the file shas, gates publishing only. |
| "Marginal" findings raised anyway (music 3.4 vs 3.0 LU) | A deterministic limit is either fixed automatically by the engine (re-run the mix with the bed ducked) or, if within a stated tolerance, passed silently. Never reported as a question. |

**Enforcement, so it doesn't drift back:**
- New `config/ve/asks.json` lists the only allowed asks: lock, scripts+storyboard, final, publish. A guard refuses any session path that writes a blocking question to the board between storyboard and final (control-center `_waiting.ts` source check plus a content-engine test).
- The make-piece, ve and produce-video skills get one rule: decide, record, carry on; anything for Krish goes on the final screen. `validate-skills.py` fails a skill that tells a session to wait for an approval mid-production.
- The canon requires approval immediately before spend and publish. The lock-time credit ceiling and the final Approve satisfy that; record them as `Ruling (Krish, 2026-11-19)`.

## Quality floor: a 0/10 cut never reaches Krish again (Krish, 2026-11-19)
His words: "they are so poor that I can't even bring myself to publish them ... Visually, motion, post-production, and everything is a zero out of ten. I'm going to need you to make sure that this can never happen again."

**Evidence.** On the rejected long (Drive 14jVQ2d…, 9 s), `ve pace` measured:
- 2.21 events/s against his references' 2.87 to 4.6;
- 5% of the frame active against 10% to 100%;
- BELOW EVERY REFERENCE on both.

The picture was his take in a pillar on the right, about two thirds of the frame a blurred dark filler, one-word grey captions in a corner, and two flat mint stat bars. `ve pace` is written to "flag, never refuse" (`docs/ve/INGREDIENTS.md`, THE_BAR). Since 13 Nov the engine's own doc has said "the graphics layer is now the gap". The sessions said themselves that "the look stayed fundamentally the same, and fixing it piece by piece was the wrong approach".

**The floor (wave 1b, before any other wave):**
1. **Pace floor blocks.** `ve status` can never compute READY, and `ve file` and the board can never show a cut, when any `ve pace` metric is BELOW EVERY REFERENCE in `config/ve/pace-references.json`. This is a floor, not a target, so it keeps THE_BAR's intent: rates never decide quality upward, but the bottom of his own references is the minimum.
2. **No dead panel.** In a staged layout (pillar, band, stage, tray), the panel beside his take must carry content (a device, a plate, a figure) on every beat. A blurred filler or backdrop alone for more than 1.5 s is refused before render (lint, from the spec) and after render (QC row).
3. **Overall judge, blind, against his references.** One judge scores the cut out of 10 beside frames and motion strips of his kept references and his three best cuts, without being told which is which. Below 8 the cut is held, never shown.
4. **Held means rebuild, never patch.** A held cut is not fixed beat by beat. The session re-renders once on a proven recipe (a stronger one if it was already on one). If that is still held, Krish gets one line ("held: below the floor, rebuilt on recipe X") and the slot falls back. A 0/10 file never lands in his post folder.
6. **Nothing is ever drawn over his face** (Krish, 19 Nov, short.mp4 1tisLlVT…: "the card generates over my face, the captions are awful, and the generated animations are tacky and not art directed well within the space at all").
   - At ingest, compile reads the take's face track (`track-face.py` / `velib/qc_faces.py`) and writes a face keep-out box per beat into the props.
   - Lint refuses any card, device, plate or caption whose drawn box meets it before render. The renderer's own boxes (PR 10) prove it after render.
   - Today the face check runs only after render and has failed open.
7. **Captions and generated animation come only from the recipe.**
   - No free caption pick. Generated plates and devices are drawn only inside the recipe's grid slots, at its type scale and palette.
   - A generated animation that is not a named slot in the recipe is refused.
   - Generation is off unless the recipe names it.
5. **Recipes are rated before use.** A recipe joins the menu only after Krish rates its golden cut at 9 or more. The current default staging and caption combination is taken off the menu until rebuilt to that bar. Wave 3's Athletic depth recipe is the first candidate.

## Target: 4 presses plus the recording
1. **Sign the lock.** Pick a recipe from the proven list and set one credit ceiling.
2. **Approve scripts and storyboard**, as one press.
   - Then he records. Dropping the file is detected, and production runs unattended to the end.
3. **Approve final.** One screen holds:
   - both cuts and the article;
   - the title, thumbnail and cover the engine chose, each changeable in one press;
   - critic notes;
   - the seal, bound to the file sha.
4. **Publish.**

There is one pre-render gate at `ve expect`. After it, only QC runs, reading the renderer's own boxes.

## Work, in order (content-engine unless marked; small PRs, auto-merge on green)
- **Freeze rule, from PR 0 onwards:** a piece proofs and renders on the commit pinned at `ve expect`. Fixes reach it only under a standing `engine-follows-main` approval or with a passing `houseGolden.test.ts`. No session asks him to approve a hash.

| # | Change | Key files | Proof test |
|---|---|---|---|
| 0 | Land the stranded fixes: #940 (plain-frame skips the palette close), the wordmark-alignment failure entry, the Tue 17 frame-seek clamp | `qc_faces.py:84-89`, `config/failures.json` | existing tests; fixture at `durationFrames-1` returns a frame |
| 1 | Approval timestamps | `guards.py:375-405`, `packages/contracts/src/production-spec.ts` | 09:00 render, 15:00 press, two more renders pass |
| 2 | Delete the dead caption lint | `lint.py:248-250`, `:221-237` | picked style + face-with-proof lints clean; golden unchanged |
| 3 | Pre-critic bound to structure | `precritic.py:36-38`, `:118-119` | audio edit keeps the verdict; beat edit makes it stale |
| 4 | Take frame measured at ingest; 16:9 on a vertical take defaults to pillar | `ve ingest`, `production-spec.ts:163-165`, `compile.py:795` | 9:16 fixture on a 16:9 cut gives pillar |
| 5 | Pin by default, one engine gate | `ve.py:2027-2045`, delete `:2078`, `:1899`, `guards.py:67-79` | renderer change on main mid-piece: no approval asked |
| 6 | Rules frozen at storyboard (ruling 1) | `guards.freeze`, `showgate.py:63-74`, `config/ve/show-gate.json`, `plain-frames.json` | guard dated after the freeze does not bind |
| 7 | Pre-render lints 1: no-face beat needs a plate; `title_moment` whenever a title line exists; lockup check moved into lint | `piece_guards.py`, `lint.py:306-336`, `qc_frames.py:407-454` | refuse/pass fixture each |
| 8 | Pre-render lints 2: refs under `rejected/` refused and the stills deleted; `off.day` text refused; own mark/icon in the body refused (ruling 2); type-size floor, figure formatting and headline-crop from props (the 18 Nov faults) | `lint.py`, `compile._body_logo`, `design-lock.json:78`, `failures.json` | fixtures; failures entries point at their guard |
| 9 | Proven recipes and the experiment slot (ruling 3): render phrase pages per recipe over a face, a busy plate and a SPLIT band; `style.proven` lint | `scripts/audit-caption-steady.ts`, `config/ve/recipes/`, `lint.py` | unlisted combination refused; experiment unproven at storyboard refused |
| 10 | QC reads the renderer's drawn boxes; the four geometry copies go; OCR advisory for picked styles; `ve doctor` refuses missing QC tools | renderer sidecar, `qc_captions.py`, `qc_faces.py`, `plainframes.py`, `qc_channel.py` | art-directed fixture passes with OCR off; offset box fails |
| 11 | `ve expect` prerequisites: beds, logo bounds, credit dry-run, article, matte availability | `ve.py expect`, `ve doctor` | each missing item refused by name |
| 12 | One route after recording; docs reconciled; forced alignment; speed-up only with his words; preflight once per piece | `config/overnight.json`, `produce-video/SKILL.md`, `PRODUCTION_PLAN.md`, `RUNBOOK.md`, `edit_pass.py`, `config/short-cuts.json` | `npm run skills:validate`; doc-consistency test |
| 13 | `ve spec` builds the spec from `plan.json` | `scripts/ve.py`, `scripts/velib/` | Fri 20 plan gives an identical spec |
| 14 | One close, one renderer: the tall close becomes the intro sting with the tagline; palette entry updated; one tagline constant | `config/brand-palette.json:141,173`, `EndingBand.tsx`, `velib/compile.py:27`, `quick-edit/kit.py:156` (retire `page_endcard` for ve) | brand_palette guard passes; close ≤ 2 s; golden at 9:16 per series |
| 15 | Athletic "depth" recipe: prove `velib/matte.py` on one real take (hair/hands), then a recipe with words behind the subject, small chest-height captions, staggered numeral chapter cards, label-over-figure and ticking-counter callouts, hard wide/medium cuts. Built as Codex device cards. | `scripts/velib/matte.py`, `config/ve/recipes/`, device cards | matte edge review with Krish's yes; recipe golden at both ratios |
| 16 | control-center: merge the board presses to 4; proof becomes a preview; final screen carries every default with one-press change; final approval bound to file sha; drop detected | control-center `_presses.ts`, `_takesIn.ts`, `_waiting.ts`, board press model | e2e lock to Publish = 4 presses, 0 mid-production asks |
| 17a | Filing ungated: the validation receipt stops requiring `krish_final` to file to the post folder; the Approve press gates publish only; loudness over limit triggers an automatic re-mix | `ve file` / validation receipt (`scripts/velib/` receipt + filing), `config/video-validation.json`, mix step | test: a QC-passed cut files with no Krish field; publish still refuses without the board Approve |
| 17 | No-ask guard: `config/ve/asks.json`; skills rewritten to decide-record-continue; credit ceiling spent without asking; validate-skills refuses mid-production waits | `config/ve/asks.json`, `.agents/skills/{make-piece,ve,produce-video,motion-designer,thumbnail-designer}/SKILL.md`, `scripts/validate-skills.py`, credit reserve path | test: a piece run from storyboard to final writes 0 board questions |

**PR 16 constraint (Krish, 2026-11-19): "the board UI is stable. The data pipeline is stable as well."** PR 16 changes only which presses exist and what the final review screen carries. It reuses the rebuilt UI's kit (`kit/Sheet`, `kit/Segments`, the one list, the one gate) and adds no new surface or data path. For the final review screen and the four-step piece path, it draws from his UI inspiration folder (Drive folder id 1ylI3_g4gSFqW_Qm038i92vKiCDLidqeN), read at build time:
- `stepper.txt` for the lock → storyboard → final → publish path;
- `attachment-states.txt` and `cards-filing.txt` for the cut, thumbnail and cover tiles with their filed state;
- `accordion.txt` and `cards-accordion.txt` for the "defaults the engine chose" lines;
- `side drawer.txt` and `modal.txt`, only where they map onto the existing kit forms.

PR 17 goes in alongside PR 5 so the no-ask rule binds next week's pieces. PRs 0 to 6 are first: they stop the bleeding for next week's pieces. 7 to 11 move the checks before the render. 12 to 16 cut presses and add quality.

## Verification
- Each PR: `npm run verify:quick` plus its named test. Merge via auto-merge on green.
- **End to end:** run next week's first piece through the new route and count Krish's presses, typed approvals, renders and wall-clock from lock to publish-ready. Target: 4 presses, 0 typed approvals, 0 mid-production asks, ≤ 2 whole renders per cut, publish-ready by its date. Record it in a `now-notes/` closeout and update the North Star line.
- Record each ruling once in its acting commit, and send his exact words to `report_to_taste_engine` (taste reports are exempt from the wall).

## Not in scope / guards
- No intervention in the three running sessions.
- No publishing, no spend beyond the piece credit ceiling.
- The North Star is unchanged.
