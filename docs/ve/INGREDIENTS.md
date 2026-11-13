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
- **A layout ingredient** (`style.layout`, 13 Nov): graphics-only beats can fill the frame the captions leave instead of
  drawing small at the top.
- **Three stagings from his own cuts** (`style.layout.mode` `band`, `stage` or `tray`, 13 Nov): his take and a graphics
  panel share the frame the way they do in his Character.ai, AI music and eating-its-own-jobs cuts. Measured on his
  take, they lift a cut from 26% of the frame to 45 to 82%, and from 2.58 to as much as 3.88 events a second.
- **Nothing chosen means nothing changes.** A spec that sets none of the new fields renders exactly as before
  (`houseGolden.test.ts`).

## How a session uses it, step by step

1. **Pick the motion style** as before: `style.motion` (`ve styles`, his Pick a style press).
2. **Pick the caption style on its own:** `style.captions.theme`, from the table below, and `style.captions.placement`
   (`lower`, the default; `centre`; or `upper`). Choose for the piece, not for the motion style.
   - Over a full-bleed picture, `centre` puts the words in the middle of it.
   - Over graphics that fill the middle, keep `lower`.
3. **Pick the layout:** `style.layout.mode` is `fill` or `stack` on a graphics-only piece (see "The layout"), or a
   staging, `band`, `stage` or `tray`, on a piece that shows his take (see "The stagings"). `tray` needs
   `style.captions.placement: upper`, because it keeps his face clear; compile refuses anything else.
4. **Pick the handover and camera:**
   - `style.transitions.kind` is one of `cut`, `whip`, `push`, `zoom-through`, `flash`, `punch` or `crossfade`
     (a dissolve of 6 to 10 frames, set by the energy; it needs a motion style).
   - `style.camera.move` is one of `none`, `drift`, `phased` or `punch`, and `hits: true` lets device events kick it.
   - `style.energy` is `calm`, `medium` or `high`.
   - Each motion style's bank entry names the ingredients it was measured with. For example, `ai-music-slam` was
     measured with `whip`, `phased` and `high`.
5. **`ve lint` and `ve compile`, as before.** Compile turns these choices into props:
   - `captionTheme`
   - `captionPlacement`
   - `ingredients`
   - `layout`
6. **Measure before anyone sees it.** Run `ve pace CUT.mp4`; a row that reads BELOW EVERY REFERENCE is a cut to fix.
   Then watch it at speed beside a reference before it goes to Krish.

```json
"style": {
  "motion": { "module": "ai-music-slam", "reason": "real proof slams onto the stage" },
  "captions": { "theme": "mint-word", "placement": "lower", "reason": "one word at a time, the hero in mint" },
  "transitions": { "kind": "whip", "reason": "scenes hand over on a blur whip, as in the cut" },
  "camera": { "move": "phased", "hits": true, "reason": "the camera never stops pushing" },
  "energy": "high",
  "layout": { "mode": "fill", "reason": "every device fills the frame the captions leave" }
}
```

## The ingredients

| Ingredient | Spec | Props | Drawn by | What it offers |
|---|---|---|---|---|
| Motion style | `style.motion.module` | `motion` | `kit/motionProfiles.ts`, `kit/motion-profiles.json`, devices | 14 drawable: `swiss-kinetic-type`, `data-story`, `dark-keynote`, `living-ui`, `hud-terminal`, `riso-halftone`, `paper-cutout`, `vertical-captions`, `single-line-drawing`, `line-boil`, `full-visual`, `character-ai-receipts`, `eating-jobs-ladder`, `ai-music-slam`. 9 more need a device of their own: `flat-vector-explainer`, `isometric-world`, `toy-3d`, `shape-morph`, `watercolour-ink`, `pixel-retro`, `film-crt`, `ladder`, `living-screen` |
| Captions | `style.captions.theme`, `.placement` | `captionTheme`, `captionPlacement` | `captions/themes.tsx` and one file each in `captions/styles/`, on `captions/kit.ts` and `captions/draw.tsx` | 27 styles (below) |
| Transitions | `style.transitions.kind` | `ingredients.transition` | `kit/ingredients.ts` | `cut`, `whip`, `push`, `zoom-through`, `flash`, `punch`, `crossfade` |
| Camera | `style.camera.move`, `.hits` | `ingredients.camera`, `.hits` | `kit/ingredients.ts` | `none`, `drift`, `phased`, `punch`. Device events kick it: a punch-in, a shake above calm, a cream flash at high |
| Energy | `style.energy` | `ingredients.energy` | `kit/ingredients.ts` | `calm`, `medium`, `high`: the handover lasts 16, 10 or 6 frames, and blur, punch, shake and flash scale with it |
| Sound | `audio`, `ve sfx` | `audio` | `audio.tsx` | unchanged. The bed is one shape (F40), and effects come only from the brand kit |
| Layout | `style.layout.mode` | `layout` | `kit/layout.ts`, `kit/staging.ts`, `fit.ts`, devices | `house` (as before), `fill` (each device on a graphics-only beat gets the safe region the captions leave, and grows up to 3x, centred), `stack` (the beat's devices share that region top to bottom), and the stagings `band`, `stage`, `tray` (below) |
| Ground and entrance details | in the motion style (`kit/motion-profiles.json`) | `motion` | `kit/beatMotion.ts`, `kit/reveal.ts` | grounds `lit`, `vignette`, `hatched` beside `none`, `halftone`, `paper`; entrances may add `blurPx` (blur-in), `spinDeg` (a turn while entering) and `tiltDeg` (a resting tilt) |

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

## The layout (13 Nov 2026)

Krish, 2026-11-13: "build the layout ingredient next"; of the 3D test cuts, "the use of the screen space is terrible".

**Why.** A STAGE beat hands every device the whole frame. The devices that fit themselves (`fit.ts`) only ever shrank to
fit and pinned themselves to the top, so a count drew 120 px tall at the top of a 1920 px frame.

**What `fill` does.**
- Each device on a graphics-only beat (STAGE with no plate) gets the free region: the channel-safe column (x 60 to 860,
  y 280 to 1320) minus the band the captions sit in. The free region for each caption placement:

| Captions | Free region |
|---|---|
| `lower` | y 280 to 966 |
| `upper` | y 544 to 1320 |
| house caption | y 280 to 1060 |

- A device that fits itself grows up to 3x and centres in it. These are `headline`, `kinetic_stat`, `evidence_card`,
  `query_chip` and `test_grid`.
- A headline too long for the 800 px safe width at its 150 px minimum keeps its old stage placement instead of failing.

**What `stack` does.** The beat's devices share the free region top to bottom, each filling its share.

**How it stays safe.** Only boxes the layout hands out may grow (`isRegion`), so chrome and every other user of
`fit.ts` draw exactly as before.

**Measured on the house test take** (`fill`, with `slam` captions, a `phased` camera and `zoom-through`):

| Cut | Events a second | Frame used |
|---|---|---|
| Before the layout | 2.56 | 0.28 |
| With `fill` | 2.58 | 0.26 |

Watched at speed beside the AI music cut, the count now sits big and centred, but the frame is still mostly dark
ground.

**The finding.** The layout gives the graphics the space. What fills the frame in his cuts is real pictures: clips,
screens, his take in the band below. Nothing but pictures may sit below y 1320, and this test is text on an empty ground
with no picture at all. The next lever is the picture layer: every beat carries a real picture that fills the frame (his
take, a screen recording, the real artifact, footage), with the graphics laid over it.

## The stagings (13 Nov 2026)

**Why.** The layout gave graphics the space, but the frame stayed mostly empty ground (26% used). In each of his three
style cuts his take and the graphics share the frame in a staging ve could not draw (each study card's `gaps`). Now it
can, on every beat that shows his take (`kit/staging.ts`). SPLIT and WINDOW beats keep their own locks, and a
graphics-only beat in a staged piece becomes a full-frame takeover that fills as under `fill`.

| Staging | From | 9:16 geometry | The graphics region |
|---|---|---|---|
| `band` | Character.ai | ink panel y 0 to 1000 with a 10 px series-colour hairline; his take as a band y 1000 to 1920 | x 60 to 860, y 280 to 960, clear of the captions |
| `stage` | AI music | ink stage y 0 to 1236 with rounded bottom corners on a cream band; his take in a rounded, cream-edged window (x 600, y 980, 420 by 700) crossing the stage edge | x 60 to 860, y 280 to 956 |
| `tray` | eating its own jobs | his take full frame; a cream tray with a hard ink drop rises from bottom left (9 frames, a slight overshoot) | the tray, x 60 to 660, y 900 to 1500, over his chest; captions go upper |

16:9 has its own geometry: band is a side panel with his take on the right, stage a wide stage with his window bottom
right, and tray a lower-left tray.

- Each staged beat's devices get the staging's region and may grow into it (`isRegion`); several devices share it top
  to bottom.
- A style's own push zooms on the region's centre and never so far that the region leaves the frame.
- The panel takes the style's ground texture (`lit`, `vignette` or `hatched`).
- The held title (`captionStyle: word`) is not drawn under a staging, because it would sit on the graphics.

**Measured** on the lab's pinned take (the 5 Nov window, re-staged with its beats as P1 so his take shows; never the
rejected face-with-proof frames), each with its own style, caption style and ingredients:

| Staging | Style and captions | Events a second | Frame used |
|---|---|---|---|
| Before stagings (`fill`, 13 Nov) | | 2.58 | 0.26 |
| `band` | `character-ai-receipts`, `receipt-chip` lower, `whip`, `phased`, high | 3.75 | 0.69 |
| `stage` | `ai-music-slam`, `slam` lower, `whip`, `phased`, high | 2.88 | 0.45 |
| `tray` | `eating-jobs-ladder`, `georgia-build` upper, `crossfade`, `phased`, high | 3.88 | 0.82 |
| His references | | 2.9 to 4.6 | median 0.81 |

Watched at speed. What the frames showed was fixed before these numbers:
- the held title collided with the graphics, so it is now off under a staging;
- the tray covered his face, so it was moved to his chest and narrowed;
- `typing_bubble` overhung the region, so it now scales into it;
- `logo_card` drew a small row, so it now tiles to fill a region;
- the AI music push cropped a card, so it is now bounded to the region.

These checks used stand-in brand marks because the brand kit's marks are not reachable from a cloud session; the
stagings were judged on geometry and pace, not on the brand chrome. `stage` sits at the bottom of his range because
these beats carry one device each; its cut leans on real clips (`video_wall`, below).

## Sound on handovers and hits (14 Nov 2026)

Krish, 14 Nov 2026: "dispatch the cards, including the sound effects".

- **`style.sound`** (`{handover, hit, gainDb, reason}`) places one sound on every beat handover and one on every device hit,
  one frame before the picture changes. That is the nearest a 30 fps frame gets to the rule that a whoosh starts 10 to
  20 ms early and peaks on the change. Two sounds are never closer than 6 frames, and a hit never lands on a handover.
  Handovers sit at -14 dB and hits at -12 dB, under his voice. The Codex card is `ve-gap-handover-sfx-1`.
- **Only approved sounds play.** Every id must be an approved row in `config/sfx-approved.json`, written only from his
  press on the Sound effects card or his own words. Until then `style.sound` is refused by name.
- **The shortlist for his ear** is `config/ve/sfx-candidates.json`: four handover whooshes and three hits from his
  Epidemic Sound plan, short and dry, each with Epidemic's preview link.

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

## What was done later on 13 Nov 2026 ("do all the things not done to make this 11/10")

1. **The three stagings**, built, rendered on his take, watched, fixed and measured (above).
2. **Grounds and entrance details** from the study cards' gaps: `lit` (Character.ai), `vignette` (eating its own
   jobs) and `hatched` (the AI material); blur-in, a turn while entering and a resting tilt. The three style profiles
   now use them: Character.ai blurs its type in over 8 px on a lit ground, eating its own jobs drops cards in turning
   8 degrees to a 1.5 degree tilt on a vignette, and AI music settles on a 3 degree tilt.
3. **`crossfade` as a handover**, so the eating-its-own-jobs dissolve no longer has to come from the motion style.
4. **Fixed-zone devices grow in a region:** `quote_card`, `stat_strip`, `record_card` (`kit/regionFit.tsx`), and now
   `typing_bubble` and `logo_card`.
5. **The caption details the reviewers left open:** a cream rim on ink boxes over dark footage, whole-pixel `slot-roll`
   windows, and no old page on the frame a new page lands.
6. **`ve study` no longer crashes** on an older PyAV: it decodes the audio with ffmpeg first, and still writes
   `grammar.json` without words when no transcriber is installed.
7. **Nine Codex device cards** for the parts of his styles that need a device of their own
   (`docs/ve/cards/style-gaps/`).

## What is still open

- **The devices his styles still need** are carded, not built: `receipt_print`, `slam_word`, `checklist`
  (Character.ai); `pull_quote`, `unit_field`, the count-down ghost and the ladder `through_line` (eating its own jobs);
  `video_wall`, `mint_ring`, `takeover` (AI music). Codex builds them from `docs/ve/cards/style-gaps/` and
  `docs/ve/cards/through-line/`, dispatched from a home computer (`ve card` reads its local roots).
- **No staging or new style is proved on his take with the real brand chrome.** Each needs `ve proof` on a home computer
  (where the brand marks are) and his press before a cut ships with it.
- **Sound effects on handovers and hits.** The timing rule is noted: start 10 to 20 ms before the visual change and
  peak on it. No handover sound is filed in the brand kit yet; that is Krish's to approve (`config/sfx-approved.json`).
- **A re-layout dissolve inside one device** (Character.ai: the map gains a headline, the chip lifts and moves along an
  arrow) needs a device that crossfades between its own states.
- **The 3D devices** (`ladder_stage`, `living_screen`) keep `needs_device`: Krish rejected both 3D cuts on 13 Nov, and
  they come back only through a new card he asks for.
