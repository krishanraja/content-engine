import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { makingSteps, mergeMaking, parseMakingPatch } from '../../apps/control-plane/api/_making.js'

// scripts/post-pack/descript_send.py: each checked script into Krish's
// Descript drive, one view-access project per cut with a Script and a Record
// here composition, and the record of where it went. Krish, 2026-10-12:
// "Descript is now my tool of choice for video script readouts on my phone -
// scripts should automatically be sent there, with the ability for Descript
// to put the video in the correct place when recorded." Nothing here reaches
// Descript or the engine.

const ROOT = join(__dirname, '..', '..')
const PY = process.platform === 'win32' ? 'python' : 'python3'
const env: NodeJS.ProcessEnv = { ...process.env, ENGINE_BASE_URL: 'https://engine.invalid' }
delete env.ENGINE_OPERATOR_TOKEN
const work = mkdtempSync(join(tmpdir(), 'descript-send-test-'))
afterAll(() => rmSync(work, { recursive: true, force: true }))

function run(script: string, args: string[]) {
  return spawnSync(PY, [join(ROOT, 'scripts', 'post-pack', script), ...args], { encoding: 'utf8', env, cwd: work })
}
function python(code: string) {
  const out = spawnSync(PY, ['-c', code], { encoding: 'utf8', env, cwd: join(ROOT, 'scripts', 'post-pack') })
  if (out.status !== 0) throw new Error(out.stderr)
  return JSON.parse(out.stdout)
}

const PIECE = 'f328382d-71b3-41a7-a221-d8615826f12e'
const DRIVE = 'd8b77ba9-0c95-4b7b-8964-2f5b888c0b78'
const PROJECT = '16aa1f87-c054-4115-a11c-4342def815e5'
const SCRIPT = '46c2a75a-615d-4ab5-bdc4-c84b57a88454'
const RECORD = 'f6eb149a-82e8-4604-836e-b78ea7c73797'
const SHA = '3e329b90efcc3a4198b58641576eb9dc9f1f34deb095341a4d3ce596f908383b'

describe('descript_send.py checks itself', () => {
  it('--self-test: his words and his drive, exact pages, unique names, no call for words Descript holds, a re-send into its own project, every refusal', () => {
    const result = run('descript_send.py', ['--self-test'])
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toMatch(/descript self-test passed: \d+ checks/)
  }, 60_000)
})

describe('config/descript.json holds Krish\'s yes, verbatim', () => {
  const cfg = JSON.parse(readFileSync(join(ROOT, 'config', 'descript.json'), 'utf8'))
  it('confirmed, on his drive, view access, in Mindmake scripts, 150 words a minute', () => {
    expect(cfg).toMatchObject({ status: 'confirmed', drive_id: DRIVE, drive_name: "Krish Raja's Drive", folder_root: 'Mindmake scripts', team_access: 'view', words_per_minute: 150 })
    expect(cfg.page).toMatchObject({ width: 1080, height: 1920 })
    expect(cfg.record_here).toMatchObject({ width: 1920, height: 1080, seconds: 1 })
  })
  it('his words on the send, the takes and the teleprompter', () => {
    expect(cfg.said.tool.words).toBe('Descript is now my tool of choice for video script readouts on my phone - scripts should automatically be sent there, with the ability for Descript to put the video in the correct place when recorded.')
    expect(cfg.said.records_in.words).toBe('I can use the descript web app, otherwise my laptop to record')
    expect([cfg.said.send.words, cfg.said.send.then, cfg.said.takes.words, cfg.said.teleprompter.words]).toEqual(['3. yes', 'go, upload', '1. yes', '2 fine, no issue with copy paste'])
    expect(cfg.send_calls).not.toContain('prompt_project_agent')
    expect(cfg.send_calls).not.toContain('publish_project')
  })
})

describe('what Python records is what the engine takes', () => {
  const sent = python(`
import json, making
print(json.dumps(making.descript_patch('long', '${DRIVE}', '${PROJECT}', '${SCRIPT}', '${RECORD}', media='Script 2026-10-12 3e329b9.mp4',
      known_media=['Record here 3-minute.mp4', 'Script 2026-10-12 3e329b9.mp4'], sha='${SHA}', sent_at='2026-10-12T10:31:16Z', by='Claude Code')))`)
  const failed = python(`
import json, making
prev = making.descript_patch('long', '${DRIVE}', '${PROJECT}', '${SCRIPT}', '${RECORD}', media='m.mp4', known_media=['m.mp4'], sha='${SHA}',
                             sent_at='2026-10-12T10:31:16Z', by='Claude Code')['descript']['cuts']['long']
print(json.dumps([making.descript_patch('long', '${DRIVE}', error='HTTP 503', previous=prev, by='Codex'),
                  making.descript_patch('short', '${DRIVE}', error='HTTP 402: media minutes used up', by='Claude Code')]))`)

  it('a cut sent: every part accepted as written', () => {
    const { patch, problems } = parseMakingPatch({ ...sent, by: 'Claude Code' }, '2026-10-12T13:00:00Z')
    expect(problems).toEqual([])
    expect(patch.descript).toEqual(sent.descript)
    expect(patch.descript!.cuts.long!.script_link).toBe(`https://web.descript.com/${PROJECT}/46c2a`)
  })

  it('a failed send, with its project kept or alone: accepted as written', () => {
    for (const p of failed) {
      const { patch, problems } = parseMakingPatch({ ...p, by: 'Codex' }, '2026-10-12T13:00:00Z')
      expect(problems).toEqual([])
      expect(patch.descript).toEqual(p.descript)
    }
  })

  it('making.py descript_state and the engine agree on every state', () => {
    const check = { passed: true, checked_at: 'x', problems: [], cuts: ['long', 'short'], hashes: { long: SHA, short: 'b'.repeat(64) } }
    const record = mergeMaking(mergeMaking(null, { script_check: check as any, descript: sent.descript }, 'Claude Code', '2026-10-12T13:00:00Z'),
      { descript: failed[1].descript }, 'Claude Code', '2026-10-12T13:01:00Z')
    const fromPython = python(`
import json, making
record = json.loads(${JSON.stringify(JSON.stringify(record))})
print(json.dumps([making.descript_state(record, c)[0] for c in making.CUTS]))`)
    expect(fromPython).toEqual(['in', 'failed'])
    const scripts = makingSteps({ state: 'review', meta: { making: record } }).find(s => s.key === 'scripts')!
    expect(scripts).toMatchObject({ state: 'done', note: 'long and short; the Descript send failed for the short cut' })
  })
})

describe('the command line refuses before any call', () => {
  it('record: a drive other than Krish\'s is refused, and nothing is sent', () => {
    const out = run('descript_send.py', ['record', PIECE, 'long', '--drive', '00000000-0000-4000-8000-000000000000', '--project', PROJECT,
      '--script-composition', SCRIPT, '--record-composition', RECORD, '--media', 'm.mp4', '--known-media', 'm.mp4', '--sha', SHA])
    expect(out.status).toBe(1)
    expect(out.stderr).toMatch(/is not Krish's \(Krish Raja's Drive, d8b77ba9-0c95-4b7b-8964-2f5b888c0b78\): nothing is sent or recorded/)
    expect(out.stderr).not.toMatch(/engine\.invalid|could not reach/i)
  })

  it('making.py descript: a link to the wrong composition is refused, and nothing is sent', () => {
    const out = run('making.py', [PIECE, 'descript', 'long', '--drive', DRIVE, '--project', PROJECT, '--script-composition', SCRIPT,
      '--record-composition', RECORD, '--links', `https://web.descript.com/${PROJECT}/f6eb1`, `https://web.descript.com/${PROJECT}/f6eb1`,
      '--media', 'm.mp4', '--known-media', 'm.mp4', '--sha', SHA])
    expect(out.status).toBe(1)
    expect(out.stderr).toMatch(/the Script link opens composition f6eb1, not the Script composition/)
  })

  it('plan: a piece id that is not a uuid is refused', () => {
    const out = run('descript_send.py', ['plan', 'monday', 'post.json', 'long.md', 'short.md'])
    expect(out.status).toBe(1)
    expect(out.stderr).toMatch(/the piece id is the content_ideas uuid/)
  })
})
