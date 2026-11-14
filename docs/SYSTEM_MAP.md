# System map

Status: Current
Owner: Krish Raja
Last verified: 2026-11-12 against `main` at `02184d34` for the code, crons and workflows (every path named here checked to exist), control-center's `main` for its side, and a read-only database readback the same day

One page on how the whole system fits together: what runs where, who owns
what, and how a piece travels from a signal to a published post. Detail lives
in `docs/CONTENT_ENGINE.md` (the editorial half) and `docs/STUDIO.md` (the
media half). Purpose lives in `docs/NORTH_STAR.md`.

## One repository, two halves, one purpose

| Half | Folder | Runs on | Does |
|---|---|---|---|
| The content engine | `apps/control-plane/` | Vercel project `content-engine`, serverless, with 25 crons | ideation, curation, drafting, iteration, channel copy, production briefs, the learning ledger, and the weekly publish board's view, drawn live in Control Centre's Content tab (the old pages at content.krishraja.com/board are retired and redirect there) |
| Production | `scripts/ve.py` (ve), `scripts/quick-edit/` (the fallback), `apps/renderer/`; the Studio in `packages/` and `apps/runner/` | a session in the cloud, on GitHub's machine or on a home computer (ve files its cuts from a home computer); the Studio's runner on Krish's Windows machine | both cuts of each piece from Krish's takes, with thumbnails and covers, filed to his library (carousels are Growth's); the Studio's hash-gated stations are a separate route not used for today's videos |

They share one database and one purpose. The content engine decides what is
worth making and writes it; production makes the media from it.

## Every system involved, and what it owns

| System | Owns | Where |
|---|---|---|
| GitHub `main` of this repository | code, schemas, migrations since 2026-09-08, configuration, skills, these documents | `krishanraja/content-engine` |
| Supabase (the shared mind/make OS database) | ideas, pieces, verdicts, the ledger, runs, Studio projections, subchannel mandates (`venture_formats`), the voice block and corpus (`system_config`) | one project shared with Control Center |
| Vercel project `content-engine` | the running control plane and its crons | deployed from `main` |
| GitHub Actions | the schedulers, and Claude Code on Krish's subscription: the Sunday ideas run, each piece's make run, the inspiration piece run, the weekly learning run, the cloud content-watcher, the docs steward, CI, auto-merge and the full verify after each merge; `produce-day` by dispatch or by hand only. Every workflow and its trigger: `docs/STATE.md`, "What runs" | `.github/workflows/` |
| Control Center | the desk Krish works at: its Content tab draws the one live Publish Board, the week's calendar, from the engine's view (`GET /api/board/<Monday>/view`), beside two approval queues, Ideas to approve and Ready to schedule and post; his one list holds the Studio's learning proposals; it reaches the engine by rewrite (its `vercel.json`) | `krishanraja/control-center`, `controlcenter.krishraja.com` |
| The Windows runner and job folders | exact media, the append-only local job ledger, signed approvals | Krish's machine |
| Google Drive | recording intake (the Inbox) and approved archives; and Krish's makeyourmindup asset library (the brand kit, the channel art, a folder for every post), which his always-on Windows machine writes from the engine's library (`api/library/`, `scripts/post-pack/`, `scripts/library-sync.ps1`) | fixed Drive folders named in `config/studio.json` |
| Krish's two home computers | the recordings lane (each take from the Video Engine Inbox to the engine and onto its piece), the library sync into Drive, the licensed music, content-watcher | `scripts/post-pack/`, `scripts/library-sync.ps1` |
| Growth-MakeYourMindUp | posting, amplification, the social accounts, and the derived carousels, Notes, memes and off-day posts | `krishanraja/growth-makeyourmindup`, `docs/GROWTH-HANDOFF.md` |
| inspirationhouse | the daily Inspiration House run that turns Krish's feedback into cues (`feedback_cues`), and the Rejections engine that writes `config/rejection-floor.json` (its `src/rejection/publish.ts`); its runs share the run ledger as the `taste_*` jobs | `krishanraja/inspirationhouse` |
| teleprompter.com | the scripts Krish reads on camera, sent once he approves their exact words | his account, through the Teleprompter connector or the engine's server |
| n8n (Cleo) | sourcing and distribution arms, including the content factory that turns a draft into a Google Doc | n8n Cloud, called by `save-draft` and `briefs/[week]/push` |
| Upstream feeds | the CTRL headline pool, Perplexity, Exa, Brave, NewsAPI, Apify, GitHub, the AEO engine | called by the collectors |

The asset library is Krish's instruction of 2026-10-06: "I want every single
asset in there, permanent and for individual posts, categorized properly,
clear what to use them for, and every new post gets its own new folder with
all assets including the article HTML I can copy paste, video scripts, etc
etc". The architecture doc's rule 0a.5 says agents never write into his
Drive; his instruction overrides it for that one folder only, and his own
machine does the writing.

When two of these disagree: live state beats documentation, and the database
is the authority for mandates, the voice block and the corpus. Code beats
prose about what the code does.

## How a piece travels

```text
signals, feeds, research, Krish's own ideas
   |  collectors and capture                    content engine, stage 1
   v
content_ideas row (state: seeded)
   |  judge ladder: expand, 9-judge panel, repair, re-judge, route   stage 2
   v
routed to follow.the.money | mind.the.gap | under.the.hood, banded ready | repairable | weak
   |  only Krish's Approve on the live Publish Board puts an idea on the week (the ideas gate, `api/board/_gate.ts`)
   v
draft to the mandate -> revise -> final pass -> 7-judge draft panel   stage 3
   |  Krish reads, directs, approves (state: review, then approved)
   v
two scripts (to Teleprompter once he approves), channel copy       stage 4
   |  Krish records; production renders only from a signed creative direction
   v
ve (quick-edit the fallback): both cuts, thumbnails, covers         stages 5 and 6
   |  each through its gates and Krish's presses on the board
   v
Krish presses Approve for publish; then Growth posts it            stage 7
   |
   v
the ledger, judge_calibration, the weekly compiler, the failure loop  stage 8
   -> rule proposals that become active only when Krish approves them
```

Nothing moves a piece from one of Krish's decisions to the next by itself.
The engine does the work between decisions and shows its reasoning; he makes
the decisions.

## Where each stage lives

| Stage | Code | Data | Krish's surface |
|---|---|---|---|
| 1. Ideation | `api/feed/`, `api/discover-*`, `api/inspiration/`, `api/aeo/`, `api/investigations/`, `api/content-ideas.ts`, `research-topic` | `content_ideas`, `trend_observations` | his inspiration cards (a ticked card is an instruction, `docs/PUBLISH_BOARDS.md`) and the Sunday ideas board |
| 2. Curation | `api/judge/`, `api/_judges/`, `api/content-ideas/[id]/judge.ts`, `api/triage/`, `api/shifts/`, `api/arcs/` | `panel_runs`, `judge_verdicts`, `content_ideas.meta.ladder` | the ideas on the live Publish Board, where only his Approve puts one on the week (the ideas gate), and Ideas to approve |
| 3. Drafting and iteration | `api/content-ideas/[id]/{draft,revise,final-pass,fact-check,dive-deeper,challenge,chat}.ts`, `api/_curation.ts`, `api/_finalPass.ts`, `api/_revisePrompt.ts` | `content_ideas.body`, `meta.drafts`, `meta.revisions` | the composer |
| 4. Channel and copy | `channel-cut`, `package` (the YouTube title and description, and the Substack title and subtitle), `video-script`, `save-draft`, `production-brief`, `api/_packaging.ts` | `transformed_outputs` | the composer |
| 5 and 6. Production and post-production | `scripts/ve.py`, `scripts/quick-edit/`, `apps/renderer`; the Studio in `packages/core`, `apps/runner`, `api/video-studio/` | the piece's making record (`meta.making`); Studio job folders and `video_studio_*` projections | the day on the live Publish Board |
| 7. Publishing | `api/publish/watch` (hourly: the Substack archive and the @makeyourmind-up YouTube feed; matches each post, video and Short to its piece and records it) and `GET /api/publish/catalogue` (every published piece with its article, video and Short, read by makeyourmindup.ai, which takes the cover from Substack) | the making record's publish step; `PATCH state: published` | Approve for publish on the live Publish Board; Growth posts |
| 8. Learning | `api/content-edits.ts`, `api/_editEvents.ts`, `api/learning/`, `scripts/learning/`, `packages/core/src/feedback.ts` | `content_edit_events`, `judge_calibration`, `engine_incidents`, `mindmake_studio_learning_proposals` | his one list in Control Center, where Clear keeps a learned rule and Purge turns it down |

## Rules that cross both halves

- Nothing publishes itself.
- Every durable taste rule needs Krish's explicit approval.
- Only Krish's decisions are taste; an agent's actions are observations.
- Secrets never enter Git, documents, logs or chat.
- The subchannel mandate is read live from the database, never copied.
- No em dashes in anything public, and no "Not X, Y" construction in any piece
  (rule R2, `docs/walks/2026-09-three-piece-walk.md`).
