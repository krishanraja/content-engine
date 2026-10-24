# Handover: read the Inbox by its Drive ID, and make every Drive touchpoint fail loudly

Written 24 October by the session locking Friday's piece, which found the fault while fetching Friday's takes. This
job is separate from Friday; do not touch Friday's piece.

## Start the new session with

> Pick up docs/handovers/2026-10-24-drive-by-id.md. Make the engine read the Video Engine Inbox from Google by its
> folder ID, and fix every Drive touchpoint the audit found.

## What went wrong (verified 24 October)

- Krish renamed and moved most of his Drive folders. `Ventures\Active` became `Ventures\Active Ventures`.
- Both home computers held the user environment variables `MINDMAKE_MEDIA_INBOX`, `MINDMAKE_DRIVE_ROOT` and
  `MINDMAKE_ARCHIVE_ROOT` with the old `Active` path. `scripts/recordings-upload.ps1` (`Resolve-MediaInbox`) takes the
  env var before `config/studio.json`, which PR #141 had already corrected on 23 October.
- From 22 to 24 October every pass logged "the Inbox ... cannot be reached" into a hidden task's local log, and
  nothing else saw it. Six Friday files sat in the Inbox for five hours.
- Fixing the env var was not enough: the task is one long `-Loop` process with `MultipleInstances IgnoreNew`
  (`scripts/install-recordings-upload.ps1:87-103`), so it kept the old environment. `Start-ScheduledTask` was refused
  (result 0x800710E0) until the machine restarted.
- Also seen: right after a restart the first pass ran before Google Drive mounted `H:` and failed once.

## Krish's decision (24 October)

> "Isn't there a better way of doing this than the path name? Folders get renamed all the time and moved all the
> time. Surely, the whole point of having a Google Drive is that there's a specific ID for a specific folder."

Offered A (the engine reads the Inbox from Google by its ID, read-only, no home computer needed) or B (the machines
find the Inbox by the `.mindmake-inbox-id-v1.json` marker). His answer: **"A."** Then: "I recently moved more or less
all of my Google Drive folders, can we do a check of anywhere the control-center or content-engine interacts with
Google Drive and ensure it is bulletproof and correct everywhere?"

Record both as one entry in `config/learnings.json` (say nothing twice), with the markers that enforce it, and put
`Ruling (Krish, 2026-10-24): Drive folders are found by ID, never by path, wherever the API allows it` in the commit
body. `docs/DRIVE.md` says the Video Engine folder "is read by path and never moves"; that rule changes with his
words above.

## The work

1. **Option A, the Inbox by ID.** The Inbox is Drive folder `1H-PWmcwLkKCPHShBL6SYzsLzEbpa6795` (chain: Video Engine
   `1pr9C_HYefYy2YTudoD8jHsPz7wftVFMW` > makeyourmindup `1HHI0u24N3o3-yeprQzHdXVZtA7cNcKxh` > Active Ventures
   `1tu33N-waOHuxk_FK1sry0MHlw-iHf8NB` > Ventures `1xlwKSmE9YaMalMHSwk-Fvoyu8U35ByyE`). Design a cloud job that lists
   that folder by ID through the Drive API and copies each new file into the engine's recordings store keyed by
   sha256, exactly as `/api/library/recordings/confirm` records it today, so `recording.py`, `recording_match.py` and
   `produce-video` need no change. Read-only Drive scope on that one folder. The engine has no Google credential yet:
   propose the narrowest one (a service account the Inbox is shared with, viewer only), write the steps Krish takes,
   and **stop for his approval before any credential, secret or permission is created** (canon: authority). Keep the
   home computers' upload as the fallback until the cloud job has carried one real take end to end. The Drive
   connector caps downloads at 10 MB; the Drive API itself does not.
2. **Fail loudly, everywhere.** A missing folder must reach the engine and Control Center, not only a local log:
   - `recordings-upload.ps1`: when the env var's path is missing but `studio.json`'s exists, use `studio.json`'s and
     report the stale env var; report "Inbox unreachable" to the engine (heartbeat or a board item that closes on a
     check), and retry once after a short wait on the first pass after boot (Drive mounting).
   - `packages/core/src/paths.ts:16-23` accepts any stale env path and never reads `studio.json`; `doctor.ts:78-86`
     only warns.
   - Music, style-reference and working-files publishing swallow errors by design
     (`recordings-upload.ps1:570-582`); keep the pass going but surface the failure.
   - Library sync errors only reach its own hidden log. `recording_match.library_roots` falls back silently.
   - Restarting the loop: the install scripts or the upload itself should pick up a changed setting without a
     machine restart (for example, re-read env from the registry each pass).
3. **Stale references the audit found (all verified against live Drive on 24 October):**
   - control-center `system_config.drive_destinations` (read by `.claude/hooks/drive_guard.py:43-72`): `roots.CURRENT`
     `1O4zvfcZyEM2t96GyCMafmMAnD27zmtoJ` and `inbox` `1c-8CZi0se3baLn3it4LJ97PDsD0UcvhJ` no longer exist; ARCHIVE is
     now "--ARCHIVE", FAMILY-ADMIN "Family Admin", ContentLibrary "FamilyContentLibrary" (IDs still resolve). Ask Krish
     where Claude sessions should now write before changing it.
   - control-center `briefing_drive_folder_id` / `drive_folders.speaker_briefings` `1AQ84HCrPx_KVUky-TM-J7-RyvFWEauwg`
     is gone; Nell's live workflow dropped its Drive writer on 5 October but
     `scripts/n8n/nell-guest-speaker-briefing.workflow.json:465` still holds it.
   - control-center inactive n8n exports (cleo-omnichannel-content-factory, agatha-state-of-union-weekly:531,
     zara-layer-1-signal-inbox-drive-watcher:17): every folder ID is gone. Mark them dormant; do not reactivate.
   - control-center `cleo_inspiration_folder_id` `1FNztJOU82M8zb6IIbUAbvuI6Kr0pF5Hu` still resolves but is now named
     "Content Inspo" directly under Ventures; `docs/app/inspiration/README.md:9` and `drive_destinations.top_level`
     still say "Cold Ideas & Inspo".
   - content-engine `docs/DRIVE.md:48` "One Off Content Ideas" `1BWvWnv7hoE7Mv4IGt0m4EFo2wBf1MkbY` is not found.
   - Correct today, path-based, and fragile: `config/studio.json:88-92`, `scripts/post-pack/working.py:55-67` (assumes
     Video Engine sits inside makeyourmindup), archive, music (`config/music-library.json` already holds 07_Music's ID
     `1pmPWx8vTOZuUXkp-WjhLlCTvof8MrRxK`), Inspiration `1eqdc1hoMn6CwqkbKlG5mAmKCYNoR8otU`, 3 Posts
     `17KdbFrZXKmGXkCaMpmntRD9rrAhnWkcT`, Archive `1h8Ia7iUCEXK8u2iqep4YhLPWC0-WNnjJ`. Write each folder's ID beside its
     path in `studio.json` and `docs/DRIVE.md`, and have the machines check the path against the ID at start.
   - Cannot be ID-based: anything on the local `H:` mount (ffmpeg reading takes, library sync writing, archive filing,
     the runner's KeePass file, likely under `H:\My Drive\KeePass\`, folder `1CaLXl0TuFtZElxnAjItEw9pzRm1Si05X`).
4. **Machine side, for Krish (cannot be done from the cloud).** Recommend deleting the `MINDMAKE_*_ROOT`,
   `MINDMAKE_MEDIA_INBOX`, `MINDMAKE_POSTS_ROOT` and `MINDMAKE_INSPIRATION` user env vars on both machines so
   `studio.json` and the code defaults rule; restart the scheduled tasks after any change. On 24 October the primary
   machine's three values were corrected to `Active Ventures` and it was restarted; the second machine's state is
   unconfirmed. The primary also logs "the pinned Python is not at
   ...\MindmakeVideoStudio\runtime\python\Scripts\python.exe (npm run bootstrap:python)", so it does not place takes.

## Done means

One real take dropped in the Inbox reaches `recording.py list` through the cloud job with both home computers off;
every item in section 3 is fixed or explicitly left with a reason; a stale path on a machine shows up in Control
Center within one pass; `npm run verify` green; a pull request with auto-merge (and one in control-center for its
items); `NOW.md` and `WORKBENCH.md` updated.
