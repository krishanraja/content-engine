# Proposal: what "ve passes Phase 3" means, and a pace rule

Status: **a proposal, not in force.** Written 14 Nov 2026 by the repair lane of the fleet audit (items ve-3 and ve-10).
Nothing here holds a cut back, changes what Krish sees or changes his press until he approves it in his own words.
If he does, the approved parts move into `docs/ve/RUNBOOK.md` and this file is marked superseded.

## Why this exists

AGENTS.md says "Quick-edit stays the fallback until ve passes Phase 3", and `docs/ve/STATUS.md` repeats it, but no
document says what passing Phase 3 is. So the fallback can never be retired on evidence, and nobody can say how close
ve is to that point. The audit found this as ve-3. The pace measurement (`ve pace`) now prints in `ve styles`, `ve lab`
and `ve packet` beside the reference cuts in `config/ve/pace-references.json`. Whether those numbers should ever hold a
cut back is his decision, so this proposal leaves it to him.

## Proposed pass criteria (all on his own takes, none on fixtures)

1. **Three pieces in a row on ve, end to end.** Each is cut from his recorded take through `ve` alone: one signed spec,
   no per-piece composition or render script, no hand edit after render. Each goes to the board with both cuts
   (9:16 and 16:9).
2. **His press on all three, first round or second.** Each of the three cuts reaches his Approve within two full-cut
   rounds (`ve packet`'s round count). "Not this" on a round counts against it. A third round fails the run of three,
   and the count starts again.
3. **Every mechanical gate green on the delivered bytes.** `ve qc`, the real-OCR caption checks, the channel-safe
   rows, the picture-against-sound receipt (|drift| <= 45 ms) and the brand-palette check all pass on the exact file
   filed. These already exist, so this criterion adds nothing new to build.
4. **The non-producer review at 8/10 or better.** `ve refs` against the piece's own inspiration-board cards, with the
   ve-critic verdict written before he sees the cut (F26).
5. **Watched at full size and heard against its script** by a reviewer who is not the session that made it, before
   it is called done (`cut-called-done-unheard`).
6. **No quick-edit rescue.** No cut of the three is re-made on quick-edit after it reached him.

When all six hold for three pieces in a row, the session that closes the third one says so in a now-note, and Krish
decides whether quick-edit is retired as the fallback.

## Proposed pace rule (his to approve or reject)

Today `ve pace` is a measurement only (`scripts/velib/pace.py`: "it flags; it never refuses").

Proposal: a cut that is **below every reference on both events per second and active frame** gets watched at speed,
side by side with the slowest kept reference, before it reaches his board. The line in `ve packet` would read "held
for a side-by-side watch". It would never be refused on the number alone. This answers his words of 13 Nov ("the
motion is 10X too slow, not immersive and engaging at all") without making a rate the bar, which THE_BAR forbids.

To switch it on he says yes. A later session then adds it to `ve packet`'s readiness, with a test, and records it as a
ruling.

## What is measured now (in force, no decision needed)

- `ve styles`: each shortlisted style's clip prints its pace line under it.
- `ve lab render`: each look prints its pace line.
- `ve packet`: each cut's section in `PACKET.md` carries its pace line, and the command prints it.

The line reads: each measure as `cut (references min .. median .. max)`, then the measures where the cut falls below
every reference, then "a measurement, never a gate". A cut that cannot be measured says why. It never fails the command.
