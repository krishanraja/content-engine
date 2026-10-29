import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { DESCRIPTION_MAX, FEED_CUT, HOOK_MAX, MAX_HASHTAGS, READ_LINE, SUBTITLE_AIM, SUBTITLE_LINE, TITLE_AIM, TITLE_MAX } from '../apps/control-plane/api/_packaging.js'

// config/asset-spec.json (Krish, 2026-10-29: "clean up the asset and title, subtitle, copy, descriptions and asset
// sizes for exactly what we need to be producing now"): every number it holds is one the code already enforces, so
// the two can never part. A null with an "open" note is a field nothing sets yet, never an invented one.

const PY = process.platform === 'win32' ? 'python' : 'python3'
const root = new URL('..', import.meta.url)
const read = (p: string) => readFileSync(new URL(p, root), 'utf8')
const spec = JSON.parse(read('config/asset-spec.json'))
const frame = (name: string) => spec.assets[name].frame

describe('config/asset-spec.json', () => {
  it('holds the seven formats the engine produces now, each naming only assets it holds', () => {
    expect(Object.keys(spec.formats).sort()).toEqual(['carousel', 'fry_explainer', 'meme', 'short_9x16', 'snackable', 'substack_article', 'substack_video_post', 'youtube_long'].sort())
    for (const f of Object.values<any>(spec.formats)) for (const a of f.assets) expect(spec.assets[a], a).toBeTruthy()
  })
  it('says what is not set yet instead of inventing it', () => {
    for (const [name, a] of Object.entries<any>(spec.assets)) if (a.frame === null) expect(a.open, name).toBeTruthy()
    for (const key of ['youtube_long', 'short_9x16']) { expect(spec.formats[key].length_seconds).toBeNull(); expect(spec.formats[key].open).toMatch(/length/) }
  })
  it('holds the title, subtitle and description limits _packaging.ts enforces', () => {
    for (const key of ['substack_article', 'substack_video_post', 'youtube_long', 'short_9x16', 'fry_explainer'])
      expect([spec.formats[key].title.aim, spec.formats[key].title.max], key).toEqual([TITLE_AIM, TITLE_MAX])
    expect(spec.formats.substack_article.subtitle).toMatchObject({ first_sentence_max: SUBTITLE_LINE, aim: SUBTITLE_AIM })
    expect(spec.formats.substack_article.title.why).toContain(String(FEED_CUT))
    expect(spec.formats.youtube_long.description).toMatchObject({ max: DESCRIPTION_MAX, hook_max: HOOK_MAX, read_line: READ_LINE, hashtags_max: MAX_HASHTAGS })
  })
  it('holds the frames the cutters, the archive and the publish page use', () => {
    const size = /SIZE = \{'9x16': \((\d+), (\d+)\), '16x9': \((\d+), (\d+)\)\}/.exec(read('scripts/quick-edit/make.py'))!
    expect(frame('short_video')).toEqual([+size[1]!, +size[2]!])
    expect(frame('long_video')).toEqual([+size[3]!, +size[4]!])
    const thumbs = /THUMB_SIZE = \{'tall': \((\d+), (\d+)\), 'wide': \((\d+), (\d+)\)\}/.exec(read('scripts/quick-edit/archive.py'))!
    expect(frame('thumb_tall')).toEqual([+thumbs[1]!, +thumbs[2]!])
    expect(frame('thumb_wide')).toEqual([+thumbs[3]!, +thumbs[4]!])
    const pm = read('scripts/post-pack/publish_manager.py')
    for (const [role, name] of [['vertical-cover', 'vertical_cover'], ['square-cover', 'square_cover'], ['share-card-cover', 'share_card_cover']] as const) {
      const m = new RegExp(`'${role}': '[^']*\\((\\d+) x (\\d+)\\)'`).exec(pm)!
      expect(frame(name), role).toEqual([+m[1]!, +m[2]!])
    }
  })
  it('keeps the explainer\'s modules as config/style-references.json holds them', () => {
    const styles = JSON.parse(read('config/style-references.json'))
    const fry = styles.formats.script.find((f: any) => f.id === 'fry-explainer')
    expect(spec.formats.fry_explainer.copy.modules).toEqual(fry.modules)
    expect(styles.formats.production.some((f: any) => f.id === spec.formats.fry_explainer.production_format)).toBe(true)
  })
  it('is read by asset_spec.py, which piece_manifest.py and snackable.py use', () => {
    expect(execFileSync(PY, ['scripts/post-pack/asset_spec.py', 'self-test'], { cwd: root, encoding: 'utf8' })).toContain('passed')
    expect(read('scripts/post-pack/piece_manifest.py')).toContain('asset_spec.asset_kind(')
    expect(read('scripts/quick-edit/snackable.py')).toContain('asset_spec.snackable()')
  })
})
