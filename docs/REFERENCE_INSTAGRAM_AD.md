# Reference: the proof-first Instagram ad (2026-09-25)

> Scope: one reference Krish shared, what it teaches the Shorts and carousels,
> and what is still his call. For the whole system start at `README.md`. The
> confirmed Studio standard it is read against is
> `docs/REFERENCE_VIDEO_CALIBRATION.md`.

## Status: two rulings confirmed, the rest a proposal

Krish shared an ad on 2026-09-25 and said, in full:

> "I really like this Instagram ad, the way it's designed and styled. I think
> it's really impactful."

That was the whole of his judgement on the ad. Everything below "What it
does" is Claude's reading of it.

On 2026-09-26 he confirmed the two defaults in "Where it conflicts" below
("I agree with all your four except for number one"; items 2 and 3 were the
captions and the close). They are recorded in
`fixtures/feedback/proof-short-captions-close-20260926.json`. The rest of the
grammar (moves 1 to 4) stays a proposal until he rules on the piece 2
storyboard.

| Field | Value |
|---|---|
| Reference | Instagram ad for a model API product (9:16, about 21.5 s), shared from Google Drive |
| sha256 | `29ca7c0bbc082af2a325afcaed09f5e3919b5ef11e0f1191264124dd8e20e182` |
| Rights role | analysis only |
| Media in the repository | none: the file is never committed, only its hash |

Prohibited uses: do not republish, quote or show the ad or any frame of it in
a public artifact; do not copy its script, product claims or on-screen text;
do not cite it as evidence.

## What it does

1. **It opens mid-sentence on a belief it is about to break.** There is no
   greeting and no title card. The first words are the claim, and the first
   frame already shows the thing being talked about.
2. **The picture acts out the sentence.** When the line says no subscription
   is needed, a lock on screen goes from "Subscription required" to "No
   subscription needed" and a Subscribe button is struck through. The graphic
   does the same job as the words, at the same moment.
3. **A split frame: proof on top, a face below.** The top half is a real
   artefact (a post, a price table). The bottom half is the presenter talking
   to camera. The captions sit on the seam between them.
4. **One highlight, and it points at the proof.** A single bright accent
   colour is used only to mark the line in the artefact that matters: a
   highlighter across one line of a post, a glow round one row of a price
   table. It is never decoration.
5. **Fast captions with a few loud words.** Captions change every third to
   half a second, one to three words at a time, in sentence case. A handful
   of punch words switch to a large italic serif in capitals, and the payoff
   words take a gradient in the accent colour.
6. **It ends on the full face and a one-word comment prompt.** The split
   frame gives way to the presenter alone, who asks viewers to comment a
   single keyword.

## What it teaches us

The ad's strongest move is the one the engine is best placed to copy
honestly: **it puts the source on screen, so the viewer sees the proof.** The confirmed
standard already asks for this ("Open with a legible promise and visible
receipts", `docs/REFERENCE_VIDEO_CALIBRATION.md`), and since 2026-09-25 the
engine holds the receipts for every piece that passes the fact gate: the
source's own words behind each claim, with where they came from
(`apps/control-plane/api/_receipts.ts`, returned by `GET
/api/content-ideas/:id/fact-check`). A proof panel is a receipt on screen,
highlighted on the words the sentence depends on. Nothing on a panel is
written by a model.

Moves 1 to 4 fit the confirmed standard as they are. In the makeyourmindup
house style that means: the panel is cream on ink with the source named
under it, the one highlight is mint (the brand's colour for "the answer"),
and the subchannel colour (butter, coral or lilac) marks only the frame.

## Where it conflicts with what Krish has already confirmed

Two of the ad's moves run into the standard he confirmed on 2026-09-08
(`fixtures/feedback/reference-video-preference-20260908.json`), which
rejects "all-caps word-by-word captions" and "empty comment CTAs":

| Move | The conflict | Proposed default until he rules |
|---|---|---|
| 5, fast captions | The ad's captions are sentence case, with capitals only on a few punch words, which is close to the all-caps word-by-word style he rejected without being it. | Two to four words per caption in sentence case (Archivo). At most one punch word per beat, in Anton capitals with the mint swipe. |
| 6, comment prompt | A one-word comment prompt is close to the empty comment prompt he rejected. The Studio's pattern check (`packages/core/src/editorial.ts`) looks for phrases like "comment below" and would miss this wording, so only his ruling settles it. | End on the full face delivering the piece's dated prediction, with the date and confidence on screen: the brand's "Every piece makes a call. We keep score." |

Both defaults are confirmed (Krish, 2026-09-26): captions in sentence case
with at most one loud word, and the close on the dated prediction.

## What changes if he confirms

- Done: the preference record for the two rulings, scoped to the three live
  subchannels.
- Next, with the Studio's series: caption treatment and the close follow
  the two rulings in the Studio's own checks.
- If he confirms the storyboard: the visual plan for a Short gains a
  proof-panel beat fed from receipts, and a rule that the one highlight may
  only mark words inside a receipt.

The Studio still speaks only the two retired series names
(`apps/control-plane/api/_productionBrief.ts`), so a piece routed to
follow.the.money, mind.the.gap or under.the.hood cannot get a production
brief yet. Krish gave the go to teach it the three names on 2026-09-26 (walk
log F21).
