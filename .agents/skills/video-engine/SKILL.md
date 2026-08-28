---
name: video-engine
description: "Launch Krishan Raja's Mindmaker Video Engine. Invoke only when the first user message, after trimming whitespace and terminal punctuation, is exactly 'Video engine' (case-insensitive), or when the user explicitly invokes $video-engine. Never invoke for ordinary requests that merely mention video, video editing, captions, rendering, Shorts, YouTube, or generating/editing a video."
---

# Video Engine launcher

Use this as a thin launcher. GitHub `krishanraja/mindmake-video-studio` `main` is the only authority for code, configuration, operational instructions, and durable learning.

## Trigger contract

- Start a new Video Engine session only when the first user message is exactly `Video engine`, ignoring case, surrounding whitespace, and terminal punctuation such as `Video engine!`, or when the user explicitly writes `$video-engine`.
- Do not activate from phrases such as `video edit`, `edit this video`, `generate a video`, `my video engine`, `how does the video engine work?`, or any unrelated mention of video production.
- If this skill was selected but the trigger contract is not satisfied, stop applying it immediately. Do not fetch the repository, run the CLI, inspect Video Engine state, or redirect the request. Handle the request normally with the relevant general capability.
- After a valid launch, follow-up turns in that same chat may continue the active Video Engine workflow without repeating the launch phrase.

## Start every session

1. Obtain the latest `main` commit from GitHub into a disposable checkout under the current task's `work/` directory. Never use an unrelated or stale local clone as authority.
2. Read the checkout's `AGENTS.md` and `.agents/skills/mindmake-video/SKILL.md` completely before operating the engine.
3. Use `G:\My Drive\Ventures\Active\Mindmaker\04_Content\Video Engine` as the media inbox/base path. Media stays outside GitHub.
4. Run `studio doctor` and the job-list form of `studio status`. Report blockers plainly; never bypass a hard gate.
5. If the user only said `Video engine`, return a concise operating brief with current system health and the most useful next choices: weekly radar, create a video, resume/review a job, or import feedback/analytics. Recommend the strongest next action rather than asking a context-free question.

## Authority and safety

- Treat this installed launcher only as a pointer. When it conflicts with the repository, follow the latest GitHub `main`.
- Fetch provider signals only through the repository's authenticated read-only adapters. Fail closed if credentials or schema versions are invalid.
- Never put media, credentials, tokens, raw private records, OAuth state, jobs, or derived indexes in GitHub.
- Never publish publicly. YouTube uploads are private-only and LinkedIn output is a local draft package.
- Preserve the three approval gates and the feedback confirmation loop. No durable preference becomes active without explicit user approval.
