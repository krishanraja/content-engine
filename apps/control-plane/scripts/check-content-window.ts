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

console.log(fail === 0
  ? 'PASS  the purge uses the deck window and ages every decision kind'
  : `${fail} FAILURE(S)`)
process.exit(fail ? 1 : 0)
