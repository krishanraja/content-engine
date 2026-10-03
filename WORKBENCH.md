# Workbench: where we are and what's next

This is the one file every working session reads first and updates last,
whatever tool it runs in: Claude Code (web, desktop or phone), Codex (cloud or
desktop), or anything else that can open this repository. It is how work moves
from one tool to another without anything getting lost. The rules for agents
are in `AGENTS.md`; this file is the live state of the work.

Last updated: 2026-10-04 00:00 UTC, by a Claude Code session.

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

- Three timed jobs that failed on every run are fixed and merged. The Sunday
  job that turns Krish's edits into suggested rules had never saved one: each
  suggestion lacked the list of edits behind it, which the database requires.
  It now attaches them, so Sunday's run is the first that can save. The Friday
  shift spotter wrote old channel names the database refuses; it now writes
  the current ones. The Saturday build-signals job now says why it fails. It
  still fails until Krish replaces the GitHub key in this engine's own Vercel
  project; the board asks him.
- Krish approved Article 1's clearer wording on 2026-10-03 and made clarity a
  critical rule for every future article. Every sentence must have one clear
  reading. When an unfamiliar mechanism needs help, use a factual historical
  parallel, a familiar analogy or a clearly signposted comic exaggeration that
  does not change the fact. These instructions are now engine house rules for
  writing, checking and visual planning. All 1,107 tests and the repository's
  type, skill, station, renderer, public-copy and secret checks passed.
- Krish approved the two safeguards and exactly one more Article 1 fact-check
  run on 2026-10-04, conditional on learning how to avoid repeated paid checks.
  Both safeguards are live. Article 1's four failed lines were repaired in one
  exact edit: two unsupported details were cut, and the two dated contrast
  sentences became plain source-backed statements. The free preview reported
  59 reusable sentences and four fresh sentences. The run used a hard cap of
  four, ran once, passed with no blockers, and left the exact article ready.
  The article remains in review until Krish approves this exact version. No
  production brief or video job exists, and nothing has been published.
- The repeat-spend cause and prevention are now durable. The earlier result
  predated the sentence ledger, and the paid route offered no preflight or hard
  scope ceiling. The live route now reports settled versus fresh sentences and
  refuses before any model or web call when the fresh scope exceeds the
  approved cap. The capped Article 1 run proved the guard on a real piece.
- The post-run readback exposed a smaller bookkeeping gap: two short scenario
  labels, such as "Guess one.", still appeared as fresh even though the passing
  check had set them aside. This did not block the article or require another
  paid run. A local follow-up now settles an exact short match safely and fills
  deterministic ledger gaps from a successful check of the exact current body
  and sources. The full repository verification passes: 1,109 tests plus the
  type, skill, station, renderer, public-copy and secret checks. It is not
  pushed; making this counter correction live needs a new explicit push
  approval.
- The board failed to render in an already-open tab after a deployment because
  the old app shell requested a route file whose hashed name had been replaced.
  Its Retry button retried the obsolete request; a full reload restored the
  board. The fix is live: Retry performs that full reload only for this class
  of stale-file failure. Its production deployment is ready, its live build
  identity matches the pushed fix, and the board renders after reload. The
  dependency install reported 64 existing audit findings; this narrow recovery
  repair did not change unrelated packages.
- Krish said he is ready to watch the sample. A tracked Studio session found
  no Article 1 video job or review, recorded his relatable-explanation feedback
  without the surrounding chat, and closed cleanly. The Windows runner creates
  that job only after the exact article passes the truth gate and its approval
  is recorded. The first output is a governed phone review.
- Krish agreed to the outside-tools plan. Shape the stack only after real video
  results exist: post the first pieces by hand, collect YouTube results, then
  choose tools from the evidence. No purchase has been made. Runway remains one
  capped illustration test, Higgsfield may be one evidence-checked judge, and
  Native stays out because it would bypass his approval.
- The earlier work remains complete: Article 3 is approved but unpublished;
  the access fix and the timer-judge cost cut are live and verified; elegant,
  exact-artifact feedback at every phone review step remains active Studio
  work.

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

One Article 1 fact-check run completed on 2026-10-03 after this table's
measurement window. Its exact meter delta has not yet been read back.
