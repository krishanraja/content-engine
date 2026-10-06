import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  // The voice checks load the engine's content module. A dead local address,
  // so nothing here can reach a real database whatever the shell holds.
  process.env.SUPABASE_URL = 'http://127.0.0.1:9'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'not-a-key'
})

import { notXYConstructions } from '../../apps/control-plane/api/_judges/deterministic.js'

// scripts/post-pack: one post's launch set sorted into its folder for Krish's
// asset library, and sent to the engine for his machine to write into Drive.
// Krish, 2026-10-06: "I want every single asset in there, permanent and for
// individual posts, categorized properly, clear what to use them for, and
// every new post gets its own new folder with all assets including the
// article HTML I can copy paste, video scripts, etc etc".

const ROOT = join(__dirname, '..', '..')
const PY = process.platform === 'win32' ? 'python' : 'python3'
// No test here may reach the engine: no key, and an address that cannot resolve.
const env: NodeJS.ProcessEnv = { ...process.env, ENGINE_BASE_URL: 'https://engine.invalid' }
delete env.ENGINE_OPERATOR_TOKEN
const work = mkdtempSync(join(tmpdir(), 'post-pack-test-'))
afterAll(() => rmSync(work, { recursive: true, force: true }))

function run(script: string, args: string[]) {
  return spawnSync(PY, [join(ROOT, 'scripts', 'post-pack', script), ...args], { encoding: 'utf8', env, cwd: work })
}

describe('the post pack tools check themselves', () => {
  it('build.py --self-test: the shared cases, the naming and a build', () => {
    const result = run('build.py', ['--self-test'])
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toMatch(/post-pack self-test passed: \d+ checks/)
  })

  it('story_check.py --self-test: the Higgsfield failures are refused, a good script passes', () => {
    const result = run('story_check.py', ['--self-test'])
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toMatch(/story check self-test passed: \d+ checks/)
  })

  it('send.py --self-test: planning and sending against a stand-in engine', () => {
    const result = run('send.py', ['--self-test'])
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toMatch(/send self-test passed: \d+ checks/)
  })

  it('recording.py --self-test: finding, waiting for and checking a recording against a stand-in', () => {
    const result = run('recording.py', ['--self-test'])
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toMatch(/recording self-test passed: \d+ checks/)
  })
})

describe('the recordings lane, from a cloud session', () => {
  // Krish, 2026-10-06, after a session told him it could not reach his file:
  // "figure out how to never make that error again".
  it('recording.py without a key says what to do, and fetches nothing', () => {
    const result = run('recording.py', ['get', 'take 1.mp4', '--out', join(work, 'recordings')])
    if (process.platform !== 'win32') {
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('Set ENGINE_OPERATOR_TOKEN')
    }
    expect(result.stdout).not.toContain('fetched')
  })

  it('its help and its refusals say which step failed, and never that a recording cannot be reached', () => {
    const source = readFileSync(join(ROOT, 'scripts', 'post-pack', 'recording.py'), 'utf8')
    expect(source).toContain('recordings-upload.log')
    expect(source).toContain('Never tell Krish a recording cannot be reached.')
    expect(source).not.toMatch(/[\u2013\u2014]/)
    expect(notXYConstructions(source)).toEqual([])
  })
})

describe('a pack Krish reads', () => {
  const post = {
    date: '2026-10-07', subchannel: 'under.the.hood', subject: 'Why Koa works',
    headline: 'Salesforce built a small model for one job. Should you?',
    links: { Substack: 'https://home.makeyourmindup.ai/p/why-koa-works' },
    files: [
      { kind: 'substack-copy', file: 'substack.html' },
      { kind: 'web-page', file: 'page.html' },
      { kind: 'fact-checked-text', file: 'body.md' },
      { kind: 'email-pictures-off', file: 'email-pictures-off.html' },
      { kind: 'cover', file: 'cover.png' },
      { kind: 'cover-crops', file: 'cover-crops.png' },
      { kind: 'phone-check', file: 'phone-images.png' },
      { kind: 'image', file: 'stack.png' },
      { kind: 'share-card', file: 'card.png' },
      { kind: 'video-script', file: 'script.md' },
      { kind: 'video', shape: 'tall', file: 'v-9x16.mp4' },
      { kind: 'video', shape: 'wide', file: 'v-16x9.mp4' },
      { kind: 'captions', file: 'captions.srt' },
      { kind: 'linkedin-post', text: 'One line for LinkedIn.' },
      { kind: 'linkedin-card', file: 'card.png' },
    ],
  }

  it('says what every file is for in plain words, with no long dashes and no "Not X, Y"', () => {
    for (const name of ['substack.html', 'page.html', 'body.md', 'email-pictures-off.html', 'cover.png', 'cover-crops.png',
      'phone-images.png', 'stack.png', 'card.png', 'script.md', 'v-9x16.mp4', 'v-16x9.mp4', 'captions.srt']) {
      writeFileSync(join(work, name), name)
    }
    // A script must pass the story check to be packed (walk log F75).
    writeFileSync(join(work, 'script.md'), '[To camera]\nWhy does this matter? Say this.\n')
    writeFileSync(join(work, 'post.json'), JSON.stringify(post))
    const out = join(work, 'packs')
    mkdirSync(out)
    const result = run('build.py', ['post.json', '--out', out])
    expect(result.status, result.stderr).toBe(0)
    const folder = '2026-10-07 Wed under.the.hood - Why Koa works'
    const readme = readFileSync(join(out, folder, 'READ ME.txt'), 'utf8')
    expect(readme.startsWith('Why Koa works\nunder.the.hood, Wednesday 7 October 2026\n')).toBe(true)
    for (const section of ['1 Article', '2 Covers and images', '3 Video', '4 Social']) expect(readme).toContain(`\n${section}\n`)
    expect(readme).toContain('- Why Koa works - tall 9x16 - Shorts, Reels, LinkedIn.mp4')
    expect(readme).toContain('- Why Koa works - wide 16x9 - YouTube, Substack.mp4')
    expect(readme).not.toMatch(/[\u2013\u2014]/)
    expect(notXYConstructions(readme)).toEqual([])
    const manifest = JSON.parse(readFileSync(join(out, folder, '.pack.json'), 'utf8')) as { library_prefix: string; files: Array<{ path: string; purpose: string }> }
    expect(manifest.library_prefix).toBe(`3 Posts/${folder}`)
    expect(manifest.files).toHaveLength(16)
    for (const item of manifest.files) {
      expect(item.purpose.length).toBeGreaterThan(10)
      expect(item.purpose.length).toBeLessThanOrEqual(200)
      expect(notXYConstructions(item.purpose)).toEqual([])
    }

    const dry = run('send.py', [join(out, folder), '--dry-run'])
    expect(dry.status, dry.stderr).toBe(0)
    expect(dry.stdout).toContain(`3 Posts/${folder}/1 Article/substack-copy.html`)
    expect(dry.stdout).toContain('16 files would be sent. Nothing was sent.')
  })

  it('send.py without a key says what to do, and sends nothing', () => {
    const result = run('send.py', [join(work, 'packs', '2026-10-07 Wed under.the.hood - Why Koa works')])
    if (process.platform !== 'win32') {
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('Set ENGINE_OPERATOR_TOKEN')
    }
    expect(result.stdout).not.toContain('sent ')
  })
})
