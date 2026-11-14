import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
// @ts-expect-error The render entry point is native JavaScript.
import { browserExecutable, renderClock, stageRenderAssets } from '../../scripts/ve-render.mjs'

const temporary: string[] = []
afterEach(async () => { await Promise.all(temporary.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })
async function setup(file = 'assets/logos/meta.svg') {
  const root = await mkdtemp(path.join(tmpdir(), 've-assets-test-'))
  temporary.push(root)
  await mkdir(path.join(root, 'config'))
  await mkdir(path.join(root, 'assets/logos'), { recursive: true })
  await mkdir(path.join(root, 'public'))
  const marks = ['Meta', 'Google', 'Unused'].map(company => ({ company, variant: 'full_colour',
    file: company === 'Meta' ? file : `assets/logos/${company}.svg` }))
  await writeFile(path.join(root, 'config/logo-registry.json'), JSON.stringify({ marks }))
  for (const name of ['meta.svg', 'Google.svg', 'Unused.svg']) await writeFile(path.join(root, 'assets/logos', name), name)
  const props = { brand: {}, audio: { stem: { src: 'https://example.test/stem.wav' }, sfx: [] }, segments: [], objects: [
    { device: 'logo_card', params: { logos: [{ id: 'Meta' }, { id: 'Meta:full_colour' }] } },
    { device: 'logo_orbit', params: { logos: [{ id: 'Meta' }], centre: 'Google' } },
  ] }
  return { root, props, stage: () => stageRenderAssets(props, path.join(root, 'props.json'), path.join(root, 'public'), root) }
}
it('stages exactly the named registry marks, including a registered orbit centre, at their relative paths', async () => {
  const { root, stage } = await setup()
  await stage()
  expect((await readdir(path.join(root, 'public/assets/logos'))).sort()).toEqual(['Google.svg', 'meta.svg'])
  expect(await readFile(path.join(root, 'public/assets/logos/meta.svg'), 'utf8')).toBe('meta.svg')
})
it('allows a non-registry centre slot without staging it', async () => {
  const { root, props, stage } = await setup()
  props.objects[1]!.params.centre = 'face-slot'
  await stage()
  expect(await readdir(path.join(root, 'public/assets/logos'))).toEqual(['meta.svg'])
})
it('refuses unknown logo ids', async () => {
  const { props, stage } = await setup()
  props.objects[0]!.params.logos = [{ id: 'Invented' }]
  await expect(stage()).rejects.toThrow(/Unregistered/)
})
it('refuses registry paths escaping assets/logos', async () => {
  for (const file of ['assets/logos/../../outside.svg', '/outside.svg', 'other/mark.svg']) {
    const { stage } = await setup(file)
    await expect(stage()).rejects.toThrow(/escapes assets\/logos/)
  }
})
it('refuses a registry symlink escaping assets/logos', async () => {
  const { root, stage } = await setup('assets/logos/link.svg')
  await writeFile(path.join(root, 'outside.svg'), 'outside')
  await symlink(path.join(root, 'outside.svg'), path.join(root, 'assets/logos/link.svg'))
  await expect(stage()).rejects.toThrow(/escapes assets\/logos/)
})

it('drives REMOTION_BROWSER, else an installed headless shell, else lets Remotion choose', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 've-browser-test-'))
  temporary.push(root)
  expect(await browserExecutable({ REMOTION_BROWSER: '/x/chrome' }, root)).toBe('/x/chrome')
  expect(await browserExecutable({}, path.join(root, 'missing'))).toBeNull()
  expect(await browserExecutable({}, root)).toBeNull()
  const shell = path.join(root, 'chromium_headless_shell-1243', 'chrome-headless-shell-linux64')
  await mkdir(shell, { recursive: true })
  await writeFile(path.join(shell, 'chrome-headless-shell'), '')
  expect(await browserExecutable({}, root)).toBe(path.join(shell, 'chrome-headless-shell'))
})

describe('nothing before the hook', () => {
  // Ruling (Krish, 2026-11-12): "Nothing before the hook, ever. Remove the sting exception for good."
  async function stingProps(change: (sting: { src: string; sha256: string }) => void = () => {}) {
    const root = await mkdtemp(path.join(tmpdir(), 've-sting-test-'))
    temporary.push(root)
    await mkdir(path.join(root, 'public'))
    const bytes = Buffer.from('fifty-six frames of the sting')
    await writeFile(path.join(root, 'sting.mp4'), bytes)
    const sting = { src: 'sting.mp4', series: 'mind_the_gap', frames: 56, sha256: createHash('sha256').update(bytes).digest('hex') }
    change(sting)
    const props = { brand: {}, audio: { stem: { src: 'https://example.test/stem.wav' }, sfx: [] }, segments: [], objects: [], sting }
    return { root, props, bytes, stage: () => stageRenderAssets(props, path.join(root, 'props.json'), path.join(root, 'public'), root) }
  }
  it('refuses props carrying a sting before anything is staged, even the clip its props name', async () => {
    await expect((await stingProps()).stage()).rejects.toThrow(/Nothing before the hook, ever/)
    await expect((await stingProps((sting) => { sting.src = 'https://example.test/sting.mp4' })).stage()).rejects.toThrow(/Nothing before the hook, ever/)
  })
  it('and props carrying an episode card in front', async () => {
    const { props, root } = await stingProps()
    const carded = { ...props, sting: undefined, opening: { kind: 'episode_card', said: 'I want the episode card to come in.', on: '2026-11-09' } }
    await expect(stageRenderAssets(carded, path.join(root, 'props.json'), path.join(root, 'public'), root)).rejects.toThrow(/episode card/)
  })
  it('runs the cut on its own clock: nothing in front, a sting only after the hook', () => {
    const plain = renderClock({ durationFrames: 120 })
    expect([plain.lead, plain.frames, plain.toRender(0), plain.toRender(119)]).toEqual([0, 120, 0, 119])
    // After the hook (config/brand-palette.json): the hook's frames stay, every frame from the sting on is 56 later.
    const after = renderClock({ durationFrames: 120, sting: { frames: 56, atFrame: 60 } })
    expect([after.lead, after.at, after.frames, after.toRender(59), after.toRender(60), after.toRender(119)]).toEqual([0, 60, 176, 59, 116, 175])
  })
})
