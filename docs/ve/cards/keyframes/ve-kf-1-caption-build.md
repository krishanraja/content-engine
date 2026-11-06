---
card: ve-kf-1-caption-build
motion_style: full-visual
kind: chrome
model: gpt-6.1-sol
effort: medium
max_minutes: 40
max_calls: 40
cwd: C:\Users\krish\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-kf-1-caption-build
write_allow: [apps/renderer/src/engine/chrome/CaptionBuild.tsx, apps/renderer/src/engine/chrome/captionBuild.test.ts, apps/renderer/src/engine/BrandFrame.tsx, apps/renderer/src/engine/props.ts]
read: _corpus/keyframes-full-visual.md, apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/chrome/CaptionTrack.tsx, apps/renderer/src/engine/chrome/WordCaption.tsx, apps/renderer/src/engine/chrome/chrome.test.ts, apps/renderer/src/engine/BrandFrame.tsx, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/chrome/tokens.ts
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# A third caption style, build: the page grows word by word

## Goal
Add captionStyle 'build' beside 'house' and 'word' (_corpus/keyframes-full-visual.md section 4). Additive only: 'house' and 'word' render byte-identical to today.

1. props.ts: captionStyle z.enum(['house', 'word', 'build']).
2. New chrome/CaptionBuild.tsx, chosen in BrandFrame where 'word' is. It shows the current page (captionPageAt) in the house caption box (same geometry as CaptionTrack), but a word appears only from its atFrame: a word not yet said is not drawn and takes no space.
3. Each word arrives with a 4-frame rise and fade from progress() in ../clock.
4. The page's swipeIndex word (the one key word) gets a tokens.mint box behind it that grows from the left over 3 frames, starting 2 frames after the word's atFrame. Never more than one box a page.
5. At most two lines; type size never below 32 px in either aspect.
6. Hidden during a call beat and from ending.fromFrame, as WordCaption is.

## Tests (in chrome/captionBuild.test.ts)
- before a word's atFrame it is absent; at atFrame+4 it is fully shown
- the box is absent before atFrame+2 of the key word and full at atFrame+5
- a page with swipeIndex null draws no box
- 'house' and 'word' output unchanged (existing chrome.test.ts still passes)
- tall and wide render

## Contract
Chrome follows the device rules (apps/renderer/src/engine/devices/CONTRACT.md): a pure function of props and the frame passed in; animation only from progress() and drift() in ../clock; colours only from tokens (raw hex refused); type from HOUSE_FONTS (structure for the words); no Math.random, no wall clock; author 1080x1920 and 1920x1080 separately. Do not change CaptionTrack, WordCaption or their geometry. ve qc reads caption regions from scripts/velib/qc.py; leave QC alone (a later card adds 'build' there).

## Motion style: Full visual: the real thing, opened up (full-visual, untested)
No presenter on screen: his voice explains and the screen is the explanation. Under a word-by-word caption, the real thing each sentence is about is redrawn from real photos and screens, and changes on the word that changes it.
Build to these rules; brand roles (config/ve/brand-tokens.json) and the design lock win where they differ.
- a new real thing for every sentence group, redrawn from real photos and screens at their real geometry and copy
- a change of state happens to the object already on screen: it recolours, opens, breaks or grows, and is not replaced
- a picture hands over only in a pause he left (ve qc beats.handover_in_gaps), as one move, and the ground is never bare
- a number is never static: it counts, rolls or fills and lands on its word
- the invisible part (a charge, a cost, a flow) gets one shape and one colour, the mint, for the whole cut; everything else keeps its real colours
- fill the stage: foreground, subject, depth behind, one secondary motion; never one small object on an empty ground
- cut inside when the mechanism is inside: a side-on section, a shell turning see-through, layers lifting out
Never:
- a metaphor or stock icon where a real thing exists
- flat boxes and generic shapes that read as coded
- blur, frost or a vague panel standing in for the mechanism
- a still stretch over 1.2 s
- a synthetic voice in place of his

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/chrome
npx vitest run apps/renderer/src/engine/engine.test.ts
npx tsc --noEmit -p apps/renderer

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-kf-1-caption-build", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
