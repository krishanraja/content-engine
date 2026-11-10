@AGENTS.md

Studio entry: `docs/ENGINE_SESSION.md`, `studio.session.open`. Video: `python scripts/ve.py`; read `docs/ve/ENGINE.md`, follow `docs/ve/RUNBOOK.md`. One signed spec; no per-piece compositions or render scripts. ve has no publish verb. Codex builds devices from cards. Quick-edit stays the fallback until ve passes Phase 3. Local runs: `. scripts/ve-env.sh` (Bash). AGENTS.md owns these rules and records current code/procedure gaps; read its Video production section.

Before any work run `python3 scripts/check_failures.py`, then read the entries in `config/failures.json` and `config/learnings.json` ("say nothing twice", AGENTS.md) that bear on your work, and `python3 scripts/floor.py --format <maker>` for what you are making (the rejection floor, AGENTS.md rule 20).

# Claude Code in this repository

AGENTS.md above is the one set of rules, the same one Codex reads. This file adds only what is
particular to Claude Code: where to read, how to check, which model does what, and how to keep a
session cheap. If anything here seems to disagree with AGENTS.md, AGENTS.md wins; say so and fix
this file.

## Read only what the task needs

Read the one document for the task, then the files it names. Never scan the repository, never
open a whole directory, and never read a file to find out what is in it: find it in
`docs/REPO_MAP.md` first, by searching it (`grep -n -A12 "### \`path"` or a name), never by
reading it whole. It is about 270 KB (some 65k tokens).

| Task | Read |
|---|---|
| Pick up where the last session stopped | `WORKBENCH.md` |
| Find a file, a function, a route or a station | `docs/REPO_MAP.md` (search it) |
| Ideas, judging, drafting, rewriting, channel copy, the ledger | `docs/CONTENT_ENGINE.md` |
| Video | `docs/ve/ENGINE.md`, then `docs/ve/RUNBOOK.md` (`docs/ve/STATUS.md` says what ve can do today) |
| The week's publish board | `docs/PUBLISH_BOARDS.md` |
| The carousel standard (Growth makes the carousels) | `docs/CAROUSEL-STANDARD.md` |
| The Studio runner or the renderer | `docs/STUDIO.md`, then `docs/ENGINE_SESSION.md` |
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
| A piece on ve (its spec is `schema_version: 2`), or a ve Codex task card | `/ve` |
| A Studio station (brief, script, render, qa...) | the `mindmake-studio` MCP tools, inside a tracked session (`docs/ENGINE_SESSION.md`) |
| Krish's voice or a channel decision | his account-wide `krish-voice` and `content-corpus` |

The skills live once in `.agents/skills/`; `.claude/skills/` holds exact copies of the four
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
| `ve-critic` | Opus | the non-producer review of a ve cut, after `ve qc` and `ve refs`; it writes the verdict and never edits the spec |

`produce-video` runs on Sonnet by its own frontmatter (guard G8).

## Guardrails that run by themselves

`.claude/settings.json` registers these; they are not optional and not to be worked around.

- `scripts/hooks/cost_gate.py`: the cost guards G5 and G6 (G1, the context nudge, removed by Krish on 2026-11-03).
- `scripts/hooks/artifact_gate.py`: refuses every Artifact publish and every ArtifactData write (Claude
  artifacts are retired; AGENTS.md rule 3).
- `.claude/hooks/secret-guard.mjs`: refuses a secret-shaped string in a command or a file, and any
  `.env` write. Its patterns are read from `scripts/secret-patterns.ts`, the list `check:no-secrets` uses.
- `.claude/hooks/publish-guard.mjs`: puts every send, post, publish, schedule, deploy or push to
  main to Krish in person; never allows Teleprompter `move_script` or `update_folder`. The
  standing lanes in AGENTS.md (`send.py`, the Teleprompter send) pass.
- `.claude/hooks/taste-guard.mjs`: refuses `docs/NORTH_STAR.md`; puts the house rules, the taste
  configs and any migration that writes a mandate to Krish in person.
- `.claude/hooks/stop-check.mjs`: at the end of a turn that changed code, runs the typecheck and the
  related tests and sends the session back once if they fail.
- `.claude/hooks/codex-login.sh` (SessionStart): silent when Codex is signed in; otherwise starts the ChatGPT
  device sign-in and shows Krish the link and code (installing Codex first in a cloud container).
- `.claude/hooks/harness-closeout.mjs`: at the end of a turn that committed work and left `NOW.md`
  untouched, sends the session back once with the closeout steps.
- `scripts/taste_backstop.py`: at session end, keeps Krish's own typed corrections in the ignored
  `.scratch/taste/backstop.jsonl` for the runner to send to his taste ledger.
- `permissions.deny`: no hard reset, clean, branch delete, `git checkout --`,
  `git restore`, deploy or `db push`, and no reading of `node_modules`, build output, caches, job
  data, archives, renders, lockfiles or fonts.

## Checks

- Before any push: `npm run verify` (it includes `check:repo-map`, so regenerate the map with
  `npm run repo-map` after changing exports, routes or stations).
- Narrower while working: `npx vitest run <files>`, `npm run typecheck`,
  `npm run typecheck:control-plane`, `npm run check:control-plane`, `npm run skills:validate`.
- After editing a skill in `.agents/skills`: `python scripts/validate-skills.py --sync-claude`.

## Do what was asked, prove what you claim

Krish, 2026-10-19: "I requested three Markdown files for download, which you've not given me, and now it looks
like you're just off doing more random shit. I asked you to heal the engine, not to reproduce the videos."

- Deliver the thing asked for first, in the form asked: files he asks for are sent to him as files
  (`SendUserFile`) in the same turn, before anything else.
- Work handed to another session or tool is theirs. Do not start it yourself, not even "just to check".
- Never tell him a cause is found until a test you ran proves it. Write "suspected" until then. A measurement
  must not share the fault it is measuring (seeking by timestamps cannot measure a timestamp problem).
- Never call a video done from proxy checks. Watch it at full size and hear it against its script first
  (`config/failures.json`, `cut-called-done-unheard`).

## Keep the session cheap

The six cost rules are AGENTS.md rule 4 (in full in `docs/AGENTS-REFERENCE.md`). In Claude Code they come down to: search the map, never open
files to browse; cap command output (`| tail -20`, logs to `.cache/logs/`); and finish the job in the session he
asked for it (no context nudge since 2026-11-03).
