# Publish boards: the web workflow

Krish's 19 October 2026 ruling: both weeks remain available at
`https://content.krishraja.com`, with separate overarching week tabs. The web
board becomes the sole place for new interactions after verified migration.
The four Claude artifacts and the default artifact generator remain preserved;
there is no ongoing synchronization with them after cutover.

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
