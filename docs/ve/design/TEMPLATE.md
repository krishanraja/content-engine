# ve design template: mind.the.gap tall (1080x1920)

Approved by Krish on 28 Oct 2026 ("Approve direction"): format **H, the hand-held screen**, is the base; **P, two passports**, is the reusable module for any piece about where an AI lives. The machine-readable lock is `config/ve/design-lock.json`; the gates read it, not this page. Per-format detail (zone tables, slots, camera, prompts) is in `docs/ve/design/formats/`. Why this exists: the first Gate 2 proofs passed every mechanical check and were rejected on design (F19 in `config/failures.json`).

## The format in one paragraph
One real hand holds one real phone on a real-world plate. The camera never cuts: it pushes, rolls and re-frames. Each beat has one big statement (Anton), one human line (Fraunces italic), one object that carries the evidence, and **one hand-drawn scribble** pointing at the single most important thing in that beat. The engine adds captions, the logo and the dated call. Nothing sits still, and nothing is a table.

## Canvas and zones (px, 1080x1920)
| Zone | x | y | w | h | Rule |
|---|---|---|---|---|---|
| Grid | 72 | | 936 | | 12 columns, 24 gutter, 72 margins |
| Header | 72 | 79 | 888 | 56 | logo, section pill |
| Headline | 72 | 150 | 888 | 270 | Anton, 1 or 2 lines, one swiped word |
| Hero stage | 0 | 0 | 1080 | 1920 | full bleed, the focal object fills it |
| Key band | | | | to y 1170 | every focal item and its scribble live here |
| Caption | 72 | 1180 | 900 | 320 | reserved for the engine's captions; nothing else |
| Lower line | 72 | 1516 | 936 | 104 | one stat strip, one dek or one sticker |
| Platform | x>960, y>1640 | | | | decoration only, no key content |

## Type scale
| Role | Family | px | Case, tracking |
|---|---|---|---|
| Splash / headline | Anton | 150-240, line 0.88 | UPPER |
| Big numerals | Anton | 100-150 | UPPER |
| Dek | Fraunces italic | 42-46, line 1.16 | sentence |
| Evidence quote | Archivo 500-600 | 44 min | as spoken |
| Names in cards | Archivo 900, width 112 | 34-46 | UPPER |
| Label, sticker, stamp, MRZ | IBM Plex Mono 500-700 | 30 min | UPPER, +0.14em on labels |
Nothing under 30 px, except the 28 px tag and **real footage**, which is evidence and is never retyped or enlarged: if its text is under 30 px in frame, add a verbatim labelled pull quote at 44 px beside it.

## Colour (roles from `config/ve/brand-tokens.json`, never raw hex in a device)
Ink ground. Cream for reading. Mint for the answer, flags, threads and scribbles. Channel colour (coral for mind.the.gap) marks identity only: pill, stickers, swipe, marquee, verdict stamps. Type on a colour block is ink. Mint is never type and never sits on cream without its ink keyline. Coral is never a country, a warning or a failure: a failure is an absence (a bare pole, a parted thread) plus a cream outline stamp.

## Kit of parts (all square, hard shadows, no blur on kit parts)
Brutal card (2 px border, 10 px offset shadow). Sticker (Plex Mono 600 pill, tilt -8 to +5 deg). Section pill. Highlighter swipe (8 deg skew, one word per headline). Stamp (3 px border, 0.18em tracking, verdict on a **part**, never a person; leader = thin line to a dot on the part). Receipt. Marquee. Printed finish: 7% fractal grain on dark, 14 px halftone on coral. Type, logo and layout never tilt; only stickers, stamps and physical things (phone, page, screen) do.

## The scribble (the annotation language)
Exactly one per beat: a loop, underline, arrow, bracket, tick or cross, hand-wobbled, 8 px stroke in cream (on dark) or mint (on light) over a 16 px ink keyline (this is what makes mint readable on a white recording). Drawn on over about 10 frames as a single `pathLength=1` dash-offset animation, following the object's perspective. It points at the one thing the voice is saying right now. It never replaces a stamp.

## Motion (tokens in brand-tokens.json)
At least six distinct moves per beat (camera, parallax, kinetic type, counter, wipe, scribble draw-on, stamp slap, sticker drop). Enter 400 ms, exit 200 ms, stagger 3 frames, slap 5 frames, hero move cubic-bezier(0.16,1,0.3,1). Ambient drift 1.5% on everything that is not a sticker or stamp. A counter shows a resting value that makes no claim (for example `?`) until the result is proved.

## Images: how plates are made and what quality we expect
1. **Stills** come from ChatGPT Images through a Codex imagegen card, 9:16, at least 1882x3344 (2x the stage), 4 candidates per plate. Prompts must say: no text, numbers, flags, emblems, logos, faces, UI, arrows or highlights; blank flat screens; calm dark at least 35% of the frame for type; one hand, one phone; palette ink-green blacks, cream and mint, never coral. Say it again as the last sentence.
2. **Reject by machine first**: OCR finds any letter or digit; a flat-colour test for the blank screen; the Critic checks for flags, emblems, logos, faces. A hit means regenerate, never retouch.
3. **Animation** (Runway, Higgsfield) only animates an approved still for up to 5 s, one-shot, never evidence. Each generation is logged with its credit cost (`ve ledger <piece> add`), and Krish approves every spend.
4. **Every element on screen serves the message of the video.** No tag, provenance sticker, marquee, disclaimer or process label (Krish, 28 Oct 2026: "I hate all these stupid little abbreviations and marks"; "No one cares that things are AI-generated"). The real recording is never generated and never redrawn, and its own source label stays.
5. Each plate has a sidecar: prompt, model, date, candidates, chosen, credits.

## Quality bar (the gates, in order)
1. **Design lock**: no device card or compile for a format without an approved lock.
2. **Composition QC** on rendered frames: fill at least 80% outside the caption zone, nothing under 30 px (44 px for quotes), caption zone clear, nothing key beyond x 960 or y 1640, nothing hugging a corner. No ILLUSTRATION tag is required on a plate (the lock sets `illustration_tag_required: false`; Images, rule 4).
3. **Golden key frames**: the render at each declared key frame matches the approved still (structural similarity above the lock's threshold).
4. **Mechanical QC** (11 checks) as before.
5. **Critic verdict** bound to the mp4's hash.
6. `ve packet` refuses to assemble a Gate packet until 1-5 pass for that exact file. Krish's final approval is a hash, never a phrase.

## Anti-patterns (what was rejected, so it is never built again)
A grid of cells or a table. Small widgets in fixed corner boxes. Dead bands under the hero. Text under 30 px. Mint type on cream. Coral as a status. A box drawn round a logo. A static infographic with one ring drawn on it. Fonts from the network. A proof sent for approval without the Critic having run.
