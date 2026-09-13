import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { JOBS, JOB_NAMES, replayUrl, resolveReplay } from '../../apps/control-plane/api/content-engine/_jobs.js'
import {
  ARTIFACT_KINDS,
  MAX_ARTIFACT_CHARS,
  REDACTED,
  artifactForFailure,
  redactArtifact,
  redactText,
} from '../../apps/control-plane/api/_runArtifacts.js'

// Both halves here are the recovery path, which is only ever exercised on a bad
// day. A recovery path that is wrong is worse than one that is missing: it
// reports success and the operator stops looking.

describe('replay resolution', () => {
  test('refuses a job it does not know, and says what it does know', () => {
    const result = resolveReplay({ job: 'feed_ingset' })
    assert.equal(result.ok, false)
    assert.equal(result.ok === false ? result.error : '', 'unknown_job')
    assert.ok(result.ok === false && 'known' in result && result.known.includes('feed_ingest'),
      'a typo is the common case; the refusal has to be the correction')
  })

  test('a prototype key is not a job', () => {
    // JOBS is a frozen object literal, and registry['constructor'] is truthy on
    // any object literal. Without the hasOwnProperty check this would resolve
    // and the route would fetch `undefined` against its own host with the cron
    // secret attached.
    for (const key of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      const result = resolveReplay({ job: key })
      assert.equal(result.ok, false, `${key} must not resolve to a job`)
      assert.equal(result.ok === false ? result.error : '', 'unknown_job')
    }
  })

  test('refuses the jobs that cost money or delete, with the reason attached', () => {
    for (const job of ['purge', 'aeo_ingest']) {
      const result = resolveReplay({ job })
      assert.equal(result.ok, false, `${job} must not be replayable`)
      assert.equal(result.ok === false ? result.error : '', 'job_is_manual_only')
      assert.ok(result.ok === false && 'note' in result && result.note.length > 20,
        'refusing without saying why sends the operator to the source')
    }
    // The purge refusal must name the thing to do instead, because the whole
    // point of A1 is that a purge is recoverable.
    const purge = resolveReplay({ job: 'purge' })
    assert.match(purge.ok === false && 'note' in purge ? purge.note : '', /purge\/restore/)
  })

  test('normalises since, and refuses one it cannot parse', () => {
    const ok = resolveReplay({ job: 'feed_ingest', since: '2026-09-01T00:00:00+02:00' })
    assert.equal(ok.ok, true)
    assert.equal(ok.ok === true ? ok.since : '', '2026-08-31T22:00:00.000Z')

    for (const bad of ['last tuesday', 42, {}]) {
      const result = resolveReplay({ job: 'feed_ingest', since: bad })
      assert.equal(result.ok, false, `${JSON.stringify(bad)} must be refused`)
      assert.equal(result.ok === false ? result.error : '', 'since_must_be_iso8601')
    }
    // Absent and empty are not errors: most replays want the job's own window.
    assert.equal(resolveReplay({ job: 'feed_ingest' }).ok, true)
    assert.equal(resolveReplay({ job: 'feed_ingest', since: '' }).ok, true)
  })

  test('every registered path is an api route path, and the names are sorted', () => {
    for (const [job, entry] of Object.entries(JOBS)) {
      assert.match(entry.path, /^\/api\/[a-z0-9/-]+$/, `${job} has a path that is not a route`)
      assert.ok(entry.note.length > 10, `${job} needs a note; it is what someone reads before pressing`)
    }
    assert.deepEqual([...JOB_NAMES], [...JOB_NAMES].sort())
  })
})

describe('replay url', () => {
  test('never guesses a host, because the request carries the cron secret', () => {
    assert.throws(() => replayUrl('/api/feed/ingest', null, undefined), /refusing to guess/)
    assert.throws(() => replayUrl('/api/feed/ingest', null, ''), /refusing to guess/)
    // A Host header can carry a path or a port trick; anything that is not a
    // hostname is refused rather than normalised.
    assert.throws(() => replayUrl('/api/feed/ingest', null, 'evil.com/x'), /not a hostname/)
    assert.throws(() => replayUrl('/api/feed/ingest', null, 'a b'), /not a hostname/)
  })

  test('builds an absolute https url and encodes since', () => {
    assert.equal(
      replayUrl('/api/feed/ingest', null, 'content-engine.vercel.app'),
      'https://content-engine.vercel.app/api/feed/ingest',
    )
    assert.equal(
      replayUrl('/api/feed/ingest', '2026-09-01T00:00:00.000Z', 'content-engine.vercel.app'),
      'https://content-engine.vercel.app/api/feed/ingest?since=2026-09-01T00%3A00%3A00.000Z',
    )
  })
})

describe('the replay gate', () => {
  // Exercised against the real _auth.ts, with env set per case. The property
  // that matters is the one plain guard() does NOT have: an unset ACCESS_CODE
  // must not open a route that can invoke every job in the engine.
  const call = async (env: Record<string, string | undefined>, req: Record<string, unknown>) => {
    const previous = { ACCESS_CODE: process.env.ACCESS_CODE, CRON_SECRET: process.env.CRON_SECRET }
    Object.assign(process.env, env)
    for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k]
    try {
      const { guardOperatorOrCron } = await import('../../apps/control-plane/api/_auth.js')
      let status = 0
      const res = {
        statusCode: 200,
        setHeader() {},
        status(code: number) { status = code; return res },
        json() { return res },
        end() { return res },
      }
      const stopped = guardOperatorOrCron(
        { method: 'POST', headers: {}, ...req } as never,
        res as never,
      )
      return { stopped, status }
    } finally {
      Object.assign(process.env, previous)
      for (const [k, v] of Object.entries(previous)) if (v === undefined) delete process.env[k]
    }
  }

  test('an absent ACCESS_CODE does not open the route', async () => {
    // guard() returns true from hasAccess here, deliberately, so the dashboard
    // survives a dropped env var. This route must not inherit that.
    const result = await call({ ACCESS_CODE: undefined, CRON_SECRET: undefined }, { headers: {} })
    assert.equal(result.stopped, true, 'a route that can run purge must never fail open')
    assert.equal(result.status, 401)
  })

  test('the cron secret is accepted, a wrong one is not', async () => {
    const secret = 'cs_' + 'a'.repeat(32)
    const good = await call({ CRON_SECRET: secret }, { headers: { authorization: `Bearer ${secret}` } })
    assert.equal(good.stopped, false, 'the bearer arm is what makes this reachable by a script')

    const bad = await call({ CRON_SECRET: secret }, { headers: { authorization: 'Bearer cs_wrong' } })
    assert.equal(bad.stopped, true)
    assert.equal(bad.status, 401)

    // An empty configured secret must never match an empty header.
    const unset = await call({ CRON_SECRET: '' }, { headers: { authorization: 'Bearer ' } })
    assert.equal(unset.stopped, true)
  })

  test('a wrong method is refused before any credential is looked at', async () => {
    const result = await call({ CRON_SECRET: 'x'.repeat(40) }, { method: 'DELETE', headers: {} })
    assert.equal(result.stopped, true)
    assert.equal(result.status, 405)
  })
})

describe('failure artifacts', () => {
  test('only a failure leaves one', () => {
    assert.equal(artifactForFailure('feed_ingest', 'ok', null, { inserted: 3 }), null)
    assert.equal(artifactForFailure('feed_ingest', 'skipped', 'no_folder', {}), null)
    assert.ok(artifactForFailure('feed_ingest', 'failed', 'boom', {}))
  })

  test('classifies what broke, so a parse failure is findable among timeouts', () => {
    const kind = (reason: string | null, body: unknown) =>
      artifactForFailure('j', 'failed', reason, body)?.kind
    assert.equal(kind('bad json', { raw_response: '{"a":' }), 'llm_parse_failure')
    assert.equal(kind('bad json', { parse_failure: 'unterminated' }), 'llm_parse_failure')
    assert.equal(kind('nope', { schema_error: 'missing hook' }), 'schema_rejection')
    assert.equal(kind('http_502', {}), 'http_failure')
    assert.equal(kind('socket hang up', {}), 'handler_error')
    for (const k of ARTIFACT_KINDS) assert.match(k, /^[a-z_]+$/)
  })

  test('redacts credentials by value shape wherever they appear', () => {
    // The reason a key-name filter is not enough: this is what a fetch error
    // from one of the model routes actually looks like.
    const runnerSecret = ['sk_', '90cf45cb7cb114cd84f7259c458172842cb47d6ed66c1d40'].join('')
    const body = {
      error: 'upstream refused',
      detail: `called with Authorization: Bearer ${runnerSecret}`,
      url: 'https://x.supabase.co?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZSJ9.abcdefghijkl',
    }
    const artifact = artifactForFailure('feed_ingest', 'failed', 'upstream refused', body)
    const serialised = JSON.stringify(artifact)
    assert.ok(!serialised.includes('90cf45cb7cb114cd'), 'a runner signing key must not survive')
    assert.ok(!serialised.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'), 'a JWT must not survive')
    assert.ok(serialised.includes(REDACTED))

    for (const token of [
      'sbp_d44d99383da85d9fd1fa48857b8040737e7dd3a7',
      'vcp_3WVnPZZFBVn3LEXAPRmJuKf2cqthsW1bHNuqRkbLbZAfo6Y4',
      ['ghp_', 'kJ898miM33bOV9PtOWg5Vvyc9VxRKt25cy5X'].join(''),
      ['rt_', 'd26867dedb995704ec05f4278b8a5cefed9ba49aab49fe82'].join(''),
    ]) {
      assert.ok(!redactText(`saw ${token} here`).includes(token.slice(6)), `${token.slice(0, 4)} tokens must be redacted`)
    }
  })

  test('redacts by key name too, whatever the value looks like', () => {
    const out = redactArtifact({
      cron_secret: 'plainish-value',
      Authorization: 'anything',
      nested: { api_key: 'x', session_cookie: 'y', count: 4 },
    }) as Record<string, unknown>
    assert.equal(out.cron_secret, REDACTED)
    assert.equal(out.Authorization, REDACTED)
    const nested = out.nested as Record<string, unknown>
    assert.equal(nested.api_key, REDACTED)
    assert.equal(nested.session_cookie, REDACTED)
    assert.equal(nested.count, 4, 'redaction must not swallow the numbers that make the artifact useful')
  })

  test('is bounded in size and in depth', () => {
    const long = artifactForFailure('j', 'failed', null, { raw: 'x'.repeat(50_000) }) as { payload: Record<string, string> }
    assert.ok(long.payload.raw.length < MAX_ARTIFACT_CHARS + 60)
    assert.match(long.payload.raw, /50000 chars total/, 'a truncated artifact must say it was truncated')

    // Depth two, so a walk over a fetch error cannot reach the request it came
    // from. The third level collapses to a marker rather than recursing.
    const deep = redactArtifact({ a: { b: { c: { d: 'unreachable' } } } }) as Record<string, Record<string, unknown>>
    assert.equal(deep.a.b, '[object]')

    const wide = redactArtifact(Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`k${i}`, i]))) as Record<string, unknown>
    assert.ok(Object.keys(wide).length <= 25)
    assert.equal(wide['…'], 'truncated')
  })

  test('a function is not evidence', () => {
    const out = redactArtifact({ fn: () => 'x', ok: 1 }) as Record<string, unknown>
    assert.equal(out.fn, null)
    assert.equal(out.ok, 1)
  })
})
