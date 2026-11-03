import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
// @ts-expect-error The render entry point is native JavaScript.
import { stageRenderAssets } from '../../scripts/ve-render.mjs'

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
