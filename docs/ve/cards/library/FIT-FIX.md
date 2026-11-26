# Fit fix: measure real text in the browser, not estimates

Edit library.html, library.json and NOTES.md in this folder only. Do not commit. Do not launch a browser. Do not change render.py: the host edited it to collect every fit failure into .scratch/library/out/fit-failures.json instead of stopping at the first. Keep that behaviour.

## What the host render found
The real Chromium render measured every `text[data-bounds]` against its slot box. It uses getBBox for the horizontal extent and canvas measureText's actualBoundingBoxAscent and actualBoundingBoxDescent at the text's baseline. 60 sheets or items fail:
- **5 default items:**
  - video-wide-close body_1;
  - video-wide-rail label_3;
  - web-desktop body_1;
  - web-mobile headline_1;
  - future-deck-close body_1.
- **55 stress sheets:** see .scratch/library/out/fit-failures.json.

The failures span label_1, headline_n, body_n and source_n across every family, under every stress case, including `short`. So the cause is systemic: the fit helper sizes and wraps text from estimated glyph widths, and Anton, Fraunces and DM Mono at real metrics are wider or taller than the estimate.

## Fix
1. **Measure at render time.** Make the shared text-fit helper measure real rendered text in the page:
   - wait for document.fonts.ready;
   - use canvas measureText with the exact font shorthand (style, weight, size, family, plus the Fraunces variation settings where the canvas allows; otherwise measure an SVG text node with getComputedTextLength or getBBox).
   - Wrap words greedily against the slot width, using measured widths.
   - Step the size down in the slot's fixed steps until the lines fit both max_lines and the slot height. Height runs from the first line's actual ascent to the last line's actual descent at the chosen line height.
   - If the text still does not fit at min size, apply refuse_when: the red stamp on stress sheets, refused on export.
2. **Labels and sources are DM Mono uppercase with tracking.** Include letter-spacing in the measured width (add tracking × (characters − 1)).
3. **Bounds include descenders.** Set each slot's data-bounds to the slot box the helper used, so the host's check measures against the same box.
4. **Mark failures.** Every text node gets `data-template="<id>"` as well as data-slot, so future fit failures name the template, including on stress sheets.
5. **Run the fit before window.ready resolves.** The screenshot and the bounds check must see the final layout.

## Report
List:
- the helper changes;
- any slot whose rules you changed (with old and new values);
- any template that now refuses a stress case by design.
