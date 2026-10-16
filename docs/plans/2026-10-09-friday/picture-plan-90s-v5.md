# Friday 90-second cut v5: the picture plan (vertical only)

Piece `904658db-4df2-4537-a0ed-ebe93e081db7`, mind.the.gap. Script:
`docs/plans/2026-10-09-script-90s-v5.md` (187 words, about 85 seconds
finished). The script stays words only; this file is what goes on screen.

Krish, 16 October, after the "42" fix: "The visual is going to need to be a
lot sharper. The point is simplified, which is fine. Just make sure it is
clearer and then let me know about the 90-second script. Now this is pretty
much only going to be used for vertical video. Let me know if you need me to
point up at any point. To get the user's attention I can point upwards at the
visual but it is up to you. This actually is a good idea."

Then, of a drawn race between two cars: "No that's car visual is not clear.
The gear beat the new badge. I don't think the visuals should have analogies
in them. The visuals should look like genuine reviews of the actual product,
with statistics, rather than having analogies. The analogies should only be
in my casual narrative explanation style." (house rule
ANALOGY_IN_SCRIPTS_ONLY; the visual gate refuses a picture that does not say
what real thing it shows.)

So the words keep the car (it is his spoken style), and every picture shows
the real thing: the apps' own screens and real statistics from a named
source. No car, race, gearbox or badge is drawn anywhere.

## The frame

The tall cut (1080 x 1920) puts each picture in the top 1000 pixels and
Krish's face band (1080 x 920) under it (`scripts/quick-edit/make.py`,
`video_graph`). So when a picture is up, he is directly below it, and
pointing up points at it. The picture box inside the panel is 968 x 773
(`kit.panel_box('9x16')`); every word drawn in it is 40 pixels or more, over
the 39 a phone needs (`kit.FLOOR_PX`).

The face band keeps about one head-height above his face when he records on
his phone (`face_band`). So a point-up is a hand at forehead height, index
finger up, close beside his face, held for about a second. A fully raised arm
leaves the band and is cut off.

## Point up three times, no more

| # | On these words | Time | The real thing above him |
|---|---|---|---|
| 1 | "The name is the badge." | 0:20 | the Claude app's own model menu: the model's name, and its effort setting |
| 2 | "In a hard test," | 0:38 | the score chart (`video-pictures/fri-90-claude-scores.html`) |
| 3 | "It picks the gear." | 0:59 | Google's Gemini help page on its Auto setting |

## Beat by beat

Times at 150 words a minute from his first word. "shows" is what each
picture declares in `post.json` for the visual gate.

- **0:00 "I've been keeping a beady eye..."** FACE, full frame, under the
  opening logo and the strap.
- **0:08 "Each AI gets a new name."** shows: evidence. Anthropic's own launch
  pages for Claude Opus 4.8 (May), Opus 5 (July) and Opus 5.5 (September),
  each screenshot dated, landing one on the last. Back to FACE for "Does the
  name you pick change the answer you get?"
- **0:20 "The name is the badge."** POINT UP. shows: screenshot. Krish's own
  capture of the Claude app's model menu, as it is, with two plain labels
  pointing at the real controls: "Model" at the name, "Effort" at the
  setting that decides how hard it thinks.
- **0:24 "Today, it's a manual car. You change gear."** shows: screenshot.
  His capture of ChatGPT's own thinking setting open (Instant to Extra High),
  labelled "You pick it".
- **0:28 "Picture Sally."** FACE through "Sally never changed gear.": Sally
  is a made-up example, so nothing on screen pretends she is real.
- **0:38 "In a hard test,"** POINT UP. shows: chart. "Newest vs older
  Claude", Artificial Analysis Intelligence Index (10 hard tests, higher is
  better), axis from 0 to 60: Opus 5.5 (newest) at low effort, 42; Opus 5
  (older) at max effort, 51. data_source: "Artificial Analysis, 16 Oct 2026"
  (read from its API that day: 42.3 and 50.8, shown whole as its model pages
  say them). The chart stays up through "lost to the older one in top gear."
- **0:46 "Why do apps start you in low gear?"** FACE through "but you pay the
  same": his guess lands best on his face.
- **0:54 "My bet:"** shows: screenshot. Google's Gemini help page, the line
  "Auto will be the default setting for users without a Google AI plan."
  (support.google.com/gemini/answer/17004136), with its date.
- **0:59 "It picks the gear."** POINT UP. The same page, the Auto setting
  ringed.
- **1:02 "I'm 85% sure."** shows: chart. The house call meter at 85%,
  data_source "our call, 16 Oct 2026", measures "how sure we are".
- **1:08 "Sources are in the free article..."** FACE to the end card.

## The score chart

`video-pictures/fri-90-claude-scores.html` draws it at the picture box size,
968 x 773; render it with the house fonts beside it as `fonts.css`
(`scripts/pages/brand.py`, `font_css()`), at device scale 2. Its post.json
entry: `"shows": "chart"`, `"data_source": "Artificial Analysis, 16 Oct
2026"`, `"measures": "Artificial Analysis Intelligence Index: 10 hard tests,
0 to 100, higher is better"`.
