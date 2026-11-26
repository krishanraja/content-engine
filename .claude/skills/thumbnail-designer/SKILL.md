---
name: thumbnail-designer
description: "Design a piece's video thumbnails, wide 16:9 and tall 9:16, once the packaging round has settled the thumbnail words after Krish records: a short brief first, two or three options in the week's one skin as the Receipt, the channel and title checks on each, a mock of his Instagram grid beside the last five posted covers, a verdict from a separate critic bound to each file's sha256, then the set on his final review and his pick recorded in his own words. Use when produce-video step 5 calls it, or when Krish asks for a recorded piece's thumbnails or covers to be designed again. Not for the working thumbnails drawn before he records (make-piece, the Visual gate row), carousel cards, memes or Notes images."
model: opus
---

# Design the thumbnails

The one job: once the words for the thumbnail are settled (house rule TITLES_AFTER_RECORDING: they are chosen in the
packaging round, after he records), draw two or three options, judge them with a reader that did not draw them, and
put them in a mock of his grid on his final review, where his pick is recorded in his words. Nothing is filed as
the thumbnail before he answers there.

Every option is held to these, and none of them is the session's to relax:

- **THUMBNAIL_EVERY_SIZE** (Krish, 2026-10-12: "I always want a video thumbnail for all video sizes produced as an
  asset every time"): wide 1280 x 720 for the long cut, tall 1080 x 1920 for the short cut, both or neither.
- **THE LIBRARY.** Every option is filled from the approved Library's Receipt templates (`cover-receipt-youtube`,
  `cover-receipt-tall`) with `python3 scripts/library/make_piece.py <piece> --set video`. Read
  `docs/ve/cards/library/ART-DIRECTION.md` first, then `LIBRARY-GUIDE.md` and `PRODUCTION-PLAYBOOK.md`. The old drawer
  (`scripts/pages/build.py --thumbs`, the skins) is retired and refuses without `--legacy`, which is only for an
  archived piece.
- **THE_RECEIPT** (Krish, 2026-11-02: "inviolable"): the piece's checked proof named in its facts, the
  wordmark and the real logos; never his face, never a frame from a take.
  On his own accounts (TikTok, X, LinkedIn, Threads, Substack Notes) and the face arm of the YouTube test, the cover is
  face-led instead: his cutout headshot large, drawn by Codex from a `ve card` of kind `cover`, never a frame from a take
  (Ruling, Krish, 2026-11-17: "yes to the face plan"; `docs/production/COVER-STANDARD.md`, "Face-led covers").
- **The cover standard** (`docs/production/COVER-STANDARD.md`, approved 9 Nov: "approve the cover standard as
  written"): read it whole. The headline leads, at most 7 words; at most three parts besides it; logos only for the
  companies the headline or the picture names; no badges; a quiet series label; bright over dark; checked where it is
  seen; two or three options, never one. Its 15 Nov ruling: every posted video carries its designed cover, and a tall
  cover's words never use "they", "it" or "this" for a name.
- **No skins.** The weekly skins and v5_feed are retired (`config/retired-styles.json`); a Library record wears none.

## Before anything

1. `python3 scripts/check_failures.py --piece <piece>`, `python3 scripts/floor.py --format thumbnail --piece <piece>`
   and `--format cover`, then `python3 scripts/preflight.py <piece> --skill thumbnail-designer`. Read Krish's approved
   taste for makeyourmindup (`get_approved_taste`) where the connector offers it.
2. The words are the packaging round's: his `picked` verdict, else its top-ranked line as the default
   (`title_check.py verdict ... --surface thumbnail` or `tall_cover`). A drawer refusal: "Allowed asks".
3. Read `.agents/skills/thumbnail-designer/references/drawing.md` (the facts, the logos, the machine) and
   `.agents/skills/thumbnail-designer/references/reference-library.md` (the inspiration cards) before the brief, and
   read his thumbnail reference set as it says (`GET /api/inspiration/candidates?role=thumbnail`) before drawing.

## 1. The brief, first

Write `WORK/thumbs/brief.json` before any option is drawn, as
`.agents/skills/thumbnail-designer/references/brief.md` says: the one promise the thumbnail makes, where the piece
supports it, the claims it must avoid, the exact words, the companies the headline or the picture names, and the
reference cards actually looked at. The drawer refuses a brief that is missing any of them or whose words are not
the ones drawn.

## 2. Two or three options

Each option is one Library fill. Write each option's facts (a copy of the cover facts that differs in the words his
packaging round allows, `"library": {"headline": [...]}`, or the companies it shows, nothing else) and fill it:

```
python3 scripts/library/make_piece.py WORK/thumbs/options/<id>/cover-facts.json --set video --out WORK/thumbs/options/<id>
```

Each writes the option's two files and `thumbs/thumbs.json` (the Library record) under `WORK/thumbs/options/<id>/`.
The old `--options` drawer wrote `thumb-options.json` and the grid mock; it is retired, and `thumb_options.py` does
not yet read Library records, so until it does, write the set by hand and hold the grid mock as a final-review line.
`--past` is each of the last five posted covers, newest first, read on this machine (`references/drawing.md`, "The
last five posts"); with none, the mock shows the options alone and says so. Never fake a past post.

## 3. Check each option

- `python3 scripts/channel_safe.py WORK/thumbs/options/<id>/thumb-tall-1080x1920.jpg --shape cover_tall` (F43: the
  grid crop and the account row). Exit 2 means it did not run (no tesseract): say so; it is never a pass.
- `python3 scripts/post-pack/title_check.py "THE WORDS" --surface thumbnail --source <the piece's body or script>`,
  and again with `--surface tall_cover`.
- `python3 scripts/pages/thumb_options.py show WORK/thumbs`: the words, the parts and any logo the brief does not name.
- Look at every file at full size, and at the grid mock, yourself, against the QA list
  (`.agents/skills/thumbnail-designer/references/qa.md`).

## 4. The critic

Start the `thumbnail-critic` subagent (`.claude/agents/thumbnail-critic.md`): a fresh reader on Opus that drew
nothing. Give it the paths it asks for and nothing of your own judgment. Save its JSON answer and write the verdict:

```
python3 scripts/pages/thumb_options.py verdict WORK/thumbs WORK/thumbs/critic.json --reviewer thumbnail-critic
```

It refuses a verdict that skips an option, names bytes that are not the set's, or comes from the reader that drew
them. Where no separate reader can be started (a Codex run), the set is held for the next Claude Code session: the
drawer never judges its own options.

## 5. Repair, at most twice, then hold

When the verdict blocks every option, or the best one fails a check, change the facts (a crop, a layout) and draw a
new set; a new set needs a new verdict. At most two rounds of repair. Then hold: record the set and its verdict
(`making.py <piece> thumbnails WORK/thumbs`, no `--ask`), record the reason as a final-review line, and
carry on with the cuts. Never put options below the bar to him.

## 6. On the final review

Follow `.agents/skills/thumbnail-designer/references/board-pick.md` for the filing: it files the review copies in
Drive and records the set with their Drive ids so his board shows every option with Pick and Not this (view contract
1.16.0; Ruling, Krish, 2026-11-15, approved with the specialists plan: thumbnail options carry a pick press on the
Content board). In short:

1. `python3 scripts/pages/thumb_options.py drive WORK/thumbs a:wide=ID a:tall=ID ... mock=ID`, after filing each in
   Inbox from My AI.
2. `python3 scripts/post-pack/making.py <piece> thumbnails WORK/thumbs` (the set, its verdict and those ids, by sha256).
3. `python3 scripts/post-pack/board_session.py <piece> add ...` for each file and the grid mock.
4. One final-review line, the critic's best as the default (never `--ask`):
   `python3 scripts/post-pack/making.py <piece> final-review thumbnail "Option B, the critic's best"`.
5. His Pick at the final review is on the record by itself; his Not this sends you back to step 5 with his words. An
   answer in a session: `making.py <piece> thumbnails WORK/thumbs --picked b --krish-words "Krish, YYYY-MM-DD: his words"`.

Until his pick is on the record nothing is the thumbnail: `making.py video` refuses an option's file he has not
picked, and no option is filed, posted or put in the manifest. The cuts never wait: they render, archive and file,
and reach the library with his pick.

## 7. After his pick

His option's folder is the thumbnail set: `WORK/thumbs/options/<his pick>/` wherever produce-video steps 6 to 9 say
`WORK/thumbs/`. Write his option's words and companies into the cover facts and fill the covers with
`make_piece.py <piece> --set covers`, so every shape matches what he picked. Each video channel's cover in the piece manifest is his tall (tall cut) or wide
(wide cut) file.

## Where the standard and the gates differ

None open. `visual_gate.py` follows the cover standard: at most three logos, only of companies the piece names, and
`config/hook-playbook.json` describes the Receipt: at most 7 words over a real proof, no face (Rulings, Krish,
2026-11-15). A new difference between the standard and a gate is a final-review line; never settle it yourself.

## Allowed asks

Only the four in `config/ve/asks.json` (Ruling, Krish, 2026-11-19: no approvals during production). Never ask before
the final review: decide, record, carry on (`.agents/skills/ve/references/allowed-asks.md`, drawer refusals too).

## Walls

Nothing here sends, posts, publishes or spends. No outside image enters the repository. The thumbnail reaches the
post's folder in Drive only through `send.py` after his pick (produce-video steps 7 and 8); before it, the options go
to Drive only as review copies in Inbox from My AI, so his board can show them (step 6).
