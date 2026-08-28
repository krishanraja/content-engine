import { readFile } from 'node:fs/promises'

const config = JSON.parse(await readFile(new URL('../config/studio.json', import.meta.url), 'utf8')) as { series: Record<string, { public_name: string }> }
const names = Object.values(config.series).map((series) => series.public_name).sort()
const expected = ['Built With AI', 'The Money of AI'].sort()
if (JSON.stringify(names) !== JSON.stringify(expected)) throw new Error(`public series names drifted: ${names.join(', ')}`)
if (Object.values(config.series).some((series) => /^paid$|^built$/i.test(series.public_name))) throw new Error('legacy public series name found')
process.stdout.write('public copy invariants passed\n')
