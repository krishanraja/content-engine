# Where these logos came from

Each file below is the company's own logo artwork, fetched on 17 October 2026. Nothing was drawn by hand:
the vector paths are the company's, unaltered, and the only change is the colour, every fill set to the
house cream `#F4EFE4` so the logo reads on the ink cards. The earlier files in this folder (Anthropic,
OpenAI, Google, OpenRouter, SemiAnalysis) were added before this note and are not covered by it.

| File | Company | Source | What was changed |
| --- | --- | --- | --- |
| `artificialanalysis-cream.svg` | Artificial Analysis | artificialanalysis.ai, the company's own home page: the 402 x 44 SVG it draws on its charts (its symbol plus the "Artificial Analysis" wordmark, three paths, purple `#7F4BF3` and black `#000`) | Both fills set to cream; the page's inline `style` (position, size) and `opacity="0.75"` dropped. Paths unaltered. |
| `wired-cream.svg` | WIRED (Condé Nast) | Brandfetch, brand `wired.com` (id `idgbXTOL4v`), asset type `logo`, theme `dark`, format SVG: `https://cdn.brandfetch.io/idgbXTOL4v/theme/dark/logo.svg` (the per-request `?c=` token left out here) | The one fill `#000` set to cream, so the boxed letters W, R and D read as cream tiles with the card showing through. Paths unaltered. |
| `the-decoder-cream.svg` | THE DECODER | the-decoder.com, the company's own masthead: the 106 x 31 SVG in `<header id="masthead">` ("the" over "decoder"), seven paths with no fill set (black by default) | A cream `fill` on each path; each path carried two `class` attributes on the page (`switch__letters` and `st0`), which a stand-alone SVG file cannot parse, so both were dropped. Paths unaltered. |

## Why these and not others

- **Artificial Analysis.** Brandfetch (`artificialanalysis.ai`, id `idzjYhdvWK`) serves only a 48 x 48 square
  "A/" mark on a light tile. That is not what the company shows today: its site header and footer use a
  stepped four-block symbol beside the "Artificial Analysis" name. The lockup it draws on its own charts
  has both as vector paths, so that is the file used.
- **WIRED.** Brandfetch's SVG is WIRED's familiar boxed wordmark; it matches the masthead on wired.com.
- **THE DECODER.** Brandfetch (`the-decoder.com`, id `id9lhB6wm4`) has no logo file, only a 400 x 400 JPEG
  icon, so the logo comes from the site's own header.

## Checks

- All three parse as stand-alone SVG (XML) and were drawn on the ink background (`#0C1512`) to confirm the
  artwork is whole: "Artificial Analysis" with its symbol, "WIRED" boxed letters, "the decoder".
- SHA-256 of the files written here:
  - `artificialanalysis-cream.svg` `bdde41ee5880ce157945a0de0c68f8052849dc9807013c889ffb263c2b4069f6`
  - `wired-cream.svg` `afce990df5b5786e2fba6bd5ad11498dcbca7d3e0c3a80e52230d0e29f792325`
  - `the-decoder-cream.svg` `8fb65925e58b22a3cec648441da2f07db84c4bb569978e4870fb97b6efe2cbcb`
- SHA-256 of the originals as fetched (before the colour change):
  - Artificial Analysis lockup `0352fe6d8b3dfa1ed54692641588e85304a5b0f6b4a00a723697fb6a4eb16d96`
  - WIRED (Brandfetch) `d05df37bc8f04d7ee562d6686df3976e15fc345bd05991d13e26fbdd389d6b2f`
  - THE DECODER masthead `f00224dc30d4cafde38e5274edf8f6383bd3b2d7390d8db6a8ae7b2fd55ab240`

- mercedes-cream.svg: the Mercedes-Benz star, Simple Icons 13.21.0 (cdn.jsdelivr.net/npm/simple-icons@13.21.0/icons/mercedes.svg), filled cream. For the 90-second cut, where Krish says "Opus 5.5 is like Mercedes C-Class" (Krish, 19 Oct: "add the real car badges").
- claude-cream.svg: the Claude sun mark from the pinned Simple Icons 13.21.0 package (`https://cdn.jsdelivr.net/npm/simple-icons@13.21.0/icons/claude.svg`), fetched 19 October. Path unchanged, cream fill added. This is the Claude product mark; the older Anthropic A is not used as the Claude mark in the repair samples. The mapping has two separate stages: Mercedes = Claude; C-Class = Opus 5.5.
