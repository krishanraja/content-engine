# The cycle's touches in make-piece (stages 4 to 8)

Kept here, not in `.agents/skills/make-piece/SKILL.md`, so the core stays under its byte cap
(scripts/check_skill_core.py). Krish, 2026-11-26: every system (file archives, divergence engine, strategist,
Higgsfield, growth-makeyourmindup, makeyourmindup, krish-clone, taste engine, internal auditor, Control Center, humour
engine) is involved at the right moment of the production cycle, read from or informed, in the most streamlined way.

Which system is touched at which stage is said once, in `config/cycle.json`. This skill never lists the tools again; it
names the stage and runs it:

    python3 scripts/post-pack/touch.py list 6                                   what stage 6 touches, and how
    python3 scripts/post-pack/touch.py run 6 --week <Monday> --piece <id> --set long=<long.md> --set short=<short.md>
    python3 scripts/post-pack/touch.py check 6 --week <Monday> --piece <id>     exit 1 while a required touch is missing

| Stage | When in make-piece | Values it takes (`--set`) |
|---|---|---|
| 4 Research and 5 Whys | the research and the why-ladder, before the lock | `angle`, `problem` (the divergence challenge, paid, capped) |
| 5 Narrative lock | the Sunday room's lock, before he signs | `hook`, `landing`; `edits` (his typed edits, sent as an observation) |
| 6 Scripts | before `making.py <piece> scripts` (step 3 and 3a) | `long`, `short`; `edits` (his script edits) |
| 8 Publish approval | before the publish page | `defect` (a proof reject that was an engine defect) |

- From the story score's `from` week, `making.py <piece> narrative` reports a missing stage 5 touch and
  `making.py <piece> scripts` refuses until stage 6's are on the week's `touches.jsonl` (finding code `touch`).
- The humour reads of 3a are stage 6's `s6-humour-long` and `s6-humour-short`; `humour_check.py doctor` first in a
  session that has not used it. Exit 2 is logged `skipped: not served`, never done, and is said where the scripts go to
  Krish.
- Without `CC_HARNESS_KEY` (a GitHub Actions run, or a checkout with no connector key) a connector touch is queued in
  `.cache/touch/outbox.jsonl` and on the log line; a session with the key runs `touch.py drain --week <Monday>`.
- A paid touch reserves through the chain cap and the week's story-score ledger first and is skipped over either.
- Nothing here publishes, posts, sends or spends past the caps; every touch writes one line, so a stage can be audited.
