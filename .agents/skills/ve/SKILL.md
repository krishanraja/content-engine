---
name: ve
description: "Run a piece through ve, the spec-driven video engine. Use when Krish asks to make, prove, render, check or file a video with ve or 'the new engine', when a piece's creative-direction.json has schema_version 2, or when a ve Codex task card needs writing, dispatching or verifying. Not for pieces still on the quick-edit route (produce-video) and not the 'Video engine' launcher."
---

# ve

1. Read `docs/ve/ENGINE.md`, and nothing else from the repo's standing docs.
2. Run `python scripts/ve.py doctor`. Report any blocker in one line and stop if it is a hard one.
3. Run `python scripts/ve.py start <piece>`. It writes `docs/plans/<piece>/ve/session-pack.md` with the format card, the crew cards for this format, the allowed devices, open lint errors and gate status. Work only from that pack and the spec.
4. Change the spec only through the documented fields. Run `python scripts/ve.py lint <spec>` after every change; fix what it prints.
5. Never ask Krish questions mid-turn. Put them in the gate packet and end the session at the gate.
6. Never write a pass, a receipt or a "ready" by hand. Run `python scripts/ve.py status <piece>`.
7. Never write per-piece render code. If the library lacks a mechanism, write a card (`ve card device_new <id>`) and dispatch it (`ve dispatch`). Verify it with `ve verify-card` before you trust it.
8. Never publish, send or schedule. Generation recipes follow `config/ve/tools.json`, including Krish's rulings of 27 Oct.
