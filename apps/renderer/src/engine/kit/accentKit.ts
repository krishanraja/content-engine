import brand from '../../../../../config/ve/brand-tokens.json'

/** The palette retains the colours and roles of the 20 November accent kit for archived work. */
export type AccentRole = 'big_moment' | 'gradient' | 'duotone_cutout'
type Stop = readonly [string, number]

const kit = brand.accent_kit
export const ACCENT_COLOURS = kit.colours as Readonly<Record<'ember' | 'ember_deep' | 'plum' | 'plum_deep' | 'peach' | 'peach_light', string>>
export const ACCENT_ROLES = Object.keys(kit.roles) as AccentRole[]

/** The v5 palette has no eligible days for the archived accents. */
export function accentKit(seriesDay: boolean) {
  return seriesDay && kit.days.length > 0 ? ACCENT_COLOURS : null
}

function colourOf(name: string): string {
  return (ACCENT_COLOURS as Record<string, string>)[name] ?? name
}

/** A named gradient as a CSS linear-gradient, top to bottom, or null on an off day. */
export function accentGradient(name: 'moment' | 'title', seriesDay: boolean): string | null {
  if (!accentKit(seriesDay)) return null
  const stops = kit.gradients[name] as unknown as Stop[]
  return `linear-gradient(180deg, ${stops.map(([colour, at]) => `${colourOf(colour)} ${at}%`).join(', ')})`
}

/** The ember duotone's stops (luminance 0 to 100), or null on an off day. */
export function duotoneEmber(seriesDay: boolean): Array<{ colour: string; at: number }> | null {
  if (!accentKit(seriesDay)) return null
  return (kit.duotone_ember as unknown as Stop[]).map(([colour, at]) => ({ colour: colourOf(colour), at }))
}
