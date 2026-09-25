# The three-piece walk

A live log of taking one ready idea per subchannel from "judged ready" to the
edge of publishing, driven from a Claude Code session straight against the
engine's API rather than through Control Center. The point is to harden the
backend first and to leave durable knowledge for the front-end work that
follows, so nobody has to sift a chat transcript to learn what the engine
actually does.

Started 2026-09-24. Pieces are walked in series: the first finds the
structural holes, the second shows which were one-offs, the third proves the
path repeats.

**How to read this.** Four running sections sit above the per-piece logs and
are kept current as the walk goes:

1. *What the backend actually does*: verified behaviour, route by route, with
   the evidence. Code that was read counts as a claim until a live call has
   confirmed it, and each entry says which.
2. *Hardening*: every engine change made during the walk, with its commit.
3. *Front-end implications*: what Control Center must change, and why, stated
   so a front-end session can act on it without this conversation.
4. *Open questions for Krish*: decisions that are his, never settled here.

Each step in a piece's log records one of three outcomes: **works** (note it),
**missing** (build it), **wrong** (fix it).

---

## 1. What the backend actually does

Sources: every handler under `apps/control-plane/api/content-ideas/` read on
2026-09-24, Control Center's calls into it, live probes, Vercel runtime logs
and the database. **Read** means the code says so; **live** means a call or a
query confirmed it.

### Reaching it

- Control Center has no content routes of its own. `control-center/vercel.json`
  rewrites `/api/content-ideas/:path*`, `/api/content-edits`, `/api/video-studio/:path*`
  and a dozen other trees to the engine's production host. The browser calls
  relative paths and sends only `Content-Type` plus whatever cookie the domain
  holds; `apiFetch` adds no auth header. (read)
- **Auth is split in two, and most of the idea surface has none.** (read, live)
  - `guard()` in `api/_auth.ts` checks the `cc_access` cookie (a sha256 of the
    dashboard access code) and fails open only when the code is unset. It is
    set in production: a POST to `judge` for a nonexistent id returned 401.
    Used by `judge`, `editorial-route`, `production-brief`, and
    `/api/content-edits`. `archive-stale`, `cluster` and `triage/sweep` use
    `guardCronRoute` (bearer cron secret, or the cookie on POST).
  - `preamble()` in `api/_content.ts` checks only the HTTP method and sends
    `Access-Control-Allow-Origin: *`. **No auth.** Used by `challenge`,
    `channel-cut`, `chat`, `final-pass`, `revise`, `save-draft`, `schedule`,
    `score`, `research-topic`, `synthesize`, `voice`. `deepen`,
    `dive-deeper`, `materials` and `video-script` set CORS inline and check
    nothing either. So does the bare `/api/content-ideas` POST and PATCH,
    which can set `state`, `body` and `published_url` on any row.
  - 22 engine files use `preamble()` in total; only the idea routes are in
    scope for the walk.
- **The browser path through a guarded route is unproven.** In the 7 days to
  2026-09-24 the engine logged no browser call to any idea route at all, and
  no request ever reached `/api/content-edits`: every ledger row in
  `content_edit_events` came from the triage desk (direct SQL) or the open
  PATCH. Whether the rewrite carries the cookie, and whether both projects
  hold the same access code, has never been observed. The decide card built
  on 2026-09-24 records through `/api/content-edits`, so this is the first
  thing to confirm once a person uses it. (live)
- No n8n workflow and no engine code calls the idea routes, so gating them
  affects only the browser path. (read)

### Models and spend

- `claude-sonnet-5` for drafting-class calls ($2 in, $10 out per million
  tokens), `claude-haiku-4-5` for judges ($1, $5), `claude-opus-4-8` only for
  `revise` in humour mode ($5, $25). Temperature is never sent to sonnet-5 and
  thinking is disabled. (read, `api/_models.ts`, `api/_prices.ts`)
- Anthropic spend lands in `meter_daily` per agent key per day (a running
  total, so one call's cost is the difference before and after). Perplexity,
  Exa, Brave, NewsAPI and Apify are not metered. `panel_runs.cost_usd` and
  `judge_verdicts.cost_usd` are always 0. (read)
- **No drafting-class route has been called in 60 days.** `meter_daily` holds
  no row for `cleo-revise`, `cleo-final-pass`, `cleo-deepen`, `cleo-challenge`,
  `standards` or `video` in that window, while the ladder and judges logged
  daily. Stages 3 to 5 have not run at all, not merely failed. (live)

### The path an idea takes, and where it breaks

Intended order, with what each step writes:

0. Protect the row from the Monday purge, which hard-deletes `seeded` and
   `researching` rows past `expires_at` (`api/purge/run.ts`): PATCH
   `{state:'drafting'}`.
1. Research, optional, one call at a time: `dive-deeper`, `deepen`
   (`format` must be passed for any live slug or it 400s), `challenge`,
   `materials`. Only `meta.materials` and `meta.research` feed later steps;
   `meta.challenges` is written and read by nothing.
2. **First draft: no route drafts into an existing row.** `research-topic`
   and `synthesize` create new rows; `revise` rewrites text it is handed;
   `chat` replies. (read) This is the stage-3 hole.
3. Iterate with `revise` (SSE; returns text, writes no body), then PATCH the
   body.
4. Check with `score` (advisory) and `judge {gate:'draft'}` (7 draft judges;
   needs 400+ characters).
5. `final-pass {source_text}`: writes `meta.final_pass`, returns
   `cleaned_text`, writes no body. Instant-fail blocking is client-side only;
   nothing server-side reads `meta.final_pass`.
6. `save-draft`: posts to the n8n content factory with `krish_approved: true`,
   and only if that succeeds writes the body, a Google Doc link and
   `state:'review'`. It demotes an `approved` row back to `review`.
7. PATCH `{state:'approved'}` stamps `meta.production_approval` (body of 200+
   characters required).
8. `schedule {date}` writes `scheduled_for` only.
9. `production-brief`: only for `lane:'publication'` with slot
   `money_of_ai` or `built_with_ai`.
10. PATCH `{state:'published', published_url}` stamps `published_at`. (The
    handover said nothing writes the publish fields; PATCH does. Nothing
    automatic does.)

Known breaks the walk will hit, in order:

- **`lane` is null on every walk piece** (live). The ladder sets `lane_slot`
  and never `lane`, and no route can set `lane` or `lane_slot` on an existing
  row. Downstream, `laneToVenture` sends a null lane to the `dynamic`
  ("Unassigned") final-pass rubric and `laneToCorpusChannel` returns no
  playbook.
- **No stage knows the three live subchannels.** `laneToVenture`,
  `laneToCorpusChannel`, `save-draft`'s channel map, `deepen`'s format check
  and `production-brief`'s series check all speak the retired `paid` /
  `built` / `money_of_ai` / `built_with_ai` keys. `save-draft` also maps
  every non-`built` publication slot to `paid`.
- **Whole-`meta` overwrites.** `final-pass`, `revise`, `challenge` and
  `deepen` read `meta`, wait 30 to 120 seconds on a model, then write the
  stale copy back. Two calls at once lose one of them.
- **The final-pass rubrics are older than the mandates.** `_finalPass.ts`
  hand-writes a rubric per venture. The `built` rubric instant-fails a piece
  that "Krish did not build or watch being built", which is exactly what the
  under.the.hood mandate requires (never his own builds). The mandates were
  rewritten on 2026-09-17; the rubrics were not. (read)
- **The house close rule contradicts two mandates.** `VOICE_GUARDRAILS` in
  `_content.ts` says every piece ends "on a hard, forward-looking verdict".
  mind.the.gap forbids a closing moral and under.the.hood says the verdict is the
  reader's to reach; only follow.the.money wants a verdict close. The draft route
  tells the model the mandate wins on structure and the close. (read)
- **`judge_calibration` cannot grade a judge that said "revise".** The view
  sets `agreed` only for `pass` and `kill` verdicts. On piece 1, three of ten
  judges said revise (evidence 7, prosecutor 6, voice_mechanics 4) and are
  invisible to calibration however Krish decides. (live)
- **Curation output was never read downstream.** `meta.contrarian`,
  `meta.adjacent_stories` and `meta.krish_notes` are written by the triage and
  inspiration lanes and read by no drafting-class route. (read; H3 reads them)
- **Ledger gaps.** A PATCH that only changes state (`published`, `dropped`)
  writes no `content_edit_events` row, so publishing never reaches
  `judge_calibration`. `chat` meters as `unattributed`. Nothing writes
  `composer_sessions`.

## 2. Hardening

| # | Change | Why | Commit |
|---|---|---|---|
| H12 | The fact gate (`api/_factGate.ts`, `POST /api/content-ideas/:id/fact-check`). A model lists every checkable claim; a mechanical sweep turns any sentence with a digit or a quotation that the list missed into a claim of its own, and honours a set-aside only when the sentence reads as a forecast. Each claim is checked twice: on file (the model must return the passage verbatim; code confirms the quote is in the sources and carries every number in the claim, so a model cannot vouch) and independently (Perplexity `sonar-pro`; without its key, Exa or Brave results judged, the evidence confirmed in them). `PATCH` to review, approved or published and `save-draft` on a live subchannel return 409 `fact_gate` until a check of that exact body passed with an independent checker connected. The hash is taken over the text as `save-draft` stores it. Control Center shows the refusal in the approve, publish and card paths. Test: `tests/control-plane/fact-gate.test.ts` (19 tests; nine mutations, each caught). | F13. Krish, 2026-09-25: "we cannot afford even a chance of factual errors slipping in." Writing the tests found a sweep bug: a heading with text on the next line hid that text. |
| H11 | Materials carry who added them (`by`), and writers and checkers see only Krish's under his name. `materialsContext` groups by owner: "BACKGROUND MATERIALS Krish provided" for his, "RESEARCH ON FILE, gathered by the engine / an agent session, not by Krish" for the rest. The materials route stamps `by` from the same attribution the ledger uses (cookie: Krish; operator bearer: the agent, unless relaying with `decided_by: 'Krish'`). Engine research (`kind: 'research'`) with no `by` is the engine's. Test: `tests/control-plane/materials-owner.test.ts`, mutation-checked. | F12, fixed before attaching piece 2's research, which would otherwise have reached the writer as Krish's own. |
| H10 | `final-pass` output room 3,200 to 6,000 tokens, and it reads sources at a checker's allowance (4,000 characters an item, 16,000 in all, against a writer's 2,400 and 9,000). | F6: the result echoes the whole cleaned draft inside its JSON, so a 900-word piece plus suggestions ran past the cap and the JSON was cut off: 2 of 5 walk runs returned 502 "could not parse" and lost their spend (about $0.057 a run is what a run at the cap costs). F5: at the writer's allowance the oldest research, the $68.6B, was "[trimmed]". | see git log: `engine: judges read what the piece was written from` |
| H9 | The draft judges read what the piece was written from. `curationBlock` moves to `api/_curation.ts` (shared by `draft` and `judge`). On the draft gate, `judgeContext()` adds the subchannel's mandate and "The sources on file" (angle, counter-case, dated stories, research, materials, Krish's notes) at the checker allowance. The idea gate is unchanged. | F11: `evidence_integrity` graded evidence it could not see. It gave 9 to the first draft, whose headline figure had no source, and a kill ("invents a specific Amazon-Meta-Shopify dispute") to v8, whose every claim is on file. `channel_fit` had no mandate, only an optional free-text `channel` nobody passes, so it guessed (Substack, LinkedIn, "Mindmaker Live: Paid"). | see git log: `engine: judges read what the piece was written from` |
| H8 | R2 finished. Krish's "cut it everywhere" covers the stored config and both orders. `system_config.content_voice_block`: the "Not X, Y" clarifier section (which called it his most consistent habit, with four worked examples) is replaced by a retirement note naming every shape; the "mechanism name" section no longer models the move. `system_config.content_corpus`: the line "Discard the lazy version out loud... The 'Not X, Y' move" is replaced. Both edits by position and exact match in SQL, read back after. `VOICE_GUARDRAILS` names "Y, not X" and "never X, it was Y". `voiceMechanics()` now reports every hit (up to five, then a count), adds "never X, it was Y", the reverse order and the after-a-colon form, and skips hedges about evidence ("is not established. It's...") and idioms ("not surprisingly", "not only"). On piece 1's v2 it finds all eight lines a reader finds. | F1: the voice block beat the house rule three times. F9: the check named one hit of eight and missed three shapes. | see git log: `engine: R2 in both orders, every hit reported` |
| H7 | Rule R2 made active in code. `VOICE_GUARDRAILS` (read by draft, revise, chat, final pass and channel cuts) carries it as a hard rule that overrides any voice note calling the move a habit. The persona lines in `_revisePrompt.ts` and `chat.ts` no longer list the "Not X, Y" clarifier, the legacy Signal & Noise rubric's `leadWith` and the eval suite's "More contrarian" preset no longer teach it. `voiceMechanics()` flags the unambiguous shapes (sentence-initial "Not X, Y", "isn't X, it's Y" across a comma or a full stop, "it's not X, it's Y"); "Y, not X" is left to the prompt rule because it is ordinary English more often than it is the move. The draft gate runs this check, and so does the idea ladder, so an angle written in the construction now takes the voice check's 4. **Not yet changed:** the stored voice block, which still teaches the move as Krish's signature (section 4), and the Control Center presets in `src/lib/contentEngine.ts` ("More contrarian" and the Signal & Noise adapt hint). | Krish's rule, given 2026-09-24. Five places in the engine taught the move, and none of the seven draft judges flagged the draft's four uses, because the voice judge reads the same voice block that recommends it. | see git log: `engine: cut the "Not X, Y" move everywhere` |
| H6 | The ledger says whose event it is. `operatorAttribution()` in `_editEvents.ts`: a request on the operator bearer acts as itself (`surface 'api'`, its agent client, `actor` = that client, `confirmation_state 'observation_only'`) unless it sends `decided_by: 'Krish'` to relay a decision he made in words; a bearer can never claim `desktop`/`mobile`. Applied in `/api/content-edits`, the `PATCH` choke point, `draft` and `revise`. An operator cannot approve, drop or publish on its own say (403 `a_decision_needs_krish`), because those rows settle the judges in `judge_calibration`, which reads no actor. `PATCH` with `edit_source: 'magic'` records no `manual_edit` (the accept is recorded by whoever accepted it). `learning/compile.ts` reads `actor = 'Krish'` and not `observation_only` only. | `actor` defaults to 'Krish' and the compiler read every row, so an agent session's own drafts and kept rewrites would have been learned as his taste; and every body change through `PATCH` was logged as a Krish `manual_edit` from composer/desktop, including a rewrite he (or an agent) accepted. The Studio already had the rule (non-user origin is `observation_only`, `packages/core/src/feedback.ts`); the content ledger never applied it. One row already carries the wrong actor: sequence 45, the piece 1 `draft` invocation, written before this fix as `actor 'Krish'`. The table is append-only by trigger and that is right, so it stays; it is one invocation, well under the compiler's threshold. | see git log: `engine: an agent's ledger rows are its own` |
| H5 | `revise` reads the live mandate: `loadSubchannel` on the piece's `lane_slot` (or the subchannel an `adapt-` value targets) and `buildReviseSystem` puts it in the system prompt, marked as winning over the voice notes on question, structure and close. The persona line drops "hard-verdict endings" when a mandate is present; an unrouted piece's prompt is byte-identical to before. The humour path (`buildHumourSystem`) is not yet given the mandate. | draft and final-pass read the mandate, revise did not, and its persona line told every rewrite to end on a hard verdict. The under.the.hood mandate forbids a closing moral, so each revise pass would have pulled an under.the.hood piece toward failing its own test. | see git log: `engine: rewrite a routed piece to its mandate` |
| H4 | `final-pass` judges a live subchannel against its mandate: `subchannelRubric()` in `_finalPass.ts` builds the rubric from `venture_formats` via `loadSubchannel`, instant-fails only on the mandate's hard gates, flags (never blocks) unverifiable claims, and sets `mandateGovernsClose` so the house "end on a hard verdict" absolute is dropped. `laneToCorpusChannel` returns the live slot for a null or publication lane, so `revise`, `chat` and the judges get the subchannel's playbook. | A routed piece has a null lane, so final-pass used the Unassigned rubric and every drafting route got no playbook; the hand-written rubrics predate the 2026-09-17 mandates (see section 1). | see git log: `engine: judge a subchannel piece against its own mandate` |
| H3 | New `POST /api/content-ideas/:id/draft` and `api/_subchannels.ts`. The route writes a full draft into an existing idea, against the subchannel's mandate read live from `venture_formats` (aliases via `format_aliases`), with everything curation left on the row: the angle the panel judged, `meta.contrarian`, `meta.adjacent_stories`, research, materials, and `meta.krish_notes` verbatim. Writes `body`, `state:'drafting'`, `meta.drafts` (with the model's own list of labelled inferences and open questions), and a `magic_invoked` ledger row carrying `panel_run_id`. Write guarded on `updated_at`. Refuses an unrouted idea (409 `no_subchannel`). | No route could draft into an existing idea (stage 3 did not exist), and nothing read what curation produced. | see git log: `engine: draft into the idea curation already worked up` |
| H2 | `/api/content-edits` (the ledger), `judge`, `editorial-route` and `production-brief` move from `guard()` to `guardEngine()`. `check-unified-content-spine` and `check-content-production-bridge` now assert `guardEngine`. | They were cookie-only and failed open when the access code was unset. The walk records Krish's decisions through the ledger and judges drafts, so they need the same gate as the rest. | see git log: `engine: one gate for the ledger and the judges` |
| H1 | Every route under `api/content-ideas/` and the bare `api/content-ideas.ts` now calls `guardEngine()` (`api/_auth.ts`): the `cc_access` cookie or `Authorization: Bearer $ENGINE_OPERATOR_TOKEN`, refusing both when unset, origin pinned. `voice.ts` is wrapped rather than changing the shared `_whisper.ts`. `ENGINE_OPERATOR_TOKEN` created on the engine's Vercel project (sensitive, production only). | 13 routes, several of which spend or write, had no auth. The bearer lets a session with no browser drive the engine without holding `CRON_SECRET`. | see git log: `engine: gate the idea routes` |

**One narrow exception, `score`.** The Postgres trigger
`trg_autoscore_content_idea` posts `{model:'haiku'}` to `score` through pg_net
with no credential whenever a row first gets a body (178 rows scored this
way). Gating it would have switched quality scoring off silently. So `score`
admits exactly that body, scores only the row's own stored body, and only
for a row with no `quality_score`; anything else needs a credential. Storing
a bearer for the trigger in Supabase Vault would remove the exception, but
writing a secret into the Vault was stopped by the session's safety check and
is Krish's call (section 4). Covered by
`tests/control-plane/score-autoscore.test.ts` (4 tests, mutation-tested).

**H1 verified live 2026-09-24** against production `574695a`: with no
credentials or a wrong bearer, `revise`, `final-pass`, `chat` and the bare
PATCH return 401; the operator token passes the gate (a fake id then 404s);
`score` admits `{model:'haiku'}` without credentials and refuses any other
model; preflight returns 204. No call spent.

Checks for H1: `tests/control-plane/engine-auth.test.ts` (9 tests) calls
every idea handler with no credentials and requires a 401, with Supabase
pointed at a dead local address so a missing gate cannot write to production.
Mutation-tested three ways (a route left ungated, fail-open on a missing
access code, the cron secret accepted); each was caught.

**Pre-existing failures, not from the walk** (red on the base commit
`3bb3b49` before any walk change): `check-run-recovery` (`judge_ladder` and
`judge_sweep` are not in `api/content-engine/_jobs.ts`) and
`check-cache-metering` (`api/_judges/batch.ts` and `panel.ts` read cache
token fields directly instead of through `readUsage()`). Two media tests fail
in a container without ffmpeg; they are environmental.

**Found on piece 1's iteration, not yet fixed** (each one is a backlog item,
with the evidence that found it):

| # | Stage | What is wrong | Evidence |
|---|---|---|---|
| F1 | revise | The stored voice block beats the house rule and a direct instruction. After H7, a full revise told "zero Not X, Y" kept about seven; a second revise that quoted the eight offending sentences back kept most of them. Only line-by-line rewrites cleared them. | piece 1, v2 and v3. The fix is the voice block edit (section 4). |
| F2 | revise, in place | The select-and-rewrite path splices back whatever the model returns. Given a heading, it returned the heading without `## ` plus the next sentence, so the heading stopped being a heading and a sentence was duplicated. Twice it changed the meaning of the line (invented a position for Amazon; "measured, not projected" became "measured against your actual logs"). | piece 1, 8 in-place calls: 6 clean, 1 broken splice, 2 meaning drifts. The route should refuse a fragment that carries text from outside the selection and keep a heading's markdown. |
| F3 | revise | The model wrote the instruction into the piece: "Say the ad-revenue read once, plainly:" appeared in the body. | piece 1, v3 |
| F4 | revise, final pass, judges | An invented attribution passed everything. v2 said GeekWire reported Meta's view that Muse "shouldn't need special authorization to do what any browser extension already does". Nothing on file says it. The final pass missed it, and `evidence_integrity`, the judge for it, returned nothing ("the judge did not return an object") on that run. | piece 1, v2, panel `b1c852d4` |
| F5 | final pass | It cannot see the research it grades against: materials reach it trimmed ("[trimmed]"), so it asked to verify the $68.6B and the Perplexity claim, both of which are on file. | piece 1, v2 and v5 |
| F6 | final pass | Volatile and fragile. v2 "close to ship-ready", v5 (which fixed v2's faults) "not ready", with researched 4 to 3 and helpful 4 to 3. One call returned unparseable output: 502, no retry, spend lost. | piece 1, 4 runs, $0.23 |
| F7 | final pass, judges | The pitch fields go stale. The row's `idea` still states the ad motive as fact and a pitch field still carries the retired $56B; the final pass reads them and flagged the mismatch. Nothing offers to update them when the piece changes. | piece 1, v5 |
| F8 | draft judges | `channel_fit` grades against retired channel names ("Mindmaker Live: Paid", Signal & Noise, LinkedIn), not the subchannel mandate, and misread the length (said 1,200 words for 1,008). The voice judge reads the voice block, so it marked the signature section labels as "scaffolding" (a conflict with R3 for Krish to settle). | panels `b1c852d4`, `68a94a2f` |
| F9 | voice check | Reports only the first "Not X, Y" it finds; misses "never X, it was Y"; one false positive on honest hedging ("is not established. It's the plainest explanation"). | piece 1, v2 |
| F11 | draft judges | The draft gate saw no sources and no mandate. Fixed as H9. | panel `c533a27c` on v8: `evidence_integrity` kill 3, "invents" a dispute that is on file |
| F12 | materials | Research the engine ran (`dive-deeper`) is filed as materials and presented to every writer and checker as "BACKGROUND MATERIALS Krish provided (his own research, treat as primary source)". It is a Perplexity summary, a secondary source the engine fetched, and it is not his. A checker told it is primary will not question it. | `materialsContext()` in `_content.ts`; piece 1 research | **Fixed by H11 (2026-09-25).**
| F13 | draft | The engine's first draft of piece 2 got six facts wrong with the right sources on file: Cisco's "$900 million annually" became "close to a million dollars a year"; Anthropic shown selling one model in 2024; Altman's "way dumber" attributed to the wrong moment; the router's date wrong; "you don't set the dial" contradicted by the docs it was given; an invented "because". The judges gave evidence 9. Nothing in the chain checked a claim against its source. Fixed as H12 (the gate); the writer itself is unchanged. | piece 2, v1 against the material filed by `claude_code` |
| F14 | judge sweep | Editing the thesis of a piece in `drafting` changes its `artifact_hash`, so the 10-minute sweep re-judges it and the ladder may repair (rewrite) the thesis. So piece 2's stale thesis (F7 again) is left alone for now. | `candidateQuery` in the sweep includes `drafting` |
| F10 | research | `dive-deeper` caps Perplexity at 1,200 tokens, so a three-part question is cut off mid-sentence. Each call also rewrites the whole `meta`, so calls must run one at a time. | piece 1, research |

## 3. Front-end implications

Collected as the walk goes; finalised after piece 3.

- **The composer should send `edit_source: 'magic'` on the autosave that
  follows an accepted rewrite** (H6). Until it does, an accepted rewrite is
  still logged twice: once as `magic_accepted`, once as a Krish
  `manual_edit`, and the compiler reads the second as him typing.
- **An operator session relays a decision with `decided_by: 'Krish'`**, and
  only then. Any surface that lets an agent act for him (a Claude chat, the
  triage desk run by Claude) needs to carry that explicitly (H6).
- **Show the voice check inline, every hit** (F9): the deterministic check is
  the only thing that caught R2 violations, and it names one.
- **Select-and-rewrite needs a guard or a preview of the splice** (F2).
- **Offer to update the headline and thesis when the body moves** (F7).
- **Ask Krish in plain messages on mobile** (section 4): tool answers were lost.
- **A "Check the facts" action and the claim table** (H12). The gate refuses
  with a plain reason, but only an agent session can run a check today. The
  composer needs the button, and a table of every claim with its verdict, the
  quote from the source and the link, failing claims first. It is a new
  surface, so it starts as a mock for Krish.

## 4. Open questions for Krish

- **Rotate four credentials.** A Supabase CLI token, a Vercel access token, a
  GitHub PAT and an n8n API key were pasted into the walk session's chat on
  2026-09-24, so they are in that transcript. None was used. Replacements
  belong in the cloud environment's settings, not in chat.
- **`ENGINE_OPERATOR_TOKEN` after the walk.** Delete it, rotate it, or keep it
  and add it to the cloud environment so future sessions can drive the engine.
- **Give the autoscore trigger a credential?** Store the operator token in
  Supabase Vault as `engine_operator_token` and have
  `autoscore_content_idea()` send it, which closes `score`'s one
  unauthenticated path. It needs a write into the secret store, which the
  walk session was not allowed to make on its own.
- **Settled: cut the "Not X, Y" move everywhere** (Krish, 2026-09-24; rule R2,
  active as H7 and H8). "Everywhere" covered the voice block: he said so when
  asked again ("I already answered your questions"). The block and the corpus
  were edited on 2026-09-24 (H8). What follows is the record of why it took
  two asks:
  `system_config.content_voice_block` still has a section teaching the move as
  his most consistent habit, with worked examples, and its "mechanism name"
  section models it. Every writer reads that block, so it now contradicts the
  hard rule beside it; the rule is marked as overriding it, and the voice
  check catches slips. Editing the block changes the instructions every
  writer model reads, and the walk session's permission rules would not let
  it make that change or copy the old text into this log. It needs Krish's
  explicit go-ahead, or his own edit in Control Center.
- **Before asking, check whether an earlier answer already covers it.** Read
  his answers for their reach, not their literal scope: "cut it everywhere"
  covered the stored voice block, and asking again cost him a round trip.
- **Ask by plain message, not the question tool, when he is on mobile.** On
  2026-09-24 four answers he gave in the tool reached the session as
  "[No preference]". A plain message cannot be lost that way.
- **The browser path through `guardEngine` needs one real visit.** After H1
  deploys, open any idea in Control Center once. A 401 in the engine's logs on
  `/api/content-ideas/*` means the two projects hold different access codes or
  the rewrite drops the cookie; one revert restores the old behaviour.

## 5. The craft standard, stage by stage

Krish, 2026-09-24: the objective is to train every stage from ideation to
post-production so the engine assists him at 10/10 at each one, and learns
from every live run. Examples he named: when to make an interactive
artifact and what it should look like, the signature voice of the carousel
format, the humour and delivery of a video Short, and how a video is post
produced when speed matters versus when effort does.

**How the walk trains, within the engine's own rules.** Every durable taste
rule needs Krish's explicit approval (`AGENTS.md`). Silence is not feedback,
and a model may never record that he expressed a preference he did not state
(`docs/ENGINE_SESSION.md`). So each stage of each piece records:

- what the engine proposed, verbatim or by artifact hash;
- what Krish decided, and his reason in his own words, only when he gives one;
- the candidate rule it suggests, marked **proposed** until he approves it,
  then **approved**, then the commit or config row that makes it **active**.

Decisions reach the learning ledger (`content_edit_events`, joined to the
panel by `panel_run_id`), not this file. This file is the engineering record
and the index of proposals; it is not a memory store.

**Where an approved rule becomes active**, by stage:

| Stage | Where the standard lives today | Tracked from a cloud session? |
|---|---|---|
| Ideation and curation (what is worth writing) | the judge rubrics in `apps/control-plane/api/_judges/`, `venture_formats` mandates | yes, through the ledger |
| Drafting and iteration (the argument, the voice) | `system_config.content_corpus` playbooks, `_revisePrompt.ts`, `_finalPass.ts` rubrics | yes, through the ledger |
| Channel selection and per-channel copy | `channel-cut.ts` channel rules, `transformed_outputs` | yes, through the ledger |
| Carousel, video Short, interactive artifact, post-production | Studio configuration in Git, promoted only through the tracked Studio gateway | **no.** The gateway is a Windows stdio proxy reading Windows Credential Manager (`.mcp.json`), so a cloud session is `read_only_untracked` for the Studio. It can draft a production brief but cannot record Studio learning. |

**Candidate rules** (proposed until Krish approves; approved rules name where
they become active):

| Rule | Text | Source | Scope | Status |
|---|---|---|---|---|
| R1 | Where evidence is thin, the draft may argue from clearly labelled hypotheticals and reasoned predictions rather than dropping the piece. Inference is marked as inference. | Krish's note on piece 1 (triage desk, 2026-09-24): "In the absence of tons of evidence, we need to look at hypotheticals and sense-backed predictions." | Trial on all three walk pieces, passed to the draft as direction, not yet in any engine prompt | **proposed**, approved for trial 2026-09-24 |
| R2 | No "Not X, Y" construction, at any scale, in any piece: no "Not X, Y", no "it's not X, it's Y", no "X isn't the story, Y is". Say the sharper take directly. | Krish, 2026-09-24, answering "The draft used it four times. What's the rule?": "Cut it everywhere." | Every drafting and rewrite path, the stored voice block, and the deterministic voice check | **approved** 2026-09-24, both orders; **active**: engine code (H7, H8), the stored voice block and corpus (H8), Control Center presets on the branch |
| R3 | A publication piece has clear signature sections instead of paragraph after paragraph, and each subchannel has a signature visual (follow.the.money: the mandate's "money map", where the dollars enter and where they leave). | Krish, 2026-09-24: "the old school of publishing five years ago would be a bog-standard blog post that is just paragraph after paragraph. I'm wondering whether that's too boring and we need to make it either signature sections that are really clear. How does it become a visual piece? Do interactive artefacts get involved? Do generated images get involved?" | Sections trialled in piece 1's revision; the visual is designed after the copy locks | **approved in direction** 2026-09-25 and specified as the Signature Pack in `docs/CREATIVE_IDENTITY_UPGRADE.md` (each subchannel's device from the diagram language its mandate names; the piece's sections are the device's states). Specific designs still need his approval on rendered evidence |
| R4 | An opening hooks on consequence: it makes the reader feel this is consequential and think about what could happen next, with more personality and a sharper point, and it lets the reader reach the conclusion rather than handing it to them. It may provoke; it never argues the reader into a verdict. | Krish, 2026-09-25, on piece 1's question-led opening: "it needs to have a lot more personality and make a much clearer point. The first opening has to really hook the reader until they need to know this or what might happen as a result. The average reader needs to feel like this is consequential and make them think about what could happen, as opposed to us forcing our opinion on them. But it should probably be a bit more inflammatory in that way." (ledger sequence 66) | Openings on all three walk pieces | **proposed** 2026-09-25 |
| R5 | mind.the.gap's timeline shows what used to be, what is now, where it could go and how it could fork into scenarios; the Call sits on one branch. | Krish, 2026-09-25, on piece 2: map out "what used to be the case, what is the case now, where this could go, how it could fork off into different scenarios" | The mind.the.gap device, which lives in its mandate | **proposed** 2026-09-25; a mandate change, so it waits on his yes |

Standards by stage (filled as the walk reaches each one):

| Stage | What the engine does today (verified) | What 10/10 looks like (from Krish's decisions) | Candidate rules | Status |
|---|---|---|---|---|
| Ideation | judge ladder: 9 idea judges, lower median, repair, confirm | | | |
| Curation | ranked ready list, decide card with reason codes | Piece 1: the mandate's boundary question ("what does the reader change next?") decided a router-contested piece; Krish chose the subchannel whose reader acts on a budget. All four reasons to write applied. | | |
| Drafting | *(no route drafts into an existing row)* | | | |
| Iteration | `revise` presets, `final-pass` per-venture rubric | | | |
| Channel selection | router fit across three subchannels; `channel-cut` | | | |
| Copywriting per channel | | | | |
| Interactive artifact | *(no engine stage)* | | | |
| Carousel | Studio carousel director | | | |
| Video Short | Studio video engine | | | |
| Post-production, speed vs effort | | | | |

---

## Piece 1: follow.the.money

`6cb0d213-1aa6-44d3-8dc2-0b91d8dde4df`. "Amazon's takedown of Muse is a
pricing dispute wearing a security notice." Panel 7, three model judges at 8,
lowest model judge 7; the only fault the panel named is the deterministic
voice check (an em dash or banned phrase in the angle).

| Step | Call | Result | Spend | Outcome |
|---|---|---|---|---|
| 1. Decide | Krish's decisions, recorded via `POST /api/content-edits` (operator token, `surface:'api'`, `client:'claude_code'`) | `approved` with `panel_run_id` and reasons `pattern_is_real`, `nobody_has_said_it`, `timing`, `sells_the_practice`; `magic_rejected` for the router's `mind_the_gap` pick | $0 | **works.** `judge_calibration` gained 7 rows with `agreed` set for this run, the first since the view was built on 2026-09-09. The 3 `revise` verdicts stay null (see section 1). |
| 2. Draft | `POST .../draft` with direction built from Krish's four decisions (the direction is the session's wording of the options he chose, not his words) | 200 in 34s. 885 words, `state:'drafting'`, 3 of 3 sources on file cited, 6 labelled inferences, 5 open questions, one of which correctly says the $56B came from the seed and has no source on file | $0.061 (`cleo-draft`) | **works** after H3. The autoscore trigger did not fire: this row already had a `quality_score`, so that path is still untested live. |
| 3. Editor's read | read in session, before any engine check | Evidence discipline good. Voice: "not X, it's Y" four times, "Here's the..." twice, one meta-commentary line. Structure: opens on Amazon's stated reason, because the session's direction said "early", while the mandate says the money question leads. Evidence: calls Amazon's whole advertising line "sponsored listings". Close: ends on "the open question worth watching", not the verdict the mandate asks for. | $0 | to compare against what the engine's own checks catch |
| 4. Final pass | `POST .../final-pass` | Judged against the follow.the.money mandate (H4). Not an instant fail. Verdict: the argument is the best version of the channel, but the two numbers doing the heaviest lifting ($56B, the Perplexity filing date) have no source or date. Researched 2/5. | $0.073 (`cleo-final-pass`) | **works.** Missed the lead: the mandate says the money question leads, and the final pass did not say the draft led with the security reason. |
| 5. Draft judges | `POST .../judge {gate:'draft'}`, panel `e4d51476` | hook 8, clarity 8, personality 8, evidence_integrity 9, voice 7 (meta-commentary), channel_fit 7 (180 words of Amazon's position before the argument), prosecutor 7 (the "both things can be true" middle) | about $0.09 | **works, with two faults.** No judge flagged the four "Not X, Y" uses (H7). `evidence_integrity` gave 9 to the evidence the final pass called the biggest gap: one of the two is miscalibrated. |
| 6. Krish's verdict | questions put to him in session | **Revise it. The money leads. "Cut it everywhere"** (the "Not X, Y" move, which became rule R2). **Research, then revise**, plus his question on format (rule R3, proposed). | $0 | His answers did not reach the session: the question tool returned "[No preference]" for all four, and the session went on as if he had not answered, labelling its own defaults as team calls. He sent screenshots of his answers. Two differed from the defaults: the session had planned to allow one "Not X, Y", and had not planned sections. See section 4 on asking by plain message instead. |
| 7. Research | `POST .../dive-deeper`, four calls, run one at a time because each rewrites the whole `meta` | Amazon's advertising services: $68.635B in FY2025 (10-K filed Feb 6, 2026; sponsored ads, display and video; Sponsored Products not broken out; $56.2B was FY2024, so the seed's number was a year stale and mislabelled). Block began Sunday Sept 20, 2026; Amazon's warning text; spokesperson statements to CNET and Business Times. Meta declined to comment to CNBC (Sept 23); GeekWire reported Meta's position. Amazon's amended complaint against Perplexity, Sept 21, N.D. Cal., adds a contract claim under the Conditions of Use. Shopify: Tobi Lutke on X, Sept 21, Shop Pay agentic checkout for Muse across Shopify stores. | $0 metered (Perplexity is unmetered) | **works, one fault.** `dive-deeper` caps Perplexity at 1,200 tokens, so a three-part question came back cut off mid-sentence; ask one thing per call. |
| 8. Revise (v2) | `POST .../revise`, direction built from Krish's answers: four signature sections (R3 trial), the money leads, the $68.6B stated as what it is, attributed statements, zero "Not X, Y" | 1,008 words, four sections, $56B gone, verdict names the Conditions of Use case | about $0.02 | **mixed.** Structure and facts landed. About seven "Not X, Y" survived (F1), one invented attribution (F4), commentary about the piece crept back. |
| 9. Checks on v2 | final pass; draft judges, panel `b1c852d4` | Final pass: "close to ship-ready"; flagged that the idea's title states the hypothesis as fact. Voice check (H7) caught "Not X, Y" at 4, its first live catch. Prosecutor 7: FOLLOW THE MONEY reads as an explainer bolted to a news story. Voice 6: hedging. | about $0.16 | **works, with F4, F5, F8** |
| 10. Revise (v3), then line rewrites (v4) | targeted revise quoting the eight offending sentences; then eight in-place rewrites, chained | v3 fixed the invented line, the dates and the inference labels, and wrote the instruction into the body (F3); kept most named sentences (F1). In place: 6 of 8 clean, 1 broken splice, 2 meaning drifts (F2). | about $0.15 | **the engine could not finish R2 alone** |
| 11. Editor's pass (v5, v6) | seven line edits by the session, saved as a `manual_edit` that the ledger marks `observation_only` (H6) | Zero "Not X, Y" of any shape. Restored the verdict heading, removed the duplicate, "Sunday night" to "Sunday" (the hour is not on file), the Shopify timeline corrected after the final pass caught it (Muse checkout was reportedly live on Shopify from Sept 8; the Sept 21 post deepened it). 902 words. | $0 | the edits are the session's, listed here so Krish can see exactly what a person changed |
| 12a. Krish's calls on v6 | the six calls were put to him again | "I already answered your questions." He had: "Cut it everywhere" covers the voice block and the reverse forms (calls 4 and 5), and his format message asked for signature sections (call 3). The session re-asked what he had settled. The headline and the close were new; the session decided them itself and says so. | $0 | **session fault.** Recorded in section 4: before asking, check whether an earlier answer already covers it, read broadly. |
| 12. Checks on v5 | final pass (one 502, one retry); draft judges, panel `68a94a2f` | No kills; hook 8, personality 8, clarity 7, evidence_integrity 7, voice 7, channel_fit 7, prosecutor 7. Final pass "not ready": the stale $56B in the pitch fields (F7), the Shopify timeline (fixed in v6), the mechanism stated as fact rather than inference, and a close that leans on a pending ruling where the mandate wants a fixed constraint. | about $0.18 | **works, with F6, F7, F8.** v6 differs from v5 by the timeline fix only and was not re-judged. |
| 13. Close and pitch (v7, v8) | the session's calls: title "Same agent, opposite answers" (the split is fact; the old title stated the hypothesis as fact), thesis rewritten to match the piece (the stale $56B gone), close rewritten through the engine in place so the fixed constraint is the Conditions of Use plus the reader's renewal date | With the voice block edited (H8), the engine's close had one reverse-form hit where full revises had kept about seven. Three line edits by the session: that hit, an invented detail ("sitting quietly... before anyone thought to enforce it", Amazon was already suing Perplexity), and an assumption that every reader has an ad commitment. 861 words. | about $0.02 | **H8 works**: the voice block was the cause of F1 |
| 14. Checks on v8, before and after H9 and H10 | same text, twice | Before: final pass 502 (F6); `evidence_integrity` **kill 3** ("invents" the dispute), voice kill 3, `channel_fit` 7. After: final pass "close to shippable", standards 4/4/5/5/4, and it now recognises the retired "Not X, Y" pattern; `evidence_integrity` **pass 9**, `channel_fit` pass 8, voice 7, hook 8. | about $0.35 | **H9 and H10 verified live.** The final pass still found the $68.6B research "[trimmed]": with seven research entries the oldest still falls past 16,000 characters (F5, partly fixed). |
| 15. To review | two corrections from the final pass (Lütke's name; the piece closed twice, so the restated verdict is cut), `PATCH state:'review'` | 847 words, state `review`. Every ledger row the session wrote since H6 reads `actor claude_code`, `observation_only` (sequences 46 to 63). | $0 | **waiting on Krish's verdict**: approving is his, and it is the event `judge_calibration` learns from |

**A source conflict about Krish's voice, found at step 3.** The stored voice
block (`system_config.content_voice_block`) calls the "Not X, Y" clarifier
"Krish's most consistent sentence-level habit" and says to use it when it
fits; the corpus teaches it as a move. Krish's standing instructions to Claude
say no "it's not X, it's Y". The draft's four uses followed the engine's
teaching. Whether the move or its frequency is the fault is his call (section
4), and is not settled by the walk.

**The curation decisions, as Krish made them (2026-09-24):**

- Subchannel: **follow.the.money**, overruling the router (mind.the.gap 8,
  follow.the.money 7, contested). Written as the money chain: sponsored-listing
  budgets bypassed by an agent that completes checkout, closing on a verdict.
- Why it is worth writing: the pattern is real, nobody has said it, timing,
  and it sells the practice.
- The $56B ad motive: **labelled as the hypothesis**. Amazon's stated reason
  (security) is reported fairly; the money motive is argued as inference,
  backed by Amazon's own advertising figure.
- His note on the piece becomes proposed rule R1 (section 5).

**Decisions on the sharpened piece (Krish, 2026-09-25, relayed through the
ledger with `decided_by: 'Krish'`, sequences 64 to 66):**

- The Call: option A, "By 30 June 2027, Amazon opens an authorised route for
  shopping agents, and that route still shows them sponsored listings." His
  words: "I'm happy with A for piece 1's call." Confidence not yet set by him;
  the page offers 60% as a suggestion and prints nothing until he gives a number.
- The panel stamp: the drafted answer to the prosecutor is approved as written
  ("I approve your draft for decision 2."). It goes on the stamp and at the end
  of "What they say".
- The question-led opening: rejected, with the feedback that became proposed
  rule R4. Two new openings (money-led, recommended; scene-led) are with him.
- The four money-map states: in final form one diagram that moves as the
  reader scrolls on makeyourmindup.ai, a looping video on Substack, and the
  same animation in the Short (his question, answered yes).
- The name clash: the section "Follow the money" is now "Who gets paid" (in
  v10), and the engine's story shape is now "The Money Trail"
  (`apps/control-plane/api/_formats.ts`, seven slate rulings and two arc cards
  migrated, old name accepted on read). Krish, 2026-09-25: "rename to either or".
- v10 saved (`state: review`): opening B ("1B"), the stamp answer at the end of
  "What they say", the Call at 70% ("2 70%"), "Who gets paid". It reads at about
  grade 10.5 (Flesch-Kincaid), above the reading age of 12 he set the same day.

## Piece 2: mind.the.gap

`904658db-4df2-4537-a0ed-ebe93e081db7`. "Every AI lab now sells a menu instead
of a model, and the menu is the price list." Four model judges at 8; lowest
model judge `consequence` at 3. First live test of the missing mind.the.gap
corpus playbook.

Angle A, "the lab becomes the router" (Krish, 2026-09-25: "yes, I agree"),
shown as a forking timeline (proposed rule R5): what it used to be, what it is
now, where it could go, and three forks (the lab routes, the router routes, the
buyer routes), each with who wins, who loses and a signpost. The Call sits on
the first fork. Research checks and the draft wait on his go.

## Piece 3: under.the.hood

`5255dcd8-3772-420d-994c-6bf2ab5f06e3`. Salesforce's Koa
split. No judge at 8; lowest model judge `novelty` at 6.
