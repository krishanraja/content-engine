# Article figures: the order of work

Krish, 19 Nov 2026 (Fri 20 production session): "these dont look visually good enough and they have the wrong brand mark. Are these to go inside, in line, in the Substack article? If so, we don't even need the brand mark." (`config/failures.json`, `article-figure-typed-mark-and-word-cards`)

1. Draw each figure as HTML on the house look (`scripts/pages/figure.css`), with two meta lines in its head:
   - `<meta name="figure-form" content="...">`: one picture form, `source-page` (the real page, cropped, with its date), `scale` (bars or areas to the true ratio), `timeline`, `ledger` (rows of real entries), `map` or `comparison`. Never a card of words: at most 40 words of running text outside the labels.
   - `<meta name="figure-article" content="<path to the article, relative to the figure>">`.
2. Render with `node scripts/pages/render_figure.mjs <figure.html> <out.png>`. It runs the three checks first (`scripts/pages/figure_check.py`, rules in `config/article-figures.json`) and draws nothing that fails:
   - no mark: an inline Substack figure carries no wordmark, typed or drawn; a share card (`<meta name="figure-kind" content="share-card">`) may carry only the palette's own wordmark image, matched by sha256;
   - a picture form, and the word cap;
   - nothing the article doesn't say: every number, date, quoted phrase, name and stamp on the figure is in the article. Words inside a real source screenshot (`data-source-crop`) are the source's own, and its caption is still checked.
   Run the checks alone with `python3 scripts/pages/figure_check.py <figure.html...>`.
3. Then the reader test with the figures in place.
4. Only then show Krish. Never send him a figure that failed a check.
