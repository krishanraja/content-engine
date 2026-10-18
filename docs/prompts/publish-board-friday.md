# Handover: make Friday's tab on both publish boards publish-ready

Paste everything below the line into a fresh Claude Code session on `krishanraja/content-engine` (Sonnet is
enough for this job).

---

Make Friday's tab (16 Oct, mind.the.gap, piece `904658db-4df2-4537-a0ed-ebe93e081db7`) on the week of 12 Oct's
publish board **publish-ready**, and publish the same build to both links in `config/boards.json`
(`https://claude.ai/artifact/H6qKiPdmSWETVQftpHBS5E` and `https://claude.ai/artifact/RjLHJQi469BAKcvTCgneHV`).
Monday and Wednesday are already ticked and published: keep them exactly as they are (`--keep mon --keep wed`).

## Rules for this session (AGENTS.md, "Cost: six standing rules")

- One session, this job only. Few, big steps. No agents, no workflows.
- Read each board once with `Artifact read`; it saves the page to a file, and the builder reads that file
  (`week_board.py --previous FILE`). Never read the page into the chat beyond its head.
- Nothing paid (no fact-check run) without Krish's yes and an estimate from `meter_daily`'s last run.
- Files Krish asks for are handed over as files. The only artifacts are the two boards.
- Before stopping: commit, push to `main`, send any media to the library, update `WORKBENCH.md`.

## Read first (only these)

1. `docs/plans/2026-10-09-friday/HANDOVER.md`: the bottom three sections, from "Found on 18 Oct" down.
2. `docs/plans/2026-10-09-friday/nine-lines.md`: the nine fact-check lines waiting on Krish.
3. `python3 scripts/check_failures.py`, then the comments on both board links (`ArtifactComments read`).

## Where Friday stands (18 Oct)

- **Article:** v6, `docs/plans/2026-10-09-draft-body-v6.md` (2,410 words), saved on the piece. The voice check and
  AI scan pass. The fact check passes every line except the nine in `nine-lines.md`, which Krish is reading himself.
- **Substack page:** built from `docs/plans/2026-10-09-friday/page-facts-v6.json` with six charts (exhibit 6 is
  new) and 54 sources. It is in the library pack: `3 Posts/2026-10-16 Fri mind.the.gap - Why so many AIs/`
  (`1 Article/substack-copy.html`, `web-page.html`). Headline and subtitle: `publish-copy-v2.json`.
- **90-second cut:** finished (89.7 s), in the pack's `3 Video/`, recorded on the piece, with its tall thumbnail.
- **Long cut (14 min):** not made. The take (`recordings/ee91ab41...0fd9f.mp4`, 1.1 GB) is only on Krish's PC.
- **The board today:** Friday is in draft, a "Review the words" card with seven boxes: Article, Deep cut,
  90-second script, Outline, plus Cost guards, Nine lines and the Sunday Ideas prompt. Krish does not want those
  last three on the board ("I don't need these as artefacts. I need them as Markdown").

## Steps

1. **Krish's sign-off on the nine lines.** If his words since 18 Oct (board comments, `GET /api/workbench`
   `said` notes, or the chat) sign them off, record them. If not, ask him once, in one plain message. The engine
   has no sign-off route yet (guard G9 in `docs/COST_GUARDS.md`). Build the smallest version: his words in
   `meta.fact_check.signed_off`, one entry per named line, and the gate passing when every blocking line is signed
   off. Add a test, run `npm run typecheck:control-plane` and the fact-gate tests, push. Never re-run the paid check
   to clear these lines.
2. **The publish page for Friday.**
   - Update `docs/plans/2026-10-09-friday/manager.json` and `words.json` to the signed-off titles
     (`publish-copy-v2.json`, `config/title-verdicts.json`). The cover line is "New Claude. New ChatGPT. Does it
     even matter?", never "faster than ever".
   - Point it at the pack's files and the 90-second cut's Drive link (the Drive connector's `search_files` in the
     post's `3 Video` folder; a link, never a download).
   - Run `scripts/post-pack/publish_manager.py`, then the pack (`build.py --replace`) and `send.py`.
   - The long cut's row says "waiting on the 14-minute take" and how it gets made. Either Krish renders it on his
     PC (Codex, `produce-video`, configs `docs/plans/2026-10-09-friday/long-cut/long.json`), or the store's size
     limit is raised. That is his call; ask him once if no word from him covers it.
3. **The board.** Read both links once (the files are saved), then rebuild:
   `week_board.py --week 2026-10-12 --previous <saved page> --keep mon --keep wed --day fri=<publish page>`
   `--piece fri=904658db-4df2-4537-a0ed-ebe93e081db7`. If Friday should stay in review while the long cut
   waits, use `--draft fri` with only the Article, Deep cut, 90-second script and Outline boxes, and
   `--drop-review` for `fri-cost-guards`, `fri-nine-lines-to-sign-off` and `fri-sunday-ideas-tab-prompt`.
   Then `--verify`, and publish the same file to both links. If a publish is refused as stale, read the live
   version it names, confirm your build already includes it (byte compare), and publish again.
4. **Close.** Copy any ticks on either board onto the piece (`making.py <piece> posted <channel> [url]`). Commit and
   push, update `WORKBENCH.md` ("This week's publish board"), and give Krish both links and what, if anything,
   still waits on him.

## Done when

Both links hold the same verified build. Monday and Wednesday are unchanged. Friday's tab shows the publish page:
the article ready to paste, the six charts, the covers, the 90-second cut's link and thumbnail, and every step
with its tick box. The nine lines are signed off in Krish's words, or his one open question is put to him. The
long cut shows exactly what it waits on.
