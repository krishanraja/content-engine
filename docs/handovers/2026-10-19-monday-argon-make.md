# Handover: make Monday's piece (Google's AI doubles in price on 1 December)

Start a fresh Claude Code session on `krishanraja/content-engine`, branch `claude/editorial-narrative-brief-qjhsyn`,
and paste: "piece_id: 5b5bfadc-a60c-4d0a-be8e-b2e9bf43d092. Read docs/handovers/2026-10-19-monday-argon-make.md
first." Opus. Run `python3 scripts/check_failures.py` first.

## What is decided (all in Krish's words, 19 Oct)

- Narrative signed: `docs/plans/2026-10-19-week/narrative-mon.md` ("sign Monday"), with his amendment at the
  end (address whether downgrading to a cheaper model is worth it).
- Outline approved: `docs/plans/2026-10-19-outline.md`: spine, answer, six sections, prediction A (15%), style
  recipe, wording. The answer gained one clause for the downgrade question ("a cheaper model only helps if it
  does the job"); tell Krish once in the first reply, since the drift rule covers the end message.
- Research: `docs/plans/2026-10-19-week/research-mon-argon.md`. Only the Standard rows are checked (Google's
  pricing page, updated 16 Oct). Before use, read at the original: Batch and Flex rates, the Gogia quote
  (Computerworld, 13 Oct), the "introductory" and "95% off" wording (Google's launch post), Opus 5.5 $4/$20.

## Next, in order (`.agents/skills/make-piece/SKILL.md`)

1. Workroom artifact with the decisions above; record it.
2. Draft, 1,000 to 1,400 words, sections exactly the outline's; voice_check, ai_scan, sources filed, fact gate
   (a paid run only on Krish's word).
3. `spine_check.py outline|draft|judge`, then the visual gate (the two-bar picture in the narrative), then
   the scripts (long and 90s), read-back, Teleprompter send.
4. Then the publish page and the week's board (both links in `config/boards.json`; the second is his other
   account and returns 404 here). Krish asked that the board is built only after these decisions, which are now made.

Wednesday's and Friday's narratives (`narrative-wed.md`, `narrative-fri.md`) still wait on his sign-off.

## Done in the first session, 19 Oct (later)

- Workroom: https://claude.ai/artifact/DdBDf3JPCAdjkmDj7ss6na (copy in `docs/plans/2026-10-19-week/workroom-mon.html`), recorded.
- Draft: `docs/plans/2026-10-19-draft-body.md`, 1,177 words, saved on the piece. voice_check 2.0 (passes), ai_scan
  passes, spine_check outline and draft pass.
- Sources filed as verbatim excerpts on the piece: Google pricing page (Argon rows), Google launch post with its
  footnote (copied from the page's HTML, which the reader drops), Google Cloud blog, Computerworld (14 Oct, Gogia),
  Anthropic pricing (Opus 5.5 row). Plus our own worked-example note (not verbatim). Node cannot reach the engine
  through the proxy here: file through `scripts/engine.py` (`engine.call`), with the filer's `--dry-run` excerpt.
- Corrections found at the sources: Computerworld ran on 14 Oct (not 13); the launch post is dated 13 Oct; Opus 5.5
  is $4/$20 but is not Anthropic's top model.
- Waiting on Krish: the paid fact-gate run (last measured $1.01 a run) and his words to pass the free pre-check's
  seven example-month sentences (`--despite-precheck` with his `said`); they are our labelled arithmetic, on no
  outside source. Then the spine judge, visual gate, scripts.
