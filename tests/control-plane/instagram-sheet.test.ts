import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// GET /api/inspiration/instagram-sheet (api/inspiration/instagram-sheet.ts): the bytes of his one Instagram inspo
// sheet, for the lookalike step of the Sunday ideas run (scripts/post-pack/lookalike.py prepare). Krish, 2026-11-16:
// "we also need to build a lookalike model of stories that pull from the latest in [the Instagram inspo sheet]".
// Google is stubbed; nothing here reaches Drive.

const OPERATOR = 'o'.repeat(40)

vi.hoisted(() => {
  process.env.ENGINE_OPERATOR_TOKEN = 'o'.repeat(40)
  process.env.ACCESS_CODE = 'a-code'
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'engine@example.iam.gserviceaccount.com'
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = 'not-a-pem'
})

const google = vi.hoisted(() => ({
  configured: true,
  tokens: [] as Array<Record<string, unknown>>,
  ownerToken: 'owner-token' as string | null,
  serviceToken: 'service-token' as string | null,
}))

vi.mock('../../apps/control-plane/api/_google.js', () => ({
  DRIVE_READONLY_SCOPE: 'https://www.googleapis.com/auth/drive.readonly',
  googleConfigured: () => google.configured,
  googleAccessToken: async (_scopes: string[], options: Record<string, unknown> = {}) => {
    google.tokens.push(options)
    return options.impersonate === false ? google.serviceToken : google.ownerToken
  },
}))

import handler, { INSTAGRAM_SHEET_ID, XLSX_TYPE } from '../../apps/control-plane/api/inspiration/instagram-sheet.js'

class MockResponse {
  statusCode = 200
  body: unknown
  sent: Buffer | null = null
  headers = new Map<string, unknown>()
  status(code: number) { this.statusCode = code; return this }
  json(value: unknown) { this.body = value; return this }
  setHeader(name: string, value: unknown) { this.headers.set(name.toLowerCase(), value); return this }
  end(chunk?: Buffer) { if (chunk) this.sent = chunk; return this }
}

async function call(request: Record<string, unknown>) {
  const res = new MockResponse()
  await handler({ method: 'GET', headers: {}, query: {}, ...request } as unknown as VercelRequest, res as unknown as VercelResponse)
  return res
}
const asOperator = { headers: { authorization: `Bearer ${OPERATOR}` } }
const XLSX_BYTES = Buffer.from('PK\u0003\u0004 a pretend workbook')

let fetched: string[] = []
let driveStatus: Record<string, number> = {}

beforeEach(() => {
  google.configured = true
  google.tokens = []
  google.ownerToken = 'owner-token'
  google.serviceToken = 'service-token'
  fetched = []
  driveStatus = {}
  vi.stubGlobal('fetch', async (input: string, init: { headers: Record<string, string> }) => {
    fetched.push(`${init.headers.Authorization} ${input}`)
    const status = driveStatus[init.headers.Authorization] ?? 200
    return new Response(status === 200 ? XLSX_BYTES : JSON.stringify({ error: {} }), { status })
  })
})

describe('the Instagram inspo sheet, read for the lookalike step', () => {
  it('refuses a caller without the operator key or his cookie, and reads nothing', async () => {
    const res = await call({})
    expect(res.statusCode).toBe(401)
    expect(fetched).toEqual([])
    expect((await call({ method: 'POST', ...asOperator })).statusCode).toBe(405)
  })

  it('answers the one sheet\'s bytes, as the owner of his Drive, private and never cached', async () => {
    const res = await call(asOperator)
    expect(res.statusCode).toBe(200)
    expect(res.sent?.equals(XLSX_BYTES)).toBe(true)
    expect(res.headers.get('content-type')).toBe(XLSX_TYPE)
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(fetched).toEqual([`Bearer owner-token https://www.googleapis.com/drive/v3/files/${INSTAGRAM_SHEET_ID}?alt=media&supportsAllDrives=true`])
    expect(google.tokens[0]).toMatchObject({ subject: 'krish@mindmake.co' })
  })

  it('reads only its one file, whatever the request names', async () => {
    const res = await call({ ...asOperator, query: { id: 'some-other-file', file: 'x' }, url: '/api/inspiration/instagram-sheet?id=some-other-file' })
    expect(res.statusCode).toBe(200)
    expect(fetched.every(f => f.includes(`/files/${INSTAGRAM_SHEET_ID}?`))).toBe(true)
  })

  it('falls back to the service account when the owner cannot read it, and says why when neither can', async () => {
    driveStatus = { 'Bearer owner-token': 403 }
    const back = await call(asOperator)
    expect(back.statusCode).toBe(200)
    expect(fetched.map(f => f.split(' ')[1])).toEqual(['owner-token', 'service-token'])
    driveStatus = { 'Bearer owner-token': 403, 'Bearer service-token': 404 }
    const none = await call(asOperator)
    expect(none.statusCode).toBe(502)
    expect(none.body).toEqual({ ok: false, error: 'sheet_unreadable', why: ['drive answered 403', 'drive answered 404'] })
    expect(none.sent).toBeNull()
  })

  it('says so when Google is not set up, never an empty sheet', async () => {
    google.configured = false
    const res = await call(asOperator)
    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({ ok: false, error: 'google_not_configured' })
  })
})
