# The Monday, Wednesday and Friday cadence restarts on 2 November

Ruling (Krish, 2026-10-29): Mon/Wed/Fri cadence restarts 2 Nov: 30th to Mon 2, 28th to Wed 4, 23rd to Fri 6, 26th to Mon 9.

His words, 29 October 2026: "23rd and 26th never went live, they were only finished yesterday and the growth repo
needs to move them to next week which is where we start publishing the mon/wed/fri cadence again. Until then, we will
focus on lighting up the other formats (carousels, memes, hannah fry style explainers)." Then: "potentially we need to
move what was recorded on 30th to 2nd (it is kind of a follow the money piece). and then move 28th to 4th Nov - which
means there is no reliance on me recording any mon/wed/fri content till 6th Nov." He then confirmed Friday 6 November
for the 23 October piece and Monday 9 November for the 26 October piece.

## What moved

Each date moved through `POST /api/content-ideas/<id>/schedule` (it writes `scheduled_for` and `updated_at` only), on
29 October 2026 at 21:47 UTC. Nothing else on the rows changed: state, series, making record and meta are as they were.

| content_ideas id | Was | Now | Series (`lane_slot`) | State |
|---|---|---|---|---|
| `9a0c97af-f0d6-4d12-a7ce-773c622d4b67` | Fri 30 Oct | Mon 2 Nov | mind_the_gap | drafting |
| `b63d2507-dbb4-449d-bce4-f21e859ee2ad` | Wed 28 Oct | Wed 4 Nov | under_the_hood | drafting |
| `7083d6ad-419e-4fdc-9aba-f3be7f3f3a23` | Fri 23 Oct | Fri 6 Nov | mind_the_gap | drafting |
| `b358e788-209f-427b-a84d-1f79a8ebb430` | Mon 26 Oct | Mon 9 Nov | follow_the_money | drafting |

Readback, the same evening: the four rows read back with the dates above; no content_ideas row is scheduled from
27 October to 1 November; `GET /api/week/options?week_start=2026-11-02` lists `b63d2507` under under_the_hood and
`9a0c97af` and `7083d6ad` under mind_the_gap, follow_the_money empty; `week_start=2026-11-09` lists `b358e788` under
follow_the_money; `week_start=2026-10-26` lists nothing.

## Proposal for Krish: the 2 November piece's series

Monday is follow.the.money. The 30 October piece (`9a0c97af`, "Anthropic's own hiring data") is still mind.the.gap,
and he called it "kind of a follow the money piece". Proposed: move it to follow_the_money. Not changed: the series is
his call. Until it changes, the board's week picks (`week_board.picks_from_options`, a day's piece is its series'
piece for that date) leave Monday 2 November empty, so a build of that week needs `--piece mon=9a0c97af-...`.

## The boards: not rebuilt, and why

The boards of 19 and 26 October still show these pieces on their old days. They were left standing because no route
in `week_board.py` carries a day from one week's board to another's, and every one of the four moves crosses a week:

- `--previous`, `--keep` and `--keep-draft` take only the same week's board ("a new week gets a new board").
- Friday 23 and Monday 26 are made days. Their publish pages live inside the 19 and 26 October boards
  (`making.publish_manager.url`) and carry their old dates (the run-sheet reads "mind.the.gap · 2026-10-23"). A new
  week's build with `--live` refuses them without `--day` and a publish page made for the new date.
- Wednesday 28 and Friday 30 are words in review on the 26 October board. Their edits, comments and approvals are
  stored against that week (`edits/<day>-<item>` under week 2026-10-26), and Friday 30 also changes day key (fri to mon).
- Unpicking the old days first would take the made Friday 23 and Monday 26 run-sheets off the live boards before any
  new board holds them, which the rebuild guard exists to stop.

What a rebuild needs, for Krish or the next session to decide:

1. The series decision on `9a0c97af` (above).
2. The publish pages for Friday 6 and Monday 9 made again for their new dates (publish_manager.py from each pack),
   part of each piece's making, not of this move.
3. A supported way to carry review words and their stored edits and comments across weeks, or the drafts fed again
   on the 2 November board with `--draft` and `--review` from their source files.

Then build 2 and 9 November with `week_board.py --target web --live`, register them under `config/boards.json` `web`,
and rebuild 19 and 26 October with `--unpick` for the moved days.
