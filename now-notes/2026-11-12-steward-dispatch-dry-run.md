Status: The docs steward check is no longer red on every merge. Auto-merge started the full steward after each merge as github-actions[bot], and claude-code-action refuses a run a bot started, so all 121 of those runs failed from 3 Nov. A merge now starts the steward as its dry run (the digest and the validator, no model); the nightly run still writes, and a test holds the dispatch to the dry run.
Next: Nothing for Krish; the nightly steward run keeps NOW.md reconciled.
North Star check (2026-11-12): holds.
