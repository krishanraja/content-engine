# Workbench: where we are and what's next

This is the one file every working session reads first and updates last,
whatever tool it runs in: Claude Code (web, desktop or phone), Codex (cloud or
desktop), or anything else that can open this repository. It is how work moves
from one tool to another without anything getting lost. The rules for agents
are in `AGENTS.md`; this file is the live state of the work.

Last updated: 2026-10-03 21:07 UTC, by a Codex session.

## How Krish wants to be worked with

- Plain words. Nothing he reads may contain codes, labels, hashes, version
  numbers or project shorthand. Say what happened, what it means for him, and
  what you need from him. If a sentence would confuse someone outside the
  project, rewrite it.
- After everything you do, update the board (below), and end every reply to
  him with its link: https://controlcenter.krishraja.com/#/board. Update this
  file when how the work is done changes.
- Make the call and say what you assumed. Ask only when the answer changes the
  shape of the work, and offer your best guess with the question.
- His decisions are his alone. Record one only when he made it in words, with
  `decided_by: 'Krish'` (`AGENTS.md`).

## The board: what is waiting on Krish, in progress and done

The live list lives in the shared database, not in this file. Krish sees it in
Control Center at https://controlcenter.krishraja.com/#/board (phone or desk)
and replies to items there. Every session, in Claude Code or Codex, reads and
writes it through the engine:

- Read it: `python3 scripts/engine.py GET /api/workbench --full` (`python` on
  Windows). His replies
  are in `replies`; `unseen_replies` counts the ones no session has acted on.
- Add or change items (up to 50 at once; an existing item changes only the
  fields you send):
  `python3 scripts/engine.py POST /api/workbench @items.json` with
  `{"action": "upsert_items", "client": "codex", "items": [{"id": "p3-approve", "lane": "on_you", "rank": 2, "area": "Article 3", "title": "...", "detail": "...", "prompt": "Yes, or what to change"}]}`.
  Lanes: `on_you`, `in_progress`, `done`, `archived` (hidden). Ids are
  lowercase words joined by hyphens. Links must start with `https://`.
- Change the headline or the status lights: `{"action": "set_state",
  "headline": "...", "signals": [{"label": "Home computer", "state": "ok",
  "text": "On and ready"}]}` (state is `ok`, `warn`, `bad` or empty).
- After you act on his replies: `{"action": "mark_seen", "ids": ["<reply id>"],
  "client": "codex"}`. The board then shows him that you read it.
- Only Krish writes a reply, from Control Center. The engine key cannot: a
  session must never put words in his mouth.

Set `"client"` to `"codex"` or `"claude_code"` so the board says who changed it.
Write every item in plain words: what happened, what it means for him, and what
you need from him.

## Pick up from any tool

Everything that matters lives in two places every tool can reach: this
repository on GitHub (code, rules, this file) and the shared database (the
articles, Krish's decisions, each channel's rules). Nothing important lives
only in a chat.

| Tool | What it can do | What it needs |
|---|---|---|
| Claude Code on the web, desktop or phone | Everything except running the video studio | This repository, and the engine key as the secret `ENGINE_OPERATOR_TOKEN` in its environment |
| Codex in the cloud | The same | This repository connected, and the same secret in the Codex environment |
| Claude Code or Codex on either Windows home computer | All of the above, plus the video studio (`docs/ENGINE_SESSION.md`) | Run `scripts/engine-key.ps1` once on that machine (the engine key then lives in Windows Credential Manager and the helper reads it from there). Work in Krish's own copy at `C:\Users\krish\dev\content-engine`, where he keeps his repositories, never in the runner's folder (`Documents\MindmakeVideoStudio\runner-source`), which must stay untouched. In Codex, run the engine helper and `git pull` or `git push` outside the sandbox (ask for escalated permissions; Krish approves): Codex's sandbox runs as a separate Windows user that cannot see the key or reach the internet |
| A plain chat (Claude.ai, ChatGPT) with no repository | Talk and plan only | Paste this file in |

To start a session in any of them: read `AGENTS.md`, then this file, then do
the top item that is not waiting on Krish. Before you stop, update this file.

Krish starts a session by pasting this:

> Continue the Mindmake content engine. Read AGENTS.md and WORKBENCH.md, then
> read the board and my replies on it. Tell me in plain words what is waiting
> on me and what you will do next, then do the top thing that is not waiting
> on me. Update the board and WORKBENCH.md before you stop, and end every reply
> with the board link.

He may add a line saying what he wants today; that comes first.

Talk to the engine with `python3 scripts/engine.py METHOD PATH [body]`, for
example `python3 scripts/engine.py GET "/api/content-ideas?id=<id>"`. On
Windows the command is `python`, not `python3`. It reads the key from
`ENGINE_OPERATOR_TOKEN`, or on a home computer from Windows Credential
Manager, and never prints it. When it has no key it says why and what to do;
inside Codex's sandbox on Windows, that means running it again outside the
sandbox with Krish's approval. Never ask Krish to paste the key into a chat.

## Latest handoff

- The board was read and read back on 2026-10-03. There were no new replies
  from Krish. Another session briefly added a Codex access action; this session
  proved access and moved it to done. The waiting list is now: make the access
  fix live, article 1's video, article 3, the phone redesign, the timer judges
  and, after the first video exists, its final look.
- The highest risk that needed no decision was the remaining group of content
  actions that checked only which kind of request arrived. Thirteen of them
  can change decisions, spend money, start the document factory or remove a
  proposed shift. They now use the same locked door as article writing.
- The focused access checks, the content engine's type check and the secret
  scan pass. The full test run found five older brief-rewrite tests that did
  not bring a key through the new door; those tests were corrected and pass,
  while every other test passed on the first run.
- This security fix is committed on this computer but is not live. Pushing it
  would deploy it, so the next action is Krish's approval to make it live.

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
