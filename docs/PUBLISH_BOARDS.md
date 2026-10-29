# Publish boards: the web workflow

Krish's 19 October 2026 ruling: both weeks remain available at
`https://content.krishraja.com`, with separate overarching week tabs. The web
board becomes the sole place for new interactions after verified migration.
The four Claude artifacts and the default artifact generator remain preserved;
there is no ongoing synchronization with them after cutover.

## The fixed layout: feed it, never shape it

Krish, 2026-10-21: "the rest of the content engine needs to know how to feed it
and not be permitted to change random parts of the UI and UX but feed it in the
right way consistently. That applies to Claude and to Codex." From the week of
26 October 2026 (`config/board-layout.json`, `layout_from`) every board has one
layout, the same every week:

- **Five tabs, in this order:** Ideas, Queue, Monday, Wednesday, Friday. On a
  phone they are a bar at the bottom.
- **Layout v3, from the week of 9 November 2026** (`config/board-layout.json` `v3`; Krish, 2026-10-28: "backfill every
  piece we've done historically, and allow me to add a score out of 10 for narrative quality and production quality"):
  a sixth tab, **Archive**, last, with every piece from the Launch on 6 October (date, series, title, live links and
  his two scores, newest first, each with a Scores press), a Scores press on each made day's Publish step, and the
  `recording_sunday` rhythm: the board for week W is recorded on Sunday W-8 and goes live Monday W, so every day's
  brief and scripts are due on that Sunday. Earlier boards keep version 2. Feed it with
  `python3 scripts/post-pack/board_feed.py archive <Monday>` (read-only, `GET /api/board/<Monday>/archive`) and
  build with `--archive docs/plans/<Monday>-week/archive.json`.
- **Four steps in every day, in this order:** Brief, Drafts, Record, Publish.
  A step with nothing yet says when it fills, from the layout's `rhythm`: every
  day's brief on the Sunday morning and its scripts by Sunday midday, because
  Sunday is his recording day (Krish, 2026-10-24: "Yes, Sunday is my recording
  day").

**Who builds a board, and when** (Ruling, Krish, 2026-10-29: "FYI, I want zero
Claude routines. No Claude schedules of any kind in this architecture"; then
"Could you not get Github to trigger Claude subscription to do something and
then update the content.krishraja.com board?"). No Claude routine builds a
board. The Sunday ideas board is `.github/workflows/sunday-ideas.yml`: Claude
Code inside a GitHub Actions job on his subscription (`CLAUDE_CODE_OAUTH_TOKEN`,
never an API key), fired early on Saturday, idempotent for the week, and
startable by hand. The Monday final board is built by code (`week_board.py`)
from the overnight runner (Wave 2; until then the first session on Monday),
never by Claude on a timer. Every
other build is a session he started or a `make-piece.yml` run for a piece he
signed. All of them write through the engine API (`ENGINE_OPERATOR_TOKEN`),
by the same inputs below.

A session feeds the slots and nothing else:

| Step | What feeds it | Input |
|---|---|---|
| Ideas | his five presses on every idea and the Off days ("His presses", below), then the week's checked ideas, each with `source_kind` (`his`, `inspo` or `engine`, required from the fixed layout on, shown as its chip), `why_here` (the nearest idea he liked, from the gather), `beats` (3 to 5 lines of the sketch), `covers` (the gather's `must_cover` ids it answers) and `style` (a script format, a production format and one experiment from `config/style-references.json` `formats`, shown as "Suggested style" and "Or try something new"); `accounted` in the file gives the reason for any `must_cover` id no idea carries. The build refuses a fixed week without `sources.json` beside it, a routed card left off, or styles that do not diverge (`board_feed.py cover <Monday>`). ideas.json `offdays` (`{"tue": [...], "thu": [...], "sat": [...], "sun": [...]}`, 2 to 3 options a day given, each `{id?, format, source, copy, covers?}`, `source` a line or `{label, url}`; an off-day piece he records adds `kind: "recorded"`, `style`, `series`, `piece_id`, `title`, `script` and `read_back`, shown with its whole script, `.agents/skills/plan-week/references/offdays.md`) feeds the Off days; Growth's Sunday Off-days section (`growth.py mix offdays`, schema `growth-offdays/1`, W2.9) feeds the days ideas.json leaves out, 2 to 3 options a day with its share line and what each still needs, on any day of the week (Krish, 2026-10-29: "Mix wins: every day"; a piece he records stays a Tuesday, Thursday, Saturday or Sunday piece) | `--ideas ideas.json` (plan-week, from `board_feed.py gather`); `--offdays-plan offdays.json` (Growth) |
| Queue | the idea queue | `--queue queue.json` (GET /api/idea-queue) |
| Queue: Could combine | two to five queued ideas that make one bigger piece: `[{"members": [queued ids], "series", "thesis", "joins": [3 to 5 beats]}]`, each a card with a Combine button that saves `queue/combine-<n>`; the next session runs synthesize on his tap (decided_by Krish) | `--combine combine.json` (with `--queue`; groups from GET /api/idea-queue?combine=1) |
| Brief | the record-ready brief: idea, 3 to 6 beats, ending, takeaway, angle, tone, reader | `--brief DAY=brief.json` (kept on rebuild) |
| Drafts | the article and scripts in review: a read view (Markdown drawn, no `#` signs) where a tap edits a paragraph, picked words take "Comment on this" (the comment carries `box`, `paragraph` and `quote`), and one Save bar per day saves `edits/<day>-<item>` (`text`, `day`, `item`, `base_sha256`, `at`) | `--draft DAY --review DAY=...` |
| Drafts: Also changed | where his saved edit was carried (`scripts/post-pack/edit_sweep.py`): each change with Undo, suggestions with Change it too, recorded scripts left alone, and the gates run again; kept on a rebuild while that day's words are unchanged | `--sweep DAY=sweep.json` (the file edit_sweep.py writes) |
| Drafts: What I learned from your edits | the compiler's proposals from his board edits (scope `board_edit:<class>`), and up to three a week from the taste ledger (scope `taste:<layer or lane>`, from what he saved and said), each with the venture it is for (none named is Make Your Mind Up's) and Make it a rule and Not a rule; a comment on one is his rewording; it stays a proposal until he says yes | `--lessons lessons.json` (GET /api/video-studio/learning-proposals) |
| Drafts: Approve scripts | under the drafts, when a day's drafts hold its scripts (a label that says script and names its cut, as `story_check.cut_of` reads it): the press that sends them to Teleprompter | the `--review` boxes; `--teleprompter` names their folder and titles when the record holds them, else `--pending` or the brief names the subject |
| Record | the Teleprompter scripts and the scripts to read, then Titles: his pick on each surface | `--teleprompter`, the publish page's scripts; `--titles DAY=titles.json` (`{"piece_id"?, "long_title": [...], "short_title": [...], "long_thumbnail": [...], "short_thumbnail": [...]}`, 1 to 5 options a surface, best first; kept on rebuild) |
| Publish | a made day's run-sheet (below): the day's progress, Download first (each ready file with Reject), Approve for publish, then one card per place to post, each with its tick | the publish page (`--day`, read as data), the videos and the pack folder on the record, `--materials DAY=...`, `--publish-manifest DAY=PATH` (its sha256 rides on Approve for publish; kept on rebuild) |
| Heading | what waits on Krish | `--waiting DAY=...` |

Never add a section, a banner, a style or a script to a built board, and never
patch its HTML: `week_board.verify()` refuses any other shape (one stylesheet,
each day exactly its heading, its steps and their panels), and
`npm run check:board-layout` (in `npm run verify` and CI, so Codex too) holds
the build to `fixtures/week-board/fixed-layout.json`, checks every view at
390px for sideways scroll and 44px targets (`--browser`), and fails any file
outside the board's builders that stamps a board. A change to the layout
itself is Krish's, and there are no approval prompts for board edits: the
layout is held by CI and changes only with his recorded words (Ruling, Krish,
2026-10-21). The snapshot records the sha256 of `config/board-layout.json` and
`scripts/post-pack/tokens.css`, the structure of three fed weeks, and
`approved`, the words he approved the last change in. The check fails when
either file or the structure differs, until
`python3 scripts/check_board_layout.py --update --approved "Krish, YYYY-MM-DD: <his exact words>"`
writes the change with his words.

### His presses

Krish, 2026-10-28, asked where he presses and approves: "Publish board". On the
Ideas tab: "pick an idea for a specific day AND add any optional comments
easily, which can be saved, or I can: mark an idea as being useful in a future
wider piece OR mark it as being an idea that should be stored for a future trend
OR queue it for next week OR reject it", and of the off days, "I'm happy to plan
the Tuesday, Thursday, Saturday, and Sunday content within the Sunday ideas
session if you give me a few options to approve as you do the Mon/wed/fri". On
the day tabs: "Once I approve, the two scripts will go to teleprompter" and
"Server sends directly"; titles are a "Sunday evening press"; go-live is
"Approve each day Monday".

Every press saves at once into a store `board_documents` already takes, so no
migration was needed. Only the access-cookie actor (Krish) writes them: the
board refuses any other writer with `pick_note_is_his`, `press_is_his` or
`decision_is_his` (`apps/control-plane/api/board/_contracts.ts`
`hisOnlyRefusal`), and refuses any other writer a `picks` or `queue` document
he saved, whatever the new body carries, with `his_document`
(`apps/control-plane/api/board/_handler.ts`). A session reads them and never
writes them; a document whose `updated_by` is not Krish is never his.

| Press | Where | Writes | What the server does | Who reads it |
|---|---|---|---|---|
| Pick for the day, with a note | Ideas, the pick box | `picks/<day>` `{pick, idea_id, series, story, day, at, note?}` | nothing new | plan-week: the pick reaches its piece; the note is his words for the brief |
| Wider piece | Ideas | `queue/<pick>` `{use: "wider_piece_context", note?}` | nothing | the Inspiration House cue run reads it from the board (`src/collect/feedbackCues.ts`, documents Krish wrote) and files a `wider_piece_context` cue, his note as said (a theme when he named one); plan-week reads the cue. Never relayed to the idea queue |
| Future trend | Ideas | `queue/<pick>` `{use: "track_over_time", note?}` | nothing | the cue run files a `track_over_time` cue; plan-week reads it. Never relayed to the idea queue |
| Next week | Ideas | `queue/<pick>` `{use: "next_week", target_week: <the Monday after>, queued: true, note?}` | nothing | plan-week relays it to the idea queue (`action: queue`, no verdict) and offers it first on the day it fits the week of `target_week`; the cue run files a `future_piece` cue |
| Reject | Ideas | `queue/<pick>` `{use: "not_for_us", reason}`; the reason is required (the board asks for it before it saves) | nothing: no rejection inbox row, since an idea is a subject and the rejection floor holds rules of form and process only | the cue run files a `not_for_us` cue, his reason as said, so the idea is never offered again. Never relayed to the idea queue |
| Take a press back | Ideas, the same press again | `queue/<pick>` `{use: null}` | nothing | nothing reads it as a press |
| Approve or Skip an off-day option | Ideas, Off days (any day of the week) | `queue/off-<day>-<option>` `{use: "offday", day, approved, copy_sha256, format, source, option_id}` | nothing | Growth makes and schedules what he approved, only while `copy_sha256` is the copy it holds |
| Approve or Skip an off-day piece he records (Ruling, Krish, 2026-10-29) | Ideas, Off days | the same, with `kind: "recorded"`, `piece_id`, `series`, `style`, `script` (the exact words he saw), `script_sha256` (worked out by the server), `folder_title`, `title`, `readers` | the server puts the piece on that day in its series, in flight, one short cut (`placeOffday`), sends the words to Teleprompter with his press as the approval and records the send; a Skip after an Approve takes it off the day unless recorded | the board shows what the send did (`send`); the recordings lane then waits for his short take |
| Approve scripts | Drafts | `picks/<day>-scripts` `{kind: "approve_scripts", day, piece_id, approved, texts: {cut: words}, scripts: {cut: sha256}, titles: {cut}, folder_title, folder_id?, script_ids?}` | works out `scripts` from `texts` (refused as `approval_hash_mismatch` when the press brings others); sends only words the piece's making record shows the scripts' check passed and two fresh readers read back (the gate `teleprompter_send.py plan` holds a session to), else holds them; sends with `sendApprovedScripts`, writes a send that read back to the piece's making record, and writes its answer into the same document as `send` `{status: sent, held, no_key, refused or error, folder_id?, scripts?, error?, recorded?, record_error?, at, by}` | `teleprompter_send.py plan` (the `approvals` view); on `held`, `no_key`, `refused` or `error` a session checks the words if they need it, then sends exactly those words through the connector; on `sent` with `recorded: false` a session records it with `teleprompter_send.py record` and the ids in `send` |
| Titles | Record | `picks/<day>-titles` `{kind: "titles", day, piece_id?, picks: {long_title?, short_title?, long_thumbnail?, short_thumbnail?}}` | nothing | produce-video's Sunday-night run and the title round (the `titles` view) |
| Approve for publish | Publish, after Download first | `picks/<day>-publish` `{kind: "approve_publish", day, piece_id, approved, manifest_sha256?}` | nothing on the server | `piece_manifest.py seal` (W2.8): only this press, bound to the draft manifest's sha256, seals `0 Publish/manifest.json` for Growth, whose go-live dispatch then names it with every slot `per_item_review` (one decision per post). Growth and Control Center read the go-live. It holds no fact sign-off: a go-live reader must also require the article's fact sign-off for the piece (the Article press, not built yet, and the fact gate), so a day never counts as approved with its facts unsigned |
| Scores (layout v3) | Publish, last on a made day; and each Archive row | `picks/score-<piece>` `{kind: "scores", piece_id, narrative, production, basis: at_publish or hindsight, note?}`, each mark 1 to 10 | one `piece_scores` row, `scored_by` krish, history kept (a new score is a new row; the same marks saved again file nothing twice); answers `scores: filed`, or `waits_on_migration` until the Wave 2 migration batch is applied | the Archive, Control Center's #/week and the retrospective (W3.6), through `piece_scores_current`, which counts his scores only |
| Reject asset | Publish, beside each ready file | `picks/<day>-reject-<asset>` `{kind: "reject_asset", day, piece_id, asset, label, reason, drive_id?, at_ms?, formats?}`; the reason is required | one `taste_rejection_inbox` row: his reason, where and when, the piece, the formats, and the file's Drive id with the moment (`at_ms`) or as the whole cut; the file itself is never copied | the inspirationhouse rejections job; the next session's repair round |

Only a rejected asset files an inbox row. Each row's `client_report_id` is the
hash of the week, the document and his words, so a press saved again files
nothing twice. A row that the inbox could not take is said on the board, and
the board document still holds his reason for a session to file.

Each Approve scripts press writes its document twice: his save, then the
server's, which adds `send`. `board_history` names Krish for both, because the approval must stay a document he wrote for
`teleprompter_send.py` to count it; `send.by` ("content-engine server") marks
the server's revision. A held send is not an error: his edited words, or words
the scripts' check has not passed or no fresh readers heard, wait for a session
to check them, and nothing reaches Teleprompter before that.

`GET /api/board/<Monday>/approvals` and `/titles` (`board_web.py read <Monday>
approvals`) are read-only views of the `picks` documents of that kind; nothing
writes to a view. A press the build cannot draw is left out with a warning
(two drafts naming one cut, or no subject for the Teleprompter names), never
drawn half.

Sunday's sources: `python3 scripts/post-pack/board_feed.py gather <Monday>`
reads `GET /api/week/options?include=sources` and `GET /api/idea-queue?combine=1`
(read-only, no spend) into `docs/plans/<Monday>-week/sources.json`: each
series' pool, his ideas first, then near something he liked, then the ladder
score, each with `source_kind` and `why_here`, the queue and its combine groups,
and which source is empty and why. His ideas are `manual` rows (his words
through Control Center's one door) and topics he asked the engine to research
in Control Center (`requested_research` with `requested_by: Krish`); board items
that relay his words (`krish-ideas-*`, `said-*`) come as `his_relayed`. His
Inspiration House comes as `inspiration` (`_inspirationSources.ts`): the cards
he routed to Make a piece, the cards he answered, the ones he has not seen yet,
the production references he routed to Study style, content-watcher readings,
creator moves and taste claims; `must_cover` lists every routed card and
relayed board item the Ideas tab owes him. The gather stops when the route has
no `inspiration` block. His taste steers this sourcing and ranking only; the
judges stay blind.

One-off feeders are history: a script under `docs/` that drives `week_board.py`
or `board_web.py` is refused by `npm run check:board-layout`; the fifteen that
existed on 24 October are frozen (`FEEDERS`).

Videos: every piece is a 90-second and a 5-minute video. A 15-minute feature
appears as a third cut only on a piece Krish called one for
(`config/features.json`, house rule FEATURE).

### The Publish run-sheet

Krish, 2026-10-21: "have a think about where I publish, how I publish, what I
need to download, when, and in what order. Just make everything as beautiful
and user-friendly as possible." So in the fixed layout a made day's Publish step
is one ordered run-sheet (`week_board.py` `run_sheet`), drawn from data and the
same every week:

1. **The checklist** at the top: the day's meter and count, and each step that
   counts toward 100% as a link that shows its tick (the two recordings point to
   Record, where their ticks are).
2. **Download first**: every file for the day, numbered in the order he uses
   them, each with one big Download: the 5-minute and 90-second videos, then
   their thumbnails (Drive links from the making record's `video_assets`), the
   Substack cover, the vertical cover, the covers for the other places, the
   Spotify thumbnail when it is its own file, the article as an HTML file, the
   pictures in the article, then the `--materials` files and copy. Download all
   saves every file the page holds; the videos come from Drive one tap each, and
   the line under it names the post's library folder
   (`3 Posts/<post folder>`, from the record's `pack.folder` or a video's path)
   to download everything at once.
3. **One card per place to post**, in `config/board-layout.json`
   `publish_steps` order (Substack, YouTube, Shorts, TikTok, Reels), then LinkedIn,
   Spotify and, on a feature piece, the feature under "When you want them". Every
   card has the same parts in the same order: the files it needs (links back to
   Download first), each piece of copy with one-tap Copy, what to do, the link box
   where the step has one (the article on Substack, the video on YouTube), and its
   tick. The tick ids are unchanged (`<day>-<step>`), so no saved tick is orphaned.
   On a feature piece only (Krish, 2026-10-21: "Yes, add the cards"), two cards more, not counted: "YouTube long-form (the 15-minute feature)" right after the YouTube card and "Spotify (the 15-minute feature)" right after Spotify, ticks `<day>-feature-youtube` and `<day>-feature-spotify` (recorded as `making.py <piece> posted feature_youtube|feature_spotify`); `verify()` and `check_page` refuse them on any other piece.

The words, the files and what to do come from `publish_kit.steps(words,
on_board=True)` on the publish page's own words, which `publish_manager.py`
writes into every page as data (`<script type="application/json" id="pm-data">`:
the words and each picture's role). The pictures and the copy are the page's,
under the ids they always had (`mon-c3`, `mon-img-cover`, `mon-art`), so a saved
comment and a `copy_updates` refresh still find their box. A page made before it
carried its words still draws, with a warning, and names the standing files.
The old section ticks, the contents bar and the separate Finished videos card are
gone from fixed weeks; weeks before 26 October keep their markup byte for byte.
`verify()` refuses a made day whose Publish step has no Download first, has it
below a card, has a card out of order or without its own one tick, or has a tick
outside a card, and still refuses a picture with no bytes or link and a finished
video without its Drive link or its thumbnail's.

## Finished files while editorial review remains open

Use `week_board.py --materials DAY=materials.json` for finished downloads and
channel copy. The JSON names the exact piece, an explicit `review` or `ready`
status, its readiness note, and sections containing labelled files and copy.
This does not mark a draft day made, complete a making step, or clear a fact
gate. A normal rebuild carries these materials from `--previous`; do not lose
them when refreshing the article. Existing copy boxes can be refreshed by
stable ID with `copy_updates`, retaining their comment anchors.

Resolve every download into the immutable web manifest. Activate with
`board_web.py publish-web PAGE --assets MAP --expected-build BUILD_ID --apply`
so a concurrent board publication causes a refusal instead of overwriting it.
Material availability is distinct from permission to publish on a channel.

## Read before every session that touches a week

Check `config/boards.json` → `web_cutover.state`. `pending` means the historical
import and production acceptance are not yet complete. Do not claim otherwise.
`active` means use the web instructions here instead of any older ArtifactData,
ArtifactComments, or dual-account board instructions elsewhere in the repo.

For the current week and any unfinished previous week, read **all six** stores:

```
python scripts/post-pack/board_web.py read 2026-10-19 ticks
python scripts/post-pack/board_web.py read 2026-10-19 links
python scripts/post-pack/board_web.py read 2026-10-19 edits
python scripts/post-pack/board_web.py read 2026-10-19 picks
python scripts/post-pack/board_web.py read 2026-10-19 queue
python scripts/post-pack/board_web.py read 2026-10-19 comments
```

`approvals` and `titles` read his Approve scripts and Titles presses alone;
`picks` holds them too, beside his day picks ("His presses", above).

Substitute the actual Monday. The CLI follows every page. Failed or inaccessible
reads are blockers, never empty feedback. Access uses the existing engine operator
credential; do not paste it into a prompt, file, generated HTML or command line.

- Ticks retain the existing IDs and bodies. Copy completed publishing actions to
  the piece with the existing `making.py PIECE posted CHANNEL [url]` rules and
  actor attribution. `done: false` never deletes an existing making record.
- Links provide the actual published destinations; do not infer publication from
  a download or from a completed build.
- Edits are Krish's saved words. Apply them to source drafts before rebuilding,
  preserving the built-at guard against older saves covering newer built text.
  Tell him before changing a script he has recorded.
- Picks supply his day/idea choices, with his note; use the existing
  week-options workflow. `picks/<day>-<decision>` documents (a `kind`) are his
  decisions on a day's tab, never a pick.
- Queue decisions supply his presses (`use`, with his note or reason) or, on
  weeks before the fixed layout, his verdict, reason and angle; use the existing
  idea-queue and feedback-cue workflows and attribution. Never invent his
  decision.
- Comments include roots and replies with stable anchors. Read the whole thread,
  retain original metadata and distinguish notes from authorization to publish.

## Update a board

Fetch the authenticated `/board/WEEK` HTML into a local file for `--previous`;
do not print the full board into a conversation. The operator CLI's `download`
command saves this file. Read `week_board.py --show FILE` for its structure.
Keep completed days, current drafts, review IDs, images and every unchanged
asset. Use the existing `--live`, draft/review and completeness guards.
When changing only one day while another day has live draft words, use
`--keep-draft DAY` with the authenticated `--previous` page. It carries that
unrelated draft panel, its review boxes and waiting calls verbatim; the builder
refuses a changed piece id or any replacement inputs for the retained day.
Rebuild that day with `--draft DAY --review DAY=...` when its own words change.

Build with `week_board.py --target web` plus the usual week/day inputs. Run
`--verify`, then `board_web.py publish-web PAGE.html` for the dry-run manifest.
Provide `--assets FILE.json` for existing direct downloads. After the applicable
publication authorization, use `--apply`. Assets and HTML upload directly into
private storage; activation verifies hashes and sizes. Read the active build and
the rendered page back. A board update does not authorize social publication,
a paid fact check, video production, or replacement of signed-off content.

For a kept download already in the active manifest, a mapping may use
`{"id":"drive-ID","source_url":"the exact generated URL","existing_sha256":"the verified SHA-256"}`
instead of `path`. The publisher checks the current manifest before reusing it,
retains the revision for activation, and uploads only changed files. A missing or
changed digest stops the update. This preserves other days' verified media while
replacing one cut; it does not infer that an unverified Drive file is safe to use.

Register each new Monday under `config/boards.json.web`. The authenticated weeks
endpoint supplies navigation from activated builds. `/` and `/board` open the
latest week; dated links preserve login return paths. Earlier builds remain
retrievable, and `board_web.py rollback WEEK BUILD_ID --apply` changes only the
selected build, never newer interaction data.

## Compatibility and cutover

`config/boards.json.weeks` retains the original artifact addresses for source
provenance and explicit legacy builds. Artifact mode remains the generator's
default for compatibility, so live board workflows must pass `--target web`.
After active cutover, do not create a new Claude weekly board or synchronize old
copies. The artifact synchronization hook reports the web destination instead.

Migration inventory, final delta, conflict resolution, deployment order and
rollback evidence live in `docs/handovers/board-web-release.md`. Friday 16 October's
two repaired videos remain separate work and must not be replaced by this move.
