# What an 11/10 style catalogue looks like

10 Nov 2026. A design for Krish to rule on, written after he rejected the first catalogue: "its not really a style
catalogue is it? Its just a summary of the misfit hodgepodge in there. passports is hardly something for a style
catalogue." Built from reading the eleven references he named (sources at the end).

## 1. Why the first one failed

It put four different things in one list:

| What it listed | What it actually is | Where it belongs |
|---|---|---|
| head-to-head, follow-the-receipt | a **story shape** (what the script does) | Formats |
| face-with-proof, voice-led-pictures | a **production treatment** (is his face on screen?) | a setting inside a style |
| two-passports | **one piece's visual idea** (a device made for one story) | Moves |
| data-story, living-ui | a **look** | Styles |

A style catalogue holds only the last kind. Lemo-Opuscar draws the line in each style's first section: "the story is
yours". The style is how the film looks, moves and sounds, whatever the story.

## 2. The model: three libraries, picked separately

Every strong reference separates the same three things.
- Video Talkcraft keeps its 108 motion recipe cards as "neutral UI". Each one is re-skinned to a style profile per
  film, without touching its "motion vitals".
- Lemo keeps 66 styles apart from whatever story you bring.

```
  Format (story shape)  ×  Style (the look and sound)  ×  Moves (one per beat)
  head-to-head             The Evidence Desk               freeze-circle-magnify
  follow-the-receipt       The Lit Essay                   count-on-a-part
  the five playbook        The Living Screen               sources-meet-at-one-moment
  formats                  ...                             ...
```

A piece is **one format, one style, and a move chosen per beat from those the style allows.** Krish picks the format
and the style before the script; the script is then written knowing which moves exist.

### Styles: what one entry holds (Lemo's standard, our additions marked +)

Each style is a folder, `styles/<id>/`, not a row in a JSON file:

1. **Essence, and what it is not.** Three to five rules, plus the nearest styles it must never become.
2. **Materials and rendering.** What the picture is made of, and the grade, grain and treatment of real footage and
   screenshots.
3. **Colour logic.** Exact hex tokens, and one accent with one job ("red only ever points").
4. **Type and captions.** Faces, sizes, words per frame, reading time per line (checked by code), caption position.
5. **Motion quality.** fps, easings, what may move and what never does, and how often something changes.
6. **Shot and layout grammar.** + Both canvases (9:16 and 16:9) with platform safe zones, and where **his face** sits
   in each: full frame, corner window or absent.
7. **Sound palette.** Bed, foley, the one big-moment sound, ducking under his voice, LUFS target.
8. **Native moves.** The four to eight signature moves, each with the code that makes it.
9. + **Fit.** Which series, formats and lengths it suits, and which it does not.
10. + **Make it mine.** What is safe to change (palette, type, pace), what changes its character (materials, camera
    grammar) and what cannot change.
11. + **Proof.** A style frame, a poster and **a demo film of the house test script** (section 4).
12. + **His verdict and scores**, joined to the retro so the catalogue learns which styles perform.

### Moves: the device library, made re-skinnable

- Our 27 devices and 18 motion modules become **moves**. Each is indexed by:
  - what it says: number, contrast, list, quote, evidence, process, timeline, before and after;
  - what it needs: text, a number, a screenshot, footage, his face;
  - its energy.
- Each move keeps fixed timing (its vitals) and takes its look from the style.
- A style names the moves it allows. Two passports becomes a move (`passport-page`) that a style may allow, not a
  style.

### Formats: unchanged

They stay in `config/style-references.json` formats.script, with the playbook's five formats added as tags.

## 3. The engines behind the styles

Each style names the engine that draws it. This is where the references earn their place:

| Engine | From the references | What it makes possible |
|---|---|---|
| Remotion (our renderer today) | Video Shotcraft, Talkcraft | Type, UI, data and layout styles; word-level voice sync |
| three.js + React Three Fiber, Rapier physics, React Postprocessing | three.js, pmndrs | Real 3D: data you can stack, drop and weigh (Data Physicalisation), exploded product teardowns, lit objects, depth of field and bloom done properly instead of faked |
| Blender via MCP | mcp-for-blender | Hero objects and plates modelled and lit once, then reused as stills or turntables in a style |
| p5.js + p5.brush | Claude Animation Base | Hand-painted styles, and his 65-pose character acting (the Animation Base pattern: a model sheet with emotions, storyboard first, contact sheets to check) |
| pixelfx | pixelfx | Small effect sprites (impact, spark, confetti, glitch wipe) for styles that want them, from 244 MIT-licensed effects |
| librosa | librosa | Beat, onset and tempo from the music, and energy from his voice, so cuts and moves land on the beat and the music drops under his words |

Every engine follows one rule, from both prompt packs: **each frame is a function of time alone**. That means no
timers and no state carried between frames, so renders are repeatable and can run in parallel.

## 4. How Krish sees and picks

- **The house test script.** A 45-second script in his voice, recorded once. Every style renders it, so he compares
  looks, never stories.
  - This is Lemo's OPUSCAR 98 trick: "one Clawd walks through all 98" styles in a single film.
  - The result is one reel on the board. He watches it in one sitting and rates each style: liked, trial, or not for
    us.
- **The pick.** On the Control Center Look step, before the script, he sees the styles that fit the piece's series and
  format. Each shows its demo film playing and its fit line, and he picks one.
  - The pick writes `meta.look.style_id`.
  - The script writer then reads that style's spec, so the hook, beat count and on-screen words are written for the
    moves that exist.
- **Make it mine.** This is Lemo's flow, which fits his "one question at a time" ruling:
  1. Change a library style, or start from a picture he likes in Inspiration House.
  2. Answer one question at a time.
  3. See a style frame next to the original.
  4. Watch a 15 to 30 second demo.
  5. Keep it.

## 5. A first shelf for a business-AI publication

Twelve looks to build. The first three are ones he has already shown he likes.

| Style | Essence | Engine | Fits | His evidence |
|---|---|---|---|---|
| **The Ladder** (data physicalisation) | One object carries every number; numbers grow, drop and stack on its parts | Remotion, or 3D with Rapier | follow.the.money | Mon 2 Nov, production 8: "one of the strongest in terms of the animation style" |
| **The Lit Essay** | A carefully lit close talking head, kinetic serif captions, hand-painted cutaways | footage + Remotion + p5.brush | mind.the.gap | Hannah Fry card: "the lighting and talking-head nature ... the subtitle effects are really nice" |
| **The Living Screen** | The real product rebuilt so the interface performs on cue, with the camera locked to the cursor | Remotion | under.the.hood | voice-led card: "the visuals support most of the absorption of information" |
| The Evidence Desk | Sources on one clock; red only points; freeze, circle, magnify | Remotion | follow.the.money, Changed this week | |
| Exploded Teardown | A system or product opened in 3D, part by part | three.js / Blender | under.the.hood, Insider access | |
| Swiss Kinetic Type | Type is the picture, on a strict grid | Remotion | Resource drop, shorts | |
| Dark Keynote | Near-black stage, one giant number, a slow light sweep | Remotion | Changed this week | |
| Pictogram Motion | Isotype figures: each figure stands for a fixed count of people | Remotion | It's about you | |
| Briefing Board | An engineering blueprint board with annotated schematics | Remotion | under.the.hood | |
| Halftone Dossier | A print-texture case file with stamps and collage | Remotion | mind.the.gap, off days | |
| Broadcast Package | A news open, lower thirds and a ticker | Remotion | Changed this week | |
| Character Theatre | His drawn character acts the scene | p5.brush | Absurd real scene | his character, approved 9 Nov |

## 6. Rights

| Repository | Licence | What we may do |
|---|---|---|
| Lemo-Opuscar, pixelfx, Claude Animation Base, mcp-for-blender, three.js, the two prompt packs | MIT | Adapt with credit |
| Video Shotcraft | Apache-2.0 | Adapt with credit and its notice |
| Video Talkcraft | PolyForm **Noncommercial** | Study its method only; copy no code or cards, since this publication is commercial |
| librosa | ISC | Use as a library |

Lemo's own rule applies to every style: references are grammar only, never their names, branding or footage.

## 7. Build order (each step waits on his yes)

1. **Three styles to the full standard.** Write The Ladder, The Lit Essay and The Living Screen as complete style
   folders, and render each on the house test script. He records the script once (45 seconds). Cost: compute only,
   no generated video.
2. **Moves.** Turn the 27 devices and 18 motion modules into indexed, re-skinnable moves.
3. **The pick.** Style pick on the Look step, before the script (the paired engine and Control Center change from
   PLAN.md step 2).
4. **Shelf to twelve,** then Make it mine.

The 9-entry `config/video-styles.json` from earlier today is withdrawn from the pull request. It was formats and
treatments, not styles.

## Sources read (10 Nov 2026)

- lemomo-ai/lemo-opuscar: README, the style index, `styles/visual-investigation/STYLE.md` and `style.json`.
- Vincentwei1021/video-talkcraft: README, `references/taxonomy.md`, `design-language.md` and `cards-index.json`
  (108 cards).
- Vincentwei1021/video-shotcraft: the repository layout and its 124 shot recipe cards (README).
- patch-gg/pixelfx: README (244 effects).
- JohnHeibel/ClaudeAnimationBase: README.
- yihui-dev/awesome-opus5-5-videos and joeseesun/opus-video-prompts: categories, technical routes and the
  prompt-writing lessons.
- ahujasid/mcp-for-blender.
- Read from what they are, not cloned: mrdoob/three.js, pmndrs/react-three-rapier, pmndrs/react-postprocessing,
  librosa/librosa.
