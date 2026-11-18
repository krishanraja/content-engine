---
card: ve-tue17-facility-block
motion_style: eating-jobs-ladder
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 90
max_calls: 80
cwd: /tmp/ve-local/worktrees/content-engine/ve-card/ve-tue17-facility-block
write_allow: [apps/renderer/src/engine/devices/facility_block/**, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, config/ve/devices.json]
read: [apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/logo_card/**, apps/renderer/src/engine/devices/through_line/**, packages/moves/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, config/ve/devices.json, config/logo-registry.json, config/channel-safe-zones.json, config/ve/pace-references.json, docs/ve/MOTION_STANDARD.md]
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# facility_block: one building that carries the story, changed on screen

## Goal
Krish picked `eating-jobs-ladder` for Tue 17 Nov's piece (b019dbf8): one object carries the story, changed on screen, never replaced. Here the object is one data centre. Build the library device `facility_block`: one windowless building (data centre, factory, office or warehouse by `params.kind`), one lit block on the house ink ground that every beat changes.

`params`: `kind`, `label` (place under the pin, at most 3 words), `logo` (optional registry id, the real mark on the block's side), `tag` (optional, at most 3 words), `targets` (up to 2 receipts, {label}), `copies` ({count 2..60, kept}), `skyline` ({lights 6..40}).

Verbs and what each move means (every move changes the block itself, lands in 0.6 s or less; the block never rests):
- `enter` (toState `pin`): the block drops onto a map pin with the label.
- `fill` (toState `racks`): the roof opens like a lid and racks of servers slide up inside, a small mint glint on each rack.
- `connect` (toState `city`): a cable runs from the block to a small-city skyline; the city's windows go dark one by one as the block glows brighter.
- `add` (toState `ballot` or `pylons`): a ballot box drops beside the block; or pylons draw themselves towards it.
- `stamp` (toState `ban`): a BAN stamp slams onto the block's face and the block shudders.
- `carry` (toState `walk`): the block unplugs, grows two small legs and walks off looking for a socket, the price tag trailing behind it on a string.
- `move` (toState `target:<index>`): the price tag flies off the block and lands on receipt `targets[index]`.
- `multiply` (toState the count): the block becomes `copies.count` small blocks in a grid; `grey` (toState the kept count) stamps all but `copies.kept` of them with a small BAN.
- `grow` / `thin` (toState `giant` / `small`): the block grows huge or shrinks to a container beside a wind turbine.
- `exit`: the block folds flat to a line.

His floor (floor.py --format motion): every state change moves the object, never an arrival that sits, a crossfade or an arrow; drawn in brand tokens with light, shadow and texture, never icons, clipart or emoji; no words beyond `label`, `tag`, target labels and a count. No caption box.

Pace and room (config/ve/pace-references.json): fill the box; tall y 280 to 1050, nothing to read right of x 860; wide, the whole slot.

## Tests (`device.test.ts`, stills from `fixture.json`)
- each verb changes the block's own drawing
- the `connect` city has fewer lit windows after the event than before; `grey` leaves exactly `kept` blocks unstamped
- an unregistered `logo` id is refused
- the same frame twice renders identical pixels; no colour outside tokens; tall and wide stills render

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. Register `facility_block` in `devices/registry.ts` and `config/ve/devices.json` with exactly enter, fill, connect, add, stamp, carry, move, multiply, grey, grow, thin, exit; update `verbs.test.ts`. Draw in SVG from the frame alone; any texture is seeded by the frame number, never random. Reuse packages/moves and logo_card's resolveLogo for the mark, never copy a move. Add no motion profile and leave apps/renderer/src/engine/kit/motion-profiles.json untouched.

## Motion style: One object carries the story (from the eating-its-own-jobs cut) (eating-jobs-ladder, untested)
One object, a career ladder, carries the whole piece: every number is counted onto, beside or in place of a part of it, on a vignetted ink desk or in a butter tray over his chest, and every scene that steps away ends by turning back into the ladder, changed.
Build to these rules; brand roles (config/ve/brand-tokens.json) and the design lock win where they differ.
- one through-line object for the whole piece, changed on screen, never replaced
- numbers roll onto the object on the enter curve and land on their word
- a slow push holds every panel; nothing holds still
- every change is a 10-frame crossfade on its word; no slide or whip exits
- mint marks only the answer; the series colour is never a warning
Never:
- figures or icons acting out a sentence
- on-screen words repeating what he says
- eyebrow labels, kickers or asterisks
- a hard cut between panels except into the end card

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices/facility_block
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-tue17-facility-block", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
