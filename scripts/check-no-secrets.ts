import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { containsCommittedSecret } from './secret-patterns.js'

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean)
const media = files.filter((file) => /\.(?:mp4|mov|mkv|webm|avi|m4v|m2ts|mts|mxf|wav|mp3|m4a|aac|flac|ogg|opus|srt|vtt|edl|fcpxml|png|jpe?g|webp|gif|avif|heic|tiff?|bmp|sqlite)$/i.test(file))
if (media.length) throw new Error(`runtime media or database files are tracked: ${media.join(', ')}`)

for (const file of files.filter((name) => !/(?:package-lock|requirements\.lock)\.txt$|package-lock\.json$/i.test(name))) {
  let body = ''
  try { body = await readFile(file, 'utf8') } catch { continue }
  if (containsCommittedSecret(body)) throw new Error(`possible committed secret in ${file}`)
}
process.stdout.write('secret and media invariants passed\n')
