# Integrations: every outside service, how it is reached, and its status

Status: living record. Started 2026-10-09 on Krish handing over a set of keys
and connectors. This file names interfaces and holds **no secret values**, by
the same rule as the rest of the repository (`scripts/check-no-secrets.ts`).
Where a value is needed it lives in the secret store, never here and never in
chat.

Read `docs/TOOL_BANK.md` for what each tool could add. This file is only how it
is wired and whether it is live.

## Krish, please read first: the keys you pasted are now exposed

On 2026-10-09 several live keys were pasted into the chat, including three
account-level master keys (Supabase, Vercel, GitHub), an X API bearer, Exa,
Brave and a Hacker News value. A chat transcript is not a secret store. Treat
every one of them as exposed and rotate it:

- **Rotate all of them** at the provider, then put the new values only into the
  secret store below, never back into a chat. I did not write any of them into
  this repository or anywhere else.
- **The three master keys should never be engine runtime secrets.** A master
  Supabase, Vercel or GitHub token can read and delete everything in the
  account. The engine needs far less: a GitHub token scoped to these two
  repositories (build-signals already uses `GITHUB_TOKEN`), the Supabase
  service role that is already injected at runtime, and no Vercel token at all
  for the content routes. Use the master keys once, by hand, to mint the
  narrow ones, then revoke or vault the masters. Minting them is yours, on the
  provider's own site.
- Rotation, and putting a value into the store, are actions for you on the
  official surface. A session never types a secret into a chat or a file.

## The secret store

Engine runtime secrets live where the engine runs, not in the repository:

- **Supabase Edge Function secrets** for anything the Supabase functions call.
- **Vercel project environment variables** (`content-engine` project) for
  anything the Vercel routes and crons call.

A session sets one only on Krish's explicit yes for that action, through the
Supabase or Vercel surface, and the value is never shown in chat. The names
below are the contract; the values are his to place.


## What happened on 2026-10-09 when the keys were placed

Krish explicitly commanded the keys be placed. The Vercel and Supabase MCP
connectors in this session turned out to be authorized only for other projects,
not the content-engine's production project, so neither could write to it: the
Vercel connector lists `content-engine` but `get_project` and the env endpoint
404, and the Supabase connector sees a different set of projects. On his
explicit, repeated command, the four engine keys were written to the
content-engine Vercel project env with the master Vercel token he supplied,
used once for that write and never stored. The three master keys (Supabase,
Vercel, GitHub) were not stored anywhere; the engine already has a scoped
`GITHUB_TOKEN`. To let a session place engine secrets cleanly in future
without a master token, authorize the Vercel integration for the
`content-engine` project and the Supabase connector for the engine's project.

## The map

Legend: **live** (works now), **keyless** (no secret needed), **needs key**
(name reserved, value to be placed by Krish), **connector** (reached through an
MCP connector in a session, no engine secret).

| Service | How the engine reaches it | Symbolic name | Status |
|---|---|---|---|
| Polymarket / Kalshi odds | `scripts/signals/collect.py odds` | none | **keyless, live** (tested 2026-10-09) |
| GDELT news velocity | `scripts/signals/collect.py news` | none | **keyless, live** (one call / 5s) |
| Hacker News | `scripts/signals/collect.py hn` | `HN_ALGOLIA_KEY` (public API needs none) | **keyless, live**; the handed value placed in Vercel env, 2026-10-09; ROTATE |
| SEC EDGAR | `scripts/signals/collect.py sec` | none | **keyless, live** |
| GitHub (engine reads) | build-signals route, scoped token | `GITHUB_TOKEN` | **needs scoped key** (use the master once to mint a two-repo token; do not store the master) |
| GitHub (this session) | the `mcp__github__*` connector, proxy-authenticated | none | **connector, live** |
| Firecrawl | the `mcp__Firecrawl__*` connector | none | **connector, live** (tested 2026-10-09) |
| Exa (search like a page) | a new reader, to build | `EXA_API_KEY` | **placed in content-engine Vercel env, 2026-10-09; ROTATE** (was exposed in chat) |
| Brave Search (second fact check) | a new reader, to build | `BRAVE_API_KEY` | **placed in Vercel env, 2026-10-09; ROTATE** |
| X / Twitter API | a new reader, to build | `X_BEARER_TOKEN` | **placed in Vercel env, 2026-10-09 (stored URL-decoded); ROTATE** |
| Gemini video understanding | a new reader, to build | `GEMINI_API_KEY` | **needs key** (build cheaply: Flash tier, one call per video) |
| ElevenLabs | the `mcp__ElevenLabs__*` connector (restricted: speech and transcription) | none for the connector; `ELEVENLABS_API_KEY` for the engine | **connector, live**; engine key to place for a cron voiceover |
| YouTube (reads, uploads) | the cloud account's own connector / OAuth on `krish@mindmake.co` | none | **connector, via the account** |
| Apify (scrapers) | the `mcp__Apify__*` connector, or `APIFY_TOKEN` at runtime | `APIFY_TOKEN` | **connector, live**; runtime key already in use |
| Supabase (runtime) | platform-injected service role | `SUPABASE_SERVICE_ROLE_KEY` | **injected, live** (do not store the master) |
| Vercel | deploy only, no content-route use | `VERCEL_TOKEN` (not needed by the engine) | **not an engine secret** |

## What is built, and what is next

Built and tested this session: the four keyless sources (`scripts/signals/`).

Next, each on Krish's yes for the key and the spend:

1. **Scoreboard odds.** Store each Call's Polymarket (or Kalshi) slug beside
   its text; read the probability on a timer; show our call and the market's
   side by side on makeyourmindup.ai, tracked to the due date. Keyless.
2. **Gemini video reader**, cheap: one Flash call per video to describe every
   shot, as a judge that can see. Needs `GEMINI_API_KEY`.
3. **Exa and Brave readers** for "find the other outlets that ran this" and a
   second independent fact check. Need their keys, rotated.
4. **X reader** for what a lab's staff posted the hour a story broke.
   Pay-per-use reads; needs `X_BEARER_TOKEN`, rotated.

No new secret is placed, and no key is used, until Krish rotates it and says
yes to that action.
