# The weekly device sprint (W3.8)

Each week, one or two new library devices come from Production Inspo. Each one is briefed through `ve brief`, built by Codex from a card, and proven at Krish's Gate 2 before any spec uses it. Each device serves one aim (good motion, good animation or good visuals) and makes something land beyond the words. The device count and each Gate 2 yes appear on the board's Archive.

`ve` means `python scripts/ve.py`. The mechanics are in `scripts/velib/sprint.py`, tested by `tests/ve_sprint_test.py`.

## The week

1. **Pick (Claude, Monday).** Choose 1 or 2 references from the Production Inspo folder, the ones that show a move the engine cannot draw yet. The move has to carry a point faster (AGENTS.md rule 6), not just look busy. Check `config/ve/moves.json` and `config/ve/devices.json` so you never card a device the library already has.
2. **Brief.** `ve sprint start <Monday> --ref <reference> [--ref <reference>]` makes one brief per reference through `ve brief` (one brief per plate, W2.7). It also writes a card-fields skeleton, `docs/ve/sprints/<Monday>/card-<n>.fields.json`. Until `ve brief` is on main, the adapter writes a brief marked `pending`, and the next step refuses to card from it.
3. **Card (Claude).** Fill each skeleton from its brief and the reference:
   - the device id;
   - the aim, one of `good motion`, `good animation` or `good visuals`;
   - the meaning, one sentence on what it makes land beyond the words;
   - the move (id, name, verbs, signatures, and one example line the signatures match);
   - the title, goal, contract, tests, write_allow and read.

   Then run `ve sprint cards <Monday>`. It refuses anything left TODO, an aim outside the three, a device the library already has, and an example its own signatures miss. It writes each card through `ve card`, with `cwd` from the local layout, and adds the move to `config/ve/moves.json`. Once the device lands, `scripts/ve/check_route.py` bans per-piece code for that move. It also records the device in `docs/ve/sprints/ledger.json`.
4. **Build (Codex, between pieces).** `ve dispatch <card.md> --wait`, and only within the weekly Codex allowance. Above 80% it needs Krish's paid-credit yes in his own words (`--spend-approved`). Then `ve verify-card <card.md> --cwd <worktree>` reruns the acceptance outside the sandbox: the device's own tests, `tests/ve_port_acceptance_test.py <device>` and the route check. Render its golden stills and look at one contact sheet.
5. **Gate 2 (Krish, about 5 minutes a week).** Show him the device's proof render at full size. Record his yes only in the words he typed: `ve sprint gate2 <device> --words "<his exact words>" --where "<where he typed them>" --at <YYYY-MM-DD>`. It refuses a device that is not built. Never record a yes for him, and never paraphrase it. Until it is recorded, no spec uses the device.
6. **Archive.** `ve sprint feed --archive <archive.json> --out <archive.fed.json>` adds a `devices` block to the Archive feed (GET `/api/board/<Monday>/archive`, `board_feed.py archive`). The block holds the library count, the sprint devices, and each Gate 2 yes with his words. Rebuild the board with `week_board.py --archive <archive.fed.json>`, its existing input. week_board reads `rows` from that file and leaves the `devices` block to the board's owner, who shows it on the Archive. `ve sprint status` prints the same numbers.

## Walls

- Nothing here dispatches, spends, publishes or approves. `ve dispatch` is the only way a card reaches Codex.
- Taste: only the eight floor nevers may block. The aim guides, and it is recorded and judged on engagement.
- References stay in Production Inspo. Never commit their media. A card names a reference by its id or link.
