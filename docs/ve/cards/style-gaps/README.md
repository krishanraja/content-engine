# Style gaps: the devices his three style cuts need

Each `*.fields.json` here is a Codex card's fields (`ve card` turns it into the card). They come from the `gaps` in the
three study cards of Krish's own cuts, which he named as styles on 13 Nov 2026 (`docs/ve/styles/*.card.json`).

| Card | Device | From | What it draws |
|---|---|---|---|
| `ve-gap-receipt-print-1` | `receipt_print` | Character.ai | a receipt that rises and tilts, and prints each line with a 2 px jolt and a ghost |
| `ve-gap-slam-word-1` | `slam_word` | Character.ai | one word from 250% to 100% in 3 frames, caution tapes, a confetti burst |
| `ve-gap-checklist-1` | `checklist` | Character.ai | numbered slots that arrive blank and fill one by one |
| `ve-gap-pull-quote-1` | `pull_quote` | eating its own jobs | grey to cream word by word, then a highlight sweep |
| `ve-gap-unit-field-1` | `unit_field` | eating its own jobs | unit marks that drop, grey or copy |
| `ve-gap-countdown-ghost-1` | `kinetic_stat` (ghost) | eating its own jobs | a count-down that leaves a ghost of the value it left |
| `ve-gap-video-wall-1` | `video_wall` | AI music | clips as tilted, shadowed cards; a 3x2 wall that fills a tile every 6 to 7 frames |
| `ve-gap-mint-ring-1` | `mint_ring` | AI music | a hand-drawn mint ring round a value |
| `ve-gap-takeover-1` | `takeover` | AI music | a full-frame title card with a split flicker and a light streak |

The ladder that keeps its state across beats is `docs/ve/cards/through-line/` (`through_line`).

**How to dispatch them (a home computer; `ve card` reads the local roots, so not a cloud session):**

1. `python scripts/ve.py card docs/ve/cards/style-gaps/<card>.fields.json` writes the card with its `## Motion style`
   section from `motion_style`.
2. Dispatch it through the lane (`ve lane queue`, then the home computer builds), with a Control Center booking.
3. `python scripts/ve.py verify-card <card.md> --cwd <worktree>`.
4. Render the lab window with the device on its style and staging, then watch it beside his cut before he sees it.

They follow the engine freeze rules: no renderer change lands during a piece (F33), and during a piece Codex makes only
that piece's named plates (F39).
