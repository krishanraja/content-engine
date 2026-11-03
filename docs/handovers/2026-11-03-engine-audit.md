# Handover: the 1 to 3 Nov engine audit (3 Nov 2026)

Status: the filing, board and motion fixes are on branch `claude/dazzling-rubin-rqpt3d`. This page holds what is left:
the inspiration board, and the taste ledger. Every claim below was read in the code; file:line as of commit da5c8e4.

## Done on this branch

- **Off-day folders, one rule.** `scripts/post-pack/library.py` `post_folder` names a Tuesday, Thursday or Saturday
  post `YYYY-MM-DD Ddd off.day - Subject` whatever series dress it wears. Before, `scripts/velib/filing.py:74` passed
  the spec's series, so Thursday 5 Nov's under.the.hood cut would have filed under `Thu under.the.hood`. Every Python
  writer (ve file, the post pack, produce-video's send) goes through that one function. Case added to
  `config/library-paths.cases.json`; test in `tests/ve_shadow_test.py`.
- **The board checks the folder, not just a link.** `week_board.posts_needs` now refuses a card that names 4 Growth, a
  bare Drive link with no post folder named (`posts_folder`, or "3 Posts › <folder>" in its needs), and a folder of
  another day. It runs on both off-day feeds (ideas.json `read_offdays` and Growth's `--offdays-plan`). Tuesday's
  Claude jobs card still names 4 Growth, truthfully, so the board flags it until Krish says yes to moving it.
- **Motion, one standard.** `ve lint` `motion.required` uses `creative_direction.motion_problems` (the same rule and
  date, 9 Nov 2026) on the ve route; the spec schema gives `style.motion` its `{module, reason}` shape; a Codex card
  that names its piece's spec takes the style from it and is refused without one (`scripts/velib/cards.py`). Library
  device cards stay style-free, because a device serves every piece. MOTION_STANDARD.md gets engine notes (outside
  the signed text) linking the bank and saying channel safe zones are listed, not counted, until card ve-motion-4.
- **Docs agree.** NOW.md's 4 Growth line, the heal handover's sign request, GROWTH-HANDOFF.md (filing via send.py to
  3 Posts; Sunday rests), the ve skill (ve file is real), make-piece (web board, 3 Posts), produce-video (fallback
  limits box: Archivo captions only, no Fraunces, no style.motion, no reference gate, safe zones warn only).

## Left on purpose

- The reference and motion start dates stay different (6 Nov and 9 Nov); both are now read from one place each, and
  moving either would change what Friday 6 Nov needs.
- Covers and thumbnails still never pass `scripts/channel_safe.py` in a gate; `ve file` files videos only. Add it to
  the post pack's visual gate (`scripts/post-pack/build.py`) when ve-motion-4 lands.
- F29 (reply "Done" for a Drive request) has no check; it is a reply rule and stays prose.

## Next: make the inspiration board drive the work (Wave 3, about a day)

Today the board is a weekly topic source for plan-week and a box to tick for ve:

- `scripts/velib/lint.py:140-158` checks only that look, motion and captions are named. Nothing checks the card exists in
  `inspiration_items`, is in the production lane, or that Krish kept it; a session can type any name.
- ve names a card by its file name (`instagram_DePHDr_jRed`); the making record's `clip_uses` uses the uuid
  (`apps/control-plane/api/_making.ts:195`), so the two never join.
- make-piece's style step and produce-video read `config/style-references.json`, a hand-copied list (46 of 47 untested),
  not the board. Scripts, articles, carousels and Codex cards never open it.
- Nothing is written back: no card knows which cut it shaped, its Critic score, or whether that piece was published.
  Tags describe the clip (platform, creator), not what it teaches.

The build, in order:

1. `brand.references[].card` becomes the `inspiration_items.id` (file name kept as `label`); a read route
   `GET /api/inspiration/cards?ids=` in `apps/control-plane/api/`; ve lint (online) and `ve refs` refuse a card that is
   unknown, outside the production lane or dismissed.
2. `inspiration_items.teaches[]` (look, motion, captions, hook, pacing, layout), from his answer or marked as the
   engine's guess; `GET /api/inspiration/candidates?format=&role=` ranked over `content_reads` embeddings
   (`apps/control-plane/api/_embeddings.ts`).
3. `ve init` and make-piece pre-fill `brand.references` with the top three cards per role, so the session picks from
   the board instead of typing. The carousel standard and Codex cards name the cards they were built against.
4. `card_uses` (card, piece, role, Critic score, published, Krish's verdict), written by `ve verdict` and at publish.
   The board shows each card's uses and surfaces the ones never used.
5. `config/style-references.json`'s reference entries are generated from studied cards, never kept by hand.

## Then: the taste ledger (Wave 4, a proposal for Krish; nothing becomes a rule without his yes)

- Control Center holds **no approved taste rules** for Make Your Mind Up (`get_approved_taste`, 3 Nov 2026: count 0).
  Every session drafts with none.
- What he likes or rejects lives in at least eight overlapping stores: `config/learnings.json` (83),
  `config/failures.json` (73), `config/rejection-floor.json` (215 standards, 0 approved), `feedback_cues`,
  `taste_reports` and `taste_evidence`, the style bank, `config/hook-playbook.json`, and house rules in several configs.
- A bare board press is stored as an engine-written sentence with `kind: 'observation'`
  (`apps/control-plane/api/board/_presses.ts:156`), in the same tables as his words.

Proposal: one `provenance` column (his_words, his_press, engine_note) on the ledger tables, with a press stored as the
press, never as a sentence for him; learnings, failures, cues and the floor read as views of it; the 215 floor
standards grouped into about 20 on one page for his yes through the existing Rejections route. taste-guard puts each
of these to him in person.
