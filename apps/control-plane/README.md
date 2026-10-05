# apps/control-plane

The content engine: every route, cron and structural guard behind the Content
tab in Control Center, deployed as its own Vercel project (`content-engine`).

Everything about it, route by route (stages, guards, crons, models, spend,
tables, checks and how an agent drives it) is in
[`docs/CONTENT_ENGINE.md`](../../docs/CONTENT_ENGINE.md). Why it exists is in
[`docs/NORTH_STAR.md`](../../docs/NORTH_STAR.md). What works and what is
broken right now is in [`docs/STATE.md`](../../docs/STATE.md).

Working here:

- There is no local dev server. Use `npm run typecheck:control-plane`,
  `npm run check:control-plane`, `npm test` and `scripts/run-endpoint.ts`
  from the repository root.
- Imports use NodeNext `.js` specifiers.
- New routes that write or spend use `guardEngine` (or a cron, runner or MCP
  guard), never `preamble`.
- New content or Studio DDL goes in `supabase/migrations/` at the repository
  root; `supabase/migrations/ORIGIN.md` explains the split history.
- Environment variable names are in `.env.example`; values live only on the
  Vercel project.
