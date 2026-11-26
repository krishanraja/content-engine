---
name: cover-art
description: "Make a piece's cover art for every channel it posts on, by the channel strategy Krish approved on 17 Nov 2026, rendered by the approved image-led cover systems with scripts/covers/make_covers.py: the face-free covers on the brand accounts (Instagram, Facebook, Substack), a face-led cover on his own accounts (TikTok, X, LinkedIn, Threads, Substack Notes), and both on YouTube as an A/B test. Face-led covers rotate between two variants: his real cutout with the piece's own figure, and a generated headshot panel with a generated scene. Codex draws them from a ve card of kind cover; a separate critic judges them; Krish picks. Use when a piece needs its covers or thumbnails for more than one channel, or when Krish asks for cover art, face covers or the cover rotation. Not for the working thumbnails drawn before he records (make-piece), carousel cards, memes or Notes images; the Receipt itself is drawn by thumbnail-designer, which this skill calls."
model: opus
---

# Cover art, by channel

**Every face-free cover comes from the approved cover systems** (Ruling, Krish, 2026-11-26: "I approve the new cover
thumbnail systems, go"). Read `docs/ve/cards/library/COVERS-PLAYBOOK.md` and `ART-DIRECTION.md` first. Render with
`python3 scripts/covers/make_covers.py docs/plans/<plan> --out DIR`: one run writes the Substack cover, the YouTube
thumbnail, the 9:16 cover, the tall thumbnail and the carousel first slide, with a `covers.json` receipt that
post-pack reads (`cover_set`). The wide system walks portrait, evidence, number and object; the vertical system walks
portrait window, receipt and figure; each takes the first family the facts support that differs from the previous
published piece's. A portrait needs a licensed Commons photo (Public domain, CC0, CC BY or CC BY-SA), the person's own
story, no accusation against their company, and the visible credit. A missing still writes a native-aspect brief into
`covers.json` for Codex. Never draw a cover freehand, and never in a retired skin or template: the weekly skins,
v5_feed and the old Library cover templates are retired (`config/retired-styles.json`, `library.json`), and
`scripts/pages/build.py --cover`/`--thumbs` refuses without `--legacy`, which is only for an archived piece.

One job: every channel a piece posts on gets the right cover, drawn to the rules below, judged by a reader that did
not draw it, and picked by Krish in his own words. Nothing is filed as a cover before he answers, and nothing here
posts, sends or publishes.

## The channel strategy (Ruling, Krish, 2026-11-17: "yes to the face plan")

| Channel | Account | Cover |
|---|---|---|
| Instagram @makeyourmind.up, Facebook Page, Substack cover and share card | Brand | The image-led cover set (`make_covers.py`). Never his face. |
| TikTok @therealkrisho, X @TheRealKrisho, LinkedIn, Threads, Substack Notes | His own | Face-led, in the week's face variant (below). His name never appears in the post text. |
| YouTube @makeyourmind-up | Brand | Both: the image-led wide thumbnail (`make_covers.py`) and the face-led cover, as YouTube's Test & Compare pair; Growth reports click rate. |

Krish approved this palette, its channels and its rotation on 17 Nov 2026, on the approval pack ("this looks god to
me"). It runs as a four-week test from 17 Nov 2026; then Krish decides from the numbers. A new channel takes the row its
account type matches; ask him once if it fits neither.

## The two rotations

- **Face-free:** the image-led families, picked automatically by `scripts/covers/make_covers.py` so two consecutive
  pieces never share a composition. Other Library items a channel needs (`newsletter-substack-feed`, `social-square`)
  are filled by `scripts/library/make_piece.py`. The weekly skins (neon to memphis), v5_feed and the old cover
  templates are retired; variety comes from the families and ART-DIRECTION.md's rotations, never from a skin.
- **Face-led:** two variants, alternating by ISO week so both are tried (Krish, 2026-11-17: "agreed on trying both and
  rotating"). Odd weeks **real**, even weeks **generated**; a piece can name the other in its brief.
  - **Real:** his cutout headshot plus the piece's own figure or proof (its `2 Covers and images` folder in the
    library), the figure once, as a crisp card, at most 4 degrees of tilt, cropped to the one proof that reads at
    phone size (its title and its number) and set in its own space: under the headline on the left in wide, between
    the wordmark and his head in tall. Neither covers the other: no part of the figure behind his head or over his
    face (Krish, 2026-11-18: "The screenshots hide behind my head a little bit too much here."). Text inside the
    figure stays clear of the channel rails too (`scripts/channel_safe.py`).
  - **Generated:** a generated headshot of him as a full-bleed photo panel (wide: the right 45%; tall: the lower half),
    the piece's generated scene filling the rest behind the headline under a flat near-black overlay of about 70%.

## Rules every face-led cover keeps

The headline leads; the official wordmark on near-black; his shoulders never cut off and no photo edge inside
the canvas; his face about a third of the frame; nothing decorative; `channel_safe.py --shape cover_tall` on every
tall file. The six rules in full, with Krish's words: `.agents/skills/cover-art/references/face-rules.md`.

## Where his face comes from

Only the top-level files of his Drive folder "Photos" for the cover itself, generated headshots only once he
has approved that still in his own words, and generated scenes with no people, text or logos. Read
`.agents/skills/cover-art/references/face-sources.md` before any face-led cover.

## Steps

1. Read the piece's headline (his picked words), series and date, and list its channels against the table above.
2. **Face-free shapes:** `python3 scripts/covers/make_covers.py docs/plans/<plan> --out DIR` for every brand-account
   cover and the YouTube and tall thumbnails (thumbnail-designer runs the options round). The 160 px gate runs inside
   it; a held `covers.json` names what failed.
3. **Face-led shapes:** pick the week's variant; gather the photo (and, for generated, the approved headshot and the
   scene); copy them into the card's worktree; write one `ve card` of kind `cover` (`scripts/velib/cards.py`; fields:
   `channel`, `photos`, `date`, `references`) and dispatch it to Codex (`python scripts/ve.py dispatch <card> --wait`).
4. **Check it yourself:** look at every file at full size, rerun `channel_safe.py`, and confirm no photo edge shows.
   Codex's own report is never proof. Then the antislop PASS/FAIL report (`.agents/skills/antislop/ADAPTER.md` first, then the skills it names) on each file: fix each FAIL no house rule
   overrules.
5. **Separate critic:** the `thumbnail-critic` agent, given each file's full sha256.
6. **His pick:** send him the options (`SendUserFile`) and record his choice in his own words. Report his words on the
   design to `report_to_taste_engine`.

## Walls

Nothing here posts, sends, schedules or publishes. His face reaches a new provider only with his yes by name. No
spend beyond what he approved for the job, stated before the call. Never draw his name. Never use a photo from the
Photos subfolders.
