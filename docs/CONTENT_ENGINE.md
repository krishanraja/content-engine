# The content engine (`apps/control-plane`)

Status: Current
Owner: Krish Raja
Last verified: 2026-09-25 against `main` at `fd467e1`: every route file read,
crons and run ledger read back from the database, guards run locally.

Scope: the editorial half of this repository, everything under
`apps/control-plane/`. The Studio half is in `docs/STUDIO.md`. Why either
exists: `docs/NORTH_STAR.md`. Terms: `docs/GLOSSARY.md`. Current state and
open problems: `docs/STATE.md`.

## What it is

A Vercel serverless project (`content-engine`, production alias
`content-engine-flame-nu.vercel.app`) over the shared Supabase database. It
holds every route, cron and structural guard behind the Content tab in
Control Center: collecting ideas, judging and routing them, drafting and
rewriting pieces, cutting them for channels, handing approved pieces to the
Studio, and recording what Krish decided so the engine can learn from it.

It moved here from `krishanraja/control-center` in PR #42, by Krish's decision
recorded as ADR-019 (control-center, `docs/DECISIONS/019-content-engine-owns-the-control-plane.md`,
2026-09-08): "The routes, the crons and the structural guards move to
`content-engine/apps/control-plane`, deployed as its own Vercel project.
Control Center reaches them through rewrites." Control Center kept the desk:
the Content tab, the composer, the mobile deck, the Studio reviewer, and the
hooks that read the database directly.

It has no UI of its own and no local dev server. Its route files, and the
shared modules whose names start with `_`, live under `apps/control-plane/api/`.
The counts are left out because they went stale within days.

## How callers reach it

| Caller | How | Auth |
|---|---|---|
| Control Center (Krish in a browser) | `controlcenter.krishraja.com/api/...`, rewritten by control-center's `vercel.json` to this project, same path | the `cc_access` cookie (sha256 of `ACCESS_CODE`), so `ACCESS_CODE`, `APP_ORIGIN` and the CSRF secret must be byte-identical on both projects |
| Vercel cron | this project's own `vercel.json` crons | `Bearer CRON_SECRET` |
| An agent session with no browser (Claude Code, Codex) | straight to this project's URL | `Bearer ENGINE_OPERATOR_TOKEN` on the routes behind `guardEngine`, and on `GET /api/content-engine/health` |
| The Windows runner | `/api/video-studio/runner/*` via Control Center's origin | `Bearer VIDEO_STUDIO_RUNNER_TOKEN`, receipts HMAC-signed |
| The library sync on Krish's runner machine (`scripts/library-sync.ps1`) | `GET /api/library/pending` and `POST /api/library/written`, straight to this project's URL | `Bearer VIDEO_STUDIO_RUNNER_TOKEN`, the runner's own |
| The recordings upload on both runner machines (`scripts/recordings-upload.ps1`) | `POST /api/library/recordings/upload-url` and `/confirm`, straight to this project's URL | `Bearer VIDEO_STUDIO_RUNNER_TOKEN`, the runner's own |
| The Studio MCP gateway | `/api/video-studio/mcp` | `Bearer VIDEO_STUDIO_MCP_TOKEN` |
| The AEO engine (GitHub Actions) | `/api/aeo/ingest`, `/api/aeo/context`, `/api/aeo/meter` | `Bearer AEO_ENGINE_SECRET` |
| A Postgres trigger (autoscore) | `POST /api/content-ideas/:id/score` with exactly `{model:'haiku'}` | none, by a narrow exception that refuses anything else |

Not every path is rewritten by Control Center: `/api/judge/*`, `/api/learning/*`,
`/api/inspiration/*`, `/api/trends/*`, `/api/claims/*` and `/api/library/*` are
reachable only on this project's own URL.

### The guards (`api/_auth.ts`, `api/_videoStudioAuth.ts`, `api/_videoStudioMcpAuth.ts`)

| Guard | Admits | If its variable is unset |
|---|---|---|
| `guardEngine` | the cookie, or `Bearer ENGINE_OPERATOR_TOKEN` | refuses |
| `guardCronRoute` | GET: `Bearer CRON_SECRET` only. POST: the secret or the cookie | the POST arm lets everyone in when `ACCESS_CODE` is unset |
| `guard` | the cookie | lets everyone in when `ACCESS_CODE` is unset |
| `guardOperatorOrCron` | the cookie or `Bearer CRON_SECRET` | refuses |
| `guardSensitiveRead` | the cookie or `Bearer VIDEO_STUDIO_EXPORT_TOKEN`, 60 a minute; a route that opts in (health only) also takes `Bearer ENGINE_OPERATOR_TOKEN`, by the check `guardEngine` makes | refuses |
| `guardBearerExport(ENV)` | `Bearer $ENV`, 60 a minute | refuses |
| `preamble` (`api/_content.ts`) | legacy method-only helper; no handler may call it | no auth at all |
| Studio read and mutation | the cookie; a mutation also needs Origin equal to `APP_ORIGIN` and an HMAC CSRF header | 503 |

No API handler calls `preamble` after the 2026-10-03 route-gate fix. The final
thirteen callers moved to `guardEngine`: shifts, content decisions, weekly
briefs, creator settings and AEO settings. The auth test scans every handler so
a new `preamble(req, ...)` call fails the suite, and it invokes each of the
thirteen former openings with no credentials to prove it returns 401 before a
database read, model call or factory push. This code is not live until it is
merged and deployed. `discover-lens-radar` remains open when
`LENS_RADAR_SECRET` is unset, and the fail-open guards remain recorded in
`docs/STATE.md`.

## The pipeline, stage by stage

Models are named by constant (`api/_models.ts`): `SYNTHESIS_MODEL` and
`UTILITY_MODEL` are `claude-sonnet-5`, `JUDGE_MODEL` is `claude-haiku-4-5`,
`LADDER_MODEL` is `claude-opus-4-8`. The agent key in brackets is the
`unit_key` the call is metered under in `meter_daily`.

### 1. Ideation: collect and research

| Route | What it does | Model and external services |
|---|---|---|
| `POST /api/content-ideas` | capture: dedup, relevance gate for non-manual sources, enrich, embed, insert as `seeded` | Haiku relevance [`relevance-classifier`], Sonnet enrich [`cleo`], OpenAI embeddings |
| `POST /api/content-ideas/voice` | transcribe a spoken idea | OpenAI `gpt-4o-transcribe` |
| `POST /api/content-ideas/research-topic` | research a topic Krish names; inserts a `drafting` row with a live `lane_slot` | Perplexity `sonar-pro`, then Exa, then Brave; Sonnet [`cleo-research-topic`] |
| `/api/content-ideas/[id]/materials` | list, attach or remove `meta.materials` | none |
| `/api/feed/ingest` (cron) | two days of the CTRL corroborated-headlines pool through the beat gate and relevance classifier; every story to `trend_observations`, survivors to `content_ideas` as news that expires at the Monday purge | CTRL Supabase, Haiku [`feed-ingest`] |
| `/api/discover-lens-radar` (cron) | Exa search by theme and creator; writes candidates to `lens_seed_candidates`, never ideas | Exa |
| `/api/discover-creator-posts` (cron) | Apify LinkedIn scrape, extracts the transferable move, at most 3 ideas a run | Apify (charge cap $0.25), Sonnet [`creator-scout`] |
| `/api/discover-build-signals` (cron) | Krish's GitHub commits per repo-week become `build_signal` ideas | GitHub |
| `/api/inspiration/drive-scan` (cron) | reads screenshots and documents from a Drive folder with a vision model; upserts seeds | Google Drive, Sonnet [`inspiration_scan`] |
| `GET /api/content-seed-candidates` | the composer's seed rail | none |
| `/api/aeo/ingest`, `/api/aeo/context` | the AEO engine lands packets and reads context; recommendations become `aeo_signal` ideas | none |
| `/api/investigations/run` (cron), `anchor`, `[run_id]/draft-check`, `[run_id]/trace` | the weekly investigation: anchor, decompose, climb the why-ladder, run budgeted harnesses, gates G1 to G6; attaches an evidence manifest | Sonnet and Opus [`investigations`], Perplexity `sonar` |

### 2. Curation: judge, repair, route, rank

| Route | What it does | Model |
|---|---|---|
| `POST /api/content-ideas/[id]/judge` | puts one piece before the panel. Idea gate: 9 judges (novelty, evidence, consequence, reader, buyer, connection, fun, standing, prosecutor). Draft gate: 7 (hook, clarity, personality, evidence_integrity, voice, channel_fit, prosecutor), which read the subchannel's mandate and the sources on file. Free deterministic judges run first. The panel reports and never changes state | Haiku [`judge-<key>`] |
| `/api/judge/ladder` (manual) | expand the seed, judge, repair with research and re-judge, then route. Score is the lower median judge: 7 or more is `ready`, 5 or 6 `repairable`, below 5 `weak`. Nothing is buried. Sets `lane_slot` only when it is empty and the router's pick is uncontested | Sonnet [`ladder-expand`, `ladder-repair`], Haiku panel and [`ladder-router`] |
| `/api/judge/sweep` (cron, daily at 05:00 UTC) | runs the ladder over ideas left after the free 03:00 triage; optional batch mode at half price | as the ladder, plus the Anthropic Batches API |
| `/api/content-ideas/[id]/score` | the Five Standards gate (unique, researched, thoughtful, kind, helpful) | Sonnet, or Haiku on the autoscore path [`standards`] |
| `/api/content-opportunities/refresh` (cron) | the editorial radar. Two lenses only, `money_of_ai` and `built_with_ai` | Sonnet [`editorial-radar-*`] |
| `POST /api/content-ideas/[id]/editorial-route` | approves a radar lens into a child idea with `lane_slot` `money_of_ai` or `built_with_ai` | none |
| `/api/triage/sweep` (cron) | deterministic grader; buries idle agent-created rows in five tables and soft-drops content buried over 15 days | none |
| `/api/content-ideas/cluster` (cron) | embeddings backfill, then clustering at cosine 0.78 or more | Haiku [`cleo-cluster`] |
| `/api/content-ideas/archive-stale` (cron) | archives idle ideas | none |
| `/api/shifts/detect` (cron), `/api/shifts/[id]` | proposes shifts over a 21-day corpus through a deterministic gate; Krish's rulings on them | Sonnet [`shifts-*`] |
| `/api/signals/news` (cron) | news velocity for the pieces in play: what GDELT saw about each subject in two days and what Hacker News said, every headline to `trend_observations` (origin `gdelt` or `hn`, story key the piece's id, `gathered_not_selected`); a subject that doubles in a day turns the board's "News velocity" signal to warn (`api/_signals.ts`, docs/ENGINE_100X.md) | none, keyless |
| `/api/signals/odds` (cron) | the market's odds on every Call with a market pinned: reads Polymarket or Kalshi once a day and appends the reading to `meta.call_market.history` | none, keyless |
| `/api/content-ideas/[id]/call-market` | pin a prediction market (Polymarket slug or Kalshi ticker) to a piece's dated Call, read once to refuse a wrong one; GET reads it, `{clear: true}` unpins | none, keyless |
| `/api/calls` | public, read-only: every published piece's Call, our confidence, `not_due_yet` or `due`, Krish's verdict when he has made it, and the pinned market's odds; the scoreboard on makeyourmindup.ai reads it | none |
| `/api/arcs/surface` (cron) | composes, lints and scores arc cards; surfaces 7 | Sonnet [`arcs-*`] |
| `/api/content-decisions/[id]`, `likely-reasons` | resolves a weekly queue card; predicts reject reasons | Haiku [`content-decisions`] |

**When the judges cannot reach the model** (since 2026-09-28, walk log F28).
A panel on which every model judge failed with an error is a failed run
(`ModelUnavailableError`, `api/_modelProvider.ts`): no `panel_runs` or
`judge_verdicts` row is written for it, and the idea keeps its last real
reading. A judge that ran and declined still abstains and is written as
before. The ladder records on the idea only when to try again,
`meta.ladder_failure` (the provider's class and words, attempts, `retry_after`,
pinned to the idea's text): a usage limit waits for the reset the provider
named, a refused key or spent balance an hour, anything transient half an
hour doubling to a day, and every judge abstaining the same. Editing the idea
ends the wait. A refusal of every call (usage limit, credit, key) stops the
pass at that idea. The sweep then fails its tick with the provider's words,
and each later tick reads the recorded failure first and fails at once,
without a call, until the reset (or an hour, for a refusal with no reset)
has passed. `POST /api/content-ideas/:id/judge` answers such a panel with 503
`model_unavailable` and records nothing.

### 3. Drafting and iteration

| Route | What it does | Model |
|---|---|---|
| `POST /api/content-ideas/[id]/draft` | writes a 700 to 1000 word draft to the subchannel's mandate from everything curation left on the row (`api/_curation.ts`); refuses an unrouted idea (409 `no_subchannel`); moves `seeded` or `researching` to `drafting`; keeps the last 10 drafts. Self-checked before it is written (below) | Sonnet [`cleo-draft`; the self-check's retry `cleo-draft-retry`] |
| `POST /api/content-ideas/[id]/revise` | streams a rewrite preview (tone, length, zoom, feedback, humour; in place when given a selection). Reads the mandate. Never writes `body`; the caller saves an accepted rewrite. Self-checked before `done` (below) | Sonnet, or Opus for humour [`cleo-revise`; the self-check's retry `cleo-revise-retry`], prompt caching on |
| `POST /api/content-ideas/[id]/final-pass` | the ship-moment rubric: instant fails, autofixes, suggestions, a verify list; judged against the subchannel's mandate, or the investigation rubric when an evidence manifest is attached | Sonnet [`cleo-final-pass`] |
| `POST /api/content-ideas/[id]/fact-check` (`GET` reads the last result) | the fact gate (`api/_factGate.ts`). Lists every checkable claim, sweeps the body so no sentence with a number or a quotation escapes, then checks each claim twice: against the sources on file (the model must quote up to three passages verbatim that carry the claim's numbers, and code confirms them) and independently on the web (Perplexity `sonar-pro`, else Exa or Brave judged), whose verdict counts only when a second model finds its quoted evidence bears it out. One source is enough only when it is a verbatim excerpt (a material filed with `verbatim: true` and its URL); a claim found only in a summary needs the web to agree. Stores `meta.fact_check`, pinned to a hash of the exact body. A sentence an earlier run passed or set aside keeps that result while its words and the sources are unchanged (`meta.fact_ledger`, walk log F52); a failed sentence is always checked again, and any change to the sources starts the ledger again. `GET` reports how many exact sentences the next run can reuse. A paid rerun may send `max_fresh_sentences`; when the current body exceeds that hard scope, the route refuses before its first model or web call (`rerun_scope`, walk log F55) | Sonnet [`fact-gate-*`], Perplexity |
| `POST /api/content-ideas/[id]/dive-deeper` | suggests research questions or runs one scoped dive and files it as a material | Perplexity `sonar-pro`, Sonnet [`cleo-dive-deeper`] |
| `POST /api/content-ideas/[id]/challenge` | steelman, counter-case, sharper take | Perplexity, NewsAPI, Apify, Sonnet [`cleo-challenge`] |
| `POST /api/content-ideas/[id]/deepen` | comparison research. Accepts only `paid` and `built` | Sonnet [`cleo-deepen`] |
| `POST /api/content-ideas/[id]/chat` | conversation with Cleo on a piece | Sonnet, metered as `unattributed` |
| `POST /api/content-ideas/synthesize` | merges 2 to 25 cards into one `drafting` piece and marks the sources `absorbed` | Sonnet [`cleo-synthesize`] |
| `/api/briefs/assemble` (cron), `/api/briefs/[week]`, `revise`, `notes` | the weekly brief: one investigative opinion piece plus its decision cards | Sonnet [`briefs-*`] |

**What the writers read of the materials** (`materialsContext` in
`api/_content.ts`, since 2026-09-28, walk log F36). Filed sources come first,
each in full, up to 24,000 characters (the final pass's whole budget was
16,000 and the fact gate reads 120,000); one that does not fit is named as
not shown, and the next is still tried. Everything else follows at the
caller's budget (the drafter and the rewriter: 2,400 characters each, 9,000
in all), under a label saying whose it is: "BACKGROUND MATERIALS Krish
provided ... treat as primary source" only for what he put on the piece; the
engine's own dives, deepen and investigation research, and the shift dossier
as "THE ENGINE'S OWN SECONDARY RESEARCH", which a writer checks against the
filed sources before using; an agent session's other notes as research on
file. The ladder's repair reads the same three labels.

**How `revise` answers** (since 2026-09-28, walk log F31). The stream
opens only once Anthropic has accepted the call. A success is a stream of
`delta` events (`{ text }`) that ends with `done`
(`{ ok: true, revised, mode, value, edit_event_id, self_check }`); apply
`revised`, never the deltas. A failure is typed, `ModelErrorBody` in `api/_stream.ts`:

```
{ "ok": false, "error": "revise_failed",
  "code": "provider_usage_limit",   // provider_<class>, or empty_output
  "provider_class": "usage_limit",  // usage_limit, credit, auth, overload, rate_limit,
                                    // server, timeout, request, unknown; null for empty_output
  "message": "You have reached your specified API usage limits. ...",  // the provider's words
  "reset_at": "2026-10-01T00:00:00.000Z",  // when the provider named one, else null
  "retryable": false,
  "detail": "The rewrite did not run. Anthropic is over its usage limit ..." }
```

Known before the stream opens, it is that JSON with status 503 (the provider
cannot serve the engine now), 429 (rate limit) or 502 (a request it refused
as malformed), and `Retry-After` when there is a time to give. After the
stream opens, it is the stream's last event, `event: error` with the same
body, and no `done` follows. An answer with no text is `empty_output`, except
in place, where it deletes the passage (below). A
failed rewrite writes nothing to `meta.revisions` or the ledger. Read a
revise response as a success only when it ends with `done` and `ok: true`.

The brief's rewrite, `POST /api/briefs/:week/revise`, answers the same way
since 2026-09-28 (walk log F40): the stream opens once the provider has
accepted the call, a refusal before that is the same JSON body with 503, 429
or 502, and a failure after it is the stream's last event, `error`. Its
`done` carries `{ ok: true, preview }`, and a preview under 100 characters is
`empty_output`.

**The writers' self-check** (since 2026-09-30, walk log F42). Once the model
has answered, `draft` and `revise` (a whole text and a selection) run the
blocking checks from the approval checklist that a writer can meet on its own
(`api/_selfCheck.ts`, calling the checklist's own functions in
`api/_publishChecks.ts`): no "Not X, Y", no em dashes, no exclamation marks
outside quotes, British spelling, and a reading age of 13 at most. A passage
rewritten in place is checked without the reading age, which belongs to a
whole piece. When one fails, the writer gets one more call, metered on its
own key (`cleo-draft-retry`, `cleo-revise-retry`): the same system prompt,
the first request and answer, and a correction that quotes each sentence or
word, the house rule it breaks in the rule's own words, and "Rewrite only
these sentences; keep every other word." The answer with fewer failures is
returned, the first on a tie. The retry's text is never streamed as deltas.
A retry that cannot run (a provider failure, or under 20 seconds left of the
request) keeps the first answer with `retried: false` and a note; one that
comes back empty, unreadable or cut short (under 70% of the first answer's
length, for a whole text) keeps it with `retried: true` and a note. Neither
fails the request. Both routes may run for 300 seconds.

Every answer says what it still breaks, as a field of the draft's JSON (and
of its 409 `changed_during_draft`) and of revise's `done`:

```
"self_check": {
  "passed": false,
  "remaining": [                        // what the returned text still breaks
    { "rule": "R2", "found": "Those words were about Perplexity's robot, not Muse." },
    { "rule": "BRITISH_SPELLING", "found": "color", "use": "colour" },
    { "rule": "R7", "found": "Reads at about age 13.5. Above 13 cannot be approved: ..." }
  ],
  "retried": true,                      // a second call ran and answered
  "note": "The second try broke as many rules as the first, so this is the first answer.",
  "confidence_restored": true           // Krish's confidence had to be put back (below)
}                                       // note: only when a retry was wanted and the first answer kept
```

**The writer never sets Krish's confidence** (since 2026-09-30, walk log
F43). How sure we are is his judgement (his ruling, 2026-09-26: "I'd rather
take a clearer stance than sit on the fence all the time and say 60%", and
he sets the number). After the model and any retry, in code
(`guardConfidence`, `api/_selfCheck.ts`): a first draft says
`How sure we are: [Krish to set]`, whatever the model wrote; a rewrite keeps
the source text's confidence exactly, label and number ("How sure we are:
70%." stays that, "Confidence: 70%." stays that, and the placeholder stays
the placeholder); a rewrite of a text with no confidence gets the placeholder
in place of any number the model wrote. A confidence the model dropped is put
back at the end of the call (a paragraph of its own under a heading, the last
sentence of a bold-label paragraph); with no call at all there is nowhere to
put it, and CALL says so. It is found by the shared call reader
(`labelledConfidences`, `callSectionOf`) as the fact gate finds it: "How sure
we are:" anywhere, "Confidence:" inside the call only, so a labelled number
elsewhere ("Consumer confidence: 62% in August") is left as written.
`self_check.confidence_restored` is true whenever it changed the text.

**A rewrite in place** (since 2026-09-30, walk log F44). Given a `selection`,
revise hands the model the whole draft and the passage, then puts the answer
back where the passage was (`passageReplacement` and `spliceSelection`,
`api/_selection.ts`). Whatever the answer repeats of the draft just before
the passage (from a sentence start) or just after it (to a sentence end) is
taken off first, so an answer that echoes its context cannot repeat or lose a
neighbouring sentence. An empty answer deletes the passage and leaves one
space, or the paragraph break that was there; the model is told to return
nothing to delete. `done.revised` is the whole draft with the passage
replaced, and the self-check reads only the new passage. A heading sent back
without its `## ` still loses it (F2).

`rule` is the checklist's id (`R2`, `NO_EM_DASH`, `NO_EXCLAMATION`,
`BRITISH_SPELLING`, `R7`). The brief's rewrite, `briefs/[week]/revise`, is
not self-checked: it has its own prompt and returns the whole brief. It is
behind `guardEngine`, so only Control Center or an operator session can start
that paid call.

**The fact gate, in practice.** A second model reads every sentence the
claim lister did not cover (twelve at a time, with its section heading), and
a sentence is set aside as a joke, scenario, guess or the piece's own
prediction only when both readings agree; a sentence with a number is never
set aside unless it reads as a forecast. Sources are strongest filed word for
word: `apps/control-plane/scripts/file-verbatim-source.ts` files a page's own
words (title, dates, matching passages) with its URL, link text as plain words
without the markdown link syntax (walk log F34). The word-for-word
comparison reads markdown link syntax as the words a reader sees
("[2025 filing](https://...)" is "2025 filing"), and a claim's numbers must be
in those words, never only in a link's address (walk log F33). A research
dive is read once, under the names it is stored with (`query`, `findings`,
`citations`), and skipped when dive-deeper already filed its findings as a
material. Krish runs a check from
the composer's "Check the facts" strip in Control Center. Piece 2 took ten
runs to pass, and the fixes each run forced are in the walk log (H12 to H14).

**When the fact gate cannot reach the model** (since 2026-09-28, walk log
F39). The first model call of a run that gets no answer (a usage limit, a
spent balance, a refused key, or an overload, timeout or outage that outlasted
the retries) ends the run. No new claim or call starts, a Perplexity call
queued behind it included; the checks already running finish; nothing is
written, so the piece keeps its last real result and `GET /fact-check` still
shows it. The answer is revise's typed body (`ModelErrorBody`, "How `revise`
answers" above) with status 503, 429 (rate limit) or 502 (a request refused as
malformed), and `Retry-After` when there is a time to give:

```
{ "ok": false, "error": "model_unavailable",
  "code": "provider_usage_limit", "provider_class": "usage_limit",
  "message": "You have reached your specified API usage limits. ...",
  "reset_at": "2026-10-01T00:00:00.000Z", "retryable": false,
  "detail": "The fact check stopped before it had checked every claim, so nothing was recorded and the piece keeps its last result. Anthropic is over its usage limit ..." }
```

The failure is kept where health reads it. A claim that was checked keeps its
verdict exactly as before, and a failure of the web checker (Perplexity, Exa,
Brave) still leaves a claim unclear, which blocks. A run answered this way is
no verdict on the piece: run it again once health says the provider is usable.

**The fact gate.** A piece on a live subchannel cannot reach `review`,
`approved` or `published` (through `PATCH /api/content-ideas` or `save-draft`)
until a fact check of its exact current body has passed: every claim verified,
an independent checker connected, and the body unchanged since the check apart
from the dashes `save-draft` swaps for commas. Anything else is a 409
`fact_gate` with a plain reason. Relaying Krish's decision does not skip it.
Krish asked for it on 2026-09-25, after the engine's first draft of a piece
rescaled Cisco's $900 million a year to "close to a million dollars".

Two things may change without a new check: the dashes, and the number of
Krish's confidence in the call (his ruling, 2026-09-26: a confidence no longer
forces a fact re-check). Since 2026-09-28 (walk log F41) the confidence is
found by the same reader CALL and the Studio use
(`packages/contracts/src/call.ts`), under either label: a line of its own,
"How sure we are: 75%.", anywhere in the piece, as before, and any number
after "How sure we are:" or "Confidence:" inside the call, so piece 1's
"... sponsored listings. Confidence: 70%." can be re-set too. Only the number
is exempt: the label, the words after it, the call's statement and date, and
a labelled number outside the call are checked like any other text. A
sentence that is only the confidence is never a claim to check.

**Krish's house rules** (`api/_houseRules.ts`). Every ruling Krish has given
in words is one record: the instruction, his exact words, the date, live or
on trial, and the stages that enforce it. Writers read them through
`VOICE_GUARDRAILS` (the joke pass included), the drafter and rewriter add the
rules scoped to their subchannel, both judge gates put the rules for their
gate in every judge's context, and the final pass builds its absolutes from
them. House rules win over a mandate where they disagree, so every piece
ends with a dated prediction. They also require every sentence to have one
clear reading, and ask unfamiliar mechanisms to use a factual historical
parallel, familiar analogy or clearly signposted comic exaggeration when that
makes the idea easier to grasp. Every visual must make one critical point
land faster than the words, built from the piece's checked evidence, and the
video script and channel cut planners read that rule for every shot and visual
suggestion. Software that acts for a person is called an AI agent, never a
robot, and a follow.the.money piece explains what each company is paid for,
why it moved and who could get stung (on trial). A video's YouTube title and
description name who is involved, leave a question the video answers, stay
true to the piece and end with the line to makeyourmindup.ai, and the title
and subtitle the piece goes out under on Substack keep the same rules and fit
what a phone shows (`YOUTUBE_PACKAGE`); `api/_packaging.ts` checks what a
machine can of it.
`tests/control-plane/house-rules.test.ts` fails when a live rule reaches no
stage.

**Before approval** (`api/_publishChecks.ts`). `approved` and `published`
also need the checks a machine can make: the fact gate, no "Not X, Y", no em
dashes, no exclamation marks outside quotes, British spelling outside quotes
and names, a reading age of 13 at most (12 to 13 warns), and a prediction with
a date and a percentage. The prediction is read by the same reader the
Studio uses to put the call on a Short (`packages/contracts/src/call.ts`), so
a piece passes only with a call a Short can show word for word: one dated
paragraph, a real date, and one labelled whole percentage.
`CLEAR_STANCE`, a warning, reads the confidence written as "How sure we are:
75%" or "Confidence: 70%", and is green only on a number it has read, at 70%
or more (walk log F35). Anything else is a 409 `publish_gate` naming what is
left. `GET /fact-check` returns the whole
checklist, whether the piece is `ready`, and its receipts.

**Receipts** (`api/_receipts.ts`). For every claim that passed, the source's
own words the gate found it in, with the page: the proof a Short, carousel or
web edition shows on screen. Only verbatim passages from sources on file;
nothing in a receipt is written by a model.

### 4. Channel selection and per-channel copy

| Route | What it does |
|---|---|
| `POST /api/content-ideas/[id]/channel-cut` | one channel's cut (substack, linkedin, youtube, instagram, podcast, signal_noise) into `transformed_outputs[channel]`; flags any number missing from the source [`cleo-channel-cut`] |
| `POST /api/content-ideas/[id]/package` | the YouTube title, two backup titles and the description for the piece's video, and the title and subtitle the piece goes out under on Substack, into `transformed_outputs.youtube_package` with what still breaks a rule; takes optional `thumbnail_text`, `video_seconds` and `hint`; publishes nothing (below) [`cleo-package`; its retry `cleo-package-retry`] |
| `POST /api/content-ideas/[id]/video-script` | a 15 second to 20 minute script into `transformed_outputs` [`video`] |
| `POST /api/content-ideas/[id]/save-draft` | sends the draft to the n8n content factory, which makes a Google Doc, and moves the piece to `review`. Its channel map knows `paid`, `built` and older channels only |
| `POST /api/briefs/[week]/push` | pushes an approved brief to the factory, once per channel |
| `POST /api/content-ideas/[id]/schedule` | sets `scheduled_for` |

**The YouTube title and description** (since 2026-10-05, walk log F59).
Krish asked in chat "whats a viral video title for this" about piece 1's
video, then for it to become "a part of the durable engine". The script's
`title` (`api/_video.ts`) is only a working title, so `package` writes what he
pastes into YouTube Studio. The rules are data in `api/_packaging.ts`, and his
ruling is `YOUTUBE_PACKAGE` in the house rules. The title names the people or
companies in the story, puts them in a plain conflict or change, leaves one
question the video answers, adds to the thumbnail text instead of repeating
it, and fits in 60 characters (YouTube stops at 100). The description opens
with a hook that fits in about 150 characters, then two or three plain
sentences, then the piece's dated prediction as the piece gives it, then
"Read the full piece free at makeyourmindup.ai", then at most three
hashtags, or none.

**The Substack title and subtitle** (since 2026-10-05, walk log F65). The
same day Krish published article 1 on Substack and sent a screenshot of his
publication's feed on his phone. The title, 122 characters, was cut off at
about 110 ("who actuall"), and the subtitle after its first line. He said:
"Also bear in mind what happens to your artwork when I'm looking at the
article in Substack once it's posted." So the same call writes the title and
subtitle the piece goes out under on Substack, under the same rules for
truth, names, a plain conflict, numbers, hype and capitals. The Substack
title may differ from the YouTube title but never contradicts it. It aims for
60 characters, because Substack also sends it as the email's subject line and
a phone cuts that short, and is never more than 100, because the feed cuts a
title off at about 110. The subtitle's first sentence makes sense on its own
and fits in about 60 characters, because the feed shows about one line of a
subtitle and an email shows its start as the preview text. The whole subtitle
aims for 150. Krish's own subtitle shows how: its first sentence, "Amazon
blocked Meta's new AI shopping agent.", is 44 characters and gives the news
in the one line the feed shows. To paste them, put them in the page facts of
`scripts/pages` as `substack_title` and `substack_subtitle`: the Copy title
and Copy subtitle buttons of its Substack copy read those fields.

The route reads the piece (409 `no_draft` without one, as channel-cut), the
voice block, the house rules and the subchannel's mandate, and asks the
utility model once for all of it. `lintPackage` then checks what a machine
can: the length, em dashes, "Not X, Y", exclamation marks, American
spelling, the banned phrases, "robot" or "bot" for an AI agent, words in
capitals longer than four letters, hype ("shocking", "breaking", "just" as
urgency), a title that repeats the thumbnail, any number the piece and its
sources do not state, the line to makeyourmindup.ai, and the hashtags.
`lintSubstack` checks the Substack title and subtitle the same way, without
YouTube's own limits: the title's length and the names in it, the length of
the subtitle's first sentence and of the whole subtitle, and the same house
rules, numbers and hype in both. A `fail` sends the writer back once with
each problem in plain words, and the answer that fails less is kept, the
first on a tie; it never asks a third time. A Substack title over 100 fails,
and so does an answer with no Substack title or subtitle: its YouTube fields
are kept, and the one retry asks for what is missing. A `warn` (a title over
60 characters, a title that names nobody, a description without the piece's
prediction, a subtitle whose first sentence runs past about 60 characters or
that runs past 150 in all) is for the person reading. A conflict, an open
question, being true beyond the numbers, a Substack title that tells the
same story as the YouTube one, and a first sentence that makes sense alone
are rules only the writer and Krish can check, and `PACKAGING_RULES` marks
them so. A backup title is checked without the thumbnail, because one is for
when the thumbnail changes. The Substack title and subtitle are kept in
`youtube_package` beside the YouTube fields, and the key keeps its name, so
nothing that reads it breaks. The answer:

```
{ "ok": true, "outputs": ["youtube", "youtube_package"],
  "package": {
    "title": "Amazon blocked Meta's AI shopping agent. Shopify let it in.",
    "alternates": [{ "title": "...", "why": "...", "lint": { "passed": true, "problems": [] } }, ...],
    "description": "...\n\nRead the full piece free at makeyourmindup.ai",
    "substack_title": "...", "substack_subtitle": "...",
    "why": "...", "thumbnail_text": "...", "video_seconds": 152, "hint": null,
    "lint": { "passed": true, "problems": [
      { "rule": "TITLE_LENGTH", "field": "title", "level": "warn",
        "detail": "The title is 64 characters. A phone cuts it off after about 60, so aim for 60 or fewer." },
      { "rule": "SUBTITLE_FIRST_LINE", "field": "substack_subtitle", "level": "warn",
        "detail": "The subtitle's first sentence is 72 characters. Substack's feed on a phone shows about 60, so it would be cut off before it says what happened." } ] },
    "retried": true, "note": null, "generated_at": "...", "model": "..." } }
```

A failed call is revise's typed body with `error: 'package_failed'` ("How
`revise` answers"), and an answer with no YouTube title or description is
`empty_output`; neither writes anything. The write is guarded on
`updated_at`: a change made during the call wins, and the answer is a 409
`changed_during_package` that carries the package so nothing is lost. Nothing
here publishes, and which titles go up is Krish's choice.

### 5. Handoff to the Studio

`POST /api/content-ideas/[id]/production-brief` needs state `approved`, a
matching approval hash and `confirm_hard_gates: true`, and writes a
`ProductionBriefV1` with status `ready_for_studio`. It accepts only
`lane_slot` `money_of_ai` or `built_with_ai` (`api/_productionBrief.ts`), so a
piece routed to a live subchannel fails with `canonical_series_required`
(`docs/STUDIO.md`, "Series and subchannels"). The runner then leases and
completes briefs through `/api/video-studio/runner/production-brief-claim` and
`-complete`. The other `/api/video-studio/*` routes serve the runner protocol
(claim, heartbeat, complete, project, preview upload and retention, credential
probe), Krish's review decisions, command queueing and recovery, learning
proposals, and the `mindmake-studio` MCP gateway. None of them calls a model.

### 6. Publishing

Nothing here publishes. `PATCH /api/content-ideas` with `state: 'published'`
records that Krish published a piece (and a ship); it does not post anything.

### 7. Learning

| Route | What it does |
|---|---|
| `POST /api/content-edits` | appends one event to the edit ledger, `content_edit_events` (admission rules in `api/_editEvents.ts`) |
| `GET /api/content-ideas?id=<uuid>` | one piece as it stands, `{ ok: true, piece: { id, state, lane_slot, idea, thesis, body, updated_at } }`; 400 without a uuid, 404 when there is no such row; the cookie or the operator bearer, like the writes. Records nothing |
| `PATCH /api/content-ideas` | the single choke point for body edits and state moves; writes `manual_edit`, `approved`, `binned` and `published` events |
| `/api/learning/compile` (cron, Sundays) | the weekly compiler. Proposes, never changes config: presets he never keeps, judges that never change an outcome, hand rewrites after an accepted machine edit. Reads only `actor = 'Krish'` rows that are not `observation_only` |
| `judge_calibration` (a view) | joins each judge's verdict to Krish's decision on the same panel run (`panel_run_id`) |
| `/api/trends/entities`, `/api/trends/metrics`, `/api/claims/resolve`, `/api/claims/rule` | trend tagging and weekly snapshots; claims coming due, and Krish's ruling on each |

**Whose event it is.** A request on the operator bearer acts as itself: its
rows carry `surface 'api'`, its agent client, `actor = <client>` and
`confirmation_state 'observation_only'`, unless the body says
`decided_by: 'Krish'` to relay a decision he made in words. An operator cannot
approve, drop or publish on its own say (403 `a_decision_needs_krish`).
`PATCH` with `edit_source: 'magic'` records no `manual_edit`, because the
accept is recorded by whoever accepted it.

### 8. Operations

| Route | What it does |
|---|---|
| `GET /api/content-engine/health` | commit, auth configured, missing variables, each job's last run, runner state, and `model_provider`: whether Anthropic is usable, its last failure (class, status, the provider's words, agent, time), the reset time it gave, when the judge sweep will try again, and `says`, a plain sentence that begins "The engine cannot write or check anything" when every call is being refused. Readable on the operator bearer |
| `GET /api/content-engine/ping` | commit and a ready flag, no auth |
| `/api/content-engine/runs/replay` | re-runs a registered job by calling its GET with `CRON_SECRET`; refuses `manual_only` jobs |
| `/api/purge/run` (cron, Mondays), `/api/purge/restore` | exports doomed rows to the `content-engine-archive` bucket and `trend_observations`, then hard-deletes expired news rows; deletes nothing if either copy fails. The engine's only hard delete |
| `POST /api/aeo/meter` | prices the AEO engine's token use into `meter_daily` |

Every scheduled route is wrapped in `withContentRun` (`api/_runs.ts`), which
writes one `content_engine_runs` row per run, and a redacted failure artifact
when it fails.

### 9. The asset library (`api/library/`)

Krish, 2026-10-06: "make sure the brand kit is always updated here [the
library's Drive folder]", then "I want every single asset in there, permanent
and for individual posts, categorized properly, clear what to use them for,
and every new post gets its own new folder with all assets including the
article HTML I can copy paste, video scripts, etc etc". The pieces and their
artwork are made in cloud sessions, which cannot write into Drive, so a
session sends each file here and his always-on Windows machine writes it into
the makeyourmindup folder on Drive. The architecture doc's rule 0a.5 says
agents never write into his Drive; this is his explicit instruction for that
one folder, carried out by his own machine, and it covers that folder only.
The tools are `scripts/post-pack/` (its README has the folder layout) and
`scripts/library-sync.ps1`.

The pattern is the Studio's preview upload: a private bucket
(`content-library`, 500 MiB a file, only the types a post, the brand kit and
the channel art use), signed URLs so the bytes never pass through a function,
the bucket's settings checked on every request, and the Studio's error shape
(`{ ok: false, error: { code } }`). Every path is checked against one rule
(`api/library/_library.ts`, tested with `scripts/post-pack/library.py` against
`config/library-paths.cases.json`): relative, forward slashes, Windows-safe,
and inside `1 Brand kit (permanent)/`, `2 Channel art (permanent)/` or one
post's folder, `3 Posts/YYYY-MM-DD <Day> <subchannel> - <Subject>/`, in its
four sections or as its `READ ME.txt`.

| Route | Who | What it does |
|---|---|---|
| `POST /api/library/upload-url` | the engine key (or the cookie) | `{ path, sha256, md5, bytes, purpose, client? }`. Reserves the file and returns a signed PUT, or `already_there` when the path's newest version has these bytes, or `upload: null` when the bytes are stored already (sent for another path). Sending an older version again makes it the newest. A refused path comes back 400 `invalid_library_path` with the reason; over the cap, 413 |
| `POST /api/library/confirm` | the engine key (or the cookie) | `{ path, sha256 }`. Checks the stored object's size, type and (where Storage reports a plain one) MD5, then marks the file ready. 409 `library_object_missing` or `library_object_conflict` otherwise |
| `GET /api/library/pending?machine=<id>&limit=<1..100>` | the runner bearer | For each path, the newest ready version this machine has not written, with `previous_sha256` (what it last wrote there) and a download URL that lasts 30 minutes. A row that breaks the path rule is held back and counted in `skipped` |
| `POST /api/library/written` | the runner bearer | `{ schema_version: 1, machine, items: [{ path, sha256, written_as? }] }`. Records what the machine wrote and under what name (`written_as`, in the same folder, when it kept a file Krish changed and put the new one beside it) |

The machine is identified as the runner routes identify a runner: a hash of
the runner bearer and the id it sends. `guardVideoStudioRunner` asks for a
JSON content type only on a request with a body, so the sync's GET needs none.

#### Recordings: from the Video Engine Inbox to a cloud session

Krish, 2026-10-06, after a session told him it could not reach his file:
"figure out how to never make that error again", then "just use whichever
machine is online at the time? the runner exists on both". The Drive
connector caps a download at 10 MB and a recording runs 100 to 500 MB. So
`scripts/recordings-upload.ps1`, a scheduled task on both runner machines,
reads the Inbox (never writes there) and sends every finished recording to the
same bucket under `recordings/`, and `scripts/post-pack/recording.py` fetches
it in any session. No table: each recording is its bytes
(`recordings/<sha256>.<ext>`) and a small manifest beside them
(`recordings/<sha256>.json`: its names, size, sha256, MD5 and when it
arrived). The library's own index never sees them, so nothing reaches Drive.
Two machines sending the same recording end with one object: the key is the
sha256, the signed upload never overwrites, and the second confirm finds the
first one's bytes. `api/library/_recordings.ts` holds the rule.

| Route | Who | What it does |
|---|---|---|
| `POST /api/library/recordings/upload-url` | the runner bearer | `{ name, sha256, md5?, bytes }`. `already_there` when these bytes are listed under this name; `upload: null` when they are stored (under another name, or a confirm did not finish); otherwise a signed PUT. A name with a folder, an unsafe character or a type that is no recording is 400 `invalid_recording_name` with the reason; over 500 MiB, 413; an `.mkv` before its migration, 415 `recording_type_not_enabled` |
| `POST /api/library/recordings/confirm` | the runner bearer | The same body. Checks the stored object's size, type and (where both sides have one) MD5, then writes the manifest, adding the name. 409 `recording_object_missing` or `recording_object_conflict` otherwise |
| `GET /api/library/recordings?limit=<1..200>` | the engine key (or the cookie) | The recordings, the newest first: `name`, `names`, `bytes`, `sha256`, `content_type`, `uploaded_at` and a download URL that lasts an hour. A manifest that cannot be read is counted in `skipped` |

mp4, mov, webm, m4a, wav and mp3 are in the bucket from the library's
migration. Matroska (`.mkv`) needs `20261006180000_content_library_recordings.sql`,
which adds `video/x-matroska` to the bucket; the engine accepts the bucket
with or without it, so it can be applied before or after the deploy.

## Crons (`apps/control-plane/vercel.json`, all UTC)

All 20 have run-ledger rows in the last seven days (read back 2026-09-25).

| Schedule | Job | Route |
|---|---|---|
| daily 05:00 | `judge_sweep` | `/api/judge/sweep` |
| every 2 h | `inspiration_scan` | `/api/inspiration/drive-scan` |
| daily 02:00 | `trend_entities` | `/api/trends/entities` |
| daily 03:00 | `triage_sweep` | `/api/triage/sweep` |
| daily 04:00 | `content_cluster` | `/api/content-ideas/cluster` |
| daily 06:30 | `runner_watch` | `/api/video-studio/runner/watch` |
| daily 07:00 | `claims_resolve` | `/api/claims/resolve` |
| daily 10:00 | `archive_stale` | `/api/content-ideas/archive-stale` |
| daily 11:30 | `feed_ingest` | `/api/feed/ingest` |
| daily 12:00 | `editorial_radar` | `/api/content-opportunities/refresh` |
| Mon 09:00 | `lens_radar` | `/api/discover-lens-radar` |
| Mon 14:00 | `purge` | `/api/purge/run` |
| Tue 08:00 | `creator_posts` | `/api/discover-creator-posts` |
| Thu 21:00 | `investigations` | `/api/investigations/run` |
| Fri 17:30 | `shifts_detect` | `/api/shifts/detect` |
| daily 06:30 | `signals_news` | `/api/signals/news` |
| daily 06:45 | `signals_odds` | `/api/signals/odds` |
| Fri 17:50 | `arcs_surface` | `/api/arcs/surface` |
| Fri 18:00 | `briefs_assemble` | `/api/briefs/assemble` |
| Sat 05:00 | `build_signals` | `/api/discover-build-signals` |
| Sat 06:00 | `trend_metrics` | `/api/trends/metrics` |
| Sun 16:00 | `learning_compile` | `/api/learning/compile` |

The replay registry (`api/content-engine/_jobs.ts`) has 20 entries but not
`judge_sweep` or `judge_ladder`, which is why `check-run-recovery` fails. The
dashboard's copy of the schedule is `apps/control-plane/lib/contentEngineSchedule.ts`,
checked against `vercel.json` by `check-content-engine-schedule`.

## Models and spend

- Every Anthropic call is metered into `meter_daily` through the RPC
  `meter_add` (`api/_meter.ts`): one row per agent key per day, with cache
  reads and writes and the uncached price kept separately. Batch calls are
  priced at half. Prices live in one table, `api/_prices.ts`.
- A failed call is metered too (since 2026-09-28, walk log F29): one run and
  one failure on its agent key and day, and no cost unless the provider
  reported usage before it failed. Its class (usage limit, credit, key,
  overload, rate limit, server, timeout, bad request), the provider's words
  and any reset time it gave are kept in `system_config` under
  `content_engine_anthropic_failure`, and the first success after it under
  `content_engine_anthropic_ok_at` (`api/_modelProvider.ts`). Control
  Center's own breaker, `anthropic_unavailable_until`, is a different key on
  purpose: the two projects may run on different Anthropic keys.
- Not metered by this code: OpenAI, and Perplexity, Exa, Brave and NewsAPI
  outside investigations.
- There is no global dollar cap in code. Limits are per run: the investigation
  budget (10 model calls, 8 searches, 24 fetches), Apify's $0.25 charge cap,
  the ladder's 10 ideas by default and 60 at most, the sweep's 80 and 200,
  and small insert governors on every collector.

**Waiting: the prompt caching pass.** Krish, 2026-09-25: "Once this engine is
built and the machinery is in place, run a prompt caching pass over the
system. Only once the pieces are capable of being produced with minimal fix
passes." Do not start it early.

- *When it starts.* Three pieces in a row, one per subchannel, reach a green
  approval checklist with: the fact gate passing within two runs, at most one
  rewrite round after the first draft, and no text edited by hand by an agent
  session. The baseline is piece 2: ten fact-gate runs and several agent
  rewrites.
- *Why it waits.* A cache only pays while the front of a prompt stays the
  same, and the prompts are still moving: house rules entered every stage on
  2026-09-25, mandates and the prediction are still settling. Cache
  boundaries drawn now would be redrawn with each change.
- *How to run it.* Measure before changing anything. On 2026-09-24 a caching
  change to the judge panel produced zero cache reads over 153 calls (the
  prompt sat under the model's minimum cacheable length) and stopped four in
  five judges returning a verdict; it was reverted (`api/_judges/panel.ts`).
  List every model call and its spend from `meter_daily`, put the parts that
  repeat first (voice block, corpus, house rules, mandate, a piece's sources),
  and keep a change only when a live call shows a non-zero cache read
  (`readUsage` in `api/_prices.ts`) and the stage's output is unchanged on a
  real piece. The likeliest savings: the judge panel (nine judges read the
  same context per idea) and the fact gate (every claim's check reads the same
  sources).

## Where the data lives

One Supabase database is shared by this engine, Control Center, the Studio
projections and the rest of mind/make OS. `supabase/migrations/ORIGIN.md`
says the schema history up to 2026-09-08 stays in control-center and new DDL
lives here. In practice several tables used after that date have no migration
file here (`venture_formats.mandate`, `format_aliases`, the trend and claims
tables); they were likely applied directly.

The tables this engine lives on:

- **Ideas and pieces:** `content_ideas` (one row per idea or piece; its
  `meta` carries the ladder verdict, research, materials, drafts, revisions,
  final pass and Krish's notes; `transformed_outputs` carries channel cuts and
  production briefs).
- **Publication shape:** `venture_formats` (subchannels and their mandates;
  the authority), `format_aliases` (retired names).
- **Judging:** `panel_runs`, `judge_verdicts`, `judge_sweeps`,
  `judge_sweep_cache`, and the view `judge_calibration`.
- **Learning:** `content_edit_events` (append-only by trigger),
  `composer_sessions`, `mindmake_studio_learning_proposals`.
- **The weekly desk:** `weekly_briefs`, `content_decisions`, `shifts`,
  `shift_evidence`, `shift_beats`, `arc_cards`, `content_themes`.
- **Supply:** `trend_observations`, `lens_seed_candidates`, `content_creators`,
  `creator_moves`, `investigations` and its child tables.
- **The asset library:** `content_library_files` (one row per version of a
  file: its path in the library, sha256, size, what it is for, who sent it and
  when, and when and which machine wrote it into Drive) and the private bucket
  `content-library`, from
  `supabase/migrations/20261006120000_content_library.sql`.
- **Operations:** `content_engine_runs`, `content_engine_run_artifacts`,
  `meter_daily`, `system_config` (the voice block `content_voice_block` and the
  channel corpus `content_corpus`, both read live by every writer).

## Environment variables (names only)

Set on the Vercel project `content-engine`; `apps/control-plane/.env.example`
lists them. Groups: auth shared with Control Center (`ACCESS_CODE`,
`APP_ORIGIN`, `VIDEO_STUDIO_CSRF_SECRET`, `ENGINE_OPERATOR_TOKEN`,
`CRON_SECRET`, `LENS_RADAR_SECRET`); database (`SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `CTRL_SUPABASE_URL`, `CTRL_SUPABASE_SERVICE_KEY`);
models and research (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
`PERPLEXITY_API_KEY`, `EXA_API_KEY`, `BRAVE_API_KEY`, `NEWSAPI_KEY`); sources
(`APIFY_TOKEN` and actor names, `GITHUB_TOKEN`, `GITHUB_REPOS`, the Google
service account, `GOOGLE_DRIVE_FOLDER_ID`); the factory
(`N8N_CONTENT_FACTORY_WEBHOOK_URL`); the Studio (`VIDEO_STUDIO_RUNNER_TOKEN`,
`VIDEO_STUDIO_RUNNER_SIGNING_KEY`, `VIDEO_STUDIO_MCP_TOKEN`,
`VIDEO_STUDIO_EXPORT_TOKEN`, `VIDEO_STUDIO_PREVIEW_BUCKET`); AEO (`AEO_REPO`,
`AEO_DISPATCH_TOKEN`, and `AEO_ENGINE_SECRET`, which is missing from
`.env.example`). Never write a value into this repository.

## Checks

- `npm run check:control-plane` runs 28 guards in `apps/control-plane/scripts/`
  (supply, judging, content lifecycle, operations, security and the Studio
  bridge); it is part of `npm run verify` and skipped on Windows. All pass
  since walk log H16.
- `npm run typecheck:control-plane` typechecks the app and its scripts.
- `tests/control-plane/` holds 56 vitest files, run by the root `npm test`.
  A test that imports engine code belongs here: the root typecheck covers
  only top-level `tests/*.ts`, under settings the engine was not written for.
  Tests that call a handler point Supabase at a dead local address, so a
  missing guard fails as a connection error rather than a production write.
- `apps/control-plane/scripts/run-endpoint.ts` runs one handler locally;
  `apps/control-plane/scripts/eval/` is a prompt A/B harness.

## Driving it from an agent session

1. Use the operator bearer from a secret store the session was given; never
   print it, commit it or paste it into chat.
2. Check the engine's health before you spend: `GET
   /api/content-engine/health` on the operator bearer. When
   `model_provider.usable` is false, stop: `model_provider.says` names the
   failure, in the provider's own words, and when access returns, and every
   stage that writes or checks (draft, revise, final pass, fact gate, the
   judges) will be refused. When `state` is `unconfirmed`, the reset has
   passed and one cheap call shows whether it is back. On 2026-09-27 the key
   was over its usage limit for 33 hours before anyone knew (walk log F28 to
   F30).
3. Read a piece with `GET /api/content-ideas?id=<uuid>`: its `id`, `state`,
   `lane_slot`, `idea`, `thesis`, `body` and `updated_at`. Never read a body
   with SQL (walk log F32).
4. Your own calls are observations. Relay a decision only when Krish made it
   in words in the session, with `decided_by: 'Krish'`.
5. Run calls that write `meta` one at a time: most routes read the row, call a
   model, then write the whole `meta` back.
6. Keep spend inside what Krish approved for the session, and read
   `meter_daily` to check it. A refused call counts as a run and a failure on
   its key, at no cost.
7. Write what you find in `docs/walks/` or the relevant document, never only in
   the chat.
8. A revise is a success only when its stream ends with `done` and
   `ok: true`. A failure is a status with a typed body, or the stream's last
   event, `error`, with a `code` (see "How `revise` answers"). Read
   `self_check.remaining` on a draft or a rewrite before anything else: it
   lists what the text still breaks, so a fix goes to exactly those
   sentences ("The writers' self-check").
9. Save text the engine wrote (a rewrite you accept, a draft, a final-pass
   fix) with `PATCH /api/content-ideas` and `edit_source: 'magic'`:
   `{ id, body, edit_source: 'magic', client: 'claude_code' }`. Without it the
   PATCH records a `manual_edit`, which the ledger, and the caching-pass bar
   that counts hand edits, read as an agent editing by hand when it did not
   (walk log F37). The accept itself, when you record it, goes to
   `POST /api/content-edits` as `magic_accepted` with `before_hash` and
   `after_hash`, and an operator's row is an observation. Text you wrote
   yourself is a hand edit: save it without the field, so it is counted.
10. Before a piece can move on, its facts must pass the gate. File the sources
   you used as verbatim excerpts with `file-verbatim-source.ts` (a summary
   alone never passes a fact), run `POST /api/content-ideas/:id/fact-check`,
   and fix or cut what it lists. An answer of `model_unavailable` recorded
   nothing: read health, and run it again once the provider is back.
   Where you attribute words, use the source's
   own words; the piece's house translations ("brain" for model) belong in
   the writer's voice, never inside a quote or a paraphrase of one.
   A known limit: the gate needs the figure as the piece writes it. Amazon's
   10-K prints advertising revenue as "68,635" (in millions), and no passage
   of it can carry "$68.6 billion", because the number check wants "68.6" in
   the quoted words. File a source that prints the rounded figure as well
   (piece 1 filed a GuruFocus report on Yahoo Finance and marketmaze), and
   check the passage is about the same thing: the same 10-K says "Operating
   income was $68.6 billion" for 2024 (walk log F38).
11. A web edition goes in `editions/` with the exact text that passed and the
   gate's record (`editions/README.md`); its test fails if the page says
   anything the gate did not check.
12. When Krish gives a new ruling in words, add it to `api/_houseRules.ts`
   once, with his words and the stages it touches, and let the coverage test
   tell you which stage still ignores it. Never copy a rule into one prompt.
13. After every push to `main`, read `main`'s CI before the next push (walk
   log F20).
14. When Krish asks for a video's YouTube title and description, or a
   piece's Substack title and subtitle, ask the engine for them rather than
   writing them in the chat. One call writes all four. Put what you know in
   `body.json`, every field optional: `{ "thumbnail_text": "When an AI agent
   does your shopping, who gets paid?", "video_seconds": 152, "hint": "a steer
   he gave, in his words" }`. Then run
   `python3 scripts/engine.py POST /api/content-ideas/<id>/package @body.json`.
   Read `package.lint.problems` first: a `fail` is something the engine could
   not fix in its one retry, a `warn` is worth a look. Then show him the title,
   the two `alternates` with their `why`, the description, and the
   `substack_title` and `substack_subtitle`. Which titles go up is his
   decision, and he pastes them into YouTube Studio and Substack himself; the
   engine publishes nothing. A new ruling of his about titles goes into
   `api/_houseRules.ts` as step 12 says, and the part a machine can check into
   `PACKAGING_RULES` and `lintPackage` or `lintSubstack` in
   `api/_packaging.ts`.
15. The same day a post's launch set is made, pack it with
   `python3 scripts/post-pack/build.py post.json` and send it with
   `python3 scripts/post-pack/send.py <pack folder>`; send a brand kit change
   with `send.py --brand-kit` (Krish, 2026-10-06, section 9 above). Read
   `--dry-run` first: it shows every path and what it is for. A refused path
   stops the whole send before anything goes.

## Development notes

- Imports use NodeNext `.js` specifiers.
- No local dev server: use `npm run typecheck:control-plane`,
  `npm run check:control-plane`, the tests and `apps/control-plane/scripts/run-endpoint.ts`.
- `main` deploys to production on push; a branch gets a preview deployment.
