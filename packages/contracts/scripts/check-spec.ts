import { readFileSync } from 'node:fs'
import { ProductionSpecV2Schema } from '../src/production-spec.js'

/** ve's single schema gate. Usage: tsx packages/contracts/scripts/check-spec.ts <spec.json> [--normalized]
 *  Exit 0 and (with --normalized) print the spec with defaults applied; exit 1 with one line per issue. */
const [path, flag] = process.argv.slice(2)
if (!path) { console.error('usage: check-spec.ts <spec.json> [--normalized]'); process.exit(2) }
let raw: unknown
try { raw = JSON.parse(readFileSync(path, 'utf8')) } catch (error) { console.error(`${path}: not readable JSON (${(error as Error).message})`); process.exit(2) }
const parsed = ProductionSpecV2Schema.safeParse(raw)
if (!parsed.success) {
  for (const issue of parsed.error.issues.slice(0, 20)) console.log(`SCHEMA ${issue.path.join('.') || '(root)'}: ${issue.message}`)
  if (parsed.error.issues.length > 20) console.log(`SCHEMA ... and ${parsed.error.issues.length - 20} more`)
  process.exit(1)
}
if (flag === '--normalized') console.log(JSON.stringify(parsed.data))
