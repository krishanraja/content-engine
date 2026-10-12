import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { parseMakingPatch } from '../../apps/control-plane/api/_making.js'

// scripts/post-pack/descript_take.py: a take Krish recorded in a Descript
// "Record here" timeline, back to its piece and cut. Krish, 2026-10-12:
// "Descript is now my tool of choice for video script readouts on my phone -
// scripts should automatically be sent there, with the ability for Descript
// to put the video in the correct place when recorded." He records there: "I
// can use the descript web app, otherwise my laptop to record". His yes to
// the private copy it needs: "1. yes". Nothing here reaches Descript, the
// engine or the board.

const ROOT = join(__dirname, '..', '..')
const PY = process.platform === 'win32' ? 'python' : 'python3'
const env: NodeJS.ProcessEnv = { ...process.env, ENGINE_BASE_URL: 'https://engine.invalid' }
delete env.ENGINE_OPERATOR_TOKEN
const work = mkdtempSync(join(tmpdir(), 'descript-take-test-'))
afterAll(() => rmSync(work, { recursive: true, force: true }))

const read = (path: string) => readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/g, '\n')
function run(args: string[]) {
  return spawnSync(PY, [join(ROOT, 'scripts', 'post-pack', 'descript_take.py'), ...args], { encoding: 'utf8', env, cwd: work })
}
function python(code: string) {
  const out = spawnSync(PY, ['-c', code], { encoding: 'utf8', env, cwd: join(ROOT, 'scripts', 'post-pack') })
  if (out.status !== 0) throw new Error(out.stderr)
  return JSON.parse(out.stdout)
}

const PIECE = 'f328382d-71b3-41a7-a221-d8615826f12e'

describe('descript_take.py checks itself', () => {
  it('--self-test: what the timeline holds, go or ask from the words, an exact trim of the slate on a stand-in copy, its hash, the lines that follow', () => {
    const result = run(['--self-test'])
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toMatch(/descript take self-test passed: \d+ checks/)
  }, 120_000)
})

describe('it decides as the matcher does, and copies only privately', () => {
  it('the same bar as recording_match (0.72, and 0.15 clear of the other cut), and a private 1080p video copy', () => {
    const got = python(`
import json, descript_take, recording_match
print(json.dumps([descript_take.SURE, recording_match.SURE, descript_take.MARGIN, recording_match.MARGIN, descript_take.PUBLISH]))`)
    expect(got).toEqual([0.72, 0.72, 0.15, 0.15, { media_type: 'Video', resolution: '1080p', access_level: 'private' }])
  })

  it('his yes to the private copy is in config/descript.json, verbatim', () => {
    const cfg = JSON.parse(read('config/descript.json'))
    expect(cfg.said.takes.words).toBe('1. yes')
    expect(cfg.said.takes.asked).toBe('a standing yes for the video skill to make a private copy, never public, of each take recorded in a Record here timeline, so it can download it')
  })
})

describe('what it prints for the record is what the engine takes', () => {
  // The lines fetch prints, run through making.py's own command line against a stand-in engine.
  const posted = python(`
import json, shlex, descript_take, making
drive = 'd8b77ba9-0c95-4b7b-8964-2f5b888c0b78'
project = '16aa1f87-c054-4115-a11c-4342def815e5'
entry = {'project_id': project, 'script_composition': '46c2a75a-615d-4ab5-bdc4-c84b57a88454', 'record_composition': 'f6eb149a-82e8-4604-836e-b78ea7c73797',
         'script_link': f'https://web.descript.com/{project}/46c2a', 'record_link': f'https://web.descript.com/{project}/f6eb1',
         'script_sha256': '3e329b90efcc3a4198b58641576eb9dc9f1f34deb095341a4d3ce596f908383b', 'media': 'Script 2026-10-12 3e329b9.mp4',
         'known_media': ['Script 2026-10-12 3e329b9.mp4', 'Record here 3-minute slate.mp4'], 'sent_at': '2026-10-12T10:31:16Z', 'by': 'Claude Code'}
record = {'script_check': {'passed': True, 'hashes': {'long': entry['script_sha256'], 'short': 'b' * 64}, 'checked_at': '2026-10-12T09:00:00Z'},
          'descript': {'drive_id': drive, 'cuts': {'long': entry}}, 'recordings': []}
project_answer = {'id': project, 'drive_id': drive, 'compositions': [], 'publishes': [],
                  'media_files': {'Script 2026-10-12 3e329b9.mp4': {'type': 'video'}, 'Record here 3-minute slate.mp4': {'type': 'video'},
                                  "Krish Raja's camera.mp4": {'type': 'video', 'duration': 185.4}}}
report = {'piece_id': '${PIECE}', 'cut': 'long', 'path': 'recordings/' + 'a' * 64 + '.mp4', 'seconds': 185.4}
lines = [descript_take.recorded_line(report, 'Codex'), descript_take.known_line('${PIECE}', 'long', record, project_answer, 'Codex')]
bodies = []
def call(method, path, body):
    if method == 'POST':
        bodies.append(body)
        return 200, json.dumps({'ok': True, 'making': {}, 'steps': []})
    if path == making.RECORDINGS_LIST:
        # The store holds the take once the single-file send has put it in.
        return 200, json.dumps({'ok': True, 'recordings': [{'sha256': 'a' * 64, 'name': 'Descript long take 2026-10-12.mp4'}]})
    return 200, json.dumps({'making': record, 'steps': []})
codes = [making.main(shlex.split(line)[2:], call=call) for line in lines]
def empty_store(method, path, body):
    if method == 'POST':
        bodies.append(body)
    return (200, json.dumps({'ok': True, 'recordings': []})) if path == making.RECORDINGS_LIST else (200, json.dumps({'making': record, 'steps': []}))
before = len(bodies)
refused = making.main(shlex.split(lines[0])[2:], call=empty_store)
print(json.dumps({'codes': codes, 'bodies': bodies[:before], 'refused': refused, 'written_when_refused': len(bodies) - before}))`)

  it('making.py records a take only once the store holds it', () => {
    expect(posted.refused).toBe(1)
    expect(posted.written_when_refused).toBe(0)
  })

  it('making.py takes both lines, the take stamped with the cut\'s current script', () => {
    expect(posted.codes).toEqual([0, 0])
    expect(posted.bodies[0].recordings).toEqual([{ cut: 'long', path: `recordings/${'a'.repeat(64)}.mp4`, seconds: 185, script_sha256: '3e329b90efcc3a4198b58641576eb9dc9f1f34deb095341a4d3ce596f908383b' }])
    expect(posted.bodies[1].descript.cuts.long.known_media).toEqual(['Script 2026-10-12 3e329b9.mp4', 'Record here 3-minute slate.mp4', "Krish Raja's camera.mp4"])
    expect(posted.bodies[1].descript.cuts.long.sent_at).toBe('2026-10-12T10:31:16Z')
  })

  it('the engine accepts both as written', () => {
    for (const body of posted.bodies) {
      const { patch, problems } = parseMakingPatch(body, '2026-10-12T15:00:00Z')
      expect(problems).toEqual([])
      expect(Object.keys(patch).length).toBe(1)
    }
  })
})

describe('the command line refuses before any call', () => {
  it('fetch: only an https download link', () => {
    const out = run(['fetch', '--url', 'http://example.com/take.mp4', '--piece', PIECE, '--cut', 'long', '--out', work])
    expect(out.status).toBe(1)
    expect(out.stderr).toMatch(/the https download_url wait_for_job gave/)
    expect(out.stderr).not.toMatch(/engine\.invalid|could not reach/i)
  })

  it('fetch: cutting more than the slate needs Krish\'s words', () => {
    const out = run(['fetch', '--url', 'https://example.com/take.mp4', '--piece', PIECE, '--cut', 'long', '--out', work, '--from-seconds', '190',
      '--use-last', 'use the last one'])
    expect(out.status).toBe(1)
    expect(out.stderr).toMatch(/starting "Krish"/)
  })

  it('check: a piece id that is not a uuid', () => {
    const out = run(['check', '--piece', 'monday', '--cut', 'long', '--words', 'words.txt'])
    expect(out.status).toBe(1)
    expect(out.stderr).toMatch(/the piece id is the content_ideas uuid/)
  })

  it('handoff: only a descript.com share link, and nothing posted without --post', () => {
    const out = run(['handoff', '--piece', PIECE, '--cut', 'long', '--share-url', 'https://notdescript.com/x'])
    expect(out.status).toBe(1)
    expect(out.stderr).toMatch(/the https share_url wait_for_job gave for the private copy, on descript\.com/)
    expect(out.stderr).not.toMatch(/engine\.invalid|could not reach/i)
  })
})

// scripts/recordings-upload.ps1, read as text: no PowerShell runs in this suite.
describe('the recordings lane takes one file a session names', () => {
  const upload = read('scripts/recordings-upload.ps1')
  const one = upload.slice(upload.indexOf('function Send-OneRecording('), upload.indexOf('\n# ---- one pass'))

  it('-File PATH -Name NAME -Sha256 HASH', () => {
    expect(upload).toMatch(/\[string\]\$File = '',\n\s+\[string\]\$Name = '',\n\s+\[string\]\$Sha256 = ''/)
    expect([...upload].filter((ch) => ch.charCodeAt(0) > 127)).toEqual([])
  })

  it('sends it as a pass sends an Inbox file: the upload URL, the bytes only to the library storage, the confirm', () => {
    const ask = one.indexOf("'/api/library/recordings/upload-url'")
    const put = one.indexOf('Send-Upload $uploader')
    const confirm = one.indexOf("'/api/library/recordings/confirm'")
    expect(ask).toBeGreaterThan(-1)
    expect(put).toBeGreaterThan(ask)
    expect(confirm).toBeGreaterThan(put)
    expect(one).toContain("$url.AbsolutePath.StartsWith('/storage/v1/object/upload/sign/content-library/recordings/')")
    expect(one).toContain('$token = Get-RunnerToken')
  })

  it('checks the file is the take that was fetched, a recording type and size, unchanged while read', () => {
    expect(one).toContain('if ($Expected -and $sha -ne $Expected.Trim().ToLowerInvariant())')
    expect(one).toContain('if ($RecordingExtensions -notcontains $extension)')
    expect(one).toContain('if ($bytes -gt $RecordingMaxBytes)')
    expect(one).toContain('changed while it was read')
    expect(one).toContain("return ('recordings/{0}{1}' -f $sha, $extension)")
  })

  it('keeps no state, places nothing and never waits on the scheduled task\'s lock', () => {
    expect(one).not.toMatch(/Save-JsonFile|Invoke-TakePlacing|Sync-Recordings|Resolve-MediaInbox/)
    const dispatch = upload.indexOf('if ($File) {')
    expect(dispatch).toBeGreaterThan(upload.indexOf('function Send-OneRecording('))
    expect(dispatch).toBeLessThan(upload.indexOf("[System.Threading.Mutex]::new($false, 'Local\\MindmakeRecordingsUpload')"))
    expect(one).toContain("if ($Check -or $Loop) { throw '-File sends one file; it takes neither -Check nor -Loop.' }")
  })
})

describe('the video skill brings a Descript take in, step by step', () => {
  const skill = read('.agents/skills/produce-video/SKILL.md')
  const section = skill.slice(skill.indexOf('## Takes recorded in Descript'), skill.indexOf('## 3. Build the kit, once per cut'))

  it('has its own section, and Claude Code\'s copy matches it', () => {
    expect(section.length).toBeGreaterThan(1000)
    expect(read('.claude/skills/produce-video/SKILL.md')).toBe(skill)
  })

  it('quotes Krish verbatim: the tool, where he records, and his yes to a private copy', () => {
    expect(section).toContain('"Descript is now my tool of choice for video script\nreadouts on my phone - scripts should automatically be sent there, with the\nability for Descript to put the video in the correct place when recorded."')
    expect(section).toContain('"I can use the descript web app, otherwise my laptop to\nrecord"')
    expect(section).toContain('"1. yes"')
  })

  it('runs look, check, a private publish, fetch, the single-file send, then the record', () => {
    const order = ['descript_take.py waiting', 'descript_take.py look', 'export_transcript', 'descript_take.py check', '"access_level": "private"',
      'wait_for_job', 'descript_take.py fetch', 'recordings-upload.ps1\n      -File PATH -Name NAME -Sha256 HASH', 'recorded CUT', '--known-media']
    const at = order.map((step) => section.indexOf(step))
    for (const [n, index] of at.entries()) expect(index, order[n]).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('says what to do when the copy is refused, the link has expired, a cloud session has no runner key, or he read it twice', () => {
    expect(section).toContain('A 403 means the drive\'s publish')
    expect(section).toContain('publish again with the same call')
    expect(section).toMatch(/A cloud session\*\* \(no runner key\) stops after step 4 and\n\s+never records a path that is not in the store/)
    expect(section).toContain('unless his words say use the last')
    expect(section).not.toMatch(/[\u2013\u2014]/)
  })
})
