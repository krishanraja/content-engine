# Production handoff to Growth-MakeYourMindUp

Ruling: Krish, 26 October 2026. Content production standards belong solely
to content-engine. Growth-MakeYourMindUp owns posting and social strategy.
This serves the creator-studio North Star by keeping production focused on
its own craft, reusable methods, review and reduced human decision time.

## Every carousel and Short through the 10/10 judges (Ruling, Krish, 2026-11-12)

Krish: "Judge them; count passes. Every Growth carousel goes through the same 10/10 judges, and each one that passes and goes live counts."

- **Before it is made.** Growth's maker sends each carousel and Short it is about to make (its format, channel, claim,
  exact words and each picture's sha256) to `POST /api/board/<Monday>/judge` (`op: judge`, Growth's key;
  `apps/control-plane/api/board/_judge.ts`). The free checks run first (the copy lint, em dashes, banned phrases, "Not
  X, Y"): a hit fails it before any model is paid. Then the draft judges' panel, the same roster, rubric and bar a draft
  is judged on, reads the post; it passes only when the panel stands ready (`standing`, `READY_AT`).
- **A fail comes back with the judges' reasons, never silently.** The answer carries each judge's one fix that did not
  pass; Growth never makes the post, holds the slot loudly as `judges_failed` and keeps the reasons for the session that
  rewrites it. The same post judged again answers from the record and pays nothing.
- **Recorded on the item.** Every verdict, with each judge's score and fix, is a row in `asset_judgements` (migration
  `20261201090000_asset_judgements.sql`, append only) under Growth's slot id; a pass is bound to its Buffer post
  (`op: bind`), and Growth's board tick reports every sent post (`op: live`), which marks only bound posts live.
- **Counted.** The North Star's number counts each Growth carousel and Short whose latest verdict is a pass and that went
  live in the last 7 days, once however many channels carried it, beside the essays published (Control Center's reader,
  `judgedLiveCount`; NOW.md's `current_source` names both). A judgement store that cannot be read makes the reading
  unknown.
- **Spend.** At most `DAILY_CAP` (40) panels a day; past it the route answers 429 `judge_cap_reached` and Growth holds
  the slot (`docs/COST_GUARDS.md`).

## Growth makes derived carousels (Ruling, Krish, 28 October 2026)

Krish: "take over posting as well as creating new assets like carousels".
This supersedes the 26 October split for carousels and the other derived
posts only.

- Growth makes the derived carousels, Substack Notes, memes and off-day posts
  itself. The off days are Tuesday, Thursday and Saturday on Instagram,
  TikTok and YouTube Shorts; Sunday is a rest day and nothing is published
  (Ruling, Krish, 2026-11-02).
- Everything ready to post is filed in its post's `3 Posts` folder in the
  makeyourmindup library, through `scripts/post-pack/send.py`, never in
  `4 Growth` (Ruling, Krish, 2026-11-03: "everything ready for post goes in
  the posts folder, not the growth folder"). An off-day post's folder is
  `YYYY-MM-DD Ddd off.day - Subject` (`scripts/post-pack/library.py`
  `post_folder` names it so). An off-day post has its own music and look,
  never a series' dress (Ruling, Krish, 2026-11-04: "Yes, give off days
  their own music and look - Rotate."): an off-day track from
  `config/music-library.json` in rotation, the house mint, no series sting. Its board
  card links that folder (`drive`) and names it (`posts_folder`, or
  "3 Posts › <folder>" in its needs); the board calls it not ready until
  both are there and the folder is that day's post.
- It makes them to [CAROUSEL-STANDARD.md](CAROUSEL-STANDARD.md), the
  rejection floor (`python3 scripts/floor.py --format carousel` in this
  repository) and the copy lint (`config/copy-lint.json`, which Growth's
  `release.py` applies to every post it releases).
- Content-engine keeps the standard and the learning that improves it, and
  still makes the hero assets: the article, both cuts, thumbnails and covers.
- A clip from a past week is still cut here. Growth names the moment by word
  range; content-engine cuts it from the approved master and its word clock,
  so the word, caption and brand gates still hold.
- Each off-day option is judged on its own (Ruling, Krish, 1 November 2026,
  locking `docs/handovers/board-mocks-2026-11-01-offdays/`: "Mock looks
  right, lock it and build it"; he asked for "Ideas and a suggested creative
  direction to approve or improve or flat out reject for a reason, and the
  machine can learn over time"). This replaces the one press on the week's
  mix (30 October). The Sunday Off days section shows 4 to 6 options a day,
  each an idea and a suggested creative direction; he approves, improves or
  rejects each side, saved in `queue/off-<day>-<option>`. Growth reads the
  options whose idea and direction he approved from `GET
  /api/board/<Monday>/pieces` (`offdays`, the idea and the direction exactly
  as shown), makes the mock in the brand kit from that direction and returns
  it on the option (`mock`) for his final yes; nothing he did not approve
  goes out. Each option also carries his own words (`note`), exactly as he
  typed them on the board (Krish, 2 November 2026: "it would contain the exact
  meme text to put above the meme video"): Growth uses them word for word and
  never paraphrases them. A week he pressed the old mix on still reads `mix`. His Improve
  and Reject words go to his taste ledger and come back on Sunday as
  `offday_verdicts`. A piece he records himself keeps its own Approve on its
  exact words.
- **Which day an off-day post is on lives in one place** (Ruling, Krish,
  2026-11-12: any off-day post or idea moves to any day at his press, and the
  move updates every place that names its day; `docs/PUBLISH_BOARDS.md`,
  "Moving an off-day item to any day"). The engine's `offday_items` holds it.
  Growth reads each approved option on the day it is on now from `GET
  /api/board/<Monday>/pieces` (`offdays`: `day`, `date`, `item`, `version`,
  `moved_from`) and binds it to that day, never the day it first planned.
  Growth hands its own options over through the engine, not a file the board
  merges: `POST /api/board/<Monday>/offdays` with the `growth-offdays/1` file
  `growth.py mix offdays` writes (or `growth-offdays/2`), on
  `GROWTH_WRITEBACK_TOKEN`; each shows on the live board offered, with Move to…
  and Approve like every other option, and only his press approves it. `GET
  /api/board/<Monday>/offdays` gives back where every item is. When he moves a
  post Growth already scheduled on a platform, Growth moves it only through its
  own approved posting route. Growth writes back every off-day post it makes,
  schedules or posts to the same place, from its own posting record and never
  anything it did not post: `POST /api/board/<Monday>/offday-posts`
  (`{posts: [{option, state: made | scheduled | live | cancelled, channel,
  due_at, url, at, buffer_post_id}]}`). The board shows each one (made,
  scheduled with its time, live with its link) and an approved option Growth
  reports live makes its day done. Until a post scheduled for a day the item
  left is moved, the board says "Still scheduled for Tue 17 on Instagram: move
  it there too".

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
   that. The live board carries the press from view contract 1.8.0: the draft is
   read from `0 Publish/manifest.draft.json` in the post's library folder, every
   file is shown with its Drive link beside the press, and a draft that changes
   after his press needs his press again (`docs/PUBLISH_BOARDS.md`, "Approve for
   publish, bound to the manifest").
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

## Tick the board when a post goes out

Krish, 2026-10-29: "Now that the growth repo takes care of more or less ALL posting, we need the growth repo to keep
the publish board check boxes update with what it has done and when." Growth sends one call per live post:

```
POST https://content.krishraja.com/api/board/<Monday>/posted
Authorization: Bearer <GROWTH_WRITEBACK_TOKEN>
Content-Type: application/json

{"day": "mon", "piece_id": "<content_ideas id>", "channel": "linkedin",
 "post_url": "https://...", "posted_at": "2026-11-09T14:00:00Z", "buffer_post_id": "<Buffer post id>"}
```

- `day` is any day from `mon` to `sun` (an off-day post has its own boxes since 30 October); `channel` is one of
  the board's posting boxes, `substack`, `youtube`, `shorts`, `tiktok`, `reels`, `linkedin`, `spotify`, or one of
  the boxes Growth adds, `instagram`, `x`, `threads`, `facebook`, `substack-notes`. No other field is taken.
  `GET /api/board/<Monday>/pieces`, on the same key, says which piece sits on which day and which boxes it has.
- The piece must be scheduled for that day of that week (`content_ideas.scheduled_for`), or the answer is 409
  `not_this_day` and nothing is written.
- It ticks `<day>-<channel>` (actor `growth`, with every post on that box under `posts`) and records the channel on
  the piece's making record (`channels.<channel>`: `posted_at`, `url`, `buffer_post_id`).
- Idempotent per post: the same `buffer_post_id` again answers `duplicate: true` and writes nothing new. An answer
  with `making_channel: null` means the box is ticked but the making record was not; send the same call again.
- A post Growth has only scheduled is not ticked: it goes to `POST /api/board/<Monday>/offday-posts` as `{piece_id,
  day, state: scheduled | cancelled, channel, due_at, buffer_post_id}` (contract 1.10.0, `docs/PUBLISH_BOARDS.md`,
  "Where everything is"), kept on the day's box for its channel with `done` false, so the day says "Scheduled:
  Substack Notes, from Fri 13 Nov, 12:40" in place of "Ready to post"; a box already out is never touched, and the
  piece must be on that day. growth-makeyourmindup's `board posts` step sends both since its #79 (12 Nov).
- The key opens this route, `offdays` and `offday-posts` (above), and two read-only ones: `pieces`, above, and `build`
  (the week's published build and its manifest). `ENGINE_OPERATOR_TOKEN` also works. It records what Growth posted or
  scheduled; it posts nothing.

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
