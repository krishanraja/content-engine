# ve: the video engine

Read this and [RUNBOOK.md](RUNBOOK.md), then the signed spec and <=36 KB pack (`ve start`). Do not load NOW.md, WORKBENCH.md, learnings or failures while producing. Never read big files, individual images or raw logs into context: use QC JSON and one contact sheet.

## Why ve exists

Friday 23 Oct took a 62-hour thread, about 253M tokens, and four rejected cuts. Bespoke code bypassed gates, receipts were self-written, and prose rules lacked enforcement. ve uses one signed spec, one data-fed composition, specialists as code and measured readiness.

## The pieces

| Piece | Where |
|---|---|
| Spec: creative-direction.json, schema_version 2 | `packages/contracts/src/production-spec.ts`; `packages/contracts/scripts/check-spec.ts` |
| Formats (data, not code) | `config/ve/formats/*.json` |
| Crew: sections, lints, QC, cards | `config/ve/crew/<id>.{json,card.md,lens.md}` |
| Invariants | `config/ve/invariants.json` |
| Brand/motion roles | `config/ve/brand-tokens.json` |
| Tools/rulings | `config/ve/tools.json` |
| CLI and libraries | `scripts/ve.py`, `scripts/velib/*.py` |
| Usage and clock | `config/ve/budget.json`; piece `ve/ledger.jsonl`, separate `ve/clock.json` |
| Device capabilities | `config/ve/devices.json`; renderer `devices/registry.ts` and `devices/CONTRACT.md` |
| Renderer | `apps/renderer/src/engine/` (one `FormatMaster`, BrandFrame, devices) |
| Best practice | `_corpus/motion-design-video-corpus.md`, cited by section in each card |

## Protocol

Commands, outputs and 55-minute envelope: RUNBOOK.md. Batch questions; end sessions at gates. Krish-wait is separate.

| Step | Action | Who |
|---|---|---|
| S0 | doctor, start pack, ledger, start clock | Claude/scripts |
| S1 | Two treatments, lint, stills; Gate 1: treatment, stills, bed, credits merged into storyboard sign-off | Director/Claude, Krish |
| S2 | New hero only: card, dispatch --piece while Krish records, verify acceptance/golden stills | Claude dispatches/verifies; Codex builds |
| S3 | ingest: intended two-aligner word clock; currently exit 2 | script |
| S4 | Fresh Director session: lint, compile cut-ready timings/assets | Claude/scripts |
| S5 | Trial format/device: render excerpt proof; Gate 2 acceptance | script, Krish |
| S6 | Render each accepted cut | script |
| S7 | QC --props, <=2 fix loops, fresh Critic, final packet; Gate 3: watch cuts/hear joins reel | scripts, Claude, Krish |
| S8 | file: intended archive/library, currently exit 2; stop clock | script/Claude |

face-with-proof is proven; scoreboard-test and voice-led-pictures are trial. Registered devices: test_grid, record_card, query_chip, evidence_card, kinetic_stat; format lists also name future devices. Compile refuses device verbs absent from devices.json. test_grid draws carry with a dashed box and ANSWER DELETED outline text.

## CLI

Run commands as `python scripts/ve.py <command>`:

```text
doctor
start <piece>
lint <spec>
qc <cut> --format <format> [--out <path>] [--props <props>]
study <ref> [--out <path>]
card <fields>
dispatch <card> [--wait] [--piece <piece>] [--spend-approved]
verify-card <card> --cwd <worktree>
status <piece>
coverage
compile <spec> --cut <cut> --words <words.json> --assets-dir <assets>
render <props> <out> --spec <spec> --assets-dir <assets> [--scale <number>]
ingest [rest ...]
stills [rest ...]
ledger <piece>
ledger <piece> add <kind> <amount> [--note <text>]
time <piece> start <phase>
time <piece> stop
time <piece> status
file [rest ...]
```

`ingest`, `stills` and `file` are placeholders (exit 2). Stop unless approved inputs already exist through another route; quick-edit is fallback. Never claim complete ve production/filing from unavailable stages.
All commands accept `-h` / `--help`. Render scale defaults to 1 and must be
finite and positive. Render requires the source spec and the same staged assets
folder used to compile it, so lint and asset hashes are checked before rendering.

Compile/render lint first: findings print, exit 1, no new output. Words need unique indexes, text, ordered onset_s and finite numeric end_s >= onset_s. The onset-only 19-second fixture needs real aligned ends; synthetic test ends are not alignment. Compile refuses unapplied source edits and includes only objects in the cut's beat `uses`. Phase 1 refuses asset plates/used generated-asset references: illustration labels are not wired. Media paths must be relative and contained under assets, never URLs/absolute paths.

Captions use exact Archivo-heavy widths, aspect geometry/swipe padding. Pages: 2-5 words, <=2 lines, prefer punctuation; a single word only if it fills a line. Oversize words are refused by name. Dialogue: `round(last end_s * 30) + 12` frames. Whole cuts with a call add a 105-frame ending; captions stop at its start. Excerpts have no ending.

SFX kits: `config/ve/sfx-kits/<audio.sfx_kit>.json`, names mapped to `{ "path": "sfx/name.wav", "gain_db": -6 }` under assets. Kits are absent today; referenced sounds are omitted/reported, as are unknown names in present kits. Compile writes `props.<cut>.json` and `compile.<cut>.json` in the piece's ve folder; report: lint clean, sfx_missing event ids, props_sha256. Non-empty sfx_missing blocks status. Never mark intended sounds silent to hide gaps. Staged spec assets with declared SHA-256 must match; mismatches name the asset/refuse render.

Render transports string values as ASCII escapes, decoded for drawing. It measures AAC lag against the stem, corrects offsets >1 ms without re-encoding video, prints lag/residual, and fails if residual >1 ms. This does not replace QC. In Bash `. scripts/ve-env.sh` pins ffmpeg n8.1.2 and puts tesseract on PATH. QC --props supplies sync, joins, OCR, brand and cue inputs. Missing OCR is not_run. Exit 0 means measured checks pass, possibly incomplete; require measured_pass and complete, then status exit 0.

## Rules

- Captions always on (schema); colour roles only, never hex.
- Positions are signed-script word indexes; compile derives frames.
- One EDL drives picture, dialogue, bed, SFX/captions. No manual mux or separate retiming; AAC correction preserves video.
- No per-piece compositions/render scripts. New hero mechanisms become library devices via cards.
- Never hand-write a pass/receipt/ready. status checks lint, QC bound to the existing MP4 SHA, completeness, Critic verdict and Krish's exact-file approval.
- Evidence is real; generated illustrations need labels. Numbers name producers; mind.the.gap ends in a dated call. No synthetic Krish without realism-test approval. Follow tools.json recipes/rulings.
- No publish/send/schedule verb.

## Codex

Claude writes exact cards from fields JSON. Codex builds library devices in worktrees between pieces. dispatch uses the plugin companion with pinned model/effort. verify-card reruns acceptance outside the sandbox/checks write_allow; Claude then renders golden stills/reviews one contact sheet. Codex's report is never proof; Codex never renders/files/edits a production piece in flight.

## Budget

Caps come from `config/ve/budget.json`:

| Measure per piece | Ceiling / target |
|---|---|
| Engine time after recording | 1 h target; 60 min cap |
| Claude tokens | 3.3M |
| Codex tokens | 2.1M |
| Total tokens (Claude + Codex) | 12.6M |
| Codex allowance points | 1.2 |

`ledger <piece> add <kind> <amount>` appends actual usage; kinds: claude_tokens, codex_tokens, allowance_points, credits, engine_seconds, krish_wait_seconds. Amounts are finite/non-negative. Ledger reports OK/WARN/OVER, credits and wait minutes; exit 1 above any cap. Add still records over-cap usage. Credits/wait have no configured caps.

At >=80% stop and ask at a gate; refuse work past caps. These are session stop rules: ledger only warns at 80%; dispatch enforces all recorded caps only with --piece; time start enforces engine time only and refuses duplicate clocks. time stop appends elapsed seconds/removes clock; time status includes live elapsed time. Ledger/dispatch totals include stopped/logged time only. Separately, weekly Codex usage >80% refuses dispatch unless --spend-approved carries Krish's paid-credit yes. No flag waives piece caps.
