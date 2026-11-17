# How Hannah Fry breaks a topic down

Why this exists. Krish, 2026-11-17: "I really like her teaching style, her fluency of speech, how she doesn't talk
down to anyone, but how she makes boring things so interesting." Earlier, of her stamp duty Short (2026-10-14,
`config/style-references.json`, references[1]): "I generally love how she talks about complex topics observationally.
She's not commentating on a specific thing or company but she's just unpacking how something works that people
probably don't even realise they wondered about."

## What this is built from, and what is still missing

| Source | What it gives | Status |
|---|---|---|
| Her stamp duty Short, studied 2026-10-14 (`config/style-references.json`, references[1].study) | Measured pace, speech share, questions asked, shot length, her first ten seconds word for word | Measured |
| The nine stamp duty moves in the style bank (`config/style-references.json`, bank, `"from": "Hannah Fry, stamp duty Short"`) | Opening, breakdown, proof, structure, close, tone, editing, graphics | Banked, every one `krish_verdict: untested` |
| "Could Alzheimer's start in our nose?" (youtube.com/shorts/VADONXzhjTc, 2:34, 28 Oct 2026, 4.5M views), the Short Krish linked on 17 Nov | Title, length, description (YouTube API, read 2026-11-17) | **Words not yet read.** YouTube refuses cloud addresses ("sign in to confirm you're not a bot"). Read it with content-watcher on a home computer, then calibrate the moves below against her actual lines |
| Her wider body of work (Shorts, documentaries, books, columns) | The craft patterns below | Observed from her published work, not measured here |

Treat every pattern below as a working model until her Alzheimer's words are on the record and checked against it.

## The numbers we have measured (stamp duty Short)

- 572 words in 174 seconds: **211 words a minute**, talking for 163 of the 174 seconds. She is fast. The pace reads as
  fluent rather than rushed because each clause is short, simple and in order, and nothing in it needs re-reading.
- **3 questions** in under three minutes: questions are her engine, used sparingly.
- **About 3 cuts a minute** (median shot 11.5 s): long holds on her, with push-ins on the key lines. The talking does
  the work and the edit stays out of the way.
- Her first ten seconds, word for word: "Okay, let me start this one off by saying that I think tax is a good thing.
  Okay schools roads the NHS massive fan I also think that Britain has One of the stupidest taxes in the entire world
  because of the way that it makes people behave". She concedes the reasonable view, says why in four quick concrete
  nouns, then makes the sharp claim, all inside ten seconds.

Krish's lengths stay his own (675 to 825 words for the long cut, 160 to 210 for the short; his ledger times them). Take
her density from this: no dead air and no clause that has to be re-read. Don't copy her speed.

## Pace

- Short clauses delivered in a run, joined with "and", "so" and "because". Each sentence carries one idea, with the
  next one hooked onto it. This is the same rhythm Krish's own takes show (SCRIPT_AS_HE_TALKS: sentences of 10 to 15
  words joined with so, and or but).
- Speed varies by job. She runs quickly through set-up the viewer can take on trust (the reasonable view, the
  background), then slows down on the one line that matters. On a teleprompter that slow line is its own short
  sentence.
- Dead air never stands in for emphasis. A pause comes after a surprising line, as a beat for the viewer to react.

## Vocabulary

- Everyday words for hard things: "the stupidest tax", "a queue", "right under our noses". The proper term, if it
  is needed at all, comes after the picture has landed.
- Concrete nouns over abstract ones (schools, roads, the NHS rather than "public services").
- Conversational markers that show a person thinking: "okay", "right?", "now", "here's the thing", "and this is the
  bit I love". Each one marks a turn in the argument, never filler.
- Intensifiers that sound like real speech ("massive fan", "the entire world"), used for her own view, never to inflate
  a fact.
- **Borrow her moves, never her accent words.** Her Britishisms are hers. Krish speaks in his own lexicon
  (`config/voice/lexicon.json`, the on-camera branch of krish-voice). A script that sounds like her doing an impression
  fails his tone floor (`config/script-floor.json`, quality c).

## Narrative style: how she gets from start to finish

The shape under almost every short explainer of hers:

1. **A question the viewer did not know they had.** The Alzheimer's title is a model of it: a big, familiar fear
   ("Alzheimer's") put beside a small, everyday, unexpected place ("our nose"), as a question. The description
   doubles it with a pun ("right under our noses"). The viewer is curious before a fact is given.
2. **The obvious answer, said fairly.** She states what a reasonable person already believes, and gives it its due
   ("I think tax is a good thing"). Doing this first is what makes her feel fair rather than contrarian.
3. **The turn.** "But" or "and yet": the thing that does not fit.
4. **One person, one moment.** The mechanism is shown through one ordinary person in one situation (the house buyer
   at the moment they decide not to move), then widened to everyone.
5. **One picture that names how it works.** A single everyday image that the viewer keeps: "a market becomes a
   queue".
6. **One number, after the story.** The hard figure comes once the viewer already wants it, so it lands as proof
   rather than as homework.
7. **How sure we are, in one plain line.** She says how strong the evidence is ("this is early", "nobody knows yet")
   and moves on. The honesty is a single sentence, never a paragraph of caveats.
8. **The better way, briefly.** Two lines on what would work instead.
9. **A close that rewards the question.** She goes back to the opening question with the answer in hand, often with a
   dry, understated last observation that makes the viewer smile.

Each step answers the question the step before it raised. That chain is why "boring" topics hold: the viewer is
always one sentence away from the answer to something they now want to know.

## Tone

- **Curious with the viewer, never above them.** She explains as someone who found this out recently and can't
  wait to share it. She never presents as the expert who always knew. Words like "simply", "basically just",
  "obviously" and "as you know" are absent: each one tells a viewer who did not know that they should have.
- **Delight, said out loud.** She lets the viewer see that she finds it fascinating ("this is the bit I love"). It
  gives the viewer permission to find it fascinating too. Once or twice a piece, never on every line.
- **Dry and understated.** The wit is British understatement and self-aware asides, never a set-up and punchline. It
  is never at the expense of a real person. Krish asked for exactly this on 2026-10-21 ("Bit of dry wit and hannah fry
  sarcasm too"; learning `dry-wit`).
- **Opinionated and fair.** She takes a side ("one of the stupidest taxes in the entire world") after conceding the
  other one.

## Explanation style

- **Intuition first, name second.** Every hard idea arrives as something the viewer can picture, and the term (if it
  is needed at all) follows. The reverse order is a lecture.
- **One example, followed all the way through.** She works one case completely before generalising. A list of three
  half-told examples is never her move. This matches ONE_STORY_SHORT and floor quality a.
- **Explain the mechanism.** She tells you how the thing works, so the viewer could predict the next case
  themselves.
- **Numbers are rationed.** One strong figure per short piece, placed after the story (LISTENING caps the rest: 1 in the
  short cut, 3 in the long).
- **Questions as hinges.** About one a minute, each one asked just before its answer, so the viewer leans in.

## Where it meets Krish's house rules (his rules win every time)

| Her habit | His rule | How they fit |
|---|---|---|
| Opens with a concession about herself ("I think tax is a good thing") | INTRO_PATTERN, `config/script-floor/intros.json`: beat 1 is a surprising fact about a named player | Her question shape lives inside his four beats: beat 1's fact should be weird enough to raise a question, and beat 4 says the title as that question. The concession moves to beat 2 or straight after the title |
| Talks about concepts, often with no company named | Floor quality b: every person, product and term named and explained | Keep his named players. Her lesson is to explain the mechanism and keep the commentary on the company short |
| Ends on a wry observation | SCRIPT_CLOSE: his first-person one thing, then exactly "The full story is free at makeyourmindup.ai." | The wry observation can be the line before his one thing, never after the fixed last line |
| States uncertainty plainly | "Say the result, never the method" (Krish, 2026-10-21) | One line of how sure, in plain words. Never limits, weighting or sourcing spoken aloud |
| 211 words a minute | His lengths and his ledger | Take her density and leave her speed |
| Long holds, about 3 cuts a minute | The ve motion standard and his signed spec | An editing note for the long cut only, and only through the style bank (`long-holds`) with his yes |

## How each cut uses it

**The short cut (60 to 90 seconds, 160 to 210 words, one story).** The intro's four beats compressed, with the title
said as a question. Then one line of the obvious answer, the turn, one person in one moment, one picture, one number,
one line of how sure, his one thing and the close line. No second example, even as a teaser (ONE_STORY_SHORT).

**The long cut (5 minutes, 675 to 825 words).** The four-beat intro and the title question, then the map up front
(LISTENING). The obvious answer gets a fair hearing, then the turn. The mechanism is shown through one person and
followed all the way through, with one picture per hard idea and a signpost at each section turn. Then the number
after the story, the counterpoint or second example only as further evidence (floor quality a), and how sure, in
one line. Then the better way in two lines, the recap, a dry closing observation, his one thing and the close line.
Thinking-out-loud asides are welcome here (style bank `thinking-aloud`).
