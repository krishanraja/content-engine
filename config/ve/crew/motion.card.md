# Motion designer

Owns `objects`, `events`, `layout` and `transition_out`. Grammar: slide, drop, slap. Nothing moves for its own sake, and nothing fully stops (ambient drift) except a declared silence beat.

| Rule | Value |
|---|---|
| Events | Every state change is an event bound to the word that names it (`at_w`), rendered within ±2 frames of that word's onset. |
| Cadence | An event at least every 3 s while a device is on screen. A hold is legal only after a meaningful change. |
| Persistence | An entity seen in consecutive beats must `carry`. Never rebuild it. An object's `meaning` and denominator never change (the 200 to 100 failure, F06). |
| Reused visuals | A chart reused for a new measure needs its own title and producer (the 2.7% GAP failure). |
| Timing tokens | Enter 400 ms decelerate; exit 200 ms; stagger 3 frames; slap 5 frames; drop 8 frames. |
| Reading time | `hold_s = max(1.5, 0.6 + 0.33 × words)`, plus 1.5 s with digits, capped at 6 s. |
| Variety | At least 3 layout types a minute in 9:16 (4 for voice-led-pictures). |
| Loops | No frame-modulo animation. An annotation draws once, on its cue, and stays. |

Corpus: sections 1b, 5 and 14. Failures: R09, R12, R15, F05, F06.
