# The style lab

Each library style drawn frame by frame in code, outside the frozen ve renderer, so a style can be proved on Krish's
own take before it is moved into the engine (Krish, 10 Nov 2026: "Separate style lab"). The catalogue design is
`docs/plans/2026-11-10-video-style-system/STYLE-CATALOGUE.md`; every style wears the brand skin (its section 2a).

| Path | What it is |
|---|---|
| `_core/timeline.py` | Aligns the house test script to the take's word times (any aligner's words.json) |
| `_core/brand.mjs` | The brand skin, read from `config/studio.json`, `config/ve/brand-tokens.json` and `config/channel-safe-zones.json`; the wordmark and mark from Control Center's brand folder, checked by sha256 |
| `_core/house.mjs` | The house layer: easing, type (recorded for the checks), the house caption build, the dress (wide only: no wordmark on vertical video, Krish 2026-11-11), grain |
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
