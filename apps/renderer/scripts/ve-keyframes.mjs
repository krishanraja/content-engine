#!/usr/bin/env node
/** The SplitKeyFrame stills for a Gate 2 sitting (card ve-fwp-rebuild-1): one 1080x1920 PNG per {variant, beat}, through
 *  one bundle. Usage: node ve-keyframes.mjs <out dir> <frames.json> <public dir>
 *  frames.json is a list of {variant, beat, series, caption?, plate}: `plate` is a path to a real frame of his take (a
 *  JPEG or PNG), read here and handed to the composition as a data URI, so no media is committed. <public dir> holds
 *  the files the composition names with staticFile (split/wordmark.png, split/officialcharts_song_page.png, ...). A
 *  frame the composition cannot draw is reported and skipped, never faked. Files come out as <variant>-<beat>.png. */
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundle } from '@remotion/bundler'
import { selectComposition, renderStill } from '@remotion/renderer'
import { browserExecutable } from './ve-render.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const [out, framesFile, publicDir] = process.argv.slice(2)
if (!out || !framesFile || !publicDir) throw new Error('usage: ve-keyframes.mjs <out dir> <frames.json> <public dir>')
const frames = JSON.parse(await readFile(framesFile, 'utf8'))
await mkdir(out, { recursive: true })
const serveUrl = await bundle({ entryPoint: path.join(root, 'apps/renderer/src/index.ts'), publicDir: path.resolve(publicDir), webpackOverride: c => c })
const browser = await browserExecutable()
const mime = (file) => (/\.png$/i.test(file) ? 'image/png' : 'image/jpeg')
for (const { plate, ...props } of frames) {
  const name = `${props.variant}-${props.beat}`
  try {
    const bytes = await readFile(plate)
    const inputProps = { ...props, plateSrc: `data:${mime(plate)};base64,${bytes.toString('base64')}` }
    const composition = await selectComposition({ serveUrl, id: 'SplitKeyFrame', inputProps, browserExecutable: browser })
    await renderStill({ composition, serveUrl, output: path.join(out, `${name}.png`), inputProps, imageFormat: 'png', browserExecutable: browser })
    console.log(`ve keyframes: ${name}`)
  } catch (error) {
    console.log(`ve keyframes: SKIPPED ${name}: ${String(error.message || error).split('\n')[0]}`)
  }
}
