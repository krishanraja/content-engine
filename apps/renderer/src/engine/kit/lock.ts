/** Copied from config/ve/design-lock.json; kit.test.ts prevents drift. */
export const CANVAS = { w: 1080, h: 1920, fps: 30 } as const
export const SCRIBBLE = {
  shapes: ['loop', 'underline', 'arrow', 'bracket', 'tick', 'cross'],
  stroke_px: 8, keyline_px: 16, colours: ['cream', 'mint'],
  draw_on_frames: 10, path_length: 1, per_beat: 1,
} as const
export const ZONES = {
  header: { x: 72, y: 79, w: 888, h: 56 },
  headline: { x: 72, y: 150, w: 888, h: 270 },
  caption: { x: 72, y: 1180, w: 900, h: 320 },
  key_band_bottom_y: 1170,
  lower_line: { x: 72, y: 1516, w: 936, h: 104 },
  marquee: { x: 0, y: 1736, w: 1080, h: 62 },
  platform: { right_x: 960, bottom_y: 1640 },
} as const
