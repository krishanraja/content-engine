# divergent-thinker on call: the wildcard, the repeat guard, and what went live

Kept here, not in `.agents/skills/plan-week/SKILL.md`, so the core stays under its byte cap
(scripts/check_skill_core.py). The core names this file at step 1b and at the wildcard in step 3b.

divergent-thinker (krishanraja/divergent-thinker) is the fleet's divergent thinking engine, reached through Control
Center (`POST /api/divergent/content-engine`) by `python3 scripts/post-pack/divergent.py`, on the engine's operator
key, namespace `content-engine:ideas`. It decides nothing and holds no taste: it proposes, and only Krish's presses put
anything on a board. At will, outside these two uses: `docs/DIVERGENT.md`. Its calls count inside the $15 a week chain (Ruling, Krish, 2026-11-18;
`config/chain-cap.json`, family `divergent`).

Exit 2 is never a pass: it means the engine is not served yet, the chain is over its cap, or there is no key. Then
carry on exactly as without it, and say once in the run's summary which step it skipped.

## After the gather: record what went live (zero model calls)

Right after `board_feed.py gather`, record every post that went live on the boards it read, so the wildcard and the
guard below know what went out:

    python3 scripts/post-pack/divergent.py record --live docs/plans/<Monday>-week/sources.json

It sends each `recent_posts` entry at stage `live` as its title and its one-line point. The engine skips one it already
holds, so recording the same post again next week costs nothing.

## The day's wildcard (step 3b, about $0.15 a day; required, ruling wildcard)

Every Monday, Wednesday and Friday carries one wildcard option he could pick (Krish, 2026-11-26: "Just make sure my
Monday, Wednesday, and Friday stories: there's always one completely divergent, strange, obscure, or unexpected story
suggestion that I could pick from."). It is no longer optional: `board_feed.py gate` refuses an open hero day without
one (code `wildcard`, from the story score's `from` date). The whole procedure, its marking and its floors are in
`references/story-score.md` ("The day's wildcard"); this section is the engine's part.

Generate it first, before the day's other options. For each publishing day's wildcard slot only (never a lookalike
option, never his ideas), ask for sparks:

    python3 scripts/post-pack/divergent.py wildcard --day <mon|wed|fri> --sources docs/plans/<Monday>-week/sources.json \
      --problem "<the day's series and what its mandate asks for, in one plain sentence, for the week of <Monday>>"

It checks the chain cap first and refuses over it. It passes `cliches` (the recent posts' titles and the earlier boards'
options), the kill list's banned vocabulary, `target: writing` and temperament `wild` (config/story-score.json
`wildcard.temperament`; `--temperament` overrides it for one call). Pick at most one spark that fits the series mandate
and Krish's ruling of 6 October and is on the beat (a focus sector in `config/beat.json`, nothing on its avoid list; Krish,
2026-11-24), then research it like any option: a dated, sourced fact checked against its source the
same day, or leave it out. Strangeness never excuses an unsourced claim or a prediction. The option you write from it is the engine's:
`source_kind` `engine`, plus `"wildcard": {"kind": "divergent|strange|obscure|unexpected", "why_unexpected": "<one
line>", "divergent": {"run_id": "<run_id>", "spark": "<the spark's title>"}}`; never his, never posed as his. Its pitch
question opens on `Wildcard: `. It goes through the same floor, story score (type `wildcard`), adversarial refute pass,
`reviewer` subagent and `board_feed.py gate` as every option. On exit 2, or when no spark survives, find the wildcard
yourself and mark it the same way, without `divergent`.

## The wildcard's distance (zero model calls)

Distance is checked, never asserted. Once the day's options are written:

    python3 scripts/post-pack/divergent.py distance docs/plans/<Monday>-week/ideas.json --sources docs/plans/<Monday>-week/sources.json --write

Per hero day it scores the wildcard against that day's other options and the worn ground (passed as `obvious`, no
judge, so the engine makes no model call) and writes the read to the option's `wildcard.distance` and to
`docs/plans/<Monday>-week/story/wildcards.json` (the cycle's stage 2 evidence, `config/cycle.json`
`s2-divergent-wildcard`). `accepted` is divergent, and the engine's own spark in its archive (`own_spark`) is expected.
Exit 1 names a wildcard pulled to the obvious takes or the archive: find a stranger story. Exit 2 (not served, no key)
records `skipped: not served`; the session's `why_unexpected` stands and the run's summary says so. Run it again after
any change to a wildcard's words: the gate holds the read to the words it was read on.

## The repeat guard (beside `repeat_review` and `board_feed.py gate`, zero model calls)

When every option is written:

    python3 scripts/post-pack/divergent.py score docs/plans/<Monday>-week/ideas.json --sources docs/plans/<Monday>-week/sources.json

It scores every option against the recent posts and earlier options (passed as `obvious`, so the engine makes no model
call) and against its archive. Exit 1 lists each option at `rejected_archive` or `rejected_gravity`: hand those refs to
the fresh reader of `repeat_review` and to the `reviewer` with the line it gives. The reader decides; never drop an
option on the engine's word alone. A wildcard's match to its own spark (`own_spark`) is expected and not flagged. It
never replaces `repeat_review` or `board_feed.py gate`.
