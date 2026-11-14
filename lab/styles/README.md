# The style lab

Each library style drawn frame by frame in code, outside the frozen ve renderer, so a style can be proved on Krish's
own take before it is moved into the engine (Krish, 10 Nov 2026: "Separate style lab"). The catalogue design is
`docs/plans/2026-11-10-video-style-system/STYLE-CATALOGUE.md`; every style wears the brand skin (its section 2a).

| Path | What it is |
|---|---|
| `_core/timeline.py` | Aligns the house test script to the take's word times (any aligner's words.json) |
| `_core/brand.mjs` | The brand skin, read from `config/studio.json`, `config/ve/brand-tokens.json` and `config/channel-safe-zones.json`; the wordmark and mark from Control Center's brand folder, checked by sha256 |
| `_core/house.mjs` | The house layer: easing, type (recorded for the checks), the house caption build, the dress (wide only: no wordmark over a tall cut's animated content, Krish 2026-11-11), grain |
| `_core/render.mjs` | Draws a style frame by frame in Chromium (WebGL for 3D), pipes to ffmpeg, synthesises its foley, mixes the voice, and joins the approved house close filmed by `scripts/quick-edit/kit.py` |
| `_core/check.mjs` | Safe zones, 40 px on the tall canvas (F44), no caption repeating on-screen words (F42), reading time, contact sheet |
| `<style>/STYLE.md`, `<style>/scene.mjs` | One style: its prompt in twelve sections and its scene |

Run (Playwright is the container's own, so NODE_PATH points at it; three.js comes from `npm install` here):

```bash
cd lab/styles && npm install && cd ../..
python3 lab/styles/_core/timeline.py --script docs/plans/2026-11-10-video-style-system/house-test-script.txt --words WORDS.json --out TIMELINE.json --duration SECONDS
NODE_PATH=$(npm root -g) node lab/styles/_core/render.mjs --style ladder --shape tall --timeline TIMELINE.json --audio TAKE.wav --out OUT --stills 10.4,24.6
NODE_PATH=$(npm root -g) node lab/styles/_core/render.mjs --style ladder --shape tall --timeline TIMELINE.json --audio TAKE.wav --out OUT --close CLOSE_DIR
node lab/styles/_core/check.mjs OUT/ladder-tall.layout.json --sheet OUT/ladder-tall.mp4
```

Renders and takes never go in git. Style frames first, his word, then the whole cut.

## The styles built here

The catalogue has twelve looks; five are built and render a whole cut, tall and wide, on his take. Each folder's
`STYLE.md` is its prompt in twelve sections; section 12 holds his verdict in his words.

| Style | What carries the numbers | His word | In ve |
|---|---|---|---|
| `ladder`, The Ladder | one lit 3D object (a bank branch) that changes as the numbers change | "much better, go" (10 Nov); liked | bank entry `ladder`, device `ladder_stage` built 11 Nov (card ve-style-1); work in progress: test render rejected 13 Nov (`docs/ve/FAILURE_2026-11-13_3d-styles.md`) |
| `living-screen`, The Living Screen | a working interface in 3D; the camera reads the card being spoken about | "Now let's keep that pace of animation up." (10 Nov); liked | bank entry `living-screen`, device `living_screen` built 12 Nov (card ve-style-2); work in progress: test render rejected 13 Nov (`docs/ve/FAILURE_2026-11-13_3d-styles.md`) |
| `evidence-desk`, The Evidence Desk | the source's own page on a desk, the line circled and magnified | rendered for his verdict (11 Nov) | not in the bank |
| `swiss-kinetic`, Swiss Kinetic Type | type is the picture, on a strict grid, with counting squares | rendered for his verdict (11 Nov) | bank `swiss-kinetic-type` draws it as a motion profile |
| `dark-keynote`, Dark Keynote | one number at a time on a lit stage | rendered for his verdict (11 Nov) | bank `dark-keynote` draws it as a motion profile |

## The tall frame (Krish, 11 Nov 2026)

No wordmark, mark tile or series tag over the content of a tall cut, and no animation over a wordmark; the house
close joined after the cut keeps its wordmark. The type starts just under every channel's top bar (y 270 to 340),
words stay in x 60 to 860 below y 520 and above y 1320, and the picture or 3D may bleed to the frame edges.
`check.mjs` fails a tall cut that draws a wordmark, puts a word in a channel zone, or leaves the top of the screen
empty (the topmost word below y 340 on more than a quarter of frames). Render stills of every style before and after
any change to `_core/` or a scene and look at them side by side, with those three lines drawn.

## From the lab to ve

A style proved here reaches ve in four steps, and nothing else moves it there:

1. **His verdict.** He picks it, in his words, on a cut rendered here. Record it with
   `python3 scripts/post-pack/creative_direction.py verdict --module <id> --verdict picked --said "<his words>" --on <date>`.
2. **The bank entry.** Add it to the motion layer of `config/style-references.json` (a guarded file: his yes in person),
   with `rules` and `avoid` from its `STYLE.md` and `ve_route` naming the device it needs plus `needs_device`, and add it
   to `needs_device` in `apps/renderer/src/engine/kit/motion-profiles.json`. A spec can then name it.
3. **Codex cards.** One card per device, written as fields in `docs/ve/cards/<set>/` with `motion_style: <id>`, pushed to
   main, then queued on the lane (`ve lane queue`) after he approves the Codex spend. The cards reuse `lab/moves`
   (card ve-style-0 makes them one package the renderer imports); they never copy a move.
4. **Verified and switched on.** `ve verify-card`, `ve lab render` and `ve lab diff` (the house look unchanged), a fixture
   render of the house test take in the style for his Gate 2, then `needs_device` comes out of both files.

The Ladder and The Living Screen are at step 3 (11 Nov 2026): card ve-style-0 (3D in the renderer, the moves as one package) is built and verified, and so are both style devices (cards ve-style-1 and ve-style-2). Both test renders were rejected on 13 Nov; both styles stay work in progress (`docs/ve/FAILURE_2026-11-13_3d-styles.md`). Krish approved the Codex spend for both.
