# Format H wiring

One phone and one marquee persist across all five STAGE beats. The phone moves
at each beat start; fills are prompt, cards, cards, footage, bubble. Cards keep
the camera name with their layer, so the same fill kind selects each result.

| Beat | Other objects | Cue words (original word indexes) |
|---|---|---|
| open | headline/dek, CLAUDE/CHATGPT/DEEPSEEK stickers, loop, scoring strip | Now 0, blocked 3, cotton 4, both 6, forced 8, labour 9 |
| result_a | headline/lower dek, tall loop | Claude 19, flagged 22, both 25 |
| result_b | headline/lower dek, arrow | did 29, DeepSeek 30, Turkmenistan 32 |
| evidence | headline/pull quote, recording sticker, underline | Now 33, DeepSeek 35, full 41 |
| verdict | headline, stamp/leader, threads, bubble loop, stat strip | changes 46, the 47, subject 48, every 49, single 50 |

Cameras and backdrop placements are copied from the format config. Copy and
canvas placements come from ref/H/build.py f1-f5/MARQUEE and H-anatomy sections 2-4.
Scribble numbers were computed once with that reference's Screen.u2c/fit:
open glass rect (44,324)-(534,540), pad 1.12; result_a
(W-248,127)-(W-44,597), pad 1.1; result_b arrow from (64,600) to
u2c(30+cw/2+34,257), cw=(W-82)/2. Evidence endpoints map recording
(597,320) and (954,320), clockwise at 1.14, through Screen.u2c.
Verdict glass rect (32,64.5)-(W-30,376.5), pad 1.04. All resulting
coordinates are plain numbers. Thread stations 410/660, rows 336/436/536,
knot (892,436), stamp (76,610,374,62) and leader (410,536) are from f5.
The verdict headline box is an explicit 280px extension for the required headline.

The strict v2 schema has no beat keyFrame field. style.keyFrames stores 0.8
per beat; compile emits each beat's absolute keyFrame. words.test.json preserves
the original onsets with explicitly synthetic +0.2s ends, exactly as the existing
compile test. It proves compilation only. It is not aligned production timing.
The original recording is played unchanged, trimBefore 102; no text is recreated.

Claude's proof commands, after staging the existing media/brand/SFX in $assets
and real aligned ends in $words (PowerShell):

```powershell
$spec = 'fixtures/ve/hand-held-screen/spec.json'
$proof = 'docs/plans/2026-10-23-friday-my-test/ve'
python scripts/ve.py lint $spec
python scripts/ve.py compile $spec --cut proof-tall --words $words --assets-dir $assets
python scripts/ve.py render "$proof/props.proof-tall.json" "$proof/H.mp4" --spec $spec --assets-dir $assets
python scripts/ve.py qc "$proof/H.mp4" --format hand-held-screen --props "$proof/props.proof-tall.json" --out "$proof/qc.H.json"
```

Compile CLI writes the existing plan route, forbidden to this card. Tests use
compile_cut directly. No render, playback, golden-frame or measured QC verdict
is claimed here. Claude renders and reviews the five frames and complete motion.
