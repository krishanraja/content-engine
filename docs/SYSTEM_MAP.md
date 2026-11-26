# System map

Status: Current
Owner: Krish Raja
Last verified: 2026-11-12 against `main` at `02184d34` for the code, crons and workflows (every path named here checked to exist), control-center's `main` for its side, and a read-only database readback the same day; the workflows and Krish's surfaces rechecked on 16 Nov against `main` at `4fcf48fb` and control-center's `main`; the ownership split, the story engine and the production cycle (`config/cycle.json`) added on 26 Nov against branch `story/engine-v5` at `46bb11bc` (not on `main` yet; every path named for them checked to exist on that branch)

One page on how the whole system fits together: what runs where, who owns
what, and how a piece travels from a signal to a published post. Detail lives
in `docs/CONTENT_ENGINE.md` (the editorial half) and `docs/STUDIO.md` (the
media half). Purpose lives in `docs/NORTH_STAR.md`.

## One repository, two halves, one purpose

| Half | Folder | Runs on | Does |
|---|---|---|---|
| The content engine | `apps/control-plane/` | Vercel project `content-engine`, serverless, with 25 crons | ideation, curation, drafting, iteration, channel copy, production briefs, the learning ledger, and the weekly publish board's view, drawn live in Control Centre's Content tab (the old pages at content.krishraja.com/board are retired and redirect there) |
| Production | `scripts/ve.py` (ve), `scripts/quick-edit/` (the fallback), `apps/renderer/`; the Studio in `packages/` and `apps/runner/` | a session in the cloud, on GitHub's machine or on a home computer (ve files its cuts from a home computer); the Studio's runner on Krish's Windows machine | every asset: both cuts of each piece from Krish's takes, thumbnails, covers, carousels, memes, Notes and their captions, filed to his library and handed to Growth in the piece manifest (Ruling, Krish, 2026-11-26); stills only from the locked v5 Library (`config/asset-routes.json`); the Studio's hash-gated stations are a separate route not used for today's videos |

They share one database and one purpose. The content engine decides what is
worth making and writes it; production makes the media from it.

## Every system involved, and what it owns

| System | Owns | Where |
|---|---|---|
| GitHub `main` of this repository | code, schemas, migrations since 2026-09-08, configuration, skills, these documents | `krishanraja/content-engine` |
| Supabase (the shared mind/make OS database) | ideas, pieces, verdicts, the ledger, runs, Studio projections, subchannel mandates (`venture_formats`), the voice block and corpus (`system_config`) | one project shared with Control Center |
| Vercel project `content-engine` | the running control plane and its crons | deployed from `main` |
| GitHub Actions | the schedulers, and Claude Code on Krish's subscription: the Sunday ideas run, each piece's make run, the inspiration piece run, the weekly learning run, the cloud content-watcher, the docs steward, CI, auto-merge, the full verify after each merge, the weekly branch sweep and the weekly standards check-in; `produce-day` and `signoff-apply` (his sign-off presses) by dispatch or by hand only. Every workflow and its trigger: `docs/STATE.md`, "What runs" | `.github/workflows/` |
| Control Center | the desk Krish works at: its Content tab draws the one live Publish Board, the week's calendar, from the engine's view (`GET /api/board/<Monday>/view`), beside two approval queues, Ideas to approve and Ready to schedule and post; his one list holds the Studio's learning proposals; it reaches the engine by rewrite (its `vercel.json`) | `krishanraja/control-center`, `controlcenter.krishraja.com` |
| The Windows runner and job folders | exact media, the append-only local job ledger, signed approvals | Krish's machine |
| Google Drive | recording intake (the Inbox) and approved archives; and Krish's makeyourmindup asset library (the brand kit, the channel art, a folder for every post), which his always-on Windows machine writes from the engine's library (`api/library/`, `scripts/post-pack/`, `scripts/library-sync.ps1`) | fixed Drive folders named in `config/studio.json` |
| Krish's two home computers | the recordings lane (each take from the Video Engine Inbox to the engine and onto its piece), the library sync into Drive, the licensed music, content-watcher | `scripts/post-pack/`, `scripts/library-sync.ps1` |
| Growth-MakeYourMindUp | growing the channel: posting and scheduling in Buffer, the weekly edition's Substack placement, distribution, the social accounts, the subscribe route, `mix.json` and experiments, measurement and learning; it makes no asset and reports performance back (Ruling, Krish, 2026-11-26) | `krishanraja/growth-makeyourmindup`, `docs/GROWTH-HANDOFF.md` |
| divergence-engine (formerly divergent-thinker) | angles, the day's wildcard sparks and the repeat guard for the ideas board, through Control Center's divergent route in content-engine's own namespace; paid calls inside the $15 weekly chain | `scripts/post-pack/divergent.py`, `docs/DIVERGENT.md` |
| The humour engine | the fact and angle reads (comic reading, mechanism) the story score maps to its absurdity axis, and the hook, landing and script reads at the lock and the scripts | `scripts/post-pack/humour_check.py` |
| strategist | its latest memo, read as the week opens; close calls the council could not take, informed | `gh api` reads, `config/cycle.json` |
| file archives (the research library) | the research library each candidate topic is looked up in before paying for research, and where every research document is filed | Control Center `find_research` and `add_piece_material` |
| The taste engine and inspirationhouse | his rejections and cues, read only as the story floor; his presses and edits reported to his taste ledger | `scripts/post-pack/story_floor.py`, `report_to_taste_engine` |
| internal-auditor | engine defects, refused gates and the week's failures, recorded as observations | `record_harness_observation` |
| krish-clone | the clone registry, read before any synthetic face or voice | its registry, read at its raw URL |
| Higgsfield | before a generation, the generator's own cost estimate and recipe, saved for the piece (`s7-higgsfield-estimate`), then Control Center's reservation and settlement, all required once a generation is named | `.agents/skills/produce-video` |
| makeyourmindup | the kill list (pinned in `vendor/makeyourmindup/kill-list/`, its drift checked against upstream) and the publication catalogue | `krishanraja/makeyourmindup` |
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
   |  the Sunday story engine: the floor (his rejections refuse, never score), the blind story score and the
   |  pre-pick whys probe, close calls named; every hero day carries a checked wildcard   stage 2b
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
Krish presses Approve for publish; the sealed manifest carries every asset
and each channel's words to Growth, which posts it                  stage 7
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
| 3. Drafting and iteration | `api/content-ideas/[id]/{draft,revise,final-pass,fact-check,dive-deeper,challenge,chat}.ts`, `api/_curation.ts`, `api/_finalPass.ts`, `api/_revisePrompt.ts` | `content_ideas.body`, `meta.drafts`, `meta.revisions` | the read sheet on the live Publish Board (the old composer opens only in Control Centre's old UI, `?ui=old`, since 13 Nov) |
| 4. Channel and copy | `channel-cut`, `package` (the YouTube title and description, and the Substack title and subtitle), `video-script`, `save-draft`, `production-brief`, `api/_packaging.ts` | `transformed_outputs` | the read sheet on the live Publish Board |
| 5 and 6. Production and post-production | `scripts/ve.py`, `scripts/quick-edit/`, `apps/renderer`; the Studio in `packages/core`, `apps/runner`, `api/video-studio/` | the piece's making record (`meta.making`); Studio job folders and `video_studio_*` projections | the day on the live Publish Board |
| 7. Publishing | `api/publish/watch` (hourly: the Substack archive and the @makeyourmind-up YouTube feed; matches each post, video and Short to its piece and records it) and `GET /api/publish/catalogue` (every published piece with its article, video and Short, read by makeyourmindup.ai, which takes the cover from Substack) | the making record's publish step; `PATCH state: published` | Approve for publish on the live Publish Board; Growth posts |
| 8. Learning | `api/content-edits.ts`, `api/_editEvents.ts`, `api/learning/`, `scripts/learning/`, `packages/core/src/feedback.ts` | `content_edit_events`, `judge_calibration`, `engine_incidents`, `mindmake_studio_learning_proposals` | his one list in Control Center, where Clear keeps a learned rule and Purge turns it down |

## The story engine (branch `story/engine-v5`, from the 7 Dec board)

Every Sunday option goes through three stages before Krish sees the board (`docs/proposals/2026-11-26-story-engine-gaps.md`
says why; `.agents/skills/plan-week/references/story-score.md` is the procedure):

1. **The floor** (`scripts/post-pack/story_floor.py`, `config/story-floor.json`): the only code that reads his
   rejections, the kill list, the beat's avoid list and the rejection floor. It answers pass or refused with reasons,
   never a number (Ruling, Krish, 2026-11-26: his taste is a floor only).
2. **The blind score** (`scripts/post-pack/story_score.py`, `config/story-score.json`, `story-score/1`): anchored 0 to
   10 axes (scale, absurdity and humour, unique angle, whys, fit, named thing, fun to read, fun to make), weighted per
   content type (Monday, Wednesday and Friday heroes, off-day shorts and memes, good news, explainers, edition items,
   the wildcard) with hard floors per type. The scorer sees an option only through `blind_view()`; it never reads
   picks, taste, cues, why_here or verdicts (`tests/story_wall_test.py`). Angles come from in-session lens subagents
   and divergence-engine `provoke`, scored blind. The whys come from the pre-pick probe (`scripts/whys-probe-check.ts`,
   `docs/FIVE-WHYS.md`, "Before the pick").
3. **Close calls**: when the top two are within the margin, a blind council reads A against B; if it cannot, the
   option card says "close call, your pick".

The board's gate (`scripts/post-pack/board_feed.py gate`, codes in `idea_checks.GATE_CODES`) holds the order and the
scores from the rubric's `from` date: `story`, `story_floor`, `wildcard`, `off_beat` and `carousel_format`, and the
cycle's own `touch` code for a required touch missing. The engine's proof is a blind A/B against the old boards
(`docs/plans/proofs/2026-11-26-story-engine-v5/PROTOCOL.md`).

## The production cycle: one registry, eleven stages

`config/cycle.json` is the one registry of every touch the cycle makes of another system, stage by stage, each a read
or an inform, with how it is reached (`mcp`, `gh`, `script`, `builtin`, `exists`, `manual`) and whether it is required.
`python3 scripts/post-pack/touch.py list` prints it; `run STAGE --week <Monday>` makes every touch of a stage;
`check STAGE` fails when a required touch is missing (the board's gate and `making.py` report it as `touch`). Every
touch writes one line to `docs/plans/<Monday>-week/touches.jsonl`. Connector touches go to Control Center's
`/api/harness/mcp` on `CC_HARNESS_KEY`; without it they queue in `.cache/touch/outbox.jsonl` and `touch.py drain` sends
them later (`docs/INTEGRATIONS.md`). Prompts, skills and runs name the stage, never the tools.

| Stage | When | What it touches |
|---|---|---|
| 0 Week opens | Saturday, as the week's run starts | Control Center (his open instruction, its ack, the credits brief), strategist's memo, Growth's performance review, the auditor's open observations |
| 1 Gather | plan-week's gather | the research library, the taste floor, makeyourmindup's kill-list drift, divergence-engine's record of what went live |
| 2 Options and score | plan-week steps 2 to 7, before the board | divergence-engine angles and wildcard, humour reads, the story score, the kill list on every line, strategist for close calls |
| 3 Board presses | as he presses | his picks, rejects and improves to his taste ledger; refused gates to the auditor |
| 4 Research and 5 Whys | the picked piece | the piece's corpus, divergence-engine `challenge`, research filed, the board session report |
| 5 Narrative lock | before he signs | the corpus, the humour read of hook and landing, his lock edits as an observation |
| 6 Scripts | make-piece, before `making.py scripts` | the voice check, humour reads, the kill list, his script edits, the Teleprompter record |
| 7 Visuals and video | produce-video, before any paid generation | the Higgsfield estimate, the clone registry, credit caps, reserve and settle |
| 8 Publish approval | before the publish page | the done-checks, the voice check on captions, the makeyourmindup catalogue, engine defects to the auditor |
| 9 Distribution | once a piece is out | Growth receives the finished assets and captions in the manifest; divergence-engine records what published |
| 10 Learn | after the week | Growth's performance per piece, strategist's NOW line, the auditor's week, corrections, Drive folder changes |

## Rules that cross both halves

- Nothing publishes itself.
- Every durable taste rule needs Krish's explicit approval.
- Only Krish's decisions are taste; an agent's actions are observations.
- Secrets never enter Git, documents, logs or chat.
- The subchannel mandate is read live from the database, never copied.
- No em dashes in anything public, and no "Not X, Y" construction in any piece
  (rule R2, `docs/walks/2026-09-three-piece-walk.md`).
