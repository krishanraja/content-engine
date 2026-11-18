---
card: ve-tue17-title-moment
motion_style: eating-jobs-ladder
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 80
cwd: /tmp/ve-local/worktrees/content-engine/ve-card/ve-tue17-title-moment
write_allow: [apps/renderer/src/engine/title/**]
read: [apps/renderer/src/engine/captions/themes.tsx, apps/renderer/src/engine/fit.ts, apps/renderer/src/engine/kit/**, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/FormatMaster.tsx, config/ve/brand-tokens.json, docs/ve/MOTION_STANDARD.md, docs/ve/INGREDIENTS.md]
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# TitleMoment: the line he says becomes the episode title, an epic hero title, flowing out of the captions and back

## Goal
Krish, 18 Nov 2026, on Tue 17's short (b019dbf8): "\"Where does AI get built when the residents of town say no to data centers?\" should be seamlessly made the title with epic hero title treatment as I am saying that line." And 17 Nov, on every intro: the title line is "treated visually as such, seamlessly flowing out of the captions and back in to them again". The spec already carries the moment (`title_moment`, docs/ve/INGREDIENTS.md, "The episode title moment"); the renderer does not draw it yet. Claude wires it (compile, props, FormatMaster, captions stepping aside); you build the title itself.

Build `apps/renderer/src/engine/title/TitleMoment.tsx`, exporting exactly:
```ts
export type TitleWord = { text: string; atFrame: number }
export type Box = { left: number; top: number; width: number; height: number }
export type TitleMomentProps = {
  words: TitleWord[]   // the words he says, in order, each on the frame its sound starts (cut clock)
  fromFrame: number    // the first word's frame
  toFrame: number      // the frame the next sentence starts: the title has gone back into the captions by then
  frame: number        // the current frame
  aspect: '9:16' | '16:9'
  width: number; height: number
  stage: Box           // where the title lands: the graphics panel above his face, or the whole frame
  captionBox: Box      // where the captions sit; the words leave from here and return here
  tokens: Record<string, string>  // the brand tokens devices get
}
export function TitleMoment(props: TitleMomentProps): JSX.Element | null
```
Tue 17's words (9:16, 30 fps, about 0.21 s apart): "where does AI get built when the residents of towns say no?", then "Let's find out." Its stage is the panel above his face, over a photograph of a town at dusk; its captionBox is the band the two-line scroll captions use (podcast theme, apps/renderer/src/engine/captions/themes.tsx).

What it must do:
- each word appears on its own spoken frame, never before: it lifts out of the caption line and travels up into the title, growing as it goes, so the sentence builds into the title word by word as he says it;
- the built title is an epic hero lockup in the house display face (HOUSE_FONTS; the cinematic theme in themes.tsx uses Anton for its heroes): 2 to 4 balanced lines, mixed weight or scale for the key words (AI, built, say no), at least 80% of the stage's width, centred in the stage, readable over a light or dark photograph (shadow, scrim or glow from the brand tokens, never a box);
- on the last word the whole title lands with one firm settle (a small scale settle, a single light sweep across the glyphs, a brief bloom in a brand colour that settles within 0.3 s), then holds and breathes with a slow push;
- in the last 10 frames before toFrame it flows back down into the caption line and fades into it, so the captions take over with no hard cut;
- it draws nothing outside [fromFrame, toFrame), and is a pure function of its props (deterministic).

## Tests (`apps/renderer/src/engine/title/TitleMoment.test.tsx`)
- no word is in the markup before its atFrame; every word is at the last word's frame
- at the hold, the lockup's measured width is at least 80% of the stage width in both aspects (use fit.ts to measure)
- nothing renders before fromFrame or at toFrame
- the same props give the same markup twice

## Contract
Edit only apps/renderer/src/engine/title/**. Fonts and measuring: apps/renderer/src/engine/fit.ts and the kit; colours only from props.tokens (no raw hex). Use Remotion's interpolate/spring from the frame prop alone.

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
npx vitest run apps/renderer/src/engine/title
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-tue17-title-moment", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
