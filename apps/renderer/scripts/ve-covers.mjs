#!/usr/bin/env node
/** The StyleStill cover art (card ve-style-still-template-2): one JPEG per look, motion style and caption style, 540x960
 *  (the 1080x1920 frame at 0.5), through one bundle. Usage: node ve-covers.mjs <out dir> <ids.json>, ids a list of
 *  {layer, id}. A cover the composition cannot draw is reported and skipped, never faked. scripts/velib/lab.py covers
 *  writes the manifest (stills.json, source template) that ve lab still checks before a cover reaches the board. */
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundle } from '@remotion/bundler'
import { selectComposition, renderStill } from '@remotion/renderer'
import { browserExecutable } from './ve-render.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const [out, idsFile] = process.argv.slice(2)
if (!out || !idsFile) throw new Error('usage: ve-covers.mjs <out dir> <ids.json>')
const ids = JSON.parse(await readFile(idsFile, 'utf8'))
await mkdir(out, { recursive: true })
const serveUrl = await bundle({ entryPoint: path.join(root, 'apps/renderer/src/index.ts'), webpackOverride: c => c })
const browser = await browserExecutable()
for (const p of ids) {
  const file = path.join(out, `${p.layer}-${p.id}.jpeg`)
  try {
    const composition = await selectComposition({ serveUrl, id: 'StyleStill', inputProps: p, browserExecutable: browser })
    await renderStill({ composition, serveUrl, output: file, inputProps: p, imageFormat: 'jpeg', jpegQuality: 90, scale: 0.5, browserExecutable: browser })
    console.log(`ve covers: ${p.layer} ${p.id}`)
  } catch (error) {
    console.log(`ve covers: SKIPPED ${p.layer} ${p.id}: ${String(error.message || error).split('\n')[0]}`)
  }
}
