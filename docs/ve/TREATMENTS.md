# Treatments: effects applied by rule, never chosen

Status: Current (18 Nov 2026). The bank, the rules and the planner are built; the drawing is not yet (the cards
below build it). Owner: Claude, for Krish.

## In short

- **A treatment is a fixed recipe of effects tied to what a beat or a still is for.** The hook gets a hit on its key
  word, a number gets a glow, a receipt gets paper grain and a sweep of light, Krish on his take gets his background
  treated behind him.
- **Nobody picks treatments.** Krish's only visible choice stays the look, his Pick a style press. The look sets
  `style.energy`, and the energy sets how strong every treatment is (calm 0.6, medium 1.0, high 1.3).
- **The one switch** is `style.treatments: "off"`, written by Claude in the spec for a piece that should have none.
  A list of treatments is refused: they are never chosen one by one.
- **The same bank serves video and stills.** Covers, carousels and Notes images get the still treatments, so a week's
  Short, its cover and its carousel share one look without anyone matching them by hand.
- **Why** (Krish, 18 Nov 2026): "I don't want 300 different choices in the UI so figure out how. We can use this to
  empower the entire engine." And from 17 Oct (learning `upgrade-the-edit-style`): "The background of the person has
  also been treated when he's talking so it doesn't look too amateur."
- The effects are rebuilt from EffectCraft's catalogue (308 effects, MIT/Apache): [`sources/effectcraft.md`](sources/effectcraft.md).

## Where everything lives

| What | Where |
|---|---|
| The bank: primitives, treatments, rules, limits, strengths | `config/ve/treatments.json` (the only home; nothing else lists a treatment) |
| The planner: which treatments a beat or still gets | `scripts/velib/treatments.py` (`plan_cut`, `plan_still`, `check_bank`) |
| Its tests | `tests/ve_treatments_test.py` |
| What was taken from EffectCraft, with its parameters | [`sources/effectcraft.md`](sources/effectcraft.md) |
| The cards that build the drawing | `docs/ve/cards/treatments/` (`ve-treat-1-subject-lift`, `ve-treat-2-still-treatments`, `ve-treat-3-motion-treatments`) |
| The decision and its reasoning | [`docs/proposals/2026-11-18-treatments.md`](../proposals/2026-11-18-treatments.md) |
| Where the other ingredients are chosen | [`INGREDIENTS.md`](INGREDIENTS.md) |

## The three layers

| Layer | Who chooses | How many |
|---|---|---|
| **Look** (motion style and its energy) | Krish, one press, from options rendered on his own take (`ve styles`) | 1 per piece |
| **Ingredients** (captions, transitions, camera, energy, layout) | Claude, in the spec ([`INGREDIENTS.md`](INGREDIENTS.md)) | Hidden from Krish unless he asks |
| **Treatments** | The engine, by rule, from each beat's role, face and devices | Never shown as a menu |

## The rules

Video, per beat, in this order, at most two per beat (`limits.max_treatments_per_beat`):

1. His face is full on the beat (`face: "full"`): `subject-lift`.
2. A device on the beat shows a number (`kinetic_stat`, `stat_strip`, `quota_chart`, `leaderboard`, `ladder_stage`,
   `slot_machine`): `number-glow`. A receipt or proof (`receipt_print`, `evidence_card`, `record_card`,
   `passport_page`, `quote_card`, `pull_quote`, `thread_card`, `stamp`): `receipt-paper`.
3. By role: `hook` gets `hook-hit`, `payoff` gets `payoff-glow`; `anchor`, `bridge`, `pivot` and `why` get nothing
   from their role (`why` replaced `call` on 24 Nov 2026, `docs/FIVE-WHYS.md`). The landing stays clean. `pivot-split` is retired (20 Nov 2026): a channel split on the turn reads as a
   layout change, and a cut keeps one staging (Ruling, Krish, 2026-11-20; `docs/ve/INGREDIENTS.md`, "Shot grammar").

Stills, by kind, and only where the still has the content each one needs:

| Kind | Treatments |
|---|---|
| `cover` | `subject-lift` (when it carries his cutout), `still-grain` |
| `carousel` | `still-grain`, `still-duotone` (photos only), `still-glow` (the one number or key word) |
| `notes_image` | `still-grain`, `still-duotone` (photos only) |
| `meme` | none: a meme reskin keeps the original clip as it is |

Never: `channel-split` or `highlight-sweep` on his face (`limits.never_on_face`); a strength over 1.5; a treatment
whose primitives are not all built (the planner marks it `drawable: false` and compile leaves it out).

## Use it

```
python3 scripts/velib/treatments.py check                                   # the bank holds (exit 0)
python3 scripts/velib/treatments.py plan <spec.json> --cut short            # the plan for one cut
python3 scripts/velib/treatments.py still carousel --photo --number         # the plan for one still
```

A session making a piece does nothing new: the planner runs from the spec it already writes. To add or change a
treatment, edit `config/ve/treatments.json` and run the check; a treatment Krish rejects goes on the rejection floor
and comes out of the bank.

## What is built and what is not (18 Nov 2026)

| Part | State |
|---|---|
| Bank, rules, planner, check, tests | Built |
| `subject-lift` (matte per take, background treated, rim light) | Card `ve-treat-1-subject-lift`, queued |
| Still treatments (grain, glow, duotone, sweep), one module for every still maker | Card `ve-treat-2-still-treatments`, queued |
| Motion treatments drawn in the renderer, and compile carrying the plan into props | Card `ve-treat-3-motion-treatments`, after the first two |

Until a card merges and sets its primitives `built: true`, every treatment it draws is `drawable: false`, and every cut
and still renders exactly as it did (`houseGolden.test.ts`).

## How it is proved

- A treated cut is judged as a whole picture, never from receipts: `ve refs` strips of the treated beats beside the
  untreated take, a fresh critic, then Krish at full size.
- The subject lift carries a smeared-picture receipt for its exact bytes (`scripts/frame_smear.py`, F53). A matte that
  smears hair or hands is a blocker, never a caveat (F54).
- After any card merges: `ve lab render` and `ve lab diff` against the last lab folder; a cut that asks for no
  treatment must not move.
