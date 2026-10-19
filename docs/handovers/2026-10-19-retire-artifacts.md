# Handover: retire Claude artifacts; every board update goes to content.krishraja.com; merge to main automatically

Start a fresh Claude Code session on `krishanraja/content-engine`, branch `claude/editorial-narrative-brief-qjhsyn`
(not merged yet), and paste: "Read docs/handovers/2026-10-19-retire-artifacts.md and do what it says." Opus.
Run `python3 scripts/check_failures.py` first.

## His words (19 Oct)

"Actually while you're at it, we are now retiring the Claude artefact permanently and we are working in
content.krishraja.com for all published board updates. Go and check it out and make these updates in this week's
publish board as well. Make sure the entire engine never ever Produces another artefact in the future and always
pushes to that URL and merges to main automatically."

Learning `boards-live-on-content-site` is open in `config/learnings.json` until this lands.

## What is known

- https://content.krishraja.com/ redirects (303) to `/board`, a ~3 KB app shell titled "Control Centre", served by
  Vercel (team `team_iXZBozK4Ss7NHuyNk8L9wmO6`; Vercel projects there include `control-center`
  `prj_ymGIPNZzWx5gSuxv1kqppexR60Ac`, `content-engine` `prj_fDRrOHcBrGTdrdrwS7W6OBzLuelX`, `content-archives`).
  The Vercel MCP returned 404 for both projects' details and domains from this session; confirm which project holds
  the `content.krishraja.com` domain (likely `control-center`, repo `krishanraja/control-center`: add it with
  `add_repo`, it is not in this session's scope) and how its `/board` gets its data (an engine API route, a store, or a
  file the engine pushes).

## The job

1. Find how content.krishraja.com/board reads a week's board, and what the engine must send so this week's board
   (week of 2026-10-19; Monday in draft with outline, article and both scripts, the calls waiting on him; Wednesday
   and Friday picked) shows there. Put this week's board there, with Monday's latest state (handover
   `2026-10-19-monday-v2.md`, "Latest" and "Krish recorded").
2. Ticks and his edits: the artifact board kept ticks and his review edits in its own store
   (`ArtifactData` ticks/links/edits) and his notes as artifact comments. Move or read them so nothing he ticked or
   wrote is lost, and make the new site the place sessions read them from (make-piece "The week's ticks",
   `references/week-board.md`).
3. Never another artifact: change `week_board.py` / `publish_manager.py` output, `config/boards.json`, the
   `board_sync.py` and publish hooks, the skills (make-piece, plan-week, produce-video and its reference
   `week-board.md`, the Workroom step) and AGENTS.md so every board and page goes to the site. Add a guard that
   refuses an `Artifact` publish from any session in this repository (`scripts/hooks/cost_gate.py` or the publish
   guard), with his words, and a failure/learning marker.
4. Merge to main automatically: today `.claude/settings.json` `permissions.deny` blocks push to main and
   `publish-guard.mjs` sends pushes to main to him in person. His words above authorise automatic merges; the safe
   shape is: push to a branch, open a PR, merge it automatically once `npm run verify` and CI pass (GitHub auto-merge,
   or a hook after a green verify). Confirm the exact mechanism with him in one line before turning off a guard, and
   record `Ruling (Krish, 2026-10-19): ...` in the commit. This branch's work (prediction gates, narrator reader,
   5-minute cut, readers for mid-sized firms) is the first thing to merge.
5. `npm run verify`, commit, push, update WORKBENCH.md, and tell him in plain words what changed.
