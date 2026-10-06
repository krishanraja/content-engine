# makeyourmindup: voice and format guide for one-off video scripts

Compiled 2026-10-06 from: content-engine `.agents/skills/krish-voice/` (SKILL + 3 references), `.agents/skills/content-corpus/`, `AGENTS.md`, `docs/NORTH_STAR.md`, `docs/CONTENT_ENGINE.md`, `apps/control-plane/api/_houseRules.ts`, `apps/control-plane/api/_video.ts`, `.agents/skills/mindmake-video/stations/script|recording-brief`, `docs/REFERENCE_INSTAGRAM_AD.md`, `docs/OPENING_LOOP_CALIBRATION.md`, `editions/` (both launch video configs, hello end-card README, the mind.the.gap edition body), `scripts/quick-edit/README.md`, `scripts/channel-kit/README.md`; makeyourmindup `NOW.md`, `apps/cover/substack-kit/COPY.md`, brand kit v1.5 README and brand book p.16 (Voice).
Mandates (`venture_formats.mandate`) and the DB voice block are never_publish and were not copied; subchannel lines below are summaries of public copy.

---

## 1. Who it is for, and who is speaking

- Speaker: **Krish Raja** (always "Krish"; transcribers write "Chris", fix it in captions). British-Australian, Brooklyn-based, 16 years in commercial media/tech/telecoms, now building with AI. Founder-practitioner who has done the work and will say what did not work.
- Reader/viewer: one person, spoken to directly. A senior leader (roughly £5m to £50m business; PE/VC-backed media, adtech, data) who will not admit they are not ready for what is happening. Behind them: the curious professional keeping up without jargon, the investor, the founder at a fork.
- Publication line (public, on banner/end card): "A free publication on how AI really works. You make your mind up."

## 2. Tone rules (the ones that are enforced)

| Rule | What it means for a script |
|---|---|
| Reading age 12, with real humour (R7) | Short sentences, everyday words. The joke points at the hype, the industry or Krish himself, never at the viewer, and never replaces the finding. |
| Plain words (R6) | No word the viewer must interpret: technical jargon AND our own coined labels/nicknames. If a term is unavoidable (product name), say what it is in plain English the first time. Expand every acronym once. |
| Crystal clear before clever | Every sentence: who did what, and what happens next, clear on first hearing. No smart-sounding phrase open to a second reading ("nudged" was called out). |
| Hook on consequence (R4) | Open on why this matters / what could happen next. A bit provocative is fine; let the viewer reach the conclusion. |
| No sermons | Show the working, let them make their mind up. No closing moral, no telling people what to think. |
| Make the unfamiliar relatable | A real historical parallel, everyday analogy or comic exaggeration, visibly a comparison, never distorting the fact. Piece 1 used "Amazon is the supermarket, Shopify is the till". The mind.the.gap piece used "picking an AI brain is like picking an ice cream flavour". |
| Real life examples are gold (REAL_LIFE) | Land each point on something people actually do: searching for trainers, paying at checkout, asking an AI to buy something. Real prices and rules where they exist. |
| Call it an "AI agent" | Software that acts for you is an "AI agent" ("AI shopping agent"), never robot or bot. Say whose agent and what it does on first mention. |
| Facts checked twice | Every number, date, name and quote traceable to a source, in its own words if quoted. Every number names who produced it. Never compute, round or add from memory. Label a guess as a guess ("Here's our guess, and it is a guess"). |
| Spoken, not an essay read aloud (`SPOKEN_RULES`) | Contractions, asides, one-breath sentences. Must pass a read-aloud test. |
| Register (krish-voice) | Quick, sharp, direct, casual, commercially grounded. Uneven rhythm: terse lines next to one longer explanatory sentence. Lead with consequence or a concrete observation. Evidence before fluency. Separate what happened / what it suggests / what Krish thinks. |

## 3. Banned patterns (hard)

- **No em dashes.** Anywhere, including captions and on-screen text. Use commas, full stops, brackets.
- **No "Not X, Y"** in any form or order: "it's not X, it's Y", "X isn't the story, Y is", "Y, not X", "never X, it was Y" (R2, "Cut it everywhere"). Plain factual negation ("Amazon did not say why") is fine.
- **No exclamation marks** (except inside a quotation).
- **British spelling**: colour, theatre, organise, analyse, defence, labour, modelling, travelled, grey. Quotes and names keep their own spelling.
- **No YouTube clichés**: no "hey guys", "in today's video", "make sure to like and subscribe", no restating the title, no "comment below" / one-word comment prompts (Krish rejected the empty comment prompt).
- **No warm-up** ("AI is moving so fast..."), no generic summary, no "what do you think?" closer.
- **No hype words**: game-changing, revolutionary, the future is here; no false urgency ("just", "breaking", "shocking"); no shouting in capitals.
- **No symmetrical three-part lists for rhythm**, no fake quotes, no invented scenes or anecdotes, no unsupported certainty.
- **No vendor-pitch voice** or "a word nobody says out loud" (brand book).
- **Calling something "this week"** when it was a month ago (a launch-script bug, now a rule).

Brand book "sounds like us": "Every AI deal has a bill, and somebody pays it." / "Every part gets a stamp, real or theatre." / "This page hasn't made its mind up." Stickers: "Free from jargon. No added sermons. Contains British spelling."

## 4. Runtime and word count

Engine standard is ~150 spoken words per minute, unhurried (`_video.ts`), with a hard ceiling of target +10%:

| Format | Seconds | Words | Shape |
|---|---|---|---|
| 15s hook | 15 | ~40 | One claim, one turn, hard out. No setup. Never a CTA. |
| 30s | 30 | ~80 | Claim, ONE proof (a number, named company or dated event), forward-looking verdict. |
| 60s reel | 60 | ~160 | Hook (inside 10s, no throat-clearing), proof, turn (second-order effect / counter-reading), verdict. |
| 3 min | 180 | ~450 | Hook, three escalating beats each with its own evidence, verdict (not a recap). Beats marked as cut points. |
| 10 min | 600 | ~1500 | Cold open on a scene or artifact, four sections, one analogy carried through, one real counterpoint. |

What Krish actually recorded for launch (2026-10-05): the hello ran 2:26 raw, 2:08 after cuts, **2:12 with the 4-second end card**; Who gets paid ran 2:52 raw, 2:28 cut, **2:32 with end card**. So ~2 to 2.5 minutes, roughly 330 to 400 spoken words, is the proven sweet spot for a one-off to-camera piece. Budget ~15% for stumbles/pauses cut in the edit (every pause over 0.35s is removed).

## 5. The layout he records from

### The engine's script artifact
`POST /api/content-ideas/:id/video-script` returns JSON beats, each `{ t, say, shot }`:

- `t`: start timecode, m:ss
- `say`: the spoken words, verbatim, ready to read
- `shot`: what is on screen: framing, b-roll, on-screen text, cut instruction (concrete, short)
- plus a working `title` that states the claim (not a tease) and `hook`, the first line repeated on its own

The Studio's script station adds: the first sentence must (1) confirm the promise of the title (share at least one content term with it), (2) make clear why this narrator holds the claim, (3) leave a question open that the rest answers. A multi-beat piece must open a question at or after the hook and answer it in a later beat. Endings must not trail off.

### Recommended layout for a one-off script (matches the above and the quick-edit pipeline)

```
TITLE (working, states the claim, <= 60 chars, names who is involved)
TARGET: 2:00 to 2:30 / ~330 to 380 words
HOOK (first line, repeated alone)

[0:00] SAY: ...
       SHOT: face to camera / proof panel: <source, highlighted line>
[0:12] SAY: ...
       SHOT: ...
...
[close] SAY: the call (what happens, by when, how sure) or the practical "what to do on Monday"
        SHOT: full face, call card with date + %
END CARD (4s, added in edit)
```

Graphics in quick-edit are placed by **anchor words** (the start and end words of the line they cover), so write lines whose first few words are distinctive. Cuts are also specified by the words as said.

### Real example: the two launch videos (2026-10-05)

No verbatim recorded script is committed to any repo (recordings, transcripts and words.json caches are media and are never committed; `scripts/check-no-secrets.ts`). What survives in Krish's own spoken words is the beat map in the edit configs. These are real transcript anchors (lower-case, punctuation stripped by the transcriber), in order:

**Who gets paid** (follow.the.money, 2:32), `editions/2026-10-launch/video-kit/who-gets-paid.json`

| Beat | Starts with (his words) | Ends with | Graphic on screen |
|---|---|---|---|
| Name strap | after "in september meta launched" | (3.5s) | name strap |
| Quote | "amazon recently told ..." | "... shown to humans" | Amazon's own quote as a panel |
| Blocked | "and within two weeks ..." | "... opposite with it" | blocked vs welcomed |
| Image 1 | "and the reason ..." | "... fee on every sale" | how each side is paid |
| Image 2 | "but they only like ..." | "... shows no ads today" | same request, who gets paid |
| Image 3 | "if you let an ..." | "... paid it more" | where you get stung |
| Shopify | "if youre someone that ..." | "... commission eventually" | what it means if you sell on Shopify |
| The call | "so whats our call ..." | "... sure of this" | call card: date + confidence |
| End card | | | masthead, line, three days, "Subscribe free", makeyourmindup.ai |

Stumbles he cut: "is" (after "and the reason"), "So if Meta Muse, and" (before "you've paid it more").

**The hello** (2:12): strap after "hi im" (4s) / "so on mondays ... than you think" / "on wednesday ... and not believe" / "and then on friday ... buying products" / "every piece ends ... hits go up" / end card. Cut: "So, you know,", "you'll get,", "you can get access to free, sorry,". Replacements: Chris to Krish, theater to theatre.

So the real shape is: **open straight on the news in one sentence ("In September Meta launched..."), put the source's own words on screen, show the opposite reactions, explain how each side gets paid with one everyday example, say what it means for you, end on "So what's our call", a dated prediction and how sure we are.** No greeting beyond the name strap, no subscribe ask in the spoken words (the end card does that).

For the written register the script is cut from, the opening of the same piece (test fixture `piece1-v13`, pre-final):

> Amazon's own annual report says it: $68.6 billion from adverts in 2025. ... On Sunday 20 September, Amazon blocked a shopper who can't be nudged. ... The next day, Shopify went the other way. ... Same robot shopper. Opposite answer. One shop threw it out. One held the door open. What does that tell you about who gets paid, and how? ... Think of Amazon as a giant supermarket. ... Shopify is the till. It gets paid when you pay. ... Here's our guess, and it is a guess: ...

(Note "robot shopper" was later ruled out: say "AI shopping agent".)

## 6. On-screen and visual conventions

- **VISUAL_EXPLAINS (permanent rule, 2026-10-05)**: every graphic makes one critical point land faster than words. Before making it, write the point in one sentence and the viewer question it answers. Build from real checked numbers, quotes, evidence. No figures walking to boxes, no icons acting out an analogy ("who cares about a person walking to a box that says till?"). Test: someone who sees only the visual gets the point.
- **Proof on screen**: open with a legible promise and visible receipts. A proof panel is the source's own words, cream on ink, source named underneath, one **mint** highlight on the words the sentence depends on. Nothing on a panel is model-written.
- **Split frame** in tall (9:16): proof on top, Krish's face band below (eyes must stay in frame), captions on the seam. Wide (16:9): brand panels either side of the speaker.
- **Captions**: 2 to 4 words at a time, sentence case (Archivo), at most one punch word per beat in Anton capitals with the mint swipe. Not all-caps word-by-word (rejected).
- **Ending**: full face delivering the dated prediction, date and confidence on screen. Brand line: "Every piece makes a call. We keep score."
- **House look**: bold, colourful, never "Bloomberg" grey. One loud thing per block; type on a colour block is ink; logo only on ink. Fonts: Anton, Archivo, Fraunces, IBM Plex Mono. Subchannel colour marks only the frame.
- **REAL / THEATRE stamps** (under.the.hood's device): mono, the part named above in lowercase, every stamp shows its evidence.
- Name is always one word, lowercase: **makeyourmindup**.

## 7. Sign-off and CTA

- Spoken: no "like and subscribe", no comment prompt, no moral. End on an implication, a decision, or the call.
- The call format (house rule CALL): what will happen, a date to check it by, how sure we are as a whole percentage ("By 30 June 2027, ... How sure we are: 75%."). Take a clear stance: 70%+ (60% "reads as sitting on the fence"). Held/broke/unclear is marked in public on the date; misses go up as big as hits. For a one-off tip video that sits outside the subchannels the call is optional, but a dated, confident prediction or a concrete "do this on Monday" is the on-brand close.
- The end card (4s, added in the edit) carries the CTA: masthead, "A free publication on how AI really works. You make your mind up.", the three days, "Subscribe free", makeyourmindup.ai.
- YouTube description: hook in ~150 chars, two or three plain sentences, the dated prediction, then "Read the full piece free at makeyourmindup.ai", then 0 to 3 hashtags. Title names who is involved in a plain conflict or change, leaves one question, adds to (does not repeat) the thumbnail text, 60 chars or fewer.

## 8. The three subchannels (stay outside these)

- **follow.the.money (Monday)**: where the money moves in an AI deal and who ends up better or worse off; changes a price, budget or contract decision. Krish: "how to make money with AI".
- **under.the.hood (Wednesday)**: takes apart something that shipped and works, stamping each part real or theatre; changes what you build or buy. Krish: "how to build with it".
- **mind.the.gap (Friday, the hero)**: lines up separate stories, shows the pattern, maps then / now / the forks, and dates what comes next; changes how you think or what you expect. Krish: "the patterns and where they lead".

Every subchannel piece is a 700 to 1000 word article that passed the fact gate, with a dated call; the video is cut from it.

## 9. What the main channel outside them is for

The YouTube channel description: "Short videos from makeyourmindup, a free publication on how AI really works, in plain words." The channel's first job is top of funnel for Mindmake (reputation, not click-through), second is public proof that Krish actually opens the machine, third is paid subscriptions. The hello was the first non-subchannel video: no article, no production brief, no dated call, edited with `scripts/quick-edit`.

So a one-off on the main channel should be: **a standalone, practical, to-camera piece the curious professional can use today** (a tip, a habit, a "how I actually use this" with a real artefact on screen), in the same voice and visual rules, that does not trace a deal's money (follow.the.money), does not dissect a shipped product part by part with stamps (under.the.hood), and does not build a multi-story pattern with forks and a dated call (mind.the.gap). It can nod to the week's news as the reason it matters now, without becoming a news recap ("Reject generic AI news and undemonstrated tool enthusiasm", content-corpus). Show the tip working, name the source of any number, end on what to do next or a clear stance.

Note: one-off videos are not Studio jobs, so they do not pass the engine's fact gate automatically; every number and quote still needs a named source checked by hand.
