# The cover and thumbnail standard (headline first, fewest parts)

Status: approved. Krish, 2026-11-09: "approve the cover standard as written". It binds every cover and thumbnail made
from now on. It reaches the rejection floor (`floor.py --format cover`) through the Rejections engine
(krishanraja/inspirationhouse), which alone writes `config/rejection-floor.json`; the cover drawer's defaults
(`scripts/pages/receipt.py`, the skins) follow it in part on main, and what is still open is listed under "What
changes in the drawer" (checked 16 Nov 2026).

Applies to: series covers and thumbnails (16:9 long, 9:16 tall, Substack cover, share card, square) and the first frame
of every tall cut. Carousel card 1 keeps its own rule ("the cover card is a scene, not a slide",
`docs/CAROUSEL-STANDARD.md`), with points 1, 5 and 6 below added.

## Why

- Krish, 9 Nov, on Monday's first neon set: "these look terrible. There are so many components here. The headline
  should take precedence. We don't need Warner, Universal, and OpenAI logos anywhere on here. We don't need the badge
  that says "the court filing." The "Follow the Money" badge doesn't need to be that big."
- Krish, 7 Nov: "I also think that the thumbnails need to be managed better. You can see that the Chinese AI thumbnail
  is not really at the top of its game." (dark stock photo, low-contrast headline, top line cut by the Instagram grid.)
- What did well: on the 7 Nov grid, the bright tiles with one big headline and one real thing (Monday 2 Nov's chart,
  the "What could you hand to AI this week?" carousel) beat the dark photo covers.
- Cause: the cover drawer adds every logo, a proof tag and a large series pill by default. Nothing asked for the
  headline to lead or for each part to earn its place.

## The standard

1. **The headline leads.** It is the largest thing on the cover and readable in under a second at grid size
   (about 130 px wide on a phone). At most 7 words; one word may be picked out in the series colour.
2. **At most three parts besides the headline**, chosen from: one picture (the real artifact or a scene), up to three
   logos, the series label. The default is fewer: anything that does not make the headline land faster is left off.
3. **Logos only for the companies the headline or the picture names.** Never a logo for a company the story only
   mentions in passing (so Google, Disney and Character.AI on 9 Nov; never Warner, Universal or OpenAI). Always the
   product's own mark, never a parent company's (already approved). Logos sit below the headline, smaller than it.
4. **No badges or proof tags on a cover** ("the court filing", "source", "exclusive"). The proof is in the piece.
5. **The series label is quiet:** small, in the series colour, at most about 4% of the cover's height, never a large pill.
6. **Bright and high-contrast over dark and muddy.** The house ground or the series colour, the headline at full
   contrast. No dark stock photo behind the headline.
7. **Checked where it will be seen** before Krish sees it: the Instagram profile grid crop (3:4 of the tall cover) and
   account row, the caption zone, and a YouTube results row, using `scripts/channel_safe.py`. Nothing important under
   a button or cut by the crop, including the logo row.
8. **Two or three options, never one,** each shown in a mock of his grid beside the last five posts.

## What changes in the drawer if approved

- `receipt.py` defaults flip: no proof tag, quiet series label, headline first, logos only from a `named` list in the
  cover facts (empty by default). On main (checked 16 Nov 2026): `show_tag` is off and `quiet_pill` on by default;
  `headline_first` is opt-in until the extruded, bauhaus and brandbook skins keep their light off logos under the
  words; the `named` logo list is not built, so logos still come from the cover facts' `rows` and `strip`.
- The tall safe box moves the logo row out of Instagram's caption zone (found on every tall thumbnail, 9 Nov).
- `channel_safe.py --shape cover_tall` checks a tall cover against Instagram's 3:4 profile grid crop and its account
  row (7 Nov).

What is still open lands after the freeze (from 16 Nov) unless he says otherwise.

## One older approval this narrows

On 10 Oct he said: "I love it, but we need to add all the logos of the busineses that are related to what we are
talking about." Point 3 narrows "related" to the companies the headline or picture names. If he wants the wider rule
kept for some formats, say which.

## His answer

Approved as written, so the ceilings stand: 7 words (point 1) and three logos at most (point 3).

## Every posted video carries its designed cover (Ruling, Krish, 15 November 2026)

His words, on the Rat tails reel: "the thumbnail is ridiculously poor, and that must never be the case." The 14 Nov
Instagram repost went out through Buffer with no cover set, so Instagram showed the cut's opening frame, an AI scene
with no headline and no wordmark, while his own native posts the day before showed the designed cover.

- Every video posted on any platform, on every post and repost, shows its own designed cover in the grid and the player:
  the approved vertical cover for a tall cut, the wide thumbnail for a wide cut. Never an auto-picked frame, the opening
  frame, an AI scene or a blank.
- The piece manifest names it: each channel that posts a video (instagram, facebook, tiktok, youtube, threads, x)
  carries `cover: {asset, sha256, cover_offset_ms}` (`config/schema/piece-manifest.schema.json`,
  `scripts/post-pack/piece_manifest.py`, which refuses a video channel without it), so the posting route knows which
  image is the cover.
- A route that can set a cover image posts with that image. Buffer cannot: it takes only a frame time
  (`thumbnailOffset`). A route like that may post the video only when the designed cover is built into the cut as its
  final frames, `cover_offset_ms` says where, and its `thumbnailOffset` equals it; otherwise the post is held. Growth
  owns the posting side and implements that hold.
- One canonical tall cover per cut: a tall cover's headline passes `title_check.py` on the piece's own words, which
  refuses "they", "it" or "this" standing in for a name (Krish, 2026-11-15: '"They Faked AI Use" is a terrible title.
  It's not clear, and it's way too vague. Words like "they" are not welcome in these types of titles.').

## Face-led covers on his own accounts (Ruling, Krish, 17 November 2026)

His words, answering the channel plan: "yes to the face plan", then "actually use codex to draw". The reference he sent
was a Rio Meets thumbnail: two cutout faces large either side, the headline huge between them.

| Channel | Cover |
|---|---|
| His own accounts: TikTok @therealkrisho, X @TheRealKrisho, LinkedIn, Threads, Substack Notes | Face-led: his cutout headshot over about a third of the frame on the series colour, never a small circle; the headline still leads (points 1 to 6 above hold). His name never appears. |
| YouTube @makeyourmind-up | A test: the Receipt against face-led on every long video (YouTube's Test & Compare), click rate reported by Growth. |
| Instagram @makeyourmind.up, the Facebook Page, the Substack cover and share card | The Receipt, unchanged. |

It runs four weeks, then Krish decides from the numbers. This narrows THE_RECEIPT's "never his face" (2 Nov) to the
brand accounts. The photos come only from his cutouts (`scripts/post-pack/photos.py fetch`, published from
Video Engine > Krish Clone - Assets > Photos by the home computers), and Codex draws the options from a `ve card` of
kind `cover` (`scripts/velib/cards.py`), checked with `scripts/channel_safe.py` and judged by the thumbnail-critic.
