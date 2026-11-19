// An off day wears no tag, however its label is spelled (Ruling, Krish, 2026-11-18: "off.day is NEVER to be used ever as a
// tag"; 2026-11-19: "ensure there are NEVER any off day tags that exist anywhere"). The one test every chrome piece asks.
export const isOffDayLabel = (label: string | null | undefined): boolean => /(?<![A-Za-z])off[\s._-]?day(?![A-Za-z])/i.test(String(label ?? ''))
