# Portable Studio session contract

> Scope: the Studio: how an agent opens a tracked session and what it may capture. The content engine's agent rules are in `AGENTS.md` and `docs/CONTENT_ENGINE.md`. For the whole system start at `README.md`.

## Outcome

Any supported LLM or Control Center can become a window into the same Video and Carousel Studio. The client supplies judgement and conversation. The engine owns commands, reviews, feedback provenance, and learning state.

Connecting this repository is necessary but not sufficient. Repository instructions make the engine discoverable. A tracked remote MCP session supplies authenticated capabilities and durable event capture.

## Authority

| State | Allowed behavior |
|---|---|
| `tracked` | Use only the capabilities returned by `studio.session.open`. Gateway actions are recorded idempotently. |
| `read_only_untracked` | Read repository guidance and reason about supplied material. Do not mutate jobs, decide reviews, or claim learning capture. |
| Gateway unavailable | Fail as read-only. Never create a local or client-specific memory store. |

GitHub owns code and versioned configuration. Control Center and Supabase own safe session and learning projections. The Windows runner and local append-only job ledger own exact media execution. Google Drive owns intake and approved archives.

## Session start

1. Read `AGENTS.md` and this file. Then read the idea queue, first in the chat: `python3 scripts/engine.py GET /api/idea-queue` (Krish, 2026-10-19: the queue "needs to survive everything and be the first thing in chat"). Say how many ideas wait and how many have no verdict yet; offer from it before any new research.
2. Call `studio.capabilities` if the client exposes it.
3. Call `studio.session.open` with the client name and current repository revision.
4. Display the tracking state and capability limitations before the first mutation.
5. Use the returned `session_id` for every later Studio tool call.

The session actor is always `Krish`. A client must not infer another public name from account metadata.

## Continuous capture

The gateway records the engine action as part of the same transaction that performs or queues it. Learning does not depend on the model remembering an end-of-chat hook.

Capture only:

- tool-backed actions and their idempotency keys;
- exact artifact hashes and bounded structured differences;
- an exact user excerpt only when it is explicitly relevant feedback;
- a concise inferred rationale, confidence, scope, and confirmation state;
- client, session, job, tool, and request-hash provenance.

Never capture:

- a whole ChatGPT, Claude, Codex, or Control Center transcript;
- raw media, full production transcripts, local paths, secrets, OAuth state, customer records, or command output;
- hidden reasoning or a model-generated claim that Krish expressed a preference.

Silence is not feedback. Unedited acceptance is weak positive evidence. Explicit praise is strong positive evidence. Rejection with a reason and a confirmed correction are strong evidence.

## Feedback confirmation

Portable feedback receipts use:

`studio-user-confirmation:<client>:feedback:<event_hash>:<human-readable receipt>`

Previously stored `codex-user-confirmation` receipts remain valid. A new client must never generate the legacy prefix.

The same portable form is accepted at every approval gate: `studio-user-confirmation:<client>:<gate>:<artifact_hash>:<human-readable receipt>`, where `<client>` is a lowercase token (a letter followed by 1 to 39 letters, digits, underscores or hyphens). Legacy `codex-user-confirmation:<gate>:<hash>:` and `control-center-confirmation:<gate>:<hash>:` receipts remain valid. A reference bound to another gate or hash, or with a malformed client segment, is not a confirmation. The shared check is `confirmationRefMatches` in `@mindmake/contracts`.

Low-confidence inference remains `observation_only`. A confirmed correction may create a narrow rule proposal. Scope broadening still requires three confirmed instances across at least two jobs plus separate approval. Performance proposals require three comparable tests and may never infer personal taste.

## Session close and recovery

Call `studio.session.close` when the client can do so. The response is a receipt containing the event count, observation count, pending confirmations, and event-chain hash.

Session closure is not the source of truth for capture. An inactivity sweeper may close abandoned sessions because every action has already been written continuously.

## Client behavior

- Codex reads `AGENTS.md` and the project `.codex/config.toml`.
- Claude Code reads `CLAUDE.md` and `.mcp.json`.
- Claude.ai, Claude Desktop, ChatGPT, and other remote clients connect to the same HTTPS MCP endpoint through their connector settings.
- Control Center calls the same internal service functions as MCP. It must not maintain a different learning path.

Consumer clients may require a one-time connector approval. GitHub access alone does not grant Studio mutation capabilities.

## Local client setup

On Krish's Windows machines, Codex and Claude Code use the committed stdio proxy (`scripts/studio-mcp-credential-proxy.ps1`, named in `.codex/config.toml` and `.mcp.json`). The proxy reads `MindmakeVideoStudio/studio-mcp-token-v2` directly from Windows Credential Manager inside its own process, pins the production endpoint, and never prints or persists the value. No parent-process environment variable or special client launch command is required. A cloud session has no Credential Manager, so it stays read-only.

Claude.ai and ChatGPT require the separately released OAuth connector. Until that release exists, those clients may read and reason from the repository but must report `read_only_untracked`; they must not reuse the local bearer token.

## The checkout stays on main

Ruling (Krish, 2026-11-15): every session on his computers leaves the content-engine checkout on an up-to-date main,
never stranded on an old branch. On 15 Nov his Windows checkout sat on an old session's branch, local main 1,784
commits behind origin/main, with an uncommitted edit blocking `git pull`.

`scripts/checkout_tidy.mjs` (`npm run checkout:tidy`) puts it back, and touches nothing it could lose:

- It fetches origin main; offline, it does nothing.
- On main with no tracked changes, it fast-forwards (`merge --ff-only`; never a merge commit or a rebase).
- On a branch whose work is already on origin/main (an ancestor, squash-merged with the same patch, or its upstream
  deleted with every file it touched the same on main), it switches to main and fast-forwards. It never deletes a branch.
- Tracked changes, unmerged commits, a local main ahead of origin, or a merge or rebase in progress: it changes nothing,
  prints one line with the branch, the files and the commands to keep them (`git stash push -m ...` or a commit), and
  records the case in the ignored `.scratch/checkout-tidy.jsonl`.
- It skips a linked worktree (`.claude/worktrees`, `.worktrees`), a cloud container (`CLAUDE_CODE_REMOTE`), CI, and a
  checkout another live session holds.

Claude Code runs it by itself: the SessionStart hook (`--hook start`) tidies and then writes `.git/session.lock`
(session id, pid, host, time), and the SessionEnd hook (`--hook end`) removes that session's lock and tidies again. A lock
is stale after 12 hours or once its pid is gone, and is then taken over. Codex reads no hooks, so AGENTS.md's start route
runs it as step 0, before work and again before finishing. It is silent when there is nothing to do and always exits 0.
`CHECKOUT_TIDY_OFF=1` turns it off for one run. Held by `tests/checkout-tidy.test.ts`.

## Running from Claude Code

The session above, step for step, as Codex and Claude Code each run it. Nothing here changes the contract; it says
where each step lives.

| Step | Codex | Claude Code |
|---|---|---|
| Rules | `AGENTS.md` | `CLAUDE.md`, which imports `AGENTS.md` (`@AGENTS.md`) and adds only the routing table, models, hooks and checks |
| Session start | `docs/NORTH_STAR.md`, `python3 scripts/check_failures.py`, `python3 scripts/floor.py`, `WORKBENCH.md`, `NOW.md` | The same. For Studio work, then `studio.session.open` through the `mindmake-studio` server in `.mcp.json`; without a tracked session the session stays read-only and says it is untracked |
| A piece, the week, the videos | `$make-piece`, `$plan-week`, `$produce-video`, `$ve` from `.agents/skills` | `/make-piece`, `/plan-week`, `/produce-video` and `/ve` from `.claude/skills`, exact copies held by `npm run skills:validate` |
| A Studio station | the `mindmake-video` skill and the gateway tools | the gateway tools in a tracked session; `mindmake-video` is not loaded as a Claude Code skill (`scripts/validate-skills.py`, `NOT_FOR_CLAUDE`) |
| Models | `.codex/config.toml`, profile `production` for mechanical work | Opus by default (`.claude/settings.json`); subagents `repo-scout` (Haiku), `executor` (Sonnet), `reviewer` (Opus), and for ve `ve-assets` (Sonnet) and `ve-critic` (Opus), in `.claude/agents/`; `produce-video` on Sonnet by its frontmatter |
| Verification | `npm run verify:quick` (the full `npm run verify` runs after merge) | `npm run verify:quick`; the Stop hook (`.claude/hooks/stop-check.mjs`) also typechecks and runs the related tests whenever a turn changed code |
| Guardrails | AGENTS.md and the sandbox | AGENTS.md plus the hooks in `.claude/settings.json`: secrets and `.env` refused, the North Star refused, every publish, send, deploy, push to main and taste-rule edit put to Krish in person, the cost guards |

Observations are recorded the same way from both: only through the gateway's tool-backed actions and feedback
tools, as `observation_only` unless Krish's own words make a decision, never by capturing the chat.

