import { bundle } from '@remotion/bundler'
import { resolve } from 'node:path'

const serveUrl = await bundle({ entryPoint: resolve('apps/renderer/src/index.ts') })
if (!serveUrl) throw new Error('Remotion renderer bundle did not produce a serve URL')
process.stdout.write('renderer bundle passed\n')
