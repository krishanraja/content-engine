---
name: cover-art
description: "Make a piece's YouTube, Substack, Shorts, Reels, TikTok and carousel covers with the approved image-led renderer. Use for cover art, thumbnails and first-slide artwork after the piece's words are approved."
model: opus
---

# Make the cover set

Read `docs/ve/cards/library/COVERS-PLAYBOOK.md`. Use the piece's cover-facts, the preceding published cover receipt, and the licensed or approved image inputs. YouTube carries `thumbs.headline` and Substack carries `cover.headline`.

Run `python scripts/covers/make_covers.py PIECE --out DIR`. It walks portrait, evidence, number and object for wide, and portrait, receipt and figure for vertical. It skips the last published family separately for each shape. Portraits require the subject's own story, an eligible Commons licence, the visible credit and confirmation that the story makes no accusation against their company.

Inspect the Substack image and YouTube JPEG at 160 px, then view the 9:16 cover and the carousel first slide at phone size. Check the subject, credit, source and action column. When an input is missing, read the reason and any native-aspect still brief in `covers.json`. For review copies use `--review-dir`.

Give the final reviewer the rendered files and their receipt. After a passing run, set `cover_set` in the post manifest to the receipt path. Record only Krish's actual final decision.
