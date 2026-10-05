# pages

Turns a piece into two files: its web page in the makeyourmindup look, and a
copy that pastes into Substack whole.

Krish, 2026-10-05: "I would rather work in here and have the pieces and their
artwork produced in html and assets like we are doing now". The first piece,
Who gets paid, was made that way by hand; this tool makes the same page from
the piece's text and a short file of page facts, so every piece after it
takes one command. `example-who-gets-paid.json` is that first piece's facts,
and the tool rebuilds its page to match the one Krish saw.

It never changes the words. Every sentence of the body must be on both files,
or it writes neither (the rule in `editions/README.md`).

## What it makes

| File | What it is |
|---|---|
| `page.html` | The piece in the makeyourmindup look, in its subchannel's colour: masthead, headline, deck and byline, the body with its source links and images, opinion labelled ("Our read:"), the choices as cards, the dated call with how sure we are, the sources and the subscribe band. One file: the fonts and images are inside it. |
| `substack.html` | The same words in one column, ready for Substack. Copy buttons for the title, the subtitle and the post. The post is headings, paragraphs, lists, quotes, links and images, nothing else, because Substack's editor drops layout and crashes on pasted side-by-side blocks. The images are inside the copy, in place, so they paste with the words. |
| `shots/` | With `--shots`: both files at a computer's width (1440) and a phone's (390). |

## Setup

- Python 3.10 or later. Building needs nothing beyond it.
- `npm ci` in the repository, once. The four faces come from the repository's
  own font packages (below).
- For `--check` and `--shots`: `pip install playwright`, then
  `python -m playwright install chromium`. On Windows you can skip the
  download and use Edge: set `MYMU_BROWSER` to `msedge` first (PowerShell:
  `$env:MYMU_BROWSER = "msedge"`).
- Pillow (already in `requirements.lock.txt`) is optional. With it, the logo
  is scaled down before it goes into the page, which keeps the file smaller.
- The internet, about once a week, for the logo images.

## Run it

```
python scripts/pages/build.py WORKDIR/page.json --out WORKDIR/out --check --shots
```

1. **Make a working folder outside the repository.** Images are never
   committed (`scripts/check-no-secrets.ts`), so the piece's images live
   there, with `body.md` and `page.json`.
2. **Save the body.** `body.md` is the piece's text at the version whose fact
   check passed: the idea's `body`, which
   `python scripts/engine.py GET "/api/content-ideas?id=<id>" --full` shows.
   `GET /api/content-ideas/<id>/fact-check` says whether the check passed for
   that exact text. Change the words and the check has to run again.
3. **Write `page.json`.** Start from `example-who-gets-paid.json`. The fields
   are below.
4. **Build.** It stops and says why if a link phrase, an image's place or a
   pull quote is not in the body, or if a sentence would go missing. Without
   `--out`, the files go to `.cache/pages/<name of the working folder>/` in
   the repository, which git ignores.
5. **Look at it.** Open `page.html`, or the shots. `--check` presses Copy post
   the way a person would, reads the clipboard back and prints what survived:

   ```
   images       3 of 3 copied (3 inline)
   h2 headings  8 of 8 copied
   links        60 of 60 copied
   every sentence of the body is in the copy
   result: it will paste whole
   ```

   Anything less, and it says so and exits with an error.
6. **Paste.** On a computer, open `substack.html`, press Copy title, Copy
   subtitle and Copy post in turn, and paste each into the Substack editor. A
   phone may paste the words without the images.

## The page facts

One JSON file. Paths are relative to the file (or to `--assets DIR`).

| Field | What it does |
|---|---|
| `subchannel` | `follow.the.money`, `under.the.hood` or `mind.the.gap` (or the ids with underscores). Sets the colour, the day and the sticker. |
| `headline`, `deck` | The headline and the line under it. Also the Substack title and subtitle, unless `substack_title` or `substack_subtitle` say otherwise. |
| `date` | The publishing day, `2026-10-05`. Shown as "Monday 5 October 2026". |
| `issue` | The strip at the top, such as `"Vol. 01 · Issue 01"`. Without it, the date. |
| `title` | The browser tab. Defaults to the headline. |
| `body` | The body file. Defaults to `body.md`; `--body FILE` overrides it. |
| `hero` | The art beside the headline, or nothing. `{"image": "img/x.png", "alt": "..."}`, or a receipt: `{"receipt": {"title", "alt", "customer": {"logo", "text"}, "rows": [{"logo", "name", "when", "verdict", "colour"}], "total": [left, right]}}`. A row's `colour` is `mint`, `butter`, `lilac` or `coral`. |
| `figures` | The piece's images: `{"after": "words in the body", "image": "img/1.png", "alt": "what it shows", "caption": "optional"}`. Each goes after the paragraph that holds its `after` words. `alt` is required. |
| `pull_quotes` | `{"after": "...", "quote": "...", "cite": "who said it"}`. The quote must be words from the body, exactly. |
| `sources` | `{"id": ["Title, date", "https://..."]}` (or `{"title", "url"}`). Listed at the end in the order they are first linked; any never linked come last, and the build mentions them. |
| `links` | `[["exact words in the body", "source id"], ...]`. Each phrase is linked where it first appears, in reading order. Headings and the prediction are never linked. |
| `call_heading` | The body heading that starts the prediction, if it is not `OUR PREDICTION`, `OUR CALL`, `THE CALL` or `PREDICTION`. |
| `opinion_labels` | More labels to mark as opinion, beside the built-in "Our read:", "Our read, in plain English:", "Our bet:", "Our guess:", "Our view:" and "Here's our guess, and it is a guess:". |
| `endnote` | The line under the sources. Defaults to the fact-check line. |

What the tool reads from the body itself:

- `##` and `###` headings, paragraphs, `-` and `1.` lists, `>` quotes,
  `**bold**`, `*italic*` and `[links](url)`.
- A run of paragraphs that start "Guess one.", "Guess two." (or Future,
  Scenario, Option, Outcome) becomes a row of cards. If the next paragraph
  says "Our bet: guess two", that card is the one marked.
- The section under the prediction heading becomes the call: "By 30 June
  2027, ..." is the claim and its due date, "How sure we are: 70%." is the
  meter, and "Winners: ...", "Losers: ..." or "First sign: ..." are rows. The
  Substack copy keeps that section word for word.

## Where the look comes from

Nothing about the brand is copied into this folder, so nothing here can drift
from it:

- **Colours, days and stickers** come from the house style in
  `config/studio.json`, the values the Studio renders with. When the schedule
  changes there, the pill, the strip and the subscribe line follow.
- **Fonts**: Anton, Archivo, Fraunces italic and IBM Plex Mono are read from
  `node_modules/@fontsource*`, packages the repository already pins for the
  Studio, and inlined. They are byte for byte the files the first pages used,
  which came from Google Fonts. That beats committing font files (a second copy to keep
  in step) and fetching them from Google Fonts at build time (a network call
  and a cache for files the repository already has). IBM Plex Mono's 600 is
  left out on purpose: the approved pages had none, so their labels drew at
  700.
- **Logos** (the wordmark, the masthead, the mark, from
  `https://www.makeyourmindup.ai/brand/`) and Krish's byline photo (the one
  on the cover site) are fetched from the live site and cached in
  `.cache/makeyourmindup/`, which git ignores. A fresh copy is
  fetched once a week, or now with `--refresh-brand`. If the site cannot be
  reached, the cached copy is used.

`brand.py` holds all of that, and `scripts/channel-kit/` uses it too.

## Making it a web edition

To keep a page in `editions/`, copy `page.html` there as `index.html`, beside
`body.md` and `edition.json` (`editions/README.md`). The editions test holds
it to the same rule this tool checks: every sentence of `body.md` is on the
page.

## What stays out of the repository

The body, the images, the logos, the finished pages and the shots. The tool,
this README and the example facts are committed; everything they make goes to
a working folder or to `.cache/`.
