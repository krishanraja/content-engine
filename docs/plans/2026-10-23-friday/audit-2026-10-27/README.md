# Friday "Two passports": the 27 Oct audit

Krish rejected all four Friday 23 Oct cuts. This folder holds the accounts of why, and what each suggestion turned into.

| File | What it is |
|---|---|
| `FULL-SESSION-FAILURE-REPORT.md` | The Codex production session's account of the whole session: failures F01–F18. They are registered, open, in `config/failures.json` (`F01-…` to `F18-…`), each with its planned `ve` mechanism. |
| `AUDIT.md` | The production session's audit of the four exports. |
| `ENGINE-MOTION-DESIGN-RECOMMENDATIONS.md` | The production session's engine and motion-design recommendations. |
| `INDEPENDENT-VIDEO-REVIEW-PROMPT.md` | The brief for an independent review of the media. |
| `INDEPENDENT-FINDINGS-BLIND.md` | Claude's first pass, saved before any producer audit was opened. |
| `INDEPENDENT-REVIEW.md` | Claude's independent review. Its correction note, at the end, corrects the cause of the 0:06.5 lip-sync offset. |
| `SUGGESTION-LOG.md` | The review's 160 suggestions, each with a disposition and cross-checked against F01–F18 and R01–R46. |
| `sync-source-match.json` | The production session's source-to-export frame matches. |

Only docs and JSON are filed here. `source-match-method.py`, the `border-control` compositions and the `render_friday_*` scripts stay on the branch `codex/friday-production-after-engine` (827945c); the code paths these documents cite refer to that branch. Where the media live is in `FULL-SESSION-FAILURE-REPORT.md`, under "Direct evidence links and access instructions".
