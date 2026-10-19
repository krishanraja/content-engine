@AGENTS.md

Studio entry: follow the shared `docs/ENGINE_SESSION.md` protocol and `studio.session.open` capability gate.

Before any work run `python3 scripts/check_failures.py`, then read the entries in `config/failures.json` and `config/learnings.json` ("say nothing twice", AGENTS.md) that bear on your work.

# Claude Code in this repository

AGENTS.md above is the one set of rules, the same one Codex reads. This file adds only what is
particular to Claude Code: where to read, how to check, which model does what, and how to keep a
session cheap. If anything here seems to disagree with AGENTS.md, AGENTS.md wins; say so and fix
this file.

## Read only what the task needs

Read the one document for the task, then the files it names. Never scan the repository, never
open a whole directory, and never read a file to find out what is in it: find it in
`docs/REPO_MAP.md` first, by searching it (`grep -n -A12 "### \`path"` or a name), never by
reading it whole. It is about 50k tokens.

| Task | Read |
|---|---|
| Pick up where the last session stopped | `WORKBENCH.md` |
| Find a file, a function, a route or a station | `docs/REPO_MAP.md` (search it) |
| Ideas, judging, drafting, rewriting, channel copy, the ledger | `docs/CONTENT_ENGINE.md` |
| Video, carousels, the runner, the renderer | `docs/STUDIO.md`, then `docs/ENGINE_SESSION.md` |
| What works, what is broken, what waits on Krish | `NOW.md`, `docs/STATE.md` |
| How the pieces fit, who owns what | `docs/SYSTEM_MAP.md` |
| Any name (a subchannel, a series, a state) | `docs/GLOSSARY.md` |
| Anything in Google Drive | `docs/DRIVE.md` |
| Anything that costs tokens or money | `docs/COST_GUARDS.md` |
| A service, its secret's name | `docs/INTEGRATIONS.md` |
| Anything else | the table in `README.md` |

`NOW.md` and `docs/STATE.md` are the only current-state documents. Do not start another one.

## Skills: one per job

| Job | Invoke |
|---|---|
| A session that starts `piece_id:`, or a piece Krish picked | `/make-piece` |
| The Sunday plan, or a re-plan of the week | `/plan-week` |
| Krish has recorded; cut and file the videos | `/produce-video` |
| A Studio station (brief, script, render, qa...) | the `mindmake-studio` MCP tools, inside a tracked session (`docs/ENGINE_SESSION.md`) |
| Krish's voice or a channel decision | his account-wide `krish-voice` and `content-corpus` |

The skills live once in `.agents/skills/`; `.claude/skills/` holds exact copies of the three
above (AGENTS.md, Verification). `mindmake-video` and `video-engine` are not loaded here on
purpose; `scripts/validate-skills.py` (`NOT_FOR_CLAUDE`) says why and fails on any new skill that
is neither copied nor listed.

## Models

The session runs on Opus (`.claude/settings.json`, falling back to Sonnet when Opus is
overloaded): writing, judgment and fact reading stay on the strongest model (cost rule 5;
`config/learnings.json`, `cost-never-costs-quality`). Hand work to a subagent only when it needs a
separate reader (cost rule 6, guard G6), and pick by the job:

| Subagent | Model | For |
|---|---|---|
| `repo-scout` | Haiku | lookups and log reading; returns `file:line` and a few lines |
| `executor` | Sonnet | a scoped edit already decided, test runs, renders, packs, filing, board rebuilds |
| `reviewer` | Opus | architecture, the final check before a push, anything touching judging, drafting, the fact gate, mandates or the ledger |

`produce-video` runs on Sonnet by its own frontmatter (guard G8).

## Guardrails that run by themselves

`.claude/settings.json` registers these; they are not optional and not to be worked around.

- `scripts/hooks/cost_gate.py`: the cost guards G1, G5 and G6.
- `.claude/hooks/secret-guard.mjs`: refuses a secret-shaped string in a command or a file, and any
  `.env` write. Its patterns are read from `scripts/secret-patterns.ts`, the list `check:no-secrets` uses.
- `.claude/hooks/publish-guard.mjs`: puts every send, post, publish, schedule, deploy or push to
  main to Krish in person; never allows Teleprompter `move_script` or `update_folder`. The
  standing lanes in AGENTS.md (`send.py`, the Teleprompter send) pass.
- `.claude/hooks/taste-guard.mjs`: refuses `docs/NORTH_STAR.md`; puts the house rules, the taste
  configs and any migration that writes a mandate to Krish in person.
- `.claude/hooks/stop-check.mjs`: at the end of a turn that changed code, runs the typecheck and the
  related tests and sends the session back once if they fail.
- `permissions.deny`: no force push, push to main, hard reset, clean, branch delete, deploy or
  `db push`, and no reading of `node_modules`, build output, renders, lockfiles or fonts.

## Checks

- Before any push: `npm run verify` (it includes `check:repo-map`, so regenerate the map with
  `npm run repo-map` after changing exports, routes or stations).
- Narrower while working: `npx vitest run <files>`, `npm run typecheck`,
  `npm run typecheck:control-plane`, `npm run check:control-plane`, `npm run skills:validate`.
- After editing a skill in `.agents/skills`: `python scripts/validate-skills.py --sync-claude`.

## Keep the session cheap

The six cost rules are in AGENTS.md. In Claude Code they come down to: search the map, never open
files to browse; cap command output (`| tail -20`, logs to `.cache/logs/`); and when the guard G1
nudges past 500k tokens, write the handover and start a fresh session.
