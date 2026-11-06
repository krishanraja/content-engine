# Making a face-with-proof short reach its references

Krish, 2026-11-04: "just proceed with VE and learn how to produce a world-class output this time round so that next
time you never have to relearn." This page is what the Thursday 5 Nov re-cut learned, in order, so the next piece
starts here. The numbers are in `MOTION_STANDARD.md`; this page is the method. Read it before S1.

## 1. Watch the references whole, at full size, before designing anything

Contact sheets of the two board reels, one frame a second, at full size (`ffmpeg -vf fps=1,scale=240:-1,tile=9x4`).
What they show that the measured table alone did not:

- **jackroberts___ (look and motion).** Every graphic sits on a pale wash, never on dark. A new object arrives with
  almost every phrase (1 to 1.5 s). Objects are real things drawn large: product UI, a logo with animated rings, a
  waveform, a photo. On a split the graphic owns the top half, a close face the bottom, and the caption word sits on
  the seam. A few beats are face alone. The close ends on one loud quoted word in a big serif.
- **georgia_la (captions).** The speaker is on camera throughout; a two-line title holds at the top; one word at a
  time at chest height, white with a soft shadow, mixing heavy sans and serif words. No graphics.

Krish's brief was both at once ("its the georgia subtitles build, and the motion and graphics of the other one"):
jackroberts on the graphics beats, georgia on the face-alone beats.

## 2. One brand treatment on every beat

The cut Krish called "the branding is wrong" wore two: an ink stage with the horizontal logo on graphics beats and a
cream stage with the mark tile on splits. Since #380 face-with-proof draws its STAGE graphics on the same light wash
as its SPLIT stage, with the mark tile and pill everywhere. Never put a face-with-proof graphic on ink.

## 3. Design the spec to the signed storyboard, then to the pace

- Start from the storyboard Krish signed; every element it names is in the spec (the Thursday spec had dropped the
  hero and four of its beats).
- Something visibly new every 1.5 to 3 s on a graphics beat: a row types, a stamp lands, a mark highlights, a card
  enters. An object that enters must show content on its first frame (type row 0 at the enter word): an empty card is
  a dead frame.
- Never show the same object twice (the slab at 20 s and again at 36 s read as repetition). Close on a new visual
  that states the result (the rules settings card), not the earlier slab.
- Anything whose point is a message (a chat reply, a blocked send) goes on a STAGE beat, never a SPLIT: the split's
  graphic half is 400 px tall and clips a two-row chat at the seam.
- Keep the face to the beats that need it (Thursday: about 15 of 44 s). The face-alone beat carries the held title
  and the word build; give it `override_reason` naming the face-alone kind, since the event cadence lint counts device
  events only.
- Stamps tag a card; place them inside the card, never over the line they comment on.

## 4. Prove each step on the real cut, not on proxies

- Try each change on his own footage before a whole cut: in the lab (`ve lab render`) or on the proof of the hardest
  beat (`ve proof`), then look at a contact sheet and at the worst frames full size. A whole cut renders at most twice
  between his presses (`ve render` refuses a third for a piece published from 9 Nov, F34).
- QC is heard by the two forced aligners (MMS draws the captions, wav2vec2 hears them); never by whisper, which runs
  3 to 19 frames off.
- The cloud container needs the pinned ffmpeg (release `toolchain-ffmpeg-n8.1.2-53-g1005b294ff`), tesseract, torch
  and torchaudio (CPU wheels), faster-whisper with PyAV below 15, and OpenCV 4 (OpenCV 5 has no face cascade).
- The brand mark, logo and stacked logo come from `krishanraja/control-center` at the commit `config/studio.json`
  pins, checked against their sha256, staged under `<assets>/src/assets/brand/makeyourmindup/`.

## 5. The Critic is the gate, and it can be wrong

A fresh `ve-critic` scores the cut against each board card; under 8 is not ready. Check its findings before acting:
it flagged the off.day pill (correct for a Thursday post, `compile.py`) and georgia's mixed serif words (part of that
build). Fix what is real; record the rest in the verdict.

## 6. Codex cards

Book one card at a time (Control Center holds one open reservation per engine). Give every card an acceptance that
runs on the building computer (no tesseract there), re-run it yourself, render the piece on the card's branch, and
regenerate `docs/REPO_MAP.md` and add a closeout note before its pull request.
