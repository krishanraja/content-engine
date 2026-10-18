# Friday 16 Oct, mind.the.gap: handover (17 Oct 2026)

Piece `904658db-4df2-4537-a0ed-ebe93e081db7`. Krish's budget is tight: this piece has cost
about $85. Work alone, in as few steps as possible. **Start no agents or workflows.** Read
only what a step needs. Ask Krish nothing he has already answered (below).

## The prompt to start the next session with

> Finish Friday's mind.the.gap piece (904658db-4df2-4537-a0ed-ebe93e081db7) to publish-ready
> on a tight budget. Read docs/plans/2026-10-09-friday/HANDOVER.md and follow it step by step.
> Don't redo anything it marks done, start no agents or workflows, and stop to tell me
> before anything costs more than it says.

## Done, signed off, not to reopen

- Every title, heading, chapter name, cover and thumbnail line: `signoff-sheet.md`,
  `config/title-verdicts.json`. Krish: "Fine with everything except for 'soon you won't
  pick your AI.'" Then: "'Does it even matter?' is a better framing." The cover line is
  "New Claude. New ChatGPT. Does it even matter?". Never "faster than ever".
- Long-cut edits: "Happy with your cuts." (`long-cut/long.json`, `kit.cuts_approved`).
- Both takes are recorded and on the record (long: 14-minute deep cut; short: v7 90-second).
- Sniffs: `episode.sniffs`/`duck` in make.py (on by default). On the 90-second take it finds
  10 in-breaths and turns each down 18 dB, nothing else changed (`short-cut/sniffs-found.json`).
  The long take gets the same on render; check the report's `sniffs` list.
- Story intro/outro clips, covers and thumbnails were drawn and checked in the last session
  (but lived in its container: redraw them, step 2).

## Approvals already in hand (do not ask again)

- Library send, and both board links in `config/boards.json`: covered by "Fine with
  everything" (the sheet said "I finish without coming back to you: cards, intro, final
  render, a frame-by-frame review, the library and both board links. Posting stays yours.").
- Speed-up: "Krish, 2026-10-16: just put them in teleprompter, and then if I go over 90sec,
  just speed the video up a bit in post" (in `short-cut/short.json`).
- Story intro on this piece: `intro_override` in both configs.
- Posting is Krish's. Never post.

## Steps

Work folder `W=.cache/produce/2026-10-16-904658db` (git ignores it). Browser for drawing:
`MYMU_BROWSER=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (cloud), headless shell for
story_io renders. Engine scripts: `.cache/py312/bin/python -I` or system `python3`.

1. **Takes and words.** `python3 scripts/engine.py GET /api/content-ideas/904658db-4df2-4537-a0ed-ebe93e081db7/making --full`:
   newest take per cut. `python3 scripts/post-pack/recording.py get "recordings/SHA.EXT" --out ...`
   into `W/takes/` (long) and `W/takes90/` (short), named as each config's `source`
   (or change `source`). Copy `words/long.words.json` and `words/short.words.json` to `W/words/`.
2. **Kit, story clips, covers.** `scripts/quick-edit/kit.py` for the frame, end cards and strap
   (its CHECK lines about the old v1 pictures in `post.json` do not matter: cues are by hand).
   Then copy `long-cut/long.json` to `W/kit/long.json` and `short-cut/short.json` to
   `W/kit/short.json`. Story clips: `scripts/quick-edit/story_io.py` from `cover-facts.json`
   into `W/story/` (intro and outro, 16x9 and 9x16). Covers and thumbnails:
   `scripts/pages/build.py cover-facts.json --cover/--thumbs` (and `cover-facts-tall.json`).
3. **90-second cut.** Panels: `python3 -I docs/plans/2026-10-09-friday/short-cut/tall90.py
   docs/plans/2026-10-09-friday/short-cut/tall90-panels.json` (writes `W/kit/panels/fri90-*`).
   Look at all ten once. Known: the page text is small at full width (Krish passed full width
   on Monday); the rings are fixed in the spec, check them. Then `make.py W/kit/short.json
   --out W/out-short --only 9x16 --plan`: total must be 90 s or under (it was 94.1 s before the
   1.06 speed-up), all 8 cues found, captions read "I'm 85% sure of this", "a bee in my
   bonnet", "How it thinks" (the transcriber misheard all three; if a replacement does not
   take, fix the replacement, never the take). Music: `music.py fetch`, track
   no-curves-instrumental. Render, then one contact sheet at a frame a second plus every 0.25 s
   of intro and outro; look at it once.
4. **Long cut.** Cards: `scripts/pages/video_card.py docs/plans/2026-10-09-friday/video-pictures/cards-v6.json
   --out W/kit/panels --sheet` (51 cards; self-test passes). Open card faults are in
   `video-pictures/card-review-17oct.json` (truth and craft reviews; the fix pass never ran).
   Fix only these, cheaply: (a) **`fri-deep-cost-vs-score-score`: the signed-off heading says
   "about a third higher", the take says "about 30%", the data is 42 to 58 (+38%).** Tell
   Krish in one line and use his answer; (b) the 7 Artificial Analysis cards do not show its
   logo; (c) capture faults (WIRED paywall, burned-in highlight on the reversal capture,
   uncaptured second source on plus-pro-c2) can stay as they are if a fix costs a recapture.
   Then set `W/kit/long.json` intro `{"16x9": "../story/intro-16x9.mp4"}` and endcard
   `{"16x9": "../story/outro-16x9.mp4"}`, keep the repo copy identical, `--plan`, render
   `--only 16x9`, one contact sheet, `chapters.txt` for the YouTube description.
5. **Substack.** Five exhibits from live Artificial Analysis data: `visual-intel/exhibits.json`,
   `render.json`, `data-final.json`, `derived.json`; the build scripts are in
   `visual-intel/build/` (they expect `.cache/visual-intel/`: adjust paths). They were rendered
   but the number, legibility and honesty checks never ran: check each number against
   `derived.json` yourself (no agents). Cost multiples must say whether they are per task or
   full test set (the article uses per task). Then the page: article
   `docs/plans/2026-10-09-draft-body-v5.md`, headline and deck from `publish-copy-v2.json`,
   exhibits after their `after` anchors, `scripts/pages/build.py` to `substack.html`.
   `post.json` `files` still lists the old v1 images and `manager.json`/`words.json` the old
   titles: replace them from `publish-copy-v2.json`, the exhibits, covers, thumbnails and both
   cuts. Then `publish_manager.py`, `build.py` pack, `send.py`.
6. **Record and board.** `making.py 904658db-... video long|short ... --thumb ... --music ...`.
   Rebuild the week board (WORKBENCH, "The build command") and publish it to **both** links in
   `config/boards.json`. Read the comments on both links first.

## Cost notes from this session

Most of the money went on agents re-reading large context. Draw and check things in the main
session, look at one contact sheet per output, and never re-run a whole workflow to fix one item.

## Found on 18 Oct (the next session): two things this handover assumed

- **The long take is not reachable from a cloud session.** `recordings/ee91ab41...0fd9f.mp4` (1.1 GB) never
  reached the engine store (too big), and the Drive connector downloads 10 MB at most. Only the short take
  (`f5401564...`) is in the store. The long cut renders where the take is: Krish's home computer, or the
  store takes it once its size limit allows.
- **The page screenshots under `video-pictures/shots/` were never saved.** `tall90-panels.json` needs 9,
  `cards-v6.json` 27; they lived only in the 17 Oct container (not in git, not in the library, not in the
  engine store). Recapturing them means new crop and mark boxes wherever a page has moved since 17 Oct.
- Done on 18 Oct, in `W` only (redo from these steps if the container is gone): the short take fetched,
  the kit, both configs copied, the story intro and outro in both shapes (every frame checked), covers and
  thumbnails (checked at phone sizes).
