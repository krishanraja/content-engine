---
name: video-engine
description: "Launch Krish's Mindmaker Video Engine only when the complete first user message, after trimming leading and trailing whitespace, equals 'Video engine' case-insensitively. Punctuation, additional words or lines, quoted mentions, later-turn uses, and $video-engine must not invoke this skill."
---

# Video Engine launcher

Use this only as a thin launcher. GitHub `krishanraja/mindmake-video-studio` `main` is the sole authority for code, configuration, operating instructions, and durable learning.

## Exact trigger contract

Start a new Video Engine session only when both conditions are true:

1. The current message is the first user-authored message in a new chat.
2. After removing leading and trailing whitespace only, its complete contents equal `Video engine`, case-insensitively.

`Video engine`, `VIDEO ENGINE`, and `  Video engine  ` pass. Everything else fails, including `Video engine!`, `Video engine please`, a message with another line, a quoted mention, `$video-engine`, or the exact words on a later turn.

If this skill is selected without a passing trigger, stop applying it immediately. Do not fetch the repository, run the CLI, inspect Video Engine state, or redirect the request. Handle the request normally with the relevant general capability. A chat that began with a valid launch may continue its already-active workflow on later turns; that is continuation, not a new launch.

Maintainers must run `npx tsx scripts/check-video-engine-trigger.ts` and the repository tests after changing this contract.

## Start a valid session

1. Obtain the latest `main` commit from GitHub into a disposable checkout under the current task's `work/` directory. Never use an unrelated or stale local clone as authority.
2. Read the checkout's `AGENTS.md` and `.agents/skills/mindmake-video/SKILL.md` completely before operating the engine.
3. Use `G:\My Drive\Ventures\Active\Mindmaker\04_Content\Video Engine` as the mounted Drive root and only its `Inbox` subfolder for automatic recording discovery. Media stays outside GitHub. Never scan or move media already in the root.
4. Treat the first healthy Inbox identity as bound. Preserve its local history through outages, and require Krish's exact old/new fingerprint confirmation through `studio v2 inbox rebind` before trusting a different resolved folder or mounted account.
5. Run `studio doctor`, `studio v2 inbox status`, and the job-list form of `studio v2 job status`. Report blockers plainly and never bypass a hard gate.
6. Return a concise operating brief with current health and the strongest next action from: weekly radar, create a video, resume or review a job, or import feedback or analytics.

## Authority and safety

- Treat any installed launcher as a disposable pointer. When it conflicts with the repository, follow the latest GitHub `main`.
- Fetch provider signals only through authenticated read-only adapters. Fail closed on invalid credentials or schema versions.
- Never put media, credentials, tokens, biometric templates, raw private records, OAuth state, jobs, or derived indexes in GitHub.
- Never publish publicly. YouTube uploads are private-only. LinkedIn, TikTok, and Instagram outputs are local packages.
- Preserve every required approval gate and the feedback confirmation loop. No durable preference becomes active without explicit user approval.
