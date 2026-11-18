---
card: ve-fwp-rebuild-2
kind: docs
model: gpt-6.1-sol
effort: medium
max_minutes: 120
max_calls: 160
cwd: /home/user/dev/makeyourmindup/.worktrees/content-engine/ve-card/ve-fwp-rebuild-2
write_allow: [apps/renderer/src/engine/stills/split/**]
read: [apps/renderer/src/**, config/ve/design-lock.json, config/ve/brand-tokens.json, config/brand-palette.json, config/logo-registry.json, docs/ve/cards/fwp-rebuild/**, docs/ve/styles/**, docs/ve/design/**, docs/plans/2026-11-11-wednesday/**, docs/plans/2026-10-26-monday/**]
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Face-with-proof key frames, round 2: fix the seven verified faults in the eight stills

## Goal
Round 2 of ve-fwp-rebuild-1 (read docs/ve/cards/fwp-rebuild/ve-fwp-rebuild-1.md: same goal, same contract). Round 1 is on main: apps/renderer/src/engine/stills/split/SplitKeyFrame.tsx. Claude rendered all eight on real plates and a separate reader judged them: receipt-proof, slam-face and the upper half of receipt-hook pass and stay as they are. Fix only these verified faults, in place:

1. Dead ground on the full-frame cards (the brief's 80% use rule). slam-hook: bare ink y 1150-1920. slam-close: flat lavender y 1300-1920 empty. receipt-hook: flat yellow y 1320-1920 empty. receipt-close: ink band y 1000-1300 and yellow y 1300-1920 empty. Use the whole frame, as the references do (AI music title card used_frame 0.81, Character.AI 0.81); a full-frame card keeps at most one empty band, under 20% of the frame, and its lowest content ends at or below y 1650.
2. receipt-close has the reference's colours upside down. character-ai-receipts.card.json: the end card is the series colour over y 0 to 1300 and inkDeep over y 1300 to 1920, headline set left at x 120, the brand bar, then the pill, then the question. Match it, and put real content in the lower ink band (the address and the series pill, not a bare field).
3. slam-close repeats the hook word for word. It is the end card: its question closes the argument instead (the AI music end card, 77.23 to 80.60 s).
4. Captions echoing stage words in meaning: receipt-face headline NOW IT'S BANKRUPT. above the caption "The company went bust."; slam-proof "No. 2" above "It reached number two.". The face and proof captions are the spoken next thought and add what the stage does not say. Strengthen the echo check beyond word matching: assert the face and proof captions share no number, name or stem with the frame's stage text.
5. slam-proof chart: the 3 degree tilt shifts the right-hand values one row below their labels, so "2" reads beside Label. Draw it untilted. Asset split/officialcharts_song_page.png is supplied at render and now shows only CHART FACTS and WEEKS ON CHART (aspect about 2:1): show it as the stage's one focal object, wide enough that Peak position 2 and the weeks numbers are at least 44 px tall (design lock min_evidence_quote_px) and read at 540x960. Do not crop, retype or redraw the screenshot.
6. receipt-hook drops "(REPORTED)" from $2.7B though receipt-proof keeps it: keep it in both.
7. receipt-face: COURT FILING sits 15 px above the caption. Leave at least 40 px.

Tests: add assertions for each (colours and bounds of the receipt end card, no rotate on data-proof-object, caption and stage share no token, the hedge present on both $2.7B, lowest content on the full-frame cards at or below y 1650 via a data-content-bottom attribute you set from the same numbers you draw with). Same acceptance as round 1.

## Contract
Same contract as round 1, including the never list. Change nothing of receipt-proof, slam-face or the stage of receipt-hook above y 1320. Touch only apps/renderer/src/engine/stills/split/**. If a fault cannot be fixed within the rules, name it in open_questions; ship no caveat.

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/stills/split
node node_modules/typescript/bin/tsc --noEmit --pretty false

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-fwp-rebuild-2", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
