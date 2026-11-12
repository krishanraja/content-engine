// The came_due notices the claim sweep (resolve.ts) writes: one per claim, ever.
//
// claim_resolutions holds that rule as a partial unique index, claim_resolutions_one_due (claim_id) WHERE
// event = 'came_due'. An upsert naming onConflict 'claim_id' cannot use a partial index, so Postgres refused it
// ("there is no unique or exclusion constraint matching the ON CONFLICT specification") and the sweep failed on
// every run from at least 5 to 12 Nov 2026, noticing nothing. The rows it is given are already the claims with no
// notice, so they are inserted plainly; when a concurrent run noticed one first (unique violation, 23505), each row is
// inserted on its own and the ones already noticed are skipped. A re-run never writes a second notice.

export interface Notice { claim_id: string; event: 'came_due'; due_on: string | null }

interface InsertResult { error: { code?: string; message: string } | null; count: number | null }
export interface NoticeDb {
  from(table: 'claim_resolutions'): { insert(rows: Notice | Notice[], options: { count: 'exact' }): PromiseLike<InsertResult> }
}

const UNIQUE_VIOLATION = '23505'

/** Writes each notice once and returns how many landed. Any error but a duplicate notice throws. */
export async function recordNotices(db: NoticeDb, rows: Notice[]): Promise<number> {
  if (!rows.length) return 0
  const all = await db.from('claim_resolutions').insert(rows, { count: 'exact' })
  if (!all.error) return all.count ?? rows.length
  if (all.error.code !== UNIQUE_VIOLATION) throw new Error(all.error.message)
  let noticed = 0
  for (const row of rows) {
    const one = await db.from('claim_resolutions').insert(row, { count: 'exact' })
    if (!one.error) noticed += one.count ?? 1
    else if (one.error.code !== UNIQUE_VIOLATION) throw new Error(one.error.message)
  }
  return noticed
}
