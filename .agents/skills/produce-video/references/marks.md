# The marks on a video: one wordmark, no sub brands

Reference for the `produce-video` skill, read at the step that names it (`.agents/skills/produce-video/SKILL.md`). Written on 27 November 2026, when Krish ruled on the marks a video carries.

Ruling (Krish, 2026-11-27): "agree", to each of these four recommendations
(`config/brand-palette.json` `marks_rule`, learning `one-wordmark-per-video`):

1. "The opening title of a video carries no wordmark. S3h on the v5 outro is
   the only wordmark per video." In place from 26 Nov: ve compile marks
   `titleMoment.wordmark` false and `FormatMaster.tsx` (`titleWordmark`) draws
   the lockup without one.
2. "Remove the V4 wordmark from the wide quick-edit frame ... and from the
   why-ladder title card. The outro carries the brand." From 27 Nov
   quick-edit's `frame-16x9.png` (`scripts/quick-edit/kit-v5/v5-frame.html`,
   `page_frame16`) draws no V4 behind the speaker, and ve's why-ladder title
   card (`apps/renderer/src/engine/v5/Cards.tsx` `v5_title`) draws none under
   the title (props `titleCardMark` false).
3. "Remove the series-name pills ("follow.the.money" and the like) from the
   body sections of wide videos." His earlier words, 26 Nov: "the sub brands
   do not need to feature". From 27 Nov no beat carries one: ve's
   `ChannelPill` and the `StageHeader` pill (props `seriesPill` false) and the
   quick-edit wide panel pill (`page_panel`).
4. "The 9:16 outro stays at 2 s, settled by 1.33 s. Do not lengthen it to the
   template's 3.6 s." ve compile `ENDING_FRAMES_BY_ASPECT` gives the tall close
   60 frames, quick-edit's kit 2 s, and the palette's `statement_beat` runs at
   most 2 s.

**Dated cuts.** A cut dated before 27 Nov renders exactly as it was signed
(F33): ve compile adds neither `seriesPill` nor `titleCardMark`, ve render
refuses props of such a cut that carry either, and quick-edit keeps V4 on its
frame and the pill on its wide panels. A quick-edit piece with no readable date
is drawn bare.

**The guards.** `ve lint` (`scripts/velib/guards.py` `marks_problems`,
`marks.one_wordmark`) refuses a spec dated from 27 Nov that names V4 (its file
or sha256, either drawing) or asks for a body logo, a series pill or a
wordmark on the title. `ve render` (`scripts/velib/compile.py`
`marks_problems`) refuses props dated from 27 Nov with `bodyLogo` true,
`seriesPill` or `titleCardMark` not false, a title lockup without
`wordmark: false`, or V4 named anywhere outside `props.brand`. The palette
(`scripts/brand_palette.py`) asks for no series pill on any beat from 27 Nov.
