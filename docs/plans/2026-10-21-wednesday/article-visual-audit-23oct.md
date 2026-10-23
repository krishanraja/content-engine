# Wednesday article-visual audit — 23 October 2026

The live Wednesday article graphics are **below the publication bar** and hold
the board from being called publish-ready. This audit concerns the five figures
inside the article, not the two videos Krish approved after full phone playback.

## What was compared

- The live Wednesday board at `content.krishraja.com/board/2026-10-19`, build
  `63f59c81affebfd815726202f118ab2b3d214081f33adcf7d9384422dcceac27`.
- The previous live board for the week of 12 October and the Monday panel of
  the 19 October board. The four original Claude artifact URLs in
  `config/boards.json` are frozen archives; the web boards are the active
  review copies.
- The five rendered images in the Wednesday production folder, their
  `article-cards.json` instructions, `page-facts.json`, the source captures and
  the pack's `visual_gate.py`.

The 12 October Monday evidence collage shows twelve dated, identifiable
source pages together. The 12 October Friday launch figure plots source-dated
model releases and prints its sources. This week's Monday price figure shows
the old and new dollar amounts with units and provenance. The earlier Wednesday
board also has text-led visuals; the comparison is about whether a figure adds
understanding, not whether every previous image was exemplary.

## Failure in the five Wednesday figures

| Figure | Current image | Missing explanatory evidence |
| --- | --- | --- |
| Inbox | Two outcome statements | Redacted interaction showing what Muse drafted, Grok's warning, and the independent test's different result. |
| Flight | A two-stop line | The actual arrival/departure times that make a five-date trip three New York hotel nights, with the historical fare and source date. |
| News | “April” against “October news” | The dated article and the assistant's conflicting date in a source-bound comparison. |
| Work email | “Recreated” against “Two drafts remained” | The redacted approval-card / draft evidence and sequence that explains the duplicate. |
| Verdict | Two labels for suggested jobs | The two-score method, the missing community result on cancellation, and what can responsibly be inferred from one personal run. |

Four figures are principally short phrases in paired boxes. The fifth is a
simple itinerary line. None includes an actual source-page or interaction
capture. All five lack the makeyourmindup publication mark. The article prose
and captions supply some of the missing context, but the standing
`VISUAL_EXPLAINS` rule requires each image to make a critical point land faster
for a reader who sees the image alone.

## Mechanism

`article-cards.json` assigns `kind: evidence` to brief reconstructions, and
`stage_pack.py` declares four of the five as `shows: reconstruction`. The
pack's visual gate checks presence, declared real-thing type, logos and source
metadata. Its stronger real-page requirement is conditional on a volume-story
trigger; it does not test whether a non-volume article graphic actually exposes
the underlying interaction or research. Thus the pack passed while the images
missed the editorial requirement. Board readback then proved file integrity and
image visibility, which cannot prove visual usefulness or house identity.

The production folder already held the redacted Muse draft used in the video,
source-page captures of community tests, and official launch material. The
generic template was a production choice, not a lack of source material. An
earlier preference for anonymised reproductions was not reconciled with Krish's
later explicit request to show blurred actual interactions and community
evidence. Raw personal captures remain private; only redacted, visually checked
derivatives may enter the board or article.

## Held direction and release condition

`render_article_evidence_sample.py` renders one **held** inbox concept from
the already redacted Muse video still and a separately attributed public
community page, plus the captured Grok warning and distinct personal/community
results. The resulting PNG and HTML are in the local production folder's
`article-visual-review/`; neither has replaced a live article asset. Krish's
first reaction to this material visual direction is the next taste decision.

Krish rated that first concept 5/10. His exact correction: "It's not very
visual. We could have the GrokBot Muse icons next to where it says GrokBot
Muse. You're not ever supposed to say my name, Krish. It doesn't really feel
like an enterprise visual that adds to the article. It feels like a standalone
article of its own." This is a design-system and copy failure: the poster
headline and broad prose panels overwhelmed the evidence, while the product
marks and article-specific visual job were absent. The author name must never
appear in outward asset copy.

`render_article_evidence_sample_v2.py` holds a revision of this *one* inbox
surface. It traces a clearly labelled anonymised reconstruction of the vague
incoming question to Grok Bot's warning and Muse's actual redacted draft. The
exact product marks sit beside their labels, and publication identity stays
present in a small rail. Its PNG, HTML, JSON and article-width QA preview are
in the same `article-visual-review/` folder. The PNG was sent to the private
post library under `2 Covers and images/Working - review/`, explicitly labelled
as held; the library writer's completed download has not yet been read back.
This revision has not been added to the board or approved for the other figures.

After that, replace all five figures from checked sources; add the canonical
publication mark; inspect final files at article and phone widths; verify
privacy, wording and provenance; send the images and corrected seven-format
delivery set through the library route; update the article/publish page and
board through the fixed feed; then read back actual downloads, board panels and
feedback stores. Only Krish publishes publicly.
