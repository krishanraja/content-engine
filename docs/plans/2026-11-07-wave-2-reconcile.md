# W2.1: reconciling the published record (6 to 26 October 2026)

Read on 29 October 2026, read-only: the publication's public archive
(`home.makeyourmindup.ai/api/v1/archive`), `content_ideas`, and the board's
documents and ticks. Nothing was written to production.

## What the record says, and what is live

| Day | Piece | Record now | Live post (public archive) | How it reconciles |
|---|---|---|---|---|
| Tue 6 Oct, the Launch | none on the record | no row | newsletter, 6 Oct 06:42 UTC, `/p/welcome-to-my-new-ai-media-channel` | not added: Krish said no (29 Oct) |
| Fri 16 Oct, mind.the.gap | `904658db` | review, no URL | newsletter, 19 Oct 09:50 UTC, `/p/why-claude-and-chatgpt-model-launches` | publish-watch now matches it by schedule on its next hourly pass after merge (proven by a read-only dry run of the new matcher on the live archive) |
| Wed 21 Oct, under.the.hood | `d7a20885` | drafting | video post, 24 Oct 05:54 UTC, `/p/can-metas-muse-or-grok-bot-run-my` | Krish: it is this piece. Recorded on the piece (29 Oct, `posted substack`); the watcher marks it published by address |
| Fri 23 Oct, mind.the.gap | `7083d6ad` | drafting | not on Substack | Krish: never went live; finished 28 Oct and stays unpublished. Nothing recorded |
| Mon 26 Oct, follow.the.money | `b358e788` | drafting | not on Substack | Krish: never went live; finished 28 Oct and stays unpublished. Nothing recorded |

No board link box (`links/<day>`) and no done publish tick was saved for any of
these four pieces, so the board holds no record of them either.

## Why the record fell behind, and the fix

The watcher matched a post only by its address or by an exact title. Each of
these posts went out under a title changed in Substack, or as a video post with
no article, and the one question it raised for a session went unanswered. The
watcher now also matches a post to the one made, unpublished piece that was due
on the post's day or up to three days before it (`SCHEDULE_DAYS`,
`apps/control-plane/api/_publishWatch.ts`); two such pieces are ambiguous and
write nothing. A video post matches by schedule only, never by title.

## His answers (29 October 2026, relayed by the Wave 2 orchestrator)

- The Launch is not added as a published record ("no").
- The 24 October Muse/Grok video belongs to the 21 October piece. Recorded with
  `making.py d7a20885-7001-4661-b444-9d7ca1043416 posted substack https://home.makeyourmindup.ai/p/can-metas-muse-or-grok-bot-run-my`;
  the piece's record now reads Published 1 of 5 channels.
- The 23 and 26 October pieces never went live. They stay unpublished; the watcher
  needs no change, because with the 21 October piece matched by address the
  24 October post is no longer ambiguous, and a later post for either piece is
  matched the usual way.

## Once Krish answers (the route, kept)

Each answer is recorded on its piece with the existing route, and the watcher
then marks it published by address within the hour:

    python scripts/post-pack/making.py <piece id> posted substack <the post link>

The Launch needs a published `content_ideas` row first; that is a record write
to production, made only after his yes.
