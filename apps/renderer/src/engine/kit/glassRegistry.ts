import React from 'react'
import type { EngineTokens } from '../props'
export interface GlassProps { frame: number; sinceFrames: number; tokens: EngineTokens; params: Record<string, unknown>; k: number }
export type GlassKind = (props: GlassProps) => React.ReactElement
const Blank: GlassKind = ({tokens}) => React.createElement('div', {style: {position:'absolute',inset:0,background:tokens.inkSoft}},
  React.createElement('div', {style:{position:'absolute',inset:0,opacity:0.12,background:`radial-gradient(ellipse at 45% 18%, ${tokens.mint}, transparent 65%)`}}))
export const GLASS_KINDS: Record<string, GlassKind> = { blank: Blank }
export function glassKind(id: string): GlassKind {
  const kind=GLASS_KINDS[id]
  if (!kind) throw new Error(`ve: unregistered glass kind ${id}`)
  return kind
}
