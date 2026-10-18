# Friday 16 Oct, mind.the.gap: the nine lines for Krish to read

Article v6 (`docs/plans/2026-10-09-draft-body-v6.md`), saved on piece `904658db-4df2-4537-a0ed-ebe93e081db7`.
The fact check passed every other line. These nine are still blocking: the checker could not match them to a
filed source as it reads them. Krish chose to read them himself (18 Oct). Each line below is as it stands in the
article, then what the filed sources say.

1. **"Think of it as a car, where the name of the AI model, such as Claude Opus 5.5 or GPT-6.1 Sol, is the badge on
the front - like the Audi A3 or Mercedes C Class."**
The car picture is ours, an analogy, not a fact. The model names are real.
2. **"OpenAI has gone the other way - choosing to make make people choose."**
Framing for the next two sentences: OpenAI pulled its router for free users in December 2025 (WIRED) and
retired automatic switching for Plus and Pro in September 2026 (its release notes).
3. **"Then last month, OpenAI retired "automatic switching from Instant to Thinking" for Plus and Pro users, so on
those plans you pick the thinking gear."**
OpenAI's ChatGPT release notes, entry dated 14 September 2026: "We're retiring automatic switching from Instant
to Thinking (reasoning) for ChatGPT Plus and Pro users globally." "Last month" is right if it publishes in
October.
4. **"The same day, OpenAI announced $40 billion of new funding, a raise reported as in the works since January."**
OpenAI's funding post (31 March 2025) and the January report of the talks are both filed. "The same day" is the
day of Altman's "one million users in the last hour" post, also 31 March 2025.
5. **"Over the next few weeks, Anthropic released Opus 5.5, Sonnet 5.5 and Haiku 5.5, and OpenAI released GPT-6.1
Sol and recently Astra."**
Release dates on file: Opus 5.5 on 22 Sep, Sonnet 5.5 on 28 Sep, GPT-6.1 Sol on 29 Sep, Haiku 5.5 on 7 Oct 2026.
6. **"In OpenAI and Harvard's study of 1.5 million ChatGPT conversations, practical guidance, looking things up
and writing made up "nearly 80%" of them."**
The NBER paper (OpenAI with Harvard's David Deming) says these three topics make up nearly 80% of the
conversations in its 1.5 million sample. The checker confirmed both facts, then marked the line on quote
formatting.
7. **"Claude Sonnet 5.5 on its highest setting scored 56 against that 42.3, at about ten times the cost per task of
Opus 5.5 on its lowest."**
Artificial Analysis API, read 17 Oct 2026: Sonnet 5.5 (Max) 56, $5.4609 a task; Opus 5.5 (Low) 42.3, $0.5512.
5.4609 / 0.5512 = 9.9.
8. **"On Anthropic's own chart for one test of computer tasks, Opus 5.5 at medium scored 57.6% for $2.94, against
52.3% for $15.83 from Opus 5 at max."**
Anthropic's Opus 5.5 page, Terminal-Bench 4.0 chart labels: "Opus 5.5 · Med: 57.6% $2.94" and
"Opus 5 · Max: 52.3% $15.83".
9. **"On every current model from Anthropic and OpenAI on those tests, the top thinking setting costs several times more
than the bottom one, and the score rises by a fraction of that."**
Artificial Analysis API rows for every current Claude and GPT model at each setting are filed. For example,
Opus 5.5 goes from $0.55 to $5.98 a task while its score goes from 42 to 58; Sonnet 5.5 from $0.35 to $5.46 while
its score goes from 35.9 to 56.

## What happens next

If they read right to you, say so in your own words. The engine needs one small change (guard G9 in
`docs/COST\_GUARDS.md`) to record a sign-off of named lines; until then the piece cannot move to approved through
the engine. No further paid fact-check run is planned.

## What happened (18 Oct, session_01RY92XqvcV9kwoDWLBnN8fp)

Krish edited lines 1, 2, 3, 5 and 9 above in this file, and on 7 and 8 said: "I have said before that vague
scores mean nothing to a reader, even I dont know what "scored 56 against that 42.3" really even means, and we
shouldnt have to explain it. Same for "scored 57.6% for $2.94, against 52.3% for $15.83"".

- Article v7 (`docs/plans/2026-10-09-draft-body-v7.md`): his edits, with his dash made a comma and "make make"
  made "make"; every test score in the piece said as a plain comparison (his 7 and 8, and four more the new
  article check found, HealthBench included). Line 5: "recently Astra" was wrong on the filed dates (GPT-6
  Astra, 3 Sep, came before Amodei's post); he picked "and put GPT-6 into ChatGPT" (7 Oct, on file).
- One paid rerun, approved at about $0.80 and capped at the 13 changed sentences; 137 kept their result.
- Sign-off (guard G9, now built): 11 lines signed off in his words, in two answers ("Yes, sign all of those
  off" for 1, 2, 3, 4, 6 and 9; "Sign all five off" for 5 and the four plain-words rewrites). The fact gate
  passes on v7, and every blocking publish check passes, including the new PLAIN_SCORES.
