# Friday deep cut v5: the picture plan

Piece `904658db-4df2-4537-a0ed-ebe93e081db7`, mind.the.gap, Friday. Script:
`docs/plans/2026-10-09-script-deep-v5.md` (1,700 words, about 11 minutes 20
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
videos etc, to really bring clarity to life". The final script now spells the
car out, one pairing a sentence (¶15), and this plan puts each pairing on
screen as he says it (B23 to B28, and "What stands for what" below).

**Car logos and car photographs are for the long video only.** Krish, 16
October: "only in the long video though". The BMW and Audi logos, the
photographs of the BMW X3 and the Audi Q5, the photograph of the Q5's rear
badge and the driving footage in this plan go into the long video and nowhere
else. The 90-second video keeps its own pictures and carries no car logos or
car photographs; this plan does not set its pictures. The three rows this plan
lets the 90-second cut reuse (B30, B56 and B65, see the last list) carry
neither.

Status: a plan, not yet built. Three treatments (A, B and C below) wait on
Krish's pick; his notes say to propose them and build only the ones he picks.
Every row works without them, and says what it falls back to.

## How to read this

- One row per beat, in script order, written as a block. Every one of the
  script's 38 paragraphs (marked ¶) has at least one row. Each row starts on
  the quoted words exactly as the script has them, so an editor can search
  the transcript for them. A row's picture runs until the next row's start
  words unless the row says otherwise. If Krish changes words on the take,
  the transcript wins and the row moves with it.
- The car sequence was re-cut for the final script. Its added rows carry a
  letter (B29a to B29c), so every other row keeps its number. B34 is gone:
  its line ("Who pays for that thinking...") was cut from the script, and its
  rest for Krish's face moves into B36.
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
  - **PHOTO**: a licensed real photograph (search terms given).
  - **FOOTAGE**: licensed real video of a real car, never generated (B28).
  - **SHOT**: a screenshot of the named public page, captured live, with its
    URL and capture date recorded the way `pileup` records its pages in
    `post.json`.
  - **CAPTURE**: Krish's own app, screen-recorded fresh on his own account.
  - **DRAWN**: house style, built in the renderer (`apps/renderer`, Remotion)
    or, for flat cards, `scripts/pages/video_card.py`.
  - **LOGO**: the real logo files in `logos/` (OpenAI, Anthropic, Google;
    for the long video also BMW and Audi, and the ChatGPT and Claude app
    marks), each from Brandfetch, never redrawn, recoloured or combined into
    a new mark.
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
   ear never have to reconcile two sentences.
4. **Every number drawn on screen is one the script says** (the list is near
   the end). No axis numbers, tick labels, totals or differences the script
   does not say: the rev counter's dial has no numbers on it, only the needle
   values. Screenshots are real pages and are never edited: crop each to the
   sentence that carries the point, and crop out figures the script does not
   say wherever the crop allows.
5. **Real or drawn, never faked.** Photographs are licensed real
   photographs. Anything else is drawn flat in the house style, so nobody
   could take it for a photo. No AI-generated pictures in this cut, and no
   AI-generated cars or logos above all: every car is a real photograph or
   real footage, from the maker's press site or a licensed library, and never
   a computer render passed off as a photograph. No AI badge pasted onto a
   photo of a real car: the one drawn badge beside a real one (B26) sits
   beside the photograph, flat and labelled as a drawing. No copy of a real app's screen:
   the one place we show what Krish is asking for (B65) is a house-drawn mock
   labelled as one. Sally is made up, and the script says so ("Picture a
   woman called Sally"), so she is always drawn, never a photo or a stock
   model.
6. **The house look.** Ink background, cream words, the mind.the.gap coral
   (`#FF6A4D`, from `config/studio.json`) for the subject, mint only for the
   answer (the advice in chapter 7 and the call). Anton for headlines,
   Archivo for words, IBM Plex Mono for labels, sources and the dash. No card
   kicker uses "money" or "hood" (video_card.py refuses another series'
   words in a kicker), and every video_card.py card carries a real logo.
7. **Real logos** (house rule VISUAL_EVIDENCE): OpenAI, Anthropic and Google
   wherever a row names them, declared on the packed video for the visual
   gate. In the long video only, BMW and Audi wherever the car rows name
   them, and the ChatGPT and Claude app marks where the car stands for the
   app. A logo is never redrawn, recoloured or combined into a new mark:
   in "OpenAI = BMW" the two logos stand apart, each whole with its own clear
   space, and the "=" sits between them.
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
   names the pairing in six words or fewer ("OpenAI = BMW"). Each complete
   pairing stays readable for at least 2.5 seconds before it moves on.

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
licensed sound effect, logged with the music; the music ledger
(`config/music-library.json`) holds no effects yet. No sound ripped from F1
broadcasts.

**B. The dash: which gear it picked.** A small readout in the top right
corner, like the display on a racing steering wheel: on the left a badge chip
with the model's name (Archivo, muted, small); on the right the gear as a
big word in IBM Plex Mono Bold, coral (mint in chapter 7 and for the call).
States: `1st`, `LOW`, `MID`, `HIGH`, `TOP`, `AUTO`, `EXTENDED`, `?`. About
380 by 150 px, 64 px in from the top and right edges, on ink_soft
(`#16221D`) with a cream line. It first appears at B27 ("And how hard it
thinks is the gear.") and after that shows only when an example on screen ran in a
gear the script or its source names (the gear log below). It pays off at B65:
when Krish says "show us which gear it picked, under every answer", viewers
have watched the video do exactly that for six minutes, so the ask lands as
something they already want. Without B: the gear shows only inside the full
pictures, and B65 introduces the readout fresh.

**C. The rev needle.** A drawn rev counter, an arc with no numbers printed on
it, whose needle carries the script's numbers: 42, 58 and 51 (B30), the cost
pushing into the red (B33) and 85% for the call (B68). As a transition, a
needle sweep wipes each chapter card in. A number you watch move is a number
you remember. Without C: a video_card.py `bars` card with the same three
numbers at B30, the coin stacks alone at B33, the house call meter at B68,
and hard cuts into the chapter cards.

## The running visual system

### 1. What stands for what: the car key (long video only)

The script spells the analogy out in ¶15, one pairing a sentence, and the
screen does the same, one pairing at a time, in the order he says them:

| Row | He says | The AI side | The car side | On screen |
|---|---|---|---|---|
| B24 | "OpenAI and Anthropic are the carmakers, like BMW and Audi." | the OpenAI and Anthropic logos | the BMW and Audi logos | "OpenAI = BMW", "Anthropic = Audi" |
| B25 | "ChatGPT and Claude are the cars they make." | the ChatGPT and Claude app marks | photographs of a BMW X3 and an Audi Q5 | "ChatGPT = the car", "Claude = the car" |
| B26 | "The version, like Opus 5.5, is the badge on the back." | a drawn "Opus 5.5" badge, labelled as a drawing | a photograph of the Q5's badge on its tailgate | "Opus 5.5 = the badge" |
| B27 | "And how hard it thinks is the gear." | Krish's own effort menu (the B08 capture) | a photograph of a gearstick | "Thinking = the gear" |

- **One side each, always.** OpenAI, ChatGPT, BMW and the X3 on the left;
  Anthropic, Claude, Audi and the Q5 on the right; the AI side above, the car
  side below. Opus 5.5 is Claude's version, so its badge is the Q5's.
- **The key.** At B23 an empty key slides in: four rows, each an "=" with a
  space either side, under "What stands for what". From B24 the key sits as
  a narrow strip down the left edge of the frame. Each pairing grows out of
  its row to fill the frame for its line, then shrinks back into its row, so
  the strip fills one row at a time. By "the gear" all four rows sit on
  screen together, and they stay there through B28.
- **Long enough to read.** In each pairing the AI side lands on the AI words
  and the car side on the car words ("the carmakers", "the cars they make",
  "the badge on the back", "the gear"). The complete pairing then holds full
  frame for at least 2.5 seconds before the next one starts. Where Krish's
  take runs faster, the next pairing waits for it, up to one second behind
  his words, never ahead of them. After that, each pairing stays readable in
  the strip.
- **It comes back once**, full frame for 2 seconds, at B45 ("Think what each
  part of the car is worth"), with the badge and gear rows lit, so "the
  badge" and "the gear" mean what they meant at ¶15 before the X-ray car
  uses them.

Then the transmissions, each a real photograph on the line that names it:

| Row | He says | On screen |
|---|---|---|
| B29 | "a car with a manual transmission" | a real H-pattern gearstick and a real clutch pedal |
| B40 | "like a car with an automatic transmission" | a real P R N D selector |
| B63 | "called a semi-automatic" | a real F1 steering wheel with its paddles |
| B66 | "a car with a manual transmission" and "still choose a manual transmission" | the manual again, then all three side by side |

### 2. Three transmissions, three acts

The film moves through three real gearboxes, always as licensed photographs,
each named by the script as a transmission:

- **The manual transmission (an H-pattern stick and a clutch pedal)**: today.
  The gearstick first stands beside the real settings menu at B27 ("is the
  gear"); the script names the manual transmission at B29; it runs to B39.
- **The automatic transmission (a P R N D selector)**: what's coming. From
  B40, where it pushes the manual stick off the frame ("The next step is the
  AI choosing the gear for you"), and named on "like a car with an automatic
  transmission".
- **The semi-automatic (the F1 steering wheel with paddles)**: the better
  way. From B63 ("called a semi-automatic").

B66 puts all three side by side as the close lands. A real gearbox cutaway
photograph is the "beneath" picture (B29b), and the X-ray car (B45 to B48) is
its drawn cousin. Pick gearstick, clutch, selector and cutaway photographs
that show no carmaker's logo, and an F1 wheel whose team and sponsor marks are
small: the only carmakers on screen are BMW and Audi, at the rows where the
script names them, so no other maker gets paired with an AI by accident (the
selector at the Gemini line above all).

### 3. The dash

See treatment B. The rule that keeps it honest: it never shows a gear the
script or its filed source does not name.

**The gear log** (every state the dash shows):

| Row | Badge chip | Gear shown | What says so |
|---|---|---|---|
| B28 | none | 1st, then TOP | "In the AI's lowest gear, it barely thinks. In its top gear, it thinks hardest." |
| B29c | none | 1st | "most of us drive everywhere in first gear all the time" |
| B30 | Opus 5.5, then Opus 5 | LOW, TOP, TOP | Artificial Analysis pages; "trying its hardest" |
| B32 | Sally's deal; 2 + 3 | 1st to HIGH; TOP | "matters most on hard jobs"; "extra thinking is wasted" |
| B33 | Opus 5.5 | LOW, then TOP | "thinks as hard as it can ... thinking a little" |
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
  the tailgate of a drawn car, seen from behind (the script puts the badge
  "on the back"), never photoreal. "Opus 4.8", "Opus 5", "Opus 5.5", the
  joke "Opus 5.56?" (with a coral "?" stamp so it can never read as real),
  "GPT 5.1" and "GPT 6.1". The drawn car carries no maker's logo.
- **The real badge on the back** (PHOTO, long video only): the Audi Q5's
  badge on its tailgate, beside the drawn "Opus 5.5" in the same chrome
  lettering style, never on it (B26).
- **The novice compares cars** (PHOTO, long video only): the BMW X3 and Audi
  Q5 fronts, with the ChatGPT and Claude marks above them, so the argument
  reads as ChatGPT versus Claude (B29a).
- **The pro looks beneath** (PHOTO): the cars slide apart to a real gearbox
  cutaway (B29b). On screen it is "looks beneath", never "under the hood"
  (another series' name).
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
| 4 | 4 | What thinking costs them | "Every word of that hidden" |
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
B21, B30, B32, B43, B50, B55, B58, B62, B68 and B69, and he shares the frame
(SPLIT) at B23, B29 and B36.

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
- Screen: FULL. A drawn car's tailgate, seen from behind (the badge is on the
  back, as the script says at B26). The badge "Opus 4.8" sits on it; "Opus 5"
  knocks it off; "Opus 5.5" knocks that off. Anthropic logo small, top left.
- Text: the badges themselves.
- Move: each badge drops on its word [A: a clack per badge].
- Source: DRAWN, LOGO Anthropic.

**B05 · ¶2 · 0:24 · "At this rate, when's Opus 5.56 coming out?"** `fri-05-badge-joke`
- Point: the joke: the numbers are getting silly.
- Screen: the same tailgate; a fourth badge, "Opus 5.56", squeezes in, too
  long for the tailgate, wonky, with a coral "?" stamp. Then PUNCH on Krish for the
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

**B07 · ¶4 · 0:52 · "Some of the new AIs are better."**
- Point: the concession, then the claim: the name is the least important
  thing on your screen.
- Screen: FACE ALONE (rest). PUNCH on "the least important thing on your
  screen."
- Text: none.
- Move: hold.
- Source: none.

**B08 · ¶5 · 1:04 · "There's a setting that changes your answer much more."** `fri-08-the-setting`
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

**B09 · ¶5 · 1:16 · "There are a few reasons OpenAI and Anthropic would rather you look at the name."** `fri-09-eyes-on-badge`
- Point: they want your eyes on the name.
- Screen: SPLIT. The Opus 5.5 badge on its drawn tailgate, lit by a spotlight; the
  settings menu from B08 beside it, dimmed. OpenAI and Anthropic logos above.
- Text: "Look at the name"
- Move: the spotlight swings onto the badge on "look at the name"; cut to
  FACE on "Let's unpack them."
- Source: DRAWN, CAPTURE (reused), LOGO.

**B10 · ¶6 · 1:23 · "And I think the AI itself will end up deciding how hard it thinks."** `fri-10-three-verdicts`
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

**B11 · ¶7 · 1:45 · "First, the names. Anthropic makes Claude."** `fri-11-opus-pile`
- Point: three Opus names in five months.
- Screen: FULL. The pile-up, as in the article: Anthropic's real launch pages
  land one on another, each with its month under it: Opus 4.8 (May), Opus 5
  (July), Opus 5.5 (September).
- Text: "May", "July", "September", one under each page.
- Move: each page drops on its month.
- Source: SHOT anthropic.com/news/claude-opus-4-8; the Opus 5 launch page
  (July 2026, from the piece's filed sources); anthropic.com/claude-opus-5-5.
  Crop each to its title. LOGO Anthropic.

**B12 · ¶7 · 1:53 · "OpenAI makes ChatGPT. It went from GPT 5.1"** `fri-12-gpt-flip`
- Point: OpenAI's names climb just as fast.
- Screen: FULL. A split-flap badge flips straight from "GPT 5.1" to "GPT 6.1"
  (a straight flip: a rolling counter would show names the script does not
  say), over the two real launch pages.
- Text: "GPT 5.1" then "GPT 6.1".
- Move: the flip lands on "to GPT 6.1".
- Source: SHOT openai.com/index/gpt-5-1/ (November 2025) and OpenAI's GPT-6.1
  launch page (end of September 2026, from the piece's filed sources). DRAWN
  flip. LOGO OpenAI.

**B13 · ¶8 · 2:00 · "Why so many? This bit is my own opinion."**
- Point: what follows is his view.
- Screen: FACE ALONE (rest). PUNCH on "my own opinion".
- Text: none.
- Move: hold.
- Source: none.

**B14 · ¶9 · 2:07 · "In March 2025, OpenAI added a new picture maker"** `fri-14-million-an-hour`
- Point: a launch brings a rush of people.
- Screen: FULL. OpenAI's picture-maker launch page (title only), then Altman's
  post on X with "we added one million users in the last hour." highlighted.
- Text: "1 million in one hour"
- Move: cut to the post on "a million new people"; the highlighter sweeps on
  "in one hour".
- Source: SHOT openai.com/index/introducing-4o-image-generation/; SHOT
  x.com/sama/status/1906771292390666325. LOGO OpenAI.

**B15 · ¶9 · 2:17 · "That same day, OpenAI said investors"** `fri-15-same-day`
- Point: the big money news landed on the same big day.
- Screen: FULL. Two pages side by side: Altman's post (left) and OpenAI's
  funding page (right), their dates lined up under one coral bracket.
- Text: "Same day: $40 billion"
- Move: the right page slides in on "That same day"; "$40 billion" lands on
  "forty billion dollars".
- Source: SHOT openai.com/index/march-funding-updates/ (cropped to its date
  and the sentence with the $40 billion). LOGO OpenAI.

**B16 · ¶9 · 2:22 · "Announcing it on such a big day made OpenAI look even better."**
- Point: the money was not caused by the launch; the timing made OpenAI look
  better.
- Screen: FACE ALONE (rest). PUNCH on "look even better."
- Text: none.
- Move: hold.
- Source: none.

### Chapter 3. The gear that matters

**Card 3** lands before "So what does matter?" (three lights).

**B17 · ¶10 · 2:31 · "So what does matter? Picture a woman called Sally."** `fri-17-sally-shop`
- Point: meet Sally, about to sign a deal with a supplier. (Sally S1.)
- Screen: FULL. The drawn shop front, Sally at her counter, the supplier's
  deal on the counter, the supplier's van outside.
- Text: "Sally" (name label, first visit only).
- Move: a slow push into the drawing from "Picture".
- Source: DRAWN.

**B18 · ¶10 · 2:42 · "She pastes the deal into her AI app"** `fri-18-sally-four-seconds`
- Point: she asks her AI, gets a fast, sure answer, and signs.
- Screen: FULL. Her laptop; the deal pasted in; a timer counts to 4 seconds;
  a tidy answer appears with a confident tick; her pen signs. The answer box
  is a neutral house drawing, not ChatGPT's or Claude's screen.
- Text: "4 seconds"
- Move: the timer runs in time with his words; a hard cut on the pen stroke
  at "She signs."
- Source: DRAWN.

**B19 · ¶11 · 2:53 · "Six months later, she finds one small rule"** `fri-19-sally-hidden-rule`
- Point: one hidden rule cost her, and a careful reader would have spotted
  it. (Sally S2.)
- Screen: FULL. A page flips to "6 months later"; a magnifier slides over the
  small print; one line glows coral; the till drawer slides open, empty. On
  "A careful reader would have spotted it." a red pen circles the line.
- Text: "6 months later"
- Move: the magnifier lands on "one small rule"; the pen circles on "careful
  reader".
- Source: DRAWN. No sum of money: the script gives none.

**B20 · ¶12 · 3:04 · "Nothing was wrong with the name on her screen."** `fri-20-sally-never-thought`
- Point: the name was fine; the thinking was missing. (Sally S3.)
- Screen: FULL. Her screen: the model name gets a cream tick; beside it a
  house-drawn thinking control sits at its lowest notch and pulses coral on
  "never stopped to think". Sally's face as she realises.
- Text: "It never stopped to think"
- Move: the tick on "the name"; the pulse on "never stopped"; hold on her
  face on "didn't realise".
- Source: DRAWN.

**B21 · ¶13 · 3:14 · "ChatGPT and Claude both let you choose how hard the AI thinks."**
- Point: you can choose today, maybe not for long.
- Screen: SPLIT: the two real menus from B08 with their logos. Then FACE,
  PUNCH on "For now." (a hard step in, the wry beat).
- Text: none.
- Move: [A] a clack on "For now."
- Source: CAPTURE (reused), LOGO OpenAI, Anthropic.

**B22 · ¶14 · 3:20 · "I looked up what thinking means."** `fri-22-thinking-notebook`
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
  comes back in B28.
- Source: DRAWN.

**B23 · ¶15 · 0:00 · "Think of a car. Here's what stands for what."** `fri-23-what-stands-for-what` (strongest moment 1)
- Point: a car is coming, with a key: each thing on the AI side has its
  thing on the car side.
- Screen: SPLIT. Krish in the left third. On the right the empty key slides
  in on "Think of a car": four blank rows, each an "=" with a space either
  side, the AI side headed "AI" and the car side headed "Car". The rows
  pulse once on "what stands for what". (The key is described under "What
  stands for what" above.)
- Text: "What stands for what", "AI", "Car".
- Move: the slide; PUNCH on "Here's what stands for what."
- Source: DRAWN. Long video only: it is the frame the car logos fill.

**B24 · ¶15 · 0:00 · "OpenAI and Anthropic are the carmakers, like BMW and Audi."** `fri-24-carmakers` (strongest moment 1)
- Point: the AI companies are the carmakers: OpenAI is BMW, Anthropic is
  Audi.
- Screen: FULL, two columns, grown out of the key's first row. Left: the
  OpenAI logo above, the BMW logo below, an "=" between. Right: the Anthropic
  logo above, the Audi logo below, an "=" between. The OpenAI and Anthropic
  logos land on "OpenAI and Anthropic"; the BMW and Audi logos land on "the
  carmakers", and a coral ring draws round each as he names it ("like BMW
  and Audi"). The complete pairing holds at least 2.5 seconds, then shrinks
  into the key's first row on the left edge.
- Text: "The carmakers", "OpenAI = BMW", "Anthropic = Audi".
- Move: each logo lands on its words; hold.
- Source: LOGO OpenAI, Anthropic, BMW, Audi (each whole, with its own clear
  space, never combined, never recoloured). Long video only.

**B25 · ¶15 · 0:00 · "ChatGPT and Claude are the cars they make."** `fri-25-the-cars`
- Point: the apps are the cars: ChatGPT is a BMW X3, Claude is an Audi Q5.
- Screen: FULL, the same two columns, grown out of the key's second row.
  Left: the ChatGPT app mark above, a real photograph of a BMW X3 below (a
  three-quarter front view of the whole car, the BMW roundel on its nose).
  Right: the Claude app mark above, a real photograph of an Audi Q5 below
  (the same angle, the four rings on its grille). The small OpenAI and
  Anthropic logos sit over their columns, so maker and car read together.
  The marks land on "ChatGPT and Claude"; the cars roll in on "the cars they
  make". The marks sit beside the photographs, never on them. Hold at least
  2.5 seconds, then shrink into the second row.
- Text: "ChatGPT = the car", "Claude = the car".
- Move: each car slides in from its own side (a slide only: the photograph
  is never stretched or distorted).
- Source: LOGO ChatGPT and Claude app marks; PHOTO BMW X3 (BMW Group
  PressClub); PHOTO Audi Q5 (Audi MediaCenter). Long video only.

**B26 · ¶15 · 0:00 · "The version, like Opus 5.5, is the badge on the back."** `fri-26-badge-on-the-back`
- Point: the version, like Opus 5.5, is only the badge on the back of the
  car.
- Screen: FULL, the right column only (Opus 5.5 is Claude's version, so its
  car is the Q5), grown out of the key's third row. On "Opus 5.5" a drawn
  "Opus 5.5" badge lands above: flat chrome lettering in Archivo, the size,
  weight and spacing of a real tailgate badge, on ink, with a small IBM Plex
  Mono label under it, "Illustration", so nobody takes it for a real badge.
  On "the badge on the back" a real photograph of the Audi Q5's tailgate,
  close on its badge, lands below, with the "=" between. The drawn badge is
  never put on the photograph, and the photograph is never edited. Hold at
  least 2.5 seconds, then shrink into the third row.
- Text: "Opus 5.5 = the badge", "Illustration".
- Move: a slow push into the real badge; hold.
- Source: DRAWN badge (the same badge as B04, which is why B04's badges sit
  on a drawn tailgate); PHOTO the Audi Q5's rear badge (Audi MediaCenter).
  Long video only.

**B27 · ¶15 · 0:00 · "And how hard it thinks is the gear."** `fri-27-the-gear` (strongest moment 1)
- Point: how hard it thinks is the gear, and the setting you saw at B08 is
  the gearstick.
- Screen: FULL, grown out of the key's fourth row. Above: Krish's own effort
  menu from B08, the coral ring on its current level, landing on "how hard
  it thinks". Below: a real photograph of a gearstick, its knob's gear
  numbers readable, landing on "the gear", with a coral line drawn from the
  ringed level to the stick. [B] The dash appears for the first time, empty.
  Hold at least 2.5 seconds, then shrink into the fourth row: the key is
  complete, and stays on the left edge through B28.
- Text: "Thinking = the gear".
- Move: [A] clack as the photograph lands on "the gear".
- Source: CAPTURE (reused from B08); PHOTO gearstick.

**B28 · ¶15 · 0:00 · "In first gear, a car crawls."** `fri-28-crawl-to-top-speed`
- Point: in first gear a car crawls and in top gear it flies; in its lowest
  gear the AI barely thinks, and in its top gear it thinks hardest.
- Screen: FULL, a grid of four that builds one cell a sentence, the car on
  top and the AI under it, so each gear lines up with its AI gear:
  - Top left, on "In first gear, a car crawls.": real footage of the Q5
    creeping through town at walking pace, the gearstick photograph inset in
    first.
  - Top right, on "In top gear, it reaches its top speed.": real footage of
    the same car at speed on an open road, the inset in top gear. One car in
    both gears, as B30 tests one Claude in different gears.
  - Bottom left, on "In the AI's lowest gear, it barely thinks.": the B22
    notebook with one line of working. [B] Dash `1st`.
  - Bottom right, on "In its top gear, it thinks hardest.": the notebook
    full. [B] Dash `TOP`.
  The key stays on the left edge, then folds away as the grid ends.
- Text: "First gear: a crawl", "Top gear: top speed", "AI's lowest gear:
  barely thinks", "AI's top gear: thinks hardest".
- Move: each cell lands on its sentence; [A] clack on "In top gear".
- Source: FOOTAGE of one real car, never generated: the maker's own press
  footage (Audi MediaCenter) or a licensed stock clip; two real photographs
  with real motion blur if no footage can be licensed. No speedometer figure
  and no number plate readable in frame. PHOTO gearstick (reused); DRAWN
  notebook. Long video only.

**B29 · ¶16 · 0:00 · "Right now, these apps are like a car with a manual transmission."** `fri-29-manual-transmission`
- Point: today's apps are a manual transmission: you change gear yourself.
- Screen: FULL. Act 1 of the transmissions: a real photograph of an
  H-pattern gearstick, then, still on this sentence, the three pedals in a
  manual car's footwell with the clutch pedal ringed in coral (the third
  pedal is what makes it a manual). Then SPLIT on "You change gear
  yourself.": Krish in the left third; on the right a hand moving the stick
  and a foot on the clutch.
- Text: "Today: a manual transmission", then "You change gear yourself".
- Move: hold; the split lands on "You change gear yourself."
- Source: PHOTO H-pattern gearstick; PHOTO clutch pedal; PHOTO hand and foot
  (one shot, or two side by side).

**B29a · ¶16 · 0:00 · "The novice argues about BMW's X3 versus Audi's Q5,"** `fri-29a-x3-q5`
- Point: the novice argues about which car, which here means which app.
- Screen: FULL. Real photographs of the BMW X3 and Audi Q5 fronts, straight
  on, matched in angle and as near in colour as the press galleries allow,
  "vs" between them. The ChatGPT and Claude marks sit small above their cars,
  as in the key, so the argument reads as ChatGPT versus Claude.
- Text: "BMW X3 vs Audi Q5".
- Move: each photograph slams in from its side on its name.
- Source: PHOTO BMW X3 front (BMW Group PressClub); PHOTO Audi Q5 front
  (Audi MediaCenter); LOGO ChatGPT, Claude. Long video only.

**B29b · ¶16 · 0:00 · "but the pro is looking at the gearbox beneath."** `fri-29b-cutaway`
- Point: the pro looks at what makes it drive: the gears, how hard it
  thinks.
- Screen: FULL. The two car photographs slide apart to reveal a real gearbox
  cutaway photograph; a coral ring on the gears.
- Text: "The pro looks beneath"
- Move: the reveal on "beneath" [A: clack].
- Source: PHOTO gearbox cutaway; the car photographs reused (long video
  only).

**B29c · ¶16 · 0:00 · "With AI, most of us drive everywhere in first gear all the time."** `fri-29c-everywhere-in-first`
- Point: most of us never leave first gear.
- Screen: FULL. A drawn road map; a little drawn car, with no maker's badge,
  crawls the whole route (motorway, town, a hill) while [B] the dash stays
  in first the whole way (without B, a small first-gear tag rides on the
  car). The joke is the point: nobody drives a motorway in first.
- Text: "Everywhere in first gear"
- Move: the scenes change under the car; the gear never does. Cut to FACE as
  the line ends, for B30's question.
- Source: DRAWN.

**B30 · ¶17 · 4:15 · "So how big is the difference in going up a gear?"** `fri-30-rev-counter` (strongest moment 2)
- Point: the same badge in a higher gear jumps further than a new badge does.
- Screen: FACE for the question (the return to his face after the car
  sequence). Then FULL from "A group called Artificial Analysis": first the
  Artificial Analysis page header for Claude Opus 5.5, then the rev counter
  [C] (an arc with no numbers printed on it; the needle carries each score):
  - "In a low gear, it scored 42": badge "Opus 5.5", dash LOW, needle to 42.
  - "In its top gear, 58.": dash TOP, the needle sweeps to 58, the biggest
    movement in the film so far.
  - "The older Opus 5, trying its hardest, only got 51.": the badge swaps to
    "Opus 5" in duller chrome, dash TOP, needle to 51. The 42 and 58 needles
    stay as ghosts.
  - "So changing gear beat getting a new badge.": two arrows under the dial:
    a long one, "Gear: 42 → 58", and a short one, "Badge: 51 → 58".
- Text: "42", "58", "51" at the needle tips; then "Changing gear beat a new
  badge". Source line under the dial: "Artificial Analysis".
- Move: [A] clack on "top gear"; the arrows draw on "changing gear" and "a
  new badge". Without C: a video_card.py `bars` card with the same three
  numbers and the same two arrows.
- Source: SHOT artificialanalysis.ai/models/claude-opus-5-5-low (the "scores
  42" sentence), /models/claude-opus-5-5 (58), /models/claude-opus-5 (51),
  each cropped to its sentence and ending before the median figure. LOGO
  Anthropic.

**B31 · ¶18 · 4:38 · "But more thinking isn't always better."** `fri-31-two-plus-three`
- Point: on an easy question, more thinking is waste.
- Screen: FULL. The paper's title page, then "2 + 3 = 5" written out again
  and again, stacking down the frame faster and faster, a counter beside it.
- Text: "2 + 3", then "13 times".
- Move: the stack stops dead at 13 on "thirteen times", with a thud.
- Source: SHOT arxiv.org/abs/2412.21187 (title: "Do NOT Think That Much for
  2+3=?"). DRAWN stack.

**B32 · ¶19 · 4:49 · "So the thinking gear matters most on hard jobs, like Sally's deal."** `fri-32-hard-easy`
- Point: gear up for hard jobs; on easy ones extra thinking is waste.
  (Sally S4.)
- Screen: SPLIT in two pictures: left, Sally's deal, the dash going from 1st
  to HIGH with a cream ✓; right, "2 + 3", the dash on TOP with a coral ✗.
  Then FACE, PUNCH on "But whose money is wasted?"
- Text: "Hard jobs: gear matters most", then "Easy questions: extra thinking wasted".
- Move: the punch is the hook into chapter 4.
- Source: DRAWN.

### Chapter 4. What thinking costs them

**Card 4** lands before "Every word of that hidden" (four lights).

**B33 · ¶20 · 4:59 · "Every word of that hidden working runs on huge computers,"** `fri-33-eleven-stacks`
- Point: thinking hard costs about 11 times as much as thinking a little.
- Screen: FULL. A photo of a data centre aisle, then a drawn pair: one stack
  of coins under "a little" (dash LOW), then eleven stacks under "as hard as
  it can" (dash TOP). [C] The needle pushes into the red as the stacks pop
  in.
- Text: "About 11x the cost"
- Move: the stacks pop in on "eleven times".
- Source: PHOTO data centre; DRAWN stacks. The cost figures behind it are on
  the Artificial Analysis pages and are not shown.

**B35 · ¶21 · 5:17 · "Businesses that put AI inside their own apps"** `fri-35-meter`
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

**B36 · ¶22 · 5:27 · "But most of us pay the same amount every month,"** `fri-36-meter-flips`
- Point: on a flat plan, the company pays for every extra thought.
- Screen: SPLIT, the return to his face in this chapter: Krish in the left
  third. On the right the meter swings across: your side now shows a flat
  ticket, "same every month"; the meter ticks on the OpenAI and Anthropic
  side.
- Text: "Same amount every month"
- Move: the swing lands on "Then OpenAI or Anthropic pays".
- Source: DRAWN, LOGO.

**B37 · ¶22 · 5:36 · "In January 2025, Sam Altman said OpenAI was losing money"** `fri-37-200-a-month`
- Point: even $200 a month did not cover the heaviest users.
- Screen: FULL. Altman's post on X: "insane thing: we are currently losing
  money on openai pro subscriptions!" (highlighted), then OpenAI's Pro launch
  page at its price.
- Text: "$200 a month, still losing money"
- Move: the highlighter on "losing money"; "$200 a month" lands on "two
  hundred dollars a month".
- Source: SHOT x.com/sama/status/1876104315296968813; SHOT
  openai.com/index/introducing-chatgpt-pro/ (cropped to the price line).
  LOGO OpenAI.

**B38 · ¶23 · 5:50 · "That, I think, is why the app starts you in a low gear."**
- Point: so the app starts you in a low gear (his reading, so his face).
- Screen: FACE ALONE (rest). PUNCH on "starts you in a low gear." With B,
  the dash shows LOW in the corner and nothing else is over him.
- Text: none.
- Move: hold. (The old split of a flat bill against a jumping cost went with
  its line, which the script cut; B36 carries the flat plan.)
- Source: none.

### Chapter 5. Who decides next

**Card 5** lands before "So who decides how hard" (five lights).

**B39 · ¶24 · 6:06 · "So who decides how hard your AI thinks?"** `fri-39-inside-one-gear`
- Point: even now, inside one gear, the AI decides how much to think.
- Screen: FACE for the question. Then [B] the dash shows a single gear slot
  with a small needle moving inside it, on "Right now, you do". Without B:
  a small full-frame version of the same drawing.
- Text: none.
- Move: hold.
- Source: DRAWN. The fact is in OpenAI's reasoning guide ("reason
  adaptively") and Anthropic's "Steering thinking" docs; not shown.

**B40 · ¶25 · 6:14 · "The next step is the AI choosing the gear for you, and Google has started."** `fri-40-gemini-auto`
- Point: Gemini's free app is now an automatic transmission: it picks the
  gear for you.
- Screen: FULL. The automatic selector photo (P R N D) pushes the manual stick
  off the frame: act 2 begins. Then Google's help page with "Auto will be the
  default setting for users without a Google AI plan." highlighted. [B] Dash
  AUTO. Then, on "like a car with an automatic transmission", the real
  selector again, close, its P R N D letters readable and the lever in D,
  with the Google logo above it and an "=" between: the second transmission,
  named as he names it. The selector photograph shows no carmaker's logo:
  the script pairs Google with no carmaker.
- Text: "Gemini: Auto, from 9 October", then "Auto = an automatic transmission".
- Move: [A] a clunk as the selector lands on "choosing the gear for you".
- Source: PHOTO automatic selector; SHOT
  support.google.com/gemini/answer/17004136 and
  9to5google.com/2026/10/09/gemini-auto-free-users/. LOGO Google.

**B41 · ¶26 · 6:32 · "OpenAI has gone the other way, and taken ChatGPT's automatic gear picker away, twice."** `fri-41-taken-away-twice`
- Point: OpenAI took its automatic away twice.
- Screen: FULL. A drawn strip with two places for coral stamps: "December:
  free users" and "September: Plus and Pro". [B] Dash AUTO.
- Text: "Taken away, twice"
- Move: the first stamp hits on "Last December" (B42), the second on "Then in
  September" (B43); the dash's AUTO is struck out at each.
- Source: DRAWN, LOGO OpenAI.

**B42 · ¶26 · 6:37 · "Last December, free users lost it."** `fri-42-wired`
- Point: OpenAI gave one reason; WIRED reported that the picker sent many
  more free users to costlier thinking.
- Screen: FULL. WIRED's story with this sentence highlighted: "the router
  seemed to send many more free users to OpenAI's advanced reasoning models,
  which are more expensive for OpenAI to serve."
- Text: "Those cost OpenAI more"
- Move: the highlighter sweeps on "Those cost OpenAI more."
- Source: SHOT wired.com/story/openai-router-relaunch-gpt-5-sam-altman/
  (16 December 2025).

**B43 · ¶26 · 6:52 · "Then in September, people on the Plus and Pro plans lost it too."** `fri-43-plus-pro`
- Point: paid users lost it too, with no reason given; now you pick.
- Screen: FULL. OpenAI's release note: "We're retiring automatic switching
  from Instant to Thinking (reasoning) for ChatGPT Plus and Pro users
  globally." Then FACE on "OpenAI didn't say why." (a dry look, held). Then
  the manual stick photo returns on "Now, on those plans, you pick the gear."
- Text: "You pick the gear" (on the last line).
- Move: the second stamp from B41 lands as the note appears.
- Source: SHOT help.openai.com/en/articles/6825453-chatgpt-release-notes
  (the 14 September 2026 entry). PHOTO (reused). LOGO OpenAI.

**B44 · ¶27 · 7:02 · "I don't think that lasts, and here's my guess why."**
- Point: his guess is coming.
- Screen: FACE ALONE (rest). PUNCH on "my guess why."
- Text: none.
- Move: hold.
- Source: none.

**B45 · ¶27 · 7:06 · "Think what each part of the car is worth to OpenAI or Anthropic."** `fri-45-xray-car` (strongest moment 3)
- Point: each part of the car is worth something different to them.
- Screen: FULL. First, for 2 seconds, the car key from ¶15 returns full
  frame (long video only), its badge and gear rows lit: "Opus 5.5 = the
  badge", "Thinking = the gear". Then a drawn car in side view; on the word
  "part" it turns X-ray: the badge on the back, the gearbox beneath. Two
  empty labels wait. OpenAI and Anthropic logos at the top.
- Text: "Opus 5.5 = the badge", "Thinking = the gear" (the key's own
  words); then "Badge: ?" and "Gears: ?"
- Move: the key cuts in on "Think what"; the X-ray switches on.
- Source: DRAWN, LOGO; the key reused from B23 to B27 (its logos and
  photographs, long video only).

**B46 · ¶27 · 7:11 · "The badge brings attention."** `fri-45-xray-car` (continues)
- Point: the badge buys attention, so they keep your eyes on it and off the
  gear.
- Screen: the same car. The badge lights coral and its label fills; the
  launch pages from B11 flicker across the badge; on "you don't notice the
  gear" the gearbox fades to grey.
- Text: "The badge brings attention"
- Move: continuous.
- Source: DRAWN, SHOT (reused).

**B47 · ¶27 · 7:19 · "Even the scores Anthropic shows off for Opus 5.5 were in top gear."** `fri-47-top-gear-scores` (strongest moment 3)
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

**B48 · ¶27 · 7:27 · "The gears decide the bill."** `fri-45-xray-car` (continues)
- Point: the gears are the bill: on a monthly plan, every high gear costs
  them.
- Screen: back to the X-ray car. The gearbox lights; its label fills; the
  meter from B36 sits on the gearbox and spins on "every high gear costs
  them".
- Text: "The gears decide the bill"
- Move: continuous.
- Source: DRAWN.

**B49 · ¶27 · 7:33 · "They'd like their own hand on the gearstick,"** `fri-49-their-hand`
- Point: they want to decide how much thinking each question gets.
- Screen: FULL. The manual stick photo; the OpenAI and Anthropic logos slide
  in and stop just beside the gear knob, reaching for it (beside it, never
  printed onto the photograph).
- Text: "Their hand on the gearstick"
- Move: the logos land on "their own hand".
- Source: PHOTO (reused), LOGO.

**B50 · ¶27 · 7:40 · "Most of us would rather not change gear at all."** `fri-50-automatic-wins`
- Point: most of us would rather not shift, so the automatic wins (his call).
- Screen: the manual stick dissolves into the automatic selector, which
  clunks into D. Then FACE, PUNCH on "So I think the automatic wins."
- Text: none.
- Move: [A] clunk into D.
- Source: PHOTO (reused).

### Chapter 6. The good and the bad

**Card 6** lands before "Is that good? Some of" (six lights).

**B51 · ¶28 · 7:46 · "Is that good? Some of both."**
- Point: some of both; the good first: people don't change settings.
- Screen: FACE ALONE (rest) through "People don't change settings."
- Text: none.
- Move: hold.
- Source: none.

**B52 · ¶28 · 7:51 · "Back in 2025, when ChatGPT's automatic gear picker first arrived,"** `fri-52-hundred-dots`
- Point: when the app picked, far more people got thinking answers.
- Screen: FULL. A grid of 100 dots, 10 by 10. "Before": no dot fully lit,
  labelled "Under 1 in 100". "After": seven dots light coral. A small inset
  of Altman's post on X cropped to "for free users we went from <1% to 7%".
  [B] Dash AUTO.
- Text: "Under 1 in 100", then "7 in 100".
- Move: the seven dots light one by one on "seven in a hundred did."
- Source: DRAWN grid; SHOT x.com/sama/status/1954603417252532479 (cropped
  before the Plus figures). LOGO OpenAI.

**B53 · ¶29 · 8:06 · "Anthropic learned this too. This March, it moved its coding app down to the middle gear."** `fri-53-claude-code-mid`
- Point: Anthropic moved the starting gear down, and most people stayed in
  it.
- Screen: FULL. Anthropic's engineering post with "we changed Claude Code's
  default reasoning effort from high to medium" highlighted. [B] Dash HIGH,
  then MID; on "Most people kept it there" it stays on MID.
- Text: "Most kept it there"
- Move: [A] the downshift blip on "down to the middle gear".
- Source: SHOT anthropic.com/engineering/april-23-postmortem (crop the
  sentence so the date is out). LOGO Anthropic.

**B54 · ¶29 · 8:16 · "So whoever picks the starting gear decides how hard most people's AI thinks."** `fri-54-whoever-picks`
- Point: the default is the decision; an automatic would at least think hard
  when it matters. (Sally S5.)
- Screen: CARD: "Whoever picks the starting gear decides." Then, on "An AI that picks
  for each question", SPLIT: the automatic selector photo with [B] the dash
  on AUTO; Sally's deal goes to HIGH, "2 + 3" goes to LOW.
- Text: "Whoever picks the starting gear decides"
- Move: [A] clack as the card lands.
- Source: DRAWN (video_card.py `statement`, with the OpenAI and Anthropic
  logos), PHOTO (reused).

**B55 · ¶30 · 8:27 · "Now the bad. You can't see it."**
- Point: the bad: you can't see it.
- Screen: FACE. PUNCH on "You can't see it."
- Text: none.
- Move: hold.
- Source: none.

**B56 · ¶30 · 8:30 · "This January, OpenAI made ChatGPT think for less time."** `fri-56-silent-downshift` (strongest moment 4)
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

**B57 · ¶31 · 8:46 · "When the AI picks your gear, is it thinking about your ease of use, or about their profit?"**
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

**B58 · ¶32 · 9:08 · "So what should you do?"**
- Point: the turn to advice.
- Screen: FACE.
- Text: none.
- Move: hold.
- Source: none.

**B59 · ¶33 · 9:10 · "For quick, everyday stuff, a low gear is fine."** `fri-59-low-is-fine`
- Point: low gear is fine for quick stuff.
- Screen: FACE. [B] Dash LOW, in mint (the answer). Without B: the text alone.
- Text: "Quick stuff: low gear is fine"
- Move: hold.
- Source: DRAWN.

**B60 · ¶34 · 9:14 · "For anything you'll act on, change the gear yourself."** `fri-60-act-on-it` (Sally S6)
- Point: gear up for anything you'll act on.
- Screen: FULL. A hand shifts the manual stick up; [B] dash HIGH in mint.
  Then four fast cards, one on each phrase: Sally flicks her gear up before
  she pastes ("A deal you're signing"), then "A health question", "Money",
  "A choice you can't take back".
- Text: each card's words, the script's own, six or fewer.
- Move: [A] clack on "change the gear yourself"; a cut on each phrase, the
  one burst of fast cuts in the long cut.
- Source: PHOTO (a hand shifting up), DRAWN cards and Sally.

**B61 · ¶34 · 9:23 · "On ChatGPT, pick Medium or High."** `fri-61-where-to-click`
- Point: exactly where to click.
- Screen: FULL. Krish's ChatGPT picker with Medium and High ringed in mint;
  then Claude's effort menu, the ring on the upper levels; then Gemini's
  effort setting. Logos on each.
- Text: "ChatGPT: Medium or High", then "Claude, Gemini: turn effort up".
- Move: a cut on each app's name.
- Source: CAPTURE ChatGPT, Claude, Gemini. Backup: SHOT
  help.openai.com/en/articles/20001354, support.claude.com/en/articles/8664678,
  support.google.com/gemini/answer/17004136. LOGO OpenAI, Anthropic, Google.

**B62 · ¶34 · 9:31 · "It takes longer, sometimes minutes."**
- Point: slower, and worth it for the questions that matter.
- Screen: FACE. [B] Dash HIGH in mint. PUNCH on "it's worth it."
- Text: none.
- Move: hold.
- Source: none.

**B63 · ¶35 · 9:36 · "Formula 1 found a better way decades ago, called a semi-automatic."** `fri-63-paddles` (strongest moment 5)
- Point: F1's better way is the semi-automatic: the driver picks every gear
  with a paddle; a computer does the fiddly part.
- Screen: FULL. A real photograph of an F1 steering wheel with its paddles
  (act 3), landing on "called a semi-automatic", the third transmission named
  as he names it. On "a paddle behind the steering wheel", a close-up of a
  paddle and the paddle flick: a licensed clip of a driver's hand if one is
  bought, otherwise a drawn paddle animated over the still. On "A computer
  does the fiddly part" small drawn gears turn behind the wheel.
- Text: "Formula 1: a semi-automatic", then "Drivers change gear with a
  paddle".
- Move: [A] clack on each flick.
- Source: PHOTO F1 wheel; optional licensed clip; DRAWN overlay.

**B64 · ¶35 · 9:47 · "Software that changes gear by itself was tried,"** `fri-64-banned`
- Point: gearboxes that changed by themselves were banned; the driver still
  picks every gear.
- Screen: FULL. A coral stamp, "Banned since 2004", lands on a drawn
  self-shifting box; back to the wheel photo on "The driver still picks every
  gear."
- Text: "Banned since 2004"
- Move: the stamp lands on "banned".
- Source: DRAWN. The fact is from Raceteq, filed on the piece.

**B65 · ¶35 · 9:55 · "Let the AI pick our gear, if it must."** `fri-65-gear-under-answer` (strongest moment 5)
- Point: Krish's ask: let it pick, give us paddles, and show which gear it
  picked under every answer.
- Screen: FULL. A house-drawn mock, labelled "What I'm asking for": a plain
  answer box with a paddle on each side. On "so we can take over" a paddle
  flicks. On "And show us which gear it picked, under every answer." the dash
  that has sat in the corner since B27 slides down and docks under the
  answer as a line: "Answered in: HIGH".
- Text: "Which gear, under every answer"
- Move: the dock is the payoff of treatment B. Hold 3 seconds.
- Source: DRAWN. Not ChatGPT's, Claude's or Gemini's screen.

**B66 · ¶36 · 10:06 · "We've just spent time learning to drive a car with a manual transmission."** `fri-66-three-gearboxes`
- Point: the whole arc: a manual transmission now, an automatic next,
  paddles for those who care.
- Screen: FULL. The three transmissions side by side, as real photographs
  (the H-pattern stick with its clutch pedal from B29, the P R N D selector,
  the F1 wheel), each lighting on its line: the manual on "learning to drive
  a car with a manual transmission", the automatic on "going automatic next",
  the F1 wheel on "keeps the paddles", and the manual again, a hand on the
  stick and a foot on the clutch, on "still choose a manual transmission".
- Text: one word under each panel: "Manual", "Automatic", "Semi-automatic".
- Move: each panel lights on its line.
- Source: PHOTO (reused).

**B67 · ¶36 · 10:23 · "For anything that matters, I'll be one of them."**
- Point: where Krish stands.
- Screen: FACE ALONE (rest). Hold, no punch: let it land. The music lifts a
  touch after the line.
- Text: none.
- Move: hold.
- Source: none.

**B68 · ¶37 · 10:27 · "Here's my bet."** `fri-68-the-call`
- Point: the dated call, and how sure he is.
- Screen: FACE, PUNCH on "Here's my bet." Then CARD, mint: "June 2027: free
  users automatic again", with [B] the dash on AUTO and the OpenAI logo. On "drive
  the car in auto mode" the automatic selector photo in D. On "I'm 85% sure"
  the rev needle settles at 85% [C] (without C: the house call meter).
- Text: "June 2027: free users automatic again", then "85% sure".
- Move: the needle settles on "85%".
- Source: DRAWN, PHOTO (reused), LOGO OpenAI.

**B69 · ¶37 · 10:45 · "Paid users will start in automatic too."** `fri-69-semi-automatic`
- Point: paid users go automatic too, but with a semi-automatic setting.
- Screen: FACE (opinion) through "help the AI company control its costs." Then the
  F1 wheel photo for "But paid plans will have a semi-automatic setting",
  with one last paddle flick.
- Text: none.
- Move: [A] clack on the last flick.
- Source: PHOTO (reused).

**B70 · ¶38 · 11:00 · "That's it for this week's mind.the.gap."** `fri-70-sign-off`
- Point: the full article, send it on, tell him in the comments.
- Screen: FACE ALONE (rest). Lower third "makeyourmindup.ai" on "free at
  makeyourmindup.ai". On "do you pick the gear, or leave it?" [B] the dash
  flips between YOU and AUTO. Then the story outro card on "Make your mind
  up."
- Text: "makeyourmindup.ai", then "Do you pick the gear?"
- Move: into the outro.
- Source: DRAWN, the house outro.

## The five strongest moments

Spend most of the post-production effort here, in this order.

1. **"Think of a car. Here's what stands for what." (B23 to B29c, about
   3:40 to 4:27): the car key, one pairing at a time.** The whole film rests
   on this. Real logos and real cars make the analogy concrete for someone
   who has never thought about either: OpenAI and Anthropic beside BMW and
   Audi, ChatGPT and Claude beside an X3 and a Q5, a drawn Opus 5.5 badge
   beside the Q5's real badge on its back, and Krish's own settings menu
   beside a real gearstick, each pairing named in a few words and kept on
   screen in the key. If the viewer gets "the version is the badge, the
   thinking is the gear" here, every later gear line lands without
   explanation. Then one car crawling in first and flying in top gear above
   the AI's lowest and top gears, the manual transmission with its clutch,
   and the X3 and Q5 sliding apart to the gearbox cutaway make the claim
   plain, and the little car crawling the motorway in first makes it funny.
   The press photographs and the footage are the biggest sourcing job in the
   film (long video only): start them first.
2. **"So how big is the difference in going up a gear?" (B30, about 4:15):
   the rev counter.** The only hard proof of the main claim, in three
   numbers. The needle sweep from 42 to 58 is the biggest movement in the
   film, and the two arrows (gear 42 to 58, badge 51 to 58) make "changing
   gear beat a new badge" readable in one look.
3. **"Think what each part of the car is worth" (B45 to B50, about 7:06 to
   7:46): the X-ray car.** The motive, and the most surprising evidence: the
   headline scores are top gear while the app starts lower. "The badge
   brings attention" and "The gears decide the bill" on one car, after a
   2-second return of the car key, then their logos reaching for the gear
   knob, land the thesis of the piece.
4. **"This January, OpenAI made ChatGPT think for less time." (B56, about
   8:30): the silent downshift.** After about 20 gear changes with a sound,
   this one has none, and the label never moves. "You can't see it" is felt
   rather than told. Cheap to build, but it needs exact timing and a sound
   pass. It is strongest with treatment A; without A, the music dip and the
   held label still carry it.
5. **"Formula 1 found a better way decades ago, called a semi-automatic."
   (B63 to B65, about 9:36 to 10:06): the paddles, and the dash docking under
   the answer.** The payoff of the whole system: the corner readout viewers
   have watched since 3:47 turns out to be the thing Krish is asking for. The
   F1 wheel is also the most exciting photograph in the film, so buy the best
   one available.

Sally is the sixth thing to spend on, built once as a set and reused six
times.

## Sourcing: the shopping list

### Licensed photographs

Record for each: where it came from, the photographer, the licence and its
terms, in the post's evidence the way `pileup` records its pages. Credit in
the YouTube description wherever the licence asks.

| Picture | Search for | Where |
|---|---|---|
| Manual gearstick, H pattern, numbers readable on the knob; with and without a hand on it; two angles, one in a low gear and one in a high gear | "manual gear stick H pattern knob close up", "hand on manual gear shift" | Unsplash or Pexels (free licences that allow this use), or Adobe Stock, Getty Images or Shutterstock |
| Automatic selector, P R N D, close up, in D | "automatic gear selector PRND close up" | as above |
| F1 steering wheel with its paddles clearly visible, and a close-up from behind of one paddle | "Formula 1 steering wheel paddle shifters" | Motorsport Images or Getty Images editorial (confirm the licence covers a monetised YouTube video before buying), or Wikimedia Commons (CC BY or CC BY-SA, credit as asked). Avoid sponsor logos filling the frame; no F1 logo as a graphic |
| Optional: a clip of a driver's hand flicking a paddle | "F1 driver paddle shift onboard" | an editorial video licence only; never broadcast footage without Formula One Management's licence |
| Gearbox cutaway | "gearbox cutaway museum", "transmission cutaway" | Wikimedia Commons or stock |
| BMW X3 and Audi Q5 fronts, badges visible, similar angle and colour | the model names, current model year | BMW Group PressClub (press.bmwgroup.com) and Audi MediaCenter (audi-mediacenter.com), editorial press images; record each image's terms |
| Data centre aisle | "data centre server racks aisle" | Unsplash, Pexels or stock |

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
| B30 | artificialanalysis.ai/models/claude-opus-5-5-low, /models/claude-opus-5-5, /models/claude-opus-5 | each score sentence, ending before the median figure; the page header for Opus 5.5 |
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
Gemini's effort setting (B08, B21, B24, B61), recorded on his own accounts,
with the date.

### Drawn in the house style

The grille and badges (B04, B05, B09, B23, B30), the three-question card
(B06), the verdict chips (B10), the split-flap badge (B12), Sally's set
(S1 to S6), the thinking notebook (B22, B26), the H gate morph (B24), the
first-gear map (B29), the rev counter (B30, B33, B68), the 2 + 3 stack
(B31), the coin stacks (B33), the meter (B35, B36, B48), the cost lines
(B38), the X-ray car (B45 to B48), the 100-dot grid (B52), the timeline
stamps (B41), the statement card (B54), the silent dash (B56), the answer
mock with paddles (B65), the banned stamp (B64), the call card (B68), the
dash and the chapter cards throughout.

### Logos

`logos/openai-symbol-cream.svg`, `logos/anthropic-symbol-cream.svg`,
`logos/google-cream.svg`. Declare OpenAI, Anthropic and Google on the packed
video for the visual gate.

## Numbers allowed on screen

Only these, because the script says them: Opus 4.8, Opus 5, Opus 5.5, Opus
5.56 (the joke, always with its "?"), GPT 5.1, GPT 6.1, May, July,
September, November, March 2025, 1 million in one hour, $40 billion, 4
seconds, 6 months later, 42, 58, 51, 2 + 3, 13 times, about 11x, January
2025, $200 a month, 9 October, December, 2025, under 1 in 100, 7 in 100,
2004, June 2027, 85%. The arrows in B30 use only 42, 51 and 58; no
difference between them is printed. The dial has no numbers of its own. A
screenshot keeps any figure its cropped sentence holds, but nothing points
at a figure the script does not say.

## Before anything is built

1. Krish picks A, B and C (any, all or none). Build only what he picks.
2. `cover-facts.json` and `post.json` in this folder still carry the first
   angle ("OpenAI tried to pick your AI..."), and the story intro, the
   thumbnails and kit.py read them. They need the v5 angle and these picture
   ids before kit.py runs, or the story intro shows the old title and kit.py
   reports the new pictures as not cued.
3. Krish records the three captures on his own accounts (B08, B61).
4. Every photograph's licence and every screenshot's URL and date are
   recorded before the pack is built.
5. After the edit, check the visual gate, the kit's readable floor at 16:9,
   and every on-screen number against the list above.
6. For the 90-second cut: build B30, B56 and B65 so their middle third also
   works at 9:16.
