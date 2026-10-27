---
card: ve-card-4-evidence-devices
kind: device_new
model: gpt-6.1-sol
effort: medium
max_minutes: 55
max_calls: 50
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-card-4-evidence-devices
write_allow: [apps/renderer/src/engine/devices/record_card/**, apps/renderer/src/engine/devices/query_chip/**, apps/renderer/src/engine/devices/evidence_card/**, apps/renderer/src/engine/devices/kinetic_stat/**, apps/renderer/src/engine/devices/registry.ts]
read: apps/renderer/src/engine/props.ts, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/devices/types.ts, apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/house/components.tsx, apps/renderer/src/house/metrics.ts
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Devices: record_card, query_chip, evidence_card, kinetic_stat

## Goal
Four library devices that the three v1 formats share. Each is persistent and event-driven, with both aspects authored.

## Contract
- **record_card (the ledger).**
  - Params: `fields[{key,label,value}]`.
  - `enter` drops the card.
  - `stamp` restamps exactly the field named in `toState` ("field=value") with a 5-frame slap. Other fields never change.
  - Labels are Plex Mono; values are Archivo 800.
- **query_chip.**
  - Params: `text`.
  - A mono pill that slides in (12 frames) on `enter`.
  - `highlight` pulses it once (scale 1.05, 8 frames). `exit` slides it out.
- **evidence_card.**
  - Params: `kind: screenshot|recording|document|quote`, `src?`, `quote?`, `outlet`, `date`.
  - A cream card with a 2 px ink border and a hard shadow, plus a provenance line in Plex Mono ("OUTLET · DATE").
  - `enter` grows it from its cell (12 frames, ENTER).
  - `fill` types the quote or plays the recording (`OffthreadVideo`, `trimBefore` from params).
  - `stamp` strikes the lines through and collapses them upward (6 frames), leaving a dashed outline.
  - `mark` types the new line given in `toState`.
  - Never a cropped screenshot without the provenance line.
- **kinetic_stat.**
  - Reads `object.dataset`.
  - `count_to` counts from 0 to the value over 18 frames (HERO easing).
  - Shows the unit and `producerLabel`. The number is Anton; the label is Plex Mono.
  - If the denominator is set, render "value/denominator".
- **All four:** register each in `registry.ts` (one line per device). Each gets a `device.test.ts` that checks its state machine by frame, with no rendering.

## Acceptance (every command must exit 0 inside your sandbox)
npx tsc --noEmit
npx vitest run apps/renderer/src/engine/devices

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-card-4-evidence-devices", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
