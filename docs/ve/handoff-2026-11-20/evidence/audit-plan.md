# Video production: diagnosis and plan

Every finding below comes from reading `/home/user/content-engine` (main at f5ae967) and the three session transcripts. Nothing was edited. Hour figures are the sessions' own estimates. Several causes overlap, so the hours do not add up exactly.

## 1. Verdict in five lines

1. **The engine and its rules keep changing under a piece while it is in production.** Every engine fix needs a fresh typed approval, rules bind on the day a cut is shown, and the render cap reads a press as midnight. Cost: about 15 to 22 h across the three videos, roughly 5 to 7 h per video.
2. **Styles are combined with nothing to prove they work together, and lint contradicts compile.** Look, motion, captions and layout are picked separately. Cost: about 10 to 15 h, roughly 4 h per video.
3. **Facts the engine could measure are typed by hand or never asked for.** Examples: a vertical take on a 16:9 cut, a title on an off-day, assets and credits not ready at sign-off. Cost: about 11 + 6.5 + 4 h.
4. **QC rebuilds the renderer's geometry in its own copy and fails good cuts, and the same thing is checked 4 to 7 times.** Cost: about 7.5 h plus waiver rounds, and 61 pre-critic runs on one piece.
5. **Learnings live as prose or checklist rows, so the same faults come back.** Cost: about 3 h, but this is where most of Krish's anger comes from ("As I think I've told you 400,000 times").

Total: about 50 h across three videos, none publish-ready by its deadline, and about $200 of subscription spent on Tue 17 alone.

## 2. Per video

### Tue 17, "Where does AI get built when towns say no?" (piece b019dbf8)

- **What happened:** The session started a day after the publish date. It ran 14 renders over two days and two context compactions, and was not finished. The long render was killed at the 2-hour background limit. Krish moved the piece to Fri 20. No covers were made, nothing was filed, and he saw no finished cut.
- **Renders:** 14.
- **Top 3 failures:**
  1. **Captions and empty frames.** Art-directed captions jumped word to word on one-word pages, and no-face beats were black screens with only captions on them. Neither had ever been proven on a real take, and the plain-frame check only runs after render (`plainframes.py:64-97`).
  2. **Two visual styles over one point, then icons in the body.** The "NO ICONS" rule is only a checklist row, even though `failures.json:3714-3746` labels it `lint_refuse`. There was also an `off.day` tag on screen, which is checklist-only too.
  3. **Engine approvals and a title that was never planned.** He typed "approve the engine change" 5 times. `title_moment` is exempt on off-days (`lint.py:318-320`), and the wordmark was out of line with the title.
- **Krish's words:**
  - "They are really jolty, and each word moving from left to right is really hard to look at and stressful."
  - "we have a strict NO ICONS, ONLY THE WORDMARK DURING THE TITLE FRAME AND THE CLOSING FRAME"
  - "As I think I've told you 400,000 times, the word mark needs to be aligned with the title."
  - "you're burning all my Claude tokens on errors."

### Wed 18, "Build or Buy" (piece db9f9f6a)

- **What happened:** It took about 27 h. Both cuts rendered and were sent at about 19:16Z on 19 Nov, with QC still running and nothing filed. The article, thumbnail B and the titles were done.
- **Renders:** 10.
- **Top 3 failures:**
  1. **A vertical long take on a 16:9 cut, never declared in the spec.** About 600 min. `frame` is optional and typed by hand (`production-spec.ts:163-165`), and the guard binds only from 20 Nov.
  2. **The engine approval loop.** About 17 typed approvals, 13 of them recorded in `engine-exceptions.json`. Each one-line fix moves the hash of all of `apps/renderer/src` (`guards.py:308-322`, `:67-79`).
  3. **Rack-focus captions over a busy plate (four halo passes), then a title card rebuilt four times, then dull visuals.**
- **Krish's words:**
  - "why are you STILL USING THIS AS A REFERENCE I HAVE ASKED YOU SO MANY TIMES TO DELETE THIS". The rejected Thu 5 frames are still in `fixtures/ve/design-lock/rejected/`, and `failures.json:2730` still says `open`.
  - "I refuse to say 'approve engine' ever again."
  - "It's a boring topic, and you have accompanied it with boring visuals ... the visuals need to be 15/10"
  - "this has been the worst experience of my life"

### Fri 20, "AI Auditor" (piece c00cd4e0)

- **What happened:** It took about 11 h 15 m on top of a planning day. The short is rendering for a second time after the plain-frame guard refused the brand palette's own close card. The long was never proofed or rendered. 704 of 710 credits are spent. The changes are spread over PRs #928, #934, #936 and #940, and #940 is still open.
- **Renders:** 2 whole renders, about 10 proofs, and 61 `ve critic` runs.
- **Top 3 failures:**
  1. **Rules landed on the piece while it was in production.** The piece guards landed that morning (`piece-guards.json` `binds_from: 2026-11-20`, together with `bind_unshown`). The plain-frame guard then refused the palette close.
  2. **Caption geometry and OCR false failures led to waiver after waiver.** Tesseract cannot read the styled type (`qc_captions.py:222-227`), and the show gate blocks on `not_run` (`showgate.py:105-118`).
  3. **The vertical take again (pillar), and the pre-critic going stale on every edit** (`precritic.py:118-119`).
- **Krish's words:**
  - "fix all five, this is absolute madness"
  - "I'm amazed that you are coming to me with confirmation of any of this stuff ... taking 2 days to render a fucking word properly."
  - "I pressed it 5 times"

## 3. His hypotheses, answered

**Caption and motion style coupling: partly.** The real fault is that captions and motion are decoupled with no compatibility proof.

- `docs/ve/INGREDIENTS.md:16` allows any of 27 caption styles over any motion style.
- 21 of 23 motion entries are `untested` in `config/style-references.json`, and there is one recipe on disk (`config/ve/recipes/data-story.json`).
- Lint and compile disagree. `lint.py:248-250` forces `brand.captions='word'` on face-with-proof, while `compile.py:634` turns word mode off as soon as a style is picked. As a result, `captions.steady` (`lint.py:221-237`) measures pages that are never drawn.
- Every week's caption clash (art-directed jolt, rack-focus over a plate, SPLIT echo words) was found on his take, during production.

**The brief: partly.** About 35 to 40% of the hours were removable at or before sign-off, but only by facts the engine measures and presets it enforces. More prose would not have caught them.

- "Both takes are vertical" was in the prompt and never reached the spec.
- Off-day titles were exempt.
- Missing article, logo bounds, music file and Higgsfield share were never checked at `ve expect`.
- Taste calls ("jolty", "head bottom right", "15/10") cannot be specified in a field. Only proven presets prevent them.

**Missing machinery or skills: yes.** Each item below is something a session did by hand:

- Nothing writes a take's frame at ingest.
- There is no proven-combination table.
- There is no spec generator. The Fri 20 piece needed a 267-line `make_spec.py` and its own `keepcut.py`.
- `ve pin` only prints a command (`ve.py:2027-2045`).
- The renderer does not record the boxes it drew.
- `ve stills` is a stub (`ve.py:2574`), and so is `ve assets plan`.
- The overnight `repair`, `final` and `gates` steps are null (`config/overnight.json:33-35`).

**Conflicting or erroneous engine parts: yes, and this is the biggest cause.**

- **Two rules contradict F33's "rules never change in flight":**
  - `bind_unshown.enabled: true` (`showgate.py:63-74`);
  - plain-frames, which has no `binds_from`.
- **Bugs:**
  - `guards.py:375-379` reads a date-only approval as midnight, so a press made later in the day does not count.
  - QC keeps four hand copies of renderer geometry: `qc_faces.py:44-61`, `qc_captions.py:36-40`, plain-frames `art_directed`, and `qc_channel.py:22-40`.
- **Contradictions between docs and code:**
  - Four post-record routes exist: overnight, produce-video, the production plan and the ve runbook.
  - Short-cut length is stated four different ways.
  - Whisper timing (`edit_pass.py`) is used against forced alignment, which RUNBOOK requires.
  - Speed-up happens automatically (`PRODUCTION_PLAN.md:25-30`) while another doc says only with his words (`produce-video/SKILL.md:765-768`).

**Standards too low: no on paper, partly on screen.** The written bar is high and growing: 23 checklist rows and about 3,600 lines of QC. The creative bar was missed ("It's a 5/10, it just pulses 3 logos") because each piece invents its look from untested parts. Raising the written bar again would add checks without adding quality. Proven presets that already meet the bar would.

**Learnings not learnt: yes, for the ones kept as prose.**

- "No icons" is labelled `lint_refuse` but is a checklist row, and nothing before render refuses `logo_card`.
- The rejected Thu 5 stills are still on disk.
- The wordmark-alignment failure entry is not on main (0 matches in `failures.json`).
- The `off.day` tag is a checklist row only.

The learnings that became code (title QC, halo for every style, the aspire licence) did hold.

**Circular checks: yes.**

- **The same question is asked many times over:**
  - spoken words against the script: 7 checks;
  - hook-first opening: 6 places;
  - restarts: 4 tools;
  - one cut: up to 5 visual critics;
  - preflight: 5 to 8 runs per piece, each about 386 KB of output.
- **Gates that duplicate each other:** the engine-freeze gate at proof (`ve.py:2078`) duplicates the proof's own `engine_sha256` comparison (`proof.py:426-480`).
- **Gates that invalidate each other:** the pre-critic binds the whole spec, so changing an audio target voids it. That is how one piece reached 61 runs.
- **Checks that fail the engine's own output:** QC fails the renderer's own captions, and the plain-frame guard refuses the palette's own close card.

## 4. The target pipeline

### Krish's presses per piece, after ideas triage

**Now:**

- 13 required presses:
  1. sign the lock;
  2. production picks;
  3. sign storyboard;
  4. approve scripts;
  5. record;
  6. drop the takes;
  7. "My takes are in";
  8. Titles;
  9. copy and paste the production prompt;
  10. Pick a style;
  11. Approve proof;
  12. Approve cut;
  13. thumbnail pick.
- Then cover pick, Approve for publish and Publish: **16**.
- Up to about 12 conditional extras: Maxine spend, credits, SFX, music, clip sound, speed-up, voice, headshot, plan swaps, fetch items, mock reviews, "for his ear" lines.
- On top of those, the sessions above added approvals, waivers and repeated presses: 5, about 17 and about 9 ("I pressed it 5 times").
- **In practice: 30 to 45 actions per piece.**

**Target: 6 presses and the recording.**

1. **Sign the lock**, with a recipe picked from the proven list and one credit ceiling for the whole piece (Maxine and generation included).
2. **Approve scripts and storyboard**, one press.
3. **Record.** Dropping the file is detected, so "takes are in" goes.
4. **Approve proof** for both cuts on one screen, with the title pick on the same screen.
5. **Approve final**: the cuts, the thumbnail and cover picks, and the manifest seal.
6. **Publish.**

The production prompt copy and paste goes, because the plan starts the production session itself.

### What becomes deterministic

- **Take frame:** `ve ingest` probes it, `frame` becomes required, and a 16:9 cut on a vertical take defaults to `pillar` (`compile.py:795`).
- **Title spans:** derived from the script's title words.
- **The spec:** a `ve spec` verb builds it from `plan.json`.
- **Caption, title and device boxes:** written by the renderer for QC to read.
- **The rules hash:** frozen at `ve expect`.
- **The pinned commit:** proof and render use it by themselves.
- **Approvals:** carry a full timestamp.

### What becomes a locked preset

- **Style recipe:** look, motion, captions, layout and transition, from a proven list. Anything new is a named experiment proven before sign-off.
- **Title lockup:** the Wed 11 `title_full` (`config/brand-palette.json:23`).
- **Palette close.**
- **Credit ceiling.**

### Checks merged or deleted

- **Delete:**
  - `captions.word_default` (`lint.py:248-250`);
  - the proof-time engine gate (`ve.py:2078`), so render requires the approved proof's engine sha;
  - the four QC geometry copies.
- **Make advisory:** OCR for picked styles. The words are checked from the compiled props instead.
- **Rebind:** the pre-critic to `structural_hash` (`proof.py:267`).
- **Run fewer times:**
  - preflight once per piece, with the receipt reused;
  - hook-first at lint plus one QC row;
  - words against the script by `ve said` and `ve receipt` only;
  - one Opus critic on the cut.

### The single pre-render gate

It sits at `ve expect`, straight after Sign storyboard. It refuses to start the render unless all of these hold:

- the spec lints clean on the frozen rules;
- the recipe is on the proven list;
- every take has a measured frame;
- every no-face beat has a plate or a backdrop;
- the title is planned whenever there is a title line;
- no body logo appears where the palette forbids one;
- no `off.day` text appears on screen;
- no reference path sits under `rejected/`;
- named beds and logo bounds are staged;
- the credit share reserves in a dry run;
- `ve doctor` finds tesseract, cv2 and torch.

After the gate, the only checks are QC on the render, reading the renderer's own boxes.

## 5. The work, in order, as small pull requests

### Freeze rule for engine changes during an in-flight piece

- Once `ve expect` records the engine and rules hashes, that piece proofs and renders only on its pinned commit.
- A fix made during the piece merges to main for the next piece.
- It reaches the current piece only when Krish has given that piece a standing `engine-follows-main` approval, or when `houseGolden.test.ts` proves the fix changes nothing else.
- No session asks him to approve a hash.

### PR 0. Land or close what is stranded

- **Files:** #940 (plain-frame skips the palette close), the `title-wordmark-not-aligned-with-title` failure entry, and the Tue 17 frame-seek clamp (`qc_faces.py:84-89`).
- **Removes:** fixes that exist only on branches.
- **Test:** the existing tests for each on main, plus a fixture frame at `durationFrames-1` that returns a frame and not `not_run`.

### PR 1. Approval timestamps

- **Files:** `guards.py:375-405`, `packages/contracts/src/production-spec.ts` (an `at` field on approvals).
- **Removes:** renders refused after a same-day press.
- **Test:** a render at 09:00 followed by a press at 15:00 lets two more renders through.

### PR 2. Delete the dead caption lint

- **Files:** `lint.py:248-250`, and `lint.py:221-237` limited to cuts with no picked style.
- **Removes:** the lint and compile contradiction.
- **Test:** a face-with-proof spec with a picked style lints clean, and the compile golden is unchanged.

### PR 3. Pre-critic bound to structure

- **Files:** `precritic.py:36-38`, `:118-119`.
- **Removes:** reruns caused by counter, crop and audio edits.
- **Test:** editing `audio.targets` keeps the verdict, and editing a beat makes it stale.

### PR 4. Take frame measured

- **Files:** `ve ingest` (`takes.py` or `conform.py`), `production-spec.ts:163-165` (required on takes), and `compile.py` (pillar by default).
- **Removes:** typed frames and the vertical-take failure.
- **Test:** a 9:16 fixture take on a 16:9 cut compiles to pillar with no hand-typed frame.

### PR 5. Pin by default, one engine gate

- **Files:** `ve.py:2027-2045` (proof and render run in the pinned worktree), `ve.py:2078` (delete), `ve.py:1899` (render requires the engine sha of the approved proof), `guards.py:67-79` (`engine-follows-main` scope).
- **Removes:** the `engine-exceptions.json` loop.
- **Test:** change a renderer file on main mid-piece. Proof and render pass on the pin with no approval asked.

### PR 6. Rules frozen at sign-off (after Krish's ruling, question 1)

- **Files:** `guards.freeze` (adds the rules hash covering `lint.py`, `piece_guards.py`, `config/ve/*.json`, `brand-palette.json`), `showgate.py:63-74` (binds by the freeze date), `config/ve/show-gate.json`, `config/ve/plain-frames.json` (`binds_from`).
- **Removes:** rules arriving mid-piece.
- **Test:** a guard dated after the freeze does not bind the piece, and does bind a piece frozen after it.

### PR 7. Pre-render lints, part 1

- **Files:** `piece_guards.py` (no-face beat needs a plate or backdrop; full-frame devices exempt), `lint.py:306-336` (`title_moment` whenever a `title_line` exists), and `qc_frames.py:407-454` moved into lint (the lockup check reads props only).
- **Removes:** black bands and title faults found after render.
- **Test:** one refusing fixture and one passing fixture for each lint.

### PR 8. Pre-render lints, part 2

- **Files:** a lint refusing `brand.references` under `rejected/`; delete `fixtures/ve/design-lock/rejected/tall-1..4.jpg` (calibration tests repointed, `design-lock.json:78`); a compile refusal of `off.day` as on-screen text; a body `logo_card` refusal per Krish's ruling (question 2), from `compile._body_logo`.
- **Removes:** three learnings that live only as prose.
- **Test:** fixtures for each, and `failures.json` statuses moved to the guard that now refuses each one.

### PR 9. Proven recipes

- **Files:** extend `scripts/audit-caption-steady.ts` to render phrase pages per style over three backgrounds (his face, a busy plate, a SPLIT band); `config/ve/recipes/` gets the proven list; `lint.py` gets a `style.proven` lint that refuses any combination off the list unless the spec says `experiment: true`.
- **Removes:** style clashes found during production.
- **Test:** an unlisted triple is refused, a listed one passes, and an experiment passes with a warning.

### PR 10. QC reads the renderer's own boxes

- **Files:** the renderer writes a sidecar of drawn boxes per page, title and device; `qc_captions.py`, `qc_faces.py`, `plainframes.py` and `qc_channel.py` read it; the four copies and the `art_directed` mirror test go; OCR becomes advisory for picked styles; `ve doctor` refuses when a QC tool is missing.
- **Removes:** false failures and waivers.
- **Test:** an art-directed fixture cut passes QC with OCR switched off, and a deliberately offset box fails.

### PR 11. Prerequisites at `ve expect`

- **Files:** `ve.py` (`expect`) and `ve doctor`.
- **Removes:** missing beds, logo bounds and credit shares found mid-piece.
- **Test:** each missing item is refused by name.

### PR 12. One route after recording, docs reconciled

- **Files:**
  - `config/overnight.json`;
  - `produce-video/SKILL.md`;
  - `PRODUCTION_PLAN.md`;
  - `RUNBOOK.md`;
  - `motion-designer/SKILL.md:24-25`;
  - `config/short-cuts.json`;
  - `story_check.py:34`;
  - `make-piece/SKILL.md:216`;
  - `edit_pass.py` (forced alignment, and speed-up only with his words);
  - preflight run once per piece.
- **Removes:** four routes and about 16 doc conflicts.
- **Test:** `npm run skills:validate` passes, and a doc-consistency test reads the short length and reader count from `_houseRules.ts` and `making.py` only.

### PR 13. `ve spec` from `plan.json`

- **Files:** `scripts/ve.py`, `scripts/velib/`.
- **Removes:** per-piece `make_spec.py` and `keepcut.py` generators. `check_route.py` stops grandfathering them.
- **Test:** the Fri 20 plan produces a spec that lints and compiles identically to the hand-built one.

### PR 14 (control-center). Merge the board presses

- **Files:** control-center `_presses.ts`, `_takesIn.ts`, and the board's press model.
- **Change:** scripts and storyboard become one press; titles join the proof screen; thumbnail, cover and the seal join the final press; dropping the takes is detected.
- **Removes:** ten of the sixteen presses.
- **Test:** an e2e of one piece from lock to Publish counts exactly 6 presses.

## 6. What to ask Krish to decide

1. **Should rules stop binding a piece at Sign storyboard?** His "yes to all 3" turned on `bind_unshown`, which applies every new rule to any cut not yet shown. That is what made Fri 20's guards land mid-piece. The proposal is to freeze the rules at sign-off and apply a new rule from the next piece.
2. **Do company logo cards count as icons under "NO ICONS, ONLY THE WORDMARK"?** Wed 18's `logos` guard improves them, and Tue 17 treated them as a breach. The lint in PR 8 needs one answer.
3. **Should styles be locked to proven recipes?** A recipe is a look, motion, captions and layout combination already rendered on a real take with his yes. Anything new would run as a named experiment proven before he signs, never during production.