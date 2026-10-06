# Google Drive: what lives where

Read this before you create, move, rename or tidy anything in Krish's Google
Drive. Some folders are read by path by the home computers, and moving one
stops the work: a clean-up session moved the Studio's Inbox and the runner's
KeePass file on 2026-10-04 and broke both (walk log F63).

Every content folder sits under one parent, `04_Content`, in the
`krish@mindmake.co` Drive at `My Drive > Ventures > Active > Mindmaker >
04_Content`. The same map is kept in Drive as `READ ME FIRST - what goes
where.txt` at the top of `04_Content`; change both together.

Set out on 2026-10-06 (Krish: "All sales materials will go in the sales
materials folder", "I want you to create individual video scripts in this
folder", and the film folders "could be better organized... make sure the whole
system knows about the folder structure and where stuff's supposed to go").

## Never move or rename

These are bound by path. Renaming them, or any folder above them
(`Ventures`, `Active`, `Mindmaker`, `04_Content`), breaks a running system.

| Folder | Who reads it | What goes in it |
|---|---|---|
| `Video Engine` | the Studio runner on both home computers (`MINDMAKE_DRIVE_ROOT`, `config/studio.json`, `packages/core/src/paths.ts`, `docs/OPERATIONS.md`) | `Inbox`: new recordings, and only there. `Archive`: finished videos, one folder per video named by date, subject and where to post it (the Studio and `scripts/quick-edit` file them). `Inspiration`: reference clips (`inspo/README.md`). Never add anything else to the root. |
| `makeyourmindup` | the home computer that files each post's assets | `1 Brand kit (permanent)`, `2 Channel art (permanent)`, `3 Posts` with one folder per post. Its own `READ ME FIRST.txt` describes the inside. |

The runner's KeePass file, elsewhere on the H: drive, is bound by path too.

## Safe to tidy

| Folder | Drive id | What goes in it |
|---|---|---|
| `Sales Materials` | `1ylvMi9fn6hB5TNPDISGxXS7oQ-zHR61R` | Anything used to sell: decks, one-pagers, proposals, case studies, outreach templates. Krish drops things here. Never delete or overwrite; a new version sits beside the old with the date first in its name. `Email signature` (`1EQKpvfv1Z8mSZjzJ8o3mw2BkH8PCW7eU`) holds Krish's signature HTML and how to install it; its banner is served from makeyourmindup.ai (makeyourmindup `apps/cover/substack-kit/email-signature/`). |
| `One Off Content Ideas` | `1BWvWnv7hoE7Mv4IGt0m4EFo2wBf1MkbY` | Ready-to-record video scripts for the main channel, outside the three subchannels: durable, practical AI tips (building your AI brain, levelling yourself up, ways of thinking about AI). One Google Doc per script, numbered, plus `00 Index`. Their Markdown source and the research behind them are in `docs/one-offs/`. |
| `Films` | `1ytn_PH3wpnENsRiZTzyjoSj5uQpXJM5t` | Finished brand films, not channel posts: `1 Mindmake website films (delivered 2026-08-28)`, `2 Division films`, `3 Agent films`, `4 AI-enabled business films (2026-08-29)`. A new film set is the next number. |
| `Video Engine brief and architecture (reference only)` | `1zjVcPcXWLevgdWJcyWU3TNDTbIebV-OV` | The Studio's original brief and architecture, logos and voice briefs. Reading material; nothing reads it automatically. |

The parent `04_Content` is `1ELCdOmMGXWmLpuheEoAKA-_4jvYbmbn3`.

## Where a new thing goes

- A raw recording: `Video Engine > Inbox`.
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
