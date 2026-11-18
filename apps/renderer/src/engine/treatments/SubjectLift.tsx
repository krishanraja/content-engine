import type { ReactElement, SVGProps } from 'react'
import bank from '../../../../../config/ve/treatments.json'

/** Frame plates must be decoded offline from the same take frame. No independent video clocks. */
export type FramePlate = { src: string; width: number; height: number; frame: number }
export type SubjectLiftProps = {
  take: FramePlate; matte: FramePlate; frame: number; width: number; height: number
  strength: number; tokens: { mint: string }; id: string
}

export function subjectLiftParameters(strength: number) {
  if (!Number.isFinite(strength) || strength < 0 || strength > bank.limits.max_strength) throw new Error('Invalid subject-lift strength')
  const params = (primitive: string) => bank.treatments['subject-lift'].recipe.find(s => s.primitive === primitive)?.params
  return {
    choke: (params('matte-choke')?.choke ?? 0) * strength,
    softness: (params('matte-choke')?.softness ?? 0) * strength,
    stops: (params('exposure')?.background_stops ?? 0) * strength,
    blur: (params('gaussian-blur')?.background_px ?? 0) * strength,
    radius: (params('rim-light')?.radius ?? 0) * strength,
    intensity: (params('rim-light')?.intensity ?? 0) * strength,
  }
}

/** Opt-in frame compositor. Original subject RGB is never filtered or transformed separately. */
export function SubjectLift({ take, matte, frame, width, height, strength, tokens, id }: SubjectLiftProps): ReactElement<SVGProps<SVGSVGElement>> {
  const p = subjectLiftParameters(strength)
  if (![width, height, take.width, take.height].every(n => Number.isFinite(n) && n > 0)) throw new Error('Invalid plate dimensions')
  if (take.frame !== frame || matte.frame !== frame || matte.width !== take.width || matte.height !== take.height) throw new Error('Matte must match take dimensions and source frame')
  if (!/^[a-zA-Z][\w-]*$/.test(id)) throw new Error('Unique SVG id required')
  const image = { href: take.src, width, height, preserveAspectRatio: 'xMidYMid slice' }
  if (strength === 0) return <svg width={width} height={height}><image {...image} /></svg>
  return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
    <defs>
      <filter id={`${id}-inverse`} colorInterpolationFilters="sRGB">
        <feComponentTransfer><feFuncR type="linear" slope={-1} intercept={1} /><feFuncG type="linear" slope={-1} intercept={1} /><feFuncB type="linear" slope={-1} intercept={1} /></feComponentTransfer>
      </filter>
      <mask id={`${id}-outside`} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height} style={{ maskType: 'luminance' }}>
        <image {...image} href={matte.src} filter={`url(#${id}-inverse)`} />
      </mask>
      <filter id={`${id}-choke`}><feMorphology operator="erode" radius={p.choke} /><feGaussianBlur stdDeviation={p.softness} /></filter>
      <filter id={`${id}-rim`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation={p.radius * 0.384} />
      </filter>
      <filter id={`${id}-background`} colorInterpolationFilters="linearRGB" x="-50%" y="-50%" width="200%" height="200%">
        <feComponentTransfer><feFuncR type="linear" slope={2 ** p.stops} /><feFuncG type="linear" slope={2 ** p.stops} /><feFuncB type="linear" slope={2 ** p.stops} /></feComponentTransfer>
        <feGaussianBlur stdDeviation={p.blur} />
      </filter>
      <mask id={`${id}-subject`} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height} style={{ maskType: 'luminance' }}>
        <image {...image} href={matte.src} filter={`url(#${id}-choke)`} />
      </mask>
    </defs>
    <image {...image} filter={`url(#${id}-background)`} />
    <g mask={`url(#${id}-outside)`}><g filter={`url(#${id}-rim)`} opacity={p.intensity}><rect width={width} height={height} fill={tokens.mint} mask={`url(#${id}-subject)`} /></g></g>
    <image {...image} mask={`url(#${id}-subject)`} />
  </svg>
}
