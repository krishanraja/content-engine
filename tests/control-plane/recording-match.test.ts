import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { alignScriptToTranscript } from '@mindmake/core'

// scripts/post-pack/recording_match.py: which of Krish's new recordings is
// which piece's long or short cut, from the words he says at the start.
// Krish, 2026-10-12: "it will need to know which one it is (ideally
// automatiically without me having to give the exact filename)".
// scripts/post-pack/making.py: every write says who wrote it, and a video
// carries its thumbnail and its music. Each script's words are hashed, and
// each take carries the hash of the script it was taken from, so a take of
// words that changed since stops counting (the recordings lane, stage 1a).
// scripts/post-pack/recording.py: a take already recorded on a piece is
// fetched by the path its making record holds.

const ROOT = join(__dirname, '..', '..')
const PY = process.platform === 'win32' ? 'python' : 'python3'
// Nothing here may reach the engine: no key, and an address that cannot resolve.
const env: NodeJS.ProcessEnv = { ...process.env, ENGINE_BASE_URL: 'https://engine.invalid', PYTHONIOENCODING: 'utf-8' }
delete env.ENGINE_OPERATOR_TOKEN
delete env.CLAUDE_CODE_REMOTE
delete env.MAKING_BY
// Codex sets CODEX_* variables, and making.py credits Codex when it sees one.
for (const name of Object.keys(env)) if (name.startsWith('CODEX')) delete env[name]
const work = mkdtempSync(join(tmpdir(), 'recording-match-test-'))
afterAll(() => rmSync(work, { recursive: true, force: true }))

function run(script: string, args: string[]) {
  return spawnSync(PY, [join(ROOT, 'scripts', 'post-pack', script), ...args], { encoding: 'utf8', env, cwd: work })
}

describe('recording_match.py and making.py check themselves', () => {
  it('recording_match.py --self-test: the words, the time rule, the cut by words or length, unsure is said, --record writes by name', () => {
    const result = run('recording_match.py', ['--self-test'])
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toMatch(/recording match self-test passed: \d+ checks/)
  }, 120_000)

  it('making.py --self-test: --by on every write (Codex inside Codex), the script hashes, checked_at kept while the words are, a take stamped with its script, the thumbnail proven drawn, a 409 retried once', () => {
    const result = run('making.py', ['--self-test'])
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toMatch(/making self-test passed: \d+ checks/)
  }, 120_000)

  it('recording.py --self-test: find by name, wait, check every download, and fetch a recorded take by its sha256', () => {
    const result = run('recording.py', ['--self-test'])
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toMatch(/recording self-test passed: \d+ checks/)
  }, 120_000)
})

describe('the script hash is the same on every machine', () => {
  it('making.script_hash ignores line endings, trailing spaces, blank edges and accent forms, and is the file\'s sha256 for a script already in shape', () => {
    const code = [
      'import hashlib, json, sys, unicodedata',
      `sys.path.insert(0, ${JSON.stringify(join(ROOT, 'scripts', 'post-pack'))})`,
      `sys.path.insert(0, ${JSON.stringify(join(ROOT, 'scripts'))})`,
      'import making as m',
      'text = "Warner sued Suno.\\nCaf\\u00e9 owners ask who gets paid.\\n"',
      'variants = [text.replace("\\n", "\\r\\n"), "\\n\\n" + text.replace("\\n", "   \\n") + "\\n", unicodedata.normalize("NFD", text)]',
      'print(json.dumps({"plain": m.script_hash(text), "bytes": hashlib.sha256(text.encode()).hexdigest(), "variants": [m.script_hash(v) for v in variants]}))',
    ].join('\n')
    const result = spawnSync(PY, ['-c', code], { encoding: 'utf8', env, cwd: work })
    expect(result.status, result.stderr).toBe(0)
    const out = JSON.parse(result.stdout) as { plain: string; bytes: string; variants: string[] }
    expect(out.plain).toMatch(/^[a-f0-9]{64}$/)
    expect(out.plain).toBe(out.bytes)
    expect(out.variants).toEqual([out.plain, out.plain, out.plain])
  })
})

describe('the ordered word match is the Studio\'s own', () => {
  // alignScriptToTranscript (packages/core/src/candidates.ts) returns
  // orderedSimilarity for a one-segment transcript, so the Python port must
  // give the same number for the same words.
  const pairs: Array<[string, string]> = [
    ['Warner, Universal and Sony all sued Suno, the AI app that writes and sings you a song.', 'Okay so Warner, Universal and Sony all sued Suno, the AI app that writes and sings you a song.'],
    ["Claude Code now lets you pick from more versions of Claude than there are days in the week.", "Claude code now lets you pick more versions of Claude than there are days in a week, honestly."],
    ['You pay Suno. Since 9 September, Warner, BMG and Believe get "a portion" of Suno\'s revenue.', 'You pay Suno to download your song. Since 9 September Warner BMG and Believe get a portion of the revenue.'],
    ['one two three four five six seven eight nine ten', 'one three two four five six eight seven nine ten eleven'],
  ]

  it('gives the same similarity as orderedSimilarity, to ten places', () => {
    const code = [
      'import json, sys',
      `sys.path.insert(0, ${JSON.stringify(join(ROOT, 'scripts', 'post-pack'))})`,
      'import recording_match as r',
      'pairs = json.loads(sys.stdin.read())',
      'print(json.dumps([r.ordered_similarity(r.words(a), r.words(b)) for a, b in pairs]))',
    ].join('\n')
    const result = spawnSync(PY, ['-c', code], { encoding: 'utf8', env, cwd: work, input: JSON.stringify(pairs) })
    expect(result.status, result.stderr).toBe(0)
    const python = JSON.parse(result.stdout) as number[]
    pairs.forEach(([script, heard], index) => {
      const ts = alignScriptToTranscript(script, { language: 'en', source: 'manual', segments: [{ start_ms: 0, end_ms: 10_000, text: heard }] }).similarity
      expect(python[index]).toBeCloseTo(ts, 10)
    })
  })
})

describe('recording_match.py fails plainly, never with a traceback', () => {
  it('an Inbox that is not there says where it should be, and exits 1', () => {
    const result = run('recording_match.py', ['--inbox', join(work, 'no such inbox')])
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/^recording_match: the Inbox is not at /)
    expect(result.stderr).not.toMatch(/Traceback/)
  })

  it('with no engine key it says so, exits 1, and has written nothing', () => {
    const result = run('recording_match.py', ['--inbox', work, '--record', '--by', 'Codex'])
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/^recording_match: .*engine key/)
    expect(result.stderr).not.toMatch(/Traceback/)
  })

  it('a writer name over 60 characters is refused before anything is read', () => {
    const result = run('recording_match.py', ['--inbox', work, '--by', 'x'.repeat(61)])
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/60 characters/)
  })

  it('--board is offered, and with no engine key it says so and asks nothing', () => {
    expect(run('recording_match.py', ['--help']).stdout).toMatch(/--board/)
    const result = run('recording_match.py', ['--inbox', work, '--record', '--board', '--by', 'Recordings lane', '--json'])
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/^recording_match: .*engine key/)
    expect(result.stderr).not.toMatch(/Traceback/)
  })
})

describe('making.py and recording.py refuse plainly before any call', () => {
  it('a thumbnail that was never drawn cannot be recorded', () => {
    const result = run('making.py', ['904658db-4df2-4537-a0ed-ebe93e081db7', 'video', 'short', 'Shorts video', '3 Video/short.mp4', '--thumb', '3 Video/tall.jpg'])
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/never drawn/)
    const missing = run('making.py', ['904658db-4df2-4537-a0ed-ebe93e081db7', 'video', 'short', 'Shorts video', '3 Video/short.mp4', '--thumb', '3 Video/tall.jpg', '--thumb-file', join(work, 'no such.jpg')])
    expect(missing.status).toBe(1)
    expect(missing.stderr).toMatch(/no drawn thumbnail/)
  })

  it('recording.py get --sha256 takes only a sha256, in place of a name', () => {
    const bad = run('recording.py', ['get', '--sha256', 'abc'])
    expect(bad.status).toBe(2)
    expect(bad.stderr).toMatch(/64 hex characters/)
    const both = run('recording.py', ['get', 'take.mp4', '--sha256', 'a'.repeat(64)])
    expect(both.status).toBe(2)
    expect(both.stderr).toMatch(/in place of a name/)
  })
})

// Monday's takes of 12 October scored 0.40 and 0.42 on a home computer: it
// heard them against the morning's scripts (its own checkout and the pack in
// Drive), while Krish had read the afternoon's words in teleprompter.com,
// which names each file after the script's title.
describe('a take is heard against the words its piece\'s record says are current, and named by its Teleprompter title', () => {
  const py = (code: string) => {
    const out = spawnSync(PY, ['-c', code], { encoding: 'utf8', env, cwd: join(ROOT, 'scripts', 'post-pack') })
    expect(out.status, out.stderr).toBe(0)
    return JSON.parse(out.stdout)
  }

  it('the copy whose words hash to the record\'s is used, over a stale copy found first', () => {
    const found = py(`
import json, tempfile, making, recording_match as rm
from pathlib import Path
with tempfile.TemporaryDirectory() as tmp:
    plans = Path(tmp) / 'plans'
    (plans / '2026-10-12-monday').mkdir(parents=True)
    (plans / '2026-10-12-monday' / 'post.json').write_text(json.dumps({'piece_id': 'f328382d-71b3-41a7-a221-d8615826f12e', 'files': [{'kind': 'video-script', 'file': 'script.md', 'cut': 'long'}]}))
    (plans / '2026-10-12-monday' / 'script.md').write_text('The morning words.\\n')
    (plans / '2026-10-12-draft-script.md').write_text('The afternoon words Krish read.\\n')
    piece = {'id': 'f328382d-71b3-41a7-a221-d8615826f12e', 'hashes': {'long': making.script_hash('The afternoon words Krish read.\\n')}}
    got = rm.scripts_for(piece, plans, [], show=None)['long']
    print(json.dumps([got['text'].strip(), got['current']]))`)
    expect(found).toEqual(['The afternoon words Krish read.', true])
  })

  it('a file named after a cut\'s Teleprompter script on a waiting piece is that piece and cut', () => {
    const named = py(`
import json, recording_match as rm
pieces = [{'id': 'f328382d-71b3-41a7-a221-d8615826f12e', 'titles': {'long': 'Mon 12 Oct - 3-minute - Who gets paid for AI songs', 'short': 'Mon 12 Oct - 90-second - Who gets paid for AI songs'}},
          {'id': '904658db-4df2-4537-a0ed-ebe93e081db7', 'titles': {'long': 'Fri 16 Oct - 3-minute - Why so many AIs'}}]
hits = [rm.titled(n, pieces) for n in ('Mon 12 Oct - 3-minute - Who gets paid for AI songs.mp4', 'Fri 16 Oct - 3-minute - Why so many AIs (2).mov', 'take.mp4')]
print(json.dumps([[h[0]['id'][:8], h[1]] if h else None for h in hits]))`)
    expect(named).toEqual([['f328382d', 'long'], ['904658db', 'long'], null])
  })
})
