import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { dispatchPlaceTakes, PLACE_TAKES_EVENT } from '../apps/control-plane/api/library/_placeTakes.js'

// Wave 2, W2.3, "Takes place themselves": .github/workflows/place-takes.yml
// places each new take on its piece with its word clock, started only by the
// engine's Inbox job (repository_dispatch take-copied) or by hand. Ruling
// (Krish, 2026-10-29): "I want zero Claude routines. No Claude schedules of
// any kind in this architecture".
// The placing, the word clock, used/ and duplicates are tested on stand-ins in
// recording_match.py --self-test (tests/control-plane/recording-match.test.ts).

const ROOT = join(__dirname, '..')
const workflow = readFileSync(join(ROOT, '.github/workflows/place-takes.yml'), 'utf8')
const code = workflow.split('\n').filter((line) => !line.trim().startsWith('#')).join('\n')

describe('place-takes.yml', () => {
  it('has no schedule: a dispatch of take-copied, or Run workflow, is the only start', () => {
    expect(code).not.toMatch(/^\s*schedule\s*:/m)
    expect(code).not.toMatch(/cron/)
    const on = code.slice(code.indexOf('\non:'), code.indexOf('\npermissions:'))
    expect(on).toMatch(/^\s{2}workflow_dispatch:/m)
    expect(on).toMatch(/^\s{2}repository_dispatch:\n\s{4}types: \[take-copied\]$/m)
    expect(on.match(/^\s{2}[a-z_]+:/gm)).toEqual(['  workflow_dispatch:', '  repository_dispatch:'])
    expect(PLACE_TAKES_EVENT).toBe('take-copied')
  })

  it('runs recording_match.py --record --board --clock on ubuntu, after checking the pinned transcriber decodes', () => {
    expect(code).toContain('runs-on: ubuntu-latest')
    expect(code).toContain('args=(--record --board --clock --by "Place takes" --json)')
    expect(code).toContain('python scripts/post-pack/recording_match.py "${args[@]}"')
    expect(code.indexOf('--check-transcriber')).toBeGreaterThan(-1)
    expect(code.indexOf('--check-transcriber')).toBeLessThan(code.indexOf('args=(--record'))
    expect(code).toContain('python -m pip install --require-hashes -r requirements.lock.txt')
    expect(code).not.toMatch(/pip install faster-whisper(?!==)/)
  })

  it('keeps the faster-whisper model by its name, and keeps no words or media between runs', () => {
    expect(code).toMatch(/uses: actions\/cache@v4\n\s+with:\n\s+path: ~\/\.cache\/huggingface\n\s+key: faster-whisper-\$\{\{ env\.WHISPER_MODEL \}\}-/)
    expect(code).toContain('WHISPER_MODEL: small.en')
    const books = [...code.matchAll(/uses: actions\/cache\/(?:restore|save)@v4\n\s+with:\n\s+path: \|\n((?:\s{12}\S.*\n)+)/g)].map((m) => m[1]!.trim().split(/\s+/))
    expect(books).toEqual([['.cache/recordings/answered.json', '.cache/recordings/inbox-used.json'], ['.cache/recordings/answered.json', '.cache/recordings/inbox-used.json']])
  })

  it('names only the engine key and GitHub\'s own token, runs no Claude, and leaves no credential in the checkout', () => {
    const secrets = [...code.matchAll(/secrets\.([A-Za-z0-9_]+)/g)].map((m) => m[1])
    expect(secrets).toEqual(['ENGINE_OPERATOR_TOKEN'])
    expect(code).not.toMatch(/anthropic|claude-code|CLAUDE_CODE_OAUTH_TOKEN/i)
    expect(code).toContain('persist-credentials: false')
    expect(code).toMatch(/permissions:\n\s+contents: read/)
  })

  it('an unsure take (exit 2) leaves the job green, asked on the board; a failure (exit 1) turns it red', () => {
    expect(code).toContain('[ "$code" -eq 1 ] && exit 1')
    expect(code).toContain('if [ -z "$ENGINE_OPERATOR_TOKEN" ]; then')
  })

  it('moves and deletes nothing: no Drive call, no rm of a take', () => {
    expect(code).not.toMatch(/googleapis|drive\.google|rclone|\brm\s/)
  })
})

describe('the Inbox job asks GitHub to place new takes', () => {
  const calls: Array<{ url: string; init: any }> = []
  const fetcher = (status: number) => async (url: string, init: any) => {
    calls.push({ url, init })
    return { status, text: async () => 'nope' }
  }

  it('sends nothing when no take is new, or when no dispatch token is set', async () => {
    calls.length = 0
    expect(await dispatchPlaceTakes(0, { PLACE_TAKES_DISPATCH_TOKEN: 't' }, fetcher(204))).toEqual({ sent: false, reason: 'nothing_new' })
    expect(await dispatchPlaceTakes(2, {}, fetcher(204))).toEqual({ sent: false, reason: 'not_configured' })
    expect(calls).toEqual([])
  })

  it('sends one repository_dispatch of take-copied to this repository, on the dispatch token', async () => {
    calls.length = 0
    expect(await dispatchPlaceTakes(2, { PLACE_TAKES_DISPATCH_TOKEN: 'tok' }, fetcher(204))).toEqual({ sent: true })
    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe('https://api.github.com/repos/krishanraja/content-engine/dispatches')
    expect(calls[0]!.init.method).toBe('POST')
    expect(calls[0]!.init.headers.Authorization).toBe('Bearer tok')
    expect(JSON.parse(calls[0]!.init.body)).toEqual({ event_type: 'take-copied', client_payload: { takes: 2 } })
  })

  it('a refused or unreachable dispatch is said, never thrown', async () => {
    expect(await dispatchPlaceTakes(1, { PLACE_TAKES_DISPATCH_TOKEN: 'tok' }, fetcher(403))).toEqual({ sent: false, reason: 'failed', error: 'github 403: nope' })
    const down = async () => { throw new Error('offline') }
    expect(await dispatchPlaceTakes(1, { PLACE_TAKES_DISPATCH_TOKEN: 'tok' }, down)).toEqual({ sent: false, reason: 'failed', error: 'offline' })
  })
})
