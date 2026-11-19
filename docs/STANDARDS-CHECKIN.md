# The weekly standards check-in

Ruling (Krish, 2026-11-15): the weekly standards check-in is one pinned claude.ai artifact refreshed weekly, an
exception to "No Claude artifact, ever". On 15 Nov he decided the 23 new floor groups on that page
(https://claude.ai/artifact/AmaXBSHYfZMF9RUEmgcSqH) and asked for the same format every week.

## The parts

| Part | Where | What it does |
|---|---|---|
| The page | the one pinned artifact above | Shows the week's items and takes his answers. Refreshed by a session; `scripts/hooks/artifact_gate.py` lets a publish or pin of that one address through and refuses every other artifact. |
| The data | `standards_checkins` (`supabase/migrations/20261204100000_standards_checkins.sql`) | One payload per week, built by `scripts/standards_checkin.py`. |
| The builder | `.github/workflows/standards-checkin.yml`, Sundays 07:00 UTC | Code only, no model. Applies last week's answers, groups the new standards, seeds them as proposals, stores the payload. A hand run is a dry run unless unticked. |
| His answers | `standards_checkin_decisions` | One row per item he answered (`group:<key>`, `evolution:<key>` or `standard:<id>`; choice `approve`, `corrected`, `reject` or `amend`; his words for a correction or amendment), relayed from the page with `decided_by` 'Krish'. |
| Amendments | `taste_floor_group_amendments` (`supabase/migrations/20261204090000_floor_group_amendments.sql`) | His new words for a group he already decided. Append-only; the view `taste_floor` takes the latest as `group_statement` and the members stand reworded, so the 4 Nov decision is kept. |

## What a week's payload holds

- **Retired standards.** A standard the Rejections engine retired (a newer one supersedes it) leaves the grouping:
  the run takes it out of its group or the operating holds, lists it under `retired`, and groups its successor as new
  (`retired_from_grouping` in the counts). On 18 Nov the floor retired 61 operating holds and the run stopped until
  this was added.

- **New groups.** Every standard on `config/rejection-floor.json` that `config/floor-groups.json` does not place. One
  that shares its theme with at least two members of a group he decided becomes that group's evolution
  (`<parent>_e<yymmdd>`, titled "(evolution, week of ...)", starting from the parent's decided words); the rest form new
  groups by theme. Each is seeded as a proposal (batch `standards-checkin-<date>`) and the grouping goes to main as a
  pull request that merges itself.
- **Evolutions.** His amendments since the last check-in, and standards that supersede an older version.
- **Why.** For every item his quotes (text, when, where), the piece and item they were about, and up to two stills,
  each a JPEG of 60 KB or less.

His answers apply exactly as the 23 were relayed on 15 Nov: the one decision write
(`apps/control-plane/api/_learningDecision.ts`), status only while proposed, `decided_by` 'Krish', his words only on a
correction. The builder never decides anything, and the public log carries counts and keys only.

## The grouping pull request

The job opens its grouping pull request with `CHECKIN_PR_TOKEN` (Ruling, Krish, 2026-11-18), a fine-grained GitHub
token limited to krishanraja/content-engine with Contents and Pull requests set to read and write, kept as a repository
secret. A pull request opened with GitHub's own token starts no CI until a person presses "Approve and run", so
auto-merge.yml never saw it (18 Nov). With the token its CI runs and auto-merge.yml merges it on green. The pull request
carries its own closeout note (`now-notes/<date>-standards-checkin-<run>.md`, counts only). Without the secret the run
warns and falls back to GitHub's own token, and the pull request waits for his "Approve and run". When the token
expires, the run's warning is the sign: Krish makes a new one and replaces the secret.

## Run it

```
python3 scripts/standards_checkin.py            # dry run against the live floor: counts only
python3 scripts/standards_checkin.py --apply    # what the Sunday job does
python3 scripts/standards_checkin.py --self-test
```

Both need `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` in the environment (repository secrets for the job).


## Grouped whenever the floor changes (19 Nov 2026)

The check-in workflow also runs on every push that changes `config/rejection-floor.json`, on the floor's own branch (`floor/rejections`) or on main, not only on Sunday. On 19 Nov the floor pull request (#911) was merged while it waited for Sunday's grouping, and every pull request went red on `check:floor-groups`. Now new standards are proposed into groups at once, by the same code, as proposals for his answer; nothing is decided by the run. A second run in a week was already handled (it keeps the week's unanswered groups on the page).
