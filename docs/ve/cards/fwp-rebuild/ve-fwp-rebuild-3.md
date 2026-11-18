---
card: ve-fwp-rebuild-3
kind: docs
model: gpt-6.1-sol
effort: medium
max_minutes: 90
max_calls: 120
cwd: /home/user/dev/makeyourmindup/.worktrees/content-engine/ve-card/ve-fwp-rebuild-3
write_allow: [apps/renderer/src/engine/stills/split/**]
read: [apps/renderer/src/**, config/ve/design-lock.json, config/ve/brand-tokens.json, config/brand-palette.json, docs/ve/cards/fwp-rebuild/**, docs/ve/styles/**, docs/plans/2026-10-26-monday/**]
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Face-with-proof key frames, round 3: the receipt set's two remaining faults

## Goal
Round 3, receipt variant only. Rounds 1 and 2 are on main (apps/renderer/src/engine/stills/split/SplitKeyFrame.tsx; read docs/ve/cards/fwp-rebuild/ve-fwp-rebuild-1.md for the contract). Krish is taking the receipt set; the slam variant is not being polished. The engine's own composition measure (ve comp, the design lock's rules) now passes receipt-face, receipt-proof and receipt-close on fill, edges, small text and the platform column, and fails these, both real:

1. receipt-hook: text in the lock's caption zone. "~$60M A YEAR" sits at baseline y 1250, inside the caption zone (x 60 to 860, y 1090 to 1320), which the engine's own captions use. On every full-frame card no text may stand in that zone. Re-lay the card so it clears it and stays at 80% fill or better: the reference cold open (character-ai-receipts.card.json, layout_frame_use) is mint over y 0 to 986 and the series colour below, two ink cards x 146 to 934, a VS disc on the seam.
2. receipt-hook: "(REPORTED)" touches the bottom edge of its card (text baseline 645, card ends 650). Keep the hedge, with at least 24 px of card below it.
3. receipt-close: the header is broken. An ink block runs behind the logo to about x 644 and the series tag, set in the series colour on the series colour, loses its pill and reads as bare text beside a stray hairline. Make the logo and the series tag each read as intended: the reference end card builds the brand bar first, then the pill. Keep the colours: the series colour over y 0 to 1300, inkDeep below, the headline set left at x 120.

Change nothing of receipt-face, receipt-proof or any slam frame.

## Contract
Same contract as round 1, including the never list. Touch only apps/renderer/src/engine/stills/split/**. Tests: add assertions for each fault (no text box on a full-frame receipt card intersects x 60 to 860, y 1090 to 1320, computed from the numbers you draw with; the (REPORTED) gap; the receipt-close series tag has a background that differs from its field, and a logo that reads). Keep the 21 existing tests passing. If a rule cannot be met, name it in open_questions; ship no caveat.

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/stills/split
node node_modules/typescript/bin/tsc --noEmit --pretty false

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-fwp-rebuild-3", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
