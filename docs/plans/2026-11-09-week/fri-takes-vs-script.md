# Fri 13 Nov takes against the script, and the held send (7 Nov 2026)

Piece f3fcd5e1-573e-4692-a413-db7c5823a10e, "Counting rat tails" (mind.the.gap).
Scripts: `docs/plans/2026-11-13-draft-script.md` (5-minute) and `-90s.md` (90-second); checks in `fri-scripts-check.md`.

## The held send, closed honestly

- 4 Nov 06:29: Krish pressed Approve scripts for Friday. The server held it: "the 5-minute script has not been read
  back by two fresh readers, so nothing was sent". That approvals document (`fri-scripts`, revision 2) still reads
  `status: held`; it is his press and is not rewritten by a session.
- 4 Nov 06:45: a session recorded both cuts' read-back as **approved by Krish**, on his words "Send Friday to
  teleprompter", and sent both scripts at 06:46. The making record shows both cuts in Teleprompter holding the
  current words (script hashes 7e2c3d6d... long, 85829f64... short, the same hashes his press bound).
- What that means: no reader read-back ever passed. Three rounds of readers A, B and C each found smaller things
  (`fri-scripts-check.md`); the sign-off on record is his, not the readers'. The scripts' words have not changed since.
- 5 Nov: he recorded both cuts from those words. Both takes are now on the making record (7 Nov):
  long `recordings/561fbde2...dd81.mp4` (405 s), short `recordings/7e0383ed...05e7.mp4` (109 s). Recorded: done.

## What he said against what the script says

Heard with two local models (faster-whisper small.en for the whole take, medium.en again on the doubtful passages);
times are on the take's own clock. A forced-alignment pass (`ve ingest`) still runs before any cut.

### 90-second take (1:49)
| Take time | Script | He said | Action |
|---|---|---|---|
| 0:15 | "Big companies made the same mistake with AI." | "...are doing the same kind of thing with AI. What I'm trying to say is people do what they're incentivized to do." | Keep: his own line, and true to the lock. |
| 0:34 | "...with silly titles for the top users." | "...to make it gamified and playful. Great." | Keep. |
| 1:14 | "...and sales went up." | "...and sales went up **and AI costs obviously halved**." | **Cut "and AI costs obviously halved".** The study says query volume fell 30%, not that costs halved; nothing holds it. |
| 1:33 | "I'd delete any target for AI use." | "I would **delegate** any target for AI use" (both models hear "delegate") | **For his ear.** As heard it says the opposite of his action. Options below. |
| 1:30 | "...you're counting rat tails." | "...you're basically counting rat tails in Hanoi." | Keep. |

The "delegate" line, best guess first: (1) he records one pickup line on his phone, "If I ran a team, I'd delete any
target for AI use", about 4 seconds, cut in over the B-roll; (2) cut to "If I ran a team, I would... check if the AI
moves a number I already track, like sales", which loses the delete action; (3) keep it if he hears "delete".

### 5-minute take (6:45)
| Take time | Script | He said | Action |
|---|---|---|---|
| 0:41 | "Now, that's a funny old story." | "Now that's a funny story, **it's an exaggerated story**." | **Cut "it's an exaggerated story".** The piece later says the Hanoi rats "are in the records" (Vann 2003); calling it exaggerated contradicts the twist. |
| 1:28 | "Shopify's boss told his people to reach for AI first, as a habit." | adds "almost threatened people that if they didn't use AI first they would be marked down in terms of performance reviews" | Fact gate: the Shopify memo adds AI questions to performance and peer reviews; "almost threatened" is his opinion. Keep if the memo line is shown on screen. |
| 2:49 | "agents, which keep working on a task by themselves" | "...by themselves overnight. You just set it to run overnight." | Keep as illustration; no source says overnight. |
| 3:36 | "AI counts" | "the AI accounts" | For his ear (mis-said); cut "the" if it reads as "accounts". |
| 3:51 | "And this autumn Amazon told..." | false start, then the line again | Cut the first attempt. |
| 4:03 | "Here's the bit I like most." | said twice | Keep the second. |
| 4:52 to 5:09 | the cobra opening | a false start ("The British paid for dead cobras so people...") then the line again | Cut the first attempt. |
| 5:13 | "The British paid for dead cobras, so people bred cobras." | "the British would pay Indians for dead cobras. So Indians bred cobras." | Keep; same claim. |
| 6:16 | "If you're counting how much AI your people use, you're counting rat tails." | "...you're essentially like the Vietnamese rat tail counters." | **His close line changed.** The locked close is not said as written in the long take. Options in the sheet (section A). |
| 6:25 | "I'd delete any target for AI use." | "I would delete any target for just broad AI usage." | Keep: "delete" is heard clearly here. |

Nothing here changes the script files: they stay the words he approved. These are edit decisions for the cut, put to
him on the pre-production sheet (`docs/plans/2026-11-09-week/fri-preproduction/`).

## The pickup (9 Nov 2026)

Krish, 9 Nov: "You just use this audio with the existing video." and "just normalize it". His phone pickup
`Voice_261109_103424.m4a` (sha256 fe6c8978...401e, 4.46 s, 48 kHz mono AAC) says "If I ran a team, I'd ditch any
target for AI usage." ("ditch" is his choice of word over "delete"). It replaces the 90-second take's 91.78 to 95.40 s
("If I ran a team, I would delegate any target for AI use"); the take resumes at 95.40 s on "and I check if the AI
moves a number I already track, like sales."

Normalized to the take's own voice level around that line (take 80 to 100 s: -24.1 LUFS integrated, -5.2 dBTP):
two-pass `loudnorm=I=-24.1:TP=-5.2:LRA=7` with the measured values and `linear=true`, resampled to 48 kHz stereo,
then +0.8 dB; result -24.1 LUFS, -7.4 dBTP. The pickup trims to 0.00 to 4.05 s with an 80 ms fade out, joined with
15 ms crossfades. The picture cuts away from his face for the length of the pickup (his lips would not match).
Heard back with faster-whisper: the join reads as one sentence. The original upload had two samples at -0.05 dBFS,
no sustained clipping. He keeps the original file; the session sent him the normalized WAV and a 15 s preview.
