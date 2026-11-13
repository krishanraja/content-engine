> **Historical.** What was retired on 13 November 2026 when the old publish boards were retired for good, and where it lived. Nothing here describes current behaviour; `docs/PUBLISH_BOARDS.md` and `docs/STATE.md` do. Every file named below is in git history at the commit before the retirement (`72f2b85`).

# The old publish boards, retired for good (13 November 2026)

Krish, 2026-11-13: "We need to retire the old publish boards now permanently - and retire everything in the content
engine repo that is old". Ruling (Krish, 2026-11-13): the old publish boards are retired for good, and everything old
in content-engine is retired.

The one live board is Control Centre's Content tab (Ruling, Krish, 2026-11-11), drawn on every read from this engine's
view (`GET /api/board/<Monday>/view`) and pressed through its routes. Before it there were three generations of the
engine's own board, each kept as an archive by the next. All three are gone.

## The boards that were

| Board | From | Until | What it was |
|---|---|---|---|
| The two-account Claude artifacts | 12 Oct 2026 | 19 Oct 2026 (frozen) | Four Claude artifacts, two a week, kept in sync by a hook. Their addresses stay in `config/boards.json` `weeks` only so the cost guard (G5) can refuse reading one whole into a chat. |
| The baked week board at content.krishraja.com/board/<Monday> | 19 Oct 2026 | 10 Nov 2026 as the live board; then `?archive=1` | One HTML page a week built by `scripts/post-pack/week_board.py`, published as an immutable build by `scripts/post-pack/board_web.py publish-web`, rebuilt by `.github/workflows/board-rebuild.yml`. |
| The desk at /board/<Monday> and /board/next/<Monday> | 10 Nov 2026 | 11 Nov 2026 as the live board; then the read-only archive | A React client (`apps/control-plane/board-next`) built into `apps/control-plane/api/board/_deskPage.ts` and served by the board handler. |
| The read-only archive | 11 Nov 2026 | 13 Nov 2026 | Both pages above, with a banner and a guard (`_readOnly.ts`) that refused every press with 423 `archive_read_only`. |

## What every old address does now

`apps/control-plane/vercel.json` still routes the old page addresses to the board handler (`op=html`, `op=next`,
`op=latest`), and the handler answers each with a permanent redirect (308) to the live board, before any read:

| Old address | Redirects to |
|---|---|
| `content.krishraja.com/board/<Monday>`, with `#<day>` or `?archive=1` | `https://controlcenter.krishraja.com/#/content?week=<Monday>` (a `?day=` the address carries goes with it; a `#<day>` stays with the browser) |
| `content.krishraja.com/board/next/<Monday>` | the same, at that week |
| `content.krishraja.com/board`, `/board/next` | `https://controlcenter.krishraja.com/#/content` |
| any `/board/<date>` that is not a Monday | `https://controlcenter.krishraja.com/#/content` |

Control Centre serves content.krishraja.com and passes `/`, `/board` and `/board/:week` through to the engine, so the
engine's redirect is what the browser gets. `/board/standards` (the standards page) is a decision page, not a board, and
stays.

## What was removed, and where it lived

Pages and the code that served them:

- `apps/control-plane/board-next/` (the desk's React client), `apps/control-plane/api/board/_deskPage.ts` (its built
  page, 362 KB), `scripts/build-desk-page.mjs` (the build and `npm run check:desk-page`), `scripts/check-desk-devices.mjs`
  (its eight-device check).
- `apps/control-plane/api/board/_readOnly.ts` (the archive's banner, guard and 423 refusal) and `ARCHIVE_LINE` in
  `_liveBoard.ts`.
- In `apps/control-plane/api/board/_handler.ts`: serving the desk and the baked page (`op=html`, `op=next`), the newest
  week's redirect to a page (`op=latest`), the old Today view's poll (`op=state`), the old Archive tab's route
  (`collection=archive`), the page's picture route (`op=assets`), and every route that published a build: `PUT
  /api/board/<Monday>` (a new build), `uploads`, `imports` (the Claude artifact import) and `sources`. Their rewrites
  left `apps/control-plane/vercel.json`. Reading a week's earlier build stays (`GET /api/board/<Monday>`, `/build`):
  Control Centre's list and Growth's ledger read those manifests, which stay in the database untouched.

The builder, its publisher and their inputs:

- `scripts/post-pack/week_board.py` (7,662 lines) and `scripts/post-pack/week_board/` (its page template, stylesheet,
  client script and web runtime), `scripts/post-pack/board_v4.py` (layout v4: the Desk tab, the Creative sheet),
  `scripts/post-pack/board_today.py` (the Today tab), `scripts/post-pack/board_shots.py` (phone screenshots of a
  build), `scripts/post-pack/board_import.py` (the Claude artifact import), `scripts/check_board_layout.py` with
  `config/board-layout.json` and `fixtures/week-board/` (the fixed layout's lock).
- In `scripts/post-pack/board_web.py`: `publish-web`, `download`, `rollback`, `convert-export` and the asset mapping
  behind them; `read`, `touch` and `call()` stay.
- `scripts/post-pack/board_materials.py`'s card rendering; its `validate()` stays (the overnight run and the joins reel
  file that shape on the piece).
- `board_feed.py archive` (the old Archive tab's feed) and `ve sprint feed` (the devices block for it).
- `scripts/hooks/board_sync.py` (the two-account sync hook) and its `.claude/settings.json` entry, the dead
  `board-ui-guard.mjs` entry there (the file never existed on main), and the `week_board.py --verify` permissions;
  `scripts/hooks/artifact_gate.py` keeps refusing every artifact publish, without the old page check.
- `.github/workflows/board-rebuild.yml` (stopped since 11 Nov), and the old board steps in `full-verify.yml`.
- `publish_kit.py`'s board run-sheet wording (`on_board`), `sunday_ideas.py`'s old Ideas-tab marker, and
  `live_board.py`'s `archive_url`.
- Eight devDependencies only the desk used (`@tailwindcss/vite`, `@vitejs/plugin-react`, `axe-core`, `cmdk`, `sonner`,
  `tailwindcss`, `vaul`, `vite-plugin-singlefile`), 53 packages in the lockfile.

Tests of what was removed: `tests/board_web_test.py`, `tests/board_today_test.py`, `tests/board_fixture.py`,
`tests/board_gates_test.py`, `tests/board_live_hooks_test.py`, `tests/board-browser.mjs`,
`tests/integration/board-runtime.ts`, `tests/control-plane/week-board.test.ts`, `board-archive-readonly.test.ts`,
`board-live-overlay.test.ts`, `board-state.test.ts`, `media-quality-board.test.ts` (a signed build's activation and its
asset reads), `offday-note-parts.test.ts` (with `fixtures/offday-note-cases.json`; Growth keeps its own cases in
`engine/offday.py`), and the desk-page tests in `board-desk.test.ts` (its live view tests stay, the off-day hash parity
now against `week_plan.py`, and its old-link test now checks the redirect).

## What was kept, and why

- **`scripts/post-pack/week_plan.py`, new.** The parts of `week_board.py` a live path still runs, moved verbatim: the
  ideas checks `board_feed.py cover` and `gate` run (`coverage_problems`, `style_problems`, `story_problems`, and the
  ideas file's own shape, `read_ideas` with its minimum of four ideas a publishing day, which only the retired build ran
  since 11 November and `cover` now runs), the off-day readers `offday_pending.py` and the revise run use
  (`read_offdays`, `read_growth_offdays`, `side_sha`, `posts_needs`), and the edit sweep's shape (`read_sweep`,
  `paragraphs`) that `edit_sweep.py` checks.
- **`board_web.py read` and `touch`**: every session reads his presses with the first, and every run that changes a
  plan file bumps the live board with the second.
- **`/board/standards`**: where he decides the rejection floor's groups; it is not a board.
- **The board's tables and builds in the database**: nothing was deleted. `board_builds`, `board_imports` and
  `board_sources` keep every row; only the routes that wrote new ones are gone.
- **The failure and learning registers**: each guard that pointed at the retired code now points at
  `tests/control-plane/old-boards-retired.test.ts` (marker `OLD_BOARD_RETIRED`) with the old file and marker kept under `was`, or at
  `week_plan.py` where its check moved.

## The guard

`tests/control-plane/old-boards-retired.test.ts` fails if any old address stops redirecting, if any of the files above comes back, if
any script, route, workflow or setting imports, runs, serves or publishes a board page again, or if anything a session
reads first (the rules, the skills, the workflow prompts, the docs, the configs and the scripts) names
content.krishraja.com/board without saying it is retired and redirects.

## The post-pack README's board section, as it stood

## The week's publish board

Krish, 2026-10-12: "just give me one ... Publish Manager for the ... whole
week with 3 tabs on it for Mon / Weds / Fri, which we need to get to 100%.
Give me a tick box next to each one so I can tick as I go and you can
durably record that completion where it needs to be recorded. That Publish
Manager is what you create every Sunday and let me iterate inside until
we're done, and then I check off the list what I have done as I do it."

`docs/PUBLISH_BOARDS.md` is the current workflow. Since 11 November 2026 no session builds or publishes a
board page: the live board is Control Centre's Content tab, drawn from the view, and the builder below made
the pages that are now the read-only archive (Ruling, Krish, 2026-11-11: one live board, in Control Centre;
the old board is a read-only archive). This section is kept as the record of the builder's inputs.

`week_board.py` builds that one page (its template is `week_board/`). Each
tab is a made piece's whole publish page (`publish_manager.py`'s, given with
`--day`), or a designed "not made yet" or "not picked" state. A made tab
opens with Record (each cut's script in Teleprompter by its title, and its
folder, from the making record's teleprompter field or a small JSON of ids,
and how the take comes back: dropped at the top of the Video Engine Inbox),
the two scripts to copy and the checklist; a tick also sits by each
channel's heading. Seven ticks make a day 100% (both cuts recorded, then
Substack, YouTube, Shorts, TikTok, Instagram); LinkedIn, WhatsApp and Notes
are optional. A day's piece comes from `--piece`, or from the week's picks
(`--options`, a saved `GET /api/week/options` answer, or `--live`, which
only reads): the piece of the day's series scheduled for its date in any
picked state, published included (the options' `scheduled` list), since
the publish watcher marks a piece published once its Substack post is live
and Krish still posts the rest from its tab.

    python scripts/post-pack/week_board.py --week 2026-10-12 --day mon=monday-publish.html --day fri=friday-publish.html \
        --piece mon=<uuid> --piece fri=<uuid> [--teleprompter mon=record.json] --live --previous <the board it replaces> --out week-board.html
    python scripts/post-pack/week_board.py --show <a board page or week-board.json> [--json]
    python scripts/post-pack/week_board.py --self-test
    npx vitest run tests/control-plane/week-board.test.ts

A rebuild never loses a day. `--previous` is the board being replaced (its
`week-board.json`, or its web page as `board_web.py download <Monday> --output
FILE` saves it): a day it holds
as made or picked that the rebuild would show as not picked is refused, and
so is a made day with no publish page in the rebuild; `--unpick DAY` says a
day really has no piece now. With `--live`, a picked piece whose making
record has a publish page must come with it (`--day`). `--show` prints the
days a board holds, each day's state and piece: the piece a tick on that
day belongs to.

Every tick saves at once through the board's authenticated web API at
content.krishraja.com: `ticks/<day>-<step>` (`done, at, day, piece_id, step,
channel, label`) and `links/<day>` (`article, youtube, at`), read back with
`board_web.py read <Monday> ticks` (or `links`). `week-board.json`, written
beside the page, holds the week, each day's state and piece, and every tick
id. Build with `--target web` (the default; `artifact` builds a legacy copy
for comparison only, since Claude artifacts were retired on 19 Oct 2026), run
`--verify`, then `board_web.py publish-web PAGE.html` for the dry-run
manifest and `--apply` once publishing is authorised (`docs/PUBLISH_BOARDS.md`,
"Update a board"). A rebuilt board keeps every tick, because the ids depend
only on the day and the step (`fixtures/week-board/published-2026-10-12.json`
holds a published board's tick ids and steps, and the test runs the page's
own script against a stand-in store); register each new Monday under
`config/boards.json` `web`. A session copies each channel tick onto the
piece with `making.py <piece> posted <channel> [url]`; Record is done from
the takes on the record, never from a tick.

