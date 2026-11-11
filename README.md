# Make Your Mind Up content engine

**Publish boards:** follow `docs/PUBLISH_BOARDS.md` and `config/boards.json.web_cutover`. After verified active cutover, every week's board lives at content.krishraja.com and all new board interactions use the authenticated web API. Older Claude board instructions in this document are kept as compatibility and history; never use them to synchronize artifacts.


The engine behind Krish Raja's media business: makeyourmindup, his
publication (hosted on Substack, with its cover page at makeyourmindup.ai), and
the hero assets made from it (the article, both cuts, thumbnails and covers;
Growth makes the derived carousels, Notes and off-day posts). It finds what is worth saying, judges
it, routes it to the right subchannel, drafts it in Krish's voice to that
subchannel's mandate, cuts it for each channel and produces the media, and it
learns from every decision Krish makes along the way. Krish makes every
decision that matters; nothing publishes itself.

It is a makeyourmindup product, not a Mindmake one (Ruling, Krish, 2026-10-28:
"content-engine, which is not a mindmake product, it's a makeyourmindup
product"; "Content-engine produces content for makeyourmindup.ai, which is
hosted at makeyourmindup repo"). Package, environment and credential names keep
their `mindmake` spelling, because renaming them would break the machines that
read them.

It is building: the choosing half runs around the clock, each week's pieces
are picked on the Sunday ideas board and made from there, and Krish publishes
them by hand. Current state: `NOW.md` (short) and `docs/STATE.md` (full).

## Read this first

| You are about to... | Read |
|---|---|
| do anything at all in this repository | `docs/NORTH_STAR.md`, then `AGENTS.md` |
| pick up the work where the last session left it, in any tool (Claude Code, Codex) | `WORKBENCH.md` |
| work on ideas, judging, drafting, rewriting, channel copy or the ledger | `docs/CONTENT_ENGINE.md` |
| work on video | `docs/ve/ENGINE.md`, then `docs/ve/RUNBOOK.md` (quick-edit is the fallback until ve passes Phase 3) |
| work on the Studio runner or renderer | `docs/STUDIO.md`, then `docs/ENGINE_SESSION.md` |
| understand how the pieces fit, or who owns what | `docs/SYSTEM_MAP.md` |
| design how a piece looks, sounds or moves, on any surface | `docs/production/THE_BAR.md`, the brand tokens (`config/ve/brand-tokens.json`), the signed motion standard (`docs/ve/MOTION_STANDARD.md`) and the style bank (the `motion` layer of `config/style-references.json`); each piece renders from the direction Krish signs (`docs/CREATIVE_DIRECTION.md`). `docs/CREATIVE_IDENTITY_UPGRADE.md` is the plan of 25 September and his decisions on it |
| make a piece's web page, the copy that pastes into Substack and its cover image, or check that its artwork can be read on a phone | `scripts/pages/README.md` |
| make the YouTube banner, watermark and channel description, the profile pictures, the Facebook cover, the X header or the Instagram highlight covers | `scripts/channel-kit/README.md` |
| see what each social profile carries (YouTube, Instagram, Facebook, Krish's TikTok and X) and what is left on them | `docs/AMPLIFICATION.md`, "The profiles every link lands on" |
| put a post's assets, the brand kit or the channel art into Krish's asset library on Drive | `scripts/post-pack/README.md` |
| use or change any name (a subchannel, a series, a state) | `docs/GLOSSARY.md` |
| put anything in Google Drive, or move, rename or tidy a Drive folder | `docs/DRIVE.md` |
| write a one-off script for the main channel, outside the three subchannels | `docs/one-offs/README.md` |
| use an outside tool on a post, or record what one added | `docs/TOOL_BANK.md` |
| reach a service (which are live, their secret names, what to rotate) | `docs/INTEGRATIONS.md` |
| see every plausible way a tool could make the content far better | `docs/ENGINE_100X.md` |
| run the week: record the whole week on Sunday and go live the Monday after; the Sunday ideas board, the interview, the Monday final board; the standing answers (two cuts, the channels) | `docs/CADENCE.md` |
| see what a finished post needs on each channel (Growth-MakeYourMindUp posts it; read `docs/GROWTH-HANDOFF.md` first) | `docs/AMPLIFICATION.md` |
| read a free public signal: prediction-market odds, news velocity, Hacker News, SEC filings | `scripts/signals/README.md` |
| pin a Call to a prediction market, or read the scoreboard feed | `docs/CONTENT_ENGINE.md`, `/api/content-ideas/[id]/call-market` and `/api/calls` |
| treat Spotify as a channel: the show, the audio editions, the sizes | `docs/SPOTIFY.md` |
| learn from the videos Krish likes, or apply a style recipe to a piece | `docs/STYLE_REFERENCES.md` |
| design or prove a new video look, use a lab style (The Ladder, The Living Screen and three more) or a move | `lab/styles/README.md`, `lab/moves/README.md`; how a look reaches ve: `lab/styles/README.md`, "From the lab to ve" |
| pick a piece's caption style, or check what the tall frame may hold (safe zones, no wordmark over content) | `docs/ve/ENGINE.md`, "New capabilities"; `docs/ve/MOTION_STANDARD.md`, Channels |
| see what every capability is for and whether it works | `docs/CAPABILITIES.md` (rendered from `config/capabilities.json`) |
| see every failure Krish has raised and the guard that now stops it | `python3 scripts/check_failures.py` (`config/failures.json`) |
| know what works, what is broken and what waits on Krish | `docs/STATE.md` |
| find a file, an exported function or type, a route or a Studio station without opening files | `docs/REPO_MAP.md` (generated by `npm run repo-map`; search it, never read it whole) |

The asset library is Krish's instruction of 2026-10-06 ("I want every single
asset in there, permanent and for individual posts, categorized properly,
clear what to use them for, and every new post gets its own new folder with
all assets including the article HTML I can copy paste, video scripts, etc
etc"). It overrides the architecture doc's rule 0a.5, that agents never write
into his Drive, for that one folder only, and his own always-on machine does
the writing.

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
| **Production** | `scripts/ve.py` (ve, the video engine), `scripts/quick-edit/` (the fallback), `apps/renderer/`; the Studio in `packages/` and `apps/runner/` | makes both cuts of each piece from Krish's takes, with their thumbnails and covers, and files them for posting by a person (carousels are Growth's, to `docs/CAROUSEL-STANDARD.md`); the Studio's hash-gated stations on his Windows machine are a separate route that is not how videos are made today |

Control Center (`krishanraja/control-center`) is where Krish works; it reaches
the engine through rewrites and reads the shared Supabase database directly.
This repository's one user interface is the weekly publish board it serves at
content.krishraja.com (`/board/<Monday>`, with the standards page at
`/board/standards`), where Krish presses.

## The publication

Three subchannels, each with a mandate stored in the database
(`venture_formats.mandate`) and read live by every writer and checker:

- **follow.the.money**: where the money moves, and who ends up better or worse off.
- **mind.the.gap**: the pattern across several threads, and what it means is coming.
- **under.the.hood**: what actually goes together in a shipped thing, and why it worked.

The Money of AI and Built with AI are retired as subchannels (2026-09-17) and
survive as aliases, and as two retired Studio series ids that stay valid only
for records made under them (`packages/contracts/src/series.ts`). Read
`docs/GLOSSARY.md` before renaming anything.

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
npm run verify:quick            # before a push and in CI: every guard, the related tests, the publishing-safety tests
npm run verify                  # after merge (full-verify.yml): everything below, plus the skill, station, renderer, copy, secret, board, music-bed and repo-map checks
npm run typecheck               # the packages
npm run typecheck:control-plane # the content engine
npm test                        # vitest across tests/, including tests/control-plane/
npm run check:control-plane     # 28 structural guards for the content engine (skipped on Windows)
```

All 28 content-engine guards pass on `main`. One media test,
`tests/quick-edit-mix.test.ts`, fails in the cloud container (FFmpeg 6.1.1)
and passes in CI, which installs the pinned FFmpeg 8.1.2 (`docs/STATE.md`,
"Broken or risky"). Anything else failing is yours.

Studio setup on Windows starts in `docs/STUDIO.md`, "Quick start".

## Documents, in order of authority

Live state (the production deployment and the database) outranks every
document; code outranks prose about what the code does.

1. `AGENTS.md`: the rules for any agent working here.
2. `docs/NORTH_STAR.md`: what the whole system is for.
3. `docs/STATE.md` and `NOW.md`: where it is right now.
4. `docs/SYSTEM_MAP.md`: how the parts fit and who owns what.
5. `docs/CONTENT_ENGINE.md`: the content engine, route by route.
6. `docs/CREATIVE_IDENTITY_UPGRADE.md`: the plan of 25 September for how
   every piece looks, sounds and moves (the Signature Pack, never built as
   such), with the decisions Krish made on it. Today `docs/production/THE_BAR.md`,
   the brand tokens, `docs/ve/MOTION_STANDARD.md` and the style bank hold that.
7. `docs/STUDIO.md`: the Studio, and the index of its detailed documents
   (`docs/ENGINE_SESSION.md`, `docs/ARCHITECTURE.md`, `docs/OPERATIONS.md`,
   `docs/DEPLOYMENT.md`, `docs/CAROUSEL_ENGINE_STATE.md` and the calibration
   records).
8. `docs/GLOSSARY.md`: every term and every retired name.
9. `docs/walks/`: live engineering records. They explain why things are as
   they are; they are not instructions.
10. `docs/history/`: superseded documents and the dated log. Never current.
