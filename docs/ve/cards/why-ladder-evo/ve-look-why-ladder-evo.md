---
card: ve-look-why-ladder-evo
kind: code
model: gpt-6.2-astra
effort: high
max_minutes: 45
max_calls: 60
cwd: C:\Users\krish\dev\mindmake\ce-cards\look-why-ladder-concept
write_allow: [docs/ve/cards/why-ladder-evo/render/ladder.html, docs/ve/cards/why-ladder-evo/render/render.py, .scratch/why-ladder/evo/*]
read: docs/ve/cards/why-ladder-evo/SPEC.md, docs/ve/cards/why-ladder-evo/tokens.json, docs/ve/cards/why-ladder-evo/piece.json, docs/ve/cards/why-ladder/render/render.py, assets/fonts/makeyourmindup/*, .scratch/why-ladder/assets/*
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# makeyourmindup coming of age: why-ladder frame set in the evolved house style

## Goal
Build the six 1080x1920 scenes exactly as docs/ve/cards/why-ladder-evo/SPEC.md describes, from docs/ve/cards/why-ladder-evo/tokens.json and piece.json: one self-contained page docs/ve/cards/why-ladder-evo/render/ladder.html (scene via ?scene=N, all scenes in order with ?play=1) and docs/ve/cards/why-ladder-evo/render/render.py, which captures .scratch/why-ladder/evo/scene-{1..6}.png and contact.png with Python Playwright (reuse the anonymous_driver workaround in docs/ve/cards/why-ladder/render/render.py, file:// only, offline). This is an evolution of the existing brand (ink, cream, mint, section colour, Anton, Fraunces, the real wordmark, grain, operating-table photography, leader-line callouts) made premium by restraint.

## Contract
Fonts only from the files in tokens.json (Anton, Fraunces, DM Mono). No colour, size or word typed into ladder.html or render.py. No shadows, gradients, blur, stickers, swipes, halftone, tilt or translucent panels over photos. Never alter, recolour or redraw any photo, screenshot, headshot or the wordmark: scale, crop and position only. One section-colour element and at most one mint element per scene. Nothing overlaps or is cut off; everything inside x90-990, y200-1500 except full-bleed photos and colour blocks. Do not edit SPEC.md, tokens.json or piece.json; raise any ambiguity in open_questions.

## Acceptance (every command must exit 0 inside your sandbox)
python docs/ve/cards/why-ladder-evo/render/render.py
python -c "from PIL import Image; import sys; [sys.exit(1) for n in range(1,7) if Image.open(f'.scratch/why-ladder/evo/scene-{n}.png').size!=(1080,1920)]"
python -c "import re,sys; t=open('docs/ve/cards/why-ladder-evo/render/ladder.html',encoding='utf-8').read()+open('docs/ve/cards/why-ladder-evo/render/render.py',encoding='utf-8').read(); sys.exit(1 if re.search(r'#[0-9A-Fa-f]{6}\b|gradient|box-shadow|drop-shadow|blur\(', t) else 0)"

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-look-why-ladder-evo", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
