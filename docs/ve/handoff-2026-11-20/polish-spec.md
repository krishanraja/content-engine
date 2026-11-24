# makeyourmindup: the 10% polish

Status: proposal for Krish, 20 Nov 2026. Read-only on the repository: nothing in `krishanraja/content-engine` was changed.
Board: `polish-board.png`. Frames: `frames/*.png` (1080 x 1920 tall, 1920 x 1080 wide, 1280 x 720 thumbnail). Sources: `render.js`, `render2.js`, `render3.js`, `board.js`.

Krish asked for "a little bit of polish that we can do to make things just that 10% more premium to look at", "classier and more consistent". He likes the brand kit as it is, so this refines it. Nothing here is a rebrand.

**North Star.** This work moves the quality part: "every piece becomes an essay, a Short and a carousel at 10/10". It does not move the count directly. The count is at U4 (4 against 12 this week). Nothing here should hold a piece back. Each change goes in as an engine change and must leave unchanged any cut that does not ask for it (`houseGolden.test.ts`).

**What binds this spec.**
- `get_approved_taste` (production, `krishanraja/content-engine`) returned **0 approved production rules** for Make Your Mind Up, with the note "do not invent one". It also returned the **floor**: 257 standards. The ones cited below by number (F#) are from that floor.
- `config/brand-palette.json` (wins over the doc).
- `config/ve/brand-tokens.json`.
- The shot grammar (`docs/ve/INGREDIENTS.md`, 20 Nov).
- `docs/ve/TREATMENTS.md`.
- The cover-art and thumbnail-designer skills.
- `docs/production/COVER-STANDARD.md`.

**Order of this spec.** The coordinator relayed three things from Krish on 20 Nov, so the spec runs in this order:
- the **title slide** and the **outro** lead;
- two **protected baselines** come next (the Character.ai platform deep dive and the additive unit chart);
- then the six areas he named.

---

## 0. The brand tokens everything below uses

| Token | Value | Status |
|---|---|---|
| ink / ink_deep / ink_soft | `#0C1512` / `#070D0B` / `#16221D` | house |
| cream / mint | `#F4EFE4` / `#7EF0C0` | house |
| butter / lilac / coral | `#FFD84D` (Mon) / `#B7A6FF` (Wed) / `#FF6A4D` (Fri) | series identity |
| **ember** | `#E2551F` (burnt orange; coral pulled toward orange) | **proposed, needs his words** |
| **ember_deep** | `#B8321C` | **proposed** |
| **plum / plum_deep** | `#3B1232` / `#1E0918` | **proposed** |
| peach (duotone highlight only) | `#FFB48F` to `#FFE3D1` | **proposed** |

**Motion.** All motion uses the house curves, at 30 fps (`brand-tokens.json` `motion`):

| Use | Curve | Duration |
|---|---|---|
| Enter | `[0.05, 0.7, 0.1, 1.0]` | 400 ms |
| Exit | `[0.3, 0, 0.8, 0.15]` | 200 ms |
| Utility | `[0.2, 0, 0, 1]` | 300 ms |
| Hero (every entrance here) | `[0.16, 1, 0.3, 1]` | — |

- Stagger is 3 f; a slide is 12 f.
- Speed blur is a half-frame shutter, capped at 18 px (`kit/ingredients.ts` `MAX_BLUR_PX`).
- Grain is 0.07, behind everything, never over a mark (`brand-tokens.json` `finish`).

**Gradients, defined once.**
- **The moment gradient**, top to bottom: plum_deep 0% → plum 12% → ember_deep 30% → coral 46% → ember 62% → `#8E2A22` 82% → plum_deep 100%. Add a 35% peach radial at the number's height, and grain 0.09.
- **The title variant** puts the burnt orange at the top: `#FF7A52` → coral 22% → ember 50% → `#8E2A22` 74% → plum 90% → plum_deep. This keeps plum words on orange (manfred.wine).

**Day colours.** Off days are mint and never coral (palette `colour.off`). So the ember gradient is a series-day treatment, or it needs his words for off days (see section 11).

---

## A. LEAD: The title slide

**What he asked.** Krish, 20 Nov: "a good looking title slide, and a good looking outro are hugely important. The title slide comes in as I say the words of the title within the opening 30 seconds."

**Fixed by approved rules, not open to change:**
- The title line is said inside a sentence, after the hook (`title_moment`, `title_line`; HOOK_IS_THE_INTRO).
- Each word lands on its spoken frame.
- The captions step aside while the title shows.
- It builds in the staging's panel, then holds full frame **at most 2 s** from his last title word (`compile.grammar_title`, `TITLE_FULL_MAX_FRAMES = 60`).
- The stacked wordmark is part of the title frame and appears only there and on the close (`logo_rule`).
- His 19 Nov reference is the Wed 11 "AI MUSIC or HUMAN MUSIC?" lockup.
- **New gate in this spec:** the title must land by 30 s. Today `ve lint` `title.moment` only checks "within the first three beats", so this needs a time check: `title_moment.spans.<cut>` first word < 900 f.

**What is wrong today** (`02a`, `T-before`):
- The lockup sits in the band with the cut's own face band still showing.
- An orphan "IN" ends band 2 (F194).
- The hatched band texture fights the type.
- The bars behind are at full strength.
- "or" is a small Anton word that reads as noise.
- The wordmark touches band 2.

### Direction A (recommended): the approved two bands, landing word by word

**Tall timeline, in frames from his first title word** (frames `T-A1`…`T-A7`):
1. Band 1 (cream) slides in from the left with his first word: 8 f, hero, speed blur.
2. Each word then lands on its own spoken frame. It travels 70 px from the right over 6 f on the hero curve and sharpens from blur.
3. "or" is **Fraunces italic 520, mint**. It rises 20 px over 6 f (utility) on the spoken "or".
4. Band 2 (mint) slides in from the right on its first word.
5. Both bands are rotated −3°. Each has a brutal shadow of 14 px in the **series colour** (channel identity, allowed: `role_rules.channel`).
6. Type is Anton 108 px, leading 0.94, ink on colour (`type_on_colour`). Lines are broken by hand so no word is stranded (3/3/2 and 3/2/2).
7. **In the panel:** the lockup is laid out at 86% size inside the band staging's panel (y 0–1000), never a full-frame picture shrunk into it.
8. **On his last title word, the panel takes the frame.** Its lower edge slides from y 1000 to 1920 over 8 f (hero), and the lockup settles to 100%. The stacked wordmark (500 px wide, centred) rises 40 px over 10 f, starting at f 6.
9. **Hold** to 1.8 s.
10. **Leave:** the lockup exits left by 35% on the exit curve over 8 f, dimming to 0.15 (the existing lead rule). The staging returns from the right on the hero curve. The full frame lasts at most 2.07 s, which clears the 60-frame cap.

**Ground.**
- ink_deep with a radial `#10201a` glow.
- The bars behind are cut to **12% mint**, so the type leads.
- Grain 0.07.
- The hatching is gone: bands are solid cream and solid mint.

**16:9** (`T-A8`…`T-A10`): it builds in the pillar staging's 1312 px panel at 70% size and takes his 608 px column on the last word. Two lines per band.

**Why A.**
- It is the build Krish already called good (19 Nov).
- It fixes every flaw listed above, and it keeps the cream, mint and ink brand.
- Reference: Glory Birdie's restraint (one display face, one italic accent).

**Engine files:**
- `apps/renderer/src/engine/title/TitleMoment.tsx`: word-by-word entrance; a serif connector; no hatch; bars at 12%; a shadow token; panel-to-frame grow instead of the 6 f cut.
- `scripts/velib/compile.py` (`grammar_title`): unchanged cap; add the 30 s check.
- `scripts/velib/lint.py` (`title.moment`).
- `config/ve/frame-checks.json` (`title_lockup`).

### Direction B (second): the ember lockup

No bands: plum Anton words straight onto the title gradient, the serif "or" in cream, and the stacked wordmark in an ink label box (the wordmark lives "on the near-black only").

Frames: `T-B1` (in the panel), `T-B2` (full frame), `T-B3` (16:9).

- Reads as manfred.wine / Suno.
- Needs the ember and plum tokens approved first.
- Off days would need a mint version.

### Direction C (third): behind him, through the matte

Anchor cuts only. His wall becomes the title ground and the words land behind his head (`T-C1`, `T-C2`).

Third, for three reasons:
- It needs `subject-matte` (card `ve-treat-1-subject-lift`, not built).
- A long title cannot sit above his head inside the anchor eye line (eyes y 0.30–0.44).
- So it suits titles of five words or fewer.

---

## B. LEAD: The outro

**What he ruled.** Krish, 19 Nov, relayed by the coordinator: the tall close is the 9:16 intro sting with "Built to help you decide." layered on, at most 2 s. The wide close holds for YouTube's end-screen elements.

**The sting clips used here** (extracted from his Intro Sting page as data, shapes 9:16 and 16:9, 56 f, 1.87 s):

| Clip | sha256, first 16 | Matches the config? |
|---|---|---|
| mind_the_gap 16:9 | `1bb135faba51c47c` | yes |
| follow_the_money 16:9 | `9f18f57b4e7b95eb` | yes |
| under_the_hood 16:9 | `0b0a5b9df80a7f90` | yes |
| mtg 9:16 | `72e31337406d500d` | yes |
| ftm 9:16 | `09da1e77bcd128b1` | yes |
| uth 9:16 | `1613a721fb1f5986` | yes |

**The sting's shape.** MAKE / YOUR / MIND on coral, lilac and mint slabs, then an ink band carrying the wordmark that settles on coral at f 43–52, then a blur up and black. The band, cut out as alpha, spans y 696–1155 tall and 302–841 wide.

**Reconcile this first.** The repository does not yet hold the 19 Nov ruling:
- `config/brand-palette.json` still makes the tall close `statement_beat` (an ink card).
- It lists `sting_held_as_outro` under `retired`.
- Its `retired.match` includes `sting-9x16`, so the guard would **refuse** a close file named after the sting.
- `config/intro-sting.json` is `retired`.

Before building, the palette's `closes.statement_beat` and `retired` need his words added. Per the canon, only Krish's words change the palette; I did not change it.

### Tall, Direction A (recommended): the band lifts, the line lands under it

Exactly 60 f (frames `O-A1`…`O-A5`):
1. **c 0–29:** the sting's frames 1–44 play at 1.5x (sharper, and it leaves time to read the line).
2. **c 30–41:** the sting holds on its settled band (f 48). The whole sting plate rises 330 px (hero, 12 f), so the band sits at y ≈ 370–825.
3. **c 34–50:** "Built to help you" slides in from the right (Anton 96, ink, hero, 10 f, speed blur). Then "decide." (**Fraunces italic 560, 176 px, ink**) 6 f later.
4. **c 46–54:** the action rises 14 px: an ink "Subscribe free" pill (Archivo wdth 62, 700, caps) beside `makeyourmindup.ai` (Plex Mono, ink).
5. **c 54–59:** hold.

Every word sits inside the tall core box (x 120–820, y 330–1180), as the palette's tall box rule asks. No days row on tall (palette).

**Why A.**
- It is exactly his ruling (the sting, then the line).
- It is the only direction where the sting is untouched and the line has a full second to read.
- Type on the coral is ink (`type_on_colour`).

### Tall, Direction B (second): a second band

The sting's band holds where it is. A cream band carrying the line slams in from the right above it, rotated −4°, with a 14 px ink shadow. It rhymes with the title's two bands, so the open and close match (`O-B1`, `O-B2`).

Second because:
- the action has to sit above the bands to stay in the core box;
- the cream band's line runs smaller (84 px).

### Tall, Direction C (third): the words take the slabs

After MIND, each word of the line arrives on its own colour slab at the sting's rhythm. "decide." closes on the band (`O-C1`, `O-C2`).

Third because:
- It reuses the series colours as backgrounds, beyond identity.
- It is hard to read in 1.2 s.
- It stretches the sting's grammar into a second sting.

### Wide, Direction A (recommended): the sting resolves into the statement card

The palette's `statement_card` runs 6 s minimum, settled by 2.75 s, then held 5–20 s for end-screen elements. Frames `O-A6`…`O-A8`:
1. The 16:9 sting plays in full (1.87 s).
2. On its band frame, an ink ground wipes in from the right (12 f, hero).
3. The band (alpha cut-out) shrinks to 50% into the masthead slot at top left.
4. "Built to help you" (Anton 120, cream) and "decide." (Fraunces italic 180, **series colour**) slide in.
5. The action row follows: a mint "Subscribe free" pill, `makeyourmindup.ai`, and the days row in their series colours (MONDAYS · WEDNESDAYS · FRIDAYS).
6. The right 44% (x 1100–1800) stays clear for YouTube's end-screen elements (dashed guides in the mock only).

This also fixes today's wide card, whose lower half is empty (F51/F53, `O-before-wide`).

**Engine files:**
- `apps/renderer/src/engine/chrome/EndingBand.tsx` (`ENDING_TIMING`, `ENDING_TIMING_TALL`).
- `scripts/velib/compile.py` (`ENDING_FRAMES`, `ENDING_FRAMES_BY_ASPECT`; sting props on the close only).
- `scripts/quick-edit/kit/endcard.html` (kit's close).
- `config/brand-palette.json` (`closes`, `retired.match`).
- `config/intro-sting.json` (a close-only status).
- `scripts/brand_palette.py` and `tests/brand_palette_test.py`.

### Wide, Directions B and C

- **B (second):** stays on the sting's coral, with ink type (`O-B3`). It is louder, and the masthead sits on coral rather than ink.
- **C (third):** today's statement card refined only, with no sting (`O-C3`). This is the fallback if he wants the wide close unchanged.

**Off days.** No sting exists for off days (only ftm, uth and mtg), and an off-day close must be mint with no days. Either:
- a mint sting variant is needed (a Codex card), or
- off-day tall closes keep the statement beat.

This is for him to decide.

---

## C. Protected baseline: the platform deep dive (the Character.ai top half)

Krish, 20 Nov: "Just make sure that we don't lose the character.ai top half of the screen style ... integrate it into future videos, particularly where I deep dive into an actual platform."

This is the **band staging's protected default for a platform deep dive**. The polish keeps it and does not restyle it away.

**The source.** I fetched the cut through `scripts/post-pack/drive_review.py` (sha `39f1039c…`, verified) and took its frames as the baseline:

| Frame | Time in the cut |
|---|---|
| `PD-0a` | 6.2 s |
| `PD-0b` | 9.6 s |
| `PD-0c` | 13.2 s |

**What the baseline is** (from his screenshots and the cut):
- the platform's own wordmark as a header;
- a tiled wall of the platform's UI cards behind;
- two-tone condensed headlines (cream, one mint word) that blur-in by word;
- butter event tape ("CHAPTER 11 ·" / "COURT FILING · FILED 12 OCT 2026 ·") with confetti chips;
- a real screen recording with yellow hand-drawn loops on the items he names, and the mono source line under it;
- a black caption slab with a series-colour underline on the seam.

Its motion grammar (`docs/ve/styles/character-ai-receipts.card.json`) is **fade and rise, never a camera move**. So the horizontal slide system in section 2 does **not** apply inside this recipe: its own BUILD FADE, OBJECT RISE, LINE PRINT and WORD BLUR-IN stay.

**Rebuilt, then polished** (`PD-1a/1b`, `PD-2a/2b`, `PD-3a/3b`; the face band and caption are the cut's own pixels):

| Element | Device today (`config/ve/devices.json`) | Gap | The 10% polish |
|---|---|---|---|
| Platform wordmark header | `logo_card` (registry marks only) | the platform's official mark needs a registry entry per platform (Brandfetch); today it was drawn type | the real mark, centred at y 40, 350 px, screen-blended |
| UI wall backdrop | `wall_screen` is one screenshot on a skewed wall; `video_wall` is at most 6 tilted clips | **missing: a tiled wall built from his own screen grabs** (crops of his recording, 40 tiles, drifting 0.6 px/f, ink scrim 55→72%) | built from his real grabs instead of drawn dots; it drifts so it is never still |
| Two-tone headline | `headline` (1–2 lines, `swipe` box on one word) | a per-word **tone** (mint text, no box) to match the cut | Anton 150, leading 0.90, 72 px margins, soft drop shadow for legibility over the wall; word blur-in 8 px→0 in 3 f, 4 f apart |
| Event tape | `marquee` (one horizontal strip, `items`, `at`) | **missing: event tape**, meaning two rotated tapes (−6° / +5°), a display line and a mono filing line, opposite slide-ins, and a one-time chip burst | tapes slide in from opposite sides (10 f hero, 3 f apart); the filing line in Plex Mono 600 is the source (additive, F5); 12 chips, burst once, gone by 1.2 s |
| Hand-drawn circle on a recording | `scribble` (`loop`, colours cream or mint only); `mint_ring` (mint only) | **missing:** the series colour on `scribble`, and an annotation bound to a region of a `photo_plate` / `video_wall` recording | each loop draws on the word that names it (8 f utility), double stroke (9 px + a 3 px echo, +4°, 3 f later) |
| Screen recording | `photo_plate` (video), `video_wall` | it wants a device frame | a 22 px radius frame, 2 px cream border at 16%, push 1→1.04 over 2 s |
| Mono source line | each device's `source` | none | Plex Mono 22, 0.06 em tracking, 75% opacity, always under its evidence |
| Caption slab + underline | captions theme (house) | none; keep | unchanged (captions are decoupled, F20/F31) |

**Engine files:**
- `apps/renderer/src/engine/devices/marquee/` (or a new `event_tape` device: two strips, rotation, chips).
- `devices/scribble/schema.ts` (colour `channel`) and its target on a plate region.
- A new `ui_wall` device fed from `assets` grabs, or `video_wall` mode `tiles`.
- `devices/headline/schema.ts` (`tone` per word).
- `logo_card` registry entries per platform.
- `docs/ve/styles/character-ai-receipts.card.json` and `config/ve/recipes/character-ai-receipts.json`: mark `deep_dive: true` as the default recipe when a piece's subject is one platform.

---

## D. Protected baseline: the additive unit chart (the Mon 2 Nov jobs piece)

Krish, 20 Nov: "this visual was really nice in how it explained additively what I was saying in the Anthropic jobs video."

**The point he likes.** The picture adds one piece per spoken claim, so it explains as he talks.

**What it is.**
- 100 ID badges, 10 × 10, on a plane in slight 3D.
- Juniors carry a butter stripe; they grey from the end of the grid.
- A giant cream numeral counts at the top left.
- A mono source line ("ANTHROPIC · OCT 2026").
- The seam caption on the black slab, underlined in the series colour.

Original: `UC-0`. Rebuilt: `UC-1` (the wall lands, "out of every hundred"), `UC-2` ("27": 27 stripes), `UC-3` ("9": the juniors grey from the end of the grid to 9 left), `UC-4` (16:9 in the pillar panel).

**Device today.** `unit_field` (verbs `enter, drop, grey, multiply, exit`; params `columns` up to 40, `mark: dot | block`; an event's `toState` names a dataset row, so drop and grey read unit counts) holds the logic, plus `kinetic_stat` (`count_to`) for the numeral.

**Missing to draw it as he saw it:**
1. a `badge` mark;
2. a second category (`stripe` on a named subset);
3. the 3D plane (`perspective: rotateX 24°, rotateZ −6°, skewX −4°`);
4. `order: from_end` for greying;
5. a bound counter, so the numeral reads the same row as the grid in the same frame.

**Binding to the word.** Each event's `atFrame` comes from the word that names it in the cut's transcript: motion-designer plans "events on the words that name them" (INGREDIENTS.md). One claim is one event: `enter` on "every hundred", `drop` or stripe on "27", `grey` to 9 on "9". That is never more than one change per claim (`grammar.repeat`), and each change lands within 2 f of its word.

**Ratios.**
- 9:16: in the band panel. The grid is at 60% scale, right of centre; the numeral is top left, 230 px.
- 16:9: in the 1312 px pillar panel. The grid is at 72%, the numeral 260 px.

**Polish: none to the idea.** Grain, tighter grid gaps (12 px) and a badge clip-slot detail only.

**Default.** Make it the **default treatment for any proportion or count in a follow.the.money piece**: `config/ve/recipes/data-story.json` and the motion-designer skill's device choice, with `unit_field` first for shares and counts.

**Conflict to flag.** His screenshot carries the FOLLOW.THE.MONEY pill and a wordmark in the body. From 16 Nov a short's body carries neither (palette `formats.short_cut` / `logo_rule`), so the rebuild leaves them out. "Keep it as-is" covers the chart, not those two marks, unless he says otherwise.

**Engine files:**
- `apps/renderer/src/engine/devices/unit_field/` (schema, state, index).
- `devices/kinetic_stat` (a bound counter).
- `config/ve/recipes/data-story.json`.
- `.agents/skills/motion-designer/SKILL.md` (the default).

---

## 1. Type pairing (frame `01`)

These are four faces the brand already licenses: OFL, shipped in `apps/renderer/src/house/fonts.css`, brand book v1.4 p. 08. No new face. F212 bans Instrument Serif, so the serif accent is Fraunces.

| Role | Face, settings | Sizes (9:16) | Rule |
|---|---|---|---|
| Display | Anton 400, caps, +0.005 em, leading 0.88 (0.92–0.94 when lines stack) | hero 230–312, headline 108–150, card 76–96 | the largest thing; ink on colour |
| Editorial serif accent | **Fraunces italic**, weight 420–560, `opsz 144, SOFT 60, WONK 0`, −0.01 em | 52–176 | **one per frame**: the connector, the human word ("decide.", "or", "by one careful read") |
| Condensed caps eyebrow | **Archivo, `font-stretch: 62%`** (the variable width axis already in fonts.css), weight 720, caps, +0.14 em | 26–42 | a quiet label carrying a date, source or count (additive, F5); series colour on ink |
| Data | IBM Plex Mono 500 (600 on tape), +0.06 em | 20–34 | sources, dates and tables with 2 px hairlines at cream 18% (Glory Birdie) |
| Captions (unchanged) | Archivo 900, wdth 112, 68 px | — | decoupled from motion (F20/F31) |

**Engine files:**
- `apps/renderer/src/house/geometry.ts` (`HOUSE_FONTS` gains `eyebrow` and `accent` roles; `HOUSE` sizes).
- `apps/renderer/src/engine/kit/typeRole.ts`.
- `config/ve/brand-tokens.json` (`type_roles`).
- `scripts/pages/skins/*` for stills.

## 2. Card animations and the horizontal slide system (frames `03a`–`03d`)

**The system** (it applies to every recipe except the protected deep-dive grammar in section C):

- **Direction.**
  - Forward is right to left.
  - A return is left to right.
  - Stacked strips alternate.
  - Never vertical for photos.
- **Exit.** The outgoing card leads: it starts 6 f before the handover (the existing `LEAD_BEFORE`). It travels to −35% over 8 f on the exit curve and dims to 0.15 brightness, never a fade.
- **Enter.** The incoming card travels from +100% of its region over 14 f on the hero curve. Siblings are 3 f apart. The incoming and outgoing overlap by the outgoing's last 2 f (`LEAD_AFTER`).
- **Blur.** By speed, at most 18 px.
- **Settle details.** The checkmark draws on 12 f after its row lands (8 f, utility). The eyebrow arrives 2 f after the handover, 40 px, utility.
- **Cards.** Cream, 20 px radius, Anton 88, mono index "01". The eyebrow is "WHAT HE CHECKED" with "3 PILES · 1 EVENING".

**Fixes on the way.**
- The settled rows fill the panel. The before had three small rows and dead space (F51).
- The muddy purple corner glow becomes a soft ink radial.

**Engine files:**
- `apps/renderer/src/engine/kit/ingredients.ts` (`push` and `whip` on the lead; a `slide` transition kind with the hero entrance).
- `kit/beatMotion.ts` (the stagger).
- `config/ve/motion-profiles.json`.
- `kit/reveal.ts`.

## 3. Photography (frames `04a`–`04c`, `06`)

**How a photo enters and leaves a panel.**
- It enters by sliding from the side (hero curve, 16 f) inside its own mask.
- The image moves at 0.4x the mask's travel the other way (parallax). That gives the leebess "cinematic" feel without a camera move.
- Stacked letterbox strips (2.39:1) alternate right and left, 4 f apart, 14 px gaps.
- It exits by the slide system's exit.
- A provenance line in mono sits at the panel's head (here "NÄL HOSPITAL, SWEDEN · PHOTO CC0 · WIKIMEDIA COMMONS").

**Fixes.** Today `photo_plate` reveals with a top-down `inset` wipe, and Wed 18 shrank real images onto blur (`grammar.evidence_size`). Strips fill the panel's width.

**The duotone cut-out** (GETOUT; `06` is a face-led cover experiment):
- The subject is cut out by the matte. Its luminance maps through plum_deep `#2A0C24` → ember_deep `#B8321C` 45% → `#FF8A5C` 80% → `#FFE3D1`, after a small contrast lift.
- It is set on the day colour (flat coral on a Friday), with ink type and the wordmark in an ink label box.
- Off days: ink_deep → `#1F5C46` → mint → `#E9FFF5` (made, `work/k23-duo-mint.png`).
- For evidence photos the existing `still-duotone` (ink_deep → cream) stays the default. The ember duotone is for a person or object cut out of a story's photo, never for his face in a cut (`subject-lift` owns that).

**Engine files:**
- `apps/renderer/src/engine/devices/photo_plate/` (`reveal: slide`, parallax, `strips` mode).
- `config/ve/treatments.json` (a new `still-duotone-ember` recipe with these stops; `duotone` gains `mid` stops).
- `treatments/SubjectLift.tsx` (the matte), card `ve-treat-2-still-treatments`.

## 4. Wires connecting evidence (frames `05a`, `05b`)

- **Stroke.** 4 px, round caps.
  - Cream at 75% for a link.
  - **Mint only for the link that proves the answer** (`role_rules.answer`).
  - Never the series colour.
- **Curve.** A cubic S from `kit/threadPath.ts` `weave()` with **wobble 0** (clean, Weave-style).
  - Handles follow the flow: horizontal 0.42/0.32 of dx between side ports; vertical-out, horizontal-in for a bottom port.
- **Ports.** A 9 px ink dot with a 4 px ring, on the mid-edge of each card.
- **Timing.**
  - Each card slides in (hero, 14 f).
  - Its outgoing wire draws on 0 f after the target lands (stroke-dashoffset, 10 f, utility).
  - Once the answer wire is drawn, one 7 px mint pulse with a 22 px glow travels it once (18 f) and rests.
- **Limits.** At most 3 wires on screen. Evidence keeps its words at 40 px or more (`grammar.evidence_size`).

**Engine files:**
- `apps/renderer/src/engine/kit/threadPath.ts` (`weave` with wobble 0; port helpers).
- `devices/through_line` (verb `connect` exists; it gains the draw-on and pulse).
- Or a new `kit/wire.ts` used by `evidence_card` and `record_card`.

## 5. Big moments (frames `07a`–`07c`, `08a`, `08b`, `12`)

- **A full-frame moment.**
  - A giant number or word in plum Anton (230–312 px; it fits 86% of the width, inside the core box) on the moment gradient.
  - An eyebrow above in plum.
  - One Fraunces italic accent line in cream.
  - The mono source.
  - **At most 2 s, at most once a cut, no captions while it holds.**
  - Motion: the ground wipes in from the right with a feathered edge (8 f, utility). The number settles from 1.06 to 1.0 (10 f, hero) from f 3. The accent fades in from f 8. It leaves by wiping left (6 f, exit).
- **Behind him, through the matte (anchor).** The ground replaces his wall. The number sits behind his head, which overlaps at most its lower 20%. Nothing covers his face.
- **16:9.** In the stage panel.

**Grammar conflict.** The shot grammar puts `number` **in the panel** on band and stage, and "behind him on anchor waits on a matte device that is not built". A full-frame moment on a band or stage cut needs a grammar amendment: a `moment` shot type, full frame, ≤ 2 s, at most 1 a cut, handing back to the staging only. Until then, use the in-panel version (`12` shows it).

**Engine files:**
- `config/ve/shot-grammar.json` and `scripts/velib/grammar.py` (a `moment` shot).
- `devices/kinetic_stat` and `slam_word` (a gradient ground).
- `treatments/SubjectLift.tsx` (the matte).
- `config/ve/brand-tokens.json` (the gradient).

## 6. Covers and thumbnails (frames `09`, `10`, `11`, `06`)

- **Face-led** (his accounts; cover-art rule 5 forbids glow, neon and gradients). Near-black, grain 0.07, a measured grid with 96 px margins (F89).
  1. The eyebrow series label (Archivo wdth 62, 30 px, series colour, under 4% of height).
  2. The Anton headline (146 px, leading 0.93, the number in the series colour).
  3. The masthead left-aligned under it.
  4. The real proof as a crisp card at −3°, sized to read.
  5. His cut-out bottom right: face about 0.28 of the width, shoulders off the bottom edge, nothing over his face.
- **Receipt** (brand accounts). The proof leads beside the headline, with a mono date and hairline rows. The masthead is centred at the foot inside the cover grid.
- **Wide thumbnail** (1280 × 720). No logo (palette `thumbnail_wide`). Headline left in three lines with no orphan (F194); the proof right, at +3°, fully in frame (F185).
- **Duotone face-led on the day colour** (`06`): a **third face-led variant** (GETOUT). It needs his yes. It sits within rule 5 (flat colour, no gradient), and the wordmark sits in an ink label box.

**Engine files:**
- `scripts/pages/build.py` and `scripts/pages/skins/*` (the type roles, eyebrow, grid, still-grain).
- `.agents/skills/cover-art/SKILL.md` (a third variant, if approved).
- `docs/production/COVER-STANDARD.md`.

---

## 11. Conflicts and what needs Krish's words

1. **The tall close as the sting** (19 Nov) is not yet in `config/brand-palette.json`. The guard's `retired.match` ("sting-9x16") would refuse it. The palette changes only in his words.
2. **New colour tokens** (ember, ember_deep, plum, plum_deep, peach). They are outside the approved kit (floor F12/F77: "ink, cream, mint, channel colours, Anton, the brutal shadow, stickers"). Off days are mint-only.
3. **The floor against the palette on thumbnails.** F34 says "always include the wordmark on every cover and thumbnail"; the palette says `thumbnail_wide: logo none`. The mock follows the palette (JSON wins). Reconciliation needed.
4. **Cover mark.** cover-art says the wordmark (`f896cc62…`); the palette says the masthead in the cover grid. The mock uses the masthead.
5. **Full-frame big moment** needs a `moment` shot in the grammar (section 5).
6. **The unit chart's pill and wordmark** are barred in a short's body since 16 Nov (section D).
7. **Off-day sting:** none exists (section B).
8. **The title by 30 s** is not linted today (section A).

## 12. What was verified, what is inferred

**Verified (deterministic):**
- Every frame rendered in Chromium from the brand's own font files (`node_modules/@fontsource*`) and the official marks: icon `4a451523…`, masthead `5a0e8a08…`, wordmark drawing `46330374…`, all matching the palette's hashes.
- Motion phases were computed from the house curves at 30 fps.
- All six sting hashes (16:9 and 9:16) match `config/intro-sting.json`.
- The Character.ai cut's sha is `39f1039c…`.
- The band and the core-box coordinates were measured from pixels.
- The photos are CC0 (Wikimedia Commons, NÄL hospital corridor).

**Inferred:**
- How any of this looks at speed; stills are not motion. Each change needs a `ve lab render` on his take, `ve pace`, and a look at full size.
- The cut-outs are a mediapipe still matte, not the subject-lift matte.
- The bill card is a drawn stand-in for the real document.
- The copy and figures are the 20 Nov reference spec's, not re-checked.

## Frame index

All under `/tmp/claude-0/-home-user/63cf1651-3ee8-5d67-9673-d5fc61485f70/scratchpad/polish/frames/`:

- **Title:**
  - `T-before-tall-current-title`
  - `T-A1-tall-build-w3` … `T-A7-tall-leaves-1.9s`
  - `T-A8-wide-build-w8`, `T-A9-wide-build-w13`, `T-A10-wide-full-1s`
  - `T-B1-tall-build-w13`, `T-B2-tall-full-1s`, `T-B3-wide-full-1s`
  - `T-C1-tall-build-w8`, `T-C2-tall-full-1s`
- **Outro:**
  - `O-before-tall-current-close`, `O-before-wide-current-close`
  - `O-A1-tall-sting-1.5x-f6` … `O-A5-tall-settled-2.0s`
  - `O-A6-wide-sting`, `O-A7-wide-ink-slides-in`, `O-A8-wide-settled-2.75s`
  - `O-B1/B2-tall`, `O-B3-wide-settled`
  - `O-C1/C2-tall`, `O-C3-wide-settled`
- **Deep dive:**
  - originals `PD-0a/0b/0c`
  - polished `PD-1a/1b`, `PD-2a/2b`, `PD-3a/3b`
- **Unit chart:** `UC-0-original-mon02`, `UC-1`…`UC-3` (tall), `UC-4-wide-greys-to-9`
- **Six areas:**
  - `01-type-system`
  - `02a`–`02d` (title, the first pass)
  - `03a`–`03d` (cards)
  - `04a`–`04c` (photos)
  - `05a`, `05b` (wires)
  - `06-duotone-cutout-cover`
  - `07a`–`07c`, `08a`, `08b`, `12-moment-wide` (big moment)
  - `09-cover-face-led`, `10-cover-receipt`, `11-thumbnail-wide`
