# Proactive AI off-day short: pure voiceover, rebuilt 11 Nov 2026

Krish, 11 Nov 2026: "on the proactive AI piece, can you just generate a more entertaining, hook-laden script, get the
script read out by my elevenlabs clone and produce a voiceover format?", then "A" (the take) and "can you create this
in the style of The Ladder?" The Ladder is the data-story recipe, `config/ve/recipes/data-story.json`.

- Script: `script.txt` (133 words; copy lint clean; one fresh reader, Haiku, read it once and got the point and the
  action; "Muse" became "Meta's AI, Muse" after that reader did not know the name. Muse being Meta's is from his
  own earlier script and is not checked against a source).
- Voice: ElevenLabs voice "Krish" (cloned, 7ApmIXLoWa0cKUtJqfHc), eleven_v4, flow vG4q7iGQsvzMRNWUJfvm, take A
  generation bGwYQhgrcRz2dtNN15hh (40.88 s), 786 credits each for two takes. Take A was heard back with faster-whisper
  small.en: word for word the script. `words-a.json` is its word timing.
- Picture: per-piece code to the recipe (ve cannot draw the through-line yet): `build_proof.py` writes the page,
  `shoot.js` renders it frame by frame. The proof is 13.8 s to 27.4 s of take A, the hardest beat: three actions
  arrive with empty approval slots, a fourth lands with its slot left empty ("your yes was here", the recipe's missing
  part), then "2" becomes the two mint stops, NO SPENDING and NO SENDING. No wordmark (Krish, 11 Nov 2026: "I also
  don't think we need the word mark in videos like this (in short, vertical videos)").
- Next: his yes or no on the proof, then the whole 41 s cut on the same page, with an off-day bed.

## v2, 11 Nov 2026: captions after the reference, picture higher, faster

Krish: "How can you make the captions more like this video? ... and also, the real-world images can be higher, and
the motion a bit faster." The reference is his inspiration card `instagram_DfkCOCLt7KZ` (8ca0bd3d), which he saved
for "The captions are very unique and well-designed, like an art director would do them."

The caption style ("art-directed phrases"), as built in `build_proof.py`:
- Anton capitals, white, soft shadow; no box, no pill, no underline.
- Hand-set phrases of one to four words that read as speech (`PHRASES`: word count and key-word index); the words
  build as they are said, each popping in over 0.12 s.
- One key word per phrase at 168 px, the others at 92 px; the key word takes its own row.
- Phrases alternate left and right in the space under the object, inside the channel safe area (left 70 px, right
  edge at x 870, y 1095 to 1325).
- A huge faint echo of the key word (Anton 430 px, 7%) sits behind the scene, cropped by the frame.
- Mint stays for the answer only; the captions themselves are never coloured.

## The whole cut, 11 Nov 2026

Krish approved proof v2: "looks good". `build_cut.py` writes the whole 42.1 s page on the same look (the proof's
13.8 s to 27.6 s unchanged); `shoot2.js` renders it (`META=cut.json OUT=cutframes node shoot2.js`).

- Opening, never an empty frame: the old way is already on the thread ("Can you book dinner?" / "Done"); on
  "messaging you first" it flips and the AI speaks first. "Wake up before you do": a big clock counts 07:00 back to
  06:12. "Muse ... WhatsApp": WhatsApp's real mark (Brandfetch, monochrome for the dark ground) lands at the size of a
  part, then settles into the header beside MUSE. "Every assistant coming next": the thread copies itself four times;
  the copies fold back into the one thread.
- Close: on "until you say yes" every slot turns to a mint YES? and the stops glow once; your one question arrives;
  the AI types the two rules on "writes the rules with you"; PROMPT IN THE COMMENTS lands; the clock reads 22:00 on
  "tonight"; a calm hold to the end.
- Bed: Goodie Bags (off-day, `config/music-library.json`), shaped with `scripts/bed_shape.py` target points to the
  approved levels; `bed_shape.qc` on the bed stem: pass (median -31.0 LUFS, spread 1.4 LU, open +10.9 LU, end
  +6.3 LU). Mix: -14.9 LUFS integrated, true peak -1.0 dB.
- Open on the ledger: the four off-day tracks are still "proposed" there (no sha256, never measured) although the
  9 Nov session archive says his off-day approvals stand; music.py pick therefore falls back to the series bed. Not
  filed to 3 Posts until his approval of the cut and a bed-shape receipt for the exact file.
