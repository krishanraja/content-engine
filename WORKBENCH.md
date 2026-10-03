# Workbench: where we are and what's next

This is the one file every working session reads first and updates last,
whatever tool it runs in: Claude Code (web, desktop or phone), Codex (cloud or
desktop), or anything else that can open this repository. It is how work moves
from one tool to another without anything getting lost. The rules for agents
are in `AGENTS.md`; this file is the live state of the work.

Last updated: 2026-10-03, by a Claude Code session.

## How Krish wants to be worked with

- Plain words. Nothing he reads may contain codes, labels, hashes, version
  numbers or project shorthand. Say what happened, what it means for him, and
  what you need from him. If a sentence would confuse someone outside the
  project, rewrite it.
- After everything you do, update this file. If your tool can reach the work
  board (https://claude.ai/artifact/BytBqVcDsswyFaoyntQwEf, Claude sessions
  only), update it too, and end every reply with that link.
- Make the call and say what you assumed. Ask only when the answer changes the
  shape of the work, and offer your best guess with the question.
- His decisions are his alone. Record one only when he made it in words, with
  `decided_by: 'Krish'` (`AGENTS.md`).

## Waiting on Krish

1. **Say yes to turning article 1 into a video and slides.** Article 1, "Same
   agent, opposite answers" (follow.the.money, Amazon and Shopify), is approved.
   Before its video and slides start, he confirms five things: the facts are
   checked (they are), we are allowed to use everything in it, nothing private
   is in it, the video will not change what it says, and it sits under
   follow.the.money. Suggested: him on camera reading a short script, with the
   evidence shown above him (the style he approved for article 2). His reply
   "yes, make the video" covers all five. Today a few video steps still need
   someone at his home computer.
2. **Read article 3 and say yes or what to change.** "Koa, taken apart"
   (under.the.hood). Every fact is checked. Three small notes, none blocking.
3. **React to the phone redesign** (https://claude.ai/artifact/RkQGVASw3DEAttpcpMoGhp).
   A pretend Control Center that takes one article from draft to posted on his
   phone, video included. Version 1 confused him (made-up labels); version 2 is
   rewritten in plain words. Nothing is built until he says so.
4. **Approve one sample video**, once article 1's video exists. That switches
   on the new makeyourmindup look for videos.

## In progress

- **Making videos from the phone.** Today the video steps after the plan are
  started by hand on his home computer, and only 3 of the 8 places where he
  approves something work from his phone. The plan is in the redesign; the
  build waits on his reaction.
- **His next two articles** start once article 3 is approved: OpenAI's maths
  result and the $22.5M of computing behind it (follow.the.money), and four
  times as many apps with the same number of downloads (mind.the.gap).

## Done recently

- 2026-10-02: Article 1 approved by Krish. Nothing posted.
- 2026-10-02: Buttons no longer fall off the phone screen in Control Center's
  article screen; a test now stops it coming back.
- 2026-10-02: Both home computers set up for video work. The main one is on and
  up to date; the spare one is off, as it should be.
- 2026-10-02: Every channel's rules now ask for a dated prediction at the end of
  each article.

Older history: `NOW.md` (what changed and why) and
`docs/walks/2026-09-three-piece-walk.md` (every step of the first three
articles).

## Pick up from any tool

Everything that matters lives in two places every tool can reach: this
repository on GitHub (code, rules, this file) and the shared database (the
articles, Krish's decisions, each channel's rules). Nothing important lives
only in a chat.

| Tool | What it can do | What it needs |
|---|---|---|
| Claude Code on the web, desktop or phone | Everything except running the video studio | This repository, and the engine key as the secret `ENGINE_OPERATOR_TOKEN` in its environment |
| Codex in the cloud | The same | This repository connected, and the same secret in the Codex environment |
| Claude Code or Codex on the Windows home computer | All of the above, plus the video studio (`docs/ENGINE_SESSION.md`) | The same, plus the studio key already stored on that machine |
| A plain chat (Claude.ai, ChatGPT) with no repository | Talk and plan only | Paste this file in |

To start a session in any of them: read `AGENTS.md`, then this file, then do
the top item that is not waiting on Krish. Before you stop, update this file.

Talk to the engine with `python3 scripts/engine.py METHOD PATH [body]`, for
example `python3 scripts/engine.py GET "/api/content-ideas?id=<id>"`. It reads
the key from `ENGINE_OPERATOR_TOKEN` and never prints it.

## What costs money

Krish pays for the model only when the engine calls it. A session's own
thinking runs on his Claude or Codex subscription. Measured over the 14 days to
2026-10-02 (`meter_daily` in the database):

| What | Cost |
|---|---|
| Judges scoring new ideas on a timer | $39.34 |
| Control Center's people, growth and strategist features | $17.87 |
| Fact checking (mostly repeated checks on articles 1 and 3) | $15.06 |
| Writing and rewriting articles | $2.52 |
| Everything else on the model | about $11 |
| Apify (LinkedIn and job scraping, not the model) | $33.10 |

Writing is cheap; keep it in the engine, where Krish's rules and his edits
teach it. The timer judges are the biggest cost and run whether or not anyone
is working. Before you run anything that spends, check this table is still
true.
