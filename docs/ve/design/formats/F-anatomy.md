# FACE WITH PROOF: anatomy (9:16 lock retired 18 Nov 2026, a draft awaiting a new Gate 2; 16:9 draft awaiting Gate 2)

Status: written as a draft on 29 Oct 2026 for the W2.7 shadow run. The 9:16 lock was frozen on 3 Nov 2026 (Krish
approved one still per beat, the round 3 stills: "Looks good to me.") and **retired on 18 Nov 2026**: Krish deleted its
four key frames for good ("DELETE THOSE FRAMES FOREVER. you need to rebuild everywhere it was to be 10X better using
those two new references"; `ve lock retire`). The format is a draft again (`config/ve/design-lock.json`,
`drafts.face-with-proof`): the retirement and the hash of every deleted frame are recorded on it, and `ve lock freeze`
refuses any of those pictures. Until he approves one new still per beat, a face-with-proof spec is read as legacy:
`ve lint` notes it, key-frame match does not apply, each cut waits for his approval of the exact file, and the Critic is
the design gate. The 16:9 entry, `face-with-proof@16:9`, is likewise a draft awaiting its own Gate 2.

Source: `config/ve/formats/face-with-proof.json` (proven on the Monday 19 Oct camera cuts he accepted) and
`docs/ve/design/TEMPLATE.md`. He on camera carries the argument; the proof arrives beside or over him on the words
that name it.

## Base beats (one key-frame slot each, in this order)

| Beat | Holds | Layouts |
|---|---|---|
| `hook` | the cut's frame 0 is the hook in the brand's dress, logo and series tag in its corners; in the file that is frame 0 of every cut, 9:16 and 16:9: nothing goes before the hook (house rule HOOK_IS_THE_INTRO; Ruling, Krish, 2026-11-12) | F3, P1 |
| `face` | his face carries the line; a kinetic label adds the number, name or date the voice does not say | P1, F1 |
| `proof` | the evidence the line names (a real record, document, quote or screen) beside or over him | P3, P6 |
| `close` | one calm close: the ending band, held long enough to read | F1 |

Extra beats (more hooks, stats, the dated call) are allowed between them and are composition-checked only.

## Modules inside it

- `hand-held-screen` (format H): its five beats may sit inside a face-with-proof cut, held to H's frozen stills.
- `two-passports`: its five beats likewise, held to its frozen stills.

Since the 3 Nov freeze both are `role: module` (they keep working as their own formats, and stay frozen on their own
key frames while their base waits for Gate 2).

## Canvases

| Lock entry | Canvas | Caption zone | Key-frame compare |
|---|---|---|---|
| `face-with-proof` | 1080 x 1920 | x 60, y 1090, w 800, h 230 (the lock's zones since 11 Nov 2026) | 540 x 960 once frozen again |
| `face-with-proof@16:9` | 1920 x 1080 | x 260, y 773, w 1400, h 187 (QC's wide caption box) | 960 x 540 |

Composition zones (fill, edges, platform UI) are written for 9:16 only; a wide cut is held to its key frames once
frozen, the mechanical rows and the Critic.

## The rebuild (18 Nov 2026): draw the new key frames from the two pieces he named

Krish, 17 Nov: "character.ai or ai music are good"; 18 Nov: "either ai music or character.ai is fine - both are good
for different reasons". The new frames are drawn from those two measured pieces and from nothing of the retired set. The one real
frame in each still is his camera plate in the band (his face, as every key frame has had); no frame of a take serves as
an example or a style still (Ruling, Krish, 2026-11-16): `docs/ve/styles/ai-music-slam.card.json` (Wed 11 Nov, the
ink stage over 64% of the frame, mint for what a human made and hatched ink for what the machine made, a camera that
never stops pushing) and `docs/ve/styles/character-ai-receipts.card.json` (Mon 26 Oct, a lit ink desk over 52% of the
frame, proof objects that print on the word that names them, a hard edge to a still face band, no camera).

What the retired frames did, set against what those two do:

| | Retired frames | The two references |
|---|---|---|
| Stage share of the frame | 40% (seam y 760), every proof scaled to 0.76 inside it | 52% (Character.AI, seam y about 1000) to 64% (AI music, seam y about 1236) |
| Stage ground | flat cream, no texture | ink ground with grain, mint and a second material that means something |
| Proof | five logo tiles in white squares and one ring; slabs that spell the caption | a real object per beat (a receipt, a chart, a screen, a real mark) that enters on its word |
| Words on stage | repeat the caption | add a source, a date or a number the voice does not say |
| Face beat | no stage at all, a caption on a full-frame face | the stage stays alive over his face band; the full frame is spent twice, on the hook and the close |
| Dead space | a blank cream stage beside small devices | `used_frame` 0.81 (AI music), the panel changing every 0.27 s (Character.AI) |

The brief for the pictures is the Codex card `docs/ve/cards/fwp-rebuild/ve-fwp-rebuild-1.md`; Claude renders its
stills, a separate reader judges them, and Krish presses Gate 2. When he approves, one commit sets `SPLIT_SEAM_Y`,
`SPLIT_CAPTION_ZONE` and the stage boxes in `apps/renderer/src/engine/layouts/` (QC reads them from
`splitGeometry.ts`), then `ve lock freeze face-with-proof --from <his approved stills>` hashes them.
