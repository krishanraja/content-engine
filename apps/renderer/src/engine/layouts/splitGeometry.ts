/** The SPLIT layout's geometry, as the renderer and QC both read it: one seam between the graphics stage above and
 *  his camera plate below, the caption zone astride it, and the plate's default crop.
 *
 *  QC reads these `export const` lines by name (scripts/velib/qc.py, qc_composition.py, qc_faces.py), so each stays on
 *  one line. A new seam or zone is a design change Krish signs at Gate 2 (config/ve/design-lock.json, the
 *  face-with-proof draft); nothing else moves them. No mock or sample picture lives here. */
export const SPLIT_SEAM_Y = 760
/** The scale QC applies to a placed SPLIT object's box, about the stage's top centre, when it measures where the stage draws it. */
export const SPLIT_STAGE_SCALE = 0.76
/** On a SPLIT beat his face is in the lower half, so the caption sits on the seam (MOTION_STANDARD, Captions), inside
 *  every channel's safe column: x 60 to 860, never under Instagram's handle from y 1320 (Krish, 2026-11-11). */
export const SPLIT_CAPTION_ZONE = { left: 60, top: 670, width: 800, height: 180 } as const // centred on SPLIT_SEAM_Y
/** The camera plate's crop per beat on a SPLIT frame; override after camera-plate review. */
export const SPLIT_POSTER_POSITIONS = { hook: '50% 88%', face: '50% 0%', proof: '50% 88%', close: '50% 88%' } as const
