# Google Drive: what lives where

Read this before you create, move, rename or tidy anything in Krish's Google
Drive.

**Folders are found by ID, never by path, wherever the API allows it.** Krish,
2026-10-24, after renaming and moving most of his folders left both home
computers looking for the Inbox at its old path for two days: "Isn't there a
better way of doing this than the path name? Folders get renamed all the time
and moved all the time. Surely, the whole point of having a Google Drive is
that there's a specific ID for a specific folder." Offered A (the engine reads
the Inbox from Google by its ID) or B (the machines find it by a marker file),
he answered "A.", then: "can we do a check of anywhere the control-center or
content-engine interacts with Google Drive and ensure it is bulletproof and
correct everywhere?"

So the engine reads the Video Engine Inbox from Google by its folder ID every
ten minutes (`api/library/recordings/drive-inbox.ts`, the `recordings_drive_inbox`
job), whatever the folder is called and wherever it sits. What still reads a
path does so only because it must: ffmpeg reading takes, the library sync
writing, archive filing and the runner's KeePass file all work through the
local `H:` mount, which has no IDs. Each of those paths has its folder's ID
beside it (`config/studio.json` `drive_ids`, and the table below), so a moved
folder is found again by its ID in one lookup. Drive for desktop does not show
a folder's ID on `H:`, so a home computer cannot check a path against its ID;
instead each pass checks every path it uses is there and reports a missing
folder, a stale setting or an unreachable Inbox to the engine, where the `recordings_drive_inbox` job fails with the machine named
until it is fixed, so Control Center shows it. A clean-up session moved the
Studio's Inbox and the runner's KeePass file on 2026-10-04 and broke both
(walk log F63); that now fails loudly instead of quietly.

## The top of his Drive (Krish, 2026-10-24)

"Ventures is where everything now lives", in four parts: `Active Ventures`
(`1tu33N-waOHuxk_FK1sry0MHlw-iHf8NB`, every venture being worked on, one
folder each, kept up to date by the OS, Control Center and the AI harness
alongside krishanraja/filearchives), `Inspiration`
(`1AH8h5pBhkOhTzA4xA_5k0_1X8XDo9oLf`: `Content Inspo` and `Production Inspo`),
`Bugs & Issues` (`1i39_1K0KvJwNQt7AEfTI0pSwmdda6Iws`, what he notices on his
phone) and `_Archive`. Beside it at the top: `--ARCHIVE`, `Family Admin`,
`FamilyContentLibrary` and `KeePass` ("KeePass and FamilyContentLibrary are
immovable"), and `Inbox from My AI` (`1rQ7IXSFPYmYAmiv8FvMQzmPAnyytAx5S`),
where any AI session files something it cannot place ("just reinstate that in
the root folder then"); he files it from there. The record of this layout is
filearchives D-033; the Drive map other systems read is rebuilt from it by
krishanraja/hunter `drive-map --apply`, and Claude sessions' Drive guard
(control-center and hunter `.claude/hooks/drive_guard.py`) points at the
inbox. CURRENT and its 00_INBOX are gone.

Content ideas go in `Content Inspo` (`1FNztJOU82M8zb6IIbUAbvuI6Kr0pF5Hu`,
Ventures > Inspiration; Krish, 2026-10-24: "content ideas is" that folder).
The engine's inspiration scan reads every Google Doc there as inspiration.

## Where the publication's folders are

Two parents, both in the `krish@mindmake.co` Drive under `My Drive > Ventures
> Active Ventures` (folder `1tu33N-waOHuxk_FK1sry0MHlw-iHf8NB`, verified 2026-10-23):

- `makeyourmindup` (`1HHI0u24N3o3-yeprQzHdXVZtA7cNcKxh`), the publication as a
  venture of its own: the asset library and the Studio's `Video Engine`.
- `mind/make > 04_Content` (`1ELCdOmMGXWmLpuheEoAKA-_4jvYbmbn3`): sales
  material, one-off scripts, films.

Krish moved `makeyourmindup` up from `04_Content` to the ventures parent, with
`Video Engine` inside it, on 2026-10-07 ("the moves were made on purpose ...
update everything now"). Earlier notes called the parent `Active`; the current
Drive name and the mounted H: path are `Active Ventures`. The old path made the
library sync fail until the 2026-10-23 correction.
The map is also kept in Drive as `READ ME FIRST - what goes where.txt` at the
top of `04_Content`; change both together.

Set out on 2026-10-06 (Krish: "All sales materials will go in the sales
materials folder", "I want you to create individual video scripts in this
folder", and the film folders "could be better organized... make sure the whole
system knows about the folder structure and where stuff's supposed to go").

## Read by the engine and the home computers

The engine reads the Inbox by its ID, so renaming or moving it, or anything
above it, no longer stops recordings reaching the engine. The home computers
still reach these folders through `H:` paths; renaming or moving one (or
`Ventures`, `Active Ventures`, `makeyourmindup`, `1 Brand kit (permanent)` above them)
makes their pass fail loudly in Control Center until `runtime` in
`config/studio.json` is updated to the new path. The IDs do not change on a
move or a rename. Never set `MINDMAKE_*_ROOT` or `MINDMAKE_MEDIA_INBOX` on a
home computer: `config/studio.json` rules, and a stale setting is reported.

| Folder (Drive ID) | Who reads it | What goes in it |
|---|---|---|
| `makeyourmindup > Video Engine` (`1pr9C_HYefYy2YTudoD8jHsPz7wftVFMW`; `H:\My Drive\Ventures\Active Ventures\makeyourmindup\Video Engine`). Inside it: `Inbox` `1H-PWmcwLkKCPHShBL6SYzsLzEbpa6795` (read by ID by the engine), `Archive` `1h8Ia7iUCEXK8u2iqep4YhLPWC0-WNnjJ` | the engine (the Inbox, by ID), the Studio runner on both home computers (`MINDMAKE_DRIVE_ROOT`, `config/studio.json`, `packages/core/src/paths.ts`, `docs/OPERATIONS.md`) | `Inbox`: new recordings, and only there: one file per cut, at the top (the upload lane never reads a subfolder), never music (the lane would send audio as a recording). `Archive`: finished videos and their thumbnails, one folder per piece named by date, subject and where to post it (the Studio and `scripts/quick-edit` file them). It must exist: `archive.py` and `make.py --archive` stop without it. Its ID was verified in live Drive on 24 October (`config/studio.json` `drive_ids.archive_root`). If it is missing, Krish creates it; an agent never does. Never add anything else to the root. (Its old `Inspiration` folder is gone: Krish moved the reference clips to `Ventures > Inspiration > Production Inspo` on 2026-10-24.) |
| `Ventures > Inspiration` (`1AH8h5pBhkOhTzA4xA_5k0_1X8XDo9oLf`). Inside it: `Production Inspo` `1QxrzxISYFXq0er0DG0XSapm7qhvuRmh-` (`H:\My Drive\Ventures\Inspiration\Production Inspo`) and `Content Inspo` `1FNztJOU82M8zb6IIbUAbvuI6Kr0pF5Hu` (was `Cold Ideas & Inspo`; holds the `What I like` sheet) | the style references (`scripts/quick-edit/references.py`, `config/style-references.json`), the Drive inspiration scan (`cleo_inspiration_folder_id`, Content Inspo by ID), the taste ledger (krishanraja/inspirationhouse), content-watcher on the home computers, and its cloud backup through `POST /api/watch/upload` (`.github/workflows/watch-cloud.yml`) | Krish, 2026-10-24: "one for the content I like ... and one for production quality I like". `Production Inspo`: videos he likes the production of (style references; studied, never published). `Content Inspo`: posts, screenshots and research he likes the content of. content-watcher adds pasted links' media to one or the other and never deletes or overwrites. |
| `makeyourmindup > 1 Brand kit (permanent) > Music` (`H:\My Drive\Ventures\Active Ventures\makeyourmindup\1 Brand kit (permanent)\Music`, Drive folder `1oHyJ9A5et5_uKW7QTq1VHX0NuGwwQVri`; `00_Brand-Assets > 07_Music` until 11 November 2026, when Krish asked for one brand folder) | `scripts/quick-edit` on both home computers (`MINDMAKE_MUSIC_ROOT`, `runtime.music_root` in `config/studio.json`, `root_default_windows` in `config/music-library.json`). Krish, 2026-10-12: "thats where it will live and the video runners need to know this" | Licensed music tracks, each with its licence certificate beside it. A track is used only once it is in the ledger `config/music-library.json` and approved by Krish; nothing browses the folder for audio. Audio is never committed. |
| `Heartside > 03b_Social-Schedule`, named `05_Social-Library` until Krish renamed it on 2026-11-09 (`1AHZLgwj1nHemNJeP56fQU6iTpgIEALzZ`, found by that ID; fallback path `H:\My Drive\Ventures\Active Ventures\Heartside\03b_Social-Schedule`, in `config/heartside-library.json`, not `studio.json`) | the library sync on the home computer (`MINDMAKE_HEARTSIDE_LIBRARY_ROOT` overrides it on one machine); Codex, which posts from it | Heartside's social library (Krish, 2026-11-03: "Why don't you duplicate that Python script for Heartside then? We're going to need to do a lot more of this type of stuff moving forward"). The sync writes only under `Posts`, one folder per post id (`Posts/F01`). Beside it, the growth engine's Codex README, posting strategy and schedule Sheets, which the sync never touches. Found by ID (Krish, 2026-11-09: "ideally ID so if folders move it doesnt matter"): the engine reads the folder by its ID as its owner (`GOOGLE_DRIVE_OWNER`, read only), walks its parents up to My Drive, and returns the path on the Heartside `GET /api/library/pending` answer (`folder`, `api/library/_heartsideFolder.ts`); the sync maps `My Drive/...` onto the drive that holds My Drive (`Resolve-HeartsideRoot`). A rename or a move needs no change here. A folder deleted or in the bin stops the Heartside pass with `heartside_library_gone` or `heartside_library_trashed`; a found folder not yet on the H: drive stops it with `heartside_library_root_missing`. No folder is ever made. When Google cannot be asked, the configured path is used. If the folder is replaced by a new one, its ID goes in `drive_id` and `HEARTSIDE_LIBRARY_FOLDER_ID` (a test keeps them equal). |
| `makeyourmindup` (`1HHI0u24N3o3-yeprQzHdXVZtA7cNcKxh`; `H:\My Drive\Ventures\Active Ventures\makeyourmindup`). Inside it: `3 Posts` `17KdbFrZXKmGXkCaMpmntRD9rrAhnWkcT`, `1 Brand kit (permanent) > Music` `1oHyJ9A5et5_uKW7QTq1VHX0NuGwwQVri`, `6 Research library` `12FKoQhLlUkzwJDKYao95YIY_H_HQupS6` (the engine's mirror, below) | the library sync on the home computer that files each post's assets (`MINDMAKE_LIBRARY_ROOT`, `runtime.library_root`), and the recordings upload on both, which reads `Video Engine > Inbox` | `1 Brand kit (permanent)`, `2 Channel art (permanent)`, `3 Posts` with one folder per post; the sync writes only under these three. Also `Video Engine` and `Video Engine brief and architecture (reference only)`. `00_Brand-Assets` is gone (archived 11 November 2026, below). Its own `READ ME FIRST.txt` describes the inside. |

## The brand kit (Krish, 2026-11-11)

Krish: "We need a canonical Brand Kit for maximum consistency. Then ... the engine needs to know where to go to get whatever it needs at any time."

There is one brand kit: `makeyourmindup > 1 Brand kit (permanent)` (`1kOCNq1F-MD3u2SGvF8hoqUKo4DPnyuNi`). Every logo, colour, font, token, photo, template, sting and character pose comes from there, music included, never from `_Archive`. Its index is `00 START HERE - the brand kit index.txt` at the top of the kit; the machine-readable copy, with every Drive ID, is `social/brand/library.json` in krishanraja/growth-makeyourmindup. Where the kit and krishanraja/makeyourmindup (`apps/cover`, `docs/brandbooknew`, v1.5) disagree, that repository wins, and `config/ve/brand-tokens.json` carries it here.

| Inside the kit | ID | Read by |
|---|---|---|
| `guidelines` (brand book v1.5, and the 43-page component book of 27 Oct, whose page 4 swaps Monday and Wednesday: follow.the.money is Monday) | `1DF53eC7617qgDvOwcQPMuU3qrhOgd9AB` | people and briefs |
| `logos`, `colours`, `tokens`, `photography`, `artwork` | see the index | written from makeyourmindup by `scripts/post-pack/send.py --brand-kit` |
| `fonts` | `1hAVurHSWQmJuX0_rKnORNB4Iu_QAJHtN` | `config/ve/fonts.json` (by path) |
| `Intro sting` | `1qnaJkMPLKYoXVqVHEeRMfqn3kGQMWpH6` | `config/intro-sting.json` (by path) |
| `character/krish` | `1D2MfX8-dAftGxILc_uzssCI6-sjElsJa` | `config/ve/character.json` (by path) |
| `Music` | `1oHyJ9A5et5_uKW7QTq1VHX0NuGwwQVri` | The one home for licensed music (`runtime.music_root`, `config/music-library.json`). `music.py publish` sends it to the library so `music.py fetch` works on any machine; the sync finds each file already here with the same sha256 and writes nothing. |
| `Style references` | `1J4cWCWaAtdUMEEsUs27pdWm3H50jGSPC` | A mirror of `Production Inspo` (`references.py`). Never file a clip here by hand, never publish one. |
| `templates` (editable PowerPoint starters), `06_Claude-Design-System` (the Claude design system package of 8 Oct) | `1dHjwqwxZQ5XXa9-7I9LTFQD-9go4n1TD`, `1Au-j6KCBjzZCdI-cQsjAFhsE2PJ4LTGn` | people; nothing reads them automatically |

Moved out on 11 November 2026, and never to be read for current brand: `00_Brand-Assets` itself (its `07_Music` held the same six tracks as `Music`, byte for byte), the old copy of kit v1.5, the old channel art and launch exports, `CANVA-SOURCES.md`, `START-HERE.txt` and `Video formats (frozen 28 Oct 2026)`. All are in `_Archive > PREVIOUS VERSIONS - archive, not current, do not use > 2026-11-11 brand kit cleanup` (`1rBsiOrLfT_VZBy8oVb8uuwI9603TUcAO`). The Canva kit is `kAHZOJ-K6I8` (growth's `social/brand/kit.json`).

The runner's KeePass file, elsewhere on the H: drive (likely `My Drive > KeePass`, folder `1CaLXl0TuFtZElxnAjItEw9pzRm1Si05X`, not confirmed on a machine), is bound by path too: KeePass opens a file, not a Drive ID.

## The research library (Ruling, Krish, 2026-11-11)

Krish, 2026-11-11: "I also want to have a specific folder in Drive where all of the research from every post goes.
Sometimes it's done invisibly by a session and held in scratch ... or I send it through in a Markdown file. Either way
the underlying research that we do for each piece is quite deep and should be kept in a library because one of the most
important prospects that we have over time is connecting the dots on historical data."

`makeyourmindup > 6 Research library` (`12FKoQhLlUkzwJDKYao95YIY_H_HQupS6`) holds a readable copy of every piece's
research. It is a mirror, never a second record: the record is the engine's piece materials store
(`docs/PUBLISH_BOARDS.md`, "Sessions and materials"), which keeps every research document by its sha256, every version,
and never deletes one. Research is not brand, so it never goes in `1 Brand kit (permanent)`; it is not ready to post,
so it never goes in `3 Posts`.

| Inside the library | Found by | What it holds |
|---|---|---|
| `00 Index`, a Google Sheet | its ID, `1UejePwOc_6abqX1A3TrKXDZxej4C1OOvwVM3K3C29lo` | One row per document copied in: week, day, piece, series, kind, title, date added, Drive link, sha256, version, who added it, piece id and material id. One row per material: the sweep adds a row for each new copy and removes any later row for a material already listed. |
| One folder per week, named by its Monday (`2026-11-16`) | its `ce_week` property | The week's pieces and days. |
| Inside a week: one folder per piece (`Mon 16 Nov follow.the.money - Oracle files to sell $20B ... (8287846b)`), one per day with no piece yet (`Tue 17 Nov (no piece yet)`), and `Whole week` for the week's own research (the Sunday ideas sources) | its `ce_slot` property | Each research document as `<date added> <title>` (just `<title>` when the title already starts with a date, such as a recovered file's day; until 12 Nov 2026 those copies got the date added in front as well, and copies already made keep their names), the exact bytes the store holds, and `Sources` (its `ce_sources` property), the verbatim source excerpts the fact gate reads. |

**What is copied.** Every material on a piece, a day or a week whose kind is `research`, `corpus`, `note` or `paste` (a
paste is a verbatim source excerpt, filed in `Sources`), or whose role is `research`, `sources`, `corpus` or `notes`:
texts and files alike, never a link (a link's page is its own source) and never an archived material. A piece with no
date sits in the week its first research was filed. Each copy is the store's own bytes, so the file's sha256 in Drive
equals the store's, and its Drive description names the piece, the material, its version and sha256 and links the live
Publish Board at that week and day. A piece with no date links the board itself and says it has no day on it yet: its
folder's week is only the week its research was filed. Until 12 Nov 2026 such a copy linked that week (the week of 9
Nov for most of the 11 Nov backfill), where the piece is not; descriptions already in Drive are never rewritten.

**When.** The write that files it copies it at once and says so in its answer (`library`): `POST
/api/content-ideas/store` from the board, Control Centre's connector, `board_session.py` or a backfill. Everything else
(the working set's trigger, an import, a copy that failed) is copied by the sweep, `research_library_mirror`
(`/api/research-library/sweep`, hourly, in the run ledger), which leaves a material younger than ten minutes to the
write that filed it. Both are idempotent by the material: a copy already in Drive, binned ones too, is never made again,
and a row already in the index is never added again. A copy that fails loses nothing: the store still holds it and the
next sweep copies it.

**One writer at a time.** Five sweeps run by hand on 11 Nov overlapped, each read Drive and the index before the others
wrote, and together they made 118 extra copies and 250 extra index rows. Krish, 2026-11-11: "Yes bin": the 118 extra
copies are in the bin, and the sweep removes the extra rows (below). Every writer now holds the one lease, `research_library_mirror` in `engine_leases`
(migration `20261127100000_engine_leases.sql`), while it reads and writes: a second sweep, by hand or on the hour,
answers `skipped: already_running` with when the lease runs out and writes nothing (the run ledger records it as
skipped), and the write that filed a material waits up to ten seconds for it, then leaves the copy to the next sweep.
Inside the lease, each copy is looked for once more by its `ce_material` property right before it is made, and the
index's Material id column is read once more right before rows are added. Without the lease (the migration not
applied, the database down) a run writes nothing and fails.

**One row per material (Ruling, Krish, 2026-11-11).** The sweep keeps the index tidy by itself. Inside the lease, after
reading the index, it reads the whole sheet and removes every row whose Material id an earlier row already holds, in one
Sheets batchUpdate, bottom row first, so the first row of each material stays where it was. When that first row links a
copy that is in the bin or gone and a later row links the material's live copy, the same batchUpdate first puts the live
link on the first row. It never touches the header, a row whose Material id appears once, or a row with no material id.
It removes nothing, and fails the run so Control Center shows it, when the read looks short or malformed: a read that
does not start at the header, a header that is not the columns above, fewer rows than the materials the Material id
column listed a moment before, or a different set of materials. The run ledger counts what it removed as
`index_deduped` and the links it put right as `index_repaired`. The write that files one material never tidies; the
sweep does, within the hour.

**How.** The engine writes as the owner of his Drive (`GOOGLE_DRIVE_OWNER`, the delegated `drive` scope, as the feedback
lane does). In Drive it only adds: week, piece, day and `Sources` folders inside the library and files inside them. It
never renames, moves, overwrites or deletes anything there. In the index it adds rows, and its one other write is the
tidy above. Folders are found by their properties, never by name,
so Krish may rename or move any folder inside the library. The library and its index are found by the IDs above
(`RESEARCH_LIBRARY_FOLDER_ID` and `RESEARCH_LIBRARY_INDEX_ID` in `apps/control-plane/api/_researchLibrary.ts`, and
`folder_id` and `index_id` in `config/research-library.json`, which a test holds equal; not in `config/studio.json`,
whose contents are bound into the media standard's hash).
If the library is gone or in the bin, the sweep fails loudly and makes nothing; Krish makes the folder, never an agent.

**The rule for every session (Ruling, Krish, 2026-11-11).** Research is never left in scratch or a chat. A session files
every research document on its piece as it writes it (`add_piece_material`, or `python3 scripts/post-pack/board_session.py
PIECE add FILE --kind research`), and when Krish sends a Markdown file, it files it on the piece first. The write-back
block every copied board prompt carries says so (`apps/control-plane/api/board/_writeBack.ts`), and so do the plan-week,
make-piece and produce-video skills; `tests/control-plane/research-library.test.ts` holds all four to it.

**Research from before the rule, left on a computer.** `python scripts/recover_research.py all`, run once on each home
computer from the content-engine checkout (outside Codex's sandbox), looks through that computer's scratch folders,
the files git does not hold yet in its checkouts, and its Claude Code and Codex transcripts, lists every document that
looks like Make Your Mind Up research in `.scratch/research-recovery/found.tsv` (yes or no, with why), and files each
yes through the store's own route, so the library copies it. It reads and adds only; a transcript is never filed whole,
anything holding a key is never filed, and the same bytes filed twice add nothing (`tests/recover_research_test.py`).

**Research from before the store.** What sessions wrote before 11 November lives in git history and in the database
(the fact ledgers, deep dives and Teardown investigations on `content_ideas`). It reaches the library the same way as
anything new: filed into the store through the store's own route (source `backfill` or `repo`), never copied into
Drive by hand.

## Safe to tidy

| Folder | Drive id | What goes in it |
|---|---|---|
| `Sales Materials` | `1ylvMi9fn6hB5TNPDISGxXS7oQ-zHR61R` | Anything used to sell: decks, one-pagers, proposals, case studies, outreach templates. Krish drops things here. Never delete or overwrite; a new version sits beside the old with the date first in its name. `Email signature` (`1EQKpvfv1Z8mSZjzJ8o3mw2BkH8PCW7eU`) holds Krish's signature HTML and how to install it; its banner is served from makeyourmindup.ai (makeyourmindup `apps/cover/substack-kit/email-signature/`). |
| `One Off Content Ideas` | `1BWvWnv7hoE7Mv4IGt0m4EFo2wBf1MkbY`: gone (not found 2026-10-24). Content ideas now go in `Content Inspo` (above) | Ready-to-record video scripts for the main channel, outside the three subchannels: durable, practical AI tips (building your AI brain, levelling yourself up, ways of thinking about AI). One Google Doc per script, numbered, plus `00 Index`. Their Markdown source and the research behind them are in `docs/one-offs/`. |
| `Films` | `1ytn_PH3wpnENsRiZTzyjoSj5uQpXJM5t` | Finished brand films, not channel posts: `1 Mindmake website films (delivered 2026-08-28)`, `2 Division films`, `3 Agent films`, `4 AI-enabled business films (2026-08-29)`. A new film set is the next number. |
| `makeyourmindup > Video Engine brief and architecture (reference only)` | `1zjVcPcXWLevgdWJcyWU3TNDTbIebV-OV` | The Studio's original brief and architecture, logos and voice briefs. Reading material; nothing reads it automatically. |

The first three are in `04_Content` (`1ELCdOmMGXWmLpuheEoAKA-_4jvYbmbn3`).

## Where a new thing goes

- A raw recording: the top of `makeyourmindup > Video Engine > Inbox`, one file per cut, any name. This is the one way a take comes back: Krish reads his scripts in teleprompter.com, which holds scripts only (Descript, set up for takes on 12 October, was retired the same day: "Descript is permanently gone"). It reaches the engine within about ten minutes, from whichever home computer is on, and that machine then places it on its piece and cut by itself (`scripts/post-pack/recording_match.py`, run by the recordings upload), asking Krish on the board only when it is unsure. `python scripts/post-pack/recording.py get NAME` fetches it, or `get "recordings/<sha256>.<ext>"` once it is on a piece. Nothing in the Inbox is moved or renamed by any of it.
- A licensed music track: `makeyourmindup > 1 Brand kit (permanent) > Music` (no subfolder). Then a session on a home computer adds it to the ledger with `scripts/quick-edit/music.py add`. Never the Inbox. Ruling (Krish, 2026-11-04): a track Krish puts in the music folder (then `07_Music`) is licensed and approved; never ask him about its licence or approval ("They all have licensing. Never ask these questions ever again."). Series pieces (Monday, Wednesday, Friday) use `no-curves-instrumental` only; off-day content rotates through the tracks marked `for: off-day` in `config/music-library.json` (Goodie Bags, Aspire, Illusions, Be Alone). A new track he adds is off-day unless he says otherwise.
- A finished Make Your Mind Up post and its pieces: `makeyourmindup > 3 Posts`, in the post's own folder, the one
  home for everything ready to post (see below).
- A content idea, or a one-off main-channel script: `Ventures > Inspiration > Content Inspo` (Krish, 2026-10-24), where the inspiration scan reads it.
- A piece's research (a corpus, sources, notes, a deep-research result, a Markdown file Krish sends): on the piece in the
  engine's store (`add_piece_material` or `board_session.py PIECE add`); its copy in `6 Research library` follows by
  itself. Never filed in the library by hand, never left in scratch.
- Anything an AI session cannot place: `Inbox from My AI` at the top of his Drive, never loose at the top.
- Sales material: `Sales Materials`.
- A brand film: `Films`, next number.
- Nothing loose at the top of `04_Content` except the READ ME.

## One filing home for finished assets: 3 Posts (Ruling, Krish, 2026-11-03)

Krish, 2026-11-03: "everything ready for post goes in the posts folder, not the growth folder". Everything ready to
post, off-day posts included, goes in its post's own folder under `makeyourmindup > 3 Posts`; nothing is filed into
`4 Growth` (Growth's own delivery folders) by this engine. A cut is called filed only when `ve status` reads its
`3 Posts` copy back with the approved hash (`delivered: DONE <path>`), and a finished off-day card on the publish board
says "Not in its 3 Posts folder yet" until it links that folder. Asked to put something in Drive, the session puts it
there, reads it back and replies "Done" with the link (`config/failures.json` F27, F29).

## Rules for agents

- Never move, rename or delete a folder in the first table yourself. If one
  looks wrong, tell Krish; do not fix it. When he moves one, update its path
  in `config/studio.json` `runtime` and here; its ID stays.
- Name a folder by its ID in code and config wherever the API allows it, with
  the path beside it only for what must go through `H:`.
- A cloud session reaches Drive through the Google Drive connector, which can
  create files and folders, rename and move them. It cannot see the H: mount;
  only the home computers can.
- The connector takes a file's bytes only inline, so it cannot file a picture or
  a video. For those, a cloud session uses the n8n workflow "Drive file uploader
  (cloud sessions)" (Krish, 2026-11-09: "make sure this N8N uploader is the
  backup for whenever this problem occurs again in the future"): POST the raw
  bytes to its webhook with `?parent=<folder id>&name=<file name>` and the
  file's content type; the reply is Drive's own record of the file, so compare
  its `sha256Checksum` with the local file before calling it filed, then read it
  back with the connector. The webhook's address is its only lock, so it is never
  written in this repository: read it from the workflow through the n8n
  connector (`search_workflows`, then `get_workflow_details`). It uploads with
  the n8n "Google Drive account" login and only adds files; it never deletes or
  overwrites.
- Public copy never carries a Drive path (`NOW.md`, `never_publish`).
- Three automatic writers are allowed, each by Krish's word. The research library's mirror (above; Ruling, Krish,
  2026-11-11), which adds folders, files and index rows inside `6 Research library` only, and removes a later index row
  for a material already listed. The library sync
  (AGENTS.md), which writes the makeyourmindup library and, since
  2026-11-03, Heartside's `03b_Social-Schedule` (then `05_Social-Library`) under `Posts` only. And content-watcher (Krish, 2026-10-24: "Yes to
  Drive filing"): on his home computers, through the synced folders, it adds
  the media of links he pasted to `Ventures > Inspiration > Production Inspo`
  or `Content Inspo`. Add only: it never deletes,
  overwrites or renames, and it writes nowhere else.

## Post folders are bound to their pieces (W3.5)

A post's folder in `3 Posts` is bound to its piece: the piece's making record holds it (`pack.folder`). Its name freezes
at the first send (`pack.sent_at`): `send.py` refuses the same piece under any other folder name. A canary, test,
smoke-test, dry-run or fixture post is refused by the library's path rule (`path_test_folder`), and a rendered video
inside a post goes only in `3 Video` (`path_render_outside_video`), in `scripts/post-pack/library.py` and the engine's
routes alike. `python3 scripts/post-pack/post_binding.py report --records R --files F` flags any piece spread across
folders and any folder no piece holds; Krish consolidates by hand (Monday 26 is his), and the report confirms it.
