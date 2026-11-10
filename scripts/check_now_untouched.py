#!/usr/bin/env python3
"""A pull request never edits NOW.md: it closes out through a now-notes/ file instead.

Every session used to update and hand-trim NOW.md at closeout, so any two pull requests open at once
conflicted over it, auto-merge's `gh pr merge` refused them ("the merge commit cannot be cleanly
created"), and they sat unmerged while main moved on (#499, #509, #510 on 2026-11-10). A note in
now-notes/ is a new file per session and never conflicts; auto-merge folds it into NOW.md on main
and scripts/now_trim.py keeps the page under its limit there.

    python3 scripts/check_now_untouched.py --base <sha or ref> [--branch <head branch>]

steward/* branches (the nightly docs steward, whose job is NOW.md) are exempt.
"""
from __future__ import annotations

import argparse
import subprocess
import sys

GUARDED = ("NOW.md",)


def changed(base: str) -> list[str]:
    out = subprocess.run(["git", "diff", "--name-only", f"{base}...HEAD"], capture_output=True, text=True, check=True)
    return [p for p in out.stdout.splitlines() if p]


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True)
    ap.add_argument("--branch", default="")
    args = ap.parse_args(argv)
    if args.branch.startswith("steward/"):
        print(f"{args.branch} is the docs steward's; NOW.md edits allowed.")
        return 0
    hit = [p for p in changed(args.base) if p in GUARDED]
    if not hit:
        print("NOW.md untouched: this pull request closes out through now-notes/.")
        return 0
    print(
        "This pull request edits NOW.md. Pull requests never do: two open at once conflict over it and auto-merge "
        "cannot merge either. Put the change back to main's NOW.md (git show origin/main:NOW.md > NOW.md) and write "
        "now-notes/YYYY-MM-DD-<slug>.md instead, with \"Status: ...\", \"Next: ...\", \"North Star check "
        "(YYYY-MM-DD): holds.\" and optionally \"Changed: ...\". Auto-merge folds it into NOW.md on main and trims "
        "the page there (scripts/now_trim.py)."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
