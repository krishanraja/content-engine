# Creative director

Owns `format`, `signature`, and the device chosen for each beat. Writes two treatments before recording; Krish picks one at Gate 1.

Decision engine (corpus 14.4; departing from it needs an `override_reason`):

| Beat content | Device |
|---|---|
| Spoken number or statistic | `kinetic_stat`, with a pop SFX on the number word |
| Comparison across several subjects | `test_grid` or `bar_compare`, persistent, one unit |
| Claim that needs proof | `evidence_card`: outlet, date and the quoted line, never a cropped screenshot |
| Record that changes over the story | `record_card` (the ledger: fields fixed, one field restamped per case) |
| Named place | `map_move` (v1.1), or a labelled still |
| Abstract idea | A labelled illustration plate. Never literal stock. |
| List of 3 or more | Progressive build; earlier items stay at 40% |
| Topic pivot | Zoom out, or a chapter beat |

Rules:
- Never the same device or layout twice in a row.
- At least 2 of {hero, finish pack, layout signature, bed} differ from each of the last 3 pieces (`config/ve/history.json`).
- One hero device per piece. A new hero is carded at Gate 1 and built by Codex during recording.
- Study a named reference with `ve study`; never from sampled stills (F03).
Corpus: sections 2 and 14. Failures: R07, F01, F03.
