# Editions

The web edition of a publication piece: the full, interactive page in the
makeyourmindup house style (the v5 look Krish locked on 25 Nov 2026; an
edition made before then keeps the look it was published in), built from the
exact text that passed the fact gate.

Each edition is a folder:

| File | What it is |
|---|---|
| `index.html` | The page. Self-contained apart from Google Fonts and `logo.png`. |
| `body.md` | The piece's text at the version the fact gate passed. The page says this and nothing else. |
| `edition.json` | The piece's id, its subchannel, and the fact-gate record for `body.md`: its hash, when the check ran, and the tally. |
| `logo.png` | Not in the repository: image files are never committed (`scripts/check-no-secrets.ts`). Copy `logos/makeyourmindup-horizontal-2400w.png` from the v5 brand kit (`brand-kit/makeyourmindup-brand-kit.zip` in `krishanraja/makeyourmindup`, inside its `makeyourmindup-brand-kit/` folder) beside the page as `logo.png` when publishing it. The same lockup as a vector is `assets/brand/makeyourmindup/v5/v9.svg` here. |

`tests/control-plane/editions.test.ts` holds every edition to two rules:

1. `body.md` is the version that passed: its fact-gate hash equals the one in
   `edition.json`, and `edition.json` says it passed.
2. Every sentence of `body.md` is on the page. A sentence laid out as a
   labelled row ("Winners: ...") only needs the words after its label.

So the page can add illustrations, labels and sources, but it cannot say a
fact the gate did not check. Change the text, and the check must run again
(`POST /api/content-ideas/:id/fact-check`, or the Check the facts button in
Control Center) before `edition.json` and `body.md` can be updated.

The house rules for these pages come from Krish on 2026-09-25: reading age 12
with real humour, and no word a reader has to interpret, including our own
coined labels. Labels on the page name things by what a reader sees ("Cisco's
sums", "Price list", "Our prediction"), never by a nickname we invented.

Since 2026-10-05 a page is built with `scripts/pages` instead of by hand: it
takes `body.md` and a short file of page facts, makes the page (fully
self-contained, so `logo.png` is no longer needed beside it) and a copy that
pastes into Substack, and refuses to write either if a sentence of `body.md`
would be missing (`scripts/pages/README.md`).

The first edition, `2026-09-who-picks-your-ai`, was built by hand. It is
mind.the.gap's device: a dated line that ends in "put it all together",
three futures that fork and never rejoin, and a prediction with a date.
