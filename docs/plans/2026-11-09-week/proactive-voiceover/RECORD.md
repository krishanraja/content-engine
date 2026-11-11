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

## Music, 11 Nov 2026

Krish on the Goodie Bags bed: "The audio track is terrible. Doesn't work at all." Shown the cut with Aspire,
Illusions, Be Alone and voice only, he chose: "Aspire, but half the volume". `mixbed.py` shapes Aspire to the
approved bed curve (`scripts/bed_shape.py` target points) 6 dB under the ledger levels, the end lift only 4.5 dB
under so the close still rises; `bed_shape.qc` on the bed stem: pass (median -36.8 LUFS, open +13.8 LU, end +7.3 LU).
Mix: -14.8 LUFS integrated, true peak -1.0 dB. This level is for this cut, by his word; the ledger levels are
unchanged.

## Final cut, 11 Nov 2026: posts Monday 16 Nov

Krish: "get rid of the first couple of seconds of the Aspire track because it enters really loud. This should post
next week on Monday. Then we also need to have an outro card to follow for more at makeyourmindup.ai." Then, on the
wordmark: "I don't have a no-word-mark rule for tall videos entirely. I just have a no-word-mark rule during the
animated content, not the closing outro card." and, of the house sting, "it's this one. Just upgrade it to have a
"Follow for more" badge under the word mark, and then we're good to go."

- Music: Aspire from 2.0 s into the track, 6 dB under the ledger levels (end lift 4.5 dB under); `bed-shape-qc.json`
  is `bed_shape.qc` on the bed stem: pass. Mix -14.4 LUFS integrated, true peak -1.0 dB.
- Outro: the house sting `makeyourmindup-sting-9x16-follow_the_money.mp4` (library `1 Brand kit (permanent)/Intro
  sting/`, Drive file 1LxiqcxzPsRzIKu5kUcca4Z_Nw0HMJcQw) frames 1 to 48, held on frame 48 for 2.4 s with a FOLLOW FOR
  MORE badge under the wordmark band at its 3.2 degree tilt (`badge.py`). The cut runs 46.0 s, sha256 220cd09b...
- Filing: the bed-shape receipt the library needs can only be written by ve or quick-edit
  (`config/music-bed.json` receipt.engines; "a per-day compositor's cut is never filed"). This cut is per-piece
  code, as The Ladder's was, so no receipt is written and it is not in 3 Posts until Krish rules on it.

## The real screenshot, and filing, 11 Nov 2026

Krish asked whether to animate his screenshot of an AI setting out guardrail choices. Yes: on "and it writes the
rules with you" the cut now shows the real screenshot as itself (`guardrails.png`), with the three choices he picked
(A "Approve every individual send", B "Approve every financial commitment", C "Zero unapproved incremental usage
costs") lifted out of it as enlarged crops of its own pixels (41 to 49 px text, F44), lighting as he says them; the
invented rules bubble is gone. Its qualifier stays visible on the screenshot. Final cut 46.0 s, sha256 0e02f119....

Filed under his exception ("Yes, I approve as an exception."), recorded in `config/filing-exceptions.json` for these
bytes and this destination only: `3 Posts/2026-11-16 Mon off.day - Proactive AI/` (3 Video: the cut; 4 Social: the
post description with his copy-paste prompt, word for word).
