# Full short voiceover working cut — 25 October 2026

Authority: Krish accepted the v3 direction, required motion throughout the
voiceover, encouraged it in the on-camera versions, and said “Go”. His minimal
words, nonduplication, recognisable cues and neutral country treatment apply to
the whole export, including packaging. Original locked files remain unchanged.

**Superseded on 26 October: Krish approved the audio and rejected the motion quality.** See `../motion-v5/STATUS.md`. This is historical production evidence, not an accepted video. No making step or live
Publish Board was written. The three other cuts remain incomplete.

## Production

- Fourteen beats use the continuous 1.12x short voiceover, freshly transcribed on
  that clock. No speech cuts, inserted words or second speed operation.
- `apps/renderer/src/border-control/Short.tsx` extends the accepted passport,
  paper sheet and tile field with the international deck, verified Chesky
  portrait, phone-to-server packet, cotton-to-shirt supply relationship, actual
  deletion footage and two neutral AI response windows.
- Country flags are official flag-icons SVGs. Mistral and K2 Think currently use
  text identifiers with their flags, not fabricated marks. Anthropic's supplied
  official symbol identifies Claude alongside the explicit Claude name.
- The general passport remains EXAMPLE / BORN CANADA / LIVES USA, with flags.
  The specific DeepSeek hosting and test scenes retain China because those
  examples concern DeepSeek. General advice returns to the unbranded example.
- The source article paragraphs are provenance, not on-screen reading. The
  35% scene is 35 of 100 response tiles. Claude's scene uses a response bubble,
  not a correctness tick: answering every question does not prove correctness.
- The real deletion is cropped to a short first-line excerpt. It remains the
  24 October recording; the 3/3 result is separately labelled 23 October. The
  replay uses 4.95–5.45 seconds of the original recording at quarter speed.
  Cropping and an excerpt-edge mask remove following words without rewriting
  the source. The original recording is preserved. Pixel inspection found the
  answer still present at 5.033 seconds and absent at 5.133 seconds.
- The locked title and closing question are retained in minimal packaging.
  The brand/link sign-off is a separate state. The previous packaging's extra
  labels exceeded the new word budget; it is not silently exempted.

## Engine path and gates

`make.py` now accepts a `motion_composition` job for a continuous short VO.
`motion_compose.py` validates each input hash, source transcript identity,
original-to-prepared duration, 30 fps counts, common shape and <89-second limit.
It uses make.py's approved music/mix routines and transcribes the final file for
the separate SRT. It does not accept camera footage or perform speech removals.
Archive mode is refused: all delivery gates remain enforced by quality.py.

Five regression tests reject changed media, an accidental second speed,
mismatched motion duration and unprepared speech removals. These are mechanical
checks, not listening or visual-comprehension proof.

## Open verification

- Actual listening is unavailable in this session: the audio-input attempt
  explicitly returned “audio content omitted because you do not support audio
  input”. No claim of listening or full audiovisual playback is made.
- The final v4 ASR comparison matches all 205 source words, in order. Earlier mix iterations differed on the model name; the SRT uses Qwen from the locked script. Krish subsequently confirmed the complete audio is fine. That approval is limited to this export.
- Independent semantic nonduplication and the blinded three-second prediction
  or human comprehension test remain open. Author inspection is not that test.
- A 26 October authenticated read via Windows curl recovered board access after Python urllib SSL failures. All six stores for 19 October remain unchanged at revision 50. The 26 October board is revision 2 with empty stores.
- The remaining three cuts still need approved speech repairs, camera treatment
  where applicable, full motion, final transcripts and the same release reviews.

Next: finish exact-byte checks on the working short, resolve the listening
review route, then produce and review the other three cuts. Final board publish
still requires Krish's explicit yes to the actual completed build.
