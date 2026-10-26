# Motion system: "Border Control"

The look of all four Friday videos, and the whole of the two voiceover ones. Decided by Claude on 24 October 2026
(Krish: "scripts and copy are all your responsibility, as well as creative and visual direction ... we're going to
need to up our game on visuals with the voiceover version - I want motion and world-class motion design in a specific
visual aesthetic that you're going to decide"). Built inside the brand book (v1.4, `docs/STUDIO.md`); nothing here
adds a colour or a font.

**Reference still to study.** Krish named a clip in Video Engine > Inspiration "featuring Anthropic and GitHub, which I
really liked as inspiration for how motion animation really helps tell the story" (Drive file
`SaveClip.App_AQP6P-DCy7NO_...mp4`, added 22 October). It had not reached the engine's library when this was written,
so this file was set without watching it. **Before building anything, Codex fetches and studies it**
(`python scripts/quick-edit/references.py fetch "<name>"` then `references.py study "<name>"`) and writes what it takes
from it in `reference-notes.md` beside this file: only how motion carries the explanation (what moves, when, why), never
its colours, type or logos. Where the reference shows a better way to make one of the moves below land, use it and say
so in the notes; the rules under "The one rule" and "Truth" never change.

## The one rule: the picture adds, the voice tells

Krish, 24 October: "The narrative and the visuals should match and be additive and not duplicative to one another."

- **No caption repeats the sentence being said.** On-screen words only add what the ear cannot get: the source and its
  date, a number, the name of the thing on screen, or the one changed word. If a frame's words could be read aloud as
  the voice line, delete them.
- **The picture shows the mechanism the voice names.** The voice says "it keeps yours in China"; the picture shows a
  message leaving a phone and landing on a server labelled with the policy's own words. The voice says "a third of the
  time"; the picture shows 200 tiles and the 70 that failed. The eye learns something the ear did not.
- **Every move lands on a word.** An object arrives, turns or fills on the stressed syllable of the word that names it
  (word start from `timings.json`, minus 3 frames so the eye leads the ear). Nothing moves between ideas for decoration.

## The world: two passports, two surfaces

The piece's one idea is that every AI has two passports: where it was **born** (shapes what it says) and where it
**lives** (decides who sees your data). The two surfaces make that idea visible without a word:

- **BORN scenes are on cream paper** (`#F4EFE4`, halftone dots at 6% on colour blocks): what an AI *says*. Documents,
  quotes, answers, the newspaper's test, our own test. Things here are paper: they slide, stack, get highlighted and
  stamped.
- **LIVES scenes are on ink** (`#0C1512`, grain at 4%): where data *goes*. Phones, servers, routes, borders. Things here
  are light: dotted routes draw, packets travel, servers glow mint.
- The viewer learns in the first minute that cream means "what it says" and ink means "where it lives". The switch
  between them is the piece's signature transition: the passport card **flips** (a 3D card turn, 14 frames, ease
  in-out) and the surface behind it changes with the turn.

Colour meaning, and nothing else: **mint** `#7EF0C0` = the finding, the answer, the highlighted proof; **amber** (the
house warning tone, `--bad` `#b0412e` on cream, `#ff9b85` on ink) = what changed or what was taken away (the one
swapped word in a prompt, the deleted answer, a failed tile). Amber goes on a change, never on a country: a passport
field reads in plain ink whichever country it names, and no country, flag or people is ever shown as the threat.
Ink type on cream, cream type on ink, always.

## The framing: every country, one example at a time

Krish, 24 October: "The whole point of this is to understand what sovereign AI means and why countries are fighting to
build their own AI as opposed to use another countries. We must not make this feel like we're stirring geopolitical
hatred against China, it's just an example." So the pictures are about sovereign AI: passports from many countries
(America, China, France, the UAE, India, South Korea) treated the same way, the American example (Grok) given the same
weight as the Chinese ones, and the test shown as what one model did on one question, never as a verdict on a
country. Every label uses the source's own neutral words.

## Type

- **Anton, uppercase**: one number or one word at a time, big (the 35%, the 59 and 35, A DRAW). Never a sentence.
- **IBM Plex Mono**: every label: source and date (`FORTUNE · 21 OCT 2025`), passport fields, counters (`2 OF 3`),
  `MY TEST`. Mono means "a record"; it is how the viewer knows something is evidence.
- **Archivo**: names of companies and models on their cards.
- **Fraunces italic**: never in the voiceover cuts (the voice is the human line); only on the call card if one is
  used.
- Sizes: at least 39 px tall cut, 21 px wide cut (`kit.py` checks). A source page whose proving sentence would be
  smaller is redrawn as a larger panel labelled `REDRAWN FROM <publisher>`.

## The cast of objects (build each once, reuse everywhere)

1. **The passport.** A passport data page in cream with a mint machine-readable strip. Photo box holds the company's
   official mark (Brandfetch, never drawn). Two fields only: `BORN` and `LIVES`, Plex Mono, filled by typing on at
   about 30 characters a second. A field not in the record reads `NOT STATED` in muted ink, never a guess. Stamps
   slap on (scale 1.15 to 1.0 in 6 frames, 2-degree tilt, one 4 px shake): `TRAINING CAME WITH IT`,
   `A DRAW`. Each AI gets its own passport when first named; they stack like a deck when more than one is on screen.
2. **The evidence sheet.** The real page capture (`assets.json`) on a paper sheet with a soft 24 px shadow. It slides
   onto the desk from below (16 frames), the camera pushes in to the proving sentence over the next 2 to 3 seconds
   (about 6% scale), and a mint highlighter sweeps the sentence left to right timed to the voice saying it. The source
   label sits on the sheet's top edge like a tab.
3. **The route.** On ink: a phone icon (simple, outline) and a server rack, a dotted mint line drawn between them as the
   voice says where it goes; three small square packets travel along it. A thin border line crosses the route with the
   country name in Plex Mono where the record says so. No maps, no globes, no satellite looks.
4. **The tile field.** Numbers as countable things. 100 small squares in a 20 x 5 grid; the ones that failed flip from
   cream to amber in a quick wave (the newspaper's 35% as 35 of 100: it gives a percentage, not a count). Models as stacked tiles (59 against 35). A gap as
   two columns almost touching with a hairline labelled `2.7%`. A counter is Plex Mono (`1 OF 3`, `2 OF 3`, `3 OF 3`).
5. **The chat window.** A clean redraw of a chat window, or Krish's real screen recording inside a plain device frame.
   For the deletion: the real footage at real speed, then a 4x slow replay of the half second the answer vanishes, each
   line breaking into horizontal scanlines and blinking out in amber, before "Sorry, that's beyond my current scope"
   types in. Labelled `MY TEST · 24 OCT · SCREEN RECORDING` (he recorded it on 24 October; the original run was 23
   October, `test-results/scores.md`).
6. **The split.** Two chat windows side by side, the one word that differs (Xinjiang / Turkmenistan, Taiwan /
   Singapore) lit amber in both prompts. This is the experiment in one frame.
7. **The checklist.** Three lines on cream that tick mint as the voice says each action. The words are the voice's
   own action, shortened to its noun (`WHICH AI · WHERE IT LIVES`), never the full sentence.

## Motion grammar

- **One camera, one desk.** In the voiceover cuts there are no hard cuts inside a section: the camera glides across
  one continuous desk (cream) or one night (ink) from object to object, 20 to 30 frames per move, ease
  `cubic-bezier(0.22, 1, 0.36, 1)`. A new section starts with the passport flip. One whip pan only, on "And everyone
  else wants its own", across a row of five sources.
- **Springs, not slides.** Objects arrive with a damped spring (about 5% overshoot, settles in 10 to 14 frames). Exits
  are faster than entrances (8 frames).
- **Two things move at once, at most.** While the highlighter sweeps, nothing else moves.
- **Jokes land on stillness.** On "holiday fling", "Awkward", "keep the boss happy" and "can't take China out of
  DeepSeek" the picture changes on the line before, then holds dead still through the punchline (at least 0.8 s). No
  sound effects, no stickers.
- **Pace.** A new idea every 2 to 4 seconds in the short, 3 to 6 in the long. Holds of 2 seconds or more only on the
  deletion and the call.
- **Sound.** The licensed bed from `config/music-library.json`, low under the voice; one soft paper sound when an
  evidence sheet lands is allowed, nothing else.

## On camera cuts

Both on-camera takes are handheld selfies, walking outdoors, filmed portrait (1080x1920; the files carry a -90 degree
rotation flag, so read them rotated). Steady both first (`produce-video`'s stabilising step) and keep his eyes on the
upper third.

- **90-second on camera (9:16):** native framing. The objects play full frame as cutaways over his words, exactly as in
  the voiceover cut.
- **5-minute on camera (16:9):** his portrait sits in a full-height panel on the left third, on ink, with a 2 px mint
  edge; the right two thirds are the stage where the objects play. On the cutaway beats the stage widens to full frame
  and his panel slides out (12 frames); it slides back for the beats marked "Face". Never pillarbox or blur-fill his
  portrait across the frame.

His face carries the opening, "So I tried it myself", and the call; everywhere else the cutaway holds at least half the
beat. Every audio edit in the locked scripts is covered by a cutaway, never shown as a jump on his face.

## Truth

Every value on screen comes from `visual-copy.json`, which cites `research-gaps.md`, the captures in `assets.json`, our
test (`test-results/`) or the takes. Generated images and video never stand in for evidence; generated or drawn art only
for the passport frame, icons, the desk and transitions. Our own test is always labelled `MY TEST`; anyone else's
carries the publisher's name. Crop names, sidebars and account menus out of every screen recording.
