# Story on the beat (territory b): spec

**Governing idea:** the story's own subject is the picture and the music bed is the clock, so for Monday the intro is a song track that plays, every beat lands one thing (a real logo, a word of the question, the brand), and the outro plays the track out with its credits as the call to action.

Files: `mock.html` (self-contained, built from `mock.src.html` by `build.js`), contact sheets `sheet-intro-wide.png`, `sheet-intro-tall.png`, `sheet-outro-wide.png`, `sheet-outro-tall.png` (12 frames each at (i + 0.5) x length / 12; the 9:16 sheets draw the 220 px and 420 px platform zones as red dashed lines). The `x-*.png` files are extra checks: Friday's sheets, the page at 1366 px and at 400 px, and the cue sheet.

## Lengths
| | 16:9 | 9:16 |
|---|---|---|
| Intro | 3.5 s (7 beats) | 3.0 s (6 beats) |
| Outro | 5.0 s (10 beats) | 4.0 s (8 beats) |

The tall cut adds 7.0 s to the 95 s take. The tall intro saves a beat by opening on the first logo, not the track alone. The tall outro brings the three credits in one beat apart, not two.

## Timeline (120 BPM, 1 beat = 0.5 s = 15 frames)
The unit is the beat, not the second. BPM and the first downbeat (`intro_cue_s`) are props. When NO CURVES is measured, every hit moves with them.

**Intro, 16:9:**
- 0.0: ink frame. A big series-colour waveform bursts in and the mint playhead starts. The series pill `follow.the.money` sits top left.
- 0.5: the waveform drops to the lower third. The Suno card slams in at the playhead, with a stamp, a flash and a shake. Chip: "Pays" (yellow).
- 1.0: the Warner Music card lands. Chip: "Gets paid" (mint).
- 1.5: the Sony Music and Universal card lands. Chip: "Suing" (coral).
- 2.0: the playhead reaches the end and we hard cut to a series-yellow field. The cards are gone, the waveform turns ink and "Who gets paid" slams in.
- 2.5: "for AI songs?" slams in.
- 3.0: the ink brand slab rises from the bottom with MAKE YOUR MIND/UP (UP in mint) and `follow.the.money every Monday`. The question stays readable above it.
- 3.5: cut to Krish.

**Intro, 9:16:** the same order in rows inside the safe zone (y 250 to 1480).
- 0.0: the track starts with the Suno row.
- 0.5: Warner.
- 1.0: Sony and Universal.
- 1.5: "Who / gets paid".
- 2.0: "for AI / songs?".
- 2.5: the brand slab.
- 3.0: cut to Krish.

**Outro, 16:9:**
- 0.0: the "cover art" square in series colour, holding the question, slams in. The track is already 55 % played.
- 0.5: credit "The full story, free: makeyourmindup.ai".
- 1.5: credit "Your say: Should singers get paid? When an AI learns their song. Tell me in the comments."
- 2.5: credit "Next: under.the.hood Wednesday" (lilac chip).
- 3.5: the playhead reaches the end and the waveform collapses to a flat line.
- 4.0: the wordmark lands on the line.
- 5.0: end.

Each credit steps up into place on its beat, like a credit roll that moves only on the beat.

**Outro, 9:16:** cover strip, then credits at 0.5, 1.0 and 1.5, the flat line at 2.5, the wordmark at 3.0 and the end at 4.0.

## Constant across stories, and what varies
- **Constant:** the beat grid and the order (subject, cast, question, brand slab). Also constant are one thing per beat, the hard cut to the series colour on the question, the playhead, the ink brand slab and wordmark, and the outro shape (cover, three credits, flat line, wordmark). Ink, cream and mint stay too, and so does the layout per size.
- **Varies (props):** series name, day and colour. Also the subject renderer: `waveform` for a song, `menu` for Friday's "so many AIs", a growing grid of Small, Medium and Large tiles. Then the cast (real logo files plus a one-or-two-word role and a role colour), the question split into two beat hits with explicit line breaks per size, the comment ask, and the next episode's series. The panel at the bottom of the page shows Friday running through the same functions with nothing else changed.

## Audio cue sheet (music levels are the proposed ones in config/music-library.json)
| Moment | Time 16:9 / 9:16 | Bed | Level | Sound design |
|---|---|---|---|---|
| Intro opens | 0.0 / 0.0 | NO CURVES enters on a downbeat | -16 LUFS | Kick plus a short tape-start lift |
| Each logo | 0.5, 1.0, 1.5 / 0.0, 0.5, 1.0 | same | -16 | Dry stamp layered on the kick, one per logo |
| Question | 2.0, 2.5 / 1.5, 2.0 | same | -16 | Snare slam per word group |
| Brand slab | 3.0 / 2.5 | bar resolves | -16 | Low boom |
| Krish starts | 3.5 / 3.0 | ducks over 0.5 s | -31 | none |
| Under voice | to the last line | continues low | -31 | none |
| Outro opens | after "Make your mind up." | rises over 0.8 s | to -18 | Kick as the cover lands |
| Credits | 0.5, 1.5, 2.5 / 0.5, 1.0, 1.5 | same | -18 | Stamp per credit |
| Track ends | 3.5 / 2.5 | the track's own ending, cued with `outro_cue_s` | -18 | Last hit; waveform goes flat |
| Wordmark | 4.0 / 3.0 | rings out | fades to silence by the end | Final boom |
| Whole mix | | | -14 LUFS integrated, -1 dBTP | |

**Character wanted:** punchy and confident, mid-tempo (about 110 to 125 BPM), with a clear kick on every beat and a bar that resolves in two bars. NO CURVES is the only listed track, and it is proposed, not approved. Nobody has measured its BPM, cue points or loudness yet (all null in the ledger). The intro would start on one of its downbeats so the kick sits under each visual hit. The outro would be cut so its natural ending lands on the flat line. No other track is named.

## Logos used (real files, cream, not recoloured)
- `docs/plans/2026-10-12-monday/logos/suno-logo-cream.svg` (Suno).
- Warner Music: the WMG symbol, taken unaltered from the first image embedded in `cover-partners-cream.svg`. BMG is in that file too, but Monday's scripts do not name BMG, so I left it out.
- Sony Music and Universal: the two images embedded in `cover-suing-cream.svg` (the Sony Music symbol, then the UMG logo), each used unaltered.

All logos sit on ink cards, so no filter was needed. Names are set under the Warner and Sony symbols, because those marks carry no words.

## Could not do / open
- Friday's ChatGPT and Claude logos are not in the repo files I was given, so they show as labelled grey placeholders.
- The UMG logo's small lettering stays small even at the card size used: that is the mark itself. A bigger card or a UMG-only beat would fix it.
- I did not hear NO CURVES. The 120 BPM grid is an assumption until the track is measured. Levels are proposed, and nobody has ruled whether the 90-second cap counts the intro and outro.
- The on-screen ask shortens the script's question to "Should singers get paid?", with "When an AI learns their song." as a smaller line under it.
- If Krish also wants the separate brand sting, it would play before the story intro, cut on the intro's first downbeat. The intro's own brand slab could then drop to a smaller sign-off.
