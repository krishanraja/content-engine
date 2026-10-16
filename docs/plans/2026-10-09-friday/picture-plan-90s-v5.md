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

| # | On these words | Time | Picture above him |
|---|---|---|---|
| 1 | "The name is the badge." | 0:20 | the car: badge = the name, gearstick = how hard it thinks |
| 2 | "In a hard test," | 0:38 | the race (drawn, `video-pictures/fri-90-race-1.png`) |
| 3 | "It picks the gear." | 0:59 | the automatic selector, its gear hidden |

Three is enough to make each one count; more reads as a tic. Each lands as
its picture arrives, so the eye follows the finger up.

## Beat by beat

Times at 150 words a minute from his first word.

- **0:00 "I've been keeping a beady eye..."** FACE, full frame, under the
  opening logo and the strap.
- **0:08 "Each AI gets a new name."** Picture: the names stacking up, each
  card landing on the last: "Opus 4.8", "Opus 5", "Opus 5.5", then "Opus
  5.56?" with its question mark (the joke from the deep cut). Back to FACE
  for "Does the name you pick change the answer you get?"
- **0:20 "The name is the badge."** POINT UP. Picture, drawn: a plain car
  front, its badge ringed and labelled "THE NAME"; on "How hard it thinks is
  the gear." a gearstick beside it labelled "HOW HARD IT THINKS". No real car
  or car logo: those are for the long video only (Krish, 16 October: "only in
  the long video though").
- **0:24 "Today, it's a manual car. You change gear."** Same picture, page
  two: the H-pattern gearstick with a hand on it, "YOU CHANGE GEAR".
- **0:28 "Picture Sally."** FACE: a story told to camera.
- **0:32 "misses a costly hidden rule."** Picture: the deal, one line of
  small print ringed in amber, and the gear readout "1ST". FACE again for
  "Sally never changed gear."
- **0:38 "In a hard test,"** POINT UP. The race, page one
  (`fri-90-race-1.png`): "ONE HARD TEST", credited "Test by Artificial
  Analysis"; the newest Claude AI in LOW GEAR and the older Claude AI in TOP
  GEAR on the start line; "WHICH ONE WINS?"
- **0:42 "lost to the older one in top gear."** The race, page two
  (`fri-90-race-2.png`), cut on "lost": the older car over the line with
  speed lines and "WINS"; the newest car behind it, drawn where its score
  puts it (0.82 of the way: Artificial Analysis, 42 against 51, never shown);
  "THE GEAR BEAT THE NEW BADGE".
- **0:46 "Why do apps start you in low gear?"** FACE, through "but you pay
  the same": his guess lands best on his face.
- **0:54 "My bet:"** Picture: the automatic selector P R N D with "AUTO" lit
  and "JUNE 2027" above it.
- **0:59 "It picks the gear."** POINT UP. Same picture: the gear readout
  turns to "?" on "You won't see which."
- **1:02 "I'm 85% sure."** The house call meter at 85%.
- **1:08 "Sources are in the free article..."** FACE to the end card.

## The race picture

`video-pictures/fri-90-race.html` draws both pages (`?p=1`, `?p=2`) at the
picture box size, 968 x 773; render it with the house fonts beside it as
`fonts.css` (`scripts/pages/brand.py`, `font_css()`), at device scale 2. The
PNGs in the folder are those renders. Every number it implies comes from the
filed Artificial Analysis pages; it prints none. The deep cut's B30 to B30b
can use the same drawing laid out wide.
