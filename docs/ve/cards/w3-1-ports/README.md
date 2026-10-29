# W3.1 device ports: Monday 26's moves as library devices

Six Codex device cards. Each one ports a move that Monday 26 (`docs/plans/2026-10-26-monday/video/`) hand-coded into a library device, so no piece needs its own code for that move again. The cards were written from `<card>.fields.json` with `ve card`. The source code they port is excerpted verbatim under `ref/`, because a card may not open `docs/plans/**`.

| Card | Device | Move | Verbs |
|---|---|---|---|
| ve-p-1-statement-wall | `statement_wall` | the statement wall | enter, mark, exit |
| ve-p-2-hazard-tape | `hazard_tape` | the hazard-tape slam | stamp, exit |
| ve-p-3-receipt-print | `receipt_print` | the printing receipt with count-up | enter, fill, count_to, stamp, exit |
| ve-p-4-chip-transfer | `chip_transfer` | the chip transfer | enter, move, exit |
| ve-p-5-ringed-recording | `ringed_recording` | the ringed screen recording | enter, move, mark, exit |
| ve-p-6-logo-card | `logo_card` | the logo card | enter, highlight, exit |

None of them is dispatched yet. To run one:

1. Regenerate the card on the home computer with `python scripts/ve.py card <card>.fields.json`, so `cwd` comes from the local layout (W2.11).
2. `ve dispatch <card>.md --wait`, within the weekly Codex allowance.
3. `ve verify-card <card>.md --cwd <worktree>`. The acceptance includes `tests/ve_port_acceptance_test.py <device>`, which Claude wrote before dispatch so the card cannot weaken it, and the route check.
4. Render golden stills and look at one contact sheet.
5. Krish's Gate 2 yes, recorded with `ve sprint gate2` in his exact words.

Once a device is in `config/ve/devices.json`, `scripts/ve/check_route.py` bans new per-piece code for its move (`config/ve/moves.json`).

Open design point for Krish at Gate 2: the hazard tape was butter yellow on Monday 26. That yellow is the follow.the.money channel colour, and the brand keeps the channel colour for series identity only, so the card draws the tape in cream with ink type.
