#!/usr/bin/env bash
# Put a run's commit (the Thursday good news, the Sunday ideas) on the week's branch, offday-revise/<Monday>, which
# the live board reads before main (apps/control-plane/api/board/_view.ts, readView; Ruling, Krish, 2026-11-11: one
# live board, in Control Centre).
#
#   bash scripts/week_branch_keep.sh MONDAY COMMIT [BASIC_AUTH]
#
# The branch becomes main, then whatever was already on the branch, then COMMIT on top, so nothing on main or on the
# branch is lost and the push is a fast-forward (never a force). It tries three times when someone else pushed the
# branch meanwhile. A conflict stops it: the commit stays on the run's own branch and nothing is pushed over it.
# GOODNEWS_REMOTE names the remote (origin by default; the test points it at a local bare repository).
set -euo pipefail
monday="$1"; commit="$2"; auth="${3:-}"
[[ "$monday" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { echo "week_branch_keep: MONDAY is YYYY-MM-DD" >&2; exit 2; }
remote="${GOODNEWS_REMOTE:-origin}"
branch="offday-revise/$monday"
g() { if [ -n "$auth" ]; then git -c "http.extraheader=AUTHORIZATION: basic $auth" "$@"; else git "$@"; fi; }

for attempt in 1 2 3; do
  g fetch -q "$remote" "+refs/heads/main:refs/weekbranch/main"
  week=""
  if g ls-remote --exit-code --heads "$remote" "$branch" >/dev/null 2>&1; then
    g fetch -q "$remote" "+refs/heads/$branch:refs/weekbranch/week"
    week="refs/weekbranch/week"
  fi
  git switch -q -C week-branch refs/weekbranch/main
  if [ -n "$week" ] && ! git merge-base --is-ancestor "$week" HEAD; then
    git merge -q --no-edit -m "Keep $branch on top of main" "$week" || { git merge --abort || true; echo "week_branch_keep: $branch does not merge onto main" >&2; exit 1; }
  fi
  git cherry-pick --keep-redundant-commits "$commit" >/dev/null || { git cherry-pick --abort || true; echo "week_branch_keep: the stories do not apply onto $branch" >&2; exit 1; }
  if g push -q "$remote" "HEAD:refs/heads/$branch"; then
    echo "week_branch_keep: $branch is at $(git rev-parse HEAD)"
    exit 0
  fi
  echo "week_branch_keep: $branch moved while this ran (attempt $attempt); trying again" >&2
  sleep 5
done
echo "week_branch_keep: could not put the stories on $branch" >&2
exit 1
