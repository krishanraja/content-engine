// "Not yet", as an exception.
//
// Its own module, importing NOTHING, and that is load-bearing. The batch
// transport in batch.ts imports the Supabase client, and _supabase.ts throws at
// module scope when the service credentials are missing — the same trap
// _meter.ts documents. expand.ts and panel.ts both have to recognise a
// deferral, and both are imported by the test suite and by check-judges.ts on
// machines with no database at all. A sentinel that drags a database client in
// behind it would take every one of those down.

/** Thrown by a batched transport when the reply has not come back yet.
 *
 *  It is NOT a failure. The ladder unwinds, the idea is left exactly as it was,
 *  and the next tick walks it again with the answer in hand. Anything that
 *  catches broadly — the panel turning an unreachable judge into an abstention,
 *  the expansion recording `the expansion call failed` — must re-throw this, or
 *  a whole sweep records nine abstentions per idea and reports the shape of a
 *  run that judged everything. */
export class DeferredCall extends Error {
  readonly deferred = true
  constructor(readonly key: string, readonly agent: string) {
    super(`deferred:${agent}`)
    this.name = 'DeferredCall'
  }
}

export function isDeferred(e: unknown): e is DeferredCall {
  return Boolean(e) && (e as DeferredCall).deferred === true
}
