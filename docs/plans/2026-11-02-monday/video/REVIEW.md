# Monday 2 November: both cuts, made to the signed storyboard, for Krish's full playback

Piece `9a0c97af-f0d6-4d12-a7ce-773c622d4b67`, follow.the.money. Title (Krish, 31 Oct): "Claude's AI is eating the jobs
of its own humans. What does that signal for the rest of us?" Made by Claude Code on the 19 Oct quick-edit route
(kit.py, make.py, quality.py) from the direction Krish signed on 31 October ("Yes, signed off, all recommended for both
days"), with every picture beat drawn as moving panels by `video/scenes.html` ("The Ladder") and timed to his own heard
words by `video/panels.py`. Captions burned in. Krish's full playback is still his: nothing below replaces it.

## Watch

| Cut | Share copy (under 29 MiB) | Master | Length |
|---|---|---|---|
| 5-minute, 16:9 | `.cache/produce/2026-11-02-9a0c97af/long/share/who-trains-your-2030-seniors-long-16x9.mp4` (28.2 MiB) | `long/who-trains-your-2030-seniors-long-16x9.mp4` (sha256 `c72d40a39a094c5556eee6684a995a48b5d14810cf3633f0582672c2df6f958d`) | 4:42.7 |
| 90-second, 9:16 | `.cache/produce/2026-11-02-9a0c97af/short/share/who-trains-your-2030-seniors-short-9x16.mp4` (27.9 MiB) | `short/who-trains-your-2030-seniors-short-9x16.mp4` (sha256 `73bdd401b963f71f0d070483ac1d5de7f5d633f5f9ae1e484e1511e4fefe6a3e`) | 1:07.0 |

Thumbnails (his picked words "CLAUDE IS EATING ITS OWN JOBS", over his face and the ladder): `thumbs/thumb-16x9.jpg`
(1280x720) and `thumbs/thumb-9x16.jpg` (1080x1920), drawn by `video/thumbnails.py --words`.

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
- **Pictures**: 32 moving panels in the 5-minute cut, 9 in the 90-second cut (21 pages), every one moving the whole time
  it is on screen (desk drift, parallax, objects that land on their word and keep floating; "I want way more animation
  than ever before and movement", Krish, 31 Oct). The real pages (Anthropic's report, Stanford, IMF) are screenshots of
  the sources with the proving line highlighted (`imagery/src`). Every number carries its producer and date.
- **Production notes, for his playback**: the 90-second cut's beat 5 ("But I think this time is different", 3.1 s)
  keeps beat 4's past scene on screen under it, and its last line keeps the two action cards, because make.py's 9:16
  gate needs a picture over 90% of his words with no gap over 1.5 s and 20 changes a minute (it passes: 95.6% covered).
  Beat 4's two frames are the branches (+43%) then the accountants (+600,000).
- **The 16:9 brand frame** (kit.py) behind him when he speaks alone carries his final title, the follow.the.money
  sticker "Bring a calculator" (config/studio.json) and the Mondays card. It shows for about a quarter of a second at the
  very start before the hook's first picture lands.
- **One close**: the house end card, once, after his last word.

## What I measured on the final files

| | 5-minute | 90-second |
|---|---|---|
| Loudness, master (ebur128) | -14.4 LUFS, true peak -1.6 dBTP | -14.1 LUFS, true peak -1.6 dBTP |
| Loudness, share copy | -14.5 LUFS, true peak -1.3 dBTP (audio limited after encode; it was -0.6) | -14.1 LUFS, true peak -1.2 dBTP |
| Music | No Curves (licensed), the episode bed, under the whole cut | No Curves, continuous |
| Camera shake (wall tracker) | 7.11 -> 5.73 px RMS, p95 12.60 -> 11.03 px (11% steady crop) | 6.68 -> 4.36 px RMS, p95 12.68 -> 8.22 px (6% crop) |
| Words gate | **Held on the receipt.** small.en on the final flagged 6 words, medium.en 2 ("meeting"/"needing", "feel"/"fill"). Every one of the eight was heard in the finished file by a stronger model (medium.en or large-v3-turbo), with the script's own word: "Anthropic" x3, "bookkeeping", "role", "ask", "needing", "feel". No word is lost; the receipt still says fail and is left as it is | PASS, no content word lost |
| Lip sync | not measured: no SyncNet model on this machine | not measured |
| Contact sheets | whole cut every 3 s, first and last 10 s every 0.25 s (`review/long-*.jpg`), looked at | whole cut every 2 s, first and last 10 s every 0.25 s (`review/short-*.jpg`), looked at |

## Listen for

- 5-minute, 0:05 "behind Claude"; 1:06 "needing 20 tellers"; 2:03 "who feel that the most"; 3:44 "a junior role":
  the four places a transcriber heard otherwise. Clips of the take and the final at each: `review/clips/`.
- 90-second, 0:24 "lean on" (script: "learn on"), as he said it; captions follow his take.
- 90-second, 1:00 "so that they'll learn it with AI" (the script has "then with AI"); kept as said.

## Status

- **Fact**: the article's fact gate passes (Krish signed off the Bessen line, 31 Oct). Every number on screen is on a
  filed line of the research with its producer credited.
- **Transport**: both masters and share copies encoded, loudness inside -14 +-1 LUFS and -1 dBTP; the 90-second cut's
  words gate passes; the 5-minute cut's words gate receipt is held on transcriber hearing (above); lip sync not measured.
- **Editorial**: not reviewed by anyone but the maker. The independent reviewer's pass against `acceptance` has not run
  in this session (a worker session cannot start one); Krish's full playback is his.
