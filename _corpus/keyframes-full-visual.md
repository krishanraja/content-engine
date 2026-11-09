# Keyframes full-visual: the craft, for ve

Source: the Keyframes `full-visual` pack, version 0.2.13. It is Krish's own, given to him licence-free (Krish,
2026-11-06: "its been given to me license free, terms allow it, no need to vendor it - its mine now"). What was
taken from it, and where each part now lives, is recorded in `docs/ve/sources/keyframes.md`.

This file is a reference that cards, briefs and the Critic cite by section (`§2.3`). It is not Krish's taste.
- His approved rules come from the taste ledger and the floor (`python3 scripts/floor.py --format <maker>`).
- Where this file and a house rule disagree, the house rule wins. §6 lists every known disagreement.
- A line here becomes a durable rule only when Krish approves it.

## 1. What the format is

His voice explains, and the screen is the explanation. There is no presenter on screen.
- A caption says each word as it is spoken, with one key word boxed per line.
- Under the caption, the real thing each sentence is about is redrawn with care. It changes on the word that changes
  it.
- The test: someone watching with the sound off follows the whole argument. Someone who watched once can explain it to
  a friend.
- The best results felt like a cross-section of a thing the viewer holds every day, or a map of a story they had
  already heard, explored from several sides until it clicked.

## 2. The picture

**2.1 Real, detailed, attentive.** A real thing has parts, materials, labels, wear, light and scale. Draw them from
real photos, teardowns and screens. The note most often given after a first try was that it could be "more real, with
much more details". Flat boxes and generic shapes read as coded.

**2.2 A new real thing for every sentence group.** An interface, a document, a machine opened up. One thread object
can stay across the cut. It is never the main picture twice.

**2.3 Show the mechanism working.** An abstract idea is drawn doing its job, step by step on the words, with real
numbers. Blur, frost or a vague panel never stand in for it.

**2.4 Cut inside.** When the mechanism is inside, show the inside: a side-on section, a shell turning see-through,
layers lifting out like a teardown photo. A product shot alone explains nothing.

**2.5 One world, three scales.** Inside the object, the object in the hand, the place around it. Travel between them
and come back, so the viewer never loses where they are.

**2.6 The invisible gets one shape and one colour for the whole cut** (a charge, a cost, a flow). Everything else
keeps its real colours, so the accent is what pulls the eye. In ve that accent is `tokens.mint`.

**2.7 Fill the stage.** Foreground, subject, depth behind, and one secondary motion. Never one small object on an
empty ground. Where the real thing is made of thousands of small parts (pixels, wires, people, requests), draw
thousands.

**2.8 Every pattern says what it is.** A chunk, a spike, a cell: the word it stands for is written on it, small, with
a hairline. An unlabelled pattern reads as decoration.

**2.9 One focus at a time.** Big and centred first, then it moves aside as the rest arrives. Clear beats complete.

**2.10 The last shot is the first shot, resolved.**

## 3. The motion

**3.1** Something meaningful moves on nearly every word. The move is the mechanism working, not decoration.

**3.2 Every change belongs to a word.** An event lands on its word, within a frame or two. A build ends on its word:
it starts early enough to finish as the word is said. A counter finishes before its sentence does.

**3.3** The first ten seconds carry the most motion, and nothing sits still for more than about a second. A held
picture keeps living: a slow push in, light travelling, small parts working.

**3.4 A picture hands over only in a pause he left, as one move.** Their engine refuses a scene boundary with under
0.15 s of silence. ve measures it as `beats.handover_in_gaps` (`scripts/velib/qc_gates.py`).

**3.5 A change of state happens to the object already on screen.** It recolours, opens, breaks or grows. It is not
replaced.

**3.6 A number is never static.** It counts, rolls or fills, and lands on its word.

**3.7 The verbs**, by their pack names. Durations are in frames at 60 fps: halve them for ve's 30 fps clock.

| Verb | What it does |
|---|---|
| `blurIn` | the default arrival: 7 f, a short motion blur |
| `pop` | 8 f, a small overshoot |
| `Travel` | moves in over 12 f across about 260 px, blurred along the path |
| `blurOut` | the default exit |
| `typeOn` | 36 ms a character |
| `countTo` | every number, with a small jitter on the way |
| `stagger` | 4, 6, 8 or 12 f between siblings |
| `mix` | recolours an object in place |
| `draw` | draws along a path |
| `Cursor` | eased arcs, resting before a click |

ve's grammar remains slide, drop and slap (`devices/CONTRACT.md`). These verbs are additions a device may use, never
replacements.

## 4. The caption

**4.1** One word appears per spoken word, and a word not yet said does not exist on screen.

**4.2** A block is one breath of 2 to 7 words, never more than two lines. It ends at a clause end, or right before the
word the picture is about to show, so that word opens a fresh line.

**4.3** One key word per block at most, boxed: a number, a name, or the verb that carries the idea. Read alone, top to
bottom, the key words are the argument.

**4.4** The box follows its word by about 5 frames (at 60 fps). The caption leads the word slightly, so it is sharp
on the syllable.

**4.5** Type below 32 px is texture, not evidence. Use fewer rows, bigger.

## 5. The hook (the first three to four seconds)

**5.1 The sentence decoded.** One hero, alone. Each noun enters as a real thing on its word, and each verb is done
physically to the hero, as one continuous transformation that reads with the sound off.

**5.2 Frame 0 is full and already moving.** Never an empty ground, a title or one object waiting. The mechanism plays
once, small and fast, inside the first second, and something new arrives every 0.2 to 0.4 s after that.

**5.3** One big physical move with weight on the key word, then the payoff holds.

**5.4 Hook sentences that worked:**
- the impossible feat, then the viewer's short question;
- the belief turned over;
- the news said big and plain, with names people know;
- the stakes with a villain;
- the question people already have.

**5.5 What lost:**
- a soft question where a flat statement was true;
- two ideas in one hook;
- a list read with pauses;
- a spec as the first fact;
- jargon the viewer has never heard;
- a claim that is not quite true.

**5.6 Shapes of the body:**
- **The everyday mechanism:** the answer given away by second 8 to 10, then a chain of causes, then "But...", then the
  payoff in the viewer's life.
- **News to mechanism:** the news is the door, not the subject.
- **The straight concept:** start from the naive version and let each problem force the next piece.
- **The objection chain.**

## 6. Where the house wins

| Their rule | The house rule that wins |
|---|---|
| A synthetic voice (ElevenLabs, OpenAI or Fish) | Krish's own recorded voice; ve conforms his takes. |
| No music | The one bed shape from the ledger (`config/music-bed.json`, F40). |
| 60 fps; the bottom 220 px left to Instagram | ve's 30 fps clock, and its channel safe zones (`qc_channel`). |
| A bespoke scene file per reel, built by many agents at once | One signed spec, and devices built by Codex from cards (no per-piece compositions). |
| The transcript is the only approval | Gate 1 and Gate 2 stay. |
| Five hooks rendered as five videos | One spec. Alternate hooks wait for a format change. |
| Fonts, grounds, colours and the box marker from the pack's `theme.ts` | Brand tokens, house fonts and the design lock. |

## 7. Never (each one was rejected on a real reel)

- Pills and badges with a dot, coloured status labels, step-number cards, a headline that repeats the caption.
- Rows of coloured bars for a comparison (draw the real artifact).
- A fake app, game or document when the real one exists.
- A 3D set that replaces the real thing, mannequins, or AI imagery that does not read photoreal.
- Dashed connector lines, frosted blur as content, four cards at once.
- A hero mechanism dimmed while the voice moves on.

## 8. The builder method (every Codex card for this style carries it)

1. **Look at the real thing first.** Collect product photos, teardowns, cross-sections, patents, the real interface's
   screenshots and real footage. Open each at full size, then write what you see: the parts and how many, the
   materials, the labels, the light, the scale, how it moves, and the detail that would give a fake away.
2. **Think before you build.** For each key word, write what happens on screen ("lands on" for an event, "ends on" for
   a build), and the sound-off test: what a stranger understands from the pictures alone. If the device could serve
   any other story, think again.
3. **Build from the references,** at their geometry and copy, in layers: light, shadow, texture, wear, real part
   counts, real labels.
4. **Be your own first critic.** Render stills across the device and read each at full size beside the references.
   Is it as detailed as the photo? Would the owner of the thing recognise it? Does something change on every key
   word?
5. **The richer pass:** one more pass on purpose for detail, depth and a second motion behind the first, keeping every
   cue exactly where it is.

The ve Critic still reviews afterwards. Self-review is the builder's floor, never the verdict.
