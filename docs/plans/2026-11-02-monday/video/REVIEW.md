# Monday 2 November: both cuts, made to the signed storyboard, for Krish's full playback

Piece `9a0c97af-f0d6-4d12-a7ce-773c622d4b67`, follow.the.money. Title (Krish, 31 Oct): "Claude's AI is eating the jobs
of its own humans. What does that signal for the rest of us?" Made by Claude Code on the 19 Oct quick-edit route
(kit.py, make.py, quality.py) from the direction Krish signed on 31 October ("Yes, signed off, all recommended for both
days"), with every picture beat drawn as moving panels by `video/scenes.html` ("The Ladder") and timed to his own heard
words by `video/panels.py`. Captions burned in. Krish's full playback is still his: nothing below replaces it.

## Watch

| Cut | Share copy (under 29 MiB) | Master | Length |
|---|---|---|---|
| 5-minute, 16:9 | `.cache/produce/2026-11-02-9a0c97af/long/share/who-trains-your-2030-seniors-long-16x9.mp4` (28.2 MiB) | `long/who-trains-your-2030-seniors-long-16x9.mp4` (sha256 `787b5232ca1ee39cdd2d413588e08b833a986fc5114480f0fd922c900d16303b`) | 4:42.7 |
| 90-second, 9:16 | `.cache/produce/2026-11-02-9a0c97af/short/share/who-trains-your-2030-seniors-short-9x16.mp4` (27.9 MiB) | `short/who-trains-your-2030-seniors-short-9x16.mp4` (sha256 `54de981596ae332d07378c99de1ff1ba1516060070a071198537a9959fa7f1bb`) | 1:07.0 |

Thumbnails (his picked words "CLAUDE IS EATING ITS OWN JOBS", over his face and the ladder): `thumbs/thumb-16x9.jpg`
(1280x720) and `thumbs/thumb-9x16.jpg` (1080x1920), drawn by `video/thumbnails.py --words`.

## Rebuilt on the independent review (31 Oct, one fix loop)

The reviewer failed both cuts on editorial grounds. Changed:

1. Every small kicker and eyebrow label is gone (the hook's typed label, "1 IN 3 ML MANAGERS", "EARLY 2025", "SINCE
   1980", "NEXT HIRING MEETING", the action cards' kickers, and the rest). The credits with producer and date stay at
   the foot; the legends that say what a number is (STAFF and AI AGENTS, SENIOR and JUNIOR, BOOKKEEPING CLERKS and
   ACCOUNTANTS, ANTHROPIC STAFF and OTHER AMERICANS, TELLER and ACCOUNTANT) stay.
2. No still yellow card: every face beat of the 5-minute cut now has a moving panel (the ladder turning slowly with its
   9% or its gap, or the beat before carried on), and the frame behind him is the brand's ink, not the yellow card.
3. No bare ladder: every ladder frame shows 9%, 2030, +43% and +600,000, or the gap (a dashed mint outline where the
   junior rung was).
4. The first picture starts at 0:00 in both cuts. make.py still fades a first picture in over 0.35 s (frame 0 of the
   90-second cut is his face; the 5-minute cut's first frame is ink): removing that fade is an engine change, not made.
5. The 90-second cut's action cards sit lower, clear of the wordmark and the captions.
6. "ATMS", "SPREADSHEETS" and "JUDGEMENT" are gone (drawn objects and the gap instead); the action cards are numerals
   only (1, 2, 3), picture only.
7. The 5-minute cut is one continuous run of pictures from his first word to his last, so every change is a
   panel-to-panel crossfade (0.35 s) on its word and his column never moves.

Second review (31 Oct), also fixed: the brand is captioned "makeyourmindup.ai" wherever he says it (the transcriber
heard "makeyourmindhop"; caption words only, the sound untouched); the 90-second close has no cards over the last
line and no fade back to his face before the end card; no WEEK boxes, no "TELLER · 13"; a page's credit sits at the
top of the panel, clear of the page's footnotes; the question cards are blank mint cards on the gap, no sentence.

## What was made, and where

- **Takes**: his two portrait takes, matched word by word to the signed scripts (recorded on the piece 31 Oct),
  conformed to 24 fps with every audio sample copied (`video/prepare_takes.py cfr`).
- **The opening**: the long take's first 2.5 s ("So we had one today, and that's a") are left out, so the cut opens on
  "Junior hiring at Anthropic", his hook, as he signed. Nothing else he said is cut. make.py closes pauses over
  0.9 s between his sentences: 10 such joins in the 5-minute cut, 2 in the 90-second cut, each in a silence.
- **0:05, "behind" or "buying" Claude**: medium.en and large-v3-turbo both hear "the AI company **behind** Claude".
  Kept as said; the caption reads "behind".
- **His story**: in both takes he tells the dull-job story about "a new hire"; the pictures follow a new hire's
  spreadsheet. No Microsoft, Excel or 2008 on screen.
- **Pictures**: 40 moving panels in the 5-minute cut, 9 in the 90-second cut (21 pages), every one moving the whole time
  it is on screen (desk drift, parallax, objects that land on their word and keep floating; "I want way more animation
  than ever before and movement", Krish, 31 Oct). The real pages (Anthropic's report, Stanford, IMF) are screenshots of
  the sources with the proving line highlighted (`imagery/src`). Every number carries its producer and date.
- **Production notes, for his playback**: the 90-second cut's beat 5 ("But I think this time is different", 3.1 s)
  keeps beat 4's past scene on screen under it, and in its closing line the two numeral cards lift away to the ladder with its gap, held to his last word, because make.py's 9:16
  gate needs a picture over 90% of his words with no gap over 1.5 s and 20 changes a minute (it passes: 95.6% covered).
  Beat 4's two frames are the branches (+43%) then the accountants (+600,000).
- **The 16:9 frame behind him** is the brand's ink (`kit/frame-ink-16x9.png`), not kit.py's yellow card, and it is
  never seen: from his first word to his last a moving panel sits beside him, so the layout never changes.
- **One close**: the house end card, once, after his last word.

## What I measured on the final files

| | 5-minute | 90-second |
|---|---|---|
| Loudness, master (ebur128) | -14.4 LUFS, true peak -1.4 dBTP | -14.1 LUFS, true peak -1.6 dBTP |
| Loudness, share copy | -14.5 LUFS, true peak -1.3 dBTP (audio limited after encode), 28.2 MiB | -14.1 LUFS, true peak -1.2 dBTP, 27.9 MiB |
| Music | No Curves (licensed), the episode bed, under the whole cut | No Curves, continuous |
| Camera shake (wall tracker) | 7.11 -> 5.73 px RMS, p95 12.60 -> 11.03 px (11% steady crop) | 6.68 -> 4.36 px RMS, p95 12.68 -> 8.22 px (6% crop) |
| Words gate | **Held on the receipt.** large-v3-turbo (the receipt's run, 31 Oct) flags 3: "meeting" (the take's transcript; the script and the final say "needing"), "own" (heard as "Anthropic zone"; medium.en hears "Anthropic's own reports") and "However," (both medium.en and large-v3-turbo hear "However, however much" in the final). No word is lost; the receipt still says fail and is left as it is | PASS, no content word lost |
| Lip sync | not measured: no SyncNet model on this machine | not measured |
| Contact sheets | whole cut every 3 s, first and last 10 s every 0.25 s (`review/long-*.jpg`), looked at | whole cut every 2 s, first and last 10 s every 0.25 s (`review/short-*.jpg`), looked at |

## Listen for

- 5-minute, 0:05 "behind Claude"; 1:06 "needing 20 tellers"; 1:57 "Anthropic's own reports"; 2:51 "However, however
  much": the places a transcriber heard otherwise. Clips of the take and the final at each: `review/clips/`.
- 90-second, 0:24 "lean on" (script: "learn on"), as he said it; captions follow his take.
- 90-second, 1:00 "so that they'll learn it with AI" (the script has "then with AI"); kept as said.

## Status

- **Fact**: the article's fact gate passes (Krish signed off the Bessen line, 31 Oct). Every number on screen is on a
  filed line of the research with its producer credited.
- **Transport**: both masters and share copies encoded, loudness inside -14 +-1 LUFS and -1 dBTP; the 90-second cut's
  words gate passes; the 5-minute cut's words gate receipt is held on transcriber hearing (above); lip sync not measured.
- **Editorial**: the independent reviewer failed the first build (31 Oct); this rebuild has not been re-reviewed.
  Krish's full playback is his.
