# Wednesday 4 November, Claude Duet: both cuts, for Krish's full playback

Piece `b63d2507-dbb4-449d-bce4-f21e859ee2ad` (under.the.hood), "AI used to reply. Now it acts first. Claude Duet is the
start." Made by Claude Code on the 19 Oct quick-edit route (kit.py, make.py), from the direction Krish signed on
31 October ("Yes, signed off, all recommended for both days"), with captions burned in and the motion he asked for the
same day ("I want way more animation than ever before and movement"). Nothing is filed and nothing is posted: Krish is
the only one who can watch and accept them.

## Watch

| Cut | File to watch | Master | Length |
|---|---|---|---|
| 90-second, 9:16 | `.cache/produce/2026-11-04-b63d2507/render/short/share/claude-duet-short-9x16-share.mp4` (24.4 MiB) | `render/short/claude-duet-short-9x16.mp4` | SHORT_LEN (you 1:13.8, end card 4.0 s) |
| 5-minute, 16:9 | `.cache/produce/2026-11-04-b63d2507/render/long/share/claude-duet-long-16x9-share.mp4` | `render/long/claude-duet-long-16x9.mp4` | LONG_LEN |

Thumbnails (the house drawer, `thumbs.json` beside them): `.cache/produce/2026-11-04-b63d2507/thumbs/`, "AI NOW ACTS
FIRST" with his face and the Claude mark, 1280x720 and 1080x1920.

## What is on screen

- **The Queue** (`motion-system.md`): paper work orders slide along a rail and stop at a lilac line until a mint YES
  stamps. It drifts beside him under every face beat of the 5-minute cut, so the right side never holds a still card,
  and it carries the big moment ("the work turns up first"), the off-limits pair and the close.
- **His own Duet screen recording**, playing as video in the approved hand-held phone: the first message, the morning
  brief, the setup screens, the tasks, his "remove the job hunt" reply, the ten jobs, the slow "Thinking it through"
  (sped up 8 times, said on screen), Make and the calendar scheduler building itself. Every private detail sits under
  solid ink bars in every frame: his name, the K avatar, the job hunt, his ventures, people, places, amounts, the
  morning brief's body, the Artifacts titles. Duet's own mark and status pill are put back on top only while the pill is
  on screen. Stretches that showed his Google account addresses, the scrolling brief, the artifact grid or the task
  page were left out. Proof: `review/covers-*.jpg` and `review/short-screens.jpg`, every half second.
- **Real pages, the line marked**: Anthropic's announcement, the Help Center (Microsoft 365, usage limits) and Claire
  Vo's review. The Reddit thread asks for a login, so its two beats are drawn from the checked words (the quote card,
  then 36 HOURS) with a foot credit and no username.
- **Real logos**: Gmail, Google Calendar, Slack, Microsoft 365, Claude.
- **One opening, one close**: the 9:16 cut opens on the Claude mark landing with his first words and closes straight
  into the house end card; the 16:9 cut opens on The Queue beside him and closes the same way. No title card, no sting.

## Changed after the reviewer of Monday's cuts (31 Oct), and checked here

1. No kicker or eyebrow text inside a card (work-order numbers, READY, DRAFT, WAITS FOR YOUR YES, app names under
   logos all removed). The foot credits stay (REDDIT r/ClaudeAI · 26 OCT 2026).
2. No label that repeats what he says (TODAY, WITH DUET, ASK ONCE, USE IT AGAIN AND AGAIN, ON FIRE, the question
   bubble, the inbox's words all gone; the rest add a date, a number or a name).
3. Nothing bare: the rail and the inbox are never empty on screen; the queue never runs dry.
4. One layout in the 16:9 cut: a moving panel beside him from 0:00 to the end card, never the still brand frame (it
   carries the new title, kit.py drew it on 31 Oct, but no frame of the cut shows it).
5. Engine fix (`scripts/quick-edit/make.py`, `edge_open` / `edge_close`, self-test 107 checks): a picture that starts
   on the main's first frame is there from that frame, and one that runs to its last frame cuts into the end card,
   never fading over his face. Both cuts' first frame is a picture; both closes are clean.
6. Nothing made up: an invented chat request ("Find me free slots...") became the Calendar scheduler tile in Duet's
   own words; invented draft titles became the script's own ("Draft reply", "Meeting prep").
7. Captions spell Duet, Claude, Claire Vo, Lenny's Newsletter, Anthropic and makeyourmindup.ai as written (checked in
   both .srt files).

## What I measured on the final files

| | 90-second | 5-minute |
|---|---|---|
| Loudness, final encode (ebur128) | -14.0 LUFS, true peak -1.5 dBTP | LONG_LOUD |
| Music bed | No Curves (licensed), continuous, 17.1 LU under him | episode bed, LONG_BED |
| Camera joins | none: one continuous take | none: one continuous take |
| Words gate (`words_gate.py`) | see below | see below |
| Lip sync (SyncNet) | not measured: no SyncNet model in this cloud session | not measured |
| Camera shake (wall tracker) | 6.27 -> 5.34 px RMS, p95 11.86 -> 10.71 px (5.9% steady crop), stabilised | 10.99 -> 9.18 px RMS, p95 20.10 -> 17.15 px (12.2% crop), stabilised |
| Contact sheets | `review/short-whole.jpg` (every 2.5 s), first and last 10 s at 0.25 s, screens at 0.5 s | `review/long-whole.jpg` (every 3 s), first and last 10 s |

**The words gate reads FAIL on both cuts, and no word is lost.** The gate hears the whole finished file again and
compares it with the take. Its two hearings disagree with each other and with the take: large-v3-turbo missed
"connect their work email to a personal Claude plan" at 4:08 in the 5-minute cut and heard ".au" for ".ai" in the
90-second; medium.en missed different words ("Now," twice in the 90-second; "Duet" heard as "Dewitt"). Heard on its
own, every flagged stretch of the finished files has the words ("people will want to connect their work email to a
personal claw plan", "Now every few hours", "Now there's no setup quiz", "makeyourmindup .ai"), and the one "Now," the
5-minute take's transcript holds at 1:04.3 is not in the take itself when heard alone ("from your Claude account. I've
lived my life"). Only Krish can let a mishearing pass (`heard_as` rows need his words), so the receipts say FAIL.

**Shake** stays high after stabilising: the takes are hand-held selfies and the tracker removes jitter, not the slow
sway. Look for it on playback; a stronger crop would cost framing.

## Listen for

- Captions only, never the sound: "Duet" everywhere (the transcriber once heard "DeWitt"), "Claire Vo" (heard
  "Claire Vaux"), "a long think like me" (heard "thing").
- 5-minute: the true peak was trimmed by 0.3 dB on the audio track only (picture copied untouched), if LONG_TRIM.

## Status, reported separately

- **Fact**: every number, quote and page on screen is from the checked research (`research-wed.md`,
  `research-wed-community.md`) or his own recording; the Reddit lines are the user's own words, drawn, no username.
- **Transport**: both masters encode cleanly, loudness inside target, share copies under 29 MiB; lip sync unmeasured
  here; words gate FAIL as explained above.
- **Editorial**: REVIEWER_LINE
- **Krish's full playback**: still his. Nothing is filed until he has watched both cuts (`FILE.md`).
