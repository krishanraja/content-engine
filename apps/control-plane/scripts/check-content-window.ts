// The purge must keep ageing kinds other than purge_preview, and must use the
// same week window the dashboard's deck uses.
//
// The deck half of this contract stays in Control Center
// (scripts/check-content-window.mts): both sides read the same window, that one
// guards what the deck shows, this one guards what the sweep deletes.
//
// The bug it encodes: the decision queue had no week bound at all, so it served
// the thirty oldest pending cards ever written and the same brief review sat at
// slot 1 for six weeks.
//
//   npx tsx scripts/check-content-window.ts
import { readFileSync } from 'node:fs'
import { queueWindowStart } from '../api/_weeks.js'

let fail = 0
const bad = (m: string) => { console.log('FAIL: ' + m); fail++ }

// The window helpers must still exist and agree with themselves.
if (typeof queueWindowStart !== 'function') bad('api/_weeks.ts no longer exports queueWindowStart')


// 4. The purge must keep ageing kinds other than purge_preview.
{
  const purge = readFileSync('api/purge/run.ts', 'utf8')
  if (!/queueWindowStart\s*\(/.test(purge)) {
    bad('api/purge/run.ts no longer uses queueWindowStart — its boundary and the deck\'s window can now disagree')
  }
  if (!/\.neq\(\s*['"]kind['"]\s*,\s*['"]purge_preview['"]\s*\)/.test(purge)) {
    bad('api/purge/run.ts no longer sweeps decision kinds beyond purge_preview — brief_review cards go immortal again')
  }
  // An aged-out card must not land in the same bucket as one Krish ruled on:
  // 'dismissed' is a judgement, 'archived' is a timeout, and a comparison that
  // conflates them counts the engine's unreviewed output as his rejections.
  if (!/status:\s*['"]archived['"]/.test(purge)) {
    bad("api/purge/run.ts no longer sweeps to 'archived' — timed-out cards would read as Krish's rejections")
  }
}

// The purge is the only hard delete in the engine and it runs unattended, so
// it must never delete rows it could not copy first. A week of un-purged rows
// is untidy; a week of deleted rows with no copy is unrecoverable.
{
  const purge = readFileSync('api/purge/run.ts', 'utf8')
  if (!/exportBeforeDelete\(/.test(purge)) {
    bad('api/purge/run.ts no longer exports rows before deleting them: the one hard delete in the engine is unrecoverable again')
  }
  const exportAt = purge.indexOf('exportBeforeDelete(')
  const deleteAt = purge.indexOf(".delete({ count: 'exact' })")
  if (exportAt < 0 || deleteAt < 0 || exportAt > deleteAt) {
    bad('api/purge/run.ts deletes before it exports, so a failed export still loses the rows')
  }
  if (!/purge_export_failed/.test(purge)) {
    bad('api/purge/run.ts no longer refuses to delete when the export fails')
  }
  const restore = readFileSync('api/purge/restore.ts', 'utf8')
  if (!/ignoreDuplicates: true/.test(restore)) {
    bad('api/purge/restore.ts no longer restores additively, so a restore can clobber work done since the purge')
  }
  if (!/key_must_name_a_purge_export/.test(restore)) {
    bad('api/purge/restore.ts no longer bounds the key to the archive namespace')
  }
}

console.log(fail === 0
  ? 'PASS  the purge uses the deck window, ages every decision kind, and copies before it deletes'
  : `${fail} FAILURE(S)`)
process.exit(fail ? 1 : 0)
