# The QA list

Reference for `.agents/skills/thumbnail-designer/SKILL.md`, steps 3 and 4, and for the thumbnail critic
(`.claude/agents/thumbnail-critic.md`). Seven plain checks, each answered pass or fail on every option. The verdict
records this file's sha256, so a changed list needs a new verdict. The names in brackets are the keys the verdict uses
(`scripts/pages/thumb_options.py`, `CHECKS`).

1. **The headline reads at grid size in under a second** (`readable_at_grid`). Look at the option's tile in the grid
   mock (about 130 px wide on a phone): the headline is the largest thing on it, and you can read every word at once
   without leaning in. Cover standard, point 1.
2. **At most 7 words** (`words_max`). Count the headline's words. Point 1.
3. **At most three parts besides the headline** (`three_parts`): one picture, the logos, the series label. Anything
   that does not make the headline land faster is left off. The wordmark is the house mark, not a part. Point 2.
4. **Logos only for companies the headline or the picture names** (`logos_named`). Never a logo for a company the
   story only mentions in passing; always the product's own mark, never a parent company's; logos below the headline
   and smaller than it. Point 3.
5. **No badges** (`no_badges`): no proof tag, no "source", no "exclusive", no sticker. A quiet series label is not a
   badge; a large pill is. Points 4 and 5.
6. **It works with the title hidden** (`title_hidden`). Cover the platform's title in your mind: the thumbnail alone
   still says what the piece is about and why to watch, and it does not lean on the title to make sense.
7. **The promise matches the piece** (`promise_matches`). What the thumbnail promises is the brief's promise, the
   piece supports it, and it makes none of the claims the brief says to avoid.

Before the critic, run the antislop PASS/FAIL report (`.agents/skills/antislop/ADAPTER.md` first, then the skills it names) on each option: fix each FAIL no house rule overrules (the
brand book, the Receipt and these seven checks win); his picked words are never changed for it.

A failed check comes with a finding that says why, in one line, marked `block` (it cannot go to Krish like this) or
`fix` (it can be repaired in the next round). An option with a `block` finding blocks.

## The checks on each option

- `python3 scripts/channel_safe.py WORK/thumbs/options/<id>/thumb-tall-1080x1920.jpg --shape cover_tall` (F43: the
  grid crop and the account row). Exit 2 means it did not run (no tesseract): say so; it is never a pass.
- `python3 scripts/post-pack/title_check.py "THE WORDS" --surface thumbnail --source <the piece's body or script>`,
  and again with `--surface tall_cover`.
- `python3 scripts/pages/thumb_options.py show WORK/thumbs`: the words, the parts and any logo the brief does not name.
- Look at every file at full size, and at the grid mock, yourself, against the QA list
  (`.agents/skills/thumbnail-designer/references/qa.md`).

## Repair, at most twice, then hold

When the verdict blocks every option, or the best one fails a check, change the facts (a crop, a layout) and draw a
new set; a new set needs a new verdict. At most two rounds of repair. Then hold: record the set and its verdict
(`making.py <piece> thumbnails WORK/thumbs`, no `--ask`), record the reason as a final-review line, and
carry on with the cuts. Never put options below the bar to him.
