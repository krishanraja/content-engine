# Mindmake content engine

The engine behind Krish Raja's media business: makeyourmindup, the Mindmake
publication (hosted on Substack, with its cover page at makeyourmindup.ai), and
the Shorts and carousels made from it. It finds what is worth saying, judges
it, routes it to the right subchannel, drafts it in Krish's voice to that
subchannel's mandate, cuts it for each channel and produces the media, and it
learns from every decision Krish makes along the way. Krish makes every
decision that matters; nothing publishes itself.

As of 2026-09-25 it is building: the choosing half runs around the clock, the
first pieces were walked through drafting on 2026-09-24, and nothing has been
published yet. Current state: `NOW.md` (short) and `docs/STATE.md` (full).

## Read this first

| You are about to... | Read |
|---|---|
| do anything at all in this repository | `docs/NORTH_STAR.md`, then `AGENTS.md` |
| work on ideas, judging, drafting, rewriting, channel copy or the ledger | `docs/CONTENT_ENGINE.md` |
| work on video, carousels, the runner or the renderer | `docs/STUDIO.md`, then `docs/ENGINE_SESSION.md` |
| understand how the pieces fit, or who owns what | `docs/SYSTEM_MAP.md` |
| design how a piece looks, sounds or moves, on any surface | `docs/CREATIVE_IDENTITY_UPGRADE.md` |
| use or change any name (a subchannel, a series, a state) | `docs/GLOSSARY.md` |
| know what works, what is broken and what waits on Krish | `docs/STATE.md` |

## The objective

Krish, 2026-09-24: "train each part of the content ideation, curation,
iteration, channel selection & copywriting > postproduction so the engine can
know how to assist me 10/10 at every step, and also learn from every live run
too... act like a world class creator production team for me and build the
engine that will build the media business with me". The full statement, what
it means for every stage and the rules that keep the learning honest are in
`docs/NORTH_STAR.md`.

## One repository, two halves

| Half | Where | What it does |
|---|---|---|
| **The content engine** | `apps/control-plane/`, deployed as the Vercel project `content-engine` | collects and researches ideas, judges them with a blind panel, routes them to a subchannel, drafts and rewrites to the mandate, runs the final checks, cuts channel copy, builds production briefs, and keeps the ledger the engine learns from |
| **The Studio** | `packages/`, `apps/runner/`, `apps/renderer/` | turns an approved brief into a Short or a carousel through hash-gated stations, on Krish's Windows machine, and packages it for posting by a person |

Control Center (`krishanraja/control-center`) is where Krish works; it reaches
the engine through rewrites and reads the shared Supabase database directly.
This repository has no user interface of its own.

## The publication

Three subchannels, each with a mandate stored in the database
(`venture_formats.mandate`) and read live by every writer and checker:

- **follow.the.money**: where the money moves, and who ends up better or worse off.
- **mind.the.gap**: the pattern across several threads, and what it means is coming.
- **under.the.hood**: what actually goes together in a shipped thing, and why it worked.

The Money of AI and Built with AI are retired as subchannels (2026-09-17) and
survive as aliases, **and as the Studio's two series identifiers, which are
still live**. Read `docs/GLOSSARY.md` before renaming anything.

## Rules that are never negotiable

1. Nothing publishes itself.
2. Only Krish's decisions are taste. An agent's own actions are recorded as
   observations; it relays his decisions only when he made them in words.
3. Every durable taste rule needs his explicit approval.
4. Secrets never enter Git, documents, logs or chat.
5. The mandate is read live from the database and never copied.

The full rules for agents are in `AGENTS.md`.

## Checks

```bash
npm ci
npm run verify                  # everything below, plus skills, stations, renderer, copy and secret checks
npm run typecheck               # the packages
npm run typecheck:control-plane # the content engine
npm test                        # vitest across tests/, including tests/control-plane/
npm run check:control-plane     # 28 structural guards for the content engine (skipped on Windows)
```

Two content-engine guards and two FFmpeg-dependent media tests fail on `main`
for known reasons (`docs/STATE.md`, "Broken or risky"). Anything else failing
is yours.

Studio setup on Windows starts in `docs/STUDIO.md`, "Quick start".

## Documents, in order of authority

Live state (the production deployment and the database) outranks every
document; code outranks prose about what the code does.

1. `AGENTS.md`: the rules for any agent working here.
2. `docs/NORTH_STAR.md`: what the whole system is for.
3. `docs/STATE.md` and `NOW.md`: where it is right now.
4. `docs/SYSTEM_MAP.md`: how the parts fit and who owns what.
5. `docs/CONTENT_ENGINE.md`: the content engine, route by route.
6. `docs/CREATIVE_IDENTITY_UPGRADE.md`: how every piece looks, sounds and
   moves (the Signature Pack), with the decisions Krish has made on it.
7. `docs/STUDIO.md`: the Studio, and the index of its detailed documents
   (`docs/ENGINE_SESSION.md`, `docs/ARCHITECTURE.md`, `docs/OPERATIONS.md`,
   `docs/DEPLOYMENT.md`, `docs/CAROUSEL_ENGINE_STATE.md` and the calibration
   records).
8. `docs/GLOSSARY.md`: every term and every retired name.
9. `docs/walks/`: live engineering records. They explain why things are as
   they are; they are not instructions.
10. `docs/history/`: superseded documents and the dated log. Never current.
