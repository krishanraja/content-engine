# Production handoff to Growth-MakeYourMindUp

Ruling: Krish, 26 October 2026. Content production standards belong solely
to content-engine. Growth-MakeYourMindUp owns posting and social strategy.
This serves the creator-studio North Star by keeping production focused on
its own craft, reusable methods, review and reduced human decision time.

## Growth makes derived carousels (Ruling, Krish, 28 October 2026)

Krish: "take over posting as well as creating new assets like carousels".
This supersedes the 26 October split for carousels and the other derived
posts only.

- Growth makes the derived carousels, Substack Notes, memes and off-day posts
  itself. The off days are Tuesday, Thursday, Saturday and Sunday on
  Instagram, TikTok and YouTube Shorts.
- It makes them to [CAROUSEL-STANDARD.md](CAROUSEL-STANDARD.md), the
  rejection floor (`python3 scripts/floor.py --format carousel` in this
  repository) and the copy lint (`config/copy-lint.json`, which Growth's
  `release.py` applies to every post it releases).
- Content-engine keeps the standard and the learning that improves it, and
  still makes the hero assets: the article, both cuts, thumbnails and covers.
- A clip from a past week is still cut here. Growth names the moment by word
  range; content-engine cuts it from the approved master and its word clock,
  so the word, caption and brand gates still hold.
- Growth's derived posts go on the Monday final board for the same Approve
  for publish press as the hero pieces. Nothing posts without his approval.

The sections below still hold for anything Growth asks content-engine to
make. Where they say content-engine renders a carousel, this ruling comes
first.

## Receive a distribution brief

Growth originates the amplification idea. It identifies published work that
should become a carousel, clip, document, thread or other suitable edition,
finds where to propagate it beyond Krish's own activity, and owns current
channel best practices, follower/engagement tactics and distribution tests.
It does not wait for Krish or content-engine to invent that opportunity.
Content-engine supplies production execution and quality standards for all
formats; channel strategy and social-management best practices remain Growth's.

Growth chooses the published source video/article to amplify, audience,
objective, accounts, native formats, cadence, timing, experiment and
continuation. It supplies source identities/links and observed platform
constraints, distinguishing facts from proposed hooks or distribution tests.

Content-engine owns the creative response: story, writing, design, media
adaptation, rendering, source/rights checks, production QA, creative
acceptance, standards, reusable methods and production learning. Use the
existing editorial and tracked Studio route. Do not add a parallel renderer,
feedback database or client-specific production memory for Growth requests.

For publication carousel work, read [CAROUSEL-STANDARD.md](CAROUSEL-STANDARD.md)
alongside the live mandate and existing Studio contracts. The 26 October
visual floor, clean-artwork and newcomer-comprehension requirements were
transferred from Growth into that sole production home. Krish approved the
full eight-card Grok Bot vs Muse revision 03 as the production pilot on
26 October 2026. Its principles are now the production reference, with exact
asset hashes preserved in private approval evidence. This is not publication
approval or evidence that a volume system has been built and measured.

## Snackable cuts for the off-day lane (W2.9)

`scripts/quick-edit/snackable.py plan --master CUT --words CUT.heard.json --manifest "0 Publish/manifest.json" --from N --to M`
takes one continuous stretch of a master Krish approved (its sha256 is in the
piece's sealed manifest) by word range, cut in and out only in gaps at least
80 ms wide and 30 ms clear of either word, so no word of his is clipped,
changed or put out of sync. `render --plan P --out FILE` cuts it; nothing is
posted. Growth's off-day lane takes the file from there.

## Return a production package

- Source piece identity/version, canonical article/video URLs and claims.
- Stable references and SHA-256 hashes for accepted finished assets, order,
  format, dimensions/duration and exact creative acceptance state.
- Exact channel copy, alt text, continuation and platform-specific needs,
  clean under the copy lint (`config/copy-lint.json`, Krish, 28 Oct 2026).
- Source, rights and production QA evidence. Unresolved gaps stay explicit.

### The piece manifest (W2.8)

The package travels as `0 Publish/manifest.json` in the post's library folder, in
Growth's closed shape (`content-engine-piece-manifest/1`, copied from Growth into
`config/schema/piece-manifest.schema.json`), written by
`scripts/post-pack/piece_manifest.py`:

1. `draft SPEC --out "0 Publish/manifest.draft.json"`: assets in order with their
   Drive ids and sha256, the exact words and alt text per channel, and QA. The
   board's Approve for publish binds the draft's sha256
   (`week_board.py --publish-manifest DAY=<draft>`), so his press approves exactly
   that.
2. `seal --draft D --approval <his picks/<day>-publish document> --out manifest.json`:
   only his own approval (updated_by Krish), approved, for this piece, bound to
   this draft, with QA passed, seals it; `approval_sha256` is the sha256 of his
   press's canonical JSON. Growth refuses an unsealed draft.
3. `dispatch --manifest M --url <direct download> --run-id makeyourmindup:<run> --slots S`:
   the `growth-go-live-manifest` payload names the manifest as
   `piece_manifest {url, sha256}` and marks every slot `per_item_review: true`,
   so each post is its own go-live in Control Center: one decision per post. It
   prints; `--deliver` sends it only with `--yes "Krish, YYYY-MM-DD: <his words>"`.

Growth owns platform packaging, metadata, target accounts, queue, authorised
scheduling/automatic posting, idempotency, native readback, live audits,
social management and channel performance. Content-engine does not publish
public social posts. Its existing private uploads and publish boards do not
make it a second social scheduler. Creative acceptance and publication
approval remain distinct and tied to exact asset/payload identities.

## Improve each engine at its own job

Growth returns dated observed reach, saves/shares, relevant replies, follower
and subscriber changes, exposed attribution, delivery failures and human
effort using comparable denominators. These are evidence, not proof that a
single creative choice caused an outcome. Content-engine improves creative
production through its existing governed feedback and learning route.
Growth improves channel selection, cadence, distribution reliability,
subscription journeys and engagement tactics.

The distribution-side contract is
[growth-makeyourmindup/docs/ENGINE-BOUNDARY.md](https://github.com/krishanraja/growth-makeyourmindup/blob/main/docs/ENGINE-BOUNDARY.md).
Older strategy/profile tactics in AMPLIFICATION.md are historical where
they overlap Growth's current strategy. Preserve existing production upload
dependencies and source history. This documentation change does not mutate
Studio jobs, grant tracked capabilities or prove a deployed integration.
