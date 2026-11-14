/** Long renders in frame-range chunks (audit ve-8, 14 Nov 2026).
 *
 *  One renderMedia call for a long cut is one process for every frame: a failure at minute 9 of a 10-minute cut threw
 *  the whole render away. A cut longer than one chunk is rendered as muted video chunks of `size` frames, each written
 *  to the render cache under a key of everything that decides its pixels, then joined without re-encoding. A rerun
 *  after a failure keeps every finished chunk and renders only the rest. The sound is rendered once for the whole cut
 *  and laid under the joined picture, so the audio correction in ve-render.mjs measures the same file as before. */
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** 30 s at the house 30 fps; VE_RENDER_CHUNK_FRAMES overrides it (a positive whole number). */
export const DEFAULT_CHUNK_FRAMES = 900

export function chunkFrames(env = process.env) {
  const raw = env.VE_RENDER_CHUNK_FRAMES
  if (raw === undefined || raw === '') return DEFAULT_CHUNK_FRAMES
  const size = Number(raw)
  if (!Number.isInteger(size) || size < 1) throw new Error(`VE_RENDER_CHUNK_FRAMES must be a positive whole number, got ${raw}`)
  return size
}

/** Inclusive frame ranges covering 0..total-1, each at most `size` frames. */
export function chunkRanges(total, size) {
  if (!Number.isInteger(total) || total < 1) throw new Error(`a render needs at least one frame, got ${total}`)
  if (!Number.isInteger(size) || size < 1) throw new Error(`a chunk needs at least one frame, got ${size}`)
  const ranges = []
  for (let start = 0; start < total; start += size) ranges.push([start, Math.min(start + size, total) - 1])
  return ranges
}

/** Every file under `dir`, as relative path and size, sorted. */
async function listing(dir) {
  const rows = []
  async function walk(current) {
    let entries
    try { entries = await readdir(current, { withFileTypes: true }) } catch { return }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (entry.isFile()) {
        rows.push([path.relative(dir, full).split(path.sep).join('/'), (await stat(full)).size])
      }
    }
  }
  await walk(dir)
  return rows
}

/** The cache key of one render: the props, the canvas, the scale, the renderer's source and the staged media. */
export async function renderKey({ props, id, scale, size, sourceDir, publicDir }) {
  const hash = createHash('sha256')
  hash.update(JSON.stringify({ props, id, scale, size }))
  for (const [file] of await listing(sourceDir)) {
    hash.update(file)
    hash.update(await readFile(path.join(sourceDir, file)))
  }
  // The staged media by its bytes, streamed: each render stages fresh copies, so a modified time would never match
  // and a rerun would keep nothing (found on the first kill-and-resume run, 14 Nov 2026).
  for (const [file, size] of await listing(publicDir)) {
    hash.update(`${file}\0${size}\0`)
    for await (const piece of createReadStream(path.join(publicDir, file))) hash.update(piece)
  }
  return hash.digest('hex').slice(0, 32)
}

const pad = (n) => String(n).padStart(6, '0')

/** Render each missing chunk with `renderChunk(start, end, file)`, keep finished ones, and return the chunk files in
 *  order. A chunk is written to a part file first and renamed only when its render returned, so a crash mid-chunk
 *  never leaves a file that a rerun would keep. */
export async function renderChunks({ frames, size, dir, renderChunk, log = console.log }) {
  await mkdir(dir, { recursive: true })
  const files = []
  const ranges = chunkRanges(frames, size)
  for (const [index, [start, end]] of ranges.entries()) {
    const file = path.join(dir, `chunk-${pad(start)}-${pad(end)}.mp4`)
    const kept = await stat(file).then((info) => info.size > 0, () => false)
    if (kept) {
      log(`ve render: chunk ${index + 1}/${ranges.length} (frames ${start}-${end}) kept from the cache`)
    } else {
      const part = path.join(dir, `chunk-${pad(start)}-${pad(end)}.part-${process.pid}.mp4`)
      await rm(part, { force: true })
      await renderChunk(start, end, part)
      if (!(await stat(part).then((info) => info.size > 0, () => false))) {
        throw new Error(`chunk ${start}-${end} rendered no file`)
      }
      await rename(part, file)
      log(`ve render: chunk ${index + 1}/${ranges.length} (frames ${start}-${end}) rendered`)
    }
    files.push(file)
  }
  return files
}

/** Join chunk files without re-encoding (ffmpeg's concat demuxer), then lay `audio` under them when given. */
export async function joinChunks(files, output, { audio, ffmpeg = 'ffmpeg', temporary = path.dirname(output) } = {}) {
  const list = path.join(temporary, `chunks-${process.pid}.txt`)
  await writeFile(list, files.map((file) => `file '${path.resolve(file).replace(/'/g, "'\\''")}'`).join('\n') + '\n')
  try {
    const joined = audio ? path.join(temporary, `joined-${process.pid}.mp4`) : output
    await run(ffmpeg, ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', joined],
      { timeout: 600000, windowsHide: true })
    if (audio) {
      await run(ffmpeg, ['-v', 'error', '-y', '-i', joined, '-i', audio, '-map', '0:v:0', '-map', '1:a:0',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', output], { timeout: 600000, windowsHide: true })
      await rm(joined, { force: true })
    }
  } finally {
    await rm(list, { force: true })
  }
}
