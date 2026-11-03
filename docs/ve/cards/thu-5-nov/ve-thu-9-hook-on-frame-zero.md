---
card: ve-thu-9-hook-on-frame-zero
kind: code
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 50
cwd: /tmp/v3home\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-thu-9-hook-on-frame-zero
write_allow: [apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/clock.test.ts, apps/renderer/src/engine/FormatMaster.tsx, apps/renderer/src/engine/engine.test.ts, apps/renderer/src/engine/devices/typing_bubble/index.tsx, apps/renderer/src/engine/devices/typing_bubble/device.test.ts]
read: apps/renderer/**, docs/plans/2026-11-05-thursday-no-spending/ve/props.short.json, scripts/velib/compile.py
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# The hook is whole on frame 0: anything the cut opens with has already entered and typed

## Goal
['Krish\'s standard (2026-11-03: "We fucking have standards for intro, background audio and outro"; the hook is the intro) needs the first frame of a cut to show the hook. ve compile puts every entrance on the first word at frame 0 (scripts/velib/compile.py), but every device animates its entrance over MOTION.enterFrames from that frame, and typing_bubble reveals a typed row over the span to its next event, so frame 0 of Thursday\'s cut (docs/plans/2026-11-05-thursday-no-spending/ve/props.short.json) is bare cream: the notification card, the cursor buddy and the text \'Done! Booked the team offsite in Ibiza\' appear only over the first second. The separate critic blocked the cut on this (frame 0 and 3).\n\nMake events at frame 0 already played on frame 0, engine-wide, in one place: FormatMaster (apps/renderer/src/engine/FormatMaster.tsx) or the clock (apps/renderer/src/engine/clock.ts), not per piece. An object whose event fires at atFrame 0 renders on frame 0 as its landed state: an enter at 0 is fully entered (opacity 1, no offset), and a typing_bubble row whose type cue is at 0 shows its whole text on frame 0 (with no typing dots). Events after frame 0 keep their exact frames, and an exit or later type keeps animating as now. Keep the props schema unchanged (atFrame stays non-negative in props).\n\nTests: a FormatMaster or clock test that an enter at frame 0 gives progress 1 on frame 0 while an enter at frame 10 gives 0 on frame 10; a typing_bubble test that a notification with enter and type at frame 0 shows the full row text and no typing dots on frame 0, and that a type cue at frame 30 still reveals progressively; the existing device and layout tests stay green.']

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. One clock (useCurrentFrame only in apps/renderer/src/engine/clock.ts). Pure functions of props, no Math.random, no wall clock. Colour roles from tokens, never raw hex. Change no props schema.

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices
npx vitest run apps/renderer/src/engine
node node_modules/typescript/bin/tsc --noEmit --pretty false

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-thu-9-hook-on-frame-zero", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
