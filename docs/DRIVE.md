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
`Ventures`, `Active Ventures`, `makeyourmindup`, `00_Brand-Assets` above them)
makes their pass fail loudly in Control Center until `runtime` in
`config/studio.json` is updated to the new path. The IDs do not change on a
move or a rename. Never set `MINDMAKE_*_ROOT` or `MINDMAKE_MEDIA_INBOX` on a
home computer: `config/studio.json` rules, and a stale setting is reported.

| Folder (Drive ID) | Who reads it | What goes in it |
|---|---|---|
| `makeyourmindup > Video Engine` (`1pr9C_HYefYy2YTudoD8jHsPz7wftVFMW`; `H:\My Drive\Ventures\Active Ventures\makeyourmindup\Video Engine`). Inside it: `Inbox` `1H-PWmcwLkKCPHShBL6SYzsLzEbpa6795` (read by ID by the engine), `Archive` `1h8Ia7iUCEXK8u2iqep4YhLPWC0-WNnjJ` | the engine (the Inbox, by ID), the Studio runner on both home computers (`MINDMAKE_DRIVE_ROOT`, `config/studio.json`, `packages/core/src/paths.ts`, `docs/OPERATIONS.md`) | `Inbox`: new recordings, and only there: one file per cut, at the top (the upload lane never reads a subfolder), never music (the lane would send audio as a recording). `Archive`: finished videos and their thumbnails, one folder per piece named by date, subject and where to post it (the Studio and `scripts/quick-edit` file them). It must exist: `archive.py` and `make.py --archive` stop without it, and the Drive connector found no `Archive` there on 12 October (not yet checked on H:). If it is missing, Krish creates it; an agent never does. Never add anything else to the root. (Its old `Inspiration` folder is gone: Krish moved the reference clips to `Ventures > Inspiration > Production Inspo` on 2026-10-24.) |
| `Ventures > Inspiration` (`1AH8h5pBhkOhTzA4xA_5k0_1X8XDo9oLf`). Inside it: `Production Inspo` `1QxrzxISYFXq0er0DG0XSapm7qhvuRmh-` (`H:\My Drive\Ventures\Inspiration\Production Inspo`) and `Content Inspo` `1FNztJOU82M8zb6IIbUAbvuI6Kr0pF5Hu` (was `Cold Ideas & Inspo`; holds the `What I like` sheet) | the style references (`scripts/quick-edit/references.py`, `config/style-references.json`), the Drive inspiration scan (`cleo_inspiration_folder_id`, Content Inspo by ID), the taste ledger (krishanraja/inspirationhouse) and content-watcher on the home computers | Krish, 2026-10-24: "one for the content I like ... and one for production quality I like". `Production Inspo`: videos he likes the production of (style references; studied, never published). `Content Inspo`: posts, screenshots and research he likes the content of. content-watcher adds pasted links' media to one or the other and never deletes or overwrites. |
| `makeyourmindup > 00_Brand-Assets > 07_Music` (`H:\My Drive\Ventures\Active Ventures\makeyourmindup\00_Brand-Assets\07_Music`, Drive folder `1pmPWx8vTOZuUXkp-WjhLlCTvof8MrRxK`) | `scripts/quick-edit` on both home computers (`MINDMAKE_MUSIC_ROOT`, `runtime.music_root` in `config/studio.json`, `root_default_windows` in `config/music-library.json`). Krish, 2026-10-12: "thats where it will live and the video runners need to know this" | Licensed music tracks, each with its licence certificate beside it. A track is used only once it is in the ledger `config/music-library.json` and approved by Krish; nothing browses the folder for audio. Audio is never committed. |
| `makeyourmindup` (`1HHI0u24N3o3-yeprQzHdXVZtA7cNcKxh`; `H:\My Drive\Ventures\Active Ventures\makeyourmindup`). Inside it: `3 Posts` `17KdbFrZXKmGXkCaMpmntRD9rrAhnWkcT`, `00_Brand-Assets > 07_Music` `1pmPWx8vTOZuUXkp-WjhLlCTvof8MrRxK` | the library sync on the home computer that files each post's assets (`MINDMAKE_LIBRARY_ROOT`, `runtime.library_root`), and the recordings upload on both, which reads `Video Engine > Inbox` | `1 Brand kit (permanent)`, `2 Channel art (permanent)`, `3 Posts` with one folder per post; the sync writes only under these three. Also `Video Engine`, `Video Engine brief and architecture (reference only)` and `00_Brand-Assets`. Its own `READ ME FIRST.txt` describes the inside. |

The runner's KeePass file, elsewhere on the H: drive (likely `My Drive > KeePass`, folder `1CaLXl0TuFtZElxnAjItEw9pzRm1Si05X`, not confirmed on a machine), is bound by path too: KeePass opens a file, not a Drive ID.

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
- A licensed music track: `makeyourmindup > 00_Brand-Assets > 07_Music`, with its licence certificate beside it in the same folder (no subfolder). Then a session on a home computer adds it to the ledger with `scripts/quick-edit/music.py add`, and it is used once Krish approves it in words. Never the Inbox.
- A finished Make Your Mind Up post and its pieces: `makeyourmindup > 3 Posts`, in the post's own folder.
- A content idea, or a one-off main-channel script: `Ventures > Inspiration > Content Inspo` (Krish, 2026-10-24), where the inspiration scan reads it.
- Anything an AI session cannot place: `Inbox from My AI` at the top of his Drive, never loose at the top.
- Sales material: `Sales Materials`.
- A brand film: `Films`, next number.
- Nothing loose at the top of `04_Content` except the READ ME.

## Rules for agents

- Never move, rename or delete a folder in the first table yourself. If one
  looks wrong, tell Krish; do not fix it. When he moves one, update its path
  in `config/studio.json` `runtime` and here; its ID stays.
- Name a folder by its ID in code and config wherever the API allows it, with
  the path beside it only for what must go through `H:`.
- A cloud session reaches Drive through the Google Drive connector, which can
  create files and folders, rename and move them. It cannot see the H: mount;
  only the home computers can.
- Public copy never carries a Drive path (`NOW.md`, `never_publish`).
- Two writers outside the library sync are allowed, each by Krish's word. The
  library sync (AGENTS.md). And content-watcher (Krish, 2026-10-24: "Yes to
  Drive filing"): on his home computers, through the synced folders, it adds
  the media of links he pasted to `Ventures > Inspiration > Production Inspo`
  or `Content Inspo`. Add only: it never deletes,
  overwrites or renames, and it writes nowhere else.
