import type { DeviceProps } from '../types'
/** Semantic materials: human mint; AI ink with 45 degree inkSoft lines at 6px; synth/sample solid inkSoft. */
export function material(kind: 'human' | 'ai' | 'synth' | 'sample', tokens: DeviceProps['tokens']) {
  if (kind === 'human') return { background: tokens.mint }
  if (kind === 'ai') return { backgroundColor: tokens.ink,
    backgroundImage: `repeating-linear-gradient(45deg, transparent 0px, transparent 5px, ${tokens.inkSoft} 5px, ${tokens.inkSoft} 6px)` }
  return { background: tokens.inkSoft }
}
