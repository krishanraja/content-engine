# ve: the video engine

This is the only document a producing session must read. Everything else it needs comes in the session pack that `python scripts/ve.py start <piece>` writes. Do not read NOW.md, WORKBENCH.md, learnings or failures while producing: what they enforce is code here, and they cost tokens on every call.

## Why ve exists

Friday 23 Oct took a 62-hour Codex thread and about 253M tokens, and all four cuts were rejected. Three causes:
- **Bespoke per-piece code** bypassed every gate.
- **Receipts were self-written.**
- **Rules lived in prose**, so they were never enforced.

ve answers with:
- one signed spec;
- one tested composition fed by data;
- specialists as code;
- readiness computed from measurements.

## The pieces

| Piece | Where |
|---|---|
| The spec (`creative-direction.json`, `schema_version: 2`) | `packages/contracts/src/production-spec.ts`; checked by `packages/contracts/scripts/check-spec.ts` |
| Formats (data, not code) | `config/ve/formats/*.json` |
| Crew: each expert owns spec sections and ships lints, QC and a card | `config/ve/crew/<id>.{json,card.md,lens.md}` |
| Invariants no spec can override | `config/ve/invariants.json` |
| Brand and motion tokens (roles, never hex) | `config/ve/brand-tokens.json` |
| Tool routing and Krish's rulings | `config/ve/tools.json` |
| CLI | `scripts/ve.py` and `scripts/ve/*` |
| Renderer | `apps/renderer/src/engine/` (one `FormatMaster`, BrandFrame, devices) |
| Best practice | `_corpus/motion-design-video-corpus.md`, cited by section in each card |

## The protocol (gates batched; sessions end at gates; no mid-turn questions)

| Step | Command | Who |
|---|---|---|
| S0 | `ve start <piece>`, `ve doctor` | Claude |
| S1 | Two treatments, then `ve lint`, then `ve stills` | Director (Claude) |
| **Gate 1** | Krish picks a treatment, stills, bed and credits, merged into his storyboard sign-off | Krish |
| S2 | `ve card` + `ve dispatch` for a new hero device, run while Krish records | Codex |
| S3 | `ve ingest`: word clock from two aligners | script |
| S4 | `ve lint`, then `ve compile` | Director, fresh session |
| S5 | `ve render --proof`, only if anything is `trial` (Gate 2) | script, Krish |
| S6 | `ve render --all` | script |
| S7 | `ve qc`, then spec fixes (at most 2 loops), then the Critic (`ve-critic`), then the final packet | Claude |
| **Gate 3** | Krish watches each cut once and hears the joins reel | Krish |
| S8 | `ve file` (archive and library; never publish) | script |

## Rules that are code, not advice

- **Captions are always on.** The schema has no other value.
- **Specs and devices name colour roles, never hex.**
- **Positions are word indexes into the signed script, never seconds.** Frames come from `ve compile`.
- **One clock.** One EDL drives picture, dialogue, bed, SFX and captions in one render. There is no mux step.
- **No per-piece compositions or render scripts.** A new mechanism becomes a library device through a Codex card.
- **No pass is written by hand.** `ve status` computes readiness from `qc.json` bound to the mp4's sha, the Critic's verdict, and Krish's approvals.
- **ve has no publish, send or schedule verb.**

## Codex

Codex builds library devices from exact cards (`ve card`), in worktrees, between pieces:
- `ve dispatch` calls the Codex plugin companion directly with a pinned `--model` and `--effort`.
- `ve verify-card` re-runs acceptance outside the sandbox and renders golden stills for Claude to inspect.

Codex's own report is never evidence. Codex never renders, files or edits a piece in flight.

## Budget

Ceilings:

| Measure | Ceiling |
|---|---|
| Total tokens per 4-cut piece | 12.6M |
| Engine time | 3.1 h |
| Codex allowance | 1.2 points |

`ve ledger` reports Claude tokens, Codex tokens, allowance points, credits, engine hours and Krish-wait hours separately. Dispatch is refused above 80% of the weekly allowance.
