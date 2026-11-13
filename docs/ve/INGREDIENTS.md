# ve's ingredients: one layer each, chosen per piece

Why (Krish, 13 Nov 2026, of the two 3D style test cuts): "no, these are both terrible. the captions should be
decoupled from the animation styles, these captions are boring and not active enough. The motion design is terrible,
the use of the screen space is terrible, the motion is 10X too slow, not immersive and engaging at all."
(`docs/ve/FAILURE_2026-11-13_3d-styles.md`, `config/failures.json` `ve-3d-styles-slow-static-captions`.)

A cut is built from independent ingredients. Each one is chosen in the spec on its own, with its own reason, and any
one can be swapped without touching the others. **A motion style never picks the captions, the transitions or the
camera.**

| Ingredient | Spec | Props | Drawn by | What it offers today |
|---|---|---|---|---|
| Motion style | `style.motion.module` | `motion` | `kit/motionProfiles.ts`, devices | the bank in `config/style-references.json` (motion layer): 11 profiles, plus 2 needing a device |
| Captions | `style.captions.theme`, `.placement` | `captionTheme`, `captionPlacement` | `captions/themes.tsx` on `captions/kit.ts` | 16 styles (`captions/names.ts`, `config/caption-themes.json`); placement in the lower band, the centre or the upper strip |
| Transitions | `style.transitions.kind` | `ingredients.transition` | `kit/ingredients.ts` | cut, whip, push, zoom-through, flash, punch |
| Camera | `style.camera.move`, `.hits` | `ingredients.camera`, `.hits` | `kit/ingredients.ts` | none, drift, phased, punch; device events kick it (a punch-in, a shake above calm, a flash at high) |
| Energy | `style.energy` | `ingredients.energy` | `kit/ingredients.ts` | calm, medium, high: handover length (16, 10 or 6 frames), blur, punch, shake and flash strength |
| Sound | `audio` (bed), `ve sfx` | `audio` | `audio.tsx` | unchanged: the bed is one shape (F40), the effects come only from the brand kit |
| Layout / frame use | beat `layout` and device boxes | `beats`, `objects` | `layouts/`, devices | **the open gap**, see below |

## Rules

- **Nothing chosen means nothing changes.**
  - With no `style.captions`, the cut uses `brand.caption_theme`, else the house caption.
  - With no `style.transitions`, `style.camera` or `style.energy`, there is no `props.ingredients`: every beat cuts
    under a still camera, and the composition draws exactly what it drew before (`houseGolden.test.ts`).
- **Captions win over a motion style's own captions.**
  - `style.captions` wins over `brand.caption_theme`.
  - A chosen caption theme also wins over a style's lead captions (`vertical-captions`).
  - Caption placement is the captions' own choice. Every place sits inside every channel's safe area (`captions/kit.ts`
    `REGIONS`, tested in `kit/ingredients.test.ts`).
- **The camera moves the picture, never the words.**
  - The camera and the handover move his take and the beat graphics together.
  - The captions and the frame stay still over them, and a flash lands over the picture under the captions.
  - Steady zoom stays small (at most about 1.05), because graphics run to the safe edges and a bigger steady zoom crops
    their words. That was seen on the 13 Nov test stills. The hits carry the energy, briefly.
- **Pure functions of (props, frame)**, so a still and a render agree frame for frame.
- **Names are kept in step in three places** (tested in `kit/ingredients.test.ts`):
  - the renderer (`captions/names.ts`, `kit/ingredients.ts`);
  - the contract (`packages/contracts/src/production-spec.ts`);
  - compile (`scripts/velib/compile.py`).

## A spec that uses them

```json
"style": {
  "motion": { "module": "data-story", "reason": "..." },
  "captions": { "theme": "slam", "placement": "lower", "reason": "the fast caption: every word lands as an event" },
  "transitions": { "kind": "zoom-through", "reason": "..." },
  "camera": { "move": "phased", "hits": true, "reason": "..." },
  "energy": "high"
}
```

## Pace is measured, not judged from stills

`python scripts/ve.py pace CUT.mp4` measures:
- visual events a second (onsets of picture change over the frame and in each tile, merged within 0.15 s);
- the longest gap with no event;
- motion energy;
- the share of the frame in use (`used`) and the share that changes each second (`active`).

It places each number among the references he keeps (`config/ve/pace-references.json`, re-measured by
`ve pace --refs` after `scripts/quick-edit/references.py fetch`). A number below every reference is flagged for the
session to watch at speed. It never refuses: THE_BAR says rates are not the bar.

His references on 13 Nov 2026, 8 clips:

| Measure | Range |
|---|---|
| Events a second | 2.9 to 4.6 |
| Longest gap with no event | 0.5 to 3 s |
| Used frame (median) | 0.15 to 0.94 (median 0.84) |

How a test cut is checked:
1. Measure it with `ve pace`.
2. Watch it at speed beside a reference: a side-by-side strip every 4 frames, and the cut itself.
3. Only then does it go to Krish.

## What is still open

- **Layout, the use of the frame.** The ingredients above do not move a device's box. On the 13 Nov test (house test
  take, headline and count devices on STAGE), the picture sat in the top half in both versions and the frame below
  y 1320 was empty. The next step is a `layout` ingredient (full-bleed, stack, split-tall), with devices that draw to
  the frame they are given, picture bleeding into the bottom band where no words may sit.
- **Captions as events with no page breaks.** `slam` makes every word an event. The pager (`compile._caption_groups`)
  still makes the pages.
- **Sound effects on handovers and hits.** The timing rule (start 10 to 20 ms before the visual change, peak on it)
  is noted. The effects must come from the brand kit, and none is filed there for handovers yet.
- **The 3D devices** (`ladder_stage`, `living_screen`) keep `needs_device`. They render over these ingredients like
  any device, but are not retried until the layout ingredient lets them fill the frame.

Sources: `docs/ve/sources/openmontage.md` (what was adopted, behaviour only, AGPL code not copied).
