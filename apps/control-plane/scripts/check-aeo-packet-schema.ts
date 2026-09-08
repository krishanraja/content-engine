// The packet contract, in three repositories.
//
// docs/AEO-PACKET.schema.json here, docs/packet.schema.json in
// krishanraja/AEO-Engine, and api/_aeo.ts are one contract in three places.
// The engine writes packets against its copy and _aeo.ts validates them
// against this one, so a field added to one and not the other is a 400 on a
// Sunday morning with no digest and nothing on the tab to say why. This holds
// the schema and the validator to each other; the AEO-Engine copy is checked
// by eye at review (they are byte-identical when copied).
//
// This is the server half of Control Center's check-aeo-read, split when
// api/_aeo.ts moved here. The other half, which holds the sentences the
// Signals section says to fixtures, stays there with src/lib/aeo.ts. Each half
// runs in the repo that holds its inputs.
//
//   npx tsx scripts/check-aeo-packet-schema.ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { AEO_ENGINES, AEO_THEMES_STATUSES, SUBJECT_KINDS } from '../api/_growth.js'
import { PACKET_SCHEMA_VERSION, MAX_QUERIES, MAX_PROBES, MAX_RECOMMENDATIONS } from '../api/_aeo.js'

const schema = JSON.parse(readFileSync(new URL('../../../docs/AEO-PACKET.schema.json', import.meta.url), 'utf8'))
assert.equal(schema.properties.schema_version.const, PACKET_SCHEMA_VERSION, 'the schema and the validator agree on the version')
assert.equal(schema.properties.queries.maxItems, MAX_QUERIES)
assert.equal(schema.properties.recommendations.maxItems, MAX_RECOMMENDATIONS)
assert.ok(MAX_PROBES > 0)
assert.deepEqual([...schema.$defs.kind.enum].sort(), [...SUBJECT_KINDS].sort(), 'subject kinds agree')
assert.deepEqual([...schema.$defs.engine.enum].sort(), [...AEO_ENGINES].sort(), 'engines agree')
assert.deepEqual([...schema.properties.themes_status.enum].sort(), [...AEO_THEMES_STATUSES].sort(), 'theme statuses agree')
for (const key of ['schema_version', 'run_id', 'subject', 'week_start', 'engines', 'themes_status', 'queries', 'recommendations', 'stats']) {
  assert.ok(schema.required.includes(key), `the schema requires ${key}`)
}

console.log('PASS  the packet schema and the ingest validator agree on version, caps and every enum')
