# Meme standard

What a meme is made to, from the 30 Nov 2026 board. Linked from `docs/CAROUSEL-STANDARD.md` and
`.agents/skills/plan-week/references/offdays.md`; the ideas side, the meme templates lane, is
`.agents/skills/plan-week/references/meme-roaster.md`.

## Why (Ruling, Krish, 17 November 2026)

His words, looking at Sat 21 Nov's board: "And lets bring up the production value of the meme to looking more like the
production quality of the rest of the carousels etc." Asked about the footage, he chose the original clip, credited,
his caption on top, like the translator meme. That overrides "a meme is made fresh in the brand kit ... never reposts
the clip itself" for meme templates only: every other meme is still made fresh.

## Meme videos: a template reskin

Made on the ve route from a Claude session, as every meme video is (Ruling, Krish, 2026-11-13: "memes and Notes images
should go the same way"; `docs/CAROUSEL-STANDARD.md`, "How a carousel is made"). Never a scheduled job, a headless
model run or a template engine.

- **The original clip at its full frame.** Never cropped at the sides (Krish, 2026-11-02: "the sides of the original
  video have been cut off, which makes the video less funny"). The clip is scaled to fit inside the frame, and the
  space it leaves is the caption band and the house background, never a stretched or blurred copy of the clip.
- **His caption, in the house type, on a clean caption band.** The band is a solid field in the brand palette
  (`config/brand-palette.json`, the one source of every colour, mark and sting: `docs/production/BRAND_PALETTE.md`),
  above the clip, and the caption is set at carousel-grade typography: the house typeface and weights, sized to read at
  phone size, at most two lines, never a system font or a meme-generator outline. Only his words are set, and only
  words he put in quotation marks are set verbatim (`references/offdays.md`, "His presses").
- **The caption speaks to the viewer, never as "me".** Never first person: always "When you realize..." or
  "POV: you realize..." (Krish, 2026-11-18: "Never first person, always 'When you realize...' or 'POV: you realize...'").
- **The mark and the credit.** The makeyourmindup wordmark small, just under the clip and right-aligned to the video's own right
  edge, on the house ground, never over the clip and never in the caption band (Krish, 2026-11-18: "the wordmark always
  goes right aligned at the bottom on memes", then "right aligned to the video"). On the tall shape the clip keeps to the
  caption band's column, clear of the apps' action rail, so the mark under it is too. The mark comes from the house brand files only (the
  Tuesday meme rule in `docs/CAROUSEL-STANDARD.md`), and a small credit line naming the original ("Original: ..."),
  inside the safe area.
- **Two shapes.** 9:16 (the palette's `meme_tall`, centred as "The tall meme is centred" says, `scripts/layout_centre.py`)
  and 4:5, each laid out for its own shape, never one cropped from the other.
- **Sound.** Loudness normalised to the house target the ve route measures, the clip's own sound kept unless his note
  says otherwise.
- **Safe areas.** Every word and mark clear of each channel's buttons and caption area
  (`config/channel-safe-zones.json`).
- **The receipt.** It files with the social_clip receipt (`scripts/quick-edit/quality.py`, `social_clip_problems`):
  heard, loudness, visuals, a full review, the source named and his approval in his words. A template reskin's receipt
  also names the clip it reskins (`template.page`, https) and passes three more checks (`MEME_TEMPLATE_CHECKS`):
  `full_frame` (nothing cut at the sides), `caption_band` (with `palette` naming `config/brand-palette.json`) and
  `credit_line` (with its `text`). A reviewer who did not make it watches it before it is called ready.

**How the board's prompt reaches it.** A meme option that carries a template clip (`template`, contract 1.24.0) gets the
reskin route in its Claude production prompt (`apps/control-plane/api/board/_makeRoute.ts`, route `reskin`): the exact
clip to download and its page, the credit, and his caption (the option's note), then the steps above. It was sent down
the carousel route on 18 Nov because its plan wrote the format as an image (Krish, 2026-11-18: "It tries to produce a
carousel, when we actually want to make a meme - download that exact video, reskin it, put our caption, and the
wordmark in the bottom right corner").

## Static memes

A static meme is no longer "the house two-panel drawn fresh": it meets the carousel standard. The same type, the same
palette and the same picture quality as a carousel card (`docs/CAROUSEL-STANDARD.md`: sharp pictures, the brand mark
rule, no subchannel colour), made as a Codex card of kind `meme` from a Claude session and verified at full size and
at phone size before it is filed.
