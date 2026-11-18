/** The SPLIT layout's geometry, as the renderer and QC both read it: one seam between the graphics stage above and
 *  his camera plate below, the caption zone astride it, and the plate's default crop.
 *
 *  QC reads these `export const` lines by name (scripts/velib/qc.py, qc_composition.py, qc_faces.py), so each stays on
 *  one line. A new seam or zone is a design change Krish signs at Gate 2 (config/ve/design-lock.json, the
 *  face-with-proof draft); nothing else moves them. No mock or sample picture lives here. */
export const SPLIT_SEAM_Y = 760
/** The graphics stage above the seam is a 16:9 box, so a 16:9 proof visual (a chart, a screenshot, a page) is drawn whole,
 *  never cropped or squeezed into a strip (Krish, 2026-11-18: "Can't cut my head off and also ruin the visual above").
 *  It starts at the brand's safe top (y 288, config/ve/brand-tokens.json tall_safe_key_text), is centred in the platform
 *  safe column (x 60 to 860, so 76 to 844), and ends at y 720, clear of the caption that sits on the seam and of his head. */
export const SPLIT_STAGE_LEFT = 76
export const SPLIT_STAGE_TOP = 288
export const SPLIT_STAGE_WIDTH = 768
export const SPLIT_STAGE_HEIGHT = 432
/** The scale QC applies to a placed SPLIT object's box, about the stage's top centre, when it measures where the stage draws it. */
export const SPLIT_STAGE_SCALE = 0.76
/** On a SPLIT beat his face is in the lower half, so the caption sits on the seam (MOTION_STANDARD, Captions), inside
 *  every channel's safe column: x 60 to 860, never under Instagram's handle from y 1320 (Krish, 2026-11-11). */
export const SPLIT_CAPTION_ZONE = { left: 60, top: 670, width: 800, height: 180 } as const // centred on SPLIT_SEAM_Y
/** The camera plate's crop on a SPLIT frame when a beat names none. His takes are 1080 x 1920 and the camera box is 1160
 *  high, so the vertical position decides which 1160 rows of the take show. 88% (the old value, set on one earlier take)
 *  hides the top 669 rows, which is his forehead on the Wed 18 take. 16% keeps crown and chin in the box on both
 *  portrait takes measured on 18 Nov 2026 (Wed 18 Build-or-buy, AI music: every sample, crown to chin). It is a default,
 *  not a rule: plate.head_in_band measures the finished cut and names the position that fits, and a beat's own
 *  `plate.crop` overrides it. */
export const SPLIT_POSTER_POSITIONS = { hook: '50% 16%', face: '50% 16%', proof: '50% 16%', close: '50% 16%' } as const
