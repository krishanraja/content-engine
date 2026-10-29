# FACE WITH PROOF: anatomy (draft lock, awaiting Krish's Gate 2)

Status: a draft written on 29 Oct 2026 for the W2.7 shadow run. Nothing here is approved until Krish approves one
still per beat at Gate 2 and `ve lock freeze` hashes them. Until then `face-with-proof` stays a legacy format: lint,
compile and render work as they did, and the packet asks for his proof approval of the exact file.

Source: `config/ve/formats/face-with-proof.json` (proven on the Monday 19 Oct camera cuts he accepted) and
`docs/ve/design/TEMPLATE.md`. He on camera carries the argument; the proof arrives beside or over him on the words
that name it.

## Base beats (one key-frame slot each, in this order)

| Beat | Holds | Layouts |
|---|---|---|
| `hook` | frame 0 is the hook in the brand's dress, logo and series tag in its corners (the hook is the intro, under test) | F3, P1 |
| `face` | his face carries the line; a kinetic label adds the number, name or date the voice does not say | P1, F1 |
| `proof` | the evidence the line names (a real record, document, quote or screen) beside or over him | P3, P6 |
| `close` | one calm close: the ending band, held long enough to read | F1 |

Extra beats (more hooks, stats, the dated call) are allowed between them and are composition-checked only.

## Modules inside it

- `hand-held-screen` (format H): its five beats may sit inside a face-with-proof cut, held to H's frozen stills.
- `two-passports`: its five beats likewise, held to its frozen stills.

At freeze both become `role: module` (they keep working as their own formats).

## Canvases

| Lock entry | Canvas | Caption zone | Key-frame compare |
|---|---|---|---|
| `face-with-proof` | 1080 x 1920 | x 72, y 1180, w 900, h 320 (the lock's zones) | 540 x 960 |
| `face-with-proof@16:9` | 1920 x 1080 | x 260, y 773, w 1400, h 187 (QC's wide caption box) | 960 x 540 |

Composition zones (fill, edges, platform UI) are written for 9:16 only; a wide cut is held to its key frames once
frozen, the mechanical rows and the Critic.
