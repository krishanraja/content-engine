---
name: meme
description: "Make a makeyourmindup meme, video or static, to a guaranteed floor with creative freedom above it. Meme videos are template reskins (the original clip at full frame, credited, his caption on a clean band in the brand palette, 9:16 and 4:5, the social_clip receipt); static memes meet the carousel card standard. Use whenever a meme is made, reskinned or reviewed. Not for carousels (carousel), covers (cover-art) or voiceover shorts."
model: opus
---

# Make a meme

Krish, 2026-11-17: one skill the system uses "by guarantee to meet minimum standards but can still use its creative
freedom to improve upon and experiment with", and "we dont have standards for meme videos yet but we have just begun to
upgrade this". The floor below is what exists and is checked today (`docs/MEME-STANDARD.md`, approved 17 Nov, and the
meme rules in `docs/CAROUSEL-STANDARD.md`); it grows as he judges finished memes. Everything above it is open.

## The floor (guaranteed; each line is checked)

**Meme video (a template reskin, on the ve route from a Claude session)**

1. The original clip at its full frame, scaled to fit, never cropped at the sides (his words, 2 Nov: "the sides of the
   original video have been cut off, which makes the video less funny"); the space left is the caption band and the
   house ground, never a blurred or stretched copy. Receipt check `full_frame`.
2. Only his caption, verbatim where he quoted it, in the house typeface at carousel grade, at most two lines, on a solid
   caption band in the palette (`config/brand-palette.json`); never a system font or a meme-generator outline.
   Receipt check `caption_band`.
   Never first person: always "When you realize..." or "POV: you realize..." (Krish, 18 Nov).
3. The wordmark small, just under the clip and right-aligned to the video's right edge, on the house ground, never
   over the clip or in the band (Krish, 18 Nov: "right aligned to the video"), and a credit line naming the original. Receipt check
   `credit_line`.
4. Two shapes laid out separately: 9:16 (`meme_tall`, centred: `python3 scripts/layout_centre.py FILE`) and 4:5.
5. The clip's own sound, no music bed (Krish, 17 Nov: "Video memes keep their original sound"), loudness at the house
   target.
6. Every word and mark clear of each channel's buttons and caption area (`config/channel-safe-zones.json`).
7. Filed only with a passing social_clip receipt (`scripts/quick-edit/quality.py`, `social_clip_problems`, plus
   `MEME_TEMPLATE_CHECKS`), naming the clip it reskins, and watched and heard by a reviewer who did not make it.

**Static meme**

8. Meets the carousel card floor (the `carousel` skill, lines 6 to 8 and 11): sharp picture, house type and palette,
   the mark rule, no subchannel colour; made as a Codex card of kind `meme`, checked at full size and phone size.

**Every meme**

9. No subchannel colour or name; the mark the only branding (no masthead, series label or URL footer).
10. Funny first, and true: no invented quote, screenshot or result passed off as real.
11. Read `python3 scripts/floor.py --format meme` before the brief; any new rejection he gives goes into the standard
    the same day, so the floor only rises.

## The freedom (expected, not optional)

Meme videos are being upgraded, so experiment on purpose: caption band treatments, timing of the caption against the
beat, a held final frame for the punchline, a cleaner credit, a second static from the same joke. Name the experiment in
one line in the record and in the report to Krish; keep the ones he likes by writing them into
`docs/MEME-STANDARD.md` with his words. Never experiment with a floor line without asking him.

## Steps

1. Read his caption and the clip's page; confirm the joke reads cold, in one look.
2. Build on the ve route (memes) or as a Codex card of kind `meme` (statics); make both shapes.
3. Verify: the receipt, `layout_centre.py`, the safe areas, a full watch with sound; a separate reviewer watches it.
4. File through `send.py` to the day's `3 Posts` folder, report on the board, send it to Krish, record his words.
