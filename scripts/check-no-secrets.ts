import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean)
const media = files.filter((file) => /\.(?:mp4|mov|mkv|wav|mp3|sqlite)$/i.test(file))
if (media.length) throw new Error(`runtime media or database files are tracked: ${media.join(', ')}`)

const patterns = [
  /\b(?:SUPABASE_SERVICE_ROLE_KEY|VIDEO_STUDIO_EXPORT_TOKEN|YOUTUBE_ACCESS_TOKEN)\s*=\s*[^\s#]+/i,
  /\bsk-[a-z0-9_-]{20,}\b/i,
  /\bya29\.[a-z0-9_-]{20,}\b/i,
  /authorization\s*:\s*["']Bearer\s+[a-z0-9._-]{20,}["']/i,
]
for (const file of files.filter((name) => !/(?:package-lock|requirements\.lock)\.txt$|package-lock\.json$/i.test(name))) {
  let body = ''
  try { body = await readFile(file, 'utf8') } catch { continue }
  for (const pattern of patterns) if (pattern.test(body)) throw new Error(`possible committed secret in ${file}`)
}
process.stdout.write('secret and media invariants passed\n')
