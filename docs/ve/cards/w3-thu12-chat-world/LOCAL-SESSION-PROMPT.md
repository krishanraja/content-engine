Fix Codex on this computer, then build the `chat_world` device through Codex and micromanage it to a green, reviewed result. You are the director; Codex writes the code. You never write device code yourself.

Repository: krishanraja/content-engine, on `main` (pull first). The card is already on main:
`docs/ve/cards/w3-thu12-chat-world/ve-t12-1-chat-world.fields.json` (and its `.md`).
Why it exists: `docs/plans/2026-11-09-week/offday-proactive-ai-concept.md` (read its "What Codex's own attempt taught" section first: Krish rejected the last Codex attempt as "terrible and tacky" and "nothing about it looks like it's come from my media channel brand engine").

Approvals already given by Krish (9 Nov): "Yes, approve the Codex build"; Thursday 12 Nov, "Pure voiceover". The Control Center Codex queue is no longer required: build here, directly.
Spend: a Control Center reservation is open for this build, spend id `67e21f80-94db-427b-9707-d19e62a2a0ac` (pool `codex`, engine `growth-makeyourmindup`, 3 allowance points). Settle it at the end with `settle_credit_spend` and the real usage. Control Center allows one open reservation per engine, so do not open another.

## Step 1. Fix Codex (stop and tell Krish exactly what failed if any check here does not pass)
1. `python3 scripts/check_failures.py`, then `python3 scripts/floor.py --format hand-held-screen`.
2. `python scripts/ve.py doctor` and report every Codex line.
3. The plugin companion must exist: `~/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs`. If missing, the plugin `codex@openai-codex` is enabled in `.claude/settings.json`; install it with `/plugin` (marketplace `openai-codex`, repo `openai/codex-plugin-cc`) and restart this session.
4. `codex --version` and `codex login status` must show a signed-in ChatGPT account (the weekly allowance, never an API key). If not signed in, run `codex login` and let Krish complete it in his browser.
5. Prove the route on nothing: run the companion's status or a one-line read-only task and confirm it answers with model `gpt-6.1-sol`, effort `medium` (pinned in `scripts/velib/cards.py`).

## Step 2. Dispatch, one card, locally
`python scripts/ve.py card docs/ve/cards/w3-thu12-chat-world/ve-t12-1-chat-world.fields.json` (rewrites the card with this machine's paths), then
`python scripts/ve.py dispatch docs/ve/cards/w3-thu12-chat-world/ve-t12-1-chat-world.md --wait`.
Caps from the card: 45 minutes, 45 calls. Do not raise them.

## Step 3. Micromanage while it runs
- Every few minutes read the companion log. If Codex edits anything outside `write_allow` (`apps/renderer/src/engine/devices/chat_world/*`, `devices/registry.ts`, `devices/verbs.test.ts`, `config/ve/devices.json`), stop it.
- Stop it and correct it with a short follow-up task if it:
  - adds a verb to `props.ts` (the card uses only existing verbs: enter, send, move, chip, add, highlight, exit);
  - draws a pale or white ground, input fields, a cursor, boxed captions, or puts a logo next to a bubble or the "Paid" chip;
  - draws gates as bars, locks or machinery (they are a hairline with a label);
  - hard-codes colours or timing instead of `tokens` and `MOTION`.
- Two failed attempts at the same acceptance command: stop, and bring Krish the failure, not a third try.

## Step 4. Verify yourself; Codex's report is never proof
1. `python scripts/ve.py verify-card docs/ve/cards/w3-thu12-chat-world/ve-t12-1-chat-world.md --cwd <Codex's worktree>` must exit 0.
2. Run every acceptance command in the card yourself, from the worktree.
3. Render golden stills from the fixture, tall and wide, at: first bubble, after `move flip`, the `chip` "Paid" beat, after both `add stop:` events, the pinned screenshot with one highlight, after `move pull`. Make one contact sheet and look at it at full size.
4. Judge it against the card and the rejection floor, honestly. If it reads as an app mock and not house motion design, it fails: send Codex one precise correction (one round only), then re-verify.
5. Send Krish the contact sheet as a file with one line on what you think is still weak. Do not call it done until he has seen it.

## Step 5. Land it
- Commit on a branch (`codex/ve-t12-1-chat-world`), `npm run verify`, push, open a pull request; it merges itself when CI is green (AGENTS.md). Fix red CI on the branch.
- Settle the Control Center reservation with the real allowance used.
- Update `docs/plans/2026-11-09-week/OUTSTANDING.md` (Thu 12 row) and `NOW.md` per AGENTS.md closeout.
- Do not start the piece itself (`ve init`, proof, cut) in this session: that is the next session, with the 5 Nov take and the ChatGPT screenshot.
