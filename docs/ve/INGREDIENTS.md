# ve's ingredients: captions, motion, transitions, camera and energy, each chosen on its own

## In short

- **A ve cut is built from separate ingredients.** Each is chosen in the spec on its own, with its own reason:
  - the caption style and where it sits;
  - the motion style;
  - the transitions between beats;
  - the camera;
  - the energy.
- **A motion style never picks the captions, the transitions or the camera** (Krish, 13 Nov 2026: "the captions
  should be decoupled from the animation styles").
- **27 caption styles**, any of which can sit over any motion style, in the lower band, the centre or the upper strip.
  All 27 are listed below.
- **14 drawable motion styles.** Three of them are taken from Krish's own cuts:

| Motion style | Taken from |
|---|---|
| `character-ai-receipts` | Character.ai, 26 Oct |
| `eating-jobs-ladder` | Eating its own jobs, 2 Nov |
| `ai-music-slam` | AI music, 11 Nov |

- **`python scripts/ve.py pace CUT.mp4`** measures how fast a cut moves and how much of the frame it uses. It does
  this beside his style references and his three cuts, so pace is measured, not judged from stills.
- **Nothing chosen means nothing changes.** A spec that sets none of the new fields renders exactly as before
  (`houseGolden.test.ts`).

## How a session uses it, step by step

1. **Pick the motion style** as before: `style.motion` (`ve styles`, his Pick a style press).
2. **Pick the caption style on its own:** `style.captions.theme`, from the table below, and `style.captions.placement`
   (`lower`, the default; `centre`; or `upper`). Choose for the piece, not for the motion style.
   - Over a full-bleed picture, `centre` puts the words in the middle of it.
   - Over graphics that fill the middle, keep `lower`.
3. **Pick the handover and camera:**
   - `style.transitions.kind` is one of `cut`, `whip`, `push`, `zoom-through`, `flash` or `punch`.
   - `style.camera.move` is one of `none`, `drift`, `phased` or `punch`, and `hits: true` lets device events kick it.
   - `style.energy` is `calm`, `medium` or `high`.
   - Each motion style's bank entry names the ingredients it was measured with. For example, `ai-music-slam` was
     measured with `whip`, `phased` and `high`.
4. **`ve lint` and `ve compile`, as before.** Compile turns these choices into props:
   - `captionTheme`
   - `captionPlacement`
   - `ingredients`
5. **Measure before anyone sees it.** Run `ve pace CUT.mp4`; a row that reads BELOW EVERY REFERENCE is a cut to fix.
   Then watch it at speed beside a reference before it goes to Krish.

```json
"style": {
  "motion": { "module": "ai-music-slam", "reason": "real proof slams onto the stage" },
  "captions": { "theme": "mint-word", "placement": "lower", "reason": "one word at a time, the hero in mint" },
  "transitions": { "kind": "whip", "reason": "scenes hand over on a blur whip, as in the cut" },
  "camera": { "move": "phased", "hits": true, "reason": "the camera never stops pushing" },
  "energy": "high"
}
```

## The ingredients

| Ingredient | Spec | Props | Drawn by | What it offers |
|---|---|---|---|---|
| Motion style | `style.motion.module` | `motion` | `kit/motionProfiles.ts`, `kit/motion-profiles.json`, devices | 14 drawable: `swiss-kinetic-type`, `data-story`, `dark-keynote`, `living-ui`, `hud-terminal`, `riso-halftone`, `paper-cutout`, `vertical-captions`, `single-line-drawing`, `line-boil`, `full-visual`, `character-ai-receipts`, `eating-jobs-ladder`, `ai-music-slam`. 9 more need a device of their own: `flat-vector-explainer`, `isometric-world`, `toy-3d`, `shape-morph`, `watercolour-ink`, `pixel-retro`, `film-crt`, `ladder`, `living-screen` |
| Captions | `style.captions.theme`, `.placement` | `captionTheme`, `captionPlacement` | `captions/themes.tsx` and one file each in `captions/styles/`, on `captions/kit.ts` and `captions/draw.tsx` | 27 styles (below) |
| Transitions | `style.transitions.kind` | `ingredients.transition` | `kit/ingredients.ts` | `cut`, `whip`, `push`, `zoom-through`, `flash`, `punch` |
| Camera | `style.camera.move`, `.hits` | `ingredients.camera`, `.hits` | `kit/ingredients.ts` | `none`, `drift`, `phased`, `punch`. Device events kick it: a punch-in, a shake above calm, a cream flash at high |
| Energy | `style.energy` | `ingredients.energy` | `kit/ingredients.ts` | `calm`, `medium`, `high`: the handover lasts 16, 10 or 6 frames, and blur, punch, shake and flash scale with it |
| Sound | `audio`, `ve sfx` | `audio` | `audio.tsx` | unchanged. The bed is one shape (F40), and effects come only from the brand kit |
| Layout and frame use | beat `layout`, device boxes | `beats`, `objects` | `layouts/`, devices | unchanged. **This is the open gap** (see "What is still open") |

## All 27 caption styles

Choose one with `style.captions.theme`. The words below are what the publish board shows (`config/caption-themes.json`).

| Name | On the board | What the viewer sees |
|---|---|---|
| `pop` | Pop | Bold capitals land word by word, and the word being said wears the series colour. |
| `karaoke` | Karaoke | The whole line is set at once, and each word fills to full cream as he says it. |
| `kinetic-01` | Justified stack | One word per row in Anton capitals, every row the same width, so the phrase becomes a block of type. |
| `kinetic-02` | Edge snap | Condensed capitals snap in from alternating sides of the frame into one left-aligned lockup. |
| `hustle` | Marker | Anton capitals, with a series-colour bar drawn under the key word just after he says it. |
| `grape` | Ink card | The line sits on a deep-ink card that opens as the phrase starts, and the word being said is mint. |
| `beast` | Punch | Huge outlined Anton capitals punch in, one or two words on screen at a time. |
| `poppin` | Spring | Mixed-case words spring up from their baseline with one small overshoot. |
| `aarit` | Editorial | The setup in a quiet Fraunces italic, then the hero word alone in Anton capitals at three times the size. |
| `soft-ai` | Bloom | Each word comes into focus from a soft blur, and the key word blooms with a brief mint glow. |
| `gaming-stream` | Terminal | Plex Mono on a deep-ink tag, each word typing itself out as he says it. |
| `simple-one-word` | One word | Only the word being said, in Archivo Black capitals fitted to the width of the caption band. |
| `podcast` | Two-line scroll | The line being said brightens word by word, and the line before it slides up and away. |
| `art-directed` | Art-directed phrases | Each caption is one phrase in Anton capitals, its key word alone on its own row, with a huge faint echo of that word behind. |
| `cinematic` | Cinematic | Captions as designed editorial moments: support words rise in a cascade and the hero word lands on its own line in tinted glass. |
| `slam` | Slam | Every word slams in as it is said, and the words already said stack above it, smaller. |
| `georgia-build` | Georgia build | Small mixed-case words at chest height, one to three at a time, where the typeface shows the stress: Fraunces for small words, Archivo ExtraBold for content, a size up for numbers and names, and Fraunces italic for the key word. Each chunk builds and then cuts hard to the next. |
| `stair-flash` | Staircase flash | Anton capitals build a stepped lockup word by word on hard cuts, with small connector words at about half size on the same baseline. The key word lands with a short series-colour streak and then cools to cream under a left-to-right wipe. |
| `tuck-stack` | Tuck stack | Tiny lead words tuck tight above big lowercase-as-said Archivo words, so each phrase sets as a mixed-scale lockup. The key word is a size up in the series colour, and the stack lifts away as the page ends. |
| `anchor-quote` | Quote anchor | A small running caption of up to three words changes every few words, while the page's hero holds beneath it in big Fraunces capitals between mint curly quotes, staying still across the next pages until a new anchor lands or 3 s pass. |
| `rack-focus` | Rack focus | Focus travels along the line: the word being said is sharp, the words already said slip out of focus, and the hero arrives on its own row in big Anton capitals from a deep blur. |
| `flip-hinge` | Hinge | Each word swings up into place on a hinge at its baseline, like a card flipped upright, lighting as it faces the camera, and the phrase falls away backward word after word as the page ends. |
| `slice` | Slice | Each Anton capital word arrives cut in two: the top half slides in from the left and the bottom half from the right, and they close on a mint hairline that flashes and fades. |
| `slot-roll` | Slot Roll | Letters roll up one after another into their own little windows like a slot reel, and every digit spins through four other digits before it lands on the true one. |
| `receipt-chip` | Receipt chip | Words type onto a till receipt as he says them, in lower-case mono on deep ink, the paper jolting down on every word and the figure printed on a mint fill. |
| `ink-block` | Ink block | The phrase builds word by word on stepped full-width ink slabs, each slab wiping in from the left with a thick series-colour bar drawing under the newest word. |
| `mint-word` | Mint word | One big word at a time slams into its own box, which wipes open just ahead of it; small words sit small, and the key word lands in a mint box. |

**How the 12 newest were made.**
- `slam` was built first, on 13 Nov.
- Eight were designed from his style references, studied at speed: `georgia-build`, `stair-flash`, `tuck-stack`,
  `anchor-quote`, `rack-focus`, `flip-hinge`, `slice` and `slot-roll`.
- Three come from his own cuts: `receipt-chip`, `ink-block` and `mint-word`.
- Each of the eleven was built, reviewed by a separate reader from rendered stills, fixed against that review and
  reviewed again. All are now judged active (every word lands as a visible event), distinct from each other, inside
  every channel's safe area, and in the house faces and colours only. Scores were 6.5 to 7.5 out of 10.
- **None has been watched moving on one of his takes yet.** Prove a style on his take before a cut ships with it.

## The three styles from his own cuts

Krish, 2026-11-13: "I want an array of animated motion caption styles available in the engine, decoupled from the
visual treatment. Ensure the Character.ai video, the Anthropic eating its own jobs video, the AI music video are used as
the basis for their own artistic styles too."

Each cut was studied at speed and measured by a separate reader. The full study of each, with its motion grammar,
layout, never-list and what the renderer still cannot draw, is in `docs/ve/styles/<style>.card.json`.

| His cut | Motion style | Caption style | Measured on the cut | What it looks like |
|---|---|---|---|---|
| Character.ai, Mon 26 Oct (sha256 39f1039c) | `character-ai-receipts` | `receipt-chip` | 3.85 events a second, 81% of the frame used | Evidence prints onto a lit ink desk above a still face band. Receipts, money maps and logo rows land on the word that names them, with no camera move and an 8-frame dissolve between states |
| Eating its own jobs, Mon 2 Nov (sha256 2cdff09a) | `eating-jobs-ladder` | `ink-block` | 3.91 events a second, 20 cuts a minute | One object, a career ladder, carries the whole piece. Numbers roll onto it, a slow push holds every panel, and every change is a 10-frame crossfade |
| AI music, Wed 11 Nov (sha256 3c360c73) | `ai-music-slam` | `mint-word` | 4.12 events a second, longest gap 0.93 s, 81% of the frame used | Real proof slams 500 px onto an ink stage with 12% overshoot. Mint is what a human made and hatched ink is what the machine made. The camera always pushes, and scenes hand over on a blur whip |

## Pace is measured, not judged from stills

`python scripts/ve.py pace CUT.mp4 [--out pace.json]` measures four things:
- **Visual events a second:** onsets of picture change over the frame and in each tile, merged within 0.15 s.
- **The longest gap with no event.**
- **Motion energy.**
- **The share of the frame in use:** `used` is the share that holds anything; `active` is the share that changes each
  second.

It places each number among two sets in `config/ve/pace-references.json`:
- his eight style references (re-measure them with `ve pace --refs` after
  `python3 scripts/quick-edit/references.py fetch`);
- his three cuts above (`house`).

A number below every one of them prints BELOW EVERY REFERENCE. It flags and never refuses, because THE_BAR says rates
are not the bar.

| Measured on 13 Nov 2026 | Events a second | Longest gap | Frame used |
|---|---|---|---|
| His 8 style references | 2.9 to 4.6 | 0.5 to 3 s | median 0.84 |
| His 3 cuts | 3.85 to 4.12 | 0.9 to 3.5 s | 0.51 to 0.81 |
| The rejected 3D style cuts (12 Nov) | about one device event every 5 s | | |
| Test cut on the house test take, house caption, no camera | 2.27 | 1.4 s | 0.30 |
| The same, with `slam` captions, `phased` camera, `zoom-through`, high energy | 2.56 | 1.4 s | 0.28 |

The last two rows are the honest finding of this work. Active captions and a moving camera help, but a cut whose
graphics sit in the top half of the frame still runs slower than all of his. **The graphics layer is now the gap, not
the captions.**

## Rules the renderer keeps

- **Captions win over a motion style's own captions.**
  - `style.captions` wins over `brand.caption_theme`.
  - A chosen theme also wins over a style's lead captions (`vertical-captions`).
  - Every placement sits inside every channel's safe area (`captions/kit.ts` `REGIONS`).
- **The camera moves the picture, never the words.** It moves his take and the graphics together; the captions and
  the frame stay still over them.
- **Steady zoom stays at about 1.05 or below**, because graphics run to the safe edges. The hits carry the energy,
  briefly. The handover flash is short and low, because a strong one read as a flat grey frame at speed.
- **Every ingredient and caption style is a pure function of (props, frame)**, so a still and a render agree.
- **Names are kept in step in three places**, held by `kit/ingredients.test.ts`:
  - the renderer;
  - the contract (`packages/contracts/src/production-spec.ts`);
  - compile (`scripts/velib/compile.py`).
- **The motion floor widened on 13 Nov 2026** (Ruling, Krish: "yes it should"). An entrance settles in 4 to 10
  frames, travels 0 to 500 px and overshoots at most 12% (`docs/ve/MOTION_STANDARD.md`). That admits his AI music
  slams and Character.ai's fade-only type. The house look keeps its measured 4 to 7 frames and 40 to 60 px.

## What was done on 13 Nov 2026 (this session)

1. **Why:** Krish rejected both 3D style test cuts (`docs/ve/FAILURE_2026-11-13_3d-styles.md`).
2. **OpenMontage** (github.com/OpenMontageInc/OpenMontage) was read in full by separate readers
   (`docs/ve/sources/openmontage.md`).
   - Its captions are weaker than ve's.
   - Its best motion craft is in the energy-tiered transitions, CollageBurst's landing flash and shake, and the
     phased camera. These are now in `kit/ingredients.ts`.
   - It measures no pace on pixels, so ve built `ve pace`.
   - It is AGPL-3.0, and Krish allows its code (Ruling, 13 Nov 2026: "you are allowed the code, no issues at all").
     A copied file keeps `source: "openmontage@fecb9a1"` in its header.
3. **The ingredients:** the spec fields, compile, props and the renderer camera layer. A cut with none of them is
   unchanged (`houseGolden.test.ts`).
4. **`ve pace`** (`scripts/velib/pace.py`), with his references and his own cuts as the comparison.
5. **Twelve caption styles**, each in its own file, built and reviewed as above. The shared helpers
   (`captions/draw.tsx`) hold the page-exit and marked-word rules that every reviewer asked for.
6. **Three motion styles from his cuts**, each with a bank entry in `config/style-references.json`, a profile and a
   study card.
7. **The motion floor widened** to admit those cuts, by his ruling.
8. **A test cut** on the house test take was rendered, measured and watched at speed beside a reference (the pace
   table above).

## What is still open

- **Layout, the use of the frame.** None of the ingredients moves a device's box, so graphics still sit where their
  layout puts them.
  - Next to build: a `layout` ingredient (full-bleed, stack, split-tall), with devices that draw to the frame they are
    given and pictures that bleed into the bottom band where no words may sit.
  - His cuts each need a staging the renderer cannot yet draw, listed under `gaps` in each card:
    - AI music: the ink stage over a cream band;
    - Character.ai: the ink desk over a still face band;
    - eating its own jobs: the butter tray over his chest.
- **Parts of his three styles that need devices:**
  - the hatched AI material, and tilted settles with a soft shadow (AI music);
  - the line-print jolt and the 250 px rise of a whole proof object (Character.ai);
  - the ladder that keeps its state across beats (eating its own jobs; card `docs/ve/cards/through-line/`).
- **No new style has been proved on his take.** Each needs `ve proof` and his press before a cut ships with it.
- **Caption details the reviewers left open:**
  - ink boxes are faint over very dark footage;
  - `slot-roll`'s letter windows look torn mid-roll;
  - a few one-frame overlaps on landing.
- **Sound effects on handovers and hits.** The timing rule is noted: start 10 to 20 ms before the visual change and
  peak on it. No handover sound is filed in the brand kit yet.
- **The 3D devices** (`ladder_stage`, `living_screen`) keep `needs_device` until the layout ingredient lets them fill
  the frame.
