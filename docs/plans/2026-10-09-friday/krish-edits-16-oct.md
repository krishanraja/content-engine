# Krish's own edits to Friday's scripts, 16 October 2026 (v5 to v6)

Piece `904658db-4df2-4537-a0ed-ebe93e081db7`, mind.the.gap, "Soon you won't pick your AI".

He signed both scripts off at about 21:02 UTC ("OK, signed off.") and they went to his
teleprompter. Between 21:28 and 21:32 UTC he re-edited both himself on the week's board
(EDIT threads 974513e6, 7953818e and aef216ab on the deep cut, 1ee337c8 on the 90-second
cut), then in chat: "edited the scripts again, log what changed and reflect on why i
changed them, and push these to releprompter", and "just put them in teleprompter, and
then if I go over 90sec, just speed the video up a bit in post".

His words went in as he wrote them: `docs/plans/2026-10-09-script-90s-v6.md` and
`-script-deep-v6.md`, recorded with `making.py scripts --krish-words` (every story-check
finding kept on the record), read back as approved by him, and updated in place in
Teleprompter at 21:44 UTC. The v5 files are the versions he signed off.

## What changed: the 90-second cut (190 words, about 87 s, to 274, about 1:50)

| | v5 (signed off) | v6 (his edit) |
|---|---|---|
| Opening | "I've been keeping a beady eye on what's coming with AI, before everyone notices. I'm Krish." | gone: no series line, no name |
| Hook | "I use AI apps daily. Each AI gets a new name. Does the name you pick change the answer you get?" | "Something weird is happening with ChatGPT and Claude. I use AI apps daily, and I'm not sure if I'm the only one but it feels like there's a new model release EVERY DAY. So I investigated if it actually means anything, and what its pointing at." |
| The claim | "I think how hard AI thinks matters more." | "What I found is that how hard AI thinks matters more than the model." |
| The car | "The name is the badge. How hard it thinks is the gear. It's a manual car. You change gear." | "The name of the model is like the badge. Opus 5.5, Mercedes C Class. How hard it thinks is the gear - 1st, 2nd, 3rd. And right now, AI tools are like a manual car." |
| Their motive | (later, in "Why do apps start you in low gear?") | new, early: "It feels like ChatGPT and Claude want you to think about the badge but not the gear changes." |
| Sally | unchanged | unchanged |
| The test | "In a hard test, the newest Claude Opus in its lowest gear lost to the older one in top gear." | "In a tough reasoning test, the newest Claude Opus in its lowest gear actually lost to the older one in top gear." |
| The why | "Why do apps start you in low gear?" | "So why do these tools start you in 1st gear?" |
| The bet | "starts in automatic. It picks the gear. You won't see which." | "will start you in automatic - all the choices will go away. ChatGPT will pick the gear based on how hard it thinks it should think. You won't actually get much of a choice." |
| The close | "Tell me: do you change gear? Make your mind up." | "Tell me: do you prefer to control how your AI thinks, or are you going to outsource it?" (no "Make your mind up") |

## What changed: the deep cut (1,700 words to 1,810, about 12 minutes)

| | v5 (signed off) | v6 (his edit) |
|---|---|---|
| Opening | the series line, with "I'm Krish." | gone: it opens "I've been using all the well-known AI apps every day for years now." |
| What he noticed | "And I've noticed something odd about how they're sold." | "And I don't know about you, but I feel like the amount of new releases of AI models is getting out of hand." |
| The launches | "A new number, a livestream, a chart. ... Then Opus 5.5. At this rate, when's Opus 5.56 coming out?" | "A new intelligence number, pegged to a new model number. ... Now Opus 5.5." (the Opus 5.56 joke gone) |
| Why watch | "So I wanted to break it down." | "I kind of got lost and so I went down a rabbit hole to figure out where we've come from and where this is all heading. Today's edition of mind.the.gap is a bit longer because it's actually interesting if you want to level up your business with AI." |
| Who decides | "Right now, you do, if you change gear." | adds "- which is the thinking level, not the model name." |
| Gemini Auto | "The next step is the AI choosing the gear for you" | "I can see what's happening here. The next step ..."; "actually already starts on a setting called Auto" |
| His guess | "I don't think that lasts, and here's my guess why." | "I don't think that lasts - not for the masses anyway, and here's my guess why." |
| Confidence | "I'm 85% sure, so pretty certain this will happen." | "I'll chalk this one at 85% confident, so pretty certain this will happen." |
| The close | "That's it for this week's mind.the.gap. ... Tell me in the comments: do you pick the gear, or leave it? Make your mind up." | no sign-off line and no comments question; instead "It's worth thinking about who chooses how hard your AI thinks in a world - otherwise we're all about to get a lot dumber. Check out next week's episodes where we deep dive under the hood of the emerging AI products that are about to hit your phone and start taking a lot more control of it - the next few months are going to be interesting! I'll see you then." |

Everything else in the deep cut, from "Some of the new AIs are better" to the Formula 1
paragraph, is word for word the version he signed off (his 18:47 car paragraph included).

## What the gates say about his words (kept on the record, waived on his words)

- Both: no series line (house rule SERIES_OPENER), and neither opens on its question.
- 90-second: 274 words against his own "around 85 seconds" (he chose to speed it up in
  post instead: about 1.2x at 150 words a minute); three sentences over 20 words, the
  longest 25; "model" not explained in its first sentence.
- Deep: 1,810 words, about 12:04, just over the 8 to 12 minutes; five sentences over 20
  words, the longest 42 (the next-week teaser).
- The script check also called "1st gear" a bare score. That was the check's mistake (an
  ordinal is a place, not a score) and it is fixed in `story_check.py`, with a test.

## Why he changed them: a reflection, held to the evidence

Two independent readings (voice and delivery; audience and strategy) gave a reason for every
change, and a third, a skeptic, kept only what his own words or a clear pattern in his edits
support. He has not said why for most of these, so most are marked "probably".

**What his own words back (evidenced)**

- **He does not want the engine's series line, with his name, opening the 90-second cut.** At
  17:16 he rewrote it without "I'm Krish" ("...to try and map out what you're likely to be up
  against next."); the engine then made the deep cut's version, with his name, the standard line
  for both; tonight he took it out of both. Why (the first seconds on a phone, or a line that
  sounds bolted on) he has not said.
- **Every time the car comes back, he says what it stands for.** "The name of the model is like
  the badge", "Opus 5.5, Mercedes C Class", "the gear - 1st, 2nd, 3rd", "which is the thinking
  level, not the model name". This is his 18:40 ask word for word: "be clear what we are equating
  the business name, LLM name, model name and thinking levels to".
- **For this piece, how it sounds comes before the length limit**, and the edit fixes the time:
  "if I go over 90sec, just speed the video up a bit in post". About 1.22x reaches 90 seconds;
  about 1.29x his earlier "around 85 seconds".
- **Spaced hyphens and capitals are his reading marks** ("- it will pick that for you" at 17:16,
  "EVERY DAY" tonight). The engine took them out each time; on a teleprompter they are where he
  breathes and where he leans.

**What is probably true (a fair reading, not his words)**

- **He tells it as his own search, not a lesson.** "I kind of got lost and so I went down a rabbit
  hole", "So I investigated", "What I found", "I can see what's happening here": four discovery
  lines across the two cuts, the "here's what I'm seeing" voice he asked for on 13 October,
  pushed further than the engine took it.
- **He invites the viewer in with a feeling first.** "I don't know about you, but I feel like..."
  and "I'm not sure if I'm the only one but it feels like...": the casual style he said the scripts
  were for ("Only the script is what I wanted to experiment with in the casual Hannah Fry style").
- **Cutting "At this rate, when's Opus 5.56 coming out?"** was probably his answer to the board's
  open call ("keep or reword 'Opus 5.56'"), after the free pre-check found no source for 5.56, not
  a change of voice. The article still has its own version of that call.
- **"Today's edition of mind.the.gap is a bit longer..."** warns that this one runs long, gives a
  reason to stay, and now carries the series name near the start, where the series line was.
- **"not for the masses anyway"** narrows his claim so it agrees with his own bet (paid plans keep
  a semi-automatic setting); "the masses" is his word from 17:16.
- **The new comments question** ("do you prefer to control how your AI thinks, or are you going to
  outsource it?") says the choice in plain words, not in car words.
- **The deep cut now ends on the stakes and next week**, with no comments question and no "Make
  your mind up". No house rule requires the slogan; HOOK_AND_CTA does ask for a comments question.

The skeptic threw out, among others: that he cut the series line for YouTube retention (he never
said so), that "chalk" hints at a scorecard, that "outsource" was chosen for a business viewer, and
that two "I've been" lines sounded like a jingle (he wrote exactly that opening himself at 17:16).

## What two fresh 12-year-old readers made of it

All four retold both cuts correctly: the name matters less than how hard the AI thinks, Sally,
the test, the money, and the bet. Of his new lines, the ones both readers of a cut stumbled on:
"I'll chalk this one at 85% confident" and "who chooses how hard your AI thinks in a world -
otherwise we're all about to get a lot dumber" (deep); "what its pointing at" and "outsource it"
(90-second). Single readers also named "pegged to a new model number", "level up your business"
and "Opus 5.5, Mercedes C Class".

## What the facts say about his new lines (checked against the piece's evidence)

- **Worth fixing before it is said: "So why do these tools start you in 1st gear?"** It comes
  straight after the Claude test, so it says Claude starts you on its lowest setting. ChatGPT does
  (Instant); Claude's newest Opus starts on medium, the second of five levels (Anthropic's effort
  docs, read 15 Oct). "So why does ChatGPT start you in 1st gear?" is true. The deep cut's "most of
  us drive everywhere in first gear all the time", which he signed off, has the same question for
  the fact check.
- **Worth a word:** "a tough reasoning test" (the Artificial Analysis index is ten tests, mostly
  agent, office, coding and knowledge work; "a tough test" is exact); "matters more than the model"
  is now said as a finding (the evidence backs "often matters more"); "all the choices will go
  away" says more than the 85% call, which still holds if a manual choice remains; "Mercedes C
  Class" pairs an Anthropic model with the article's Google counterpart, and a C Class is a car
  line, not a badge; "next week's episodes ... about to hit your phone" promises more than one
  piece, and Muse is already out.
- **Fine:** the Gemini Auto date, the run of Opus names, "a new model release EVERY DAY" (said as a
  feeling, and 15 Claude names in 12 months backs it), and ChatGPT picking the gear "based on how
  hard it thinks it should think".
- Typing: "what its pointing at" is "it's"; "in a world -" breaks off before what the world is.

## What the engine takes from it

- **Standing, already his words:** when the car comes back, say what each part stands for and
  check the pairs against the article's mapping (carmaker = company, car = family, badge = model
  name, gears = thinking levels). The pictures under "Mercedes C Class" and "1st, 2nd, 3rd" show
  the real Claude menu, never a car (ANALOGY_IN_SCRIPTS_ONLY).
- **This piece:** his v6 words went in exactly as written; doubtful bits are notes beside the
  script, never quiet edits. The 90-second cut is sped up in post. His three new lines are in
  `config/golden-examples.json` (the deep cut's opening, the 90-second hook, the comments question).
- **Built tonight:** `making.py scripts --krish-words`, so his own words go through a failing
  check with every finding kept on the record, instead of a session overwriting them later; and
  "1st gear" is no longer read as a score.
- **Asked, not assumed:** whether the series line, his name and "Make your mind up" are gone for
  good; whether a long edit means planning for a speed-up from now on or still cutting to fit;
  whether long cuts now end on next week with no comments question. Until he answers, the rules
  stand and the engine does not put the series line back into these v6 scripts.
