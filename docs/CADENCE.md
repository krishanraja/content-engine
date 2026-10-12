# The weekly rhythm

Krish, 2026-10-11, superseding the Sunday, Tuesday and Thursday slates of 10
October: "We're going to enable planning for the whole week on a Sunday.
Every Sunday we're going to decide which of the three pieces are going to go
out on Monday, Wednesday, and Friday. We're going to get Monday's piece all
the way to iteration and the publish board, whilst leaving Wednesday and
Friday as topic confirmed and waiting on me to do the iteration workflow."
And of the questions he is asked each week: "I don't think there are too many
questions you need to be asking me every Sunday, other than: What are we
writing about this week? Here are your ideas and options. Do you want to drop
in any other ideas that we can flesh out?"

## The standing answers (never asked again)

- **Two cuts, every piece** (house rule TWO_CUTS): a 3-minute video and a
  90-second version, each recorded from its own script with its own hook
  and outro. `story_check.py` holds the lengths.
- **Every piece goes to** Substack and YouTube, then YouTube Shorts, TikTok
  and Instagram (`docs/AMPLIFICATION.md`). LinkedIn, WhatsApp and Substack
  Notes stay available as optional steps.

## The week

Times are Krish's, in New York (`system_config.operator_timezone`).

| When | Where | What happens | Who |
|---|---|---|---|
| Sunday, early morning | A Claude Code session ("Plan the week" routine, `.agents/skills/plan-week`) | Researches three or four options for Monday, Wednesday and Friday, fleshes out what he dropped in the Cold Ideas & Inspo folder, stress-tests them, and writes them onto the pieces (`/api/week/options`) | Claude Code |
| Sunday, 8am (7am in winter) | The work board | One item asks the Sunday question and links to the week page (`control-center api/content/slate.ts`, refreshed every morning, done when all three days have a piece) | Control Center |
| Sunday | Control Center, the week page (`#/week`) | He picks a piece for each day, or drops in an idea to flesh out. A pick holds its day (scheduled_for) | Krish |
| Sunday, on the Monday pick | Claude Code ("Make a piece" routine, `.agents/skills/make-piece`) | Monday's piece is made through to its publish board: workroom, fact-checked article, visual gate, both scripts, publish page, pack | Claude Code |
| Monday morning | His desk | He records Monday's two cuts and drops each as its own file at the top of the Video Engine Inbox (any name), then tells Codex "I've dropped the video". (Since 12 October he may instead record each cut in its Descript project's "Record here" timeline; bringing such a take back is not built yet, so it does not reach the engine by itself) | Krish |
| Within about 15 minutes | Whichever home computer is on (the recordings upload, every five minutes) | Each take reaches the engine, and the same lane places it on its piece and cut by itself (`recording_match.py --record --board --by "Recordings lane"`), stamped with the script it was read from; a take it is unsure of becomes one board question | the home computers |
| Monday | Codex on a home computer, or Claude Code there when he asks it (`.agents/skills/produce-video`) | Places any take still unplaced; both cuts produced with the intro sting once he approves one, the licensed music bed and a thumbnail for each size; filed in the archive and the post's library folder (`3 Video`) and onto the record | Codex |
| Monday | The publish page | He posts in the standing order and ticks each channel | Krish |
| When he is ready | The week page, Wednesday's and Friday's cards | "Make it in Claude Code" starts each one's making; it then follows Monday's path | Krish starts, Claude Code makes |

A day with nothing worth picking is a day with nothing picked; the options
never force a piece.

## Who owns what, and where things live

Krish, 2026-10-11: "I'm going to transfer all video production iteration
through to Codex, whilst Claude will remain the overall place for initial
ideation, article creation and publish board building." Two tools, one
record, one rule: **a tool never writes a step it does not own.** The owner
of every step is in the record itself (`MAKING_OWNERS` in
`apps/control-plane/api/_making.ts`, mirrored in Control Center), so the
board, the strip and both skills read the same table.

| Step | Owner | Skill | Writes |
|---|---|---|---|
| Options for the week | Claude Code (Sunday routine) | `.agents/skills/plan-week` | `meta.week_option` through `/api/week/options` |
| The Sunday question and the pick | Control Center (cron), Krish | `api/content/slate.ts`, the week page | the work board's week item; the pick and its day |
| Workroom, fact-checked draft, visual gate, scripts, publish page, pack | Claude Code | `.agents/skills/make-piece` | `meta.making.workroom`, `.publish_manager`, `.visual_gate`, `.script_check`, `.pack`; the body through the engine |
| Record | Krish records; the home computers' recordings lane writes it, or the production session for a take the lane has not placed | `scripts/post-pack/recording_match.py --record`, run by `scripts/recordings-upload.ps1` at the end of every pass on either machine (`--board --by "Recordings lane"`) and in `.agents/skills/produce-video` | `meta.making.recordings`, each take with the hash of the script it was read from (`script_sha256`) |
| Video assets | Codex, on a home computer (Claude Code there too when Krish engages it) | `.agents/skills/produce-video` | `meta.making.video_assets`, each cut with its thumbnail and music track; the cuts and thumbnails in the archive and in the post's library folder (`3 Video`). Never the visual gate or the pack |
| Publish board with the cuts | Claude Code | `make-piece` (last step) | the publish page; and the pack again with the cuts (`build.py --replace`, which records Visual gate and Pack, then `send.py`) when the session holds the post's working folder and the cut files |
| Posting and ticks | Krish | Control Center | `meta.making.channels` |

Where each thing lives, and nowhere else:

| Thing | Lives in | Reached by |
|---|---|---|
| The piece and its making record | the shared database, `content_ideas` | the engine's routes only (never SQL for a body, walk log F32); Control Center reads it live |
| The work board | the engine's `work_board_*` tables | `/api/workbench` on the engine key or Krish's cookie |
| The engine key | Claude Code cloud: a network secret bound to the engine's host. Codex cloud: the environment secret. Windows home machines: Credential Manager, read by `scripts/engine.py` | never a file, a chat or a commit |
| The runner's bearer | Credential Manager on each runner machine | the recordings and library lanes |
| Control Center's secrets (access code, cron secret, the routine's id and token) | Control Center's Vercel project | its own routes; the slate cron speaks to the board on the access-code cookie |
| Recordings | the engine's recordings lane (object store plus manifest) | the home computers place each take on its piece and cut by themselves (`scripts/recordings-upload.ps1`, then `scripts/post-pack/recording_match.py`); `scripts/post-pack/recording.py get` fetches a take by its Inbox name or by the path its piece's record holds (`recordings/<sha256>.<ext>`); never the Drive connector (10 MB cap) |
| Scripts for Krish to read while he records | the publish page's Copy; and in Descript, `Mindmake scripts > <pack folder>`, one view-access project per cut with a "Record here" timeline (Monday's and Friday's sent by hand on 12 October, with his yes) | the links on the piece's Record board item. The automatic send and the return of a take recorded in Descript are not built yet; a take in the Inbox is placed by the home computers |
| Licensed music | Drive, `makeyourmindup > 00_Brand-Assets > 07_Music` (`MINDMAKE_MUSIC_ROOT`), each licence certificate beside its track; the ledger `config/music-library.json` in GitHub | `scripts/quick-edit/music.py` on a home computer; only approved ledger tracks, never browsed |
| The pack, the publish page, the finished cuts | Krish's Drive library, written by his own machine from the engine's library store | `build.py`, `send.py`; the Drive folder is the canonical copy for every tool and for Krish |
| The workroom and the publish page as artifacts | claude.ai | Claude Code and Krish only; a convenience view of what the pack holds. Codex and the runner never need them |
| Code, rules, skills | GitHub `main` of this repository, and of `control-center` | both tools commit small and pull first; the docs steward writes `NOW.md` and the log |

What could be misread, and what stops it:

1. **Both tools think a step is theirs.** The record carries the owner;
   each skill reads `making.py <id> show` first and stops at a step that
   is not its own: `produce-video` produces nothing for a piece whose
   Scripts step is not done, and `make-piece` never writes the video
   assets. `by` on every write says who wrote it (`making.py --by`, or
   `MAKING_BY`, which each skill's first step sets; `making.py` also tells
   Codex by itself).
2. **A Codex session is asked, in chat, to touch the article or the
   approval.** The produce-video skill names what it never writes. A
   decision Krish made in words is relayed with `decided_by: 'Krish'` by
   either tool, never invented.
3. **A link only one tool can open.** Artifact links open only in
   claude.ai. The pack in Drive is canonical, so Codex and the runner work
   from the folder; the strip shows both.
4. **A key in the wrong place.** The engine key is never in a repository,
   a file or a chat. Inside Codex's Windows sandbox it cannot be read: the
   skill says to run outside the sandbox with Krish's approval. In Claude
   Code's cloud the proxy adds it; the container never holds it.
5. **Two sessions start for one piece.** Control Center fires one routine
   per press and opens a live session instead of firing again. Codex has
   no trigger from Control Center: Krish telling it he has dropped the
   takes is its signal, `recording_match.py` works out which take is which
   piece and cut, and the record shows the session making it.
6. **The slate at the wrong time.** Krish is in New York
   (`system_config.operator_timezone`; the 10 October cron wrongly assumed
   Sydney). The slate cron runs every day at 12:00 UTC (8am New York in
   summer time, 7am in winter), puts the week's item on the board only when
   it is Sunday in his zone, and only refreshes it on other days. The
   planning routine runs at 6:47am New York on Sunday (CRON_TZ in the
   routine). When his zone changes, the routine's schedule moves with
   CRON_TZ; the slate needs no change, because the Sunday test reads his zone.
7. **A pack rebuilt without the gate.** `build.py --replace` runs the
   visual gate again, so a cut added without its logos declared refuses
   the whole pack. Only Krish's own words in `visual_gate_override` pass
   one through.
8. **A recording that never arrives, or never reaches its piece.** The
   lane sends every finished recording from whichever runner machine is
   on, within about ten minutes, and then places it (Record) by itself;
   a session fetches with `recording.py get --wait`, and a take already on
   a piece by the path its record holds (`recording.py get
   "recordings/<sha256>.<ext>"`). A take over 500 MiB never reaches the
   engine: `recording_match.py --inbox` on a home computer reads it from
   H:. A runner with no engine key or no pinned Python fails
   `install-recordings-upload.ps1`'s check, naming which; the other runner
   still places the take. A missing file is reported by step, never
   worked around through Drive.
9. **The row changes under a write.** The making route merges onto the row
   it read and is guarded on `updated_at`: a lost race comes back 409
   (`stale_row`) with nothing written, and `making.py` sends it once more
   before it reports the failure. Most other routes that write a piece's
   meta (the chat, revise, challenge, dive-deeper, score, materials, the
   fact check and others) read the row, wait on a model, then write the
   whole of meta back with no such guard. A stale copy of the making record
   in such a write is never put back over a newer one: the database keeps
   the newer record (trigger `content_ideas_keep_newer_making`, migration
   `20261012120000_keep_newer_making.sql`, live once applied), and the
   making route and the publish watcher stamp every new record later than
   the last. Those routes' own keys have no such protection, so run them
   one at a time (`AGENTS.md`).
10. **Drift between the two mirrors.** `scripts/check-make-handoff.mts`
    in Control Center fails CI when its step rules or owners differ from
    the engine's lines.
11. **A take of an older script.** Each script's words are hashed when
    they pass (`making.py scripts`), each cut keeps the time its own words
    last changed, and checking the same words again keeps those times (a
    record from before the hashes counts as changed). Each take is stamped
    with the hash of the script it was read from. When a cut's words change
    after Krish has recorded it, that take stops counting: Record shows
    "long cut recorded from an older script", `making.py scripts` asks him
    on the board, `produce-video` refuses the take, and `making.py recorded`
    will not stamp it as current without his words (`--krish-words`). A
    take recorded after the piece's record began (fixed on its first write)
    but before its cut's words last changed is asked about, never silently
    left alone; a change to one cut never makes the other's take look old.
12. **Two tools rebuilding the pack.** Only Claude Code writes the Visual
    gate and Pack steps. `produce-video` files the finished cuts and
    their thumbnails into the post's `3 Video` folder from the archive,
    only once each shape has its thumbnail and the visual gate passes for
    the videos and thumbnails, and never rebuilds the pack; `make-piece`'s
    publish board step rebuilds it with the cuts when it can.
