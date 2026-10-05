# pages

Turns a piece into two files: its web page in the makeyourmindup look, and a
copy that pastes into Substack whole. With `--cover` it also draws the post's
cover image, and `card.py` checks that artwork made from HTML can be read on a
phone.

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
| `phone-images.png` | Every image in the post at the width a phone shows it (358 pixels). Look at it before publishing: a word you cannot read there, a reader on a phone cannot read either. |
| `cover.png` | With `--cover`: the post's cover image, 1200 x 800, to upload in Substack's post settings. It is not written if a word or a logo would be cut off, or a word would be too small to read in a phone's feed ("What Substack does to your artwork", below). |
| `cover-crops.png` | With `--cover`: what Substack's feed, share card and archive each show of the cover. |
| `shots/` | With `--shots`: both files at a computer's width (1440) and a phone's (390). |

## Setup

- Python 3.10 or later. Building needs nothing beyond it.
- `npm ci` in the repository, once. The four faces come from the repository's
  own font packages (below).
- For `--check`, `--shots`, `--cover` and `card.py`: `pip install playwright`,
  then `python -m playwright install chromium`. On Windows you can skip the
  download and use Edge: set `MYMU_BROWSER` to `msedge` first (PowerShell:
  `$env:MYMU_BROWSER = "msedge"`).
- Pillow (already in `requirements.lock.txt`) is optional. With it, the logo
  is scaled down before it goes into the page, which keeps the file smaller,
  and `phone-images.png` is written.
- The internet, about once a week, for the logo images.

## Run it

```
python scripts/pages/build.py WORKDIR/page.json --out WORKDIR/out --check --shots --cover
```

1. **Make a working folder outside the repository.** Images are never
   committed (`scripts/check-no-secrets.ts`), so the piece's images live
   there, with `body.md` and `page.json`. If an image is made from HTML,
   check it with `card.py` before it becomes a PNG (below).
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

   Anything less, and it says so and exits with an error. Then look at
   `phone-images.png` and, with `--cover`, `cover-crops.png`.
6. **Paste.** On a computer, open `substack.html`, press Copy title, Copy
   subtitle and Copy post in turn, and paste each into the Substack editor. A
   phone may paste the words without the images. Upload `cover.png` as the
   post's cover image in its settings.

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
| `cover` | The post's cover image, drawn by `--cover`. All of it is optional: `{"headline": ["the words in cream", "the last line in the subchannel's colour"], "rows": [{"logo", "name", "tag", "colour"}], "label": "words after the subchannel at the foot", "subline": "one bold line", "background": "img/photo.jpg"}`. Without `headline`, the page's headline is split after its last comma, full stop, colon or question mark; it is drawn at the largest of 104, 100, 96, 92 or 88 pixels at which it fits in three lines. A row's `logo` must read on dark ink (a light logo) and is drawn 64 pixels tall; its `tag` is the words beside it, drawn at 47 pixels; its `colour` is `mint`, `butter`, `lilac` or `coral`. Keep to two rows. `label` defaults to `issue`, then the date, and is fine print at 37 pixels; it is left out when the cover only fits without it. Leave `subline` out unless it says something the rows do not: it is drawn at 47 pixels, like the tags, and there is rarely room for it. The `background` photo sits at 30% under a dark fade. |
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

## What Substack does to your artwork

Krish, 2026-10-05, after article 1 went up: "Also bear in mind what happens to
your artwork when I'm looking at the article in Substack once it's posted."
Its cover was cut on both sides in his phone's feed: the headline lost its
first letters, and the wordmark and the "BLOCKED" and "WELCOMED" labels lost
their ends. It had been drawn for a computer's page and a 1.91:1 share card,
and Substack shows it in three other shapes. Measured that day from the live
post and his screenshot:

- **The cover is cropped three ways,** each filled by cutting (`c_fill`). The
  archive list shows the centre square (`w_150,h_150` up to `w_450,h_450`,
  `g_center`). The share card for LinkedIn and others is 16:9 (`w_1200,h_675`,
  `g_auto`, which picks its own middle). The home and section feed on a phone
  shows about 3:2, cut evenly from both sides. Article 1's cover was 1200 x 630
  (1.91:1), so every one of them cut it.
- **Images inside the article are kept whole and shrunk to fit.** Substack
  serves them at `w_1456,c_limit`, and at `w_424,c_limit` to phones, where the
  column is about 358 CSS pixels wide.
- **So words in an image shrink with it.** On article 1's three explainer
  images, 1360 wide, body text set at about 28 to 30 pixels came out at about
  7.5 to 8 pixels on a phone. The headlines could be read; the labels, the
  table text and the sources could not.

What the tools do about it:

- **`--cover` draws the cover at 1200 x 800,** the feed's own 3:2, so the feed
  shows all of it. Every word and logo sits inside x 220 to 980, y 84 to 716,
  which the 16:9 share card (it keeps y 62 to 738) and the archive square (it
  keeps x 200 to 1000) both keep.
- **The cover's words must be readable in the feed, too.** Krish reads the
  feed on his phone, where the card is about 358 pixels wide, so every word on
  the 1200-wide cover comes out at 358/1200 of its size. On the first
  1200 x 800 cover, made by hand, the subline, the tags and the footer came
  out at about 6 to 9 pixels there. The cover is held
  to the same floors as any artwork (`card.py`, below): words at 47 pixels or
  more on the cover and fine print at 37 or more, and the template draws at
  those sizes. That leaves room for the wordmark, a headline of up to three
  lines, two rows and the label line; the subline is left out unless the
  facts give one.
- After drawing, `--cover` measures every element, every line of words and
  every word's size. If the headline needs more than three lines, if anything
  falls outside the box, or if a word would be too small in the feed, it
  writes no `cover.png`, removes an older one, and lists each problem: what
  would be cut and where, or each small word with its size on a phone and the
  size it needs on the cover. If the cover only fits without the label line,
  it leaves the label out and says so. `cover-crops.png` shows the three crops
  side by side, and the archive tile at 150 pixels.
- **`card.py` checks artwork made from HTML before it becomes a PNG:**

  ```
  python scripts/pages/card.py WORKDIR/art/money.html --out WORKDIR/img
  ```

  It draws the file at its own size (from `<meta name="artwork-size"
  content="1360x1000">`, the element with `id="card"`, or `--size 1360x1000`),
  reads the size of every word you can see on it, and works out how big each
  comes out on a phone (its size times 358, divided by the artwork's width).
  Words a reader needs must come out at 14 pixels or more, and fine print at 11
  or more; mark fine print, such as a sources line, with `data-fine-print`. On
  a 1360-wide artwork that means words at 54 pixels or more and fine print at
  42 or more. Anything smaller is listed with its words, and the PNG is not
  written:

  ```
  phone check: money.html
    drawn at 1360 x 1000; a phone shows it 358 px wide, so every size comes out at 0.26 times what it is drawn at
    7 run(s) of words: 1 big enough, 6 too small
    too small to read on a phone (words need 14 px there, fine print 11 px):
       5.8 px  (fine print, drawn at 22 px)  "Sources: Amazon 2025 annual report; Shopify 2025 annual report"
       7.9 px  (drawn at 30 px)  "Amazon: adverts, paid when you look"
    ...
    result: too small to read on a phone
  ```

  It always writes `NAME-phone.png`, the artwork 358 pixels wide as a phone
  shows it, and writes `NAME.png` only when every word can be read. The
  floors are `MIN_READ_PX` and `MIN_FINE_PX` in `card.py`.
- **`phone-images.png`** is for the finished PNGs the page facts name, whose
  words cannot be measured: every one at 358 pixels wide, to look at before
  publishing.

The house rule is `SUBSTACK_FIT` in `apps/control-plane/api/_houseRules.ts`,
and `tests/control-plane/house-rules.test.ts` holds its numbers to the ones
these tools check.

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

The body, the images, the logos, the cover's photo, the finished pages, the
cover and the shots. The tool, this README and the example facts are
committed; everything they make goes to a working folder or to `.cache/`.
