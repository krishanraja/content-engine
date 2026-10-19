# Move the week's publish board to content.krishraja.com

**3 of 3.** File 1, `docs/plans/2026-10-09-friday/fix-plan-19-oct.md`, is the plan for Friday's two cuts (its
section 4 summarises this move); file 2, `docs/handovers/2026-10-19-codex-friday-cuts-fix.md`, has Codex fix and
re-render them. This job runs separately and can run at the same time. Do not render or edit video here.

Paste everything below the line into a fresh session (Claude Code or Codex) with both `krishanraja/content-engine`
and `krishanraja/control-center` checked out. Krish, 19 Oct: "yes lets move the board to content.krishraja.com".

---

You are moving Krish's weekly publish board off claude.ai artifacts onto his own site, **content.krishraja.com**,
so any tool (Claude Code, Codex, ChatGPT, a script) can build it, read its ticks and update it. You have no other
context; everything is named below.

## 0. Read first

1. In `content-engine`: `AGENTS.md`, `docs/NORTH_STAR.md`, `WORKBENCH.md`. Run `python3 scripts/check_failures.py`
   and read `config/failures.json` entries `publish-board-empty-pictures` and anything mentioning "board", and
   `config/learnings.json` entries about the board.
2. In `control-center`: its `AGENTS.md`/`CLAUDE.md` and README. It is a Vercel app with Supabase; it already serves
   `https://controlcenter.krishraja.com` (for example `/api/canon/KRISH.md` and `/api/workbench`), and Krish logs
   in there. Find how it authenticates Krish and how its API routes are guarded before writing any route.

## 1. What the board is today

- Built by `scripts/post-pack/week_board.py` in `content-engine` (run `python3 scripts/post-pack/week_board.py
  --help`; its self-test is `--self-test`). Output: one self-contained HTML file (images inlined, under 16 MB),
  tabs: Ideas, Monday, Wednesday, Friday. Rules for what it shows: `AGENTS.md`, "The week's publish board".
- Published as a private claude.ai artifact to **every** link in `config/boards.json` (two Claude accounts, kept
  in sync; `scripts/hooks/board_sync.py`). Current weeks: 12 Oct (`H6qKiPdmSWETVQftpHBS5E`,
  `RjLHJQi469BAKcvTCgneHV`) and 19 Oct (`CDgS3JDULpzvRnxkHwLkVk`, `4SZR5ZrQnG657ezuzvvAML`).
- Runtime it uses (claude.ai only, which is why other tools cannot work with it), all in `week_board.py` around
  lines 1160 and 1600 to 1760:
  - `window.claude.use("db")`: Krish's ticks, collection `ticks`, one doc per tick id, written with
    `.doc(id).set(body)`, read live with `.onSnapshot`.
  - `window.claude.use("downloads")`: the download buttons for each asset.
  - `window.claude.use("comments")`: his notes on the board.
- Ticks are then copied onto each piece's making record by the making skills (`making.py <piece> posted <channel>
  [url]`; `.agents/skills/make-piece/SKILL.md`, "The week's ticks").

## 2. What to build (each numbered step needs Krish's yes before it goes live)

1. **Ticks table.** A Supabase migration in `content-engine/supabase/migrations/` (this repo owns content DDL):
   `board_ticks (week date, tick_id text, body jsonb, updated_at, updated_by)`, primary key `(week, tick_id)`,
   with row-level security so only Krish's login and the engine operator token can write. Never apply it without
   his yes (`db push` is denied to sessions; he applies it or approves the apply).
2. **Routes in control-center**, guarded like its other write routes:
   - `GET /board/<monday>`: serves the built HTML for that week, behind Krish's login.
   - `GET /api/board/<monday>/ticks` and `PUT /api/board/<monday>/ticks/<id>`: read and set ticks (his login, or
     the engine operator token for tools).
   - `PUT /api/board/<monday>`: stores a new build (engine operator token only), keeping every earlier build.
   - Storage for the HTML and the downloadable assets: the existing `content-library` bucket via
     `/api/library/file` if it fits, otherwise a private bucket; links signed and short-lived.
3. **The domain.** content.krishraja.com on the control-center Vercel project, pointing at `/board`. Check where
   krishraja.com's DNS lives first (Vercel or elsewhere) and tell Krish exactly what record is needed; adding a
   domain or DNS record is his yes, immediately before.
4. **week_board.py.** A `--target web` mode: same page, but ticks, downloads and comments call the routes above
   instead of `window.claude`; and a `publish-web` command that `PUT`s the build. Keep the artifact mode working
   until Krish retires it. Self-tests for both modes; the verify step that refuses empty `<img>` must still pass.
5. **Copy the ticks across once.** Read every tick from all four artifact links (a Claude session can, with
   `ArtifactData` `list` on collection `ticks`) and write them to `board_ticks`. Report counts per board; no tick
   is dropped, and an untick never removes a record.
6. **Making skills.** `make-piece`, `plan-week`, `produce-video` read ticks from `GET /api/board/<monday>/ticks`
   (then copy onto the record as now). After editing a skill in `.agents/skills`, run
   `python scripts/validate-skills.py --sync-claude`.
7. **Docs and registers.** Update `AGENTS.md` ("The week's publish board"), `WORKBENCH.md`, `config/boards.json`
   (add the web address per week) and `docs/STATE.md`; add a learning in `config/learnings.json` with Krish's
   words above and where it is enforced.

## 3. Proof before calling it done

- Open content.krishraja.com/board/2026-10-19 in a real browser (Playwright, phone width and desktop) logged in as
  Krish would be: every tab renders, every picture shows, every download link returns the right file (check type
  and size), a tick set in the page shows up from `GET .../ticks`, and a tick set by the API shows in the page.
- `npm run verify` in both repos. Push to branches and open pull requests; never push to main.
- Nothing is published, deployed, sent or deleted without Krish's yes immediately before that action. The old
  artifact boards stay as they are.
- Last step, only if file 2's cuts are done (their links are in `WORKBENCH.md`) and Krish has watched them:
  rebuild the Friday tab with the new cuts and publish it to the web board with his yes (file 1, section 5).
  Otherwise leave the Friday tab as it is and say so.
- Before you stop: update `WORKBENCH.md`, commit, push to a branch and open the pull requests.
