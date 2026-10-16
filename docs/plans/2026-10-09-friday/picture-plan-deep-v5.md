# Friday deep cut v5: the picture plan

> **Being redone, 16 October, evening.** Krish, of a drawn car race made for
> the 90-second cut: "I don't think the visuals should have analogies in them.
> The visuals should look like genuine reviews of the actual product, with
> statistics, rather than having analogies. The analogies should only be in my
> casual narrative explanation style." That replaces his earlier asks for car
> logos and car pictures in this video. Every beat below that draws a car, a
> badge, a gearbox, a race, a rev counter or a fuel gauge (the car key B23 to
> B29a, B30 to B30b, B33 to B33b, the X-ray car, the F1 wheel, treatments B and
> C) changes to the real thing: the apps' own screens and charts of real
> statistics from a named source (house rule ANALOGY_IN_SCRIPTS_ONLY; the
> visual gate's REAL THINGS check). The spoken words keep the car. Build
> nothing from this file until it is redone.

Piece `904658db-4df2-4537-a0ed-ebe93e081db7`, mind.the.gap, Friday. Script:
`docs/plans/2026-10-09-script-deep-v5.md` (1,689 words, about 11 minutes 16
at Krish's pace), chapters in `-script-deep-v5.chapters.md`. The script stays
words only; everything that goes on screen is here. Krish's direction, word
for word, is in `post-production-notes.md` beside this file. On 16 October he
added: "The imagery that goes with the longer read out is going to have to be
10X better than any previous post production ... Make sure the script is
designed such that the imagery dovetails with it perfectly in post production
for really powerful clear points landed." Then, of the car: "leave nothing to
a users assumption or expertise - but we should be clear what we are equating
the business name, LLM name, model name and thinking levels to here", and
"make sure the post production has the pics of car logos and cars in the
videos etc, to really bring clarity to life". He then rewrote the car
paragraph himself (¶15): the AI model's name is the badge on the front of a
car, the thinking setting is the gears, and today's apps are a manual car.
This plan puts each pairing on screen as he says it, then follows the rest of
his paragraph line by line (B23 to B29a, and "What stands for what" below).

Later on 16 October, of the cost lines (¶19): "and visualize this problem
really well in post". The problem: a higher gear costs far more, but the AI
gets only a little smarter. It now has its own strongest moment (B33 to B33b,
the fuel gauge against the speedometer). And of the pictures: "we need to
avoid licensing risks but be clear". So no press-site photographs without
written permission on file; every car photograph cleared for a monetised
video, with its source and licence recorded, or else drawn with the car named
in text; logos only as their official files, only to say whose they are; and a
no-affiliation line in the description (all under "Sourcing" below).

Last on 16 October, of the test scores in the 90-second script: "What does 42
even mean? that is not understandable. We need to simplify this". Both
scripts now say the test results as plain comparisons, and so does the
screen: no test score appears anywhere in this plan. The rev needle at B30
is placed by the true scores and shows none, and a race on a drawn road (B30
to B30b) says who beat whom.

**Car logos and car photographs are for the long video only.** Krish, 16
October: "only in the long video though". The BMW and Audi logos, the
pictures of the BMW X3 and the Audi Q5 (cleared photographs, or drawings that
name them) and the Q5's front badge in this plan go into the long video and
nowhere else. The 90-second video keeps its own pictures and carries no car
logos or car photographs; this plan does not set its pictures. The three rows
this plan lets the 90-second cut reuse (B30, B56 and B65, see the last list)
carry neither.

Status: a plan, not yet built. Three treatments (A, B and C below) wait on
Krish's pick; his notes say to propose them and build only the ones he picks.
Every row works without them, and says what it falls back to.

## How to read this

- One row per beat, in script order, written as a block. Every one of the
  script's 37 paragraphs (marked ¶) has at least one row. Each row starts on
  the quoted words exactly as the script has them, so an editor can search
  the transcript for them. A row's picture runs until the next row's start
  words unless the row says otherwise. If Krish changes words on the take,
  the transcript wins and the row moves with it.
- The car sequence was re-cut for Krish's own car paragraph, which is now
  one paragraph (¶15): B23 to B29a follow it sentence by sentence, with new
  ids, and the rows for words he cut (the carmakers, "the cars they make",
  the badge on the back, first gear crawling and top speed) are gone. Every
  paragraph after it moved up one. Nothing was built on the old rows. B34 is
  gone too: its line ("Who pays for that thinking...") was cut from the
  script, and its rest for Krish's face moves into B36. The final script's
  new lines got lettered rows: B30a (Haiku in top gear passing Opus 5.5
  stuck in first), B30b (changing gear beat a new badge) and B33a and B33b (the cost problem: the fuel gauge
  against the speedometer).
- Times are estimates at about 150 words a minute from Krish's first word
  (after the sting and the story intro).
- Picture ids (`fri-...`) are the ids to cue in `long.json` for kit.py (`id`,
  `panel`, and the words he says over it as `start` and `end`).
- Screen codes:
  - **FACE ALONE (rest)**: Krish only, nothing over him but captions. A long
    video needs these; they are planned, not gaps.
  - **FACE**: Krish, with the dash in the corner if treatment B is picked.
  - **PUNCH**: a hard step in to about 1.1x inside the take on that line,
    back out on the next line (the long-cut punch-in from `style-trial.md`).
  - **SPLIT**: Krish in the left third, the picture in the right two thirds.
  - **FULL**: the picture fills the frame, his voice over it.
  - **CARD**: a full-screen house card.
- Source codes:
  - **PHOTO**: a cleared real photograph (search terms given). Cleared means
    its licence clearly allows commercial use in a monetised video: public
    domain or CC0, or the free Pexels or Unsplash licence. Its source and
    licence are recorded (see "Sourcing"). Never a press-site photograph
    unless written permission is on file.
  - **FOOTAGE**: cleared real video, on the same terms, never generated
    (only the optional paddle clip at B63).
  - **SHOT**: a screenshot of the named public page, captured live, with its
    URL and capture date recorded the way `pileup` records its pages in
    `post.json`.
  - **CAPTURE**: Krish's own app, screen-recorded fresh on his own account.
  - **DRAWN**: house style, built in the renderer (`apps/renderer`, Remotion)
    or, for flat cards, `scripts/pages/video_card.py`. Where no cleared
    photograph of a car exists, the car is DRAWN and its make and model are
    set in text beside it ("BMW X3"); a drawn car never carries a logo.
  - **LOGO**: the official logo files in `logos/` (OpenAI, Anthropic, Google;
    for the long video also BMW and Audi, and the ChatGPT and Claude app
    marks), fetched by the house Brandfetch route, never altered, recoloured
    or combined with another mark, and used only to say whose thing is on
    screen.
- `[A]`, `[B]`, `[C]` mark a move that belongs to that treatment.

## The rules this plan keeps

1. **One point per picture.** Each row names its one point. Before building,
   check that a viewer who sees only the picture gets that point (house rule
   VISUAL_EXPLAINS). The gearboxes are Krish's chosen running image; each one
   on screen carries a gear the script names, so none is decoration.
2. **Facts on screen, opinions on the face.** When Krish says "I think", "my
   guess", "my own opinion" or "my bet", the screen is his face. Viewers can
   see which parts are evidence and which are his view.
3. **The screen says what he says, shorter.** On-screen words are the
   script's own words or fewer of them, six words at most, so the eye and the
   ear never have to reconcile two sentences. The one exception is the car's
   word for the script's thing, and only where a pairing label on screen
   says what it stands for: at B33 to B33b, "Fuel = the cost" and "Speed =
   the score" sit under the dials, so "About 11x the fuel" and "Only about a
   third faster" say his "eleven times as much" and "about a third".
4. **Every number drawn on screen is one the script says** (the list is near
   the end). No axis numbers, tick labels, totals or differences the script
   does not say: the rev counter's dial has no numbers on it, and its needle shows a
   value only where the script says one (the 85% at B68), and the fuel gauge and speedometer at B33 to B33b carry none at
   all (the gauge has only its E and F). Screenshots are real pages and are never
   edited: crop each to the sentence that carries the point, and crop out
   figures the script does not say wherever the crop allows.
5. **Real or drawn, never faked.** Photographs are cleared real
   photographs (PHOTO above). Anything else is drawn flat in the house style,
   so nobody could take it for a photo. No AI-generated pictures in this cut,
   and no AI-generated cars or logos above all: every car is a cleared real
   photograph or cleared real footage, or a house-style drawing that names
   the car in text, and never a computer render passed off as a photograph.
   No press-site photograph (BMW Group PressClub, Audi MediaCenter) unless
   written permission is on file. No AI badge pasted onto a photo of a real
   car: the one drawn badge beside a real one (B24) sits beside it, flat and
   labelled as a drawing. No copy of a real app's screen: the one place we
   show what Krish is asking for (B65) is a house-drawn mock labelled as one.
   Sally is made up, and the script says so ("Picture a woman called Sally"),
   so she is always drawn, never a photo or a stock model.
6. **The house look.** Ink background, cream words, the mind.the.gap coral
   (`#FF6A4D`, from `config/studio.json`) for the subject, mint only for the
   answer (the advice in chapter 7 and the call). Anton for headlines,
   Archivo for words, IBM Plex Mono for labels, sources and the dash. No card
   kicker uses "money" or "hood" (video_card.py refuses another series'
   words in a kicker), and every video_card.py card carries a real logo.
7. **Real logos** (house rule VISUAL_EVIDENCE): OpenAI, Anthropic and Google
   wherever a row names them, declared on the packed video for the visual
   gate. In the long video only, BMW and Audi where the script names them
   (B28), and the ChatGPT and Claude app marks beside the manual car
   (B26). Official files only, by the house Brandfetch route. A logo is never
   redrawn, altered, recoloured or combined with another mark, and is used
   only to say whose thing is on screen: where two logos share a frame
   (BMW and Audi at B28) they stand apart, each whole with its own clear
   space. No car logo on a drawn car, the thumbnail or the cover.
8. **Readable.** Nothing under the kit's 21 px floor in the wide cut; headline
   words 90 px tall or more. Ticks, crosses and arrows are drawn marks, not
   font characters: the house faces may not carry them, and a render that
   falls back to another face fails the house checks. Keep every picture's words clear of the caption
   band (small, low middle) and of Krish's face.
9. **Pace for a long piece.** No picture run longer than about 40 seconds
   without a return to his face; no face hold longer than about 30 seconds
   without a punch in. About half the runtime carries a picture (full or
   split); the rest is Krish.
10. **Nothing left to assumption.** Krish, 16 October: "leave nothing to a
   users assumption or expertise". Wherever the car stands in for the AI,
   the screen shows both sides at once, the AI thing and the car thing, and
   names the pairing in six words or fewer ("Model name = the badge"). Each
   complete pairing stays readable for at least 2.5 seconds before it moves
   on.

## Three treatments for Krish to pick

His notes ask for two or three treatments proposed before building. These are
the three. My suggestion is all three, and B first if only one.

**A. Gear-change cuts on the beat.** On marked lines the cut lands exactly on
the stressed word, with a short gear-change sound (an upshift clack; a softer
blip on the two downshifts), a two-frame push (scale 1.00 to 1.04 and back)
and one frame of motion blur. Fifteen marked rows plus the chapter cards, spaced
out, with two deliberate bursts (the badge parade in B03 and B04, and the advice
list in B60), so it stays punctuation. It ties the edit itself to
the gears, and it trains the ear for B56, the one gear change with no sound.
Without A: plain hard cuts, and B56 falls back to a held frame. Needs a
sound effect whose licence clearly allows a monetised video, logged with the
music; the music ledger
(`config/music-library.json`) holds no effects yet. No sound ripped from F1
broadcasts.

**B. The dash: which gear it picked.** A small readout in the top right
corner, like the display on a racing steering wheel: on the left a badge chip
with the model's name (Archivo, muted, small); on the right the gear as a
big word in IBM Plex Mono Bold, coral (mint in chapter 7 and for the call).
States: `1st`, `LOW`, `MID`, `HIGH`, `TOP`, `AUTO`, `EXTENDED`, `?`. About
380 by 150 px, 64 px in from the top and right edges, on ink_soft
(`#16221D`) with a cream line. It first appears at B25 ("The thinking
setting is like the gears of the car.") and after that shows only when an example on screen ran in a
gear the script or its source names (the gear log below). It pays off at B65:
when Krish says "show us which gear it picked, under every answer", viewers
have watched the video do exactly that for six minutes, so the ask lands as
something they already want. Without B: the gear shows only inside the full
pictures, and B65 introduces the readout fresh.

**C. The rev needle.** A drawn rev counter, an arc with no numbers printed on
it. At B30 its needle sweeps from the low-gear result to the top-gear one,
placed by the true scores but showing none (Krish, 16 October: "What does 42
even mean?"); at B68 it carries the call's 85%, a number the script says. As a transition, a needle sweep wipes each chapter card
in. A number you watch move is a number you remember. Without C: a
pair of unlabelled bars at B30 (low gear short, top gear long, drawn to the
true ratio), the house call
meter at B68, and hard cuts into the chapter cards. The fuel gauge and
speedometer at B33 to B33b are not part of C: they are built in every
version, because they are Krish's ask.

## The running visual system

### 1. What stands for what: the car key (long video only)

Krish wrote the car paragraph himself (¶15). It pairs three things, one a
sentence, and the screen does the same, one pairing at a time, in the order
he says them:

| Row | He says | The AI side | The car side | On screen |
|---|---|---|---|---|
| B24 | "The name of the AI model is like the badge on the front of a car." | a drawn "Opus 5.5" badge, labelled as a drawing | the badge on the front of an Audi Q5 (a cleared photograph, or a plain drawn car front) | "Model name = the badge" |
| B25 | "The thinking setting is like the gears of the car." | Krish's own effort menu (the B08 capture) | a gearstick (a cleared photograph, or drawn) | "Thinking = the gear" |
| B26 | "Right now, these apps are like a manual car, where you change gear yourself." | the ChatGPT and Claude app marks | an H-pattern gearstick and a clutch pedal (cleared photographs, or drawn) | "Today's apps = a manual car" |

The rest of the paragraph then uses the key: low gear and high gear (B27),
the novice's X3 against the Q5, which lights the badge row (B28), the pro's
gearbox beneath, which lights the gear row (B29), and most of us in first
gear (B29a).

- **One side each, always.** The AI side above, the car side below, an "="
  between.
- **The key.** At B23 an empty key slides in: three rows, each an "=" with a
  space either side, headed "AI" and "Car". From B24 the key sits as a narrow
  strip down the left edge of the frame. Each pairing grows out of its row
  to fill the frame for its line, then shrinks back into its row, so the
  strip fills one row at a time. By "a manual car" all three rows sit on
  screen together, and they stay there through B29.
- **Long enough to read.** In each pairing the AI side lands on the AI words
  and the car side on the car words ("the badge on the front of a car", "the
  gears of the car", "a manual car"). The complete pairing then holds full
  frame for at least 2.5 seconds before the next one starts. Where Krish's
  take runs faster, the next pairing waits for it, up to one second behind
  his words, never ahead of them. After that, each pairing stays readable in
  the strip.
- **It comes back once**, full frame for 2 seconds, at B45 ("Think what each
  part of the car is worth"), with the badge and gear rows lit, so "the
  badge" and "the gear" mean what they meant at ¶15 before the X-ray car
  uses them.

Then the transmissions, each on the line that names it, as a cleared
photograph or, where none clears, a drawing:

| Row | He says | On screen |
|---|---|---|
| B26 | "like a manual car" | an H-pattern gearstick and a clutch pedal |
| B40 | "like a car with an automatic transmission" | a P R N D selector |
| B63 | "called a semi-automatic" | an F1 steering wheel with its paddles |
| B66 | "a car with a manual transmission" and "still choose a manual transmission" | the manual again, then all three side by side |

### 2. Three transmissions, three acts

The film moves through three gearboxes, each named by the script. They are
generic car parts, so they need no brand: each is a cleared photograph
showing no maker's, team's or sponsor's mark, or else drawn in the house
style:

- **The manual transmission (an H-pattern stick and a clutch pedal)**: today.
  The gearstick first stands beside the real settings menu at B25 ("the
  gears of the car"); the script names the manual car at B26; it runs to
  B39.
- **The automatic transmission (a P R N D selector)**: what's coming. From
  B40, where it pushes the manual stick off the frame ("The next step is the
  AI choosing the gear for you"), and named on "like a car with an automatic
  transmission".
- **The semi-automatic (the F1 steering wheel with paddles)**: the better
  way. From B63 ("called a semi-automatic").

B66 puts all three side by side as the close lands. A gearbox cutaway is the
"beneath" picture (B29), and the X-ray car (B45 to B48) is its drawn cousin.
Pick gearstick, clutch, selector and cutaway photographs that show no
carmaker's logo, and an F1 wheel with no team, sponsor or F1 mark readable
(if none clears, draw the wheel): the only carmakers on screen are BMW and
Audi, at the rows where the script names them, so no other maker gets paired
with an AI by accident (the selector at the Gemini line above all).

### 3. The dash

See treatment B. The rule that keeps it honest: it never shows a gear the
script or its filed source does not name.

**The gear log** (every state the dash shows):

| Row | Badge chip | Gear shown | What says so |
|---|---|---|---|
| B27 | none | LOW, then HIGH | "In a low gear, it barely thinks. In a high gear, it thinks hardest." |
| B29a | none | 1st | "most of us drive everywhere in first gear all the time, the lowest one" |
| B30 | Opus 5.5 on the dial; then Opus 5 and Opus 5.5 (a tag on each drawn car) | LOW, then TOP; then TOP beside 1st | "In its top gear, it did much better than in its lowest"; "The older Opus 5, in its top gear, beat the new one in its lowest" |
| B30a | Haiku; Opus 5.5 (a tag on each drawn car, not the corner) | TOP; 1st | "So did Anthropic's cheapest AI, Haiku" (top gear against Opus 5.5's lowest, as the line before it) |
| B30b | Opus 5, Haiku, Opus 5.5 (on the cars) | TOP, TOP, 1st | "So changing gear beat getting a new badge" |
| B32 | Sally's deal; 2 + 3 | 1st to HIGH; TOP | "matters most on hard jobs"; "extra thinking is wasted" |
| B33a, B33b | Opus 5.5 on both dials (the dials, not the corner) | LOW beside TOP | "thinks as hard as it can ... thinking a little" |
| B38 | none | LOW | "starts you in a low gear" |
| B39 | none | one gear, a needle moving inside it | "Right now, you do, if you change gear." |
| B40 | Gemini | AUTO | Google's Gemini help page |
| B41 to B43 | ChatGPT | AUTO, struck out twice | OpenAI release notes; WIRED |
| B47 | Opus 5.5 | TOP, then MID | Anthropic's footnote ("max effort"); Anthropic's effort docs (default medium) |
| B52 | ChatGPT | AUTO | Altman on X, 10 August 2025 |
| B53 | Claude Code | HIGH, then MID | Anthropic's engineering post |
| B54 | AUTO | Sally's deal HIGH, 2 + 3 LOW | "would at least think hard when it matters" |
| B56 | ChatGPT | EXTENDED, its bar dropping with no sound | OpenAI release notes |
| B57 | none | ? | "And can you see what it picked?" |
| B59 | none | LOW (mint) | "a low gear is fine" |
| B60 to B62 | none | HIGH (mint) | "change the gear yourself" |
| B65 | the labelled mock | HIGH | Krish's ask |
| B68 | ChatGPT, free | AUTO | the call |
| B70 | none | flips between YOU and AUTO | "do you pick the gear, or leave it?" |

### 4. The badges

- **AI names as car badges** (DRAWN): chrome-look lettering, drawn flat on
  the grille of a drawn car, seen head on (the script puts the badge "on the
  front of a car"), never photoreal. "Opus 4.8", "Opus 5", "Opus 5.5", the
  joke "Opus 5.56?" (with a coral "?" stamp so it can never read as real),
  "GPT 5.1" and "GPT 6.1". The drawn car carries no maker's logo.
- **The badge on the front** (cleared PHOTO or DRAWN, long video only): the
  badge on the Audi Q5's grille, below the drawn "Opus 5.5", never with the
  drawing on it (B24).
- **The novice compares cars** (cleared PHOTO or DRAWN, long video only):
  the BMW X3 and Audi Q5 fronts, each named in text, their badges ringed,
  with the official BMW and Audi logos small above them, while the key's
  "Model name = the badge" row lights, so the argument reads as one about
  names (B28).
- **The pro looks beneath** (cleared PHOTO or DRAWN): the cars slide apart
  to a gearbox cutaway (B29). On screen it is "looks beneath", never "under
  the hood" (another series' name).
- **Badges on one road** (DRAWN, B30 to B30b): a drawn car badged "Opus
  5", older, in top gear, passes a big drawn car badged "Opus 5.5" stuck in
  first; then a small car badged "Haiku" in top gear edges past it too. Neither car looks like a real model or carries a maker's logo.
- The badge chip on the dash keeps the idea running: the name small and
  grey, the gear big and bright. The layout itself says which matters more.

### 5. Sally, a short recurring sequence (DRAWN)

Always the same drawn set: her small shop, the counter, her laptop, the
supplier's deal. Flat house style, cream, coral and mint on ink, simple face,
no gradients. Each visit 4 to 10 seconds.

| Visit | Row | What happens |
|---|---|---|
| S1 | B17, B18 | The shop, the deal, she pastes it in, a timer counts "4 seconds", a tidy sure answer, she signs |
| S2 | B19 | "6 months later": a magnifier finds one small line glowing coral; the till drawer slides open, empty (no sum: the script gives none) |
| S3 | B20 | Her screen: the name gets a tick; the thinking control sits at its lowest notch and pulses |
| S4 | B32 | Her deal beside "2 + 3": the dash on her deal goes from 1st to HIGH |
| S5 | B54 | An automatic would put her deal in HIGH and "2 + 3" in LOW |
| S6 | B60 | "A deal you're signing": she flicks the gear up before she pastes. Never show the high gear catching the rule: the script does not claim it would |

### 6. Chapter cards (DRAWN)

Seven chapters from the chapters file. A card is 2 seconds: ink, a row of
seven round shift lights across the top third (like the lights on an F1
wheel), one more lit per chapter, and the chapter title in Anton, cream,
centred. No chapter numbers: the lights are the progress. Lit lights are
coral; on the last chapter all seven flash and turn mint (the answer
chapter). [C] a needle sweep wipes the card in; [A] the clack lands as the
new light comes on. Chapter 1 has no card: the sting and the story intro
open the video, and one light shows in a small strip on the first face shot
for 2 seconds.

| Card | Lights | Title | Lands before |
|---|---|---|---|
| 1 | 1 (strip only) | The name on the badge | "I've been keeping a beady eye" |
| 2 | 2 | Why the names keep coming | "First, the names. Anthropic makes" |
| 3 | 3 | The gear that matters | "So what does matter? Picture" |
| 4 | 4 | What thinking costs them | "All that hidden working runs" |
| 5 | 5 | Who decides next | "So who decides how hard" |
| 6 | 6 | The good and the bad | "Is that good? Some of" |
| 7 | 7, flashing mint | What to do about it | "So what should you do?" |

### 7. Sound

The music bed follows MUSIC_BED (up for the intro, low under Krish, up for
the outro). Two planned exceptions: the bed dips to near silence for the hold
at the end of B56 ("Nobody looking at their screen would have known."), and
lifts a touch after B67 ("For anything that matters, I'll be one of them.").
Gear sounds belong to treatment A.

### 8. The rest beats

Krish's face holds the screen alone at: B01 (his intro), B07 (the
concession), B13 ("my own opinion"), B16 (end of the launch story), B38
("That, I think, is why..."), B44 ("my guess why"), B51 ("Is that good?"),
B57 (the question about profit, about 22 seconds, the longest), B67 (the
close), and B70 (the sign-off). Shorter face moments sit inside B05, B10,
B21, B30, B31, B32, B43, B50, B55, B58, B62, B68 and B69, and he shares the frame
(SPLIT) at B23 and B36.

## Beat by beat

Order of the open: the makeyourmindup sting, then the story intro (the
stand-off design, `story_io.py`), then B01 on Krish's first word.

### Chapter 1. The name on the badge

**B01 · ¶1 · 0:00 · "I've been keeping a beady eye"**
- Point: who Krish is and what this channel watches.
- Screen: FACE ALONE (rest). House lower third "Krish" for 3 s; one shift
  light in a small strip for 2 s (chapter 1).
- Text: none beyond his name.
- Move: straight in from the story intro on his first word.
- Source: none.

**B02 · ¶2 · 0:06 · "I've been using all the well-known AI apps"**
- Point: he uses them all daily, and has noticed something odd.
- Screen: FACE. PUNCH on "something odd about how they're sold."
- Text: none.
- Move: hold, then the punch.
- Source: none.

**B03 · ¶2 · 0:15 · "Every launch is about a name."** `fri-03-launch-flashes`
- Point: launches sell a name.
- Screen: FULL, three flashes, one on each phrase: "A new number" (the title
  of Anthropic's Opus 5.5 page), "a livestream" (OpenAI's GPT-5 launch
  livestream page on YouTube), "a chart" (the bars and title of a chart on
  the Opus 5.5 page, cropped so no value labels show).
- Text: "A new number", "A livestream", "A chart", each on its phrase.
- Move: a cut on each phrase [A: a clack on each]. Without A, hard cuts.
- Source: SHOT anthropic.com/claude-opus-5-5; SHOT OpenAI's GPT-5 launch
  livestream page on YouTube (August 2025). LOGO Anthropic, OpenAI.

**B04 · ¶2 · 0:20 · "Claude Opus 4.8. Then Opus 5."** `fri-04-badge-parade`
- Point: the names keep stepping up.
- Screen: FULL. A drawn car's front, seen head on (the badge is on the
  front, as the script says at B24). The badge "Opus 4.8" sits on its grille; "Opus 5"
  knocks it off; "Opus 5.5" knocks that off. Anthropic logo small, top left.
- Text: the badges themselves.
- Move: each badge drops on its word [A: a clack per badge].
- Source: DRAWN, LOGO Anthropic.

**B05 · ¶2 · 0:24 · "At this rate, when's Opus 5.56 coming out?"** `fri-05-badge-joke`
- Point: the joke: the numbers are getting silly.
- Screen: the same car front; a fourth badge, "Opus 5.56", squeezes in, too
  long for the grille, wonky, with a coral "?" stamp. Then PUNCH on Krish for the
  look after the line.
- Text: "Opus 5.56?"
- Move: the badge squeezes on "5.56"; cut to his face on "coming out?".
- Source: DRAWN.

**B06 · ¶3 · 0:27 · "So I wanted to break it down."** `fri-06-three-questions`
- Point: the three questions this video answers (its map).
- Screen: SPLIT. On the right, three lines build, one as he asks each:
  "Does the name change the answer?", "Easier, and less transparent?", "Lack
  of control, over intelligence?".
- Text: the three lines, each six words or fewer.
- Move: each line lands on its question; PUNCH on "intelligence itself?".
- Source: DRAWN (video_card.py `statement`, with the OpenAI logo).

**B07 · ¶4 · 0:55 · "Some of the new AIs are better."**
- Point: the concession, then the claim: the name is the least important
  thing on your screen.
- Screen: FACE ALONE (rest). PUNCH on "the least important thing on your
  screen."
- Text: none.
- Move: hold.
- Source: none.

**B08 · ¶5 · 1:06 · "There's a setting that changes your answer much more."** `fri-08-the-setting`
- Point: a setting, not the name, decides how hard it thinks, and the app
  starts it low.
- Screen: FULL. Krish's own Claude app with the effort menu open, then
  ChatGPT's picker with its thinking levels. A coral ring draws round the
  setting on "how hard the AI thinks"; on "starts it low" the ring moves to
  the default; on "almost nobody changes it" the cursor hovers and drifts
  away without a click.
- Text: "How hard it thinks"
- Move: cut in on "a setting"; the ring draws on "how hard".
- Source: CAPTURE Claude and ChatGPT (date recorded). Backup if a capture
  cannot be made: SHOT support.claude.com/en/articles/8664678 and
  help.openai.com/en/articles/20001354, cropped to the lines that list the
  levels. LOGO Anthropic, OpenAI.

**B09 · ¶5 · 1:18 · "There are a few reasons OpenAI and Anthropic would rather you look at the name."** `fri-09-eyes-on-badge`
- Point: they want your eyes on the name.
- Screen: SPLIT. The Opus 5.5 badge on its drawn car front, lit by a spotlight; the
  settings menu from B08 beside it, dimmed. OpenAI and Anthropic logos above.
- Text: "Look at the name"
- Move: the spotlight swings onto the badge on "look at the name"; cut to
  FACE on "Let's unpack them."
- Source: DRAWN, CAPTURE (reused), LOGO.

**B10 · ¶6 · 1:26 · "And I think the AI itself will end up deciding how hard it thinks."** `fri-10-three-verdicts`
- Point: his forecast in one line: the AI will pick; good for ease, good for
  them, bad in other ways.
- Screen: FACE for the first sentence (opinion). Then SPLIT: three chips
  build on their words: "Easier ✓" on "an easier experience", the OpenAI and
  Anthropic logos with a ✓ on "good news for OpenAI and Anthropic", "Other
  ways ✗" (coral) on "bad news in other ways".
- Text: "Easier ✓", logos ✓, "Other ways ✗".
- Move: PUNCH on "But it's bad news in other ways."
- Source: DRAWN, LOGO.

### Chapter 2. Why the names keep coming

**Card 2** lands before "First, the names." (two lights).

**B11 · ¶7 · 1:47 · "First, the names. Anthropic makes Claude."** `fri-11-opus-pile`
- Point: three Opus names in five months.
- Screen: FULL. The pile-up, as in the article: Anthropic's real launch pages
  land one on another, each with its month under it: Opus 4.8 (May), Opus 5
  (July), Opus 5.5 (September).
- Text: "May", "July", "September", one under each page.
- Move: each page drops on its month.
- Source: SHOT anthropic.com/news/claude-opus-4-8; the Opus 5 launch page
  (July 2026, from the piece's filed sources); anthropic.com/claude-opus-5-5.
  Crop each to its title. LOGO Anthropic.

**B12 · ¶7 · 1:56 · "OpenAI makes ChatGPT. It went from GPT 5.1"** `fri-12-gpt-flip`
- Point: OpenAI's names climb just as fast.
- Screen: FULL. A split-flap badge flips straight from "GPT 5.1" to "GPT 6.1"
  (a straight flip: a rolling counter would show names the script does not
  say), over the two real launch pages.
- Text: "GPT 5.1" then "GPT 6.1".
- Move: the flip lands on "to GPT 6.1".
- Source: SHOT openai.com/index/gpt-5-1/ (November 2025) and OpenAI's GPT-6.1
  launch page (end of September 2026, from the piece's filed sources). DRAWN
  flip. LOGO OpenAI.

**B13 · ¶8 · 2:03 · "Why so many? This bit is my own opinion."**
- Point: what follows is his view.
- Screen: FACE ALONE (rest). PUNCH on "my own opinion".
- Text: none.
- Move: hold.
- Source: none.

**B14 · ¶9 · 2:09 · "In March 2025, OpenAI added a new picture maker"** `fri-14-million-an-hour`
- Point: a launch brings a rush of people.
- Screen: FULL. OpenAI's picture-maker launch page (title only), then Altman's
  post on X with "we added one million users in the last hour." highlighted.
- Text: "1 million in one hour"
- Move: cut to the post on "a million new people"; the highlighter sweeps on
  "in one hour".
- Source: SHOT openai.com/index/introducing-4o-image-generation/; SHOT
  x.com/sama/status/1906771292390666325. LOGO OpenAI.

**B15 · ¶9 · 2:20 · "That same day, OpenAI said investors"** `fri-15-same-day`
- Point: the big money news landed on the same big day.
- Screen: FULL. Two pages side by side: Altman's post (left) and OpenAI's
  funding page (right), their dates lined up under one coral bracket.
- Text: "Same day: $40 billion"
- Move: the right page slides in on "That same day"; "$40 billion" lands on
  "forty billion dollars".
- Source: SHOT openai.com/index/march-funding-updates/ (cropped to its date
  and the sentence with the $40 billion). LOGO OpenAI.

**B16 · ¶9 · 2:24 · "Announcing it on such a big day made OpenAI look even better."**
- Point: the money was not caused by the launch; the timing made OpenAI look
  better.
- Screen: FACE ALONE (rest). PUNCH on "look even better."
- Text: none.
- Move: hold.
- Source: none.

### Chapter 3. The gear that matters

**Card 3** lands before "So what does matter?" (three lights).

**B17 · ¶10 · 2:29 · "So what does matter? Picture a woman called Sally."** `fri-17-sally-shop`
- Point: meet Sally, about to sign a deal with a supplier. (Sally S1.)
- Screen: FULL. The drawn shop front, Sally at her counter, the supplier's
  deal on the counter, the supplier's van outside.
- Text: "Sally" (name label, first visit only).
- Move: a slow push into the drawing from "Picture".
- Source: DRAWN.

**B18 · ¶10 · 2:40 · "She pastes the deal into her AI app"** `fri-18-sally-four-seconds`
- Point: she asks her AI, gets a fast, sure answer, and signs.
- Screen: FULL. Her laptop; the deal pasted in; a timer counts to 4 seconds;
  a tidy answer appears with a confident tick; her pen signs. The answer box
  is a neutral house drawing, not ChatGPT's or Claude's screen.
- Text: "4 seconds"
- Move: the timer runs in time with his words; a hard cut on the pen stroke
  at "She signs."
- Source: DRAWN.

**B19 · ¶11 · 2:52 · "Six months later, she finds one small rule"** `fri-19-sally-hidden-rule`
- Point: one hidden rule cost her, and a careful reader would have spotted
  it. (Sally S2.)
- Screen: FULL. A page flips to "6 months later"; a magnifier slides over the
  small print; one line glows coral; the till drawer slides open, empty. On
  "A careful reader would have spotted it." a red pen circles the line.
- Text: "6 months later"
- Move: the magnifier lands on "one small rule"; the pen circles on "careful
  reader".
- Source: DRAWN. No sum of money: the script gives none.

**B20 · ¶12 · 3:02 · "Nothing was wrong with the name on her screen."** `fri-20-sally-never-thought`
- Point: the name was fine; the thinking was missing. (Sally S3.)
- Screen: FULL. Her screen: the model name gets a cream tick; beside it a
  house-drawn thinking control sits at its lowest notch and pulses coral on
  "never stopped to think". Sally's face as she realises.
- Text: "It never stopped to think"
- Move: the tick on "the name"; the pulse on "never stopped"; hold on her
  face on "didn't realise".
- Source: DRAWN.

**B21 · ¶13 · 3:13 · "ChatGPT and Claude both let you choose how hard the AI thinks."**
- Point: you can choose today, maybe not for long.
- Screen: SPLIT: the two real menus from B08 with their logos. Then FACE,
  PUNCH on "For now." (a hard step in, the wry beat).
- Text: none.
- Move: [A] a clack on "For now."
- Source: CAPTURE (reused), LOGO OpenAI, Anthropic.

**B22 · ¶14 · 3:18 · "I looked up what thinking means."** `fri-22-thinking-notebook`
- Point: thinking means the AI writes out its working first, and you see
  only a summary of it.
- Screen: FULL. One continuous drawing, the working notebook: a page fills
  with lines of working; a fold slides over most of it, leaving a thin strip
  (the summary); then, one per sentence, the question splits into boxes
  (steps), two paths branch (more than one way), a tick checks the answer,
  and a magnifier crosses a globe (more searching).
- Text, one at a time: "Writes out its working", "You see a summary",
  "Steps", "More than one way", "Checks its answer", "Searches more".
- Move: each element builds on its sentence; no cuts inside. This notebook
  comes back in B27.
- Source: DRAWN.

**B23 · ¶15 · 3:38 · "Think of a car."** `fri-23-think-of-a-car` (strongest moment 1)
- Point: a car is coming, with a key: each thing on the AI side has its
  thing on the car side.
- Screen: SPLIT. Krish in the left third. On the right the empty key slides
  in on "Think of a car": three blank rows, each an "=" with a space either
  side, the AI side headed "AI" and the car side headed "Car". (The key is
  described under "What stands for what" above.)
- Text: "AI", "Car".
- Move: the slide; PUNCH on "Think of a car."
- Source: DRAWN. Long video only: it is the frame the car pictures fill.

**B24 · ¶15 · 3:40 · "The name of the AI model is like the badge on the front of a car."** `fri-24-badge-on-the-front` (strongest moment 1)
- Point: the AI model's name, like Opus 5.5, is only the badge on the front
  of the car.
- Screen: FULL, grown out of the key's first row: the AI side above, the car
  side below, an "=" between. Above, on "The name of the AI model": the
  drawn "Opus 5.5" badge, flat chrome lettering in Archivo, the size, weight
  and spacing of a real car badge, on ink, with a small IBM Plex Mono label
  under it, "Illustration", so nobody takes it for a real badge. Below, on
  "the badge on the front of a car": the front of an Audi Q5 (one of the two
  cars the paragraph names), close on the badge on its grille, with "Audi
  Q5" in text under it. That is a cleared photograph where one exists;
  otherwise a plain drawn car front with its empty badge plate lit coral, no
  logo on it and no make named. The drawn badge is never put on the
  photograph, and the photograph is never edited. Hold at least 2.5
  seconds, then shrink into the key's first row on the left edge.
- Text: "Model name = the badge", "Illustration", and "Audi Q5" under the
  photograph.
- Move: the badge lands on "the AI model"; the car front on "the badge on
  the front"; a slow push into the car's badge; hold.
- Source: DRAWN badge (the same badge as B04, which is why B04's badges sit
  on a drawn car front); the Q5's front a cleared PHOTO (public domain, CC0,
  Pexels or Unsplash, source and licence recorded), else DRAWN as above.
  Long video only.

**B25 · ¶15 · 3:46 · "The thinking setting is like the gears of the car."** `fri-25-the-gear` (strongest moment 1)
- Point: the thinking setting is the gears, and the setting you saw at B08
  is the gearstick.
- Screen: FULL, grown out of the key's second row. Above: Krish's own effort
  menu from B08, the coral ring on its current level, landing on "The
  thinking setting". Below: a gearstick, its knob's gear numbers readable,
  landing on "the gears of the car", with a coral line drawn from the ringed
  level to the stick. [B] The dash appears for the first time, empty. Hold
  at least 2.5 seconds, then shrink into the second row.
- Text: "Thinking = the gear".
- Move: [A] clack as the gearstick lands on "the gears of the car".
- Source: CAPTURE (reused from B08); the gearstick a cleared PHOTO with no
  maker's mark, else DRAWN.

**B26 · ¶15 · 3:50 · "Right now, these apps are like a manual car, where you change gear yourself."** `fri-26-manual-car`
- Point: today's apps are a manual car: you change gear yourself.
- Screen: FULL, grown out of the key's third row. Above, on "these apps":
  the ChatGPT and Claude app marks, side by side, each whole. Below, on "a
  manual car": act 1 of the transmissions, an H-pattern gearstick, then the
  three pedals in a manual car's footwell with the clutch pedal ringed in
  coral (the third pedal is what makes it a manual). On "where you change
  gear yourself" a hand moves the stick and a foot presses the clutch. Hold
  at least 2.5 seconds, then shrink into the third row: the key is
  complete, and stays on the left edge through B29.
- Text: "Today's apps = a manual car", then "You change gear yourself".
- Move: hold; the hand and foot move on "where you change gear yourself".
- Source: LOGO ChatGPT and Claude app marks; the H-pattern gearstick, the
  clutch pedal, and the hand and foot (one shot, or two side by side): each
  a cleared PHOTO with no maker's mark, else DRAWN.

**B27 · ¶15 · 3:56 · "In a low gear, it barely thinks."** `fri-27-low-high`
- Point: in a low gear the AI barely thinks; in a high gear it thinks
  hardest.
- Screen: FULL, two cells side by side, each with the B22 notebook above
  and the gearstick below, as in the key:
  - Left, on "In a low gear, it barely thinks.": the stick in a low gear;
    the notebook with one line of working. [B] Dash `LOW`.
  - Right, on "In a high gear, it thinks hardest.": the stick in a high
    gear; the notebook full. [B] Dash `HIGH`.
- Text: "Low gear: barely thinks", "High gear: thinks hardest".
- Move: each cell lands on its sentence; [A] clack on "In a high gear".
- Source: the gearstick in two gears (two cleared photographs, or the
  drawing moved); DRAWN notebook.

**B28 · ¶15 · 4:01 · "The novice argues about BMW's X3 versus Audi's Q5,"** `fri-28-x3-q5`
- Point: the novice argues about which car, by its badge, which here means
  which model name.
- Screen: FULL. The BMW X3 and Audi Q5 fronts, straight on, "vs" between
  them, "BMW X3" and "Audi Q5" in text under each, the badge on each grille
  ringed in coral. They are cleared photographs where they exist, matched in
  angle and as near in colour as they allow; otherwise house-style drawings
  of a plain car of each shape, with no logo on them, named in text. The
  official BMW and Audi logos sit small above their cars, each whole and
  apart from the car and from each other, to say whose car it is. As the
  rings draw, the key's first row, "Model name = the badge", lights in the
  strip, so the argument reads as one about names.
- Text: "BMW X3 vs Audi Q5".
- Move: each car slams in from its side on its name; the rings draw on
  "argues".
- Source: the X3 and Q5 fronts each a cleared PHOTO, else DRAWN with the
  car named in text; LOGO BMW, Audi (official files, unaltered, only to say
  whose car it is). Long video only.

**B29 · ¶15 · 4:05 · "but the pro is looking at the gear systems beneath."** `fri-29-cutaway`
- Point: the pro looks at what makes it go: the gears, how hard it thinks.
- Screen: FULL. The two cars slide apart to reveal a gearbox cutaway; a
  coral ring on the gears; the key's second row, "Thinking = the gear",
  lights in the strip. The key folds away as the line ends.
- Text: "The pro looks beneath"
- Move: the reveal on "beneath" [A: clack].
- Source: the gearbox cutaway a cleared PHOTO (Wikimedia Commons marked
  public domain or CC0, Pexels or Unsplash) with no maker's mark, else
  DRAWN; the cars and logos from B28 reused (long video only).

**B29a · ¶15 · 4:09 · "But with AI, most of us drive everywhere in first gear all the time, the lowest one."** `fri-29a-everywhere-in-first`
- Point: most of us never leave first gear, the lowest one.
- Screen: FULL. A drawn road map; a little drawn car, with no maker's badge,
  crawls the whole route (motorway, town, a hill) while [B] the dash stays
  in `1st` the whole way (without B, a small first-gear tag rides on the
  car). On "the lowest one" the gear pulses. The joke is the point: nobody
  drives a motorway in first.
- Text: "Everywhere in first gear"
- Move: the scenes change under the car; the gear never does. Cut to FACE as
  the line ends, for B30's question.
- Source: DRAWN.

**B30 · ¶16 · 4:16 · "So how big is the difference in going up a gear?"** `fri-30-rev-counter` (strongest moment 2)
- Point: the same badge does much better in a higher gear, and an older
  badge in top gear beats the new one in its lowest.
- Screen: FACE for the question (the return to his face after the car
  sequence). Then FULL from "A group called Artificial Analysis": the
  Artificial Analysis page header for Claude Opus 5.5 (the header only),
  then a drawn sheet marked "hard test" slides under the badge "Opus 5.5",
  then the rev counter [C] (an arc with no numbers printed on it, and no
  number on the needle):
  - "In its top gear, it did much better than in its lowest.": dash LOW,
    the needle rests low; on "top gear" the dash steps to TOP and the needle
    sweeps far round, the biggest movement in the film so far. The low
    needle stays as a ghost. Both positions are placed by the true scores,
    so the gap on screen is the real one, but no score is shown.
  - "The older Opus 5, in its top gear, beat the new one in its lowest.":
    cut to a drawn two-lane road seen side on, in the house style (the race
    runs on to B30b). In the slow lane a big drawn car, badge "Opus 5.5" on
    its nose in the B04 chrome lettering, gear tag `1st`, crawling, a puff
    of exhaust behind it. An older car, badge "Opus 5" in duller chrome,
    gear tag `TOP`, comes up in the fast lane and passes it clearly.
- Text: "Same badge, top gear: much better" (on the needle sweep); then
  "Older badge, top gear, wins" (on the pass). Source line under the dial
  and the road: "Artificial Analysis". No scores.
- Move: [A] a clack on "top gear" as the needle sweeps; the older car passes
  on "beat the new one", and [A] clacks as its tag lights `TOP`. Without C:
  two unlabelled bars, low gear short and top gear long, drawn to the true
  ratio, then the same road.
- Source: SHOT artificialanalysis.ai/models/claude-opus-5-5 (the page header
  only; it and the pages for Opus 5.5 in low gear and Opus 5, filed with it,
  carry the scores, which are not shown). DRAWN (the sheet, the dial, the
  road). LOGO Anthropic.

**B30a · ¶16 · 4:38 · "So did Anthropic's cheapest AI, Haiku."** `fri-30a-haiku-passes` (strongest moment 2)
- Point: the gear can beat the badge: Anthropic's cheapest AI, in its top
  gear, beat Opus 5.5 in its lowest too.
- Screen: FULL, the same drawn road. Opus 5.5 still crawling in `1st`, the
  Opus 5 car now ahead. On "Anthropic's cheapest AI" a small drawn car,
  badge "Haiku" in the B04 chrome lettering, gear tag `TOP`, comes up from
  behind with speed lines, and on "Haiku" it draws level and edges past by a
  nose. By a nose, not by a mile: Haiku's top-gear result is only just above
  Opus 5.5's lowest, so the small car does not leave the big one behind.
  Neither car looks like a real model or carries a maker's logo. The gear
  tags are in the dash's style, so the row reads the same without B, and [B]
  the corner dash steps aside while the tags show. Anthropic logo small, top
  left (all three are Anthropic's).
- Text: "Anthropic's cheapest AI" (over the small car as it enters), the
  badges "Haiku", "Opus 5" and "Opus 5.5", the tags "TOP" and "1st". No
  scores: the script gives none.
- Move: the small car enters on "Anthropic's cheapest AI" and edges past on
  "Haiku"; [A] a clack as its tag lights `TOP`.
- Source: DRAWN, LOGO Anthropic. The fact is on Artificial Analysis
  (artificialanalysis.ai/articles/claude-haiku-5-5, 7 October 2026, with
  the Opus 5.5 low page from B30); neither page is shown, because both carry
  scores the script does not say.

**B30b · ¶16 · 4:41 · "So changing gear beat getting a new badge."** `fri-30b-gear-beats-badge` (strongest moment 2)
- Point: what the test shows: changing gear beat getting a new badge.
- Screen: FULL, the view lifts from the road to above it: the two top-gear
  cars ahead, Opus 5.5 behind in `1st`. The three badges shrink, small and
  grey, and the three gear tags grow big and bright, so the picture says
  which matters more (the badge chip's idea from the dash).
- Text: "Changing gear beat a new badge".
- Move: the lift starts on "changing gear"; the text lands on "a new
  badge". Then cut to FACE for B31.
- Source: DRAWN.

**B31 · ¶17 · 4:44 · "But more thinking isn't always better."** `fri-31-two-plus-three`
- Point: on an easy question, more thinking is waste.
- Screen: FACE, PUNCH on "But more thinking isn't always better." (the turn,
  and the return to his face after the race, B30 to B30b). Then FULL from
  "Researchers asked": the paper's title page, then "2 + 3 = 5" written out
  again and again, stacking down the frame faster and faster, a counter
  beside it.
- Text: "2 + 3", then "13 times".
- Move: the stack stops dead at 13 on "thirteen times", with a thud.
- Source: SHOT arxiv.org/abs/2412.21187 (title: "Do NOT Think That Much for
  2+3=?"). DRAWN stack.

**B32 · ¶18 · 4:55 · "The thinking gear matters most on hard jobs, like Sally's deal."** `fri-32-hard-easy`
- Point: gear up for hard jobs; on easy ones extra thinking is waste.
  (Sally S4.)
- Screen: SPLIT in two pictures: left, Sally's deal, the dash going from 1st
  to HIGH with a cream ✓; right, "2 + 3", the dash on TOP with a coral ✗.
  Then FACE, PUNCH on "But whose money is wasted?"
- Text: "Hard jobs: gear matters most", then "Easy questions: extra thinking wasted".
- Move: the punch is the hook into chapter 4.
- Source: DRAWN.

### Chapter 4. What thinking costs them

**Card 4** lands before "All that hidden working runs" (four lights).

**B33 · ¶19 · 5:04 · "All that hidden working runs on huge computers,"** `fri-33-data-centre`
- Point: all that hidden working costs money to run.
- Screen: FULL. A cleared photograph of a data centre aisle, no company's
  name or logo in frame. On "which cost money to run" it slides up into a
  thin strip and a drawn dashboard rises in below it: two round dials on
  ink, a fuel gauge on the left and a speedometer on the right, each with
  its pairing label under it, landing in turn: "Fuel = the cost", then
  "Speed = the score". The fuel gauge is marked only E and F; the
  speedometer carries no numbers at all.
- Text: "Fuel = the cost", "Speed = the score".
- Move: the dashboard rises on "cost money to run"; the two labels land one
  after the other and stay through B33b.
- Source: the data centre a cleared PHOTO (Pexels or Unsplash, source and
  licence recorded); DRAWN dashboard.

**B33a · ¶19 · 5:10 · "If Opus 5.5 thinks as hard as it can,"** `fri-33a-fuel-vs-speed` (strongest moment 3)
- Point: the cost problem, Krish's "visualize this problem really well in
  post": thinking as hard as it can burns about eleven times the fuel...
- Screen: FULL. The dashboard splits into two, side by side: the same car on
  the same trip, twice. Left: badge chip "Opus 5.5", gear `LOW` (thinking a
  little). Right: the same chip, gear `TOP` (as hard as it can). A thin
  drawn road under each scrolls at the same rate, so the viewer sees both
  cover the same trip. Both tanks start full. From "thinks as hard as it
  can" both fuel needles fall at once: the left one drops a single notch,
  one twelfth of the way from F to E, and stops; the right one keeps
  falling, eleven notches, until it sits just above E and a drawn low-fuel
  lamp glows coral. The gauge on the right empties about eleven times
  faster, the script's "about eleven times as much", and the ratio on
  screen is the true one (Artificial Analysis: about $0.55 a task in low,
  $5.98 in max; neither figure is shown). The car truth that makes it read
  at a glance: driving flat out burns far more fuel for not much more
  speed.
- Text: "About 11x the fuel" (on "eleven times").
- Move: both needles start together on "thinks as hard"; the text lands on
  "eleven times"; the left gear chip pulses on "thinking a little". No
  sound on the needles, so the gear clacks keep their meaning.
- Source: DRAWN. The figures behind it are on the Artificial Analysis pages
  filed for B30 and are not shown.

**B33b · ¶19 · 5:18 · "But its score only goes up by about a third."** `fri-33a-fuel-vs-speed` (continues)
- Point: ...and its score goes up by only about a third.
- Screen: the same two dashboards; now the speedometers. The left needle
  rests where the low gear's score puts it. On "only goes up" the right
  needle climbs, and stops a short way past it, about a third further round
  the dial. The needle angles are proportional to the scores, measured from
  the dial's resting point: the needles stop where the low-gear and
  top-gear scores put them, the same ratio as the rev needle at B30, with
  no number on either, so the step on screen is the true one. Hold the finished pair for 2 seconds: a nearly empty tank beside a
  needle barely past its neighbour (B35's meter waits for the hold, up to 2
  seconds behind his words). [B] The corner dash steps aside through
  B33a and B33b; the gear chips sit on the dials.
- Text: "Only about a third faster" (on "about a third").
- Move: the right needle climbs on "goes up" and stops on "a third"; hold.
- Source: DRAWN (the same dashboard).

**B35 · ¶20 · 5:22 · "Businesses that put AI inside their own apps"** `fri-35-meter`
- Point: businesses pay per word, so more thinking earns OpenAI and
  Anthropic more. (B34 merged here and into B36: its line, "Who pays for
  that thinking depends on how you pay.", was cut from the script. The turn
  to who pays now opens this row, and its rest for Krish's face moves to
  B36's split.)
- Screen: FULL. A drawn taxi-style meter marked "per word" ticks as words
  stream past; when the dash goes HIGH the meter speeds up and coins flow to
  the OpenAI and Anthropic logos.
- Text: "Businesses pay for every word"
- Move: the meter speeds up on "turn up the thinking".
- Source: DRAWN, LOGO. No pricing page: it would put prices on screen that
  the script does not say.

**B36 · ¶21 · 5:32 · "But most of us pay the same amount every month,"** `fri-36-meter-flips`
- Point: on a flat plan, the company pays for every extra thought.
- Screen: SPLIT, the return to his face in this chapter: Krish in the left
  third. On the right the meter swings across: your side now shows a flat
  ticket, "same every month"; the meter ticks on the OpenAI and Anthropic
  side.
- Text: "Same amount every month"
- Move: the swing lands on "Then OpenAI or Anthropic pays".
- Source: DRAWN, LOGO.

**B37 · ¶21 · 5:41 · "In January 2025, Sam Altman said OpenAI was losing money"** `fri-37-200-a-month`
- Point: even the $200 plan lost OpenAI money, because people used it far
  more than OpenAI expected.
- Screen: FULL. Altman's post on X, "insane thing: we are currently losing
  money on openai pro subscriptions! people use it much more than we
  expected.", with "losing money" highlighted first; then OpenAI's Pro
  launch page, cropped to its price line, slides in beside it; then the
  highlighter sweeps the post's second sentence.
- Text: "$200 plan, still losing money", then "Used far more than expected".
- Move: the highlighter on "losing money"; "$200 plan" lands on "two
  hundred dollar plan"; the second sweep on "People used it far more".
- Source: SHOT x.com/sama/status/1876104315296968813; SHOT
  openai.com/index/introducing-chatgpt-pro/ (cropped to the price line).
  LOGO OpenAI.

**B38 · ¶22 · 5:50 · "That, I think, is why the app starts you in a low gear."**
- Point: so the app starts you in a low gear (his reading, so his face).
- Screen: FACE ALONE (rest). PUNCH on "starts you in a low gear." With B,
  the dash shows LOW in the corner and nothing else is over him.
- Text: none.
- Move: hold. (The old split of a flat bill against a jumping cost went with
  its line, which the script cut; B36 carries the flat plan.)
- Source: none.

### Chapter 5. Who decides next

**Card 5** lands before "So who decides how hard" (five lights).

**B39 · ¶23 · 5:56 · "So who decides how hard your AI thinks?"** `fri-39-inside-one-gear`
- Point: even now, inside one gear, the AI decides how much to think.
- Screen: FACE for the question. Then [B] the dash shows a single gear slot
  with a small needle moving inside it, on "Right now, you do". Without B:
  a small full-frame version of the same drawing.
- Text: none.
- Move: hold.
- Source: DRAWN. The fact is in OpenAI's reasoning guide ("reason
  adaptively") and Anthropic's "Steering thinking" docs; not shown.

**B40 · ¶24 · 6:02 · "The next step is the AI choosing the gear for you, and Google has started."** `fri-40-gemini-auto`
- Point: Gemini's free app is now an automatic transmission: it picks the
  gear for you.
- Screen: FULL. The automatic selector (P R N D) pushes the manual stick
  off the frame: act 2 begins. Then Google's help page with "Auto will be the
  default setting for users without a Google AI plan." highlighted. [B] Dash
  AUTO. Then, on "like a car with an automatic transmission", the
  selector again, close, its P R N D letters readable and the lever in D,
  with the Google logo above it and an "=" between: the second transmission,
  named as he names it. The selector shows no carmaker's logo: the script
  pairs Google with no carmaker.
- Text: "Gemini: Auto, from 9 October", then "Auto = an automatic transmission".
- Move: [A] a clunk as the selector lands on "choosing the gear for you".
- Source: the automatic selector a cleared PHOTO with no maker's mark,
  else DRAWN; SHOT support.google.com/gemini/answer/17004136 and
  9to5google.com/2026/10/09/gemini-auto-free-users/. LOGO Google.

**B41 · ¶25 · 6:21 · "OpenAI has gone the other way, and taken ChatGPT's automatic gear picker away, twice."** `fri-41-taken-away-twice`
- Point: OpenAI took its automatic away twice.
- Screen: FULL. A drawn strip with two places for coral stamps: "December:
  free users" and "September: Plus and Pro". [B] Dash AUTO.
- Text: "Taken away, twice"
- Move: the first stamp hits on "Last December" (B42), the second on "Then in
  September" (B43); the dash's AUTO is struck out at each.
- Source: DRAWN, LOGO OpenAI.

**B42 · ¶25 · 6:26 · "Last December, free users lost it."** `fri-42-wired`
- Point: OpenAI gave one reason; WIRED reported that the picker sent many
  more free users to costlier thinking.
- Screen: FULL. WIRED's story with this sentence highlighted: "the router
  seemed to send many more free users to OpenAI's advanced reasoning models,
  which are more expensive for OpenAI to serve."
- Text: "Those cost OpenAI more"
- Move: the highlighter sweeps on "Those cost OpenAI more."
- Source: SHOT wired.com/story/openai-router-relaunch-gpt-5-sam-altman/
  (16 December 2025).

**B43 · ¶25 · 6:42 · "Then in September, people on the Plus and Pro plans lost it too."** `fri-43-plus-pro`
- Point: paid users lost it too, with no reason given; now you pick.
- Screen: FULL. OpenAI's release note: "We're retiring automatic switching
  from Instant to Thinking (reasoning) for ChatGPT Plus and Pro users
  globally." Then FACE on "OpenAI didn't say why." (a dry look, held). Then
  the manual stick returns on "Now, on those plans, you pick the gear."
- Text: "You pick the gear" (on the last line).
- Move: the second stamp from B41 lands as the note appears.
- Source: SHOT help.openai.com/en/articles/6825453-chatgpt-release-notes
  (the 14 September 2026 entry). The manual stick (reused). LOGO OpenAI.

**B44 · ¶26 · 6:52 · "I don't think that lasts, and here's my guess why."**
- Point: his guess is coming.
- Screen: FACE ALONE (rest). PUNCH on "my guess why."
- Text: none.
- Move: hold.
- Source: none.

**B45 · ¶26 · 6:56 · "Think what each part of the car is worth to OpenAI or Anthropic."** `fri-45-xray-car` (strongest moment 4)
- Point: each part of the car is worth something different to them.
- Screen: FULL. First, for 2 seconds, the car key from ¶15 returns full
  frame (long video only), its badge and gear rows lit: "Model name = the
  badge", "Thinking = the gear". Then a drawn car in side view; on the word
  "part" it turns X-ray: the badge on the front, the gearbox beneath. Two
  empty labels wait. OpenAI and Anthropic logos at the top.
- Text: "Model name = the badge", "Thinking = the gear" (the key's own
  words); then "Badge: ?" and "Gears: ?"
- Move: the key cuts in on "Think what"; the X-ray switches on.
- Source: DRAWN, LOGO; the key reused from B23 to B26 (its marks and
  pictures, long video only).

**B46 · ¶26 · 7:01 · "The badge brings attention."** `fri-45-xray-car` (continues)
- Point: the badge buys attention, so they keep your eyes on it and off the
  gear.
- Screen: the same car. The badge lights coral and its label fills; the
  launch pages from B11 flicker across the badge; on "you don't notice the
  gear" the gearbox fades to grey.
- Text: "The badge brings attention"
- Move: continuous.
- Source: DRAWN, SHOT (reused).

**B47 · ¶26 · 7:08 · "Even the scores Anthropic shows off for Opus 5.5 were in top gear."** `fri-47-top-gear-scores` (strongest moment 4)
- Point: the scores you are shown are top gear; the app starts you lower.
- Screen: FULL, two pages side by side. Left: the footnote on Anthropic's
  Opus 5.5 page, "all Claude Opus 5.5 results use adaptive thinking at max
  effort", with "max effort" highlighted; [B] dash TOP. Right: the line in
  Anthropic's effort docs, "Claude Opus 5.5 and Claude Haiku 5.5 default to
  medium", with "medium" highlighted; [B] dash MID.
- Text: "Scores in top gear. Starts lower."
- Move: the right page lands on "Out of the box" [A: the downshift blip].
- Source: SHOT anthropic.com/claude-opus-5-5 (the footnote only, no chart
  values); SHOT platform.claude.com/docs/en/build-with-claude/effort (the
  default line). LOGO Anthropic.

**B48 · ¶26 · 7:17 · "The gears decide the bill."** `fri-45-xray-car` (continues)
- Point: the gears are the bill: on a monthly plan, every high gear costs
  them.
- Screen: back to the X-ray car. The gearbox lights; its label fills; the
  meter from B36 sits on the gearbox and spins on "every high gear costs
  them".
- Text: "The gears decide the bill"
- Move: continuous.
- Source: DRAWN.

**B49 · ¶26 · 7:23 · "They'd like their own hand on the gearstick,"** `fri-49-their-hand`
- Point: they want to decide how much thinking each question gets.
- Screen: FULL. The manual stick from B26; the OpenAI and Anthropic logos
  slide in and stop just beside the gear knob, reaching for it (beside it,
  never printed onto the picture).
- Text: "Their hand on the gearstick"
- Move: the logos land on "their own hand".
- Source: the manual stick (reused), LOGO.

**B50 · ¶26 · 7:30 · "Most of us would rather not change gear at all."** `fri-50-automatic-wins`
- Point: most of us would rather not shift, so the automatic wins (his call).
- Screen: the manual stick dissolves into the automatic selector, which
  clunks into D. Then FACE, PUNCH on "So I think the automatic wins."
- Text: none.
- Move: [A] clunk into D.
- Source: the manual stick and the selector (reused).

### Chapter 6. The good and the bad

**Card 6** lands before "Is that good? Some of" (six lights).

**B51 · ¶27 · 7:36 · "Is that good? Some of both."**
- Point: some of both, and the good: people don't change settings, so the
  starting gear is the gear they get.
- Screen: FACE ALONE (rest) through "People don't change settings."
- Text: none.
- Move: hold.
- Source: none.

**B52 · ¶27 · 7:40 · "Back in 2025, when ChatGPT's automatic gear picker first arrived,"** `fri-52-hundred-dots`
- Point: when the app picked, far more people got thinking answers.
- Screen: FULL. A grid of 100 dots, 10 by 10. "Before": no dot fully lit,
  labelled "Under 1 in 100". "After": seven dots light coral. A small inset
  of Altman's post on X cropped to "for free users we went from <1% to 7%".
  [B] Dash AUTO.
- Text: "Under 1 in 100", then "7 in 100".
- Move: the seven dots light one by one on "seven in a hundred did."
- Source: DRAWN grid; SHOT x.com/sama/status/1954603417252532479 (cropped
  before the Plus figures). LOGO OpenAI.

**B53 · ¶28 · 7:55 · "Anthropic learned this too. This March, it moved its coding app down to the middle gear."** `fri-53-claude-code-mid`
- Point: Anthropic moved the starting gear down, and most people stayed in
  it.
- Screen: FULL. Anthropic's engineering post with "we changed Claude Code's
  default reasoning effort from high to medium" highlighted. [B] Dash HIGH,
  then MID; on "Most people kept it there" it stays on MID.
- Text: "Most kept it there"
- Move: [A] the downshift blip on "down to the middle gear".
- Source: SHOT anthropic.com/engineering/april-23-postmortem (crop the
  sentence so the date is out). LOGO Anthropic.

**B54 · ¶28 · 8:09 · "So whoever picks the starting gear decides how hard most people's AI thinks."** `fri-54-whoever-picks`
- Point: the default is the decision; an automatic would at least think hard
  when it matters. (Sally S5.)
- Screen: CARD: "Whoever picks the starting gear decides." Then, on "An AI that picks
  for each question", SPLIT: the automatic selector with [B] the dash
  on AUTO; Sally's deal goes to HIGH, "2 + 3" goes to LOW.
- Text: "Whoever picks the starting gear decides"
- Move: [A] clack as the card lands.
- Source: DRAWN (video_card.py `statement`, with the OpenAI and Anthropic
  logos), the selector (reused).

**B55 · ¶29 · 8:20 · "Now the bad. You can't see it."**
- Point: the bad: you can't see it.
- Screen: FACE. PUNCH on "You can't see it."
- Text: none.
- Move: hold.
- Source: none.

**B56 · ¶29 · 8:23 · "This January, OpenAI made ChatGPT think for less time."** `fri-56-silent-downshift` (strongest moment 5)
- Point: OpenAI turned the thinking down, by mistake cut Extended too, and
  nobody could see it.
- Screen: FULL. OpenAI's release note, "We lowered the Standard and Light
  thinking time as we observed users prefer faster responses.", then its next
  sentence with "was unintentionally changed to be lower" highlighted. Then,
  from "By mistake, it also cut a longer thinking setting", a big version of
  the dash: the label reads "EXTENDED"; behind the word its bar drops by
  itself, with no clack and no sound, and the label never changes. (The old
  calendar strip went with its line, which the script cut.) On "Nobody
  looking at their screen would have known."
  hold the unchanged label for 2 seconds with the music dipped to near
  silence.
- Text: "Nobody would have known"
- Move: the only gear change in the film with no sound. Without A it still
  works, quieter: the held frame and the dip carry it.
- Source: SHOT help.openai.com/en/articles/6825453-chatgpt-release-notes
  (the "Update on thinking time settings" entry; crop the dates out). DRAWN
  dash. LOGO OpenAI.

**B57 · ¶30 · 8:37 · "When the AI picks your gear, is it thinking about your ease of use, or about their profit?"**
- Point: the question that matters: whose interest, and can you see it?
- Screen: FACE ALONE (rest), the longest hold in the film. PUNCH on "about
  their profit?"; out again on "And can you see what it picked?", where [B]
  the dash appears in the corner showing "?" and stays to the end of the
  paragraph. Without B: nothing over him.
- Text: none.
- Move: hold.
- Source: none.

### Chapter 7. What to do about it

**Card 7** lands before "So what should you do?" (all seven lights flash
and turn mint).

**B58 · ¶31 · 8:58 · "So what should you do?"**
- Point: the turn to advice.
- Screen: FACE.
- Text: none.
- Move: hold.
- Source: none.

**B59 · ¶32 · 9:00 · "For quick, everyday stuff, a low gear is fine."** `fri-59-low-is-fine`
- Point: low gear is fine for quick stuff.
- Screen: FACE. [B] Dash LOW, in mint (the answer). Without B: the text alone.
- Text: "Quick stuff: low gear is fine"
- Move: hold.
- Source: DRAWN.

**B60 · ¶33 · 9:04 · "For anything you'll act on, change the gear yourself."** `fri-60-act-on-it` (Sally S6)
- Point: gear up for anything you'll act on.
- Screen: FULL. A hand shifts the manual stick up; [B] dash HIGH in mint.
  Then four fast cards, one on each phrase: Sally flicks her gear up before
  she pastes ("A deal you're signing"), then "A health question", "Money",
  "A choice you can't take back".
- Text: each card's words, the script's own, six or fewer.
- Move: [A] clack on "change the gear yourself"; a cut on each phrase, the
  one burst of fast cuts in the long cut.
- Source: a hand shifting up, a cleared PHOTO with no maker's mark, else
  DRAWN; DRAWN cards and Sally.

**B61 · ¶33 · 9:13 · "On ChatGPT, pick Medium or High."** `fri-61-where-to-click`
- Point: exactly where to click.
- Screen: FULL. Krish's ChatGPT picker with Medium and High ringed in mint;
  then Claude's effort menu, the ring on the upper levels; then Gemini's
  effort setting. Logos on each.
- Text: "ChatGPT: Medium or High", then "Claude, Gemini: turn effort up".
- Move: a cut on each app's name.
- Source: CAPTURE ChatGPT, Claude, Gemini. Backup: SHOT
  help.openai.com/en/articles/20001354, support.claude.com/en/articles/8664678,
  support.google.com/gemini/answer/17004136. LOGO OpenAI, Anthropic, Google.

**B62 · ¶33 · 9:23 · "It takes longer, sometimes minutes, and uses up your plan's limit faster."** `fri-62-your-limit`
- Point: the cost to you: slower, and it uses up your plan's limit faster;
  worth it for the questions that matter.
- Screen: FACE. [B] Dash HIGH in mint. On "uses up your plan's limit
  faster" a small fuel gauge, the one from B33a, sits beside the corner and
  drops a notch: here the fuel is your plan's limit. PUNCH on "it's worth
  it."
- Text: "Uses up your limit faster"
- Move: the gauge drops on "your plan's limit"; hold.
- Source: DRAWN (the gauge from B33a). The fact is on
  support.claude.com/en/articles/8664678 ("you'll reach your usage limits
  faster"), not shown.

**B63 · ¶34 · 9:31 · "Formula 1 found a better way decades ago, called a semi-automatic."** `fri-63-paddles` (strongest moment 6)
- Point: F1's better way is the semi-automatic: the driver picks each gear
  by flicking a paddle; a computer does the rest.
- Screen: FULL. An F1 steering wheel with its paddles (act 3), landing on
  "called a semi-automatic", the third transmission named as he names it.
  On "flicking a paddle behind the steering wheel", a close-up of a paddle
  and the paddle flick: a drawn paddle animated over the still (or a cleared
  clip of a driver's hand, only if one exists with no team, sponsor or F1
  mark readable). On "A computer does the rest." small drawn gears turn
  behind the wheel.
- Text: "Formula 1: a semi-automatic", then "The driver picks each gear".
- Move: [A] clack on each flick.
- Source: the F1 wheel a cleared PHOTO (public domain, CC0, Pexels or
  Unsplash) with no team, sponsor or F1 mark readable, else DRAWN; the
  paddle flick DRAWN over it; never broadcast footage.

**B64 · ¶34 · 9:43 · "Software that changes gear by itself was tried,"** `fri-64-banned`
- Point: gearboxes that changed by themselves were banned; the driver still
  picks every gear.
- Screen: FULL. A coral stamp, "Banned since 2004", lands on a drawn
  self-shifting box; back to the wheel on "The driver still picks every
  gear."
- Text: "Banned since 2004"
- Move: the stamp lands on "banned".
- Source: DRAWN. The fact is from Raceteq, filed on the piece.

**B65 · ¶34 · 9:51 · "Let the AI pick our gear, if it must."** `fri-65-gear-under-answer` (strongest moment 6)
- Point: Krish's ask: let it pick, give us paddles, and show which gear it
  picked under every answer.
- Screen: FULL. A house-drawn mock, labelled "What I'm asking for": a plain
  answer box with a paddle on each side. On "so we can take over" a paddle
  flicks. On "And show us which gear it picked, under every answer." the dash
  that has sat in the corner since B25 slides down and docks under the
  answer as a line: "Answered in: HIGH".
- Text: "Which gear, under every answer"
- Move: the dock is the payoff of treatment B. Hold 3 seconds.
- Source: DRAWN. Not ChatGPT's, Claude's or Gemini's screen.

**B66 · ¶35 · 10:02 · "We've just spent time learning to drive a car with a manual transmission."** `fri-66-three-gearboxes`
- Point: the whole arc: a manual transmission now, an automatic next,
  paddles for those who care.
- Screen: FULL. The three transmissions side by side, as used before (the
  H-pattern stick with its clutch pedal from B26, the P R N D selector from
  B40, the F1 wheel from B63), each lighting on its line: the manual on
  "learning to drive a car with a manual transmission", the automatic on
  "going automatic next", the F1 wheel on "an F1 car still keeps the
  paddles", and the manual again, a hand on the
  stick and a foot on the clutch, on "still choose a manual transmission".
- Text: one word under each panel: "Manual", "Automatic", "Semi-automatic".
- Move: each panel lights on its line.
- Source: the three transmissions (reused).

**B67 · ¶35 · 10:22 · "For anything that matters, I'll be one of them."**
- Point: where Krish stands.
- Screen: FACE ALONE (rest). Hold, no punch: let it land. The music lifts a
  touch after the line.
- Text: none.
- Move: hold.
- Source: none.

**B68 · ¶36 · 10:25 · "Here's my bet."** `fri-68-the-call`
- Point: the dated call, and how sure he is.
- Screen: FACE, PUNCH on "Here's my bet." Then CARD, mint: "June 2027: free
  users automatic again", with [B] the dash on AUTO and the OpenAI logo. On "drive
  the car in auto mode" the automatic selector in D. On "I'm 85% sure"
  the rev needle settles at 85% [C] (without C: the house call meter).
- Text: "June 2027: free users automatic again", then "85% sure".
- Move: the needle settles on "85%".
- Source: DRAWN, the selector (reused), LOGO OpenAI.

**B69 · ¶36 · 10:41 · "Paid users will start in automatic too."** `fri-69-semi-automatic`
- Point: paid users go automatic too, but with a semi-automatic setting.
- Screen: FACE (opinion) through "help the AI company control its costs." Then the
  F1 wheel for "But paid plans will have a semi-automatic setting",
  with one last paddle flick.
- Text: none.
- Move: [A] clack on the last flick.
- Source: the F1 wheel (reused).

**B70 · ¶37 · 10:56 · "That's it for this week's mind.the.gap."** `fri-70-sign-off`
- Point: the full article, send it on, tell him in the comments.
- Screen: FACE ALONE (rest). Lower third "makeyourmindup.ai" on "free at
  makeyourmindup.ai". On "do you pick the gear, or leave it?" [B] the dash
  flips between YOU and AUTO. Then the story outro card on "Make your mind
  up."
- Text: "makeyourmindup.ai", then "Do you pick the gear?"
- Move: into the outro.
- Source: DRAWN, the house outro.

## The six strongest moments

Spend most of the post-production effort here, in this order.

1. **"Think of a car." (B23 to B29a, about 3:38 to 4:16): the car key, one
   pairing at a time, in Krish's own words.** The whole film rests on this.
   A car's front badge beside the drawn Opus 5.5 badge, Krish's own settings
   menu beside a gearstick, and the ChatGPT and Claude marks beside a manual
   gearstick and clutch make the analogy concrete for someone who has never
   thought about either, each pairing named in a few words and kept on
   screen in the key. If the viewer gets "the model's name is the badge, the
   thinking is the gear" here, every later gear line lands without
   explanation. Then the notebook filling as the stick goes up, the X3 and
   Q5 with their badges ringed sliding apart to the gearbox cutaway make the
   claim plain, and the little car crawling the motorway in first makes it
   funny. Clearing the car pictures is the biggest sourcing job in the film
   (long video only): search the cleared libraries first, and draw whatever
   does not clear, with the car named in text.
2. **"So how big is the difference in going up a gear?" (B30 to B30b,
   about 4:16 to 4:45): the rev needle, then the race.** The only hard proof
   of the main claim, now with no numbers in it at all (Krish, 16 October:
   "What does 42 even mean? that is not understandable. We need to simplify
   this"). The needle sweeping from low gear to top is the biggest movement
   in the film, placed by the true scores but showing none. Then the race
   says it in a way anyone gets: the older Opus 5 in top gear passes the new
   Opus 5.5 stuck in first, Anthropic's cheapest AI, Haiku, edges past it
   too, and the lift shows the gears big and the badges small. "Changing
   gear beat a new badge" reads in one look, and the little car passing the
   big one makes it funny.
3. **"If Opus 5.5 thinks as hard as it can" (B33 to B33b, about 5:06 to
   5:23): the fuel gauge against the speedometer.** Krish's ask: "and
   visualize this problem really well in post". The cost problem in one
   look: the same car on the same trip, a tank emptying about eleven times
   faster beside a needle that climbs only about a third further. Both dials
   are drawn to the true ratios, so the picture is the proof. It is drawn,
   so it is cheap to build and raises no licensing question, but the timing
   must be exact: the fuel falls on "eleven times", the speed stops on "a
   third", and the pair holds long enough to read.
4. **"Think what each part of the car is worth" (B45 to B50, about 6:57 to
   7:37): the X-ray car.** The motive, and the most surprising evidence: the
   headline scores are top gear while the app starts lower. "The badge
   brings attention" and "The gears decide the bill" on one car, after a
   2-second return of the car key, then their logos reaching for the gear
   knob, land the thesis of the piece.
5. **"This January, OpenAI made ChatGPT think for less time." (B56, about
   8:24): the silent downshift.** After about 20 gear changes with a sound,
   this one has none, and the label never moves. "You can't see it" is felt
   rather than told. Cheap to build, but it needs exact timing and a sound
   pass. It is strongest with treatment A; without A, the music dip and the
   held label still carry it.
6. **"Formula 1 found a better way decades ago, called a semi-automatic."
   (B63 to B65, about 9:32 to 10:03): the paddles, and the dash docking under
   the answer.** The payoff of the whole system: the corner readout viewers
   have watched since 3:46 turns out to be the thing Krish is asking for. The
   F1 wheel is also the most exciting picture in the film: find the best
   cleared photograph with no team, sponsor or F1 mark readable, or draw it
   well.

Sally is the seventh thing to spend on, built once as a set and reused six
times.

## Sourcing: the shopping list

Krish, 16 October: "we need to avoid licensing risks but be clear". So every
picture in this film is one of five things: a cleared photograph or clip, an
official logo file, a screenshot of a public page, a capture of Krish's own
app, or a house-style drawing. Nothing else goes on screen.

**Long video only.** Krish, 16 October: "only in the long video though".
Everything under "Car logos and car pictures" below (the BMW and Audi logos,
the ChatGPT and Claude marks as used beside the cars, and the X3 and Q5
pictures, the Q5's front badge among them) goes into the long video and
nowhere else. The 90-second video keeps its own pictures and carries no car
logos or car photographs: none of these files is cued in its edit, packed
with it or declared on it.

### The clearance rule (every photograph and clip)

- **Cleared** means a licence that clearly allows commercial use in a
  monetised video, and nothing else: public domain, CC0, the Pexels licence
  or the Unsplash licence. Pexels: "All photos and videos on Pexels are free
  to use" and "Attribution is not required" (pexels.com/license, read 16
  October 2026). Unsplash: free to use "for commercial and noncommercial
  purposes" with "No permission needed" (unsplash.com/license, read 16
  October 2026). Only the free Unsplash licence counts: Unsplash+ images
  sit in the same search under a different licence, so skip them.
- **Not cleared**, so not used: press-site photographs and footage (BMW
  Group PressClub, Audi MediaCenter) unless written permission for this
  video is on file; anything marked "editorial use only"; Creative Commons
  licences with NC, ND or SA terms; anything on Wikimedia Commons not marked
  public domain or CC0; broadcast footage. Audi says its MediaCenter content
  is "freely accessible and free of charge for press purposes and personal
  use" (audi.com/en/service-2305, read 16 October 2026) and "generally
  license-free for editorial and private purposes" (audi.com/en/help-faq-3696);
  BMW Group PressClub offers its material to the press. Neither clearly
  covers a monetised video, so neither is used without that written
  permission.
- **What a free licence does not cover.** Pexels and Unsplash license the
  photograph, not the brand in it. Pexels says so plainly: "Don't imply
  endorsement of your product by people or brands on the imagery." So a car
  in a cleared photograph is there only to show which car the script names,
  never as an endorsement, and the description carries the line below.
- **Where nothing clears**, the picture is drawn in the house style, and a
  car is named in text beside it ("BMW X3"). A drawing is a plain car of
  that shape, not a tracing of the real one, and never carries a logo.
- **Record for each**, in the post's evidence the way `pileup` records its
  pages: the library or archive, the image or clip id and URL, the
  photographer or creator, the licence as named on the page, the date read
  and downloaded, and the file's sha256. Credit the photographer in the
  description where the licence asks (none of the four requires it; it is
  appreciated).
- Real photographs and footage only: never AI-generated, never a computer
  render passed off as a photograph, and never edited (no badge swapped, no
  plate blurred: choose or crop frames in which no number plate or
  speedometer figure is readable).

**For the long video's description**, word for word:

> Car brand names and logos are used only to explain an analogy. This video is not affiliated with or endorsed by BMW, Audi or any carmaker.

### Car logos and car pictures (long video only)

**Logos.** Official files only, by the house route: Brandfetch, by the
company's domain, as `config/logo-registry.json` names each company's domain,
and as this folder's `logos/` already holds OpenAI's, Anthropic's and
Google's (and Wednesday's folder, `2026-10-14-wednesday/logos/`, holds the
logos fetched from Brandfetch for that piece). Save each as SVG beside them,
so the renderer and the cover drawer read it from this plan folder.

| Logo | Brandfetch domain | File to save | Used at |
|---|---|---|---|
| BMW, the roundel | bmw.com (Brandfetch serves its logo as SVG; looked up 16 October) | `logos/bmw.svg` | B28, B29 |
| Audi, the four rings | audi.com (a verified listing; looked up 16 October) | `logos/audi.svg` | B28, B29 |
| ChatGPT, the app mark | chatgpt.com (a verified listing) | `logos/chatgpt-mark.svg` | B26, the key |
| Claude, the app mark | claude.ai (a verified listing) | `logos/claude-mark.svg` | B26, the key |

- Use each maker's own file as it comes: its own colours, or the light
  version the maker made for dark backgrounds where Brandfetch serves one.
  Where a full-colour logo would not read on the ink (the BMW roundel's black
  ring), set it whole on a plain cream plate; the plate is a background and
  the logo is untouched. Never redraw, trace, alter, recolour (not even to
  the house cream), crop into a new shape, add an effect to, or combine a
  logo with another mark. Where two logos share a frame they stand apart,
  each with its own clear space.
- Used only to say whose car or app is on screen: never as decoration,
  never on a drawn car, never on the thumbnail, the cover or a card outside
  the long video's edit.
- Record for each logo: the Brandfetch domain, the file's URL as served, the
  date fetched and its sha256. If the session cannot reach
  `*.brandfetch.io`, the Brandfetch connector's `bf://asset/<domain>/logo`
  resource gives the same bytes.
- **The visual gate.** BMW and Audi are not companies in
  `config/logo-registry.json`, and must not be added there as things stand:
  the gate would then demand their logos on every packed video, the
  90-second one included, against "only in the long video though". Declare
  BMW and Audi in the long video's `"logos"` list in `post.json` only (the
  list of what its edit put on screen); the 90-second video's list never
  names them. If a gate check on them is wanted later, the registry first
  needs a long-video-only mark, which is an engine change, not made here.
  ChatGPT and Claude already count as OpenAI and Anthropic in the registry.

**Car pictures.** Cleared photographs where they exist; otherwise drawn,
with the car named in text. No press-site photographs.

| Picture | Row | Search for | If none clears |
|---|---|---|---|
| Audi Q5, close on the badge on its grille | B24 | "Audi Q5 front grille" | a plain drawn car front, its badge plate lit, no logo, no make named |
| BMW X3, straight-on front, its badge readable | B28, B29 | "BMW X3 front" | a drawn plain car of that shape, "BMW X3" in text |
| Audi Q5, straight-on front, matched to the X3 | B28, B29 | "Audi Q5 front" | a drawn plain car of that shape, "Audi Q5" in text |

Search Pexels and Unsplash first, then Wikimedia Commons filtered to public
domain and CC0. A car in a cleared photograph must be the model named
(check the badge or the photographer's caption), and no person in frame may
be identifiable.

### Car parts and other photographs (cleared or drawn)

Generic car parts need no brand. Each is a cleared photograph that shows no
carmaker's, team's or sponsor's mark (see "Three transmissions"), recorded as
above, or else drawn.

| Picture | Row | Search for |
|---|---|---|
| Manual gearstick, H pattern, numbers readable on the knob; with and without a hand on it; in a low gear and in a high gear (B27's two cells) | B25 to B27, B43, B49, B50, B60, B66 | "manual gear stick H pattern knob close up", "hand on manual gear shift" |
| The three pedals of a manual car, the clutch on the left; a foot on the clutch | B26, B66 | "manual car pedals clutch", "foot on clutch pedal" |
| Automatic selector, P R N D readable, close up, in D | B40, B50, B54, B66, B68 | "automatic gear selector PRND close up" |
| F1 steering wheel with its paddles clearly visible, and a close-up from behind of one paddle | B63, B64, B66, B69 | "Formula 1 steering wheel paddle shifters", "racing steering wheel paddles" |
| Optional: a clip of a hand flicking a paddle | B63 | "paddle shift close up" (Pexels videos); never broadcast footage |
| Gearbox cutaway | B29 | "gearbox cutaway", "transmission cutaway" (Wikimedia Commons, public domain or CC0 only) |
| Data centre aisle, no company's name or logo in frame | B33 | "data centre server racks aisle" |

An F1 wheel almost always carries a team's or sponsor's marks, so expect to
draw it unless a cleared photograph shows none readable; never an F1 logo as
a graphic.

### Screenshots of named public pages

Capture live, record URL and date, crop to the sentence that carries the
point, highlight in coral, never edit the page.

| Row | Page | What to frame |
|---|---|---|
| B03, B11, B47 | anthropic.com/claude-opus-5-5 | the title (B03, B11); a chart's bars and title with no values (B03); the footnote "all Claude Opus 5.5 results use adaptive thinking at max effort" (B47) |
| B03 | OpenAI's GPT-5 launch livestream page on YouTube (August 2025) | the player and title |
| B11 | anthropic.com/news/claude-opus-4-8; the Opus 5 launch page (from the piece's filed sources) | title |
| B12 | openai.com/index/gpt-5-1/; the GPT-6.1 launch page (from the filed sources) | title |
| B14 | openai.com/index/introducing-4o-image-generation/ | title |
| B14, B15 | x.com/sama/status/1906771292390666325 | "we added one million users in the last hour." and the date |
| B15 | openai.com/index/march-funding-updates/ | the date and the $40 billion sentence |
| B30 | artificialanalysis.ai/models/claude-opus-5-5 | the page header for Opus 5.5 only; its score sentence, and those on /models/claude-opus-5-5-low and /models/claude-opus-5, are filed as sources and never shown, because the script says no scores |
| B31 | arxiv.org/abs/2412.21187 | the title |
| B37 | x.com/sama/status/1876104315296968813; openai.com/index/introducing-chatgpt-pro/ | the post; the price line |
| B40 | support.google.com/gemini/answer/17004136; 9to5google.com/2026/10/09/gemini-auto-free-users/ | "Auto will be the default setting for users without a Google AI plan."; the headline and date |
| B42 | wired.com/story/openai-router-relaunch-gpt-5-sam-altman/ | the sentence about free users and cost |
| B43, B56 | help.openai.com/en/articles/6825453-chatgpt-release-notes | the 14 September 2026 entry (B43); the thinking-time entry, dates cropped out (B56) |
| B47 | platform.claude.com/docs/en/build-with-claude/effort | "Claude Opus 5.5 and Claude Haiku 5.5 default to medium" |
| B52 | x.com/sama/status/1954603417252532479 | "for free users we went from <1% to 7%" only |
| B53 | anthropic.com/engineering/april-23-postmortem | "we changed Claude Code's default reasoning effort from high to medium" |
| B08, B61 backups | help.openai.com/en/articles/20001354; support.claude.com/en/articles/8664678 | the lines that list the levels |

### Captures (Krish's own apps)

The Claude effort menu open, ChatGPT's picker with its thinking levels, and
Gemini's effort setting (B08, B21, B25, B61), recorded on his own accounts,
with the date.

### Drawn in the house style

The drawn car front and badges (B04, B05, B09, B30), the drawn "Opus 5.5"
badge with its "Illustration" label (B24), the car key (B23 to B29, B45),
the three-question card (B06), the verdict chips (B10), the split-flap badge
(B12), Sally's set (S1 to S6), the thinking notebook (B22, B27), the
first-gear map (B29a), the rev counter (B30, B68), the three cars on the road
(B30 to B30b), the 2 + 3 stack (B31), the fuel gauge and speedometer dashboard
(B33 to B33b, and its gauge again at B62), the meter (B35, B36, B48), the
X-ray car (B45 to B48), the 100-dot grid (B52), the timeline stamps (B41),
the statement card (B54), the silent dash (B56), the answer mock with
paddles (B65), the banned stamp (B64), the call card (B68), the dash and the
chapter cards throughout. And, wherever no cleared photograph exists, the
fallbacks: the Q5's front (B24), the X3 and Q5 named in text (B28, B29),
and any car part (the gearstick, clutch, selector, cutaway and F1 wheel). No
drawn car carries a maker's logo.

### Logos

`logos/openai-symbol-cream.svg`, `logos/anthropic-symbol-cream.svg`,
`logos/google-cream.svg`. Declare OpenAI, Anthropic and Google on the packed
video for the visual gate. For the long video only, also `logos/bmw.svg`,
`logos/audi.svg`, `logos/chatgpt-mark.svg` and `logos/claude-mark.svg`,
fetched as set out under "Car logos and car pictures" above; BMW and Audi
are declared on the long video alone.

## Numbers allowed on screen

Only these, because the script says them: Opus 4.8, Opus 5, Opus 5.5, Opus
5.56 (the joke, always with its "?"), GPT 5.1, GPT 6.1, May, July,
September, November, March 2025, 1 million in one hour, $40 billion, 4
seconds, 6 months later, 2 + 3, 13 times, about 11x, about a
third, January 2025, $200 plan, 9 October, December, 2025, under 1 in 100,
7 in 100, 2004, June 2027, 85%, and the model names X3 and Q5. No test score is
on screen anywhere (Krish, 16 October: "What does 42 even mean?"): B30 to
B30b say the results as who beat whom, and the rev needle keeps the true
ratio with no number on it. The dials
have no numbers of their own (the fuel gauge only its E and F); B30 to B30b and
B33 to B33b show no scores or prices, though their drawings keep the true
ratios. A screenshot keeps any figure its cropped sentence holds,
and a photograph keeps what is on the thing itself (the lettering of the
Q5's badge, the numbers on a gear knob), but no number plate or speedometer
figure is in frame, and nothing points at a figure the script does not say.

## Before anything is built

1. Krish picks A, B and C (any, all or none). Build only what he picks.
2. `cover-facts.json` and `post.json` in this folder still carry the first
   angle ("OpenAI tried to pick your AI..."), and the story intro, the
   thumbnails and kit.py read them. They need the v5 angle and these picture
   ids before kit.py runs, or the story intro shows the old title and kit.py
   reports the new pictures as not cued.
3. Krish records the three captures on his own accounts (B08, B61).
4. Every photograph and clip is cleared (public domain, CC0, Pexels or
   Unsplash) with its source and licence recorded, or the row uses its
   drawing; no press-site picture is used unless written permission is on
   file. Every screenshot's URL and date are recorded. All of it before the
   pack is built (see "The clearance rule").
5. The car logos are fetched from Brandfetch into `logos/` and recorded,
   official and unaltered. Long video only.
6. The long video's description carries the no-affiliation line, word for
   word (under "The clearance rule"), with any photographer credits.
7. After the edit, check the visual gate (BMW and Audi declared on the long
   video's `logos` alone), the kit's readable floor at 16:9, and every
   on-screen number against the list above.
8. For the 90-second cut: build B30, B56 and B65 so their middle third also
   works at 9:16. None of them carries a car logo or a car photograph, and
   none may: Krish, 16 October, "only in the long video though".
