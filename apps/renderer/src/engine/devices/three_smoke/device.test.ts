import { test, expect } from 'vitest'
import { bundle } from '@remotion/bundler'
import { renderStill, selectComposition } from '@remotion/renderer'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Exercise WebGL through the real Remotion renderer, not a mocked scene or reducer.
test('ThreeCanvas pixels change with supplied time and repeat exactly at the same time', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 've-three-smoke-'))
  try {
    const serveUrl = await bundle({
      entryPoint: fileURLToPath(new URL('./fixture.mjs', import.meta.url)),
      outDir: path.join(temporary, 'bundle'),
    })
    const studio = JSON.parse(await readFile('config/studio.json', 'utf8'))
    const tokens = studio.brand_themes.find((theme: { theme_id: string }) => theme.theme_id === 'makeyourmindup-video-v1').colors
    const images: Buffer[] = []
    for (const [index, frame] of [0, 15, 15].entries()) {
      const output = path.join(temporary, `${index}.png`)
      await renderStill({
        serveUrl,
        composition: await selectComposition({ serveUrl, id: 'ThreeSmoke', inputProps: { frame, tokens },
          chromiumOptions: { gl: 'swangle' },
          ...(process.env.REMOTION_BROWSER ? { browserExecutable: process.env.REMOTION_BROWSER } : {}),
        }),
        inputProps: { frame, tokens }, frame, output, imageFormat: 'png',
        chromiumOptions: { gl: 'swangle' },
        ...(process.env.REMOTION_BROWSER ? { browserExecutable: process.env.REMOTION_BROWSER } : {}),
      })
      images.push(await readFile(output))
    }
    expect(images[0]!.equals(images[1]!)).toBe(false)
    expect(images[1]!.equals(images[2]!)).toBe(true)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}, 120_000)
