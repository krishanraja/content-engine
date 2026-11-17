import { inflateRawSync } from 'node:zlib'

// Research filed as a link (docs/PUBLISH_BOARDS.md, "Sessions and materials"; docs/DRIVE.md, "The research library").
//
// Krish, 2026-11-17: "was the research i gave you auto logged to this piece too? looks like I did two research runs, are
// both logged correctly in the same place in the library and UI automatically?" His second Perplexity run sat in Drive as
// a .docx and a .json; a session filed both on the piece by url with kind research, and the store kept them as bare links,
// which the research library never copies (it copies text and files only). So a research link to a file in his Drive is
// read here, as its owner, and its words are filed on the same piece as research text, which the library then copies like
// any other research. The link stays on file beside it; nothing is replaced or deleted.
//
// This file only reads: one metadata call and one download or export per link, never a write to Drive.

const DRIVE = 'https://www.googleapis.com/drive/v3'
/** The most text one link's words file as (the store's own cap on a text). */
export const LINK_TEXT_MAX = 2_000_000
/** The biggest file read to find its words. */
const LINK_FILE_MAX = 32 * 1024 * 1024

/** The words of one research link, with the file's own name, or null when it has none this can read. */
export type LinkReader = (url: string) => Promise<{ title: string; text: string; mime: string } | null>

/** The Drive file id a link names, or null when it is not a link to a file in Drive. */
export function driveFileIdOf(url: string): string | null {
  let u: URL
  try { u = new URL(url) } catch { return null }
  if (!/^(drive|docs)\.google\.com$/.test(u.hostname)) return null
  const inPath = u.pathname.match(/\/(?:file|document|spreadsheets|presentation)\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]{10,})/)
  if (inPath) return inPath[1]
  const q = u.searchParams.get('id')
  return q && /^[A-Za-z0-9_-]{10,}$/.test(q) ? q : null
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const decode = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e] ?? m)

/** One member of a zip archive, or null when it is not there or is stored in a way this does not read. */
export function zipEntry(bytes: Uint8Array, name: string): Uint8Array | null {
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // The end of central directory record: its signature within the last 64 KB and 22 bytes.
  let eocd = -1
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65_557); i--) if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  if (eocd < 0) return null
  const count = b.readUInt16LE(eocd + 10)
  let at = b.readUInt32LE(eocd + 16)
  for (let n = 0; n < count && at + 46 <= b.length; n++) {
    if (b.readUInt32LE(at) !== 0x02014b50) return null
    const method = b.readUInt16LE(at + 10), size = b.readUInt32LE(at + 20)
    const nameLen = b.readUInt16LE(at + 28), extraLen = b.readUInt16LE(at + 30), commentLen = b.readUInt16LE(at + 32)
    const local = b.readUInt32LE(at + 42)
    if (b.toString('utf8', at + 46, at + 46 + nameLen) === name) {
      if (local + 30 > b.length || b.readUInt32LE(local) !== 0x04034b50) return null
      const start = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28)
      const data = b.subarray(start, start + size)
      if (method === 0) return new Uint8Array(data)
      if (method === 8) return new Uint8Array(inflateRawSync(data))
      return null
    }
    at += 46 + nameLen + extraLen + commentLen
  }
  return null
}

/** A Word document's words as Markdown: each paragraph its own block, a heading style as its #s, a list item as a dash. */
export function docxText(bytes: Uint8Array): string | null {
  const xml = zipEntry(bytes, 'word/document.xml')
  if (!xml) return null
  const doc = Buffer.from(xml).toString('utf8')
  const body = doc.match(/<w:body[^>]*>([\s\S]*)<\/w:body>/)?.[1] ?? doc
  const blocks: string[] = []
  for (const p of body.match(/<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g) || []) {
    const style = p.match(/<w:pStyle w:val="([^"]+)"/)?.[1] || ''
    let words = ''
    for (const t of p.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g)) words += t[1] !== undefined ? t[1] : t[0] === '<w:tab/>' ? '\t' : '\n'
    words = decode(words).trim()
    if (!words) continue
    const level = style.match(/^(?:Heading|heading)(\d)$/)?.[1] ?? (style === 'Title' ? '1' : null)
    blocks.push(level ? `${'#'.repeat(Math.min(6, Number(level)))} ${words}` : /<w:numPr>/.test(p) || /List/.test(style) ? `- ${words}` : words)
  }
  const text = blocks.join('\n\n').trim()
  return text ? `${text}\n` : null
}

const TEXT_MIME = /^text\/|^application\/(json|xml|x-ndjson|markdown)$/
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const EXPORTS: Record<string, string[]> = {
  'application/vnd.google-apps.document': ['text/markdown', 'text/plain'],
  'application/vnd.google-apps.spreadsheet': ['text/csv'],
  'application/vnd.google-apps.presentation': ['text/plain'],
}

/** The reader on a token for his Drive: a Google Doc exported as Markdown, a Word file's words, a text or JSON file as
 *  it is; anything else (a PDF, an image) has no words this reads, and stays a link. */
export function googleLinkReader(token: string, f: typeof fetch = fetch): LinkReader {
  const auth = { authorization: `Bearer ${token}` }
  return async url => {
    const id = driveFileIdOf(url)
    if (!id) return null
    const meta = await f(`${DRIVE}/files/${id}?fields=name,mimeType,size&supportsAllDrives=true`, { headers: auth })
    if (!meta.ok) return null
    const m = await meta.json() as { name?: string; mimeType?: string; size?: string }
    const mime = String(m.mimeType || ''), title = String(m.name || id)
    if (Number(m.size || 0) > LINK_FILE_MAX) return null
    for (const as of EXPORTS[mime] || []) {
      const r = await f(`${DRIVE}/files/${id}/export?mimeType=${encodeURIComponent(as)}`, { headers: auth })
      if (r.ok) { const text = (await r.text()).trim(); return text ? { title, text: text.slice(0, LINK_TEXT_MAX), mime } : null }
    }
    if (mime !== DOCX && !TEXT_MIME.test(mime)) return null
    const r = await f(`${DRIVE}/files/${id}?alt=media&supportsAllDrives=true`, { headers: auth })
    if (!r.ok) return null
    const bytes = new Uint8Array(await r.arrayBuffer())
    const text = mime === DOCX ? docxText(bytes) : Buffer.from(bytes).toString('utf8')
    return text && text.trim() ? { title, text: text.slice(0, LINK_TEXT_MAX), mime } : null
  }
}

/** The real reader, as the owner of his Drive (read-only scope), or null when the engine cannot reach Google. */
export async function driveLinkReader(): Promise<LinkReader | null> {
  const { googleAccessToken, googleConfigured } = await import('./_google.js')
  if (!googleConfigured()) return null
  const token = await googleAccessToken(['https://www.googleapis.com/auth/drive.readonly'], { subject: process.env.GOOGLE_DRIVE_OWNER || 'krish@mindmake.co' })
  return token ? googleLinkReader(token) : null
}

/** Whether a material filed as a link is research, by its kind or its role. */
export const isResearchLink = (body: Record<string, unknown>) => body.kind === 'research' || body.role === 'research'
