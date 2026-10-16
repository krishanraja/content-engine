# Friday 90-second cut v6: the picture plan (vertical only)

Piece `904658db-4df2-4537-a0ed-ebe93e081db7`, mind.the.gap. Script:
`docs/plans/2026-10-09-script-90s-v6.md`, Krish's own edit of 16 October, 21:32 UTC
(274 words, about 1:50 at 150 a minute). It replaces v5 (`picture-plan-90s-v5.md`).
The script stays words only; this file is what goes on screen.

Krish, 16 October, after the edit: "just put them in teleprompter, and then if I go
over 90sec, just speed the video up a bit in post". So the cut is sped up to land at
90 seconds: a take read at 150 a minute needs about 1.2x (110 s to 91 s). Speed the
picture and the voice together with the pitch held, and set every cut point below
on the sped-up timeline.

His rule for pictures still holds (house rule ANALOGY_IN_SCRIPTS_ONLY, 16 October:
"The visuals should look like genuine reviews of the actual product, with
statistics, rather than having analogies"). The words now say "Opus 5.5, Mercedes C
Class" and "the gear - 1st, 2nd, 3rd": no Mercedes, car, badge or gearstick is drawn.
The screen shows the real Claude menu and its real effort levels while he says it.

## The frame

As in v5: the tall cut (1080 x 1920) puts each picture in the top 1000 pixels and his
face band (1080 x 920) under it, so pointing up points at it. Picture box 968 x 773,
every drawn word 40 pixels or more. A point-up is a hand at forehead height, index
finger up, close beside his face, for about a second; a fully raised arm leaves the band.

## Point up three times, no more

Times are at 150 a minute before the speed-up; divide by about 1.2 after it.

| # | On these words | Time | The real thing above him |
|---|---|---|---|
| 1 | "The name of the model is like the badge." | 0:25 | the Claude app's own model menu: the model's name, and its effort setting |
| 2 | "In a tough reasoning test," | 0:57 | the score chart (`video-pictures/fri-90-claude-scores.html`) |
| 3 | "ChatGPT will pick the gear" | 1:24 | Google's Gemini help page on its Auto setting, Auto ringed |

## Beat by beat

"shows" is what each picture declares in `post.json` for the visual gate.

- **0:00 "Something weird is happening with ChatGPT and Claude."** FACE, full frame,
  under the opening logo. This is now the hook: there is no series line before it.
- **0:03 "I use AI apps daily ... a new model release EVERY DAY."** shows: evidence.
  Anthropic's own launch pages for Claude Opus 4.8 (May), Opus 5 (July) and Opus 5.5
  (September), each screenshot dated, landing one on the last on "EVERY DAY".
- **0:13 "So I investigated ..."** FACE.
- **0:25 "The name of the model is like the badge."** POINT UP. shows: screenshot.
  His capture of the Claude app's model menu, labelled "Model" at the name and "Effort"
  at the setting. It stays up through "Opus 5.5, Mercedes C Class."
- **0:31 "How hard it thinks is the gear - 1st, 2nd, 3rd."** shows: screenshot. The
  same menu with the effort list open, its real levels in order, one lit per ordinal.
- **0:35 "And right now, AI tools are like a manual car."** shows: screenshot. His
  capture of ChatGPT's own thinking setting open, labelled "You pick it".
- **0:39 "It feels like ChatGPT and Claude want you to think about the badge ..."**
  FACE: his read, on his face.
- **0:46 "Picture Sally."** FACE through "Sally never changed gear.": Sally is made up.
- **0:57 "In a tough reasoning test,"** POINT UP. shows: chart, as in v5 ("Newest vs
  older Claude Opus", Artificial Analysis, 16 Oct 2026). It stays up through "lost to
  the older one in top gear."
- **1:06 "So why do these tools start you in 1st gear?"** FACE through "but you pay the same".
- **1:14 "My bet:"** shows: screenshot. Google's Gemini help page, the line "Auto will
  be the default setting for users without a Google AI plan."
  (support.google.com/gemini/answer/17004136), with its date.
- **1:24 "ChatGPT will pick the gear"** POINT UP. The same page, Auto ringed.
- **1:32 "I'm 85% sure."** shows: chart. The house call meter at 85%, data_source "our
  call, 16 Oct 2026", measures "how sure we are".
- **1:39 "Sources are in the free article ..."** FACE to the end card, on his question:
  "do you prefer to control how your AI thinks, or are you going to outsource it?"

## The score chart

Unchanged from v5: `video-pictures/fri-90-claude-scores.html`, 968 x 773, house fonts
beside it as `fonts.css`, device scale 2. Its post.json entry: `"shows": "chart"`,
`"data_source": "Artificial Analysis, 16 Oct 2026"`, `"measures": "Artificial Analysis
Intelligence Index: 10 hard tests, 0 to 100, higher is better"`.
