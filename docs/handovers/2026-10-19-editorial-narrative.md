# Handover: the editorial narrative for 19, 21 and 23 October

Start a fresh Claude Code session on `krishanraja/content-engine` and paste: "Read
docs/handovers/2026-10-19-editorial-narrative.md and do what it says." Opus, no agents or workflows.
Run `python3 scripts/check_failures.py` first, then read this file and `config/learnings.json`
(`narrative-before-making` and the five 19 Oct triage entries).

## Start here: ask him the questions, each with a recommendation

Before any narrative, send Krish **one plain message** with the questions below, numbered, each with its
recommendation, so he can reply "agree" or give a number and a change. Do not start a narrative until he has
answered 1 to 4 (they fix the end messages). Record his answers in the narrative files and, where an answer is a
lasting rule, in `config/learnings.json`. A question his earlier words already answer is not asked (AGENTS.md,
"Check before you ask"): question 7 below is already answered by his 14 Oct ruling, so it is an action, not a
question.

If he pastes Perplexity's research for Monday (`docs/handovers/2026-10-19-perplexity-argon-prompt.md`), treat it
as unchecked leads: every number is read again at Google's own pricing page at the fact gate.

## The job, and the rule that keeps it short

Krish, 19 Oct: "I want to be crystal clear on the overarching end message and checkpoints of the piece so
that we can't randomly go off track and take ages to iterate." So this session makes **no script, article or
visual**. It produces one signed-off narrative per day, and nothing is made until he signs it.

A narrative is one page, in plain English a 12-year-old follows:

1. **End message**: one sentence. The thing the reader still holds a day later.
2. **Who it is for, and what they do differently on Monday**: a general business leader; one concrete action
   or decision (his test: "how general business leaders would be helped immediately by knowing this").
3. **Checkpoints**: four or five, in order, each with a pass test a reader can check (for example "every
   number matches Google's own page"). Each checkpoint names what Krish signs at that point.
4. **The one picture** the piece needs to land the point faster (house rule `VISUAL_EXPLAINS`: the point it
   carries and the question it answers).
5. **Out of scope**: what the piece will not do (so it cannot drift).
6. **Drift rule**: any change to the end message or a checkpoint goes back to Krish before work continues.

Work one day at a time, Monday first (it is the earliest). Put the three narratives in
`docs/plans/2026-10-19-week/narrative-mon.md`, `-wed.md`, `-fri.md`, and commit them. Ask Krish only what the
picks and his notes below do not answer; send questions as one plain message, numbered.

## The three picks (his, 19 Oct; the board's picks store)

| Day | Piece | Row | His brief |
|---|---|---|---|
| Mon 19 Oct, follow.the.money | If your business builds on Google's AI, your bill doubles on 1 December and almost nobody has priced it in; who wins, who gets squeezed, what to check in contracts | `5b5bfadc-a60c-4d0a-be8e-b2e9bf43d092` | His own plain-English wording (the idea line on the row) |
| Wed 21 Oct, under.the.hood | The bake-off: Grok Bot, Muse and Viktor, OpenClaw as where it started, for a business of 50 to 1,000 people, rated on what each is useful for and what each could break | `d7a20885-7001-4661-b444-9d7ca1043416` | "I want this to be super simple: a bake-off that anyone can understand." His 14 Oct words are in the row |
| Fri 23 Oct, mind.the.gap | Where an AI was built decides what it says no to: ask Claude, then a Chinese model, the same thing | `7083d6ad-419e-4fdc-9aba-f3be7f3f3a23` | His own cold idea ("unpacking models by country"); no verdict or angle given beyond the pick |

All three are `drafting` and scheduled for their days (no making session was started). The board is
https://claude.ai/artifact/CDgS3JDULpzvRnxkHwLkVk (version 4); the second link in `config/boards.json`
is on his other account and not updated.

## Proposals to react to (mine, not his: labelled so, per AGENTS.md)

- **Mon end message:** "From 1 December Google's newest AI costs twice as much unless your set-up reuses what it
  has already read, so check which side of that line you are on before the bill arrives." Checkpoints: (1) every
  number matches Google's own pricing page, including the cached-input figure; (2) who wins, who gets squeezed,
  in three plain groups; (3) the list of what to check in your own contracts; (4) one picture of the same
  workload's bill before and after, cached and not. Out of scope: model quality.
  **Open fact, do first:** his text says cached input costs "a tenth". The figures on the row give a twentieth
  ($0.10 against $2 now, $0.20 against $4 after); the row's older text said "95%". Recheck on Google's page.
- **Wed end message:** "Before you hand an AI assistant a real job in a company of 50 to 1,000 people, here is
  what each popular one is good for and what each could break, tested the same way." Checkpoints: (1) the
  contestants and the two scores (useful for, could break) fixed before testing; (2) three or four ordinary
  business tasks, the same for all; (3) a results table anyone can read; (4) one plain verdict per contender.
  Out of scope: how they work inside; the connectors piece (queued).
- **Fri end message:** "The same question can get a different answer, or a refusal, depending on which country
  built the AI, so test the one you rely on with a question your business depends on." Checkpoints: (1) a
  dated side-by-side test of identical prompts on Claude and a Chinese-built model; (2) the Christian Science
  Monitor figures read at the original, not second hand; (3) a plain list of what changed between answers; (4)
  a test the reader can run themselves. Out of scope: politics beyond what the test shows.

## What his triage taught (apply to every narrative)

Full entries are in `config/learnings.json`. In short: the business-leader test; plain version first, then
unpack each party's motive; follow.the.money shows where the money moves; no repeat of a topic within three
weeks; read only the final state of his marks.

His queue (GET `/api/idea-queue`): mon-2 Character.AI (angle: "Why is Disney going after it, and why is Google
going after it? ... Unpack both."), mon-3 free-image ads (curious: wants the content-IP money trail drawn),
mon-4 Microsoft's own chip (angle: "aggressive vertical integration ... really simplified and unpacked"),
wed-2 connectors (story). Dropped: Apple HomeView, the OpenAI safety firings. Passed for now with reasons:
Wednesday's AI-shopper rulebook (too soon after last week), Friday's face-and-voice law, video-call proof and
$55 boxes (no immediate use for a business leader).

## The questions, with recommendations (send these as one message)

**About the three pieces**

1. **Argon: which figure?** His text says cached input costs "a tenth". The row's figures give a twentieth
   ($0.10 against $2 now, then $0.20 against $4), and the row's older text said 95%.
   *Recommend:* use whatever Google's own pricing page shows, worded as "about 95% cheaper" if it confirms the
   twentieth. Never print "a tenth" unless the page supports it (hard gate: never invent a number).
2. **Monday: what is the one action?** "Find out whether your AI reuses what it has already read, and what your
   contract says about the 1 December price", or "renegotiate before December".
   *Recommend:* the first. It is something a general business leader can do this week with a question to their
   vendor; renegotiating comes after they know where they stand.
3. **Wednesday: who is in the bake-off, and which tasks?**
   *Recommend:* Grok Bot, Muse and Viktor scored; OpenClaw told as where it started, not scored. Four plain
   tasks the same for all: summarise an email thread and draft the reply, set up a meeting, find and buy a small
   item inside a spending limit, answer a customer question from the company's own documents. Two scores each:
   what it is useful for, what it could break. One piece, kept super simple.
4. **Friday: what should a business leader do after reading it?** (The only pick with no angle from him.)
   *Recommend:* "Ask the AI you rely on, and one built in another country, the same three questions your
   business depends on, and see where the answers differ." End message as proposed above.

**About the rules and the loose ends**

5. **Make "narrative before making" standing?** (A step in `make-piece`, with the drift rule.)
   *Recommend:* yes. It costs one page per piece and it is the cheapest guard against the long iterations he
   described. If yes, add it to `.agents/skills/make-piece/SKILL.md`, sync, and mark the learning encoded.
6. **Which "curious, not queued" ideas stay?** *Recommend:* keep only Wednesday's AI-shopper rulebook (parked,
   with his reason, until there is a new story); let go of the face-and-voice law, video-call proof and $55-box
   ideas, which failed the business-leader test and have no obvious way to pass it.
7. **The second board link** (`4SZR…`, his other account). *Not a question:* on 14 Oct he ruled that both boards
   stay synchronised ("make sure this board and that board are always synchronized"). So it stays in
   `config/boards.json`, and a session on that account rebuilds with `week_board.py --week 2026-10-19 --live
   --ideas docs/plans/2026-10-19-week/ideas.json --queue <saved GET /api/idea-queue> --previous <that board>`
   and republishes to that link. Remind him once.

**About the four ideas in his queue** (each also carries its question on Control Center's Queue page)

- **Character.AI:** run it after the 30 October bidding hearing, when there is an outcome; the business action is
  to check what your contract says if your AI vendor fails or is sold (can you get your data back, who owns it).
- **Free-image ads:** the end message is "if you are not paying, you are the product", with the money trail
  (advertiser, OpenAI, the creators whose work trained the image models) as the proof. Earliest slot Monday 26
  October, once the ads are live in the US.
- **Microsoft's own chip:** the plain pattern, "the biggest buyer builds its own supply", with Microsoft as the
  one example; the question to take away is "whose chips run my workload, and does the price I pay follow their
  cost?"
- **Gmail and Drive connectors:** a standalone piece, not part of the bake-off, so the bake-off stays simple;
  name a tool only where its claim is sourced.
