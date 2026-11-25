# Library hardening: one alignment system, and every edge case

Edit library.html, library.json, render.py and NOTES.md in this folder only. Do not commit. Do not launch Chromium.

Krish approved the Library with one condition: "except for this which does not look good in terms of alignment - we need to think about all the edge cases and repeatable usability". These templates will be filled by the engine with real content every week, so each one must hold up with any real content, not just the example.

## 1. One alignment system, shared by every template
- Define, in library.json `grid`, per canvas size: outer margins, column count, gutter, baseline unit (8 px at 1080 wide, scaled for other sizes) and the safe-zone boxes. Every template positions its elements on that grid through one shared helper.
- Shared edges:
  - Every element in a template that is meant to align (headline, V4, DM Mono label, source line, evidence card, colour-block text) shares one left edge.
  - Vertical spacing is in baseline units.
  - Headline-to-V4 clear space is one shared constant.
- Add a `?grid=1` overlay to `?item=` and to the family sheets, drawing the columns, baseline and safe zones, so the host can check alignment by eye.

## 2. Slot rules for every text and image slot (in library.json, per template)
For each slot record:
- `max_chars`;
- `max_lines`;
- `min_size_px` and `max_size_px`;
- `fit`: shrink in fixed steps, never below min, then reflow, then refuse;
- `refuse_when`: for example, a headline that would need a 4th line, or a word wider than the column at min size.

The helper applies these rules, so a long headline steps down in size and never overflows, clips or collides with V4. A short one stays at max size and keeps its bottom anchor.

## 3. Stress states (render each one)
Add a `?stress=<case>` parameter that fills every template with these cases:
- `short`: a 2-word headline, a 1-line Fraunces line;
- `long`: a headline at max_chars over max_lines; a Fraunces line at its max; a long source line;
- `word`: one very long single word in the headline (for example "Disintermediation"). It must fit at min size or be refused with a visible red "REFUSED: <rule>" stamp on the stress sheet only;
- `nophoto`: no photo available. The fallback is a flat rung-colour block or plain grained ink with the layout intact, never a broken image or empty hole;
- `brightphoto`: a bright photo (use still-record-phone). The burn must still give at least 4.5:1 under the type;
- `doc-long`: an evidence document whose key line wraps to 3 lines;
- `numbers`: a number card with a 6-character figure (for example "£1.2bn").

## 4. Stress sheets
render.py renders, for each family, .scratch/library/out/stress/<family>-<case>.png: every template in that family at preview scale, filled with that case, with `?grid=1` on. Keep the no-overflow assert and a 180000 ms timeout. Render item PNGs only for the default case, as now.

## 5. Fix what the stress cases expose
Where a template breaks under a case (collision, overflow, misalignment, hole), fix the template, not the case. List every template that needed a fix and what changed.

## 6. Report
Report:
- the grid values;
- the slot rules added;
- the templates fixed;
- any case a template refuses by design.
