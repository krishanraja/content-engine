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
- **Four steps in every day, in this order:** Brief, Drafts, Record, Publish.
  A step with nothing yet says when it fills (the brief by the night before,
  the drafts by the morning of the day, from the layout's `rhythm`).

A session feeds the slots and nothing else:

| Step | What feeds it | Input |
|---|---|---|
| Ideas | the week's checked ideas, each with `source_kind` (`his`, `inspo` or `engine`, required from the fixed layout on, shown as its chip), `why_here` (the nearest idea he liked, from the gather) and `beats` (3 to 5 lines of the sketch) | `--ideas ideas.json` (plan-week, from `board_feed.py gather`) |
| Queue | the idea queue | `--queue queue.json` (GET /api/idea-queue) |
| Queue: Could combine | two to five queued ideas that make one bigger piece: `[{"members": [queued ids], "series", "thesis", "joins": [3 to 5 beats]}]`, each a card with a Combine button that saves `queue/combine-<n>`; the next session runs synthesize on his tap (decided_by Krish) | `--combine combine.json` (with `--queue`; groups from GET /api/idea-queue?combine=1) |
| Brief | the record-ready brief: idea, 3 to 6 beats, ending, takeaway, angle, tone, reader | `--brief DAY=brief.json` (kept on rebuild) |
| Drafts | the article and scripts in review: a read view (Markdown drawn, no `#` signs) where a tap edits a paragraph, picked words take "Comment on this" (the comment carries `box`, `paragraph` and `quote`), and one Save bar per day saves `edits/<day>-<item>` (`text`, `day`, `item`, `base_sha256`, `at`) | `--draft DAY --review DAY=...` |
| Drafts: Also changed | where his saved edit was carried (`scripts/post-pack/edit_sweep.py`): each change with Undo, suggestions with Change it too, recorded scripts left alone, and the gates run again; kept on a rebuild while that day's words are unchanged | `--sweep DAY=sweep.json` (the file edit_sweep.py writes) |
| Drafts: What I learned from your edits | the compiler's proposals from his board edits (scope `board_edit:<class>`), each with Make it a rule and Not a rule; it stays a proposal until he says yes | `--lessons lessons.json` (GET /api/video-studio/learning-proposals) |
| Record | the Teleprompter scripts and the scripts to read | `--teleprompter`, the publish page's scripts |
| Publish | files first, then each place to post with its tick | `--materials DAY=...`, the publish page (`--day`), the videos on the record |
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

Sunday's sources: `python3 scripts/post-pack/board_feed.py gather <Monday>`
reads `GET /api/week/options?include=sources` and `GET /api/idea-queue?combine=1`
(read-only, no spend) into `docs/plans/<Monday>-week/sources.json`: each
series' pool, his ideas first, then near something he liked, then the ladder
score, each with `source_kind` and `why_here`, the queue and its combine groups,
and which source is empty and why. His ideas are `manual` rows (his words
through Control Center's one door) and topics he asked the engine to research
in Control Center (`requested_research` with `requested_by: Krish`); board items
that relay his words (`krish-ideas-*`, `said-*`) come as `his_relayed`. His
taste steers this sourcing and ranking only; the judges stay blind.

Videos: every piece is a 90-second and a 5-minute video. A 15-minute feature
appears as a third cut only on a piece Krish called one for
(`config/features.json`, house rule FEATURE).

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
- Picks supply his day/idea choices; use the existing week-options workflow.
- Queue decisions supply his verdict, reason and angle; use the existing
  idea-queue workflow and attribution. Never invent his decision.
- Comments include roots and replies with stable anchors. Read the whole thread,
  retain original metadata and distinguish notes from authorization to publish.

## Update a board

Fetch the authenticated `/board/WEEK` HTML into a local file for `--previous`;
do not print the full board into a conversation. The operator CLI's `download`
command saves this file. Read `week_board.py --show FILE` for its structure.
Keep completed days, current drafts, review IDs, images and every unchanged
asset. Use the existing `--live`, draft/review and completeness guards.

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
