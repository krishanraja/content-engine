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
| Motion style | `style.motion.module` | `motion` | `kit/motionProfiles.ts`, devices | the bank in `config/style-references.json` (motion layer): 14 profiles, 3 of them from his own cuts (below), plus 9 needing a device |
| Captions | `style.captions.theme`, `.placement` | `captionTheme`, `captionPlacement` | `captions/themes.tsx` and one file each in `captions/styles/`, on `captions/kit.ts` and `captions/draw.tsx` | 27 styles (`captions/names.ts`, `config/caption-themes.json`), any with any motion style; placement in the lower band, the centre or the upper strip |
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


## Styles from his own cuts (13 Nov 2026)

Krish, 2026-11-13: "I want an array of animated motion caption styles available in the engine, decoupled from the
visual treatment. Ensure the Character.ai video, the Anthropic eating its own jobs video, the AI music video are used as
the basis for their own artistic styles too."

Each cut was studied at speed and measured by a separate reader. The cards are in `docs/ve/styles/*.card.json`, and
each cut became a motion style and a caption style of its own.

| Cut | Motion style | Caption style | Measured |
|---|---|---|---|
| Character.ai, Mon 26 Oct (mon26-tall) | `character-ai-receipts` | `receipt-chip` | 3.85 events a second, 81% of the frame used |
| Eating its own jobs, Mon 2 Nov (mon02-tall) | `eating-jobs-ladder` | `ink-block` | 3.91 events a second, 20 cuts a minute |
| AI music, Wed 11 Nov (tall, sha256 3c360c73) | `ai-music-slam` | `mint-word` | 4.12 events a second, longest gap 0.93 s |

The other eight new caption styles were designed from his style references, studied at speed:
- `georgia-build`
- `stair-flash`
- `tuck-stack`
- `anchor-quote`
- `rack-focus`
- `flip-hinge`
- `slice`
- `slot-roll`

All eleven were built, then reviewed by a separate reader from rendered stills, fixed, and reviewed again.

**The floor widened to admit his cuts (Ruling, Krish, 13 Nov 2026: "yes it should").** An entrance now settles in
4 to 10 frames, travels 0 to 500 px and overshoots at most 12% (`docs/ve/MOTION_STANDARD.md`). So `ai-music-slam`
slams 500 px with 12% overshoot over 10 frames, and `character-ai-receipts` lands with 0 px travel over 9 frames, as
their cuts do.

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

Sources: `docs/ve/sources/openmontage.md` (what was adopted; Krish allows its code, Ruling 13 Nov 2026).
