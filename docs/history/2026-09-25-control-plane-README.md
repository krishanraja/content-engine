> **Historical.** Archived 2026-09-25 by hand, doing the docs steward's job at Krish's request. Not current guidance.
> Replaced by: `docs/CONTENT_ENGINE.md` (and a short `apps/control-plane/README.md` that points to it)
> Reason: its route table left out the judge ladder and sweep, learning, trends, claims, AEO, inspiration and the edit ledger; it never mentioned `guardEngine` or the routes still on `preamble`; and it said every scheduled route is guarded by `CRON_SECRET`, which is not uniformly true.

# Content Engine control plane

The editorial, production-brief and studio HTTP surface. It runs as its own
Vercel project from this directory and Control Center reaches it through
rewrites, so every URL the browser, the Windows runner and the MCP clients
already use is unchanged.

Before 2026-09-08 this code lived in `krishanraja/control-center` under `api/`.
It moved here so the whole Content Engine is one repository to develop in: the
zod contracts, the renderer, the CLI, the runner and now the routes and crons
that drive them.

## What is here

| Path | What it is |
|---|---|
| `api/content-ideas*`, `api/content-decisions`, `api/briefs`, `api/shifts`, `api/arcs`, `api/purge`, `api/triage/sweep.ts` | the editorial spine: capture, Composer, the weekly brief, the shifts register, the Monday purge |
| `api/feed`, `api/content-opportunities`, `api/discover-*`, `api/content-seed-candidates.ts`, `api/content-creators.ts`, `api/investigations` | supply: the headline pool, the two editorial lenses, build signals, the creator scout, the lens radar, investigations |
| `api/video-studio/**` | the Video and Carousel Studio control plane: operator reads, magic-edit commands, the runner claim/heartbeat/complete protocol, preview slots, the production-brief queue and the portable MCP gateway |
| `api/content-engine/health.ts` | what this deployment schedules, when each job last ran, whether the operator guard is configured, and how quiet the runner has been |
| `lib/` | the server-relevant halves of the modules Control Center's UI also holds (`contentEngine`, `contentEngineSchedule`, `contentOutputs`). Each repo's guards compare against its own copy |
| `scripts/check-*.ts` | the structural guards that came with the routes. `npm run check:control-plane` at the repo root runs them |

## Rules that outlive any one route

- **Cron auth.** Every scheduled route is wrapped in `withContentRun` and guarded
  by `CRON_SECRET`. Leave that variable unset and the crons 401 and record
  nothing, which is the only safe state while another deployment still runs them.
- **The operator guard fails open by design.** `hasAccess` lets everyone through
  when `ACCESS_CODE` is unset, matching Control Center's edge gate so a dropped
  variable cannot lock Krish out of his own dashboard. That makes an unset
  variable here dangerous rather than merely broken, so `api/content-engine/health.ts`
  reports `operator_auth_configured` and the cutover readback fails on false.
  `ACCESS_CODE`, `APP_ORIGIN` and `VIDEO_STUDIO_CSRF_SECRET` must be
  byte-identical with the Control Center project.
- **NodeNext, not the root's Bundler resolution.** `tsconfig.json` here
  reproduces how Vercel actually resolves these files: relative imports carry
  `.js` extensions even though the files are `.ts`. A bad specifier is not a
  build failure, it is a `FUNCTION_INVOCATION_FAILED` on the first request.
- **Schema history lives in Control Center** up to 2026-09-08; see
  `../../supabase/migrations/ORIGIN.md`. New content and studio DDL is written
  here and applied through the Supabase MCP, never `supabase db push`.

## Running it

There is no local dev server: these are Vercel functions. Typecheck with
`npm run typecheck:control-plane` from the repo root, run the guards with
`npm run check:control-plane`, and exercise a single handler with
`npx tsx scripts/run-endpoint.ts`. `npm run verify` at the root includes both.
