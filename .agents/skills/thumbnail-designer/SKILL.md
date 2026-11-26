---
name: thumbnail-designer
description: "Produce and check the recorded piece's wide and tall thumbnails from its approved cover-facts, using the same image-led system as cover-art. Use when a piece needs its final YouTube thumbnail or Shorts, Reels and TikTok cover."
model: opus
---

# Make the thumbnails

Use `docs/ve/cards/library/COVERS-PLAYBOOK.md` for family selection and photo rights. Read the approved wording in the piece's `thumbs.headline`, the sourced figure, proof crop and previous published families. Keep every word tied to the facts.

Run `python scripts/covers/make_covers.py PIECE --out DIR`. The wide JPEG and tall JPEG are part of the same render as the Substack cover, vertical PNG and carousel first slide. Use `--wide` or `--vertical` for a single system. A missing still produces a native-aspect Codex brief in `covers.json`.

At 160 px, check the wide headline, source and subject against the accepted treatment. At phone size, check words and marks in y 330 to 1180, the subject in the 3:4 crop, and the proof clear of the Reels buttons. A separate reviewer inspects the rendered, credited images and carries gate failures to final review. A held receipt keeps the files out of the post pack.

## Allowed asks

Use the final review in `config/ve/asks.json` for Krish's decision. Record his exact words on the piece.
