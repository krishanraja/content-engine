---
card: ve-e-6-passport
kind: device
format: two-passports
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 45
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-e-6-passport
write_allow: [apps/renderer/src/engine/kit/passport*, apps/renderer/src/engine/kit/flags*, apps/renderer/src/engine/devices/passport_page/*, apps/renderer/src/engine/devices/registry.ts, config/ve/devices.json, config/ve/formats/two-passports.json, assets/plates/two-passports/*, tests/ve_passport_test.py]
read: apps/renderer/src/engine/**, docs/ve/design/formats/ref/P/**, docs/ve/design/formats/P-anatomy.md, docs/ve/design/formats/P-motion.md, docs/ve/design/TEMPLATE.md, config/ve/design-lock.json, config/ve/formats/two-passports.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, edits outside write_allow, Math.random, useCurrentFrame in a device, raw hex colours, a table or grid-of-cells look, claiming where any AI's data lives
---

# passport_page: the reusable "two passports" module (born vs lives)

## Why
Krish: use the passport page "whenever I'm talking about the two passports as to where your AI lives". It is a five-beat module (title, born, lives, gap, verdict; see `config/ve/design-lock.json`). Approved frames, zones, type sizes and slots are in `P-anatomy.md` (sections 2 to 7); the generators are in `ref/P/tools/` (`build.py`, `index.template.html`, `make_paper.py`, `make_vectors.py`). The plates (paper, guilloche, rosette, flags) are not in the repo yet: reproduce them from those scripts into `assets/plates/two-passports/` with a `plates.json` sidecar like `assets/plates/hand-held-screen/plates.json` (say the flags are simplified illustrations).

## Contract
1. Device `passport_page` (STAGE slot, per `devices/CONTRACT.md`): one object is one passport page 900 px wide (cover, three stacked leaves, sheet with paper texture and guilloche, stitched mint spine, left or right per `spine`). Verbs `enter`, `stamp`, `mark`, `exit`. Params `{spine: 'left'|'right', at: {x, y}, label?: string, portrait?: boolean, fields: [{id, label, at, state: 'stamped'|'sample'|'blank', top?, main?, flag?, tiltDeg}], mrz?: [string, string], ghostAI?: boolean, sampleText?: string}`.
2. A `stamped` field draws an ink outline stamp multiplied into the paper (top line Plex Mono 30 px +0.18em; main line Plex Mono 700 at the sizes in `P-anatomy.md` section 3); `stamp` (toState = field id) slaps it in over `MOTION.slapFrames`. `sample` and `blank` fields draw a dashed outline with `???`. The flag is printed (multiply, 7 px halftone), never inside a stamp. If any field is `sample`, `sampleText` is required and shown as a sticker (`SAMPLE · NOT A CLAIM`): the device throws without it. MRZ: Plex Mono 30 px, `<` filler, UPPERCASE.
3. The look follows `P-anatomy.md` rules 1 to 17: ink table, cream paper, type on colour is ink, coral only as channel colour, tilt only on stamps, no table or grid of cells, nothing under 30 px, 7% grain and halftone from the house kit. Colours from `tokens` only.
4. Flags: SVGs under `kit/flags*` for `usa` and `china`, plus an `unknown` dashed hatched `?` box; a comment says production must use a licensed open set.
5. `config/ve/formats/two-passports.json`: add default object lists per beat as `template` entries (`passport_page`, `headline`, `sticker`, `stamp`, `scribble`, `thread_card`), and drop `passport_page` from `pending_devices`; leave the others there.
6. Register in `registry.ts` and `config/ve/devices.json` with exactly `enter, stamp, mark, exit`.

## Tests
`device.test.ts`: nothing before `enter`; a `stamped` field is invisible before its `stamp` and full size 5 frames after; a `sample` field renders dashed `???` and throws without `sampleText`; MRZ uppercase with `<`; markup has no `<table>`, no `#` colour, every font size >= 30; the page is 900 px wide and bleeds off the bottom. `tests/ve_passport_test.py`: devices.json entry and verbs; format JSON beats equal the lock's; plate sidecar exists; existing tests pass.

## Acceptance
npx vitest run apps/renderer/src/engine
node node_modules/typescript/bin/tsc --noEmit --pretty false
python tests/ve_passport_test.py
python tests/ve_stage_test.py

## Return
Final message only JSON per config/ve/task-result.schema.json (`card`, `files_changed`, `commands`, `open_questions`). If vitest is blocked (EPERM) say so. Stop after two failed attempts at the same acceptance command and report it.
