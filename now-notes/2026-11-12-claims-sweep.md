Status: The daily claim sweep (`/api/claims/resolve`, job `claims_resolve`) writes its came_due notices with a plain insert (`api/claims/_notice.ts`): its upsert named `onConflict: 'claim_id'`, which the partial unique index `claim_resolutions_one_due` cannot serve, so every run from at least 5 to 12 Nov failed and noticed no claim that came due. A notice a concurrent run wrote first is skipped, so a re-run still never writes a second one.
Next: The 07:00 UTC run on 13 Nov reads back `ok` in `content_engine_runs`, with its newly noticed count.
North Star check (2026-11-12): holds.
