# System map

Status: Current
Owner: Krish Raja
Last verified: 2026-09-25 against `main` at `fd467e1` and a database readback

One page on how the whole system fits together: what runs where, who owns
what, and how a piece travels from a signal to a published post. Detail lives
in `docs/CONTENT_ENGINE.md` (the editorial half) and `docs/STUDIO.md` (the
media half). Purpose lives in `docs/NORTH_STAR.md`.

## One repository, two halves, one purpose

| Half | Folder | Runs on | Does |
|---|---|---|---|
| The content engine | `apps/control-plane/` | Vercel project `content-engine`, serverless, with 20 crons | ideation, curation, drafting, iteration, channel copy, production briefs, the learning ledger |
| The Studio | `packages/`, `apps/runner/`, `apps/renderer/` | Krish's Windows machine: a CLI and a Scheduled Task runner; Remotion renders | Shorts and carousels from approved briefs, through hash-gated stations to local platform packages |

They share one database and one purpose. The content engine decides what is
worth making and writes it; the Studio makes the media from it.

## Every system involved, and what it owns

| System | Owns | Where |
|---|---|---|
| GitHub `main` of this repository | code, schemas, migrations since 2026-09-08, configuration, skills, these documents | `krishanraja/content-engine` |
| Supabase (the shared mind/make OS database) | ideas, pieces, verdicts, the ledger, runs, Studio projections, subchannel mandates (`venture_formats`), the voice block and corpus (`system_config`) | one project shared with Control Center |
| Vercel project `content-engine` | the running control plane and its crons | deployed from `main` |
| Control Center | the desk Krish works at: the Content tab, composer, mobile deck, Studio reviewer; reaches the engine by rewrite | `krishanraja/control-center`, `controlcenter.krishraja.com` |
| The Windows runner and job folders | exact media, the append-only local job ledger, signed approvals | Krish's machine |
| Google Drive | recording intake (the Inbox) and approved archives | a fixed Drive folder named in `config/studio.json` |
| n8n (Cleo) | sourcing and distribution arms, including the content factory that turns a draft into a Google Doc | n8n Cloud, called by `save-draft` and `briefs/[week]/push` |
| Upstream feeds | the CTRL headline pool, Perplexity, Exa, Brave, NewsAPI, Apify, GitHub, the AEO engine | called by the collectors |

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
routed to split.the.bill | mind.the.gap | lift.the.lid, banded ready | repairable | weak
   |  Krish decides in Control Center (DecideCard), recorded in the ledger
   v
draft to the mandate -> revise -> final pass -> 7-judge draft panel   stage 3
   |  Krish reads, directs, approves (state: review, then approved)
   v
channel cuts and a production brief                                 stage 4
   |  (the brief bridge accepts only the Studio's two series today)
   v
the Studio: brief -> script -> ... -> render -> qa -> package        stages 5 and 6
   |  every gate bound to Krish's approval of an exact hash
   v
Krish publishes (never automatic)                                    stage 7
   |
   v
the ledger, judge_calibration, the weekly compiler, Studio learning   stage 8
   -> rule proposals that become active only when Krish approves them
```

Nothing moves a piece from one of Krish's decisions to the next by itself.
The engine does the work between decisions and shows its reasoning; he makes
the decisions.

## Where each stage lives

| Stage | Code | Data | Krish's surface |
|---|---|---|---|
| 1. Ideation | `api/feed/`, `api/discover-*`, `api/inspiration/`, `api/aeo/`, `api/investigations/`, `api/content-ideas.ts`, `research-topic` | `content_ideas`, `trend_observations` | Feed and capture in Control Center |
| 2. Curation | `api/judge/`, `api/_judges/`, `api/content-ideas/[id]/judge.ts`, `api/triage/`, `api/shifts/`, `api/arcs/` | `panel_runs`, `judge_verdicts`, `content_ideas.meta.ladder` | lane rooms, DecideCard, the Sunday list |
| 3. Drafting and iteration | `api/content-ideas/[id]/{draft,revise,final-pass,dive-deeper,challenge,chat}.ts`, `api/_curation.ts`, `api/_finalPass.ts`, `api/_revisePrompt.ts` | `content_ideas.body`, `meta.drafts`, `meta.revisions` | the composer |
| 4. Channel and copy | `channel-cut`, `video-script`, `save-draft`, `production-brief` | `transformed_outputs` | the composer |
| 5 and 6. Production and post-production | `packages/core`, `apps/runner`, `apps/renderer`, `api/video-studio/` | job folders; `video_studio_*` projections | the Studio reviewer |
| 7. Publishing | none | `PATCH state: published` records it | Krish, by hand |
| 8. Learning | `api/content-edits.ts`, `api/_editEvents.ts`, `api/learning/`, `packages/core/src/feedback.ts` | `content_edit_events`, `judge_calibration`, `mindmake_studio_learning_proposals` | learning proposals in Control Center |

## Rules that cross both halves

- Nothing publishes itself.
- Every durable taste rule needs Krish's explicit approval.
- Only Krish's decisions are taste; an agent's actions are observations.
- Secrets never enter Git, documents, logs or chat.
- The subchannel mandate is read live from the database, never copied.
- No em dashes in anything public, and no "Not X, Y" construction in any piece
  (rule R2, `docs/walks/2026-09-three-piece-walk.md`).
