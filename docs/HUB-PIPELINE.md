# Daily creative edition

The cover reads `GET /api/hub/today` without a key. A successful response is a version 1 snapshot with six subsectors, eight to twelve verified items, Creative 24 prices, Wikipedia attention and up to three public catalogue entries. Each story carries its publisher URL for cited answers. The public route validates the stored payload, serves the newest good edition and allows five minutes of shared caching. An empty or unavailable store returns HTTP 503 with `{"ok":false}` and `no-store`.

| UTC | Protected job | Writes |
| --- | --- | --- |
| 06:00 daily | `GET /api/hub/edition` | Feed health, observed closes and one complete edition |
| 15:00 daily | `GET /api/hub/prices` | Observed closes, ticker and subsector indices on the latest good edition |

`edition_date` stays with the stories. `generated_at` is the refresh time, and each quote and attention measurement has its own `as_of`. The job ledger records both schedules. A lease admits one run per date and mode, with one retry after eleven minutes. A repeated completed run skips. A price update checks the stored revision before writing.

## How an edition earns its place

- [The feed list](../config/hub-sources.json) contains the twelve trade feeds and six British Google News searches. The pipeline reads the last 48 hours, keeps candidates on the creative and sport beats, and groups canonical URLs and titles. One relevance call ranks events and joins further coverage. Repeated mentions of the same outlet name or publisher domain count once.
- After seven consecutive daily checks with no dated stories in the window, a feed rests for a week. The job logs its URL and retry date. A successful probe clears the hold. A gap in monitoring starts a fresh count. One feed can fail without stopping the others.
- The writer reads the publisher's article. When a Google News link needs resolving, the reader follows it to the publisher. Unreadable articles drop out. Each item must pass the existing fact gate on its exact text, show support in the supplied source and pass the draft panel's editorial judges. The job reads the existing weekly spend meter before classification and each writing batch. If fewer than eight items pass, the previous edition stays public.
- A named person's English Wikipedia lead image gets first consideration. The job checks for a human Wikidata subject, a Commons file, an allowed licence and an artist credit. Accusations skip portraits. A company's photo can come from its page or a Commons depicts search. The site can render type when the search finds no suitable photo. The first three positions may otherwise receive a photoreal editorial brief. `generateStill(brief)` returns that brief with a null URL for the separate Codex image run.
- Attention compares yesterday, the latest complete UTC day, with the preceding 30 complete days. A positive baseline and a threefold increase set `spiking`. A missing measurement can retain that entity's previous dated observation. Wikimedia requests share one throttle.
- [The stock universe](../config/hub-stocks.json) assigns each of the 24 companies to one subsector. Yahoo supplies a month of daily closes and the latest quote. An open-session quote can update the ticker at 15:00. Only finished closes go into `hub_price_closes`. Pence convert to pounds. A missing symbol has `missing: true`, with its last dated price if available, otherwise null. Each series starts at 100 with equal capital per eligible stock in its own currency. It uses a common opening observation, carries prices over exchange holidays and excludes late listings from the monthly basket.

## Run locally

From the repository root with Node 24, run `npm ci`. The offline suite exercises discovery, editorial holds, snapshot readback, prices and failure recovery with fixture transports.

```sh
npm test -- tests/control-plane/hub-data.test.ts tests/control-plane/hub-pipeline.test.ts
npm run typecheck
npm run typecheck:control-plane
```

For a local HTTP run, point the control plane at a development Supabase database with the engine schema and apply `supabase/migrations/20261126060358_daily_hub.sql` there. Supply the existing server-side database, cron, writer and independent fact-check credentials from the control plane's environment example. The full daily route uses metered model calls. Run `vercel dev` from `apps/control-plane` with those development settings. From another PowerShell window, with the same local cron secret:

```powershell
$headers = @{ Authorization = "Bearer $env:CRON_SECRET" }
Invoke-RestMethod http://localhost:3000/api/hub/edition -Headers $headers
Invoke-RestMethod http://localhost:3000/api/hub/today
Invoke-RestMethod http://localhost:3000/api/hub/prices -Headers $headers
```

The first successful daily run seeds the public endpoint. The 15:00 route requires an existing edition. Look at `hub_feed_health`, `hub_runs` and the two entries in `content_engine_runs` to diagnose a hold.
