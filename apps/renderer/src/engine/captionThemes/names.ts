/** The caption themes ve can draw (Krish, 2026-11-11: "can you install all of these different caption styles in to the
 *  engine, so future productions can select from them?"), vendored from github.com/vshukla7/remotion-captions-themes
 *  (MIT). A spec picks one with brand.caption_theme; with none, the house caption draws. Keep in step with registry.ts
 *  (captionThemes.test.ts checks) and with the contracts enum in packages/contracts/src/production-spec.ts. */
export const CAPTION_THEMES = [
  'pop', 'karaoke', 'kinetic-01', 'kinetic-02', 'hustle', 'grape', 'beast', 'poppin', 'aarit', 'soft-ai',
  'gaming-stream', 'simple-one-word', 'podcast',
] as const
export type CaptionThemeName = typeof CAPTION_THEMES[number]
