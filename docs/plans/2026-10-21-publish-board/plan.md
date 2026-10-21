# Publish board: one fixed layout the engine feeds, built for Krish's week

## Context

Krish (21 Oct 2026): the board at content.krishraja.com "is pretty good but quite inconsistent. For each publish session things move around." He wants the board's look and behaviour standardised and locked, so that the engine only feeds it. It also needs to fit his week: fresh ideas on Sunday, a visible queue, record-ready briefs agreed the night before, draft scripts and article each morning with good commenting and inline editing, changes carried across and learned from, a clear publish run-sheet, and a real phone layout. Claude and Codex must feed the board without changing its UI.

**North Star moved:** "Krish spends under an hour a week deciding". Every decision gets one predictable place, on his phone too. Carrying changes across and learning from them moves "every piece at 10/10".

### What the audit found (both live weeks downloaded read-only and rendered at 1280px and 390px)

- **No phone layout.** `week_board/page.html` has no viewport meta, so phones render a 980px desktop page shrunk down. The result is tiny tabs and buttons next to huge body text (screenshots are in the scratchpad `live/`). The `web.js` week switcher and comment dialog use inline styles that ignore the design tokens.
- **Layout moves every session.** Each day's section order differs. For example, Mon 12 Oct runs Finished videos, Record, Covers, Checklist, Scripts, while Mon 19 Oct runs Publishing files, Article+covers, Finished video files, … Finished videos, Record, Checklist, Scripts. Several things let a session inject markup:
  - `--day` publish pages are inlined almost verbatim, each with its own CSS (`week_board.py:252, 1063`).
  - `--keep`/`--previous` carry old panels over byte for byte.
  - `board_materials` sections are free text.
  - One-off scripts string-patch the built HTML (`docs/plans/2026-10-19-week/update_wednesday.py`, `docs/plans/2026-10-19-monday/build_release_board.py`).
- **Inconsistent labels.** `STEPS` says "3-minute" while `publish_kit` says "5-minute". Wednesday's review tab is headed "Publishing files and copy" but holds a private evidence pack.
- **No Queue tab.** "From your queue" is squeezed into each Ideas day.
- **No consolidation.** `content-ideas/cluster.ts` and `synthesize.ts` exist, but nothing runs them on queued ideas.
- **No automatic gather of the week's ideas.** plan-week hand-writes `ideas.json`.
- **No brief stage and no deadlines.** There is no record-ready stage with day deadlines. `make-piece`'s Narrative step is the closest. The narrative beats asked for in `docs/prompts/sunday-ideas-tab.md` were never built.
- **Editing is weak.** Each box is a raw-Markdown `<textarea>` (`# headings` visible), with small Save and Comment buttons. Comments anchor to the nearest `[id]`, so you can't comment on a sentence.
- **Edits aren't carried across or learned from.** Edits are applied by hand to one box. Nothing carries a change to the other cut, the article or later pieces. Board edits never reach `content_edit_events`, so the compiler (`learning/compile.ts`, `_patterns.ts`) never sees them.
- **Nothing guards the UI.** No hook or check protects `week_board.py`, its templates or tokens. Tokens are duplicated (`publish_manager.py:101`, `publish_kit.py:179`).

### Krish's decisions (21 Oct, via question)

- The new layout starts with the week of 26 Oct (Sunday 25 Oct). The weeks of 12 and 19 Oct stay as they are.
- Carrying changes across: apply the change everywhere in the piece and in later drafts, show "also changed in…" with undo, and make a standing rule only when he approves it.
- His taste steers idea sourcing and ranking only. The judges stay blind.
- Order: (1) frame, phone layout and lock, (2) Ideas and Queue for Sunday 25 Oct, (3) Drafts editing and learning, (4) Publish run-sheet.

## The design: one fixed layout

A **week document** (typed JSON) is the only thing the engine supplies. The **renderer** owns every pixel. Nothing appears or moves unless the schema has a slot for it. Empty slots show a fixed placeholder saying when the content arrives, never a missing section.

**Top tabs** (always these five, always in this order; a bottom tab bar on phones):
`Ideas` · `Queue` · `Mon` · `Wed` · `Fri`. Each day tab shows its series, its state chip and the next deadline.

**Day sub-tabs** (always these four, in this order; a sticky segmented control):

1. **Brief**, due the night before the morning drafts. Krish agrees it with a tap or a comment. Fields:
   - the idea
   - narrative flow (4 to 5 beats)
   - the ending
   - the takeaway
   - angle
   - tone
   - who it's for
   - deadline: Mon's brief by Sun night, Wed's by Tue night, Fri's by Thu night, from `config/board-layout.json` → `rhythm`.
2. **Drafts**, there on the morning of the day. Holds the article, the long script and the short script. Each draft:
   - reads as clean text, not Markdown
   - is edited by tapping a paragraph
   - takes a comment on a highlighted passage
   - has a sticky bar saying "3 unsaved changes · Save".

   Below the drafts are an "Also changed in…" panel and a "What I learned from your edits" panel.
3. **Record**: the Teleprompter status, the takes placed, and the finished cuts.
4. **Publish**: one ordered run-sheet. Each step is a card with the same parts: what to download, what to copy (one tap), where to post, a link field, and a tick. The order and the channels come from one config file.

Overlays such as review holds and private evidence packs become typed slots (`notices[]`, `private_files[]`) with fixed placement, never new headed sections.

**Ideas tab (Sunday).** For each day: the "From your queue" fits, then the fresh ideas. Each card has the same fields:
- so-what and story
- why now
- strongest checked fact and its source
- **where it came from** (Control Center, Drive inspo, or the engine)
- **why it's here**: the preference evidence, e.g. "like your 'Story' verdict on X"
- a 4 to 5 beat narrative sketch
- the pick and triage controls

**Queue tab.** All queued ideas grouped by series, with his verdict, angle or reason, and age. On top sit **"Could combine"** cards: two to five queued ideas that thread into one bigger, higher-level piece, each with a proposed thesis and the beats that join them. He taps Combine, and the engine runs `synthesize` on his word only. Dropping or unqueueing works as it does today.

## Implementation, in Krish's order

### PR 1: contract, renderer, phone layout, lock (before Sunday 25 Oct)

- `config/board-layout.json`: tab and sub-tab order, labels, `rhythm` deadlines, the publish run-sheet (channels, order, counted vs optional, the copy fields per channel). It replaces the `STEPS`, `SECTION_STEP` and `DROPPED_CHANNELS` constants and fixes the 3-minute/5-minute mismatch. `publish_kit.steps()` reads it as well.
- **Cuts** (Krish, 21 Oct: "all videos are generally 90 sec and 5 min. From time to time I might do a special 15 min feature"):
  - `cuts` in `board-layout.json` has `short` (90 s, 9:16) and `long` (5 min, 16:9) on every day, plus an optional `feature` (15 min, 16:9) that appears only when Krish has called a feature for that piece.
  - Every board label (Record, Publish, Finished videos, Teleprompter) comes from `cuts`, so no hand-written "3-minute" or "deep cut" text survives.
  - The tick keys stay `record-long` and `record-short`. A feature adds `record-feature`.
  - **The weekly deep cut is retired (Krish, 21 Oct, via question: "Yes, replace it").**
    - House rule `DEEP_CUT` in `apps/control-plane/api/_houseRules.ts` becomes a retired rule. A new `FEATURE` rule replaces it: about 15 minutes, 2,025 to 2,475 spoken words (the 5-minute cut's pace × 3), wide, made only when Krish calls it for a piece.
    - plan-week step 6b (the "Propose the week's deep cut" step), `config/deep-cuts.json`, `story_check.py --cut deep`, `making.py` `deep_piece` and the deep-cut notes in `publish_kit.py` move to `feature`. Past deep-cut records stay readable.
    - The house rule edit goes through taste-guard, so Krish approves it in person at that moment.
    - Add a `config/learnings.json` entry (`two-cuts-and-an-occasional-feature`) with his words and markers in the house rule, `board-layout.json` and plan-week.
    - Commit body: `Ruling (Krish, 2026-10-21): every piece is a 90-second and a 5-minute video; a 15-minute feature only when he calls one; the weekly deep cut is retired.`
- `packages/contracts/src/board.ts` (Zod) plus a JSON Schema for the **week document**: `week`, `ideas[]`, `queue[]`, `combine[]`, and per day `{state, piece_id, brief, drafts[], record, publish, notices[], private_files[]}`. `board_materials` sections map onto typed publish/file slots.
- **Renderer**: refactor `scripts/post-pack/week_board.py` so `board()` renders only from the week document through fixed component functions:
  - Reuse `ideas_panel`, `triage_row`, `queue_block`, `videos_card`, `record_card`, `checklist` and `review_card`, but restyle them and give them fixed slots.
  - Remove the HTML-inlining paths for new weeks: `--day` page bodies, `--keep` verbatim panels, per-page CSS appends.
  - The publish page's content (`publish_manager.page()`) becomes data for the Publish sub-tab. The article becomes `drafts[]` and copy blocks.
  - Legacy weeks keep rendering from their stored builds unchanged (`board_builds` is immutable).
- **Design system**: one token file, `scripts/post-pack/week_board/tokens.css` (mint/ink/paper palette, Anton/Archivo/Plex Mono), used by the board, `publish_manager` and `publish_kit`. `web.js` drops its inline styles in favour of classes.
- **Phone layout**: added to `page.html` and `week.css`:
  - the viewport meta
  - a 16px gutter
  - a fixed type scale (no 30px body text)
  - 44px tap targets
  - a bottom tab bar
  - a sticky sub-tab control
  - comments in a bottom sheet
  - download and copy buttons at full width
- **The lock**:
  - `week_board.verify()` refuses any build whose tab or sub-tab order, slot set or class vocabulary differs from `board-layout.json`. It also refuses any `data-act` or section outside the schema.
  - `publish-web` runs it as today.
  - New hook `.claude/hooks/board-ui-guard.mjs`, registered in `.claude/settings.json`. It hands to Krish in person any edit to `scripts/post-pack/week_board/**`, `week_board.py` render functions, `tokens.css`, `config/board-layout.json` or `packages/contracts/src/board.ts`. It uses the same pattern as taste-guard's "ask".
  - CI check `npm run check:board-layout`. It renders fixtures (a Sunday, a mid-week and a made week) and compares DOM structure snapshots plus Playwright screenshots at 390px and 1280px, extending `tests/integration/board-runtime.ts`. It also fails on any committed script that string-patches board HTML. Add it to `npm run verify`.
  - Codex is bound the same way: an AGENTS.md section, "The board: feed it, never shape it", and the CI check. Hooks don't run under Codex, but CI does.

### PR 2: Ideas and Queue, live for Sunday 25 Oct

- `scripts/post-pack/board_feed.py ideas WEEK` gathers from:
  - `GET /api/week/options` (`judged_best`, `dropped_by_krish`)
  - Control Center content-tab ideas (manual, `said:` refs)
  - `content_inspiration_artifacts` from `api/inspiration/drive-scan.ts`, the Cold Ideas & Inspo folder. Also fix the 8k-character truncation and the Word skip noted in `NOW.md:163`, and add the folder to `docs/DRIVE.md`.
  - engine sources

  It ranks with a **preference profile** built from his picks, `meta.queue` verdicts and A/B `beat`/`lost_to` history (`_ideaQueue.ts:110`). The judges stay blind, as `check-judges.ts:602` enforces. It writes the week document's `ideas[]` with `source` and `why_here`, and the plan-week session adds narrative sketches.
- `board_feed.py queue WEEK`:
  - Reads the queue (`api/idea-queue.ts`).
  - Runs similarity over **queued** rows, extending `content-ideas/cluster.ts` to include `queued_at` rows.
  - Proposes `combine[]` with a thesis and the beats that join the ideas.
  - The Combine tap is stored as a `queue/combine-*` doc. The next session calls `synthesize.ts` with `decided_by: 'Krish'`.
  - Board queue marks are copied into `/api/idea-queue` as they are today.
- Update `.agents/skills/plan-week/SKILL.md` steps 1, 3b and 7 to use `board_feed.py` and the week document, then sync with `python scripts/validate-skills.py --sync-claude`.

### PR 3: Drafts, editing, carrying changes across, learning

- **Editor (`week.js`/`web.js`)**:
  - Markdown is rendered to a read view, and tapping a paragraph edits it.
  - Selecting text lets you comment on it. The anchor becomes `{box, paragraph id, quote}`, extending `anchorFor`.
  - Autosaved local draft, an explicit Save with a clear "Saved" state, and a 409 conflict prompt.
  - The `edits/<day>-<item>` storage stays the same, so `board_web.py read edits` keeps working.
- **Carrying changes across**: `scripts/post-pack/edit_sweep.py PIECE`, run by `make-piece` when it picks up edits.
  - It diffs each save against its base and classifies the change: number/fact, claim, narrative/structure, tone/style, wording.
  - It finds the same claim, number or phrasing in every draft of the piece and in later pieces still in draft, and applies the change. Facts re-run the fact gate. Scripts re-run `story_check.py`, the reading gate and the read-back.
  - It writes `also_changed[]` (each with an undo) into the week document.
  - It never touches a script he has already recorded without asking (existing rule).
- **Learning**:
  - Add a `publish_board` surface to `_editEvents.ts` and the ledger. Each board edit is written as a Krish-actor event with the classified `reason_code`.
  - Extend `learning/compile.ts`/`_patterns.ts` with a "repeated edit class" pattern, for example "softened a statistic 3 times".
  - Proposed rules appear in the Drafts panel "What I learned from your edits" for him to approve. Approved rules land in `config/learnings.json` with markers, per say-nothing-twice.

### PR 4: Publish run-sheet

- The Publish sub-tab follows `board-layout.json`. Steps run in his posting order, with a "download first" bundle at the top: everything needed offline, in order.
- Each card follows the same pattern: files → copy → post link → tick. `STEPS` tick keys are preserved, so saved ticks aren't orphaned.
- The `publish_kit` and `build.py` pack layout (`0 Publish … 4 Social`) map onto the same order.

### Also, in PR 1

- A `config/learnings.json` entry for this request ("board-is-fed-never-shaped") with markers: the hook, the CI check and the AGENTS.md line. Run `python3 scripts/check_failures.py`.
- Update `docs/PUBLISH_BOARDS.md` (the feed contract and its commands), the `make-piece` reference `week-board.md`, `WORKBENCH.md`, and `npm run repo-map`.
- `Ruling (Krish, 2026-10-21): the board is fed through one schema; its layout changes only with his approval.`

## Reuse, not rebuild

- Keep the existing server and stores: `apps/control-plane/api/board/_handler.ts`, `_contracts.ts`, the `board_save` RPC, `board_web.py publish-web/read/download/rollback`, and the engine stamp.
- Keep the tick IDs (`STEPS` keys) and the `edits`/`picks`/`queue`/`comments` collection names unchanged.
- Reuse these existing modules rather than writing new ones:
  - idea queue: `_ideaQueue.ts`, `idea-queue.ts`
  - ideas: `cluster.ts`, `synthesize.ts`, `week/options.ts`, `inspiration/drive-scan.ts`
  - learning: `learning/compile.ts`, `_patterns.ts`, `_editEvents.ts`
  - checks: `story_check.py`, fact gate, `narration_diff.py` (its pattern logic is a model for the edit classifier)

## Verification

- Run `npm run verify` (includes the new `check:board-layout`), plus `python3 scripts/post-pack/week_board.py --self-test`, `npx vitest run tests/control-plane/week-board.test.ts tests/control-plane/board-web.test.ts`, `python3 tests/board_web_test.py` and the Playwright `board-runtime.ts`.
- Render the three fixture weeks at 390px and 1280px and check:
  - no horizontal scroll
  - every tap target at least 44px
  - the tab and sub-tab order is identical across fixtures
  - screenshots reviewed by eye
- Load `ux-testing-agent` against a preview build: comment on a sentence, edit a paragraph, save, reload, see the change kept, then a 409 conflict.
- Prove the lock:
  - a deliberate edit to `week.css` triggers the board-ui-guard ask
  - a build with an extra section fails `verify()` and CI
  - a string-patch script fails CI
- Edit sweep: a fixture piece where one number appears in the article and both scripts. Changing it in one place updates all three, lists them under "also changed", and writes one ledger row per edit.
- The live 12 and 19 Oct builds are byte-identical after deploy: compare `board_web.py download` hashes before and after.
- Ship each PR on `claude/content-publish-board-ux-4dl7ai` (then follow-on branches): push the branch, open a PR and turn on auto-merge. Publishing the 26 Oct board waits for Krish's approval at that moment.
- Load `strategy-brief` before PR 1 and `krish-design`/`ux-foundations` for the visual pass. Run `verification-loop` after each PR.
