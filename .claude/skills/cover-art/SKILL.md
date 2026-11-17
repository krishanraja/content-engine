---
name: cover-art
description: "Make a piece's cover art for every channel it posts on, by the channel strategy Krish approved on 17 Nov 2026: the face-free Receipt in the week's rotating skin on the brand accounts (Instagram, Facebook, Substack), a face-led cover on his own accounts (TikTok, X, LinkedIn, Threads, Substack Notes), and both on YouTube as an A/B test. Face-led covers rotate between two variants: his real cutout with the piece's own figure, and a generated headshot panel with a generated scene. Codex draws them from a ve card of kind cover; a separate critic judges them; Krish picks. Use when a piece needs its covers or thumbnails for more than one channel, or when Krish asks for cover art, face covers or the cover rotation. Not for the working thumbnails drawn before he records (make-piece), carousel cards, memes or Notes images; the Receipt itself is drawn by thumbnail-designer, which this skill calls."
model: opus
---

# Cover art, by channel

One job: every channel a piece posts on gets the right cover, drawn to the rules below, judged by a reader that did
not draw it, and picked by Krish in his own words. Nothing is filed as a cover before he answers, and nothing here
posts, sends or publishes.

## The channel strategy (Ruling, Krish, 2026-11-17: "yes to the face plan")

| Channel | Account | Cover |
|---|---|---|
| Instagram @makeyourmind.up, Facebook Page, Substack cover and share card | Brand | The Receipt in the week's skin (thumbnail-designer). Never his face. |
| TikTok @therealkrisho, X @TheRealKrisho, LinkedIn, Threads, Substack Notes | His own | Face-led, in the week's face variant (below). His name never appears in the post text. |
| YouTube @makeyourmind-up | Brand | Both: the Receipt and the face-led cover, as YouTube's Test & Compare pair; Growth reports click rate. |

It runs as a four-week test from 17 Nov 2026; then Krish decides from the numbers. A new channel takes the row its
account type matches; ask him once if it fits neither.

## The two rotations

- **Face-free:** the nine Receipt skins, one per week (`scripts/pages/skins/__init__.py`, `ORDER`: neon, sunburst,
  painted_scene, series_worlds, bauhaus, papercut, extruded, brandbook, memphis; from the week of 9 Nov 2026).
  thumbnail-designer draws them; nothing here changes that.
- **Face-led:** two variants, alternating by ISO week so both are tried (Krish, 2026-11-17: "agreed on trying both and
  rotating"). Odd weeks **real**, even weeks **generated**; a piece can name the other in its brief.
  - **Real:** his cutout headshot plus the piece's own figure or proof (its `2 Covers and images` folder in the
    library), the figure once, as a crisp card, at most 4 degrees of tilt, partly behind his shoulder.
  - **Generated:** a generated headshot of him as a full-bleed photo panel (wide: the right 45%; tall: the lower half),
    the piece's generated scene filling the rest behind the headline under a flat near-black overlay of about 70%.

## Rules every face-led cover keeps

1. **The headline leads** (`docs/production/COVER-STANDARD.md`, points 1 to 6): the largest thing, at most 7 words,
   the quiet series label above it, the series colour, bright over the near-black ground.
2. **The wordmark is the official file**, `apps/cover/public/brand/wordmark.png` in krishanraja/makeyourmindup (sha256
   `f896cc62...`, as `config/brand-palette.json` marks it), scaled only, on the near-black only (it disappears on
   yellow), left-aligned on the headline's edge, under it (Krish, 2026-11-17: "we do need the makeyourmindup wordmark
   somewhere that looks good and aligned properly").
3. **His shoulders are never cut off on the colour** (Krish, 2026-11-17: "the fact that my shoulders cut off is
   unacceptable"). No edge of a photo may show inside the canvas. A cutout touching only its bottom edge (the
   "Restored portrait with natural shoulders") sits on the canvas bottom; any other cutout is placed so every row
   where its alpha meets its sides lies below the canvas bottom; a generated headshot is a full-bleed panel whose edges
   are the canvas edges. The drawing script asserts it.
4. **His face takes about a third of the frame**; the headline still leads in the 3:4 grid crop.
5. **Classy:** generous margins, nothing else on the cover. No glow, neon, gradients, arrows, emoji, badges or logos
   the headline does not name.
6. **Checked where it is seen:** `python3 scripts/channel_safe.py --shape cover_tall` on every tall file.

## Where his face comes from

- **Real photos:** only the files at the top of his Drive folder "Photos" (`1PQDSg4_kD6zwVerqvxaiQE5Ocjnsd6xB`, in
  Video Engine > Krish Clone - Assets), never its subfolders, for the cover itself (Krish, 2026-11-17). Its subfolder
  "All other photos" (never the DO-NOT-USE folder inside it) is for his likeness profile and generated headshots only
  (`photos.py fetch --references`; krish-clone `clone faceprofile`). The home computers publish them to
  the library every pass (`scripts/post-pack/photos.py publish`); a cloud session gets them with
  `python3 scripts/post-pack/photos.py fetch --out <folder>`.
- **Generated headshots:** made from those references on Higgsfield (`gpt_image_2_6`, about 0.25 credits a still by
  the connector's `get_cost`; say the cost before generating). A generated headshot of him is used on a cover only
  once he has approved that still in his own words and krish-clone records it (`clone registry`); until then it is
  shown to him as an option, never filed. How to close the last 10% of his likeness is krish-clone's
  `docs/GENERATORS.md`, "His likeness in stills": his words per still, one attribute edited at a time, re-measured
  with `clone likeness`.
- **Generated scenes** for a piece: classy editorial stills, no people, no text, no logos, never a fake of a real
  event or document. Real proof beats a generated scene whenever the piece has one.

## Steps

1. Read the piece's headline (his picked words), series and date, and list its channels against the table above.
2. **Receipt shapes:** call thumbnail-designer for the brand-account and YouTube Receipt files.
3. **Face-led shapes:** pick the week's variant; gather the photo (and, for generated, the approved headshot and the
   scene); copy them into the card's worktree; write one `ve card` of kind `cover` (`scripts/velib/cards.py`; fields:
   `channel`, `photos`, `date`, `references`) and dispatch it to Codex (`python scripts/ve.py dispatch <card> --wait`).
4. **Check it yourself:** look at every file at full size, rerun `channel_safe.py`, and confirm no photo edge shows.
   Codex's own report is never proof.
5. **Separate critic:** the `thumbnail-critic` agent, given each file's full sha256.
6. **His pick:** send him the options (`SendUserFile`) and record his choice in his own words. Report his words on the
   design to `report_to_taste_engine`.

## Walls

Nothing here posts, sends, schedules or publishes. His face reaches a new provider only with his yes by name. No
spend beyond what he approved for the job, stated before the call. Never draw his name. Never use a photo from the
Photos subfolders.
