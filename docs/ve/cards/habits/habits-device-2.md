ve card habits-device-2 for 2026-11-17-tue-habits (device): a hero rubber stamp that never reads as a caption

Krish, 18 Nov 2026, on the proof: "the word VOID is in the same font and style as the captions which looks misleading visually, but the rest looks good". The beat (b10b, line "so the old AI did it excuse is never going to save you") stamps VOID over a full-frame photo of a man trying to outrun a car. Today slam_word sets VOID in Anton cream with an ink outline, which is exactly the art-directed captions' type (apps/renderer/src/engine/chrome/ArtDirectedCaption.tsx), so it reads as a caption. The existing stamp device (apps/renderer/src/engine/devices/stamp/) fits the idea, a stamp, but its text is fixed at 30 px, a label size.

Build: an optional hero size for the existing `stamp` device. Claude orchestrates and checks; you build. Never render, assemble, trim, caption, mix or file a cut. Never publish, push or commit. Network is off.

Read first: apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/stamp/ (index.tsx, schema.ts, state.ts, its tests and fixture), apps/renderer/src/engine/kit/overlay.ts (halftone), apps/renderer/src/engine/chrome/ArtDirectedCaption.tsx (what it must NOT look like), config/ve/brand-tokens.json, apps/renderer/src/engine/houseGolden.test.ts.

Write only inside apps/renderer/src/engine/devices/stamp/ (and add a row to its own tests).

What `size: 'hero'` draws (params: `size: 'label' | 'hero'`, default 'label'; with 'label' every existing stamp draws byte-for-byte as before, so houseGolden.test.ts must pass unchanged):
- A rubber stamp, not type: `main` (one or two words) in Archivo at its heaviest weight (the house structure face, never Anton, never Fraunces), uppercase, letter-spaced, fitted to fill about 80% of `at.w`, in the paint colour (tokens.mint for paint 'mint'), inside a thick rounded double border in the same paint colour (outer border about 12 px, an inner hairline 6 px inside it), rotated by `tiltDeg`.
- Worn ink: a halftone or speckle mask (from kit/overlay, deterministic, no Math.random) knocks about 15 to 20% of the ink out, so it reads as pressed ink on the photo. A faint ink-coloured drop shadow keeps it readable over a light photo; nothing cream, no ink outline round the letters (that is the caption's look).
- `top` (optional): a small line in IBM Plex Mono, about 34 px, inside the border above `main`, same paint.
- Motion on the `stamp` verb: the stamp lands. Over 0.12 s it scales from 1.35 to 1.0 with a tiny overshoot and its opacity goes 0 to 1; then it holds still. Nothing drifts. `exit` behaves as today.
- Colours only from tokens; no raw hex.

Acceptance (run all; all must pass):
cd apps/renderer && npx vitest run src/engine/devices/stamp src/engine/devices/verbs.test.ts src/engine/houseGolden.test.ts
npx tsc --noEmit -p .   (from the repository root; zero errors)
Also render one still for Claude to check: write a tiny script under .scratch/ve/habits/stamp/ that renders the device (hero size, main "VOID", top "THE AI DID IT", paint mint, tiltDeg -6, at {x:140,y:640,w:800,h:380}) on a mid-grey 1080x1920 frame to .scratch/ve/habits/stamp/hero.png. Use the renderer's own still route if there is one (look for a stills script under apps/renderer/scripts); if not, say so and skip the still.

Reply with the files changed and the acceptance output's last lines. Claude reviews the diff and renders it in the cut; your report is not proof.
Claude rendered your hero stamp in the cut; frame at .scratch/ve/habits/stamp/proof-frame-7.7s.png (the proof is half size, 540x960). It now reads as a stamp, not caption type, which is right. Two faults, same files only, same rules:

1. The wear is far too strong and too regular: VOID's letters are a visible even dot grid (a screen-print mesh), so roughly half the ink is gone. Make it read as solid pressed ink with light, irregular wear: about 10 to 15% knocked out, as small uneven specks and a few soft gaps along the edges (a deterministic noise from the frame-independent seed, never a regular grid, never Math.random). The letters' strokes must read as solid at a glance.
2. The `top` line ("THE AI DID IT") is barely legible: make it at least 44 px on the 1080x1920 frame, IBM Plex Mono at its boldest weight, letter-spaced, with the same light wear only, and sit it clear of VOID's cap height.

Keep everything else: Archivo heaviest weight, mint, the double border, the -6 degree tilt, the 0.12 s landing, `size: 'label'` byte-identical (houseGolden must pass unchanged).

Acceptance (from the repository root; all must pass):
npx vitest run apps/renderer/src/engine/devices/stamp apps/renderer/src/engine/devices/verbs.test.ts apps/renderer/src/engine/houseGolden.test.ts
npx tsc --noEmit -p .
Reply with the files changed and the acceptance output's last lines.
