Status: Every Claude Code session on Krish's computers now puts the content-engine checkout back on an up-to-date main at start and end (`scripts/checkout_tidy.mjs`, SessionStart and SessionEnd hooks, a session lock), and Codex runs it as step 0 of the start route; it never touches uncommitted changes, unmerged commits or another live session's checkout.
Next: On his Windows PC, keep or drop the stashed edit, then open one Claude Code session there and confirm the checkout lands on main.
Changed: His checkout sat on an old branch 1,784 commits behind with an edit blocking `git pull` (Ruling, Krish, 2026-11-15); the Substack empty-byline rule, stranded in that edit, is now in docs/PUBLISH_BOARDS.md.
North Star check (2026-11-15): holds.
