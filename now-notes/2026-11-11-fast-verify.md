Status: Pull requests now wait only on the quick checks (CI: `npm run verify:quick`, Linux, every guard plus the related and publishing-safety tests); the full `npm run verify` on Linux and Windows and the browser jobs run after merge in full-verify.yml, which opens one issue when main goes red. Ruling (Krish, 2026-11-11): quick checks on pull requests, the full verify after merge; merge fast and he tests live.
Next: Watch the first full-verify runs on main and fix any red from its issue the same day.
- North Star check (2026-11-11): holds.
