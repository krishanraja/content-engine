import { HOUSE_FONTS } from '../../house/geometry'
import { boxFor } from '../geometry'
import type { EngineRenderProps } from '../props'

export function IllustrationLabel({ props, frame }: { props: EngineRenderProps; frame: number }) {
  if (!props.illustrationLabels.some((label) => label.fromFrame <= frame && frame < label.toFrame)) return null
  return <div style={{
    position: 'absolute', ...boxFor('illustrationLabel', props.aspect), boxSizing: 'border-box',
    display: 'grid', placeItems: 'center', fontFamily: HOUSE_FONTS.data, fontSize: 24,
    fontWeight: 500, color: props.tokens.cream, background: props.tokens.ink, pointerEvents: 'none',
  }}>ILLUSTRATION</div>
}
