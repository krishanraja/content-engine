// A test-only composition: the caller supplies time and colour tokens.
import React from 'react'
import { ThreeCanvas } from '@remotion/three'
import { Composition, registerRoot } from 'remotion'
import { progress } from '../../clock'

export function ThreeSmoke({ frame, tokens }) {
  const turn = progress(frame, 30) * Math.PI / 2
  return React.createElement(ThreeCanvas, {
    width: 64, height: 64, camera: { position: [0, 0, 5], fov: 45 },
    gl: { antialias: false, alpha: false },
  }, React.createElement('color', { attach: 'background', args: [tokens.ink] }),
  React.createElement('mesh', { rotation: [turn / 2, turn, 0] },
    React.createElement('boxGeometry', { args: [1.8, 1.2, 1] }),
    React.createElement('meshBasicMaterial', { color: tokens.mint })))
}

registerRoot(() => React.createElement(Composition, {
  id: 'ThreeSmoke', component: ThreeSmoke, width: 64, height: 64,
  fps: 30, durationInFrames: 30,
}))
