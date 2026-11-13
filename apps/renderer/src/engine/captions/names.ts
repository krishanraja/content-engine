/** The caption styles ve can draw, picked per piece with brand.caption_theme; with none, the house caption draws.
 *  Krish, 2026-11-11: "can you install all of these different caption styles in to the engine, so future productions
 *  can select from them?"; then, of the first build, "None of other styles are amazing you need to improve them all
 *  10X". So none is vendored any more: every style is the house's own, drawn in the house faces and colours by
 *  ./themes.tsx on the shared kit in ./kit.ts. The names keep the ideas they came from (vshukla7/remotion-captions-themes,
 *  MIT) so a spec written that day still reads. `art-directed` is the one he picked ("pick these"; card
 *  instagram_DfkCOCLt7KZ, chrome/ArtDirectedCaption.tsx) and `cinematic` is Audrey's cinematic caption system
 *  (github.com/audrey-560/hyperframes-cinematic-caption, MIT, rebuilt here for ve). Keep in step with the contracts
 *  enum in packages/contracts/src/production-spec.ts (captions.test.ts checks). */
export const CAPTION_THEMES = [
  'pop', 'karaoke', 'kinetic-01', 'kinetic-02', 'hustle', 'grape', 'beast', 'poppin', 'aarit', 'soft-ai',
  'gaming-stream', 'simple-one-word', 'podcast',
  'art-directed', 'cinematic', 'slam',
  'georgia-build', 'stair-flash', 'tuck-stack', 'anchor-quote', 'rack-focus', 'flip-hinge', 'slice', 'slot-roll', 'receipt-chip', 'ink-block', 'mint-word',
] as const
export type CaptionThemeName = typeof CAPTION_THEMES[number]
