---
name: ve
description: "Run a piece through ve, the spec-driven video engine. Use when Krish asks to make, prove, render, check or file a video with ve or 'the new engine', when a piece's creative-direction.json has schema_version 2, or when a ve Codex task card needs writing, dispatching or verifying. Not for pieces still on the quick-edit route (produce-video) and not the 'Video engine' launcher."
---

# ve

1. Read docs/ve/ENGINE.md and docs/ve/RUNBOOK.md, then only the signed spec/session pack. No big files, individual images or raw logs: QC JSON and one contact sheet.
2. In Bash `. scripts/ve-env.sh` pins ffmpeg n8.1.2/tesseract. `python scripts/ve.py doctor`: stop on hard blockers. `python scripts/ve.py start <piece>` writes the <=36 KB pack. Below, ve means python scripts/ve.py.
3. Follow S0-S8 (55 min envelope). `ve time <piece> start <phase>`, stop, status; stop at gates, log Krish-wait separately. `ve ledger <piece> add claude_tokens <n>` and add codex_tokens <n> log actual usage; log allowance_points/credits too. `ve ledger <piece>` reports caps: 60 engine min, 3.3M Claude, 2.1M Codex, 12.6M total tokens, 1.2 allowance points. At 80% stop/ask at a gate; refuse past caps. Ledger only warns; time start checks engine time only.
4. Lint after changes. Compile refuses unsupported device verbs (devices.json); test_grid draws carry. SFX kits are absent: sfx_missing references block status. ingest/stills/file are exit-2 placeholders; stop unless approved existing inputs cover a stage. Never claim filing succeeded.
5. `ve render <props> <out> --spec <spec> --assets-dir <assets>` uses ASCII transport, corrects AAC lag and prints residual <=1 ms. `ve qc <cut> --format <format> --props <props> --out <ve-dir>/qc.<cut>.json`: require measured_pass and complete. Max 2 fix loops, fresh Critic, Krish's final gate. Never hand-write passes/ready; `ve status <piece>` computes it.
6. No per-piece code. New hero only: `ve card <fields.json>`, `ve dispatch <card.md> --piece <piece>`, `ve verify-card <card.md> --cwd <worktree>`, independent golden-still review. Stop/log clock before dispatch; --piece checks recorded caps. Dispatch and every generation reserve against the credit caps Control Center places on the publication (`ve budget status`, `ve ledger <piece> reserve`); over it is refused, a card needing a tool the Codex profile forbids is held.
7. Batch questions/end at gates. Never publish/send/schedule. Recipes and realism/credit rulings follow config/ve/tools.json.
