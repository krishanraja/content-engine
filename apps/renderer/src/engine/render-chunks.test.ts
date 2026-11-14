import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
// @ts-expect-error The render entry point is native JavaScript.
import { chunkFrames, chunkRanges, joinChunks, renderChunks, renderKey } from '../../scripts/ve-chunks.mjs'

// Audit ve-8 (14 Nov 2026): a long render survives a failure part way. The frames here are tiny real H.264 clips drawn
// by ffmpeg, so the join is the real one; only Remotion's renderMedia is stood in for.
const run = promisify(execFile)
const temporary: string[] = []
afterEach(async () => { await Promise.all(temporary.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })
async function dir() {
  const made = await mkdtemp(path.join(tmpdir(), 've-chunks-test-'))
  temporary.push(made)
  return made
}

/** A stand-in for renderMedia with a frameRange: one H.264 clip of exactly that many frames at 30 fps. */
async function drawChunk(start: number, end: number, file: string) {
  await run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `testsrc2=s=64x112:r=30`, '-frames:v', String(end - start + 1),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', file], { timeout: 60000 })
}

async function frameCount(file: string) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0',
    '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', file], { timeout: 60000 })
  return Number(stdout.trim())
}

describe('chunked renders', () => {
  it('splits a cut into inclusive frame ranges and reads its size from the environment', () => {
    expect(chunkRanges(7, 3)).toEqual([[0, 2], [3, 5], [6, 6]])
    expect(chunkRanges(3, 900)).toEqual([[0, 2]])
    expect(() => chunkRanges(0, 3)).toThrow()
    expect(chunkFrames({})).toBe(900)
    expect(chunkFrames({ VE_RENDER_CHUNK_FRAMES: '120' })).toBe(120)
    expect(() => chunkFrames({ VE_RENDER_CHUNK_FRAMES: '0' })).toThrow()
  })

  it('a render that fails part way keeps its finished chunks, and the rerun renders only the rest', async () => {
    const cache = await dir()
    const calls: number[][] = []
    let failOn: number | undefined = 6
    const renderChunk = async (start: number, end: number, file: string) => {
      calls.push([start, end])
      if (start === failOn) {
        await writeFile(file, 'half a chunk')
        throw new Error('the browser died')
      }
      await drawChunk(start, end, file)
    }
    const quiet = () => {}
    await expect(renderChunks({ frames: 10, size: 3, dir: cache, renderChunk, log: quiet })).rejects.toThrow('the browser died')
    expect(calls).toEqual([[0, 2], [3, 5], [6, 8]])
    expect((await readdir(cache)).filter(name => !name.includes('.part')).sort())
      .toEqual(['chunk-000000-000002.mp4', 'chunk-000003-000005.mp4'])

    calls.length = 0
    failOn = undefined
    const files = await renderChunks({ frames: 10, size: 3, dir: cache, renderChunk, log: quiet })
    expect(calls).toEqual([[6, 8], [9, 9]])
    expect(files).toHaveLength(4)

    const out = path.join(await dir(), 'joined.mp4')
    await joinChunks(files, out)
    expect(await frameCount(out)).toBe(10)
  }, 120_000)

  it('lays one sound under the joined picture', async () => {
    const work = await dir()
    const files = []
    for (const [start, end] of chunkRanges(12, 5)) {
      const file = path.join(work, `c${start}.mp4`)
      await drawChunk(start, end, file)
      files.push(file)
    }
    const sound = path.join(work, 'sound.wav')
    await run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', '0.4', sound])
    const out = path.join(work, 'out.mp4')
    await joinChunks(files, out, { audio: sound, temporary: work })
    expect(await frameCount(out)).toBe(12)
    const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', out])
    expect(stdout.trim().split(/\s+/).sort()).toEqual(['audio', 'video'])
  }, 120_000)

  it('keys a render by its props and its media, so a changed cut never reuses old chunks', async () => {
    const source = await dir()
    const media = await dir()
    await mkdir(path.join(source, 'engine'))
    await writeFile(path.join(source, 'engine/a.ts'), 'one')
    await writeFile(path.join(media, 'take.mp4'), 'take')
    const base = { props: { durationFrames: 10 }, id: 'VeFormatMasterTall', scale: 1, size: 3, sourceDir: source, publicDir: media }
    const key = await renderKey(base)
    expect(await renderKey(base)).toBe(key)
    expect(await renderKey({ ...base, props: { durationFrames: 11 } })).not.toBe(key)
    await writeFile(path.join(source, 'engine/a.ts'), 'two')
    const sourceChanged = await renderKey(base)
    expect(sourceChanged).not.toBe(key)
    await writeFile(path.join(media, 'take.mp4'), 'a longer take')
    const mediaChanged = await renderKey(base)
    expect(mediaChanged).not.toBe(sourceChanged)
    await writeFile(path.join(media, 'take.mp4'), 'the same tak')
    expect(await renderKey(base)).not.toBe(mediaChanged)
    // Each render stages its media afresh: a copy with the same bytes and a new modified time keeps the key.
    await writeFile(path.join(media, 'take.mp4'), 'a longer take')
    expect(await renderKey(base)).toBe(mediaChanged)
  })
})
