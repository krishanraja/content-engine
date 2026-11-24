import brand from '../../../../../config/ve/brand-tokens.json'

/** The accent kit (Krish approved on 2026-11-20, the polish board): ember, ember_deep, plum, plum_deep and peach, for big
 *  moments, gradients and duotone cut-outs on Monday, Wednesday and Friday only. The values live once, in
 *  config/ve/brand-tokens.json accent_kit; ve lint refuses them on an off day or outside those roles
 *  (scripts/velib/accent_kit.py). A device reads them only through `accentKit`, which gives nothing on an off day, so an
 *  off-day cut can never wear them. */
export type AccentRole = 'big_moment' | 'gradient' | 'duotone_cutout'
type Stop = readonly [string, number]

const kit = brand.accent_kit
export const ACCENT_COLOURS = kit.colours as Readonly<Record<'ember' | 'ember_deep' | 'plum' | 'plum_deep' | 'peach' | 'peach_light', string>>
export const ACCENT_ROLES = Object.keys(kit.roles) as AccentRole[]

/** The kit for a cut, or null on an off day (`seriesDay` false: off days are mint, never coral or ember). */
export function accentKit(seriesDay: boolean) {
  return seriesDay ? ACCENT_COLOURS : null
}

function colourOf(name: string): string {
  return (ACCENT_COLOURS as Record<string, string>)[name] ?? name
}

/** A named gradient as a CSS linear-gradient, top to bottom, or null on an off day. */
export function accentGradient(name: 'moment' | 'title', seriesDay: boolean): string | null {
  if (!seriesDay) return null
  const stops = kit.gradients[name] as unknown as Stop[]
  return `linear-gradient(180deg, ${stops.map(([colour, at]) => `${colourOf(colour)} ${at}%`).join(', ')})`
}

/** The ember duotone's stops (luminance 0 to 100), or null on an off day. */
export function duotoneEmber(seriesDay: boolean): Array<{ colour: string; at: number }> | null {
  if (!seriesDay) return null
  return (kit.duotone_ember as unknown as Stop[]).map(([colour, at]) => ({ colour: colourOf(colour), at }))
}
