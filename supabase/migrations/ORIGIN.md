# Where this schema history lives

The Content Engine's tables (`content_*`, `weekly_briefs`, `shifts`, `shift_evidence`,
`shift_beats`, `arc_cards`, `lens_seed_candidates`, `inspiration_*`, the thirteen
`video_studio_*` tables and the `mindmake_studio_*` learning spine) were created and
altered from `krishanraja/control-center` (`supabase/migrations/` and the legacy
`scripts/migrations/`) up to and including its commit `c3f1443` on 2026-09-08. That
history stays there: later Control Center migrations alter tables these files create,
and several of its guards read that directory.

From the unification onward this directory owns every NEW content and studio DDL
change. The files below dated on or before 2026-09-08 are verbatim copies of already
applied Control Center migrations, kept so the `control-plane-sql` CI job can replay
the studio control plane and its race fixtures on a clean Postgres. Do not reapply
them. Migrations are applied to the live project through the Supabase MCP
`apply_migration` (the applied ledger names them by application time, not by the
file stamp), never with `supabase db push`.
