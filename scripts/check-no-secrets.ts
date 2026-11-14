import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { containsCommittedSecret } from './secret-patterns.js'

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean)
// ve design lock: golden key frames, calibration fixtures and approved illustration plates are small, versioned test inputs, not runtime media.
const approvedMedia = /^(?:fixtures\/ve\/design-lock\/|assets\/plates\/)/
const media = files.filter((file) => !approvedMedia.test(file) && /\.(?:mp4|mov|mkv|webm|avi|m4v|m2ts|mts|mxf|wav|mp3|m4a|aac|flac|ogg|opus|srt|vtt|edl|fcpxml|png|jpe?g|webp|gif|avif|heic|tiff?|bmp|sqlite)$/i.test(file))
if (media.length) throw new Error(`runtime media or database files are tracked: ${media.join(', ')}`)

// The main database's project address never sits in this public repository (Krish canon, Secrets; fleet audit I-01,
// 2026-11-14). Its ref is held here only as a sha256, so this check names no value: every 20-letter lower-case token
// is hashed and compared. A script that needs the project reads SUPABASE_PROJECT_REF from its environment.
const DB_REF_SHA256 = new Set(['ed7e78e5a43de7e1448c2922d7ce87a52daf11a625da0360ce507b439b4b8bf0'])
const refToken = /\b[a-z]{20}\b/g
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')

for (const file of files.filter((name) => !/(?:package-lock|requirements\.lock)\.txt$|package-lock\.json$/i.test(name))) {
  let body = ''
  try { body = await readFile(file, 'utf8') } catch { continue }
  if (containsCommittedSecret(body)) throw new Error(`possible committed secret in ${file}`)
  for (const match of body.matchAll(refToken)) {
    if (DB_REF_SHA256.has(sha256(match[0]))) throw new Error(`the main database's project address is in ${file}; read SUPABASE_PROJECT_REF instead`)
  }
}
process.stdout.write('secret and media invariants passed\n')
