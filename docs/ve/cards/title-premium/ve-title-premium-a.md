---
card: ve-title-premium-a
kind: code
model: gpt-6.2-astra
effort: medium
max_minutes: 60
max_calls: 60
cwd: /home/user/dev/makeyourmindup/.worktrees/content-engine/ve-card/ve-title-premium-a
write_allow: [apps/renderer/src/engine/title/*, docs/ve/cards/title-premium/out/*]
read: apps/renderer/src/engine/title/TitleMoment.tsx, apps/renderer/src/engine/title/TitleMoment.test.ts, config/ve/brand-tokens.json, config/ve/shot-grammar.json, apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/houseGolden.test.ts
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Title moment direction A, made classy and premium: word by word on his spoken title, with a backdrop motif drawn from the piece

## Goal
Krish approved direction A for the title slide on 2026-11-20: "A, but just be clear that the audio waveform imagery behind it was built specifically for the AI Music piece, so that would change accordingly to the piece in a similar style. Also, I think this is one of those examples of things we can make more classy/premium". Direction A is the approved Wed 11 two-band lockup (cream band, then the mint band, 'or' in Fraunces italic mint) landing word by word on his spoken title words, within the opening 30 s and after the hook, held full frame for at most 2 s, as TitleMoment.tsx already draws it for the Wed 11 cut, with these changes. Work in apps/renderer/src/engine/title/TitleMoment.tsx. Do three things. (1) Add a `motif` prop for the ground behind the lockup, replacing the always-on audio bars: `bars` (today's audio waveform, kept for audio pieces), `ledger` (fine horizontal ruled lines, for money and audit pieces), `grid` (a quiet UI tile grid, for platform pieces), `none` (plain ink with a soft vignette). Each is drawn at 12% opacity or less, from brand tokens only, moves slowly and never competes with the words. The default for existing props stays `bars`, so no existing cut changes and houseGolden.test.ts stays byte-identical. (2) Make the lockup classier: tighter optical alignment and leading on the two bands, the cream and mint bands as crisp slabs with a thin ember hairline edge (accent kit colours only, from config/ve/brand-tokens.json accent_kit, series days only), a restrained 14 frame hero-curve entrance per word with 3 frame sibling stagger, no hatching, no orphan word, no blur on settled type, nothing overlapping the face band or wordmark. (3) Render stills at 9:16 and 16:9 for each motif into docs/ve/cards/title-premium/out/ (title-<motif>-<ratio>-<frame>.png at frames 8, 20, 40, 60) plus one contact sheet per ratio.

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. One clock (useCurrentFrame only in apps/renderer/src/engine/clock.ts). No Math.random, no wall clock. Colours only from config/ve/brand-tokens.json; fonts only the repository's. Never draw over his face; keep every word at least 40 px (config/ve/shot-grammar.json words_min_px). Do not touch scripts/velib/grammar.py, scripts/velib/lint.py, scripts/velib/compile.py or the title-timing lint (grammar.title_timing): they are Claude's. The title must start on his spoken title words, within 30 s; that is the compile step's job, not yours. Never remove the audio-bars motif.

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/title apps/renderer/src/engine/houseGolden.test.ts
node node_modules/typescript/bin/tsc --noEmit --pretty false

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-title-premium-a", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
