# North star

Status: Current
Owner: Krish Raja
Last verified: 2026-09-25

Read this before changing anything in this repository. Every other document
here describes a part of the system; this one says what the whole system is
for, so that a part is never optimised against the whole.

## The objective, in Krish's words

Stated on 2026-09-24, at the start of the first live walk of the engine
(`docs/walks/2026-09-three-piece-walk.md`, section 5):

> "the objective is to train each part of the content ideation, curation,
> iteration, channel selection & copywriting > postproduction so the engine
> can know how to assist me 10/10 at every step, and also learn from every
> live run too. A good example of this is how and when we should make
> interactive artifacts, what they should look like, what the signature tone
> and voice of a carousel format should look like, what the humour and
> delivery of a video short should feel like, etc etc, how a video should be
> post produced in different circumstances (speed vs effort) and so on. Your
> job is to act like a world class creator production team for me and build
> the engine that will build the media business with me"

And on what the machine should do before a piece reaches him, recorded in
`apps/control-plane/api/judge/ladder.ts`:

> "the judges should literally judge, in the machine, before it's presented
> to me for triage with the judges scores. I should always be able to review
> and override on things that score between a 7>9 out of 10 if the machine
> could not find a way to improve the story to get it to a 10/10 itself first
> by going deeper, finding contrarian evidence, asking why."

## Where the engine sits in Mindmake

Mindmake is Krish's AI advisory, education and products business. Its mission
and the reader everything is aimed at are held as code in
`apps/control-plane/api/_mission.ts` (a copy of Control Center's; the upstream
canon is `krishanraja/mindmake`, `project-documentation/00_NORTH_STAR.md`):

- Mission: "Build the company that gives leaders their edge back before what
  is coming takes it, and sell it at scale with my name on it."
- Purpose: "I see what is coming before it is obvious and make it legible to
  people while it still counts."
- The face, the one reader the work is pictured on: "A senior leader who will
  not admit to anyone that they are not ready for what is happening.
  Concretely: leaders of PE and VC backed media, adtech and data businesses
  Krish already knows."
- The engine's job in that plan, job 4 of 5 ("Feed the demand engine"): "Turn
  every room, keynote and podcast into one published piece a week aimed at the
  face, with sources."

The engine exists to make that publication, and the video and carousel work
cut from it, run at the standard Krish would set himself.

## What that means, plainly

This repository is the engine behind Krish Raja's media business: makeyourmindup,
the Mindmake publication (on Substack, cover page at makeyourmindup.ai), and the
video and carousel work made from it. It should behave
like a world-class production team working for one person. It finds what is
worth saying, argues for the best version of it, writes it in his voice to
the mandate of the right subchannel, turns it into the right formats, and
hands him finished work to decide on. Every decision he makes teaches it to
do the next piece better.

Two measures tell you whether the engine is doing its job:

1. **Pieces reach the public.** A piece that meets its subchannel's mandate,
   in his voice, with its evidence dated and attributed, gets published by
   Krish. As of 2026-09-25 no piece has ever been published through the engine
   (`content_ideas.state = 'published'` count: 0). The machinery that chooses
   what to write is mature; the path from a chosen idea to a finished piece
   was walked for the first time on 2026-09-24.
2. **The engine agrees with Krish more often over time.** Each judge's
   prediction is scored against what he actually decided
   (`judge_calibration`), and each correction he makes becomes, with his
   approval, a rule the engine follows next time.

When a choice of work is open, prefer the work that moves a real piece
closer to published, or that makes the engine learn from a decision Krish
actually made. New machinery that serves neither can wait.

## The chain the engine is trained on

Each link is a stage Krish named. "10/10" means the engine does the work of
that stage to the standard he would set, shows its reasoning, and leaves him
only the decision.

| Stage | What the engine does | Where it lives |
|---|---|---|
| Ideation | Collects signals, stories and research; turns them into seeded ideas | `apps/control-plane` (collectors, feeds, research routes) |
| Curation | Judges each idea blind with a panel, repairs what it can, routes it to a subchannel, ranks what is ready | `apps/control-plane` (judge ladder, router); Control Center shows the ranked list |
| Drafting and iteration | Drafts to the subchannel's mandate from everything curation found; rewrites on direction; final pass and draft judges check it | `apps/control-plane` (`draft`, `revise`, `final-pass`, `judge`) |
| Channel selection and copy | Chooses the formats a piece should take and writes each one natively | `apps/control-plane` (channel cuts, production brief) |
| Production | Turns an approved brief into a Short or a carousel through gated stations | the Studio: `packages/`, `apps/runner`, `apps/renderer` |
| Post-production | Treatment, styleframes, animatic, render, QA, platform packages | the Studio |
| Publishing | Nothing publishes itself. Krish posts, or approves a private upload | Krish |
| Learning | Records what he decided, scores the judges against it, proposes rules for his approval | the edit ledger and `judge_calibration` (content); the Studio learning spine (media) |

`docs/SYSTEM_MAP.md` has the full map, with every route and table.

## The rules that make the learning honest

These rules exist so that the engine learns Krish's taste and never an
imitation of it. They are hard rules and outrank convenience.

1. **Only Krish's decisions are taste.** Anything an agent or the engine does
   by itself is an observation. In the content ledger that means
   `actor = <agent client>` and `confirmation_state = 'observation_only'`,
   and the weekly compiler never learns from such rows
   (`apps/control-plane/api/_editEvents.ts`, `operatorAttribution`).
2. **Every durable taste rule needs his explicit approval** (`AGENTS.md`).
   A rule starts as a proposal, may be trialled, and becomes active only when
   he approves it and it lands in code or configuration.
3. **Silence is not feedback** (`docs/ENGINE_SESSION.md`). No answer is never
   recorded as a preference, and an agent never writes that he expressed a
   preference he did not state.
4. **Approve, drop and publish are his.** An agent may relay a decision he
   made in words (`decided_by: 'Krish'`); it may never take one.
5. **The mandate is the test.** Each subchannel's mandate lives in the
   database (`venture_formats.mandate`) and is read live by every drafting and
   checking stage. No document or prompt keeps a copy that could drift.

## The publication it serves

The publication is **makeyourmindup** (Krish, 2026-09-25): hosted on Substack,
with its cover page at makeyourmindup.ai. How it looks, sounds and moves on every
surface is in `docs/CREATIVE_IDENTITY_UPGRADE.md`.

Three subchannels, each with a standing question and a mandate that decides
the structure and the close of every piece. The mandates are authoritative
only in `venture_formats`; the lines below are orientation.

| Subchannel | The question it asks | The reader changes... | Cadence (live table, 2026-09-25) |
|---|---|---|---|
| mind.the.gap | What is the pattern, and what does it mean is coming? | how they think or what they expect | Fridays, 1 a week; the hero subchannel |
| follow.the.money | Where does the money move, and who ends up better or worse off? | a price, a budget or a contract | Wednesdays, 1 a week |
| under.the.hood | What actually goes together in a shipped thing, and why did this one work? | what they build or buy | no fixed day, 1 every two weeks |

Krish's own one-line version (2026-09-24, recorded in Control Center's
`NOW.md`): "follow.the.money is how to make money with AI, under.the.hood is how to
build with it, mind.the.gap is the patterns and where they lead".

The right-hand column is the boundary rule, and it settles every contested
subject: the question decides, never the surface. `general` and `either` are
holding rows, never destinations. Retired names and their live equivalents
are in `docs/GLOSSARY.md`.

## What the engine is not

Each line is a rule already written elsewhere in this repository; the source
is named so it can be checked.

- An autopublisher. Public publishing is never automatic (`AGENTS.md`).
- A source of taste. It proposes; Krish decides; the record shows why
  (`AGENTS.md`, `docs/ENGINE_SESSION.md`).
- A second dashboard. Control Center (`krishanraja/control-center`) is where
  Krish works, and this repository serves it (`AGENTS.md`).
- A memory of chats. It keeps structured decisions and exact feedback
  excerpts, never a transcript (`docs/ENGINE_SESSION.md`).
