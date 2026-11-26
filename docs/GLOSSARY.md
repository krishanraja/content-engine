# Glossary

Status: Current
Owner: Krish Raja
Last verified: 2026-11-12 against `main` at `02184d34` for every term (each checked against the code or config it names), with `venture_formats`, `format_aliases`, the `content_ideas` state check and the tables named here read back from the database the same day; caption styles, the ideas gate and the lookalike step rechecked on 16 Nov against `main` at `4fcf48fb`; the story engine, the cycle and the 26 Nov split added against branch `story/engine-v5` at `53ff7558`

Terms as this repository uses them. Where a word means different things in the
two halves, both meanings are given. Read "Names" first: most misreadings of
this repository start with a retired name.

## Names

| Name you may see | What it is now | Where it is still live |
|---|---|---|
| Mindmake | Krish's AI advisory, education and products business. The current name. This engine and the publication belong to makeyourmindup (Ruling, Krish, 2026-10-28) | everywhere for the business; in this repository, only package, environment and credential names, which keep the `mindmake` spelling |
| Mindmaker | the older name of the business | load-bearing only as a Drive folder path, the ASR vocabulary (`config/studio.json`), the Studio CLI's description (`packages/cli`), the shared database's name (Mindmaker OS) and some skill descriptions; renaming those breaks paths or tests |
| Mindmaker Live | a retired channel name; its alias maps to `general` | old pilot and analytics labels |
| follow.the.money (`follow_the_money`) | live subchannel: the money question | the publication |
| mind.the.gap (`mind_the_gap`) | live subchannel: the pattern question; the hero subchannel | the publication |
| under.the.hood (`under_the_hood`) | live subchannel: the build question | the publication |
| The Money of AI (`money_of_ai`), `paid` | retired as a subchannel on 2026-09-17; an alias of follow.the.money | a retired Studio series id, valid only in records made under it |
| Built with AI (`built_with_ai`), `built` | retired as a subchannel on 2026-09-17; an alias of under.the.hood | a retired Studio series id, valid only in records made under it |
| `techonomic`, `builder_economy`, `mindmaker_live` | aliases of `general` | old rows |
| split.the.bill (`split_the_bill`), lift.the.lid (`lift_the_lid`) | the names follow.the.money and under.the.hood carried until Krish renamed them on 2026-09-25 ("every single instance front and back end, with zero exceptions"). Aliases in `format_aliases`, so an old link or row still resolves. Nowhere else: a test fails if either name reappears in a tracked file | the ten append-only rows written before the rename (`content_edit_events`, `judge_verdicts`), which cannot be edited |
| Signal & Noise (`signal_noise`) | an older channel still known to the final-pass rubrics and channel cuts | legacy rubric keys |
| `general`, `either` | rows in `venture_formats` that are not subchannels: a holding lane, and "suits more than one" | routing |
| makeyourmindup | **the publication's name** (Krish, 2026-09-25). Hosted on Substack at home.makeyourmindup.ai (the archive `_publishWatch.ts` reads, and the subscribe page `publish_kit.py` links); its cover site, makeyourmindup.ai, is built from `krishanraja/makeyourmindup`, which also holds the kill list and the judges this engine runs from a pinned copy (`vendor/makeyourmindup/kill-list/`). Also the `corpus_key` on every live subchannel row | everywhere the publication is named |
| Mindmake's publication | an older way of naming the publication, superseded on 2026-10-28 | Control Center's architecture canon |
| Content Engine | this repository's editorial half. Control Center's Content tab draws the one live Publish Board from its view, beside its two approval queues (Ideas to approve; Ready to schedule and post) | both repos |
| ve | the video engine: one signed spec per piece, run with `python scripts/ve.py` | `scripts/ve.py`, `scripts/velib/`, `docs/ve/` |
| quick-edit | the older video path, the fallback until ve passes Phase 3 | `scripts/quick-edit/`, the `produce-video` skill |
| Studio, Video Studio, video-studio | the job-based Studio route of the media half (stations, runner, gates); not how videos are made today | `packages/`, `apps/runner`, `apps/renderer`, `/api/video-studio/*` |
| Video engine, Video Engine Inbox | the exact phrase that launches the `video-engine` skill (AGENTS.md); the Drive folder Krish drops his takes in | `.agents/skills/video-engine`; Drive |
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
  changes next. A price, budget or contract means follow.the.money; what they
  build or buy means under.the.hood; how they think or what they expect means
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
  exists and waits on Krish), `approved`, `published`, `dropped`, and
  `absorbed` (a source card folded into a synthesized piece, `synthesize.ts`).
  Only Krish approves, drops or publishes.
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
  sweep runs it over the backlog once a day at 05:00 UTC (it ran every 10 minutes until 2026-10-03).
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
- **Rejection floor.** Every rejection Krish gave, with his words, and the
  standards read from them, by maker (`config/rejection-floor.json`, read with
  `python3 scripts/floor.py --format <maker>`). Nothing ships beneath it.
- **Failure register, failure loop.** `config/failures.json` (each failure he
  raised and the guard that now stops it, `python3 scripts/check_failures.py`)
  and `engine_incidents`, which the weekly learning run reads
  (`docs/learning/README.md`).
- **Ideas gate.** Two things share the name. On the board: only Krish's Approve puts an idea on a day of the
  publish board (`apps/control-plane/api/board/_gate.ts`; `docs/PUBLISH_BOARDS.md`, "The ideas gate"). In the Sunday
  ideas run: the checks that keep a week off the live board while they fail (`python3 scripts/post-pack/board_feed.py
  gate <Monday>`, the codes in `idea_checks.GATE_CODES`), among them `repeat` (no option repeats what went out in the
  last three weeks, or an earlier board's option he did not send back) and `aim` (from the 23 Nov board, every option says its
  shape, its aim, its funny line and its lookalike pattern).
- **Lookalike step, the Instagram inspo sheet.** In the Sunday ideas run, the patterns read from the newest posts of
  Krish's Instagram inspo sheet (`python3 scripts/post-pack/lookalike.py`, through `GET
  /api/inspiration/instagram-sheet`), used to find similar or better stories on the web. A pattern from carousels
  says how the story moves from card to card (`card_flow`), and an option drawn from a sheet post says its own take
  (`our_take`) (`.agents/skills/plan-week/references/lookalike.md`).
- **Narrative lock.** The one story for a piece, settled with Krish in the
  Sunday room and signed by him once
  (`docs/plans/<Monday>-week/narrative-lock-<day>.md`); the scripts are
  written from it.

## The Studio

Video is made with the ve engine (`docs/ve/ENGINE.md`, `docs/ve/RUNBOOK.md`); the quick-edit path stays the fallback until ve passes Phase 3.

- **ve.** The spec-driven video engine: schema 2 `creative-direction.json`, word-indexed beats and events, `FormatMaster`, and measured readiness from `python scripts/ve.py status <piece>`. The job and station terms below describe the separate job-based Studio protocol.

- **Series.** The Studio's own classification: the three subchannel names
  for new briefs, plus the retired `money_of_ai` and `built_with_ai` for
  records made under them (`packages/contracts/src/series.ts`).
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

## Looks, captions and the tall frame

- **Treatment.** A fixed recipe of effects (rebuilt from EffectCraft's catalogue) that the engine applies by rule
  from what a beat or still is for, at a strength the look sets; never chosen one by one and never shown as a menu.
  The bank is `config/ve/treatments.json`; the rules and the cards that draw them are in `docs/ve/TREATMENTS.md`.
- **Subject lift.** The treatment that cuts Krish out of his take or cover photo and treats the background behind
  him (darker, softer, a mint rim light). Card `ve-treat-1-subject-lift`.

- **Motion style.** One look a piece's motion is drawn in, from the motion layer of `config/style-references.json`
  (`style.motion` in the spec). A style the renderer can express is a motion profile
  (`apps/renderer/src/engine/kit/motion-profiles.json`); one that needs its own drawing is `needs_device` until a
  Codex card builds it.
- **Style lab.** `lab/styles/`: where a new look is designed and proved as a whole cut on his take, outside the
  renderer (`lab/styles/README.md`). Not `ve lab`, which renders the engine's existing looks on one window of his
  pinned take to check the house look has not moved.
- **The Ladder, The Living Screen.** The two lab styles Krish approved to use (11 Nov 2026): one lit 3D object that
  carries every number; a working interface the camera reads for the viewer. Bank ids `ladder`, `living-screen`.
- **Move.** One motion that says one thing (a count, a drop, a before-and-after), timed by the words that cue it:
  `packages/moves/` (`@mymu/moves`), re-exported unchanged in `lab/moves/`, called by every style and by ve.
- **Caption style.** How the spoken words are drawn on screen: the house caption, the word build, or one of 27
  caption styles, picked with `style.captions.theme` (the older `brand.caption_theme` still works), apart from the
  motion style (`config/caption-themes.json`, `apps/renderer/src/engine/captions/`; all 27 in `docs/ve/INGREDIENTS.md`). `art-directed` is the one
  Krish picked; `cinematic` is Audrey's cinematic caption system rebuilt for ve.
- **Hero word.** In the cinematic style, the one word on a page that carries the claim (a reversal, a number, the
  spoken stress), scored and set large; a setup line has none.
- **Safe column.** On the 9:16 frame, where words may sit: x 60 to 860 from y 280 to 1320, clear of every platform's
  top bar, action rail and handle (`config/channel-safe-zones.json`). Pictures may bleed past it.
- **Dress.** The wordmark and series tag on a frame. Wide cuts wear it; a tall cut's content never does, and its
  outro card keeps the wordmark (Krish, 11 Nov 2026).

## The story engine and the production cycle (branch `story/engine-v5`)

- **The reader (v5).** The people who make the calls or make the work in the
  creative, arts, music, entertainment, media and sports industries, reading on
  what AI is doing to how their work makes money. The approved North Star line is
  in `docs/NORTH_STAR.md`; the row every reader of it reads is `config/beat.json`
  `reader` (`audience_short`, `about`, `keep_line`, `media_line`, `buyer_test`).
  The old reader, a commercial leader who might hire Krish, is retired for this
  publication.
- **The beat.** `config/beat.json`: the focus sectors (sports among them since
  25 Nov), the avoid list, the economics keywords and the off-day worlds
  (`offdays`). A topic on the avoid list with no focus angle is `off_beat`.
- **Story engine.** The three stages every Sunday option passes before the board:
  the floor, the blind score and close calls (`docs/SYSTEM_MAP.md`, "The story
  engine").
- **Story floor.** `scripts/post-pack/story_floor.py`: the only code that reads
  his rejections; it answers pass or refused with reasons, never a number. His
  taste is a floor only (Ruling, Krish, 2026-11-26).
- **Story score.** `scripts/post-pack/story_score.py` over `config/story-score.json`
  (`story-score/1`): anchored 0 to 10 axes weighted per content type to a total
  out of 100, with hard floors per type. It orders the open days; it never
  reads picks, taste, cues, why_here or verdicts.
- **Blind view.** `blind_view()`: the only shape in which the scorer sees an
  option, with provenance fields and wording stripped.
- **Per-type rubric.** The weights and floors for each content type in
  `config/story-score.json` `types`: hero_mon, hero_wed, hero_fri, offday_short,
  offday_meme, goodnews, explainer, edition_item and wildcard.
- **Angle.** One of the ways into a story, pooled from in-session lens subagents
  and divergence-engine `provoke`, scored blind in one judged `score`; the
  funniest wins only when it is sound and close to the best.
- **Whys probe.** The pre-pick `why-ladder/1` a blind subagent writes from an
  option's own sources, checked by `scripts/whys-probe-check.ts`
  (`docs/FIVE-WHYS.md`, "Before the pick").
- **Close call, council.** When a slot's top two are within the margin, a blind
  council (ai-harness `skills/council`) reads A against B; when it cannot, the
  card says "close call, your pick".
- **Wildcard.** On every Monday, Wednesday and Friday, at least one option that
  is completely divergent, strange, obscure or unexpected, labelled "Wildcard: ",
  scored as its own type and checked for distance (Ruling, Krish, 2026-11-26).
- **Gate codes `story`, `story_floor`, `wildcard`, `off_beat`, `carousel_format`,
  `touch`.** What `board_feed.py gate` refuses a board on from the rubric's
  `from` date: a missing or out-of-order score, a floored option on the board, a
  hero day with no checked wildcard, an off-beat option, a carousel deck that
  breaks the format, a required touch of the cycle missing.
- **Blind proof.** The A/B test of the engine against the 16 and 23 Nov boards,
  frozen at a committed engine SHA before any paid call
  (`docs/plans/proofs/2026-11-26-story-engine-v5/PROTOCOL.md`).
- **Production cycle, stage, touch.** `config/cycle.json`: the cycle's stages 0
  to 10 and every read or inform of another system at each, run by
  `scripts/post-pack/touch.py`; one line per touch in the week's
  `touches.jsonl`.
- **Outbox.** `.cache/touch/outbox.jsonl`: connector touches queued while
  `CC_HARNESS_KEY` is not set; `touch.py drain` sends them.

## Operations

- **Publish board.** The week in Control Centre's Content tab, at
  `#/content?week=<Monday>&day=<day>`: the one live board, where Krish presses,
  drawn from the engine's view (`docs/PUBLISH_BOARDS.md`). Fed by writing what
  the view reads, never by a page. The old pages at
  content.krishraja.com/board/<Monday> are retired for good and redirect to it
  (Ruling, Krish, 2026-11-13).
- **Making record.** A piece's record of each making step (`meta.making`),
  read and written with `scripts/post-pack/making.py`.
- **Hero assets, off days.** The article, both cuts, thumbnails and covers this
  engine makes for Monday, Wednesday and Friday; Tuesday, Thursday and
  Saturday are the off days. Since 26 Nov 2026 this engine makes the off-day
  posts too, and every other asset; Growth posts them (`docs/GROWTH-HANDOFF.md`).
- **The split (26 Nov 2026).** Content-engine makes every asset and hands Growth
  finished, approved assets with their captions in the piece manifest;
  growth-makeyourmindup grows the channel and reports performance back
  (Ruling, Krish, 2026-11-26).
- **v5 Library.** The locked set of templates that is the only artwork for every
  still (covers, thumbnails, carousels, memes, Notes images), drawn by
  `scripts/covers/make_covers.py` and `scripts/library/make_piece.py --set <set>`.
  It lands on `main` separately; until then every route refuses with "the v5
  Library is not on this checkout yet".
- **Asset routes.** `config/asset-routes.json`: every asset kind mapped to its
  Library command, fixed artwork, retired (the Canva lane) or a named gap;
  `scripts/post-pack/asset_routes.py` prints or runs the command.
- **Carousel deck.** `carousel-deck/3`: a carousel as the Library will draw it,
  written before anything is drawn and checked against
  `config/carousel-format.json` by `scripts/carousel_format.py`; refusals fail
  the run. `scripts/carousel_make.py` is the one route a carousel is made by.
- **Captions step.** `scripts/post-pack/channel_captions.py`: each channel's
  words, subscribe line and YouTube title, written at make time into the
  manifest's SPEC, read blind and voice-checked; Growth posts them as they are.
- **Piece manifest 1.1.** `content-engine-piece-manifest/1.1`, the minor version
  that adds a per-channel `title`.
- **Saturday Note.** The Substack Note that points at the weekly edition, made by
  `scripts/post-pack/saturday_note.py` with its two tagged links.
- **3 Posts.** The Drive folder that holds one folder per post, everything
  ready for posting.
- **Run ledger.** `content_engine_runs`, one row per cron run.
- **`meter_daily`.** Spend per agent key per day.
- **Docs steward.** A job defined in ai-harness and called by
  `.github/workflows/docs-steward.yml` on every push to `main` and nightly at
  20:30 UTC. It keeps `NOW.md` and `docs/history/LOG.md` current and moves
  superseded documents into `docs/history/`. A merge by auto-merge starts no
  push run, so auto-merge starts it as a dry run (the validator, no model);
  only the nightly run writes.
- **The walk.** The first end-to-end live run of pieces through the engine,
  logged in `docs/walks/2026-09-three-piece-walk.md`.
