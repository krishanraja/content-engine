# Google Drive: what lives where

Read this before you create, move, rename or tidy anything in Krish's Google
Drive. Some folders are read by path by the home computers, and moving one
stops the work: a clean-up session moved the Studio's Inbox and the runner's
KeePass file on 2026-10-04 and broke both (walk log F63).

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

## Never move or rename

These are bound by path. Renaming or moving them, or any folder above them
(`Ventures`, `Active Ventures`, `makeyourmindup`, `00_Brand-Assets`), breaks a running
system until every path below and the environment on both home computers are
changed with it.

| Folder | Who reads it | What goes in it |
|---|---|---|
| `makeyourmindup > Video Engine` (`H:\My Drive\Ventures\Active Ventures\makeyourmindup\Video Engine`) | the Studio runner on both home computers (`MINDMAKE_DRIVE_ROOT`, `config/studio.json`, `packages/core/src/paths.ts`, `docs/OPERATIONS.md`) | `Inbox`: new recordings, and only there: one file per cut, at the top (the upload lane never reads a subfolder), never music (the lane would send audio as a recording). `Archive`: finished videos and their thumbnails, one folder per piece named by date, subject and where to post it (the Studio and `scripts/quick-edit` file them). It must exist: `archive.py` and `make.py --archive` stop without it, and the Drive connector found no `Archive` there on 12 October (not yet checked on H:). If it is missing, Krish creates it; an agent never does. `Inspiration`: reference clips (`inspo/README.md`). Never add anything else to the root. |
| `makeyourmindup > 00_Brand-Assets > 07_Music` (`H:\My Drive\Ventures\Active Ventures\makeyourmindup\00_Brand-Assets\07_Music`, Drive folder `1pmPWx8vTOZuUXkp-WjhLlCTvof8MrRxK`) | `scripts/quick-edit` on both home computers (`MINDMAKE_MUSIC_ROOT`, `runtime.music_root` in `config/studio.json`, `root_default_windows` in `config/music-library.json`). Krish, 2026-10-12: "thats where it will live and the video runners need to know this" | Licensed music tracks, each with its licence certificate beside it. A track is used only once it is in the ledger `config/music-library.json` and approved by Krish; nothing browses the folder for audio. Audio is never committed. |
| `makeyourmindup` (`H:\My Drive\Ventures\Active Ventures\makeyourmindup`) | the library sync on the home computer that files each post's assets (`MINDMAKE_LIBRARY_ROOT`, `runtime.library_root`), and the recordings upload on both, which reads `Video Engine > Inbox` | `1 Brand kit (permanent)`, `2 Channel art (permanent)`, `3 Posts` with one folder per post; the sync writes only under these three. Also `Video Engine`, `Video Engine brief and architecture (reference only)` and `00_Brand-Assets`. Its own `READ ME FIRST.txt` describes the inside. |

The runner's KeePass file, elsewhere on the H: drive, is bound by path too.

## Safe to tidy

| Folder | Drive id | What goes in it |
|---|---|---|
| `Sales Materials` | `1ylvMi9fn6hB5TNPDISGxXS7oQ-zHR61R` | Anything used to sell: decks, one-pagers, proposals, case studies, outreach templates. Krish drops things here. Never delete or overwrite; a new version sits beside the old with the date first in its name. `Email signature` (`1EQKpvfv1Z8mSZjzJ8o3mw2BkH8PCW7eU`) holds Krish's signature HTML and how to install it; its banner is served from makeyourmindup.ai (makeyourmindup `apps/cover/substack-kit/email-signature/`). |
| `One Off Content Ideas` | `1BWvWnv7hoE7Mv4IGt0m4EFo2wBf1MkbY` | Ready-to-record video scripts for the main channel, outside the three subchannels: durable, practical AI tips (building your AI brain, levelling yourself up, ways of thinking about AI). One Google Doc per script, numbered, plus `00 Index`. Their Markdown source and the research behind them are in `docs/one-offs/`. |
| `Films` | `1ytn_PH3wpnENsRiZTzyjoSj5uQpXJM5t` | Finished brand films, not channel posts: `1 Mindmake website films (delivered 2026-08-28)`, `2 Division films`, `3 Agent films`, `4 AI-enabled business films (2026-08-29)`. A new film set is the next number. |
| `makeyourmindup > Video Engine brief and architecture (reference only)` | `1zjVcPcXWLevgdWJcyWU3TNDTbIebV-OV` | The Studio's original brief and architecture, logos and voice briefs. Reading material; nothing reads it automatically. |

The first three are in `04_Content` (`1ELCdOmMGXWmLpuheEoAKA-_4jvYbmbn3`).

## Where a new thing goes

- A raw recording: the top of `makeyourmindup > Video Engine > Inbox`, one file per cut, any name. This is the one way a take comes back: Krish reads his scripts in teleprompter.com, which holds scripts only (Descript, set up for takes on 12 October, was retired the same day: "Descript is permanently gone"). It reaches the engine within about ten minutes, from whichever home computer is on, and that machine then places it on its piece and cut by itself (`scripts/post-pack/recording_match.py`, run by the recordings upload), asking Krish on the board only when it is unsure. `python scripts/post-pack/recording.py get NAME` fetches it, or `get "recordings/<sha256>.<ext>"` once it is on a piece. Nothing in the Inbox is moved or renamed by any of it.
- A licensed music track: `makeyourmindup > 00_Brand-Assets > 07_Music`, with its licence certificate beside it in the same folder (no subfolder). Then a session on a home computer adds it to the ledger with `scripts/quick-edit/music.py add`, and it is used once Krish approves it in words. Never the Inbox.
- A finished Make Your Mind Up post and its pieces: `makeyourmindup > 3 Posts`, in the post's own folder.
- A one-off main-channel script: `One Off Content Ideas`, next number, and a line in `00 Index`.
- Sales material: `Sales Materials`.
- A brand film: `Films`, next number.
- Nothing loose at the top of `04_Content` except the READ ME.

## Rules for agents

- Never move, rename or delete a folder in the first table. If one looks
  wrong, tell Krish; do not fix it.
- A cloud session reaches Drive through the Google Drive connector, which can
  create files and folders, rename and move them. It cannot see the H: mount;
  only the home computers can.
- Public copy never carries a Drive path (`NOW.md`, `never_publish`).
- Two writers outside the library sync are allowed, each by Krish's word. The
  library sync (AGENTS.md). And content-watcher (Krish, 2026-10-24: "Yes to
  Drive filing"): on his home computers, through the synced folders, it adds
  the media of links he pasted to `Video Engine > Inspiration` (videos) and
  `Cold Ideas & Inspo` (everything else). Add only: it never deletes,
  overwrites or renames, and it writes nowhere else.
