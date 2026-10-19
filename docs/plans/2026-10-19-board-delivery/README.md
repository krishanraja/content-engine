# Friday and Monday publishing materials

User request, 19 October: populate Friday and Monday's boards with the finished
videos, including Spotify, before starting Wednesday in a later request.
This authorises updating the private publish boards, not posting publicly.

## Sources and readiness

- Friday: accepted repaired long/short files from its existing post library.
  The live fact gate and all blocking publication checks now pass, including
  the approved exact-prediction exception from PR #110. `readiness-readback.json`
  records the free GET result. No paid check was run.
- Monday: final review renders from PR #109, already preserved in the archive.
  Keep its draft state, article fact hold and three listening checks visible.
  Its approved recorded prediction is 95% by 31 December 2026. Original script
  boxes and their hashes remain unchanged as recording provenance.
- Existing approved video titles are reused. Monday description/caption are
  preparation drafts derived from the approved message, without new pricing
  claims. Friday's description is existing approved copy with the unpublished
  article-link placeholder omitted.
- Spotify thumbnails are rendered from the approved house source at 1920x1080.
  Friday uses `cover-facts-tall.json` because the older wide source still says
  "Another Claude?"; the later approved wording is "New Claude. New ChatGPT.
  Does it even matter?". This also serves as its current YouTube thumbnail.
- Chapter times come from the final cut sidecars, with labels shortened below
  40 characters. Friday's existing `fri-c13` copy box is updated without losing
  its anchor. Chapters start at zero and are separated by at least 30 seconds.

`source-assets.json` identifies every source file by size and SHA-256. HTML and
large binaries remain outside git. `prepared-builds.json` names the exact
prior build that each activation may replace. Original builds remain available
for rollback; interaction state is not touched by publishing or rollback.

## Spotify boundary

The recorded music licence is an approved Epidemic Sound subscription. The
provider's [podcast guidance](https://help.epidemicsound.com/hc/en-us/articles/26247417186706-Podcast-Information)
says an active Creator or Pro subscription covers podcast use. Krish confirmed on 19 October: "Show created; music subscription active".
Both boards record that confirmation; Monday retains its editorial hold. No show is created and no episode is uploaded publicly here.

## Build and release

1. Read all six collections for each week and download the active HTML using
   `board_web.py download WEEK --output PATH`. The preparation scripts expect
   these snapshots in `.cache/publish-ready-2026-10-19/`.
2. Run `prepare.py` here with the repository's pinned Python and page-renderer
   dependencies. Inspect the artwork; never reuse an obsolete thumbnail.
3. Run `build_boards.py`. It refuses if either live HTML hash differs from the
   snapshot, retains all review IDs, and builds with current engine records.
4. Run the board self-checks, full verification and visual/copy checks. Use
   `board_web.py publish-web PAGE --assets MAP --expected-build BUILD --apply`
   for each week, using the receipt's exact prior build ID.
5. Read back the manifests, immutable downloads and collections. A successful
   activation alone does not prove download integrity or interaction retention.

The library sender refused Monday's final-delivery request because its video
validation receipt is incomplete. Nothing from that request was sent. Do not
bypass it: review downloads on the board remain explicitly held. Friday's two
new Spotify files were sent through the existing library pipeline.

## Rollback

Activate the prior verified manifest from the matching cached
`WEEK-active-before.json` with the current revision through the board API.
Do not restore old ticks, comments, wording edits, links, picks or queue values.
Earlier asset objects are immutable and remain retrievable.

## Verification on 19 October

- `npm run verify`: passed (142 test files; 1,786 tests passed, one skipped),
  including skill validation and synchronization guards. The Linux-only control
  plane guard is exercised by CI rather than the Windows local run.
- Board self-check: 110 passed, retaining the original 106.
- Authenticated live browser: both week tabs and all day tabs work; saved
  progress and comments load. Friday has 44 loaded images and no broken image.
  Both materials cards were visually inspected at actual 390x844 and 1280-wide
  viewports, with no horizontal overflow. The visible Codex side panel ignores
  viewport overrides; a separate hidden browser tab supplied actual dimensions.
- Copy buttons report successful clipboard writes. The automation's separate
  virtual clipboard does not expose those native writes, so an exact pasted-text
  comparison was not established in this browser. Existing browser-button CI
  checks cover copy payloads. Native download events were also not exposed to
  browser automation; authenticated asset retrieval is verified independently.
- Screenshots: `C:/Users/krish/.scratch/board-delivery-20261019/`.
- Friday's new Spotify thumbnail and chapters arrived in its existing Drive
  library. Monday's final library gate is still held, as described above.

`live-readback.json` records the final builds, streamed HTML hashes, every
asset's content type/size/hash, and exact before/after interaction comparison.
No public post, additional paid fact check or Wednesday production occurred.

Prior builds before this delivery (available through build-history API):
- 12 October: `429daefd5682ff749159652127465ce06825ae36f98742799b5766f87f5228dc`
- 19 October: `bc013294b8930a694bf3aee32813894356a8482c8368f01021d95b826e3c4766`

Rollback changes only the selected build manifest, never interaction records.
