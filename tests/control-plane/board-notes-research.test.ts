import { describe, expect, it } from 'vitest'
import { deflateRawSync } from 'node:zlib'
import { addText, type StoreDb } from '../../apps/control-plane/api/_pieceStore'
import { createStoreHandler } from '../../apps/control-plane/api/content-ideas/store'
import { docxText, driveFileIdOf, googleLinkReader, zipEntry, type LinkReader } from '../../apps/control-plane/api/_researchLink'
import { afterPress, notesMaterial } from '../../apps/control-plane/api/board/_presses'
import { VISUAL_POINT_LINE, savedNotesFor, withSavedNotes } from '../../apps/control-plane/api/board/_view'

// Krish, 2026-11-17, on Wed 18's piece (db9f9f6a): "when I add feedback in to the control center UI, it obviously loads in
// to the prompt that comes here, but when i reopen the piece at a later date it seems to have vanished - and was the
// research i gave you auto logged to this piece too? looks like I did two research runs, are both logged correctly in the
// same place in the library and UI automatically?"
//
// Two causes, each proved here against the code that had them:
//   1. His notes were saved only as a comment on the week; the prompt's `notes` carried nothing back and nothing filed
//      them on the piece, so the box came back empty and get_piece_board never showed them.
//   2. A link filed with kind research was stored as kind link (addText forced it), and the link route never read the
//      file or copied anything to the research library, so his second Perplexity run (a .docx and a .json in Drive) sat
//      on the piece as two bare links.

type Body = Record<string, any>
const WED = 'db9f9f6a-1092-49be-8024-f335e060305a'
const DOCX_URL = 'https://drive.google.com/file/d/1rqvV7mxntbErmmUmR_6E_clyeac44w5p/view?usp=drivesdk'

/** The narrow store client: the piece row, the RPCs and the capture trigger, as board-sessions.test.ts fakes them. */
function fakeDb() {
  const rows = new Map<string, Body>([[WED, { id: WED, idea: 'The labs still run Salesforce', scheduled_for: '2026-11-18', lane_slot: 'under_the_hood', meta: {}, updated_at: 't0' }]])
  const stored: Body[] = []
  const db: StoreDb & { stored: Body[] } = {
    stored,
    rpc: async (fn, args) => {
      if (fn === 'board_material_put') { const p = args.p as Body; const m = { id: `m${stored.length}`, version: 1, scope: p.piece_id, ...p }; stored.push(m); return { data: { ok: true, duplicate: false, material: m }, error: null } }
      if (fn === 'board_overlay') return { data: { as_of: 'now', materials: stored.map(m => ({ ...m, key: m.material_key })), sessions: [], fields: [], events: [] }, error: null }
      return { data: null, error: { message: 'unknown' } }
    },
    from: () => {
      const filters: Body = {}
      let patch: Body | null = null
      const q: any = {
        select: () => q, eq: (c: string, v: unknown) => { filters[c] = v; return q }, update: (p: Body) => { patch = p; return q },
        maybeSingle: async () => ({ data: rows.get(String(filters.id)) ?? null, error: null }),
        then: (ok: (r: unknown) => unknown) => {
          const row = rows.get(String(filters.id))
          if (!patch || !row || filters.updated_at !== row.updated_at) return Promise.resolve({ data: [], error: null }).then(ok)
          rows.set(row.id, { ...row, ...patch, updated_at: `t${stored.length + 1}` })
          for (const m of (patch.meta as Body).materials || []) if (!stored.some(s => s.material_key === `meta:${m.id}`))
            stored.push({ id: `cap-${m.id}`, material_key: `meta:${m.id}`, scope: WED, kind: m.store_kind, role: m.role, title: m.title, storage: m.url ? 'link' : 'text', url: m.url, content: m.content })
          return Promise.resolve({ data: [{ id: row.id }], error: null }).then(ok)
        },
      }
      return q
    },
  }
  return db
}

describe('research filed by url keeps its kind (cause 2)', () => {
  it('a link filed with kind research is research on the piece, not a bare link', async () => {
    const db = fakeDb()
    const r = await addText(db, { op: 'link', piece_id: WED, url: DOCX_URL, kind: 'research', title: 'The AI labs still buy software (round 2)' }, true, 'Claude Code (cloud)')
    // On 17 Nov the store answered kind "link" here: addText wrote 'link' over the kind the session gave.
    expect((r.material as Body).kind).toBe('research')
    expect(db.stored.find(m => m.url === DOCX_URL)?.kind).toBe('research')
  })
  it('a link filed with no kind is still a link', async () => {
    const db = fakeDb()
    const r = await addText(db, { op: 'link', piece_id: WED, url: 'https://example.org/inspo' }, true, 'Claude Code')
    expect((r.material as Body).kind).toBe('link')
  })
})

describe('the link route reads a research link in his Drive and files its words as research (cause 2)', () => {
  const call = async (body: Body, reader: LinkReader | null, opts: { copied?: Array<string | null> } = {}) => {
    const db = fakeDb()
    const read: string[] = []
    const handler = createStoreHandler(async () => db, async id => { opts.copied?.push(id); return { state: 'copied', link: 'https://drive.google.com/file/d/lib/view' } },
      async () => (reader ? async (url: string) => { read.push(url); return reader(url) } : null))
    let status = 0; let out: Body = {}
    const res = { setHeader() {}, status(s: number) { status = s; return res }, json(b: Body) { out = b; return res }, redirect() { return res }, end() { return res } }
    process.env.ENGINE_OPERATOR_TOKEN = 'k'
    await handler({ method: 'POST', query: { op: 'link' }, headers: { authorization: 'Bearer k' }, body } as never, res as never)
    return { status, out, db, read }
  }
  const words: LinkReader = async () => ({ title: 'The-AI-labs-still-buy-software-build-versus-buy-research-second-round.docx', text: '# The AI labs still buy software\n\nRound two.', mime: 'docx' })

  it('files the link and, beside it, the file\'s words as research, copied to the library', async () => {
    const copied: Array<string | null> = []
    const { status, out, db, read } = await call({ piece_id: WED, url: DOCX_URL, kind: 'research', title: 'Round 2 research' }, words, { copied })
    expect(status).toBe(201)
    expect(read).toEqual([DOCX_URL])
    expect(out.research_text).toMatchObject({ state: 'filed', library: { state: 'copied' } })
    const text = db.stored.find(m => m.storage === 'text')!
    expect(text).toMatchObject({ kind: 'research', role: 'research', title: 'Round 2 research (text)' })
    expect(text.content).toContain('Round two.')
    // The library copy is asked for the text, which it can copy; the link stays on file beside it.
    expect(copied).toEqual([(out.research_text as Body).material.id])
    expect(db.stored.some(m => m.url === DOCX_URL && m.kind === 'research')).toBe(true)
  })
  it('reads nothing for a link that is not research, or not in his Drive', async () => {
    expect((await call({ piece_id: WED, url: DOCX_URL }, words)).read).toEqual([])
    expect((await call({ piece_id: WED, url: 'https://example.org/report', kind: 'research' }, words)).read).toEqual([])
  })
  it('keeps the link and says later when Drive cannot be reached, or unreadable when the file has no words', async () => {
    const none = await call({ piece_id: WED, url: DOCX_URL, kind: 'research' }, null)
    expect(none.status).toBe(201)
    expect(none.out.research_text).toEqual({ state: 'later', why: 'no_drive' })
    const pdf = await call({ piece_id: WED, url: DOCX_URL, kind: 'research' }, async () => null)
    expect(pdf.out.research_text).toMatchObject({ state: 'unreadable' })
    expect(pdf.db.stored.some(m => m.url === DOCX_URL)).toBe(true)
  })
})

/** A zip with one deflated member, as Word writes a .docx. */
function zipOf(name: string, data: string): Uint8Array {
  const raw = Buffer.from(data, 'utf8'), body = deflateRawSync(raw), n = Buffer.from(name)
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(n.length, 26)
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(body.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(n.length, 28); central.writeUInt32LE(0, 42)
  const cdAt = 30 + n.length + body.length
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(46 + n.length, 12); end.writeUInt32LE(cdAt, 16)
  return new Uint8Array(Buffer.concat([local, n, body, central, n, end]))
}
const DOC = '<?xml version="1.0"?><w:document xmlns:w="w"><w:body>'
  + '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>The AI labs still buy software</w:t></w:r></w:p>'
  + '<w:p><w:r><w:t xml:space="preserve">Anthropic runs </w:t></w:r><w:r><w:t>Salesforce &amp; Slack.</w:t></w:r></w:p>'
  + '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t>CRM build: $569,550</w:t></w:r></w:p>'
  + '<w:p/></w:body></w:document>'

describe('reading a file in his Drive', () => {
  it('names the file a Drive or Docs link points at, and nothing else', () => {
    expect(driveFileIdOf(DOCX_URL)).toBe('1rqvV7mxntbErmmUmR_6E_clyeac44w5p')
    expect(driveFileIdOf('https://docs.google.com/document/d/1UejePwOc_6abqX1A3TrKXDZxej4C1OOvwVM3K3C29lo/edit')).toBe('1UejePwOc_6abqX1A3TrKXDZxej4C1OOvwVM3K3C29lo')
    expect(driveFileIdOf('https://drive.google.com/open?id=1S0XUEgesxLm9TWLf7YelzHuCAPDE2ysr')).toBe('1S0XUEgesxLm9TWLf7YelzHuCAPDE2ysr')
    expect(driveFileIdOf('https://github.com/krishanraja/content-engine/blob/x/wed-research-2.md')).toBeNull()
    expect(driveFileIdOf('not a url')).toBeNull()
  })
  it('reads a Word file\'s words as Markdown', () => {
    const z = zipOf('word/document.xml', DOC)
    expect(zipEntry(z, 'word/missing.xml')).toBeNull()
    expect(docxText(z)).toBe('# The AI labs still buy software\n\nAnthropic runs Salesforce & Slack.\n\n- CRM build: $569,550\n')
    expect(docxText(new Uint8Array([1, 2, 3]))).toBeNull()
  })
  it('exports a Google Doc, downloads a Word file or a JSON file, and leaves a PDF as a link', async () => {
    const files: Record<string, { mimeType: string; name: string; body?: Uint8Array | string }> = {
      gdocAAAAAAAA: { mimeType: 'application/vnd.google-apps.document', name: 'Notes' },
      wordAAAAAAAA: { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', name: 'Round 2.docx', body: zipOf('word/document.xml', DOC) },
      jsonAAAAAAAA: { mimeType: 'application/json', name: 'Build-versus-buy-cost-model.json', body: '{"crm":{"build_3yr":569550}}' },
      pdfAAAAAAAAA: { mimeType: 'application/pdf', name: 'report.pdf', body: '%PDF' },
    }
    const calls: string[] = []
    const f = (async (url: string, init: { headers: Record<string, string> }) => {
      calls.push(url)
      expect(init.headers.authorization).toBe('Bearer t')
      const file = files[url.match(/files\/([A-Za-z0-9_-]+)/)![1]]
      if (/\/export\?/.test(url)) return new Response('# Notes\n\nExported.', { status: 200 })
      if (/alt=media/.test(url)) return new Response(file.body as BodyInit, { status: 200 })
      return new Response(JSON.stringify({ name: file.name, mimeType: file.mimeType, size: '10' }), { status: 200 })
    }) as unknown as typeof fetch
    const read = googleLinkReader('t', f)
    const link = (key: string) => `https://drive.google.com/file/d/${Object.keys(files).find(k => k.startsWith(key))}/view`
    expect(await read(link('gdoc'))).toMatchObject({ title: 'Notes', text: '# Notes\n\nExported.' })
    expect((await read(link('word')))?.text).toContain('Anthropic runs Salesforce & Slack.')
    expect(await read(link('json'))).toMatchObject({ title: 'Build-versus-buy-cost-model.json', text: '{"crm":{"build_3yr":569550}}' })
    expect(await read(link('pdf'))).toBeNull()
    // Only reads: a metadata call, an export or a download; never a write.
    expect(calls.every(u => /\/files\/\w+(\?fields=|\/export\?|\?alt=media)/.test(u))).toBe(true)
  })
})

describe('his notes for Claude stay with the piece (cause 1)', () => {
  const NOTE = 'Add the engineers gone wild, the leaders with eyes bigger than their stomachs, and the price hikes. '.repeat(7).trim()
  const comment = (over: Body = {}, doc = 'desk-wed-board-mwkds5uw', at = '2026-11-17T07:38:37.000Z') =>
    ({ doc_id: doc, updated_by: 'Krish', updated_at: at, body: { text: NOTE, use: 'claude_notes', piece_id: WED, title: 'The labs', anchor: 'desk:wed:board', at, thread_id: doc, ...over } })

  it('reads back his saved notes for the piece, whole and newest first, and no one else\'s', () => {
    const rows = [comment(), comment({ text: 'Earlier note.' }, 'desk-wed-story-a', '2026-11-14T09:00:00.000Z'),
      comment({ piece_id: '8287846b-6618-4a19-9fb8-23ad4eca2718', text: 'Monday only.' }, 'desk-mon-x'),
      { ...comment({ text: 'Said by a session.' }, 'desk-wed-y'), updated_by: 'Claude Code' }]
    const saved = savedNotesFor(rows, { piece_id: WED })
    expect(saved.map(n => n.text)).toEqual([NOTE, 'Earlier note.'])
    // His note on 17 Nov was 651 characters: the day's comment list cuts at 600, these do not.
    expect(saved[0].text.length).toBeGreaterThan(600)
    expect(savedNotesFor(rows, { item: 'off-thu-x' })).toEqual([])
  })
  it('puts them on every prompt that asks for his notes on that item', () => {
    const prompt = () => ({ kind: 'prompt', label: 'Claude production prompt', prompt: 'p', notes: { ask: 'a', heading: 'h', save: { kind: 'press', label: 'Your notes for Claude', body: { use: 'claude_notes', piece_id: WED } } } })
    const model = { days: [{ items: [{ next: prompt(), others: [prompt(), { kind: 'press', label: 'Pick the look' }] }] }] } as any
    withSavedNotes(model, [comment()])
    expect(model.days[0].items[0].next.notes.saved).toEqual([{ at: '2026-11-17T07:38:37.000Z', text: NOTE }])
    expect(model.days[0].items[0].others[0].notes.saved).toHaveLength(1)
    expect(model.days[0].items[0].others[1].notes).toBeUndefined()
  })
  it('his answer to the plan\'s visual question keeps its framing on later prompts, his words unchanged (1.30.0)', () => {
    const rows = [comment({ text: 'Say what grandfathered pricing is.', frame: 'visual_points' }, 'desk-wed-produce-z', '2026-11-18T09:00:00.000Z')]
    expect(savedNotesFor(rows, { piece_id: WED })).toEqual([{ at: '2026-11-18T09:00:00.000Z', text: 'Say what grandfathered pricing is.', frame: 'visual_points' }])
    const model = { days: [{ items: [{ next: { kind: 'prompt', label: 'Claude production prompt', prompt: 'p', notes: { ask: 'a', heading: 'h', save: { kind: 'press', label: 'x', body: { use: 'claude_notes', piece_id: WED } } } }, others: [] }] }] } as any
    withSavedNotes(model, rows)
    expect(model.days[0].items[0].next.prompt).toContain(`${VISUAL_POINT_LINE} Say what grandfathered pricing is.`)
  })
  it('files his notes on the piece when he saves them, kind note, role krish_notes', async () => {
    const body = comment().body
    expect(notesMaterial('2026-11-16', 'desk-wed-board-mwkds5uw', body)).toMatchObject({ piece_id: WED, content: NOTE, kind: 'note', role: 'krish_notes' })
    // An off-day post's notes go on its day.
    expect(notesMaterial('2026-11-16', 'desk-thu-post-x', { use: 'claude_notes', text: 'Make it funnier.', item: 'off-thu-meme', anchor: 'desk:thu:post' }))
      .toMatchObject({ week: '2026-11-16', day: 'thu', kind: 'note' })
    expect(notesMaterial('2026-11-16', 'x', { text: 'A plain comment.', anchor: 'desk:wed:board' })).toBeNull()

    const filed: Body[] = []
    const db = { from: () => ({ upsert: async () => ({ error: null }) }) } as never
    const r = await afterPress(db, { week: '2026-11-16', collection: 'comments', id: 'desk-wed-board-mwkds5uw', body, who: 'Krish', saved: { ok: true, revision: 1 } as never },
      { now: () => '2026-11-17T07:38:38.000Z', fileNotes: async (_db, input) => { filed.push(input); return { ok: true } } })
    expect(filed).toEqual([expect.objectContaining({ piece_id: WED, content: NOTE, kind: 'note', role: 'krish_notes' })])
    expect(r).toMatchObject({ taste: 'filed', piece: 'filed' })
  })
  it('still saves his notes when the piece store cannot take them', async () => {
    const db = { from: () => ({ upsert: async () => ({ error: null }) }) } as never
    const r = await afterPress(db, { week: '2026-11-16', collection: 'comments', id: 'd', body: comment().body, who: 'Krish', saved: { ok: true, revision: 1 } as never },
      { fileNotes: async () => { throw new Error('down') } })
    expect(r).toMatchObject({ taste: 'filed', piece: 'failed' })
  })
})

describe('research he pastes on the board is research (17 Nov)', () => {
  it('files as research, which the research library copies, unless it is a storyboard', async () => {
    const { pastedKind } = await import('../../apps/control-plane/api/board/_research')
    const { inLibrary } = await import('../../apps/control-plane/api/_researchLibrary')
    expect(pastedKind(undefined)).toBe('research')
    expect(pastedKind('storyboard')).toBe('file')
    // What his paste was filed as before: a 'file', which the library skips.
    expect(inLibrary({ kind: 'file', role: null, storage: 'text', archived_at: null, bytes: 10 })).toBe(false)
    expect(inLibrary({ kind: pastedKind(undefined), role: null, storage: 'text', archived_at: null, bytes: 10 })).toBe(true)
  })
})
