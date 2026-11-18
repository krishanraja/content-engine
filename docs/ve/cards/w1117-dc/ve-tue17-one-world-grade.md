---
card: ve-tue17-one-world-grade
motion_style: eating-jobs-ladder
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 80
cwd: /tmp/ve-local/worktrees/content-engine/ve-card/ve-tue17-one-world-grade
write_allow: [apps/renderer/src/engine/treatments/Grade.tsx, apps/renderer/src/engine/treatments/Grade.test.ts, docs/ve/cards/w1117-dc/one-world.md]
read: [apps/renderer/src/engine/treatments/SubjectLift.tsx, apps/renderer/src/engine/FormatMaster.tsx, config/ve/brand-tokens.json, docs/ve/MOTION_STANDARD.md, docs/ve/TREATMENTS.md]
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# One world: a shared grade for photos and the drawn stage, with a focus rack between them

## Goal
Krish, 18 Nov 2026, on Tue 17's short (b019dbf8): "we have two concurrent visual styles trying to say the same thing over one another? why?" (a flat drawn data-centre block over sharp photos of server halls, pylons and polling stations), then: "as long as you can figure out how to not just have a black background behind the motion styles, which would look weird in frames after a full photograph, and I am interested to see how you manage to create visual consistency between the two styles interchanging in a world class art directed way".

The decision (Claude's): each beat has one picture. A photo beat shows the photograph alone. A device beat shows the drawn device alone, on a stage made from the same photograph thrown far out of focus and graded down, so it is light and colour, never a second statement. Both wear one grade, so cutting between them reads like one camera racking focus from the real world into the diagram and back.

Build `apps/renderer/src/engine/treatments/Grade.tsx`, exporting exactly:
```ts
export type GradeProps = { src: string; focus: number; tokens: Record<string, string>; frame: number; width: number; height: number }
export function GradedBackdrop(props: GradeProps): JSX.Element
```
- `focus` 0 is the photo beat: sharp, the house grade applied lightly (shadows toward ink, highlights toward cream, a whisper of mint in the mids, fine grain, a soft vignette), still clearly a real photograph.
- `focus` 1 is the stage: the same image blurred heavily (about 48 px at 1080 wide, scaled up slightly so blurred edges never show), darkened and desaturated toward the ink so a cream drawing on it keeps at least 7:1 contrast, with the same grain and vignette and a gentle light falloff from the top so the stage has depth, not a flat fill.
- Every value between interpolates smoothly (the renderer animates `focus` across 12 frames at a cut between the two kinds).
- Colours only from `tokens` (ink, inkDeep, inkSoft, cream, mint, channel); grain from a fixed-seed SVG feTurbulence; a pure function of its props, no randomness, no useCurrentFrame (the grain may drift with `frame`, deterministically).

Also add `docs/ve/cards/w1117-dc/one-world.md`: in six lines or fewer, the grade's recipe in words (what each step does and why), for the art-direction record.

## Tests (`apps/renderer/src/engine/treatments/Grade.test.ts`, React.createElement, no JSX in the test)
- the markup at focus 0 has no blur, at focus 1 a blur of at least 40 px, and at 0.5 one in between
- no raw hex or rgb literal in Grade.tsx; every colour comes from tokens
- the same props give the same markup twice

## Contract
Edit only apps/renderer/src/engine/treatments/Grade.tsx, its test, and docs/ve/cards/w1117-dc/one-world.md. Read SubjectLift.tsx for how a treatment is written here.

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
npx vitest run apps/renderer/src/engine/treatments
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-tue17-one-world-grade", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
