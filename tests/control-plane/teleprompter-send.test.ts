import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { makingSteps, mergeMaking, parseMakingPatch } from '../../apps/control-plane/api/_making.js'

// scripts/post-pack/teleprompter_send.py: each script Krish approved into his
// teleprompter.com account, one folder per piece and one script per cut, and
// the record of where it went. Krish, 2026-10-12: "Also note that Descript is
// permanently gone, teleprompter.com is permanently in, connected via MCP
// here", on these terms: "One script per cut, in a folder per piece (e.g.
// "Mon 12 Oct follow.the.money"). When the words change, the same script is
// updated in place. Nothing is ever deleted." Krish, 2026-10-28: "Once I
// approve, the two scripts will go to teleprompter", replacing his standing
// "Yes, automatic, Monday now". Nothing here reaches Teleprompter or the
// engine.

const ROOT = join(__dirname, '..', '..')
const PY = process.platform === 'win32' ? 'python' : 'python3'
const env: NodeJS.ProcessEnv = { ...process.env, ENGINE_BASE_URL: 'https://engine.invalid', PYTHONIOENCODING: 'utf-8' }
delete env.ENGINE_OPERATOR_TOKEN
const work = mkdtempSync(join(tmpdir(), 'teleprompter-send-test-'))
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
const FOLDER = '86B6F74B-2F8A-4477-AE44-8DA1119D1CD9'
const LONG = '45F414D8-31E1-4B2D-BBE4-44EBA042B346'
const SHORT = 'ED3DE98A-7158-4448-A622-A2A5115FFA83'
const NAME = 'Mon 12 Oct follow.the.money - Who gets paid for AI songs'
const SHA = 'a'.repeat(64)

describe('teleprompter_send.py checks itself', () => {
  it('--self-test: his words, the tools allowed, the names, the words sent, no call for words already there, an update in place, every refusal', () => {
    const result = run('teleprompter_send.py', ['--self-test'])
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toMatch(/teleprompter self-test passed: \d+ checks/)
  }, 60_000)
})

describe('config/teleprompter.json holds Krish\'s rulings, verbatim', () => {
  const cfg = JSON.parse(readFileSync(join(ROOT, 'config', 'teleprompter.json'), 'utf8'))
  it('his words and his terms', () => {
    expect(cfg.status).toBe('confirmed')
    expect(cfg.said.switch.words).toBe('Also note that Descript is permanently gone, teleprompter.com is permanently in, connected via MCP here')
    expect(cfg.said.send).toMatchObject({ on: '2026-10-28', words: 'Once I approve, the two scripts will go to teleprompter' })
    expect(cfg.said.route).toEqual({ on: '2026-10-28', words: 'Server sends directly' })
    expect(cfg.said.terms.words).toBe('One script per cut, in a folder per piece (e.g. "Mon 12 Oct follow.the.money"). When the words change, the same script is updated in place. Nothing is ever deleted.')
  })
  it('the standing yes of 12 October is superseded, kept only as the record of what he said then', () => {
    expect(cfg.superseded.send.asked).toBe('May every checked script go into your teleprompter.com account automatically, starting with Monday\'s two now?')
    expect(cfg.superseded.send.picked).toBe('Yes, automatic, Monday now')
    expect(JSON.stringify(cfg.said)).not.toContain('Yes, automatic')
  })
  it('his approval is read from the board, written by him alone; the server\'s key is named and never held', () => {
    expect(cfg.approval).toMatchObject({ collection: 'approvals', writer: 'Krish' })
    expect(cfg.server).toMatchObject({ secret: 'TELEPROMPTER_API_KEY', url: 'https://app.teleprompter.com/mcp', url_env: 'TELEPROMPTER_MCP_URL' })
    expect(JSON.stringify(cfg)).not.toMatch(/ttp_[A-Za-z0-9]/)
  })
  it('only the tools his terms need: no delete, no move, no rename; an update sends text and duration only', () => {
    expect([...cfg.allowed_tools].sort()).toEqual(['create_folder', 'create_script', 'get_folder', 'get_script', 'list_folders', 'list_scripts', 'list_scripts_in_folder', 'update_script'])
    expect([...cfg.update_fields].sort()).toEqual(['duration', 'text'])
    expect(cfg.create_fields).not.toContain('fontSize')
    expect(cfg.folder_examples).toEqual([NAME, 'Fri 16 Oct mind.the.gap - Why so many AIs'])
    expect(cfg.title_examples).toEqual(['Mon 12 Oct - 5-minute - Who gets paid for AI songs', 'Fri 16 Oct - 90-second - Why so many AIs'])
    expect(cfg.words_per_minute).toBe(150)
  })
})

describe('what Python records is what the engine takes', () => {
  const sent = python(`
import json, making
print(json.dumps(making.teleprompter_patch('long', '${FOLDER}', '${LONG}', '${SHA}', folder_name='${NAME}', sent_at='2026-10-12T15:34:07Z', by='Claude Code')))`)
  const failed = python(`
import json, making
prev = making.teleprompter_patch('long', '${FOLDER}', '${LONG}', '${SHA}', folder_name='${NAME}', sent_at='2026-10-12T15:34:07Z', by='Claude Code')['teleprompter']['cuts']['long']
print(json.dumps([making.teleprompter_patch('long', error='HTTP 503', previous=prev, held_folder='${FOLDER}', by='Codex'),
                  making.teleprompter_patch('short', '${FOLDER}', error='HTTP 500 on create_script', by='Claude Code'),
                  making.teleprompter_patch('short', error='HTTP 500 on create_folder', by='Claude Code')]))`)

  it('a cut sent: every part accepted as written, its title made from the folder\'s name', () => {
    const { patch, problems } = parseMakingPatch({ ...sent, by: 'Claude Code' }, '2026-10-12T16:00:00Z')
    expect(problems).toEqual([])
    expect(patch.teleprompter).toEqual(sent.teleprompter)
    expect(patch.teleprompter!.cuts.long!.title).toBe('Mon 12 Oct - 5-minute - Who gets paid for AI songs')
  })

  it('a failed send, on its script, in its folder, or alone: accepted as written', () => {
    for (const p of failed) {
      const { patch, problems } = parseMakingPatch({ ...p, by: 'Codex' }, '2026-10-12T16:00:00Z')
      expect(problems).toEqual([])
      expect(patch.teleprompter).toEqual(p.teleprompter)
    }
  })

  it('making.py teleprompter_state and the engine agree on every state', () => {
    const check = { passed: true, checked_at: 'x', problems: [], cuts: ['long', 'short'], hashes: { long: SHA, short: 'b'.repeat(64) } }
    const record = mergeMaking(mergeMaking(null, { script_check: check as any, teleprompter: sent.teleprompter }, 'Claude Code', '2026-10-12T16:00:00Z'),
      { teleprompter: failed[1].teleprompter }, 'Claude Code', '2026-10-12T16:01:00Z')
    const fromPython = python(`
import json, making
record = json.loads(${JSON.stringify(JSON.stringify(record))})
print(json.dumps([making.teleprompter_state(record, c)[0] for c in making.CUTS]))`)
    expect(fromPython).toEqual(['in', 'failed'])
    const scripts = makingSteps({ state: 'review', meta: { making: record } }).find(s => s.key === 'scripts')!
    expect(scripts).toMatchObject({ state: 'done', note: 'long and short; the Teleprompter send failed for the short cut' })
  })

  it('a read-back written by making.py read-back is taken as written', () => {
    const passed = { script_check: { passed: true, checked_at: '2026-10-12T15:50:00Z', problems: [], cuts: ['long', 'short'], hashes: { long: SHA, short: 'b'.repeat(64) }, changed_at: { long: '2026-10-12T15:50:00Z', short: '2026-10-12T15:50:00Z' } } }
    const patch = python(`
import json, making
print(json.dumps(making.read_back_patch(json.loads(${JSON.stringify(JSON.stringify(passed))}), 'long', ['reader A, a fresh subagent', 'reader B, a fresh subagent'], '2026-10-12T15:55:00Z', 'Claude Code')))`)
    const { patch: parsed, problems } = parseMakingPatch({ ...patch, by: 'Claude Code' }, '2026-10-12T16:00:00Z')
    expect(problems).toEqual([])
    expect(parsed.script_check).toEqual(patch.script_check)
  })
})

describe('the command line refuses before anything is written', () => {
  it('record: an id that is not an uppercase UUID is refused, and nothing is sent', () => {
    const out = run('teleprompter_send.py', ['record', PIECE, 'long', '--folder', 'my folder', '--script', LONG, '--sha', SHA])
    expect(out.status).toBe(1)
    expect(out.stderr).toMatch(/--folder is a Teleprompter id, an uppercase UUID/)
    expect(out.stderr).not.toMatch(/engine\.invalid|could not reach/i)
  })

  it('making.py teleprompter: a script given with an error is refused', () => {
    const out = run('making.py', [PIECE, 'teleprompter', 'short', '--folder', FOLDER, '--script', SHORT, '--error', 'HTTP 500'])
    expect(out.status).toBe(1)
    expect(out.stderr).toMatch(/a script that was made is a send that worked/)
    expect(out.stderr).not.toMatch(/engine\.invalid|could not reach/i)
  })

  it('plan: scripts Krish has not approved on the board, word for word, are refused, and nothing is planned', () => {
    const refusals = python(`
import json, tempfile, making, teleprompter_send as ts
from pathlib import Path
cfg = ts.load_config()
pid = '${PIECE}'
out = {}
with tempfile.TemporaryDirectory() as tmp:
    t = Path(tmp)
    (t / 'post.json').write_text(json.dumps({'piece_id': pid, 'date': '2026-11-02', 'subchannel': 'follow_the_money', 'subject': 'Who gets paid for AI songs'}))
    words = {'long': 'The long script.\\n', 'short': 'The short script.\\n'}
    for cut, text in words.items():
        (t / f'{cut}.md').write_text(text)
    sha = {cut: making.script_hash(text) for cut, text in words.items()}
    read = {cut: {'script_sha256': s, 'at': 'x', 'by': 'C', 'readers': ['A', 'B'], 'found': 'nothing lost'} for cut, s in sha.items()}
    record = {'script_check': {'passed': True, 'checked_at': 'x', 'problems': [], 'hashes': sha, 'read_back': read}}
    def board(docs):
        def call(method, path, body):
            if path.startswith('/api/board/'):
                return 200, json.dumps({'ok': True, 'documents': docs, 'next_offset': None})
            return 200, json.dumps({'ok': True, 'making': record, 'steps': []})
        return call
    his = lambda scripts, by='Krish': {'id': 'mon-scripts', 'body': {'piece_id': pid, 'scripts': scripts}, 'updated_at': '2026-11-01T12:30:00Z', 'updated_by': by}
    for name, docs in (('none', []), ('session', [his(sha, 'engine_operator')]), ('other words', [his({**sha, 'short': 'c' * 64})]), ('approved', [his(sha)])):
        try:
            p = ts.plan(pid, [t / 'long.md', t / 'short.md'], board(docs), cfg, post_path=t / 'post.json', workbench=t / 'WORKBENCH.md')
            out[name] = 'planned: ' + ', '.join(c['action'] for c in p['cuts'])
        except ts.TeleprompterError as error:
            out[name] = str(error)
print(json.dumps(out))`)
    expect(refusals.none).toMatch(/^nothing goes to Teleprompter until Krish approves those exact words .*the 5-minute script has no approval from him/)
    expect(refusals.session).toMatch(/written by someone else and do not count/)
    expect(refusals['other words']).toMatch(/he approved other words for the 90-second script/)
    expect(refusals.approved).toBe('planned: create, create')
  })

  it('plan: a piece id that is not a uuid is refused', () => {
    const out = run('teleprompter_send.py', ['plan', 'monday', 'long.md', 'short.md'])
    expect(out.status).toBe(1)
    expect(out.stderr).toMatch(/the piece id is the content_ideas uuid/)
  })
})
