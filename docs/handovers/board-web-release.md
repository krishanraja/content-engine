# Private weekly board web release

Status: Content Engine PR #104 and Control Center PR #499 are merged and their
production deployments are ready. The seven-table schema is applied; RLS and
service-only grants were read back. The content hostname is attached and verified
on Control Center using the existing Vercel wildcard DNS. Assets are staged
privately. Source import and board activation remain pending final comparison.

Approved scope (Krish, 19 October 2026): full parity, then web-only interaction.
Preserve all four Claude boards and artifact generation. No video work here.
Krish subsequently explicitly authorized merging both repositories and making
both weeks live. On 19 October he confirmed: "Paused; no changes since those
exports" for the final source freeze and the newer-account exports.

## Targets and ownership

Content Engine owns the API, schema, builder and operator tools. Control Center
owns the hostname, access curtain and rewrites (ADR-019). The board uses the
existing access-code cookie or engine operator token; it does not invent a
Supabase user identity. New tables have RLS and no anon/authenticated grants.

## Verification journal

- Final implementation CI passes full `npm run verify` on Ubuntu and Windows,
  plus all board-web, browser-button, SQL, dependency and operating-context jobs.
- Production engine merge `c34fdd5422f8aec678d8f2ad2784fa65074bb7da`, deployment
  `dpl_71meHR3H4yQBwBPieYqEp1opsbuz`; authenticated empty-state read succeeds and
  unauthenticated direct board read returns 401 with private/no-store headers.
- Production Control Center merge `0fba42d1eae1b4b5584d94491f3b1e0cae6df48c`,
  deployment `dpl_AoCrd4H16otnjV8RcDXuFdFHceZ3`.
- All four source bundles are captured and audited: older 12 October has 18
  ticks, 3 edits and 24 comments (14 roots, 10 replies); older 19 October and
  newer 12 October are empty; newer 19 October has 3 picks, 11 queue documents
  and 28 comment roots. All 87 records reconcile without conflicting values.
  Replaying every raw record and canonical value twice through actual handlers
  and disposable PostgreSQL passes exact JSON readback.
- Krish explicitly approved preserving all available data despite unavailable
  source manifests, native reply/account IDs and precise comment timestamps.
  Raw records remain byte-faithful JSON; canonical comments get deterministic
  IDs and valid anchors with original IDs/locations retained in metadata.
  Resolved/open status, displayed authors and displayed times remain visible.

- Final browser regression now delays a save response while typing continues,
  then introduces a concurrent remote edit. This exposed and fixed loss of the
  unsaved text's revision baseline. Cancel preserves unsaved words; replacement
  still requires explicit confirmation. Both phone and desktop runs pass.
- Current Content Engine head `1281a48` passes the new board-web CI job on push
  and pull-request runs, plus existing browser-button and SQL jobs. Full verify
  remains running. The previous implementation passed full Ubuntu verify.
- Control Center head `4f491e4` passes its actual verify, operating-context,
  Vercel and full 18-minute E2E checks, including desktop and phone projects.
- Twelve existing Drive assets are captured locally: 689,355,738 bytes, each
  matched to source metadata and SHA-256 inventoried. These are the existing
  Friday files too; replacement cuts are outside this release.

- Baseline: 106 artifact self-checks pass.
- First web fixture exposed the renderer's integrity seal: injecting an adapter
  after sealing invalidated the page. The adapter must reseal its generated output
  and publication must reverify after deterministic asset-link substitution.
- Auth/contract tests: five passing; Control Center middleware/return-path tests: four passing.
- Docker is installed but its daemon is unavailable. SQL behavior will be checked
  in a disposable local PostgreSQL runtime, not against production.
- PostgreSQL migration/RPC tests pass, including CAS, RLS role denial, immutable
  builds and rollback without loss of current state. The first HTTP fixture failed
  on an overly strict test-double column-name regex (`source_sha256`); corrected
  the fixture, then rerun import replay and the full HTTP suite.
- The repository's Chromium acceptance harness passes 34 tasks at 390px and
  1440px against the actual HTTP handlers and disposable SQL database. It covers
  all tabs, images, persisted ticks/links/edits, comments/replies, picks/queue,
  unsaved typing across polls, stale-write rejection/explicit replacement, and
  failed-save retry, text/image clipboard reads, inline download byte hashes and
  API-to-browser tick refresh. Screenshots inspected. This is local evidence, not production.
- Source HTML checks: the 14,267,519-byte historical board renders all six tab
  views and 88 image instances at phone/desktop widths without overflow or runtime
  exceptions. The current board renders eight tab views. Its 42 exported records
  pass the real API validators and exact JSON readback in disposable PostgreSQL.
- Seven Python conversion/import tests pass. Source conversion rejects a changed
  input digest and preserves existing panels; missing manifests need explicit
  evidence. Multi-page reads and source-archive replay are exercised over HTTP.
- Full `npm run verify` is not green locally. Recording-match's two missing-key
  assertions also fail on untouched main because Windows Credential Manager
  supplies a key (the test points to engine.invalid). Other broad-suite failures
  include timeouts under this machine's load. Targeted board tests pass.
  The final broad run stopped after reporting failures and then making no visible
  progress for several minutes; it has no passing aggregate result. This remains
  a release check to run in the repository's clean CI environment.
- Skill copy synchronization passes. The locally installed Codex skill validator
  rejects produce-video's existing Claude `model: sonnet` field. Its description's
  existing unquoted colon was made valid YAML without changing its wording or
  model setting. All other repository verification gates pass independently.
- Control Center lint, four TypeScript checks and production build pass. Its
  complete local API suite reports 1524 pass, 44 fail, one skip (new board tests
  all pass). Untouched-base reproduction confirms the logo hashes, missing
  model-price entry and slate assertion; several API failures are Windows path
  handling. The steward validation requires CI's separate steward checkout.

## Export contract and cutover prerequisite

An authenticated Claude session for EACH account must export its two artifacts.
Use every page of ArtifactData, not just the first page. Include all records,
including false ticks. A read failure is a blocker, never an empty collection.
Read all comment threads and all replies. Save the current HTML and manifest too.
Initial native HTML exports for RjLHJQi469BAKcvTCgneHV and
4SZR5ZrQnG657ezuzvvAML were downloaded and hash-inventoried locally. Their account
is out of Claude usage credits, so the authenticated database export did not run.
Its collections/comments remain incomplete, never empty. Krish confirmed that
the newer board is in the other account; do not choose these older HTML copies
as the release content without comparison.

The second account's initial exports are captured and independently checked:
H6qKiPdmSWETVQftpHBS5E (12 October) has zero records in every collection, confirmed
by authenticated reads; CDgS3JDULpzvRnxkHwLkVk (19 October) has 0 ticks, 0 links,
0 edits, 3 picks, 11 queue documents and 28 open comment roots with no replies.
All 14 raw database JSON files match the exported bodies. HTML SHA-256 values
match both server-reported values and Krish's supplied downloads. Comment IDs,
thread references and all 28 HTML anchors validate. Native source bundles are
kept outside Git. The 19 October HTML digest is
`9624beb8c1aa1ab4ffbad81a523901f4314159631d4271de44b4e49c09570df0`.

The other account's shared 12 October HTML is readable, but ArtifactData explicitly
denies this account database access; its 19 October board is not shared here.
No partial export was fabricated. Both still require the owning account's export.
Original generation manifests are not exposed by either captured artifact.
Comments expose thread IDs, minute-resolution timestamps and author labels, not
separate comment/account IDs; preserve the raw readout and these fidelity limits.
These are initial snapshots, and do not satisfy the final delta/cutover gate.

One UTF-8 JSON file per artifact, with this shape:

```json
{
  "version": 1,
  "complete": true,
  "week": "2026-10-19",
  "source": "https://claude.ai/artifact/ARTIFACT_ID",
  "html_file": "board-original.html",
  "manifest_file": "board-original.json",
  "collections": {
    "ticks": [{"id":"mon-substack","body":{"done":false,"at":"2026-10-19T12:00:00Z","day":"mon","piece_id":"PIECE_ID","step":"substack","channel":"substack","label":"Substack"}}],
    "links": [], "edits": [], "picks": [], "queue": [], "comments": []
  }
}
```

Keep collection document bodies unchanged. Normalize each comment/reply to a
document with `id` and `body: {thread_id, anchor, text, at}`; retain original
comment metadata as additional body fields. The root's `thread_id` equals its
`id`; replies name that root. Use stable HTML element IDs as anchors and
`board-root` for unanchored/orphaned historical comments, preserving the original
anchor in metadata. Record whether each collection and comment pagination finished.
The exporter must only set `complete: true` after all reads succeed.
The HTML and manifest paths must be inside the same export directory. An approved
apply archives their original bytes and the export itself to private storage,
verifies every hash, and records the archive before importing any canonical state.
If no original manifest is exposed, `manifest_file: null` is accepted only with
`export_evidence.manifest: {accessible:false, reason:"..."}`. No replacement
manifest is fabricated. The dry run reports source limitations. Applying such
an export additionally requires `--accept-source-limitations`, only after Krish
has approved those exact missing metadata limitations. The archive retains that
receipt beside the immutable export and HTML. This never waives missing records
or a missing account, and it does not authorize cutover.

Run `python scripts/post-pack/board_import.py EXPORT1 EXPORT2 EXPORT3 EXPORT4`
for counts and conflicts without writes. All four registered artifacts are
required. Missing or equal timestamps with different bodies block import.
Explicit resolutions are a JSON map from `week/collection/id` to a reported
source-record SHA-256, supplied with `--resolutions`. Every raw version is archived
before canonical state is written. Comment IDs are namespaced by source to avoid
merging unrelated threads. `--apply` is a separately approved database write.

After stopping Claude edits, export again and import the final delta. Compare
source hashes/counts to the destination archive and read back every selected
canonical value. A newer web value is preserved. No cutover with inaccessible
records or unresolved conflicts.

## Operator commands

Build with the existing inputs plus `--target web`. Artifact remains the default.
Use `python scripts/post-pack/board_web.py publish-web PAGE.html` to validate and
print a dry-run manifest summary. Add `--assets FILE.json` for downloads:
`[{"id":"fri-short","source_url":"EXACT_EXISTING_URL","path":"LOCAL_FILE","type":"video/mp4"}]`.
Every direct Drive download link must be mapped. Existing Open in Drive/reference
links remain references. Existing data-image downloads stay inline.
Add `--apply` only after approval for those exact uploaded bytes and activation.

For a native HTML export, `board_web.py convert-export ORIGINAL.html --week WEEK
--source ARTIFACT_URL --expected-sha256 REVIEWED_DIGEST --output WEB.html` keeps
the original panels, wording, images and build-time edit guards and upgrades only
the recognized shared runtime. The source must be registered for that week and
match its reviewed digest. This local conversion has no external side effects;
the sidecar records source provenance. Select the newer account's current content
after comparison, then map downloadable assets and use the normal publish dry run.

Collection/import GET responses have `next_offset`; follow it until null. The
web adapter and operator CLI collect every page before exposing a snapshot.

`board_web.py read WEEK COLLECTION` reads ticks, links, edits, picks, queue or
comments through the authenticated API. Operators retain their own attribution;
reading a board does not authorize publishing content or pretending an agent's
decision was Krish's. Ticks still reach making records through the existing
`making.py PIECE posted CHANNEL [url]` workflow. Unticks never delete that record.

`board_web.py rollback WEEK BUILD_ID` previews a rollback; `--apply` selects that
previous immutable manifest without changing interaction state. It verifies the
restored build's files and reads the active pointer back.

## Release gates

1. Review both local diffs and checks; approve branch pushes and coordinated PRs.
2. Verify exact Vercel/Supabase targets and current production revisions; approve
   the content migration and deploy the engine before Control Center forwarding.
3. Confirm both deployments have the existing access code; no secrets in HTML.
4. Approve attaching content.krishraja.com to Control Center. Recheck DNS immediately
   before changing it; the last recommendation was CNAME content to
   63597985a263e155.vercel-dns-016.com. Existing DNS is Vercel-hosted.
5. Approve private uploads and initial activation for the two weeks; complete
   source exports, final import, user-session browser QA and API readback.
6. Mark web authoritative only after the source inventory and behavior pass.

Rollback readiness must name the known-good deployment before release. Restore
the prior deployment/board pointer without deleting tables, builds, imports or
Claude artifacts. Preserve Friday content until its separate cuts are watched
and approved by Krish. Production completion remains unverified until cutover.

## Release continuation, 19 October 2026

Krish explicitly requested both branches merged to main and the site live, with
12 October and 19 October as overarching week tabs. This authorizes the scoped
pushes, coordinated PRs/merges, schema, deployment, domain and private board
publication described here; do not ask the same generic release permission again.
Historical export completeness and explicit conflict resolution still apply.

The seven-table additive migration has now been applied to the verified
Mindmaker OS project `gojpffsrxybbpbdzzrvs`. Production readback confirms RLS on
all seven tables, no SELECT grants for anon/authenticated, and service-role
access. No historical records or builds have been imported/activated yet.
Engine rollback deployment before release: `dpl_YcVYDd84ugrmat4is8PtXkLG3LUE`,
main `d8c098768e18f98f6b38c1d8369889b7a87d03f3`.

Added authenticated published-week discovery and responsive top-level navigation.
Local PostgreSQL/API + browser acceptance passes, including cancelling a week
switch with unsaved words. The new navigation test initially compared the full
URL without accounting for the existing daily-tab hash; corrected to compare its
pathname. PostgreSQL date values are normalized to YYYY-MM-DD at the boundary.
Save acknowledgements clear dirty flags only when the field still matches the
submitted text. The original 106 board self-checks still pass.

`docs/PUBLISH_BOARDS.md` now governs all board consumers. Active skill entry
points, the make-piece reference, cadence/integrations, Friday prompt, pack docs,
README/AGENTS and the synchronization hook point to it. Legacy artifact generation
and original addresses remain available. The config stays pending until readback.

The older Claude account's usage was exhausted; Krish topped it up and its
read-only exports are now running in the owning account. Reconcile those bundles
before import. Monday's editorial branch handover was read from FETCH_HEAD:
scripts signed off, board v8 in draft, awaiting recordings and paid fact check.
Those production tasks are outside this migration.
