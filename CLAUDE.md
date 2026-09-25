# Mindmake content engine

This repository is the engine behind Krish's media business: the content
engine in `apps/control-plane/` (ideation, curation, drafting, iteration,
channel copy and the learning ledger) and the Video and Carousel Studio in
`packages/`, `apps/runner/` and `apps/renderer/`. GitHub `main` owns code,
schemas, configuration and instructions; the shared Supabase database owns
live state, including every subchannel's mandate; the Windows runner owns
exact media artifacts and execution history.

Before doing anything here, read `docs/NORTH_STAR.md` and `AGENTS.md`.
`README.md` says which document covers the work in front of you.

Before operating the Studio, also read `docs/ENGINE_SESSION.md`. Then call
`studio.session.open` through the configured `mindmake-studio` MCP server and
inspect the returned capability set. Do not mutate the Studio or claim that
feedback was captured when the gateway reports `read_only_untracked` or is
unavailable; a cloud session is always read-only for the Studio.

On the content engine, an agent session is an observer unless it relays a
decision Krish made in words (`docs/CONTENT_ENGINE.md`, "Driving it from an
agent session"). Never store a whole chat transcript. Record exact feedback
excerpts and structured differences only, through the tools built for them.

The phrase `Video engine` is a narrow launcher outside this repository. Do not
interpret incidental references to video editing as permission to start a
production workflow.
