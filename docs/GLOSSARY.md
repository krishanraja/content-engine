# Glossary

Status: Current
Owner: Krish Raja
Last verified: 2026-09-25 against `main` at `fd467e1` and the live `venture_formats` and `format_aliases` tables

Terms as this repository uses them. Where a word means different things in the
two halves, both meanings are given. Read "Names" first: most misreadings of
this repository start with a retired name.

## Names

| Name you may see | What it is now | Where it is still live |
|---|---|---|
| Mindmake | Krish's AI advisory, education and products business. The current name | everywhere |
| Mindmaker | the older name of the business | load-bearing only as a Drive folder path, the ASR vocabulary, the CLI description and some skill descriptions; renaming those breaks paths or tests |
| Mindmaker Live | a retired channel name; its alias maps to `general` | old pilot and analytics labels |
| split.the.bill (`split_the_bill`) | live subchannel: the money question | the publication |
| mind.the.gap (`mind_the_gap`) | live subchannel: the pattern question; the hero subchannel | the publication |
| lift.the.lid (`lift_the_lid`) | live subchannel: the build question | the publication |
| The Money of AI (`money_of_ai`), `paid` | retired as a subchannel on 2026-09-17; an alias of split.the.bill | **live as a Studio series** |
| Built with AI (`built_with_ai`), `built` | retired as a subchannel on 2026-09-17; an alias of lift.the.lid | **live as a Studio series** |
| `techonomic`, `builder_economy`, `mindmaker_live` | aliases of `general` | old rows |
| Signal & Noise (`signal_noise`) | an older channel still known to the final-pass rubrics and channel cuts | legacy rubric keys |
| `general`, `either` | rows in `venture_formats` that are not subchannels: a holding lane, and "suits more than one" | routing |
| makeyourmindup | Mindmake's CTRL lead-magnet surface; also the `corpus_key` on every live subchannel row | disputed as the publication's name (`docs/STATE.md`, open decisions) |
| Content Engine | this repository's editorial half, and the Content tab in Control Center that is its desk | both repos |
| Studio, Video Engine, Video Studio, video-studio | the media half of this repository | `packages/`, `apps/runner`, `apps/renderer`, `/api/video-studio/*` |
| `mindmake-video-studio` | this repository's former name | older docs and a session alias |

## The publication

- **Subchannel.** One of the three destinations a piece is written for. The
  live list is `venture_formats` rows where `kind = 'subchannel'` and
  `active`. Also called a format in Control Center.
- **Mandate.** A subchannel's full brief: its standing question, reader,
  subjects, boundary, naming rule, peg, close and hard gates. It lives only in
  `venture_formats.mandate` and is read live by the draft, revise, final pass,
  draft judges and router. Never copy it into code or a document.
- **Boundary rule.** How a contested subject is placed: ask what the reader
  changes next. A price, budget or contract means split.the.bill; what they
  build or buy means lift.the.lid; how they think or what they expect means
  mind.the.gap.
- **Hard gates.** Rules in a mandate applied before scoring, such as "not us"
  (the subject is never Krish or his own businesses) and "no preaching".
- **Voice block and corpus.** `system_config.content_voice_block` (how Krish
  writes) and `system_config.content_corpus` (the house register and each
  channel's playbook). Both are read live by every writer and checker.
- **The face.** The one reader the work is pictured on (`apps/control-plane/api/_mission.ts`).

## Ideas and pieces (`content_ideas`)

- **Idea, piece, row.** One `content_ideas` row. It is an idea until it has a
  body; a piece once it is drafted. `idea` is its title, `thesis` its pitch,
  `body` the draft.
- **States.** `seeded` (captured), `researching`, `drafting`, `review` (a body
  exists and waits on Krish), `approved`, `published`, `dropped`. Only Krish
  approves, drops or publishes.
- **Buried.** Set aside with a reason (`buried_at`); not deleted. The Monday
  purge is the only hard delete, and only for expired news rows.
- **`lane` and `lane_slot`.** `lane_slot` holds the subchannel slug. `lane` is
  an older column (`publication` for the publication) and is null on most
  routed pieces; code that needs the subchannel reads `lane_slot`.
- **`meta`.** The row's working record: `ladder` (verdict, expansion, router,
  `panel_run_id`), `contrarian`, `adjacent_stories`, `research`, `deep_dives`,
  `materials`, `krish_notes` (his words, verbatim), `drafts`, `revisions`,
  `final_pass`.
- **`transformed_outputs`.** Channel cuts, video scripts and production briefs
  made from the piece.

## Judging

- **Panel.** Independent judges reading one artifact blind to each other.
  **Idea gate**: 9 judges. **Draft gate**: 7, which also read the mandate and
  the sources on file.
- **Prosecutor.** The adversarial judge; it argues against running the piece
  and never counts toward the score.
- **Deterministic judges.** Free checks that run first: `substance` (too
  thin), `duplicate`, and `voice_mechanics` (em dashes, banned phrases, the
  "Not X, Y" construction).
- **Standing, score.** The lower median of the non-adversarial judges' real
  scores, never an average.
- **Band.** `ready` (7 or more), `repairable` (5 or 6), `weak` (below 5),
  `unjudged`. A repairable piece gets two repair attempts; what is still short
  goes to Krish.
- **Judge ladder, sweep.** The ladder expands, judges, repairs and routes; the
  sweep runs it over the backlog every 10 minutes.
- **Router.** Picks the subchannel; it writes `lane_slot` only when the slot
  is empty and the pick is uncontested.
- **`judge_calibration`.** A view pairing each judge's pass or kill with
  Krish's decision on the same panel run. The measure of whether the panel
  predicts him.
- **Final pass.** The ship-moment check against the mandate: instant fails,
  autofixes, suggestions, a verify list, and the Five Standards (unique,
  researched, thoughtful, kind, helpful).

## Decisions and learning

- **Edit ledger.** `content_edit_events`, append-only by trigger. One row per
  thing that happened to a piece: `manual_edit`, `magic_invoked`,
  `magic_accepted`, `magic_rejected`, `section_kept`, `section_dropped`,
  `final_pass_accepted`, `final_pass_dismissed`, `approved`, `binned`,
  `published`, `external_final_captured`.
- **Actor.** Who acted. `Krish`, or the agent client that acted by itself.
- **`observation_only`.** A row the compiler never learns from: anything an
  agent did on its own.
- **`decided_by: 'Krish'`.** What an operator session sends to relay a
  decision Krish made in words. Without it, an agent cannot approve, drop or
  publish.
- **Operator session, operator token.** A session with no browser that
  reaches the engine with `Bearer ENGINE_OPERATOR_TOKEN`.
- **Rule proposal.** A candidate taste rule. It is proposed, may be trialled,
  and becomes active only when Krish approves it and it lands in code or
  configuration. The walk's candidates are numbered R1, R2...
- **Ruling.** A decision Krish makes that overrules the engine or an agent,
  recorded in a commit body as `Ruling (Krish, YYYY-MM-DD): ...`.

## The Studio

- **Series.** The Studio's own classification, still `money_of_ai` and
  `built_with_ai`. Not the same thing as a subchannel (see Names).
- **Job.** One production run, a folder of content-addressed artifacts and an
  append-only ledger. **Stage**: one step of the V2 graph. **Gate**: one
  approval, bound to an exact artifact hash.
- **Source mode.** `extract`, `solo` or `short_native`.
- **Production brief.** `ProductionBriefV1`, the handoff from the content
  engine to the Studio.
- **Station.** One stage's governed boundary: `station.json` plus
  `STATION.md`.
- **Treatment, styleframe, animatic.** An approved visual preset; phone-size
  still frames; a low-resolution timed preview with audio. Each is gated.
- **Source bundle.** `SourceBundleV1`: an exact recording with its rights,
  consent, roles and sync.
- **Runner.** The Windows daemon that claims commands and briefs.
  **Projection**: the redacted copy of Studio state in the cloud.
- **Tracked session, `read_only_untracked`.** Whether the Studio MCP gateway
  granted capabilities to this client. A cloud session is always read-only.
- **Confirmation ref.** `studio-user-confirmation:<client>:<gate>:<hash>:<receipt>`,
  the proof of Krish's approval at a gate.

## Operations

- **Run ledger.** `content_engine_runs`, one row per cron run.
- **`meter_daily`.** Spend per agent key per day.
- **Docs steward.** A nightly job, defined in control-center, that keeps
  `NOW.md` and `docs/history/LOG.md` current and moves superseded documents into
  `docs/history/`.
- **The walk.** The first end-to-end live run of pieces through the engine,
  logged in `docs/walks/2026-09-three-piece-walk.md`.
