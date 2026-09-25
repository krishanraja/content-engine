# Editions

The web edition of a publication piece: the full, interactive page in the
makeyourmindup house style (brand book v1.0), built from the exact text that
passed the fact gate.

Each edition is a folder:

| File | What it is |
|---|---|
| `index.html` | The page. Self-contained apart from Google Fonts and `logo.png`. |
| `body.md` | The piece's text at the version the fact gate passed. The page says this and nothing else. |
| `edition.json` | The piece's id, its subchannel, and the fact-gate record for `body.md`: its hash, when the check ran, and the tally. |
| `logo.png` | The horizontal logo on ink, from the brand kit. |

`tests/editions.test.ts` holds every edition to two rules:

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

These are built by hand for now. The first, `2026-09-who-picks-your-ai`, is
mind.the.gap's device: a dated line that ends in "put it all together",
three futures that fork and never rejoin, and a prediction with a date.
