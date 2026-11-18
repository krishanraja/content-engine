# Source: EffectCraft (read 18 Nov 2026)

Why we read it: Krish sent https://github.com/storytold/effectcraft on 18 Nov 2026: "How should we strengthen the
engine like this? I don't want 300 different choices in the UI so figure out how. We can use this to empower the
entire engine." What ve took from it is the treatment bank ([`docs/ve/TREATMENTS.md`](../TREATMENTS.md)).

**The original.** https://github.com/storytold/effectcraft, commit `67942cda7b0821eb83234f78196df6c43ceb0abd`
(18 Nov 2026). It was read in a scratch clone and nothing was run from it. No copy lives in this repository.

**What it is.** An open-source After Effects-style motion graphics and compositing app in Rust (egui interface, wgpu
compositor, a WebAssembly build). Alpha by its own README. 308 built-in effects with 2,992 parameters in 17 groups,
each "our own implementation, written from public behaviour descriptions" with After Effects' parameter names, order
and defaults (`docs/effects.md`, generated from `crates/effects/src/catalog.rs`). Agents drive it through
`effectcraft-cli` (JSON), a control channel and an MCP server that reads back rendered frames (`docs/mcp.md`).

**Licence.** MIT OR Apache-2.0, at the user's choice; bundled third-party assets keep their own (its
`ATTRIBUTION.md`). The ArtCraft name and logos are trademarks and are never used here.

**Why it is not ve's renderer.** ve renders with Remotion and ffmpeg, and every gate, receipt and test is built on that
path. A second renderer in alpha would add a new way to fail. ve takes its effect behaviour and numbers, rebuilt as its
own code; a file that copies EffectCraft code keeps a header comment `source: "effectcraft@67942cd"` and the file it
came from.

## What ve takes

1. **The effect catalogue as reference.** The primitives in `config/ve/treatments.json` name the EffectCraft effect
   they rebuild (`effectcraft`, an `ec.<group>.<name>` id). Its parameters, as read at the commit above, are below.
2. **Subject cut-out.** EffectCraft's Roto Brush can track a subject with SAM 2.1 Tiny (Hiera-Tiny, 39M parameters,
   Apache-2.0, a 155.9 MB `model.safetensors` checked by size and SHA-256), then refine each frame's edge with a graph
   cut (`docs/roto-brush-sam2.md`, `crates/sam2`, `crates/segment`). ve's subject lift makes the same kind of matte
   offline, once per take (card `ve-treat-1-subject-lift`); adding SAM 2 itself is a new dependency and waits for
   Krish's yes.
3. **The agent pattern.** Agents edit through MCP and see the rendered frame. ve's critic already reads frame strips
   (`ve refs`); treated beats are judged the same way, on the finished picture.

## Parameters read (name, default, range)

| Effect (id) | Parameters |
|---|---|
| Glow (`ec.stylize.glow`) | Glow Based On (Color Channels); Glow Threshold 60 (0 to 100); Glow Radius 10 (0 to 1000; blur sigma 0.384 x radius, fitted to After Effects); Glow Intensity 1.0 (0 to 255); Composite Original (On Top); Glow Colors (Original, A & B, Arbitrary Map); Color A white, Color B black |
| Tritone (`ec.color.tritone`) | Highlights (1,1,1); Midtones (0.5,0.4,0.3); Shadows (0,0,0); Blend With Original 0 (0 to 100) |
| Light Sweep (`ec.generate.cclightsweep`) | Center (0.5,0.5); Direction -30 degrees; Shape Smooth (Linear, Smooth, Sharp); Width 50; Sweep Intensity 50; Edge Intensity 100; Edge Thickness 1; Light Color white; Light Reception Add (Add, Composite, Cutout) |
| Vignette (`ec.stylize.ccvignette`) | Amount 50 (-100 to 100); Angle of View 60; Center (0.5,0.5); Pin Highlights 0 |
| Exposure (`ec.color.exposure`) | Exposure 0 stops (-4 to 4 in the slider); Offset 0; Gamma Correction 1.0 |
| Gaussian Blur (`ec.blur.gaussian`) | Blurriness 0 (slider 0 to 50); Blur Dimensions (both); Repeat Edge Pixels off |
| Matte Choker (`ec.matte.mattechoker`) | Geometric Softness 1 = 4; Choke 1 = 75; Gray Level Softness 1 = 10; Geometric Softness 2 = 0; Choke 2 = 0; Gray Level Softness 2 = 100; Iterations 1 |
| Add Grain (`ec.noise.addgrain`) | Intensity 1.0 (0 to 10 in the slider); Red, Green, Blue Intensity 1.0; Size 1.0 (0.1 to 10); Softness 0; Aspect Ratio 1.0; Monochromatic off; Saturation 1.0 |
| Shift Channels (`ec.channel.shiftchannels`) | Take Alpha, Red, Green, Blue From (each a channel). It remaps channels and moves nothing: ve's channel-split offsets the red and cyan copies itself, and names Shift Channels only for the channel separation |

The parameters ve uses are its own (`config/ve/treatments.json`, `recipe[].params`), in its own units (pixels, stops,
frames), never EffectCraft's slider units.
