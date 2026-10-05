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
| H38 | The `package` step also writes the Substack title and subtitle: the title aims for 60 characters (it is the email subject too) and fails past 100 (the phone feed cuts at about 110); the subtitle's first sentence must stand alone, because a phone feed shows about one line. Same truth, number and style checks, the same single call and one retry. | F65. Krish's 122-character title fails the cap; his subtitle's first sentence passes. | `2ea277a` |
| H37 | Artwork that survives Substack. `scripts/pages --cover` makes a 3:2 cover (1200x800) and refuses it if a word sits outside the box all of Substack's crops keep, or if a word would be under 14 pixels in a phone's feed (11 for fine print); `cover-crops.png` shows the feed card, the share card and the archive tile. `scripts/pages/card.py` runs the same phone check on any artwork made from HTML before it becomes a picture, and every build shows each image at phone width. House rule `SUBSTACK_FIT`. | F64. Article 1's rebuilt cover: headline 27 px in a phone's feed, tags 14 px, label 11 px. | `16dbd8d`, `687f1a6` |
| H36 | Pages and channel art as tools. `scripts/pages` builds a piece's branded page and its one-column Substack copy from the exact text that passed, refuses to write either if a sentence of the body would be missing, and `--check` copies the post in a real browser and counts what reaches the clipboard. `scripts/channel-kit` builds the YouTube banner, inside the strip every screen shows, the watermark and the channel description. Fonts come from the repository's pinned packages; logos from makeyourmindup.ai, cached; colours and days from `config/studio.json`, so a schedule change is one edit. | F60. Article 1 rebuilt by the tool wraps line for line like the page Krish was given; the copy kept 3 of 3 images and 13 of 13 headings. | `b69a464` |
| H35 | The `package` step writes a video's YouTube title, two backups and description (`POST /api/content-ideas/:id/package`). The rules are data in `api/_packaging.ts` and house rule `YOUTUBE_PACKAGE`; `lintPackage` checks length (aim 60, cap 100), the thumbnail repeat, clickbait words, capitals, every number against the piece, the em dash and "Not X, Y", and the makeyourmindup.ai line. One retry with the problems listed, never more; stored in `transformed_outputs.youtube_package`; nothing is published. | F59. The worked example is the title picked on 2026-10-05: "Amazon blocked Meta's AI shopping agent. Shopify let it in." | `761e85f` |
| H34 | `scripts/quick-edit`: one recording to a finished tall and wide video in the makeyourmindup look. Cuts are the words as said, graphics are placed by the words they cover, `--plan` shows every cut before a render, `--share-mib` writes copies under the chat limit. Both launch videos' settings are in `editions/2026-10-launch/video-kit/`. | F58 | `4cb6b1e` |
| H33 | The fact check caps new claims per run, never total claims: settled sentences carry free and the claims over the cap wait for the next run as `unchecked`. | F57 | `ace7249` |
| H32 | The call on a Short comes from the approved text, read by one parser. `readPieceCall` (`packages/contracts/src/call.ts`) reads the statement, the date to check it by and how sure we are from a piece's approved text, and refuses with a plain reason whenever one is missing or open to doubt. The control plane's CALL and CLEAR_STANCE checks now find the section, the date and the percentage with the same code, with CLEAR_STANCE also reading "Confidence: 70%" (F35) and CALL refusing exactly what the Studio refuses, and still refusing everything it refused before in the same words (compared with the old functions over 208 texts). The Studio refuses a house style render for a live subchannel whose job has a production brief when the manifest has no `call`, or one whose statement, date or percentage differs from the approved text by a character; `studio v2 call --job <job> --beat <beat_id>` prints the exact call to paste. The parser showed that CALL passed some texts the Studio cannot read (an unlabelled percentage, two dated paragraphs, 31 June), so a piece could be approved with a call no Short could show; CALL now uses the same reader, and the CALL house rule tells writers the exact form. Tests: `tests/piece-call.test.ts`, `tests/control-plane/call-reader.test.ts`, `tests/render-v2.test.ts`, `tests/cli-v2.test.ts`; mutation-checked. | A wrong date or percentage on the call card is a factual error in public, and Krish's rule is zero tolerance. The render manifest was written by hand from the brief, and nothing caught a missing or drifted call. | see git log |
| H31 | The Studio's makeyourmindup branding rebuilt in the house style, from the mock Krish approved on 2026-09-28. Theme `makeyourmindup-video-v1` version 2 (still a candidate, no approval, its control-center commit left as `PENDING_CC_COMMIT` until the stacked logo reaches control-center `main`) draws the mock's CSS: the mark on an ink tile with the channel colour's hard shadow on every beat, captions on an ink block with one mint swipe, the channel sticker on the second beat, a call card on the beat a manifest names (new optional `call` in the render manifest; nothing upstream marked it), and the ending band for the same two seconds the old plate used. A new thumbnail (`MakeyourmindupThumbnail`, no photograph) becomes a house style Short's package cover; carousels get a cover, middle and last card. The retired series render byte for byte as before (render props hashed against `518b5fe`, and frames rendered at both commits compared). Proof: the Studio's own renderer against the mock's frames. Tests: `tests/render-v2.test.ts`, `tests/carousel.test.ts`, `tests/thumbnail.test.ts`, `tests/packaging-v2.test.ts`; mutation-checked. | F27. Krish, 2026-09-28, on the mock: "yes, approved". | see git log |
| H30 | The engine follows the live cover page (makeyourmindup.ai went live on 2026-09-26; Krish: "Just get in line with what those updates are at the live website", then "Correct the engine's table and anywhere else, its out of date"). under.the.hood is due every Monday, one a week, in `venture_formats` and `content_cadence` (Control Center migration `20260926150000`); it had no fixed day at 0.5 a week. The page promises "Contains British spelling", so house rule BRITISH_SPELLING reaches the writers and the final pass, and `americanSpellings()` blocks approval on an American spelling outside a quotation or a name (piece 2 passes). The site's four logo files, eight colours and four typefaces match the kit the Studio theme was cut from, so nothing is re-pinned. The brand book's home is in `docs/STUDIO.md`. Once the makeyourmindup repository was attached, brand book v1.4 was read directly: its mark and logo hash-match the pinned files, only p.13 (the felt robot) and p.14 (the stamps) are new, and both are in `docs/CREATIVE_IDENTITY_UPGRADE.md`, the stamps also as house rule STAMPS. | works |
| H29 | makeyourmindup branding in the Studio, built and switched off. A new theme, `makeyourmindup-video-v1`, carries a publication lockup: the mark on every beat, the logo with the channel's name as type once at the end (bottom left, never the opening), the mark and name on carousel cards, and the same on Control Center's video plate. The marks are pinned by sha256 in control-center. It is a candidate: `brandThemeRefusal` refuses it until Krish's approval is captured in the Studio on his machine, and always for a retired series. The Mindmake theme parses and hashes as before. Rendered by the Studio's own renderer here as proof. Tests: five in `tests/render-v2.test.ts` (ending only, bottom-left preference, no opening fallback, candidate and retired refusals), the carousel slots, a Control Center spec; each mutation-checked. | Krish, 2026-09-26: "Make your mind up, Mark, plus the channel name", then "placement approved". | see git log |
| H28 | The fact gate never checks Krish's confidence line: `extract()` drops "How sure we are: N%" from the claims, and `sweep()` never sends it to the second look (the first fix missed that path; run 15 showed it). Nor does the second look re-read it (`leftoversOf`): the route re-reads every set-aside, and the second look turns any sentence with a number into a claim, which is how it came back on runs 15 to 17. The word-for-word test ignores spacing and quotation marks, so a checker that joins two paragraphs, respaces a table row or drops the marks around a quoted term still matches the same words; different words still fail. Tests: `tests/control-plane/fact-gate.test.ts`, each mutation-checked. | F25: on piece 2 the line passed one run and blocked the next; two correct passages failed on spacing alone. | `65bda02`, see git log |
| H27 | The Fork, mind.the.gap's format: then, now, the fork, our call, the order its timeline draws the story in. In the contracts, the brief builder, both format lists and Control Center's composer, which picks it for a mind.the.gap piece. A Fork carousel must end on the call with a date and a percentage (`theForkIssues`). The runner declares the formats it parses, and a runner that declares none is never handed The Fork, so the old runner keeps working. Tests: `tests/studio-series.test.ts`, `tests/carousel.test.ts`, `tests/control-plane/production-brief-live-series.test.ts`, a composer spec; mutation-checked. | Krish, 2026-09-26: "The Fork is good". | see git log |
| H26 | The Studio learns the three subchannels (`packages/contracts/src/series.ts`). Five series: the three live names, plus the two retired ids kept valid for good because they sit inside hashed and signed records. Rules, presets and devices approved for a retired id serve its successor; follow.the.money and under.the.hood take their predecessors' formats; mind.the.gap has none yet. A live piece gets a brief in its own name. The runner declares the series it can parse and is only handed those, so an old runner keeps working and the two sides update in either order. Control Center's composer offers Studio for all three. A branded render for a live subchannel refuses in plain words until Krish approves its wordmark. Migration `20260926090000` pins the five on `video_studio_jobs`, applied live and read back. Tests: `tests/studio-series.test.ts`, `tests/control-plane/production-brief-live-series.test.ts`, two composer specs; all mutation-checked. | Krish, 2026-09-26: item 4, teach the video side the three names. F21. | `47f3944`, control-center `2c60cd0` |
| H25 | Krish's confidence in a prediction no longer puts a passed fact check out of date: `bodyHash` reads "How sure we are:" plus a bare percentage as the same line, and every other word still breaks the match. Setting piece 2 to 75% kept its check; before, it would have cost a full re-run. A new house rule, CLEAR_STANCE, warns (never blocks) when a confidence is under 70%. | Krish, 2026-09-26: "I'd rather take a clearer stance than sit on the fence all the time and say 60%." | `e4f1394`, `b423fcf` |
| H24 | Receipts (`api/_receipts.ts`). For every claim the fact gate passed, the source's own words behind it: the one passage that carries every number the sentence uses, its page, whether the web agreed, and a screen form with markup removed and no word changed. `GET /fact-check` returns them for the version that passed. On piece 2: 32 receipts, 21 short enough for a phone screen. They are the proof panels for Shorts and carousels. Test: `tests/control-plane/receipts.test.ts`, mutation-checked. | Krish shared an Instagram ad he found "really impactful" (`docs/REFERENCE_INSTAGRAM_AD.md`); its strongest move is showing the source on screen. | `d408e11` |
| H23 | Control Center's fact-check strip shows the whole approval checklist ("Before it can be approved", with a count or "Ready"), and every approve path explains a `publish_gate` refusal. The strip's spec joins CI's e2e list, which had never run it. | The engine refuses approval now (H22); Krish needs to see why before he presses the button. | control-center `37538b7` |
| H22 | Checks before approval (`api/_publishChecks.ts`). The PATCH refuses `approved` and `published` with 409 `publish_gate` unless: the fact gate passed; no "Not X, Y"; no em dashes; no exclamation marks outside quotes; reading age at most 13 (12 to 13 warns); a prediction with a date and a percentage. Plain words is a warning listing words to explain. Reported in ages and plain words. | Krish, 2026-09-25: "implementing gates and checks prior to publish that have come from some of the guidelines I've given". | `a032649`, `d574a8e` |
| H21 | Every stage reads the rules for its step: both judge gates (the overnight ladder and the manual route), the joke pass (its own stale copy had no "Not X, Y" and no reading age), the drafter and rewriter (plus rules scoped to their subchannel), the final pass (which lacked "Not X, Y"). The drafter and rewriter used to let a mandate override the house rules on the close; the house rules now win, so no mandate can drop the prediction. The ladder's repair now cleans its rewritten ideas like every other writer. | F22. | `a032649` |
| H20 | Krish's rulings live in one list (`api/_houseRules.ts`): each rule's text, his exact words, the date, live or trial, and the stages that must enforce it. `tests/control-plane/house-rules.test.ts` fails when a live rule reaches no stage, or a stage drops one. A new ruling is added once. | Krish, 2026-09-25: think of the engine "as a modular set of components that work together to come alive". | `a032649` |
| H19 | Web editions (`editions/`). The piece's page in the makeyourmindup house style lives in the repo beside the exact text that passed the fact gate (`body.md`) and the gate's record (`edition.json`). `tests/editions.test.ts` fails if `body.md` is not the version that passed (its fact-gate hash) or if any sentence of it is missing from the page, so a page can add pictures and labels but never an unchecked fact. First edition: piece 2, "Who picks your AI?". Mutation-checked twice. | Krish, 2026-09-25: build "the bricks of the system as you go, as opposed to just doing this one article by article." |
| H18 | Control Center gets a "Check the facts" strip where Krish approves: whether this exact version passed, the button, and each fact to fix in plain words with the web source (`src/components/content/FactCheckStrip.tsx`, `e2e/fact-check-strip.spec.ts`). | Until then only an agent could run a check, so the gate's refusal named a step Krish had no button for. |
| H17 | `apps/control-plane/scripts/file-verbatim-source.ts` files a source's own words on a piece for the fact gate: title, date lines, each matching passage with its nearest and its dated heading; it refuses when a pattern matches nothing. Test: `tests/control-plane/file-verbatim-source.test.ts`. | The same procedure was done by hand about ten times on piece 2. |
| H16 | `npm run verify`'s two standing guard failures fixed: `judge_sweep` (replayable) and `judge_ladder` (manual_only) join `_jobs.ts`; the judge batch sums usage through `addUsage` in `_prices.ts` instead of reading cache fields by hand. All 28 control-plane guards pass; the only verify failures left need ffmpeg, which this container lacks and CI has. | Red on `main` since before the walk (section 2, "Pre-existing failures"). |
| H15 | Two of Krish's rulings become house rules (R6, R7 below): `VOICE_GUARDRAILS` gains reading age 12 with humour, and plain words with no coined labels; the final pass's voice absolutes check both; channel cuts, which never read the house rules, now do. Test: `tests/control-plane/voice-plain-words.test.ts`. | F19, and his words on 2026-09-25. |
| H14 | The fact gate's runs 2 to 10 on piece 2, and what each fixed. The second look reads every sentence the lister missed, not only ones with a number (a fact with neither, "a small one, a middle one and a big one", was never checked), in batches of twelve numbered from 0 with one retry for anything unanswered (a batch numbered from 36 came back empty and failed closed), and it sees each sentence's section heading. A set-aside takes two readings that agree (the lister waved Scott Wu's quoted "will tell you it was Thomas Jefferson" through as inference because of "will"). A passage under a dated heading carries its date; numbers compare by value; a passage shortened with "..." holds when its pieces are in the source in order; a passage too short to trust is dropped, not fatal. Contradictions are re-read against the quoted words only; undated evidence cannot contradict what was said on a date. The piece's own prediction is never a claim. Run 10 passed: 34 facts, 19 confirmed by both checks, 13 word for word in a filed source, 2 on the web. | Each change names the run that exposed it in its commit message. |
| H13 | The fact gate learns from its first run (piece 2, 26 claims, 14 blocking). A claim may rest on up to three passages, each word for word in the sources, so a date in a heading counts. Perplexity runs three at a time with retries on 429 and 5xx (it refused six of 26 at six at a time). A second model reads the web checker's own quoted evidence, and a "supported" or "contradicted" counts only when that quote bears it out (Perplexity backed two claims with quotes about something else, and contradicted two with a source that only said less). Every sentence the lister did not cover gets a second look, not only those with a number or a quotation (piece 2's "a small one, a middle one and a big one" had neither and was never checked): an analogy or a scare quote is set aside with its reason, but a sentence with a number never is unless it reads as a forecast, and an unanswered one stays a claim. One source is enough only when it is the source's own words: materials can be filed `verbatim: true` with their URL, and a claim found only in a summary needs the web to agree. The second run (60 claims, 44 blocking) found four more faults, all fixed: the second look over the whole piece in one call came back empty (now twelve sentences a call); a passage under a dated heading failed for want of the date (code now adds the nearest dated heading or "Published" line from the same source, never an earlier entry's and never across sources); "$150.00" did not match "$150" (numbers compare by value); and contradictions were not borne out (the web step read the checker's own opinion as evidence, and an on-file contradiction was never re-read; both now go through the second model on the quoted words only). 35 tests, every rule mutation-checked. | F15, and the first run's table. |
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
| F2 | revise, in place | The select-and-rewrite path splices back whatever the model returns. Given a heading, it returned the heading without `## ` plus the next sentence, so the heading stopped being a heading and a sentence was duplicated. Twice it changed the meaning of the line (invented a position for Amazon; "measured, not projected" became "measured against your actual logs"). | piece 1, 8 in-place calls: 6 clean, 1 broken splice, 2 meaning drifts. The route should refuse a fragment that carries text from outside the selection and keep a heading's markdown. **The duplication is fixed 2026-09-30 (F44)**: echoed text is taken off before the splice. A heading sent back without its `## ` still loses it. |
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
| F15 | research | The engine's own research (`dive-deeper`, Perplexity) listed GPT-6 Luna's output at $0.25 per million tokens as its price. On OpenAI's pricing page that is the Batch price; the standard price is $0.50. Piece 2 v2 built "$0.25 to $180" on it, and the $180 (GPT-5.4 Pro, from OpenAI's March 2026 announcement) is no longer on the pricing page. A gate that trusted one source on file would have passed both. Fixed as H13: a summary alone never passes. | piece 2 research material; OpenAI pricing page read 2026-09-25 |
| F16 | iteration | My own correction pass on piece 2 (v2) fixed the engine's six errors and added its own: a quotation paraphrased and still attributed ("better value" for Scott Wu's "better cost efficiency"), the GPT-6 price cut stated against the wrong baseline, "quietly" added to a documented change, a job title from memory rather than a source, and an overstated enterprise setting. The gate's first run caught all of them. An agent's rewrite is not a check. | fact gate run 2026-09-25T16:36Z on piece 2 |
| F17 | draft | My v2 of piece 2 said the switching so far was only "companies routing their own work". GPT-5's switcher has routed ordinary ChatGPT users since August 2025. No check caught it, because it is an argument rather than a fact; Krish's read and the rewrite did. | piece 2 v2, "Where it could go" |
| F18 | fact gate | The independent check earned its keep: Claude's support page says thinking is always on for Opus 5.5 and Fable 5.1, so "at every level Claude still decides whether to think" overstated Anthropic's own docs. Cut. | run 7 on piece 2 |
| F19 | voice | The engine and I invented labels a reader has to decode: "the picker, the price, the bill", "the pattern", "the Call", "inference", "router", "Speakeasy", flavour names built on jargon. Krish: "I can't understand it by just looking at it so we shouldn't assume anyone else will." Fixed as H15 for the engine and in piece 2's page and text. | Krish, 2026-09-25, on the page |
| F20 | process | I pushed to `main` without reading CI. The engine went red at `a5c5ab3` (an undocumented `ENGINE_URL`), then my edition test pulled engine code into the strict root typecheck, then Windows checked the edition out with CRLF and its hash broke. Control Center was red from the rename at `a01e2a7` for about ten hours over seven pushes: on a 360px phone the room tabs wrapped to five rows and pushed a button under the nav. All fixed (`eea86ce`, `21a0fdf`, control-center `60cbedc`). From now on: read `main`'s CI after every push before the next one. It happened once more on 2026-09-26: `e4f1394` went out with two failing tests on screen, because the command that ran them did not stop the push. Fixed in `b423fcf`; a push now runs only after every check in the same command succeeds. | GitHub Actions, 2026-09-25 and 26 |
| F21 | studio | The Studio brief accepts only the two retired series (`money_of_ai`, `built_with_ai`) in `_productionBrief.ts`, so no piece on follow.the.money, mind.the.gap or under.the.hood can get one. The pieces that can are the ones the fact gate skips. Nothing reaches video or carousel until the contracts speak the live names. Fixed as H26 (Krish's go, 2026-09-26). | component map, 2026-09-25 |
| F22 | judges | No judge read any of Krish's rulings. The draft "voice" judge was told to score against a kill list it was never given. Fixed as H21. | component map, 2026-09-25 |
| F23 | ideation | The idea sources (research, radar, creator scout, inspiration) each carry their own copy of the voice rules, several still write retired subchannel names, and `deepen` refuses a piece on a live subchannel with a 400. Not fixed yet. | component map, 2026-09-25 |
| F24 | database | Live, `video_studio_jobs.series` had lost the check the migrations give it and gained a foreign key to `venture_formats(slug) ON UPDATE CASCADE`, added outside either repository's history. Each subchannel rename cascaded into it, so the two retired validation jobs now read `under_the_hood` while the runner's signed records for them say `built_with_ai`. They are retired and carry no media, so they were left as they are. Migration `20260926090000` pins the Studio's five ids on top of the key, so a rename can no longer move a job's series away from its signed record. | live readback, 2026-09-26 |
| F25 | fact gate | The gate gives different verdicts on the same sentence from run to run. Piece 2's line edits took eight runs on 2026-09-26 (11 to 18, about $4.50 on the meter) before passing, and runs 11 to 17 each blocked 2 to 6 claims, mostly different ones each time, including sentences word for word the same as in the version that passed on run 10. The causes seen: the web checker (Perplexity) cites a different article about a different event ("contradicted" by a Reuters story on another price cut); the on-file check quotes a passage that is not word for word in the source (a table row, a quote mark dropped); and the extractor listed Krish's confidence as a claim (fixed as H28). The gate still errs towards blocking, which is the safe side for zero tolerance, but a correct piece can take several runs. Run 11 also caught two real slips that run 10 missed ("one question at a time" where the docs say "each request"; a 2025 event told in the present tense). Making it steadier was a policy choice for Krish; on 2026-09-28 he ruled "fact check as much as possible until is no longer needed", so the gate stays strict and a piece is re-run until it passes. | piece 2, runs 11 to 14 |
| F26 | process | Two of the failures on piece 2's line edits were mine. Splitting long sentences for reading age cut claims away from the words that made them checkable ("It broke." and "People lobbied hard to get the old brain back." on their own; the CNBC claim without "model routing"), and I changed "ask a model" to "ask a brain" inside Scott Wu's example, a house translation inside a paraphrase, which the rules forbid. From now on: a readability edit keeps each claim's subject, source and key term in one sentence, and never touches a quote or a paraphrase of one. Two more the same day: I attributed CNBC's definition of tokens to TechRadar (the gate caught it), and a commit went in with a failing test because the test output was piped through `grep`, whose success hid the failure from `&&`; caught before the push (`b41a4b4`). Tests now run with their exit code checked directly. Hours later the same shape recurred with the docs validator piped through `tail`: control-center's NOW.md went out one line over its 200-line limit (`ca1734b`), fixed in `deedee8`. Every check in a push command now runs unpiped. | piece 2, runs 12 to 14; `644cc3e` |
| F27 | studio | The makeyourmindup branding rendered in the Studio kept the Mindmake Studio look: its dark green-grey ground, its caption style and a dark plate around the logo. Only the logo and the channel name were new, because I chose to keep "the Studio's current colours and type" (2026-09-26). Krish, 2026-09-28: "this is awful, and embarrasing. it does not even look like the makeyourmindup site in design aesthetic." The placement he approved on the storyboard was right; the look was wrong, and it was mine. The theme stays switched off until it is rebuilt in the makeyourmindup brand book's own system (ink, cream, mint, the channel colour blocks, Anton, the brutal shadow, stickers) and he approves a render made by the Studio itself. | Studio renders, 2026-09-26 |
| F14 | judge sweep | Editing the thesis of a piece in `drafting` changes its `artifact_hash`, so the 10-minute sweep re-judges it and the ladder may repair (rewrite) the thesis. So piece 2's stale thesis (F7 again) is left alone for now. | `candidateQuery` in the sweep includes `drafting` |
| F10 | research | `dive-deeper` caps Perplexity at 1,200 tokens, so a three-part question is cut off mid-sentence. Each call also rewrites the whole `meta`, so calls must run one at a time. | piece 1, research |
| F28 | judges | From about 10:00 UTC on 2026-09-27 the engine's Anthropic key was over the account's usage limit ("You have reached your specified API usage limits. You will regain access on 2026-10-01 at 00:00 UTC."). Nothing flagged it. Each judge's refusal became an abstention, "the judge could not be reached", and was written; the judge sweep logged `ok` every ten minutes while walking the same nine ideas ("judged 9, escalated 9, unjudged 9"), because an `unjudged` row is eligible again on the next tick. | `judge_verdicts`: 8,046 blank abstentions on 2026-09-27 and 11,079 on 2026-09-28, almost no real verdicts; `content_engine_runs` and `judge_sweeps`, read 2026-09-28. **Fixed 2026-09-28**: a panel on which every model judge failed is a failed run (`ModelUnavailableError`), with no rows; the idea gets only when to try again (`meta.ladder_failure`: the stated reset, an hour, or half an hour doubling to a day); a refusal of every call stops the pass; the sweep fails the tick in the provider's words and waits for the reset before calling again; unjudged no longer counts as escalated. A judge that ran and declined still abstains. `tests/control-plane/judge-failed-run.test.ts` |
| F29 | meter | A refused call was never metered: `anthropicCall` returned early on zero tokens, and a refusal has none. `failed` read 0 for a key that had answered nothing for 33 hours. A mid-stream error whose message did not start with "anthropic" was also swallowed by `streamClaude` as an unreadable frame, returning half an answer as a whole one. | `meter_daily`, 2026-09-27 and 28: no Anthropic row after `aeo-probe` at 09:51, failed 0 throughout. **Fixed 2026-09-28**: every failed call adds a run and a failure to its key and day at no cost; its class, the provider's words and the reset time are kept in `system_config` for health and the sweep (`api/_modelProvider.ts`); stream errors are tagged and re-thrown. `tests/control-plane/meter-failures.test.ts` |
| F30 | health | Health could not say the model provider was unusable, and it answered 401 to the operator bearer, so an agent session could not check before spending. | piece 3 walk, 2026-09-28. **Fixed 2026-09-28**: `model_provider` in the health response (usable, state, the last failure's class and words, the reset, when the sweep tries again, and a sentence that says when the engine cannot write or check anything); health opts in to the operator bearer by the check `guardEngine` makes, and every earlier refusal stands. `tests/control-plane/runner-health.test.ts`, `engine-auth.test.ts` |
| F31 | revise | `revise` reported a failure as HTTP 200: the stream opened before the model call, so the usage-limit refusal arrived as one untyped SSE event, and a caller reading the status saw success. | piece 1, `w1/revise-1.out`, 2026-09-28. **Fixed 2026-09-28**: the stream opens only once the provider accepts the call; a refusal before that is a typed JSON body with 503, 429 or 502; a failure after it is a typed `error` event, the last one, with no `done`; an empty answer is `empty_output`. Shapes in `docs/CONTENT_ENGINE.md`. `tests/control-plane/revise-errors.test.ts` |
| F32 | reading a piece | An agent session could not read a body: `/api/content-ideas` took only POST and PATCH, and `GET /fact-check` returns the checklist without the text. The walk confirmed v10 with read-only SQL. | piece 1, step 1, 2026-09-28. **Fixed 2026-09-28**: `GET /api/content-ideas?id=` returns id, state, lane_slot, idea, thesis, body and updated_at behind the same gate. `tests/control-plane/content-ideas-get.test.ts`, `engine-auth.test.ts` |
| F33 | fact gate | Two faults in what the gate compares. Verbatim excerpts keep the page's markdown links, and a quote of the visible words failed "word for word" against "[2025 filing](https://...)". And `sourcesText` read research dives as `question` and `sources`, which no writer stores (`query`, `citations`), so a dive's question and URLs never reached the checkers, while its findings came in twice (as the dive and as dive-deeper's material). | piece 1: a local run of `quotesFail` on 15 passages, 3 failed, 2 of them on link syntax; piece 3's live `meta.deep_dives`. **Fixed 2026-09-28**: the comparison reads link text as words, a number in a link's address carries nothing, and each dive is read once under its stored names. Zero tolerance unchanged, with a regression test that a contradicted claim still blocks. `tests/control-plane/fact-gate.test.ts` |
| F34 | filing | `file-verbatim-source.ts` filed link text with its markdown syntax (",[those Conditions have included](https://...)dedicated"). | piece 1's filings, 2026-09-28. **Fixed 2026-09-28**: `excerpt()` files each line as the words a reader sees, and matches patterns against them. `tests/control-plane/file-verbatim-source.test.ts` |
| F35 | checks | `CLEAR_STANCE` passed when it could not read a confidence: v10's "Confidence: 70%" did not match "How sure we are:", so the checklist showed the stance green over its own detail "No confidence set yet". | piece 1, `GET /fact-check`, 2026-09-28. **Fixed 2026-09-28**: `confidenceOf()` reads both forms, and the check is green only on a number it has read. `tests/control-plane/house-rules.test.ts` |
| F36 | materials | The drafter and the rewriter read 9,000 characters of materials, newest first, stopping at the first item that did not fit, while the final pass read 16,000 and the fact gate 120,000. And the ladder's repair was handed the engine's own Perplexity dives as "Research Krish brought himself" (F12 again, on a path H11 missed). | piece 3: the drafter saw 7 of 8 filed excerpts and none of the 4 dives. **Fixed 2026-09-28**: filed sources first and in full up to 24,000 characters, then the rest, trying past an item that does not fit; engine research (dives, deepen, investigations, the shift dossier) labelled as its own secondary research, whoever pressed the button; the repair's materials labelled by whose they are. `tests/control-plane/materials-owner.test.ts` |
| F37 | ledger | Saving engine output as the walk brief prescribed, `PATCH {id, body, client}`, records a `manual_edit` (observation only): an agent hand edit that never happened, which is what the caching-pass bar counts. | piece 3 walk, from reading `content-ideas.ts`. **Documented 2026-09-28**: save engine text with `edit_source: 'magic'` (the field exists); record the accept through `/api/content-edits` ("Driving it from an agent session", item 9). |
| F38 | fact gate | A known limit, still open: the gate needs the figure as the piece writes it. The 10-K prints advertising as "68,635" (in millions), so no passage of the primary source can carry "$68.6 billion". A trap beside it: the same 10-K says "Operating income was $68.6 billion" for 2024. | piece 1, 2026-09-28. **Workaround, documented**: file a source that prints the rounded figure as well (GuruFocus via Yahoo Finance, marketmaze), and check the passage is about the same thing ("Driving it from an agent session", item 10). |
| F39 | fact gate | A model provider failure part-way through a run was recorded as failing claims. Each model call caught its own failure: a refused on-file check became "not found", a refused entailment "not borne out by the quoted evidence", a refused second look left its sentences to fail as claims, and a refused extract was a 500. The run then stored that result over the piece's last real one, so a usage limit or a passing hiccup would cost one of the two fact-gate runs each of the next three pieces is allowed, and show Krish a reason that was wrong. | reading `fact-check.ts` after F28 to F31, 2026-09-28, ahead of drafting resuming when the limit resets on 2026-10-01. **Fixed 2026-09-28**: the first model call that gets no answer ends the run. Nothing new starts (a Perplexity call queued behind it included), what is running finishes, nothing is written, and the answer is revise's typed body with `error: 'model_unavailable'` and 503, 429 or 502 (`docs/CONTENT_ENGINE.md`, "When the fact gate cannot reach the model"). A claim that was checked keeps its verdict, and a failure of the web checker still leaves a claim unclear. `tests/control-plane/fact-check-provider.test.ts` |
| F40 | brief revise | `POST /api/briefs/:week/revise` opened its stream before the model call, the fault F31 found in the piece's revise: a usage limit or a refused key came back as HTTP 200 carrying one untyped `error` event, and a short answer as `revision came back empty`, so a caller reading the status saw success. | reading the route after F31, 2026-09-28. **Fixed 2026-09-28**, with the fix and shape `1d6a1b0` gave the piece's revise: the stream opens only once the provider accepts the call; a refusal before that is the typed JSON body with 503, 429 or 502 and `Retry-After`; a failure after it is the stream's last event, a typed `error`, with no `done`; an answer under 100 characters is `empty_output`. The route is still on `preamble` (`docs/STATE.md`). `tests/control-plane/brief-revise-errors.test.ts` |
| F41 | fact gate | Only "How sure we are:" on a line of its own was exempt from the hash a check is pinned to, and from the claims. Piece 1 writes its call as one paragraph that ends "Confidence: 70%.", so re-setting that number would have thrown a passed check away and cost a whole fact-gate run for a number that is Krish's judgement (his ruling, 2026-09-26: a confidence no longer forces a fact re-check). And the sentence "Confidence: 70%." went to the second look as a sentence with a number in it, where it becomes a claim that can only fail, on every run. | piece 1 v10 read against `_factGate.ts`, 2026-09-28 (the second half found while fixing the first). **Fixed 2026-09-28**: the exemption reads the call with the shared reader (`callSectionOf` and `labelledConfidences`, `packages/contracts/src/call.ts`) under both labels, and takes out only the number inside the call. The call's words and date, anything after the number, the label, and a labelled number outside the call still break the check. The line form is read exactly as before, so piece 2's stored check still matches (`editions/`). `tests/control-plane/fact-gate.test.ts` |
| F42 | draft, revise | The writers broke Krish's blocking rules even when told exactly what to fix (F1 again). Piece 1's rewrite (`revise`, feedback) returned two "Not X, Y": "Those words were about Perplexity's robot, not Muse." and "Reading them across to Muse is our guess, not Amazon's claim." A revise scoped to that one sentence, told to remove the construction, returned "...is our guess, not Amazon's claim." three times running. Piece 3's first draft broke R2 three times ("So the 27 years is a flavour, not an ingredient"; "That's not matching or exceeding the leading models. That's finishing third out of three"; "isn't secrecy for its own sake. It's that...") and read at about age 13.5, above the blocking limit of 13. Each cost a rewrite or hand work, and the caching pass waits on three pieces in a row with at most one rewrite and no agent hand edits. | pieces 1 and 3, 2026-09-30, when drafting resumed after the outage. **Fixed 2026-09-30**: the writers' self-check (`api/_selfCheck.ts`). After the model answers, `draft` and `revise` run the checklist's blocking checks a writer can meet (R2, em dashes, exclamation marks, British spelling, and the reading age for a whole text); on a hit, one more call with the same system prompt and a correction quoting each hit and its house rule; the answer with fewer failures is returned with `self_check: {passed, remaining, retried, note?}`. A provider failure on the retry keeps the first answer with a note. `tests/control-plane/writer-self-check.test.ts` |
| F43 | draft, revise | The writer set Krish's confidence. Piece 3's first draft was told to end with `How sure we are: [Krish to set]` and wrote `How sure we are: 78%.` on its own. The number is his judgement (his ruling, 2026-09-26: "I'd rather take a clearer stance than sit on the fence all the time and say 60%", and he sets it), and an engine-invented number could reach a reader as his stance. Nothing stopped a rewrite changing or dropping his number either. | piece 3, `POST /draft`, 2026-09-30. **Fixed 2026-09-30**: `guardConfidence` (`api/_selfCheck.ts`) runs after the model and any retry. A first draft says `How sure we are: [Krish to set]` whatever the model wrote; a rewrite keeps the source's confidence exactly, label and number, or the placeholder; a dropped line is put back at the end of the call. Found by the shared call reader (`labelledConfidences`, `callSectionOf`) as the fact gate finds it. The response says `self_check.confidence_restored: true`. `tests/control-plane/writer-self-check.test.ts` |
| F44 | revise, in place | Asked to delete one sentence ("Send it to buy a blender and it buys the blender."), a scoped revise returned piece 1 with the sentence before the selection twice: "Muse is Meta's AI helper that shops for people. Muse is Meta's AI helper that shops for people." The route spliced back whatever the model returned with `sourceText.replace(selection, answer)`, and it failed an empty answer as `empty_output`, so a deletion had no usable answer. The model echoed the sentence before the passage, and the splice put the echo where the passage had been (F2 again). Reproduced exactly: from v12's paragraph, the old splice handed that one sentence gives v13 byte for byte. | piece 1 v12 to v13, 2026-09-30. **Fixed 2026-09-30**: `passageReplacement` (`api/_selection.ts`) takes off whatever an answer repeats of the draft just before the passage (from a sentence start) or just after it (to a sentence end); `spliceSelection` replaces by slicing (a "$" in an answer is text), and an empty replacement deletes the passage, leaving one space or the paragraph break. An empty answer in place is a deletion, and the prompt says to return nothing to delete. `tests/control-plane/writer-self-check.test.ts` |
| F45 | self-check retry | Asked to fix a blocking rule, the retry swapped it for tells the checks cannot see. Piece 3's guess paragraph came back "Our guess: Salesforce marked its own test. Why? Because an independent test would likely show the same gap. The gap to GPT-5.5 and Claude Opus 4.8 that its own paper already shows.": a rhetorical question and a fragment. | piece 3, revise 2 (v3), 2026-09-30. **Fixed 2026-09-30**: the correction (`correctionFor`, `api/_selfCheck.ts`) says "Fix each one with plain, complete sentences. Add no question, no sentence fragment and no new fact." The paragraph was repaired by a revise scoped to it (v4). |
| F46 | publish checks (R7) | The reading age never ended a sentence that closes inside a quote mark or bracket (`...models." Tech Times reported`), so two sentences counted as one. Piece 3 quotes its sources word for word, and v6 read 13.5 and blocked; counted properly it reads about 13, a warning. The blocking message could also say "about age 13. Above 13 cannot be approved". | piece 3 v6, 2026-09-30. **Fixed 2026-09-30**: `readingGrade` (`api/_publishChecks.ts`) splits after a closing quote or bracket, and the blocking message gives the age to one decimal. Piece 1 v16 moves from 12.5 to 12 with it. |
| F47 | voice check (R2) | Two shapes of "Not X, Y" sat in piece 1 for a week without a flag: the subject said twice ("Shopify is not the supermarket. Shopify is the till.") and the verb said twice ("It doesn't care which shelf you picked things off. It cares that you're at the till."). A retry on piece 3 then wrote a third: "Koa doesn't need to beat Claude or GPT-5.5. It just needs to be cheap". | found by the session reading piece 1 after fact-gate run 2, 2026-09-30. **Fixed 2026-09-30**: two more shapes in `NOT_XY` (`api/_judges/deterministic.ts`). The subject shape needs a determiner on the negated side, so two plain facts about one thing ("The fee is not refundable. The fee is due on Monday.") pass. Every edition, fixture and draft rescanned: the new shapes hit only the piece 1 drafts that carried them. |
| F48 | fact gate | The web checker, and the reader of its quote, called a figure for one period a contradiction of a figure for another: Amazon's 2025 annual report ($68,635 million) against "over $70 billion in TTM revenue" (the twelve months to March 2026). The sentence named no year, so nothing told them the periods differed. | piece 1, run 3, 2026-09-30. **Fixed 2026-09-30**: `INDEPENDENT_SYSTEM` and `ENTAIL_SYSTEM` (`api/_factGate.ts`) say figures for different periods or scopes do not conflict, and a claim with no period is never assumed to share the evidence's. The piece's sentence now says "for 2025". |
| F49 | self-check retry | The reading-age correction lists the three longest sentences to shorten, and the prediction could be one of them. On piece 3 the retry rewrote the call into a different prediction ("one of SAP, Oracle or Workday will build its own AI model this way too"), added a "Not X, Y" (F47), and the route kept it because it broke fewer checks. | piece 3, revise 5, 2026-09-30. That answer was discarded, never saved. **Fixed 2026-09-30**: `longestSentences` (`api/_selfCheck.ts`) skips the call section. |
| F51 | fact gate, on file | A checker's passage that starts or stops inside a markdown link ("In Salesforce's CRM benchmark](https://...), a model benchmark") never matched the source word for word: the link stripper took whole links only. A true claim, the press release's own "three times fewer errors", was held on piece 3's run 5. | piece 3, run 5, 2026-09-30. **Fixed 2026-09-30**: `stripMarkdownLinks` (`api/_text.ts`) also drops the back half of a cut link and the opening bracket of one cut at the end. |
| F52 | fact gate | Runs do not converge on an opinion-heavy piece: the claim lister reads a different handful of commentary sentences as claims each run (piece 3, runs 1 to 6: 16, 7, 3, 4, 2, 3 blocking, almost all different sentences). | piece 3, 2026-09-30. **Fixed 2026-10-02** on Krish's answer ("Yes, or cut the opinion lines"): `carryForward` and `settle` (`api/_factGate.ts`) keep a sentence's pass or set-aside in `meta.fact_ledger` while its words and the sources are unchanged; a failed sentence is always checked again, and a change to the sources or the gate's version starts the ledger again. |
| F53 | CI, Windows | `tests/drive-discovery.test.ts`, first test in the file, timed out at 5 seconds on the Windows runner (c3a6e52); the re-run passed and the file runs in 2.3 seconds locally. The first test pays the file's cold start. | CI run 36725258056, 2026-09-30. **Not fixed.** Give the file's first test its own timeout, or warm the import in a `beforeAll`. |
| F54 | tests | `tests/control-plane/judge-failed-run.test.ts` ("a usage limit stops the pass at the first idea") hardcoded a provider reset of 2026-10-01 00:00 UTC and read the real clock. From that moment the reset was in the past, the walk fell back to its own retry time, and the test failed for every change. | full suite, 2026-10-02. **Fixed 2026-10-02**: that block fakes Date only, at 2026-09-28 12:00 UTC, the day its rows were written. |
| F55 | fact gate, spend | Article 1 changed two sentences after its last check, but the next run carried zero earlier findings and checked 21 claims again. The previous result predated the sentence ledger, so there was nothing safe to reuse, and the paid route had no preflight or hard scope ceiling. A status code could not reveal that before spend. | piece 1, run at 2026-10-03 22:26 UTC. **Fixed 2026-10-03**: `factLedgerCoverage` reports exact settled and fresh sentence counts without a model call; `GET /fact-check` exposes it; and `POST` accepts `max_fresh_sentences`, refusing with `rerun_scope` before any model or web call when a rerun is broader than approved. Piece 1's next run repaired all four lines together, reused 59 settled sentences, checked exactly four fresh sentences under that cap and passed with no blockers. Its post-run readback exposed two short scenario labels that fuzzy matching could never settle; exact short matches now settle, and a successful exact-version check fills deterministic ledger gaps without another paid call. The correction was pushed and the production deployment became ready on 2026-10-04. Article 1's live scope remained 61 reusable and 31 fresh sentences because its practical section changed the body after the earlier result; the correction is prospective and does not rewrite that older ledger. `tests/control-plane/fact-gate.test.ts`, `fact-check-provider.test.ts` |
| F50 | fact gate, on file | The on-file reader misread a flattened PDF table. It said Koa "exceeds Claude Opus" on Tau2Bench and BFCL; the paper's Table 1 has Koa below Opus 4.8 on both (69.41 against 74.00, 66.63 against 78.18) and below GPT-5.5 on all three overall scores. The gate failed closed (a contradiction the passage did not bear out became "not found"), so nothing false passed, but a true sentence was held. | piece 3, run 2, 2026-09-30, and again run 7, 2026-10-02 ("On CRM Bench, GPT-5.5 scored 0.90"). **Fixed in the prompt 2026-10-02**: `ON_FILE_SYSTEM` says how a flattened row maps to its header and asks for the whole row with the header line; code still confirms the row carries the claim's numbers. Filing tables one row a line would be stronger, but a change to the sources restarts the sentence ledger (F52). |
| F58 | video, outside the Studio | The two launch videos (the hello and Who gets paid) could not go through the Studio: it is read-only from a cloud session, its Drive Inbox is bound to a path the Drive clean-up had just moved, and neither video has a production brief. They were edited in the agent session instead, by a script that existed only for that session. Looking at preview frames found three faults a render log never shows: the tall version's face band cut off Krish's eyes, the captions read small, and the transcriber wrote "Chris" for "Krish". The first send of the finished files failed because chat uploads stop at 30 MiB. | 2026-10-05. Fixed: `scripts/quick-edit` (cuts by the words said, graphics placed by anchor words, `--plan`, `--share-mib`), with both videos' settings in `editions/2026-10-launch/video-kit/`. |
| F59 | channel copy | No step wrote what Krish pastes into YouTube Studio. `channel-cut` writes a spoken YouTube script and `_video.ts` a working title, but nothing writes the publish title and description. Krish's own title for Who gets paid ran to 112 characters against YouTube's cap of 100, and phones cut far sooner. | 2026-10-05, Krish: "whats a viral video title for this", then that it should become "a part of the durable engine". Fixed: the `package` step (H35). |
| F60 | pages | Pages and the Substack copy were built by hand in a scratch folder that dies with the session. The visual launch page crashed Substack's editor when pasted; a one-column copy with every image inline pasted cleanly (a clipboard test kept 7 images and 4 headings). | 2026-10-05, Krish: "Images copy fine, but it needs to all be in line otherwise Substack crashes". Fixed: `scripts/pages` and `scripts/channel-kit` (H36). |
| F61 | Ship, Control Center | When the fact gate refuses Ship (409, the text changed after its last check), Control Center shows it only as a brief pop-up, so Ship looks broken: Krish expected a Google Doc and got nothing he could read. | 2026-10-05, piece 1 (see Piece 1, "Krish's edits and the Ship button"). **Open**, control-center: the Ship dialog should say why in plain words and offer "Check the facts again". |
| F62 | publication address | The publication's address was written out in about 20 files across five repositories and five database rows, with no single source. When Krish moved Substack to `home.makeyourmindup.ai`, each had to be found and sorted into live address, Substack's own identifier (`mindmakerlive` stays in its API) and history. | 2026-10-05. Shipped the same night once Substack served the new address: content-engine `13dd2be`, AEO-Engine `58a2aa0`, makeyourmindup `f09652a`, control-center `4ff9089b` with migration `20261005220000` (applied and read back). Tracking keeps the old address as an alias. **Open**: the `mindmake` canon and `ai-harness` need Krish's yes. |
| F63 | Drive | The OS depends on Drive folders by path (the Studio's Video Engine Inbox, the KeePass file the runner reads), and nothing protects them: a clean-up session moved them on 2026-10-04 and broke both. | 2026-10-05. Krish was given the list of folders to put back (board item `you-drive-restore`). **Open**, control-center: list the path-bound folders in the architecture doc's Drive section so a clean-up reads it first. |
| F64 | artwork, Substack | Every place Substack shows a post's cover cut the launch cover (1200x630): the feed card on a phone (about 3:2, both sides), the archive tile (the centre square) and the share card (16:9). Images inside the article are never cropped, but on a phone they shrink to about 358 pixels wide, where the explainers' body text (28 to 30 px on a 1360 canvas) comes out at about 8 pixels. The artwork was designed for a desktop page and a share card, never for where readers see it. | 2026-10-05, Krish's phone screenshot of the feed, then: "Also bear in mind what happens to your artwork when I'm looking at the article in Substack once it's posted." Measured from the live post's image addresses. Fixed: a 3:2 cover whose words stay inside the box all three crops keep and read in a phone's feed, and a phone check for artwork (H37). Article 1's cover was rebuilt to pass both and sent to Krish; **open**: its three explainers still read small on a phone. |
| F65 | title, Substack | Article 1's Substack title runs to 122 characters, and the phone feed cuts it at about 95 ("...who actuall..."). The `package` step writes YouTube's title and description only. | 2026-10-05, the same screenshot. Fixed: the `package` step writes the Substack title and subtitle under the same rules (H38). |

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
- **"Check the facts" is built** (H18): the button and the facts to fix, in
  the composer. Still to come: the full table of every checked fact with its
  quote, and a way for Krish to rule on a dispute between two sources (on
  piece 2 Perplexity kept citing OpenAI's undated "we'll soon begin" against
  the dated release note; rewording settled it this time).

## 4. Open questions for Krish

- **Settled: how Shorts are branded** (Krish, 2026-09-26): "Make your mind
  up, Mark, plus the channel name. You've got the logos as per the website
  for all of that." The makeyourmindup mark plus the channel name in mono
  (`fixtures/feedback/studio-branding-mark-channel-20260926.json`). Where
  it sits was settled the same day (below).
- **Settled: The Fork** (Krish, 2026-09-26: "The Fork is good"), mind.the.gap's
  format (H27). **Settled: the lockup placement** ("placement approved"): the
  mark at the start of the timeline on every beat, the full lockup once at
  the end, no title card.
- **Piece 2 line edits: go** (Krish, 2026-09-26: "go on the edits"). Applied as
  his edit, with the fixes the fact gate asked for (F25, F26). Passed on run
  18: 40 facts, 18 confirmed by both checks, 22 word for word in a primary
  source; reading age about 11.5; ready for his approval. Beyond the redline
  he saw: two corrections the gate caught ("each request", a 2025 event told
  in the past tense), three claims now name their source (CNBC's price cut
  and definition of tokens, OpenAI's price list), and TechCrunch's own words
  ("a real-time router").
- **How steady should the fact gate be?** F25. Options range from re-asking a
  failed check once before it blocks (fewer false alarms, a little more
  risk) to leaving it strict (safe, but a correct piece can take several
  runs). His call, because it trades against zero tolerance.

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
| R6 | Plain words only: no word a reader has to interpret, whether technical jargon or our own coined labels, nicknames and shorthand. A term that cannot be avoided is explained in plain English where it first appears. | Krish, 2026-09-25, on piece 2's page: "We do say no jargon everywhere and I don't just mean technical jargon. I mean words that someone needs to interpret." (ledger `magic_rejected`, reason `invented_labels_need_interpreting`) | every piece and page | **Live**: `VOICE_GUARDRAILS` and the final pass (H15) |
| R7 | Reading age 12, with a huge sense of humour, fun and personality; the joke points at the hype, never the reader. | Krish, 2026-09-25: "This entire media channel needs to be radically simplistic with an average reading age of 12 and a huge sense of humour and fun and personality." | every piece | **Live**: `VOICE_GUARDRAILS` and the final pass (H15) |

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

**Drafting resumed, 2026-09-30 (fact gate loop).** The engine wrote every
version below; the session only chose what to ask for, and saved each answer
with `edit_source: 'magic'` and a `magic_accepted` event.

| Run | Body | Blocking | Contradicted | What the next rewrite fixed |
|---|---|---|---|---|
| 1 | v14 | 10 | 1 | The $68.6bn attribution, the Shop Pay line, labelled guesses, "Amazon has made no such claim about Muse" (contradicted: Amazon did say Muse broke its Conditions of Use) |
| 2 | v15 | 4 | 2 | "The next day" (dates stated), the Shop Pay fee (a web source says Shop Pay charges no fee of its own), a meta sentence, and two "Not X, Y" the detector had missed (F47) |
| 3 | v16 | 3 | 1 | The annual report's year (F48), "started blocking", "the till" marked as the story's picture |
| 4 | v17 | 4 | 1 | "Nothing to do with adverts" (true of Muse, false of the Perplexity case, so it now names Muse), the Shopify fee stated with the source's own condition (Shopify Payments), the second statement of the $68.6bn cut |
| 5 | v18 | **0** | 0 | **Passed.** Every blocking check on the approval list is green; reading age about 12, a warning |

Krish, 2026-10-02 (work board): the ruling note "Yes", as proposed: held if by
30 June 2027 Amazon publicly lets at least one outside company's shopping agent
buy on Amazon.com under its terms, and sponsored listings still show to it. On
the angle: "We need to dig further as Muse gets more usage", read as keep the
piece's angle, labelled as our guess, and follow it up as Muse's usage grows
(ledger sequences 129 and 130). Approval of the piece itself is still his.

v18 waited on Krish for the judging note and the angle. Against the caching bar,
piece 1 does not count: it took far more than one rewrite and more than two
gate runs.

**Approved, 2026-10-02.** Krish, in the session: "Piece 1 approved". Relayed at
10:58 UTC with `PATCH /api/content-ideas` (`state: 'approved'`,
`decided_by: 'Krish'`), which ran the fact gate and every blocking publish
check again on the exact v18 text and passed. The row carries
`meta.production_approval` (`approved_by: 'Krish'`, content revision hash
`7a83593a`), and the ledger has the `approved` event with `actor: 'Krish'` and
the idea panel's id (`d132d285`). That id was already settled by his decision of
2026-09-24 to write the piece, also `approved`, so the panel's nine rows in
`judge_calibration` now carry today's decision time with the same agreement;
the browser's approve button sends no panel id. Next is the Studio brief, which
needs his five-gate confirmation for this exact revision (`docs/STUDIO.md`,
"Switching it on").

**Practical-value correction, 2026-10-04.** After later fact repairs returned
the piece to review, Krish said its missing value was the implication for a
business leader or consumer: what business could be built, which features
matter, what to be wary of, and what a shopper should demand. This is an
Article 1 correction, not yet a general house rule. The exact revision adds
one section that makes a single commercial call: build the authorised front
door between agents and merchants. It names the likely customer, the metric,
the merchant and shopper controls, the trust features, the platform risk, and
the consumer test. The advice is identified as judgement rather than evidence.
Deterministic checks pass, including R2, the no-em-dash rule, plain words and
reading age about 12. The edit changed the article after its passing fact
check, so the piece remains in review. A free scope preview reports 61 reusable
sentences and 31 new sentences; no new paid check has run.

**Taste approval, 2026-10-04.** Krish read that exact revision and said,
"ok, happy with this article". The session appended his `approved` decision to
the edit ledger against the exact current body. The attempt to move the piece
to `approved` was correctly refused by the fact gate because the new section
postdates the last paid check. Authoritative readback still shows `review` and
no production approval. This preserves his taste decision without claiming a
truth clearance he did not give or spending on another run. The free preview
still reports 61 reusable sentences and 31 fresh sentences. Krish approved the
no-cost correction's push and the production deployment is ready. Production
readback stayed at 61 reusable and 31 fresh because this article changed after
the earlier result. The exact next gate is therefore one paid truth-check run
with a hard cap of 31 fresh sentences; it has not been approved or run.

**The launch version, 2026-10-05.** Krish picked article 1 to launch
makeyourmindup ("given it's the first one, it needs to be a really big-picture
piece") and asked for depth: "it doesn't really explain in plain english why
they get paid for different things and what those different things are, what
the incentives are for each company to make that decision, and where the
consumer or merchant could get stung". He agreed the plan of three visuals,
one per point a reader must grasp ("this is better ... happy with the 3"), and
"yes to the article too". The rewrite is 1,813 words at reading age 12.5. It
keeps his approved IF YOU ARE BUILDING and IF YOU ARE BUYING sections word for
word, and adds what each company is paid for, why each chose as it did, and
three sections on where a shopper, a Shopify merchant or an Amazon seller could
get stung. 36 verbatim source excerpts were attached as materials. Five paid
fact-check runs:

| Run | Blocking | Claims | What it held |
|---|---|---|---|
| 1 | 40 | 60 | A quote's date (it appears in two filings a year apart), "$68.6bn" without its year, a date for a Zuckerberg remark, and many claims with no excerpt filed yet |
| 2 | 19 | 60 | "Muse goes straight to the product", contradicted: Muse browses and shows listings. Claims backed on file but unclear on the web |
| 3 | 16 | 60 | Numbers not written the same way in any filed source, a court date missing from its excerpt, a UK paper not named as the CMA's |
| 4 | 6 | 60 | Plain-English restatements read as claims: "It gets paid when you pay", "put the shelf inside its own AI agent", "Tell Muse what to buy" |
| 5 | **0** | 59 | **Passed.** 52 sentences carried their earlier result (F52); every claim is verified twice or on file with a primary source |

Runs 1 to 4 were full runs: each came after new excerpts were attached, and a
changed materials hash empties the ledger. Run 5 attached nothing new.

**F56. The on-file reader passes a figure only when a filed source writes it
the same way.** Amazon's 10-K says advertising was 68,635 (in millions); the
sentence says $68.6 billion. That sentence passed on the web check alone, and a
second one carrying "$56.2 billion in 2024" blocked, so it was cut. The same
literal reading blocks a summary line that restates a source in plain words,
unless it reads as an analogy ("Shopify is the till") or is labelled "Our read".
The fixes that worked were quoting the company's own words ("automate
deal-finding, cart-building, and routine purchases") and moving a summary into
an analogy. Proposal for Krish, not built: the write stage quotes a source's
own words for every fact and keeps plain-English summaries as analogies or
labelled reads, so the first run is not the most expensive.

The three visuals follow the live VISUAL_EXPLAINS rule: one company needs you
to look and the other needs you to pay (Amazon and Shopify's 2025 money), the
same request sent to Amazon's AI agent and to Meta's Muse, and who pays when an
AI agent gets it wrong. They carry the companies' public logos. A launch post,
a LinkedIn post and card, a Substack social image and a 60-second video script
were written to go with the piece, and none of them is published. The piece is
in `review`; locking it is Krish's, in Control Center.

**Krish's edits and the Ship button, 2026-10-05.** Krish rewrote the opening in
Control Center and pressed Ship. No Google Doc appeared: `save-draft` answered
409 twice, because the fact gate refuses any text that changed after its last
check, and Control Center showed that only as a brief pop-up. Three of his
lines were fixed before the re-check, and he was told why: `Amazon's "not a
human" warning popup` quoted words the popup never used (it says "unauthorized
AI agent"), "The intensity has continued to increase" did not say what
increased, and "Why?" was the hook-then-question pattern the final review
flags. The re-check then held "recent" (the quote is from Amazon's November
2025 complaint) and "Meanwhile" (the web check could not confirm the launch
sentence, which had passed in the morning without it), so both sentences went
back to the exact words that had passed.

**F57. A long piece was blocked for its length.** The deeper article lists 67
claims. A run checked the first 60 and counted the other 7 as failures, on
every run, whatever passed. The cap exists because a full first pass of 60
takes about four and a half minutes against the route's 300-second limit.
Fixed by `splitFresh`: settled sentences are carried free (F52), the cap
applies only to new claims, and the claims over it are reported as `unchecked`
and wait for the next run, where everything this run passed is carried. The
gate's refusal says "N claims are still to check" instead of "failed".

Krish, the same day, on how he wants to work while the engine is being built:
"I would rather work in here and have the pieces and their artwork produced in
html and assets like we are doing now - control center editing feeling super
fiddly to me right now while we are building the engine". Pieces and their
artwork are now produced in the agent session as branded HTML and image files;
Control Center stays the record for locking and publishing.

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


**Where it stands (2026-09-25, late).** Now "Who picks your AI?". v2 carried
my own errors (F16, F17); v4 is the plain-words version (R6, R7), in date
order, and passed the fact gate on run 10 (H14). Its web edition is in
`editions/2026-09-who-picks-your-ai/` beside the exact text that passed (H19).
The piece is in `drafting`. Waiting on Krish: the prediction's confidence and
his verdict on the page.

## Piece 3: under.the.hood

`5255dcd8-3772-420d-994c-6bf2ab5f06e3`. Salesforce's Koa
split. No judge at 8; lowest model judge `novelty` at 6.


**Drafted 2026-09-30, after the provider came back.** Research and the eight
verbatim filings are from 2026-09-28. The first draft read at about 13.5,
broke R2 three times and set Krish's confidence to 78% on its own (F42, F43).

| Run | Body | Blocking | Contradicted | What the next rewrite fixed |
|---|---|---|---|---|
| 1 | v2 | 16 | 2 | The "27 years" framing, the pizza lines read as facts, "trained a new model", the frontier-model definition, and "three AIs" (the paper says one helper model played three roles) |
| 2 | v5 | 7 | 1 | "Third out of three" (the checker counted five models), the pizza analogy labelled, the recap paragraph, and a claim about what the paper does not say, cut because a gate cannot check an absence |
| 3 | v6 | 3 | 0 | "Tells a different story", "on CRM Bench", and the hosting claim put on the press release where it lives |
| 4 | v7 | 4 | 1 | "Behind both of them" named ("GPT-5.5 and Claude Opus 4.8"), "built to make you picture" labelled as our read, the guess paragraph's repeat of a checked fact folded into the guess, a sentence with no clear referent cut |
| 5 | v8 | 2 | 0 | Held, both true: "On CRM Bench, GPT-5.5 scored 0.90" (the on-file reader confused two columns of Table 1, F50), and the press release's "three times fewer errors" (a passage quoted from inside a link, F51) |

Run 5 was the cap this session set itself. The engine refuses review while a
claim is held (409 `fact_gate`), and both holds were gate faults, one then
fixed. So piece 3 got one more run on unchanged text once F51 was live, over
the cap:

| Run | Body | Blocking | Contradicted | What happened |
|---|---|---|---|---|
| 6 | v8 | 3 | 1 | Both run 5 holds passed (F51 works). Three new ones: "Koa sits behind GPT-5.5 and Claude Opus 4.8" (true by Table 1; the web checker called its own missing data a contradiction), "marked its own test" (a metaphor read as a claim), and "runs its own model on its own machines", a real overstatement: Salesforce hosts its models on AWS inside its trust boundary, and its release says "within its own infrastructure" |

v9 fixes the overstatement and the metaphor through one exact engine rewrite,
and stops there. Each run reads a different handful of commentary sentences as
claims, so on a teardown this opinionated rewording alone does not converge.
**Proposal for Krish (F52):** a sentence whose text and filed sources are
unchanged keeps the verdict it earned on an earlier run, so each run checks
only what changed and what failed. Krish, 2026-10-02: "Yes, or cut the
opinion lines". Built the same day.

| Run | Body | Blocking | Contradicted | What happened |
|---|---|---|---|---|
| 7 | v11 | 4 | 0 | The first run with the sentence ledger (F52), so a full check that settled 44 sentences (29 passed, 15 set aside). Held: the table's GPT-5.5 score (F50 again), "anyone can see it, change it" (a paraphrase of Nvidia's definition read as a licence claim), and the pizza line read as two claims. v12 rewrote the last two through the engine and the on-file reader learned flattened tables (`44d9d97`) |
| 8 | v12 | **0** | 0 | **Passed.** 30 sentences carried their earlier result; only the 2 changed or held sentences were checked, both verified. Every blocking check on the approval list is green. Warnings: reading age about 12.4, 55% "reads as sitting on the fence", two words to explain (both inside quotes) |

Piece 3 moved to `review` on 2026-10-02. Approving it is Krish's.

**Krish's calls, 2026-10-02 (work board):** the prediction wording "Yes", his
confidence 55% ("Yes, 55%. And vary it up"), and the channel "Keep"
(under.the.hood). The three sentences that opened "Here's" were varied by one
exact engine rewrite (v10), and his 55% set (v11). Ledger sequences 131 to 133.

- v3's guess paragraph was garbled by the self-check retry (F45) and repaired
  by a revise scoped to it (v4).
- v5 is the session's one hand edit: "How sure we are: 78%." back to
  "How sure we are: [Krish to set]", undoing F43. The confidence is his.
- Revise 5's first answer was discarded: the retry rewrote the prediction
  (F49). Rerun on the fixed engine, it came back exactly as asked, with no
  retry (v7).
- The THEATRE stamp on "matches or exceeds" was checked against the full
  Table 1 after run 2: Koa is below GPT-5.5 and Claude Opus 4.8 on all three
  overall scores, so the stamp stands.

Against the caching bar, piece 3 does not count: several rewrites and a hand
edit.

**Before it ships on Wednesday 2026-10-07.** under.the.hood now runs on
Wednesdays, so piece 3 is Wednesday's post. It is `approved` (Krish, on
the work board, 2026-10-03) with the fact check passed and
the call set ("By 30 September 2027", "How sure we are: 55%."). Three things
to settle with Krish first:

- The final pass, before his approval, said the piece "argues a piece it
  half-titled": the title promises the AIforce and ClaudeForce fork and the
  body covers only Koa, and the reader's question (what do I build
  differently) is implied rather than answered. It also flagged a US-only
  line. Krish approved without those changes; ask whether he wants them.
- Four house rules arrived after his approval: CRYSTAL_CLEAR and
  RELATABLE_EXPLANATION (2026-10-03), REAL_LIFE and AI_AGENT (2026-10-05).
  The body never says "robot". Read it against the other three.
- It has none of its launch set yet: the branded page and Substack copy
  (`scripts/pages`), visuals that each explain one key point (VISUAL_EXPLAINS),
  the video script, the YouTube title and description (`package`), and the
  LinkedIn post. Any change to the body needs the fact check run again before
  Ship (F61).
