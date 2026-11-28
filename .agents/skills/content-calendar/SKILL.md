---
name: content-calendar
description: "Make a week's content calendar as one clickable page someone outside the engine can review: a Sunday-to-Saturday week view where each day opens its dashboard with three tabs (the idea, the road to ready, and the visuals: branded mocks of that piece at every asset size, built around real frames of Krish from his own published cuts). Use when Krish asks for a content calendar, a week preview, a visual board of the upcoming week, or something to show his partner, a collaborator or Growth what the week will look like. Not for the publish board itself (Control Centre's Content tab), the shipped covers (cover-art) or carousels (carousel)."
model: opus
---

# Make the week's content calendar

Krish, 28 Nov 2026, asking for this: "these need to be proper mocks, and look like an actual calendar she can click on
each day to bring up its dash, with different tabs for content idea + where it needs to go from here to be ready,
visuals (real branded mocks for that piece, not just templates, with every asset size)." And the bar it is held to:
"She says my content needs to feel more human and less like AI slop - like me explaining something with natural
visuals". Then: "encode how to make this calendar as a skill ... capable of one shot calendar production".

One command drafts the data from the live board, one renders the page. Everything the page says lives in
`docs/plans/<Monday>-week/calendar.json`; `scripts/calendar/make_calendar.py` draws it. The first one made is the week
of 30 Nov 2026 (`docs/plans/2026-11-30-week/calendar.json`): read it as the worked example before writing a new one.

## What it is, and what it is not

- A review page for someone who is not in the engine: what goes out each day, why it matters, what is left to do, and
  what each asset will look like. It reads the board; it never changes it, posts, sends or schedules anything.
- The mocks are drafts in the v5 look (`config/brand-palette.json`), drawn around Krish. The files that ship still come
  only from `scripts/covers/make_covers.py` and `scripts/library/make_piece.py` after he records and picks his words;
  the page says so on every Visuals tab.
- One self-contained HTML file (images embedded) handed to Krish with `SendUserFile`. Never a Claude artifact: they are
  retired (AGENTS.md rule 3) and `scripts/hooks/artifact_gate.py` refuses one. He shares the file himself.

## Steps

1. **Which week.** The next seven days from today, Sunday to Saturday: the Monday is the next Monday (or today's, on a
   Monday). Read that week's live board view first (`python3 scripts/post-pack/live_board.py <Monday>` prints its link)
   so you know what he approved; only approved pieces and approved off-day posts go on the calendar.
2. **Draft.** `python3 scripts/calendar/make_calendar.py draft <Monday> --out docs/plans/<Monday>-week/calendar.json`
   (add `--view <file>` to use a saved view). It fills every approved piece from the weeks' `ideas.json`: the question,
   the one line, the opening line, three examples, the source, the carousel cards in their approved words, the off-day
   choices still open, and Saturday's weekly email. It prints the heroes that still need mock words.
3. **Finish each hero** in the JSON, checking every line against the piece's own source:
   - `mock.wide`: two short lines for the YouTube thumbnail and Substack cover, the claim in his register; `accent` is
     the words that take the mint highlight. `mock.kicker`: three short lines for the 9:16 cover; `kicker_accent` is
     the line highlighted.
   - `mock.proof_tag` and `mock.proof`: a real line from the source, with the outlet and date, for the proof card in
     the long-video frame. `mock.figure`: one sourced number with its caption and source, for the tall thumbnail.
     `mock.caption`: the spoken words on screen in the short.
   - `human`: how this piece shows Krish explaining with natural visuals: him on camera in his own room, real objects,
     real receipts, the actual thing in his hands. Start from the option's `style.experiment.why`; the page labels it a
     suggestion until he agrees the look. Never a prediction, odds or a dated call (Krish, 2026-11-24).
   - `krish`: which frame of him (`k1` to `k6`); `photo` and `photo_tall`: a Wikimedia Commons file title, or null.
   - No invented numbers, lengths, quotes or dates. Plain English, no em dashes, no "Not X, Y".
4. **Frames of Krish.** Six stills of him explaining, from his own published cuts, cropped to him with no old captions,
   corner logos or series labels (they are retired), saved as `k1.jpg` to `k6.jpg` in a working folder. The sign-off
   stills in `config/ve/sign-offs.json` (items and `retired`) are frames of his cuts in his Drive by file id: fetch a live
   one with `GET /api/board/sign-offs?file=<id>` on the engine, or any of them with the Drive connector's
   `download_file_content`. The 30 Nov page used the Mon 26 Oct tall frames cropped from 58.5% of the height down, and
   the left panel of the Wed 4 and Mon 2 Nov wide frames from 12% down. Never a generated or AI person.
5. **Photos (optional).** Natural photographs of the actual thing in the story, never generated: Wikimedia Commons only,
   CC0, public domain, CC BY or CC BY-SA, credited on the page. The environment must allow `commons.wikimedia.org` and
   `upload.wikimedia.org`. Ask the API for each file's `imageinfo` (url, licence, artist), then download its thumbnail
   at a standard width (960 or 1280 px) one at a time with pauses: Commons answers 429 to bursts and to non-standard
   sizes, and on 28 Nov it refused this route for hours. Write `commons.json` as `{title: {file, artist, lic}}` beside
   the photos. Without a photo the page draws that slot around Krish instead; it never stalls on one.
6. **Render.** `python3 scripts/calendar/make_calendar.py docs/plans/<Monday>-week/calendar.json --krish <frames>
   --photos <commons.json> --out <scratchpad>/makeyourmindup-calendar-<Monday>.html`. It refuses while a hero lacks its
   mock words, and lists any photo it drew without.
7. **Look at it before he does.** Open it in Playwright at 1440 by 900 and 390 by 844, fresh page per view (a hash
   change alone does not reopen a day: `#<date>/<tab>/<piece>`, tab `idea`, `road` or `visuals`). Click every card in
   the week and confirm the dashboard opens that card's own piece, not the day's first (Krish, 28 Nov: "clicking this
   opens up the wrong piece"). Check the week view, one day's three tabs, a carousel day and the phone. Nothing scrolls sideways, no headline overlaps its picture, every
   highlight sits on its words, every photo credit shows, every sentence is true to its source.
8. **Hand it over.** Send the HTML with `SendUserFile` (display render), say in a short table what is on each day, and
   name anything you could not finish (a missing photo, a day still waiting on his pick). Commit `calendar.json`; never
   commit the frames, photos or the page (media stays out of the repository).

## Where the road-to-ready steps come from

The steps are the engine's real route (`.agents/skills/make-piece/SKILL.md` for a piece, `carousel` for a carousel,
`weekly-edition` for the email), written in plain words with who does each. The draft marks research done when the
board's detail shows a research record; Krish's approval is done because only approved items are on the calendar.
Everything else is to do, and the first step not done is marked Next. When the board shows more done, set it in the piece's `steps` before
rendering, by key: `research`, `lock`, `look`, `scripts`, `teleprompter`, `record`, `cut`, `covers`, `article`, `growth`
(each `"done"`); `"format": "open"` adds a first step for an extra piece whose format is not set.
