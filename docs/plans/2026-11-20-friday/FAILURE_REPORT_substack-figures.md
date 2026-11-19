# Failure report: Substack article figures (Fri 20 Nov, piece c00cd4e0)

Written 19 Nov 2026 from the production session for "Will your AI auditor find your missing money, or the skeletons in your closet?". Hand this to the session that fixes the route. Nothing here has been changed in code yet.

## What Krish said

> "these dont look visually good enough and they have the wrong brand mark. Are these to go inside, in line, in the Substack article? If so, we don't even need the brand mark."

## What went wrong

There were three faults, and the same route causes all three.

1. **Wrong brand mark on an inline figure.**
   - The first four figures (bill-found, hindsight, small-finds, skeletons) carried a "makeyourmindup" mark top right.
   - It was typed text in Archivo 900 (`.mark` in `scripts/pages/figure.css`), not the wordmark from the brand palette.
   - It also has no reason to be there: these figures sit inline in a Substack post that already carries the brand.
2. **Not visual enough.**
   - The first drafts were cards of words: a heading, a sub-line and labelled text boxes.
   - They restated the article instead of showing it. They had no real source page, no bars drawn to scale and no timeline.
   - The redraw (real pages, scaled bars, a timeline, a ledger) is what Krish's note asked for.
3. **Figures that say things the article doesn't.** The second fresh reader (reader-test-2.md, round 2) found these after the redraw:
   - "September 2024", a month the article never gives;
   - "BILLED TWICE", firmer than the article's "around $100,000 that Medicare would have rejected";
   - a timeline that implies a start date for the scans;
   - a Krafton excerpt using "the Buyer's CEO" and "the Target", words the article never explains;
   - a subtitle that doesn't fit one of its two cases.

## Why it happened (causes, with what proves each)

- **The house stylesheet invites a mark** (proved by reading the files).
  - `scripts/pages/figure.css` line 12 defines `.mark{position:absolute;right:64px;top:62px;font:900 24px Archivo}`.
  - `render_figure.mjs` lines 56 to 64 check that the headline doesn't run into "the wordmark", which treats a mark as part of every figure.
  - Recent pieces' figures use it with the text "makeyourmindup": `docs/plans/2026-11-18-wednesday/figures/anthropic-buys.html`, `help-desk-cost.html`, `klarna-headline.html`, and `docs/plans/2026-10-23-friday/pack/figure-*.html`.
  - So a new figure built from the last piece's HTML carries a typed mark by default.
- **The brand rule doesn't reach figures** (proved by reading the files).
  - AGENTS.md says every icon and wordmark comes from `config/brand-palette.json` only, and `scripts/brand_palette.py` refuses a cut that differs.
  - That check runs on video cuts. Nothing runs it, or any mark check, on an article figure.
  - Nothing says an inline Substack figure carries no mark at all.
- **"Visual" is not checked** (proved by reading the files). The make-piece skill (Reader test row) and `render_figure.mjs` check only these things:
  - the figure fits its frame;
  - the reader scores "visual cues";
  - the figure is "readable at a glance, matching the words exactly".
  - No rule asks for the picture form: a real page, a scale or a timeline over a text card. So a card of words passes every machine check.
- **Figure text is never checked against the article** (suspected; not tested).
  - "Matching the words exactly" is left to the reader test, which runs after the figures are drawn and sent.
  - Nothing compares each figure's words, numbers and dates with the article before Krish sees them.
  - This is why round 2 still found five mismatches.

## The fix to make (proposals; Krish rules on the ones marked)

1. **No mark on inline article figures.**
   - Remove `.mark` from `scripts/pages/figure.css`.
   - Change `render_figure.mjs` to exit 1 when a figure has an element with class `mark`, an `<img>` whose name contains "wordmark", "logo-mark" or "brand", or the visible text "makeyourmindup".
   - Fix the 18 Nov and 23 Oct figure HTML so nobody copies them again.
   - Ruling needed from Krish: should any article image carry a mark (for example, one meant to be shared alone as a social card)? If yes, it comes only from `config/brand-palette.json` through `brand_palette.py`, never as typed text.
2. **Picture first: each figure names its form.**
   - The figure HTML declares one form in `<meta name="figure-form">`:
     - `source-page`: the real page, cropped, with its date;
     - `scale`: bars or areas drawn to the true ratio;
     - `timeline`;
     - `ledger`: rows of real entries;
     - `map`;
     - `comparison`.
   - `render_figure.mjs` refuses a figure with no form, or with more than about 40 words of running text outside its labels.
   - Add the rule to the make-piece skill's Reader test row and to `docs/CREATIVE_DIRECTION.md`. Then run `python scripts/validate-skills.py --sync-claude`.
3. **A figure says nothing the article doesn't.**
   - Before a figure is shown to anyone, check every number, date, name and quoted phrase on it against the article body. That means a script that reads the figure's visible text and the article, and lists each token found on the figure but not in the article.
   - A screenshot of a source is exempt only inside its crop, and its caption still has to match the article.
   - Ruling needed from Krish: does the no-em-dash rule apply to words inside a real source screenshot (the Tom's Hardware headline has one)?
4. **Order of work in make-piece:**
   - draw the figures;
   - run the mark check, the form check and the article-match check;
   - run the fresh reader test with the figures in place;
   - only then show Krish.
   - Never send him a figure that hasn't passed all three checks.
5. **Record it.** Add an entry to `config/failures.json`, with these fields:
   - id `article-figure-typed-mark-and-word-cards`;
   - `krish`: the quote above, 19 Nov 2026, Fri 20 production session;
   - `symptom`, `cause` and `guards`: pointing at the checks above.
   - Write the commit body as `Ruling (Krish, 2026-11-19): inline Substack figures carry no brand mark` with `Failure: article-figure-typed-mark-and-word-cards`, so `check_ruling_linked.py` passes.
   - Put a test beside the renderer that proves each refusal fails on a bad figure, starting with a figure carrying `.mark`.

## Done looks like

- `render_figure.mjs` refuses each of these:
  - a figure with a mark;
  - a figure with no `figure-form`;
  - a word card;
  - and, through the new check, a figure with a date or number missing from the article.
- Each refusal is proved by a test that has been seen to fail.
- No figure HTML in `docs/plans/` still uses `.mark`.
- The make-piece skill says inline figures carry no mark, are picture first, and are checked against the article before Krish sees them.
- The failures entry is on main, linked from the commit.

## Files

- `scripts/pages/figure.css`: the house look, with the `.mark` class.
- `scripts/pages/render_figure.mjs`: the renderer and its checks.
- `.agents/skills/make-piece/SKILL.md`: the Reader test row (about line 211).
- `docs/plans/2026-11-20-friday/figures/`: this piece's redrawn figures, with no mark.
- `docs/plans/2026-11-20-friday/reader-test.md` and `reader-test-2.md`: the readers' findings.
- `config/failures.json`, `config/brand-palette.json`, `scripts/brand_palette.py`.
