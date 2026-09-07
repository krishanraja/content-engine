# Portable Studio session contract

## Outcome

Any supported LLM or Control Center can become a window into the same Video and Carousel Studio. The client supplies judgement and conversation. The engine owns commands, reviews, feedback provenance, and learning state.

Connecting this repository is necessary but not sufficient. Repository instructions make the engine discoverable. A tracked remote MCP session supplies authenticated capabilities and durable event capture.

## Authority

| State | Allowed behavior |
|---|---|
| `tracked` | Use only the capabilities returned by `studio.session.open`. Gateway actions are recorded idempotently. |
| `read_only_untracked` | Read repository guidance and reason about supplied material. Do not mutate jobs, decide reviews, or claim learning capture. |
| Gateway unavailable | Fail as read-only. Never create a local or client-specific memory store. |

GitHub owns code and versioned configuration. Control Center and Supabase own safe session and learning projections. The Windows runner and local append-only job ledger own exact media execution. Google Drive owns intake and approved archives.

## Session start

1. Read `AGENTS.md` and this file.
2. Call `studio.capabilities` if the client exposes it.
3. Call `studio.session.open` with the client name and current repository revision.
4. Display the tracking state and capability limitations before the first mutation.
5. Use the returned `session_id` for every later Studio tool call.

The session actor is always `Krish`. A client must not infer another public name from account metadata.

## Continuous capture

The gateway records the engine action as part of the same transaction that performs or queues it. Learning does not depend on the model remembering an end-of-chat hook.

Capture only:

- tool-backed actions and their idempotency keys;
- exact artifact hashes and bounded structured differences;
- an exact user excerpt only when it is explicitly relevant feedback;
- a concise inferred rationale, confidence, scope, and confirmation state;
- client, session, job, tool, and request-hash provenance.

Never capture:

- a whole ChatGPT, Claude, Codex, or Control Center transcript;
- raw media, full production transcripts, local paths, secrets, OAuth state, customer records, or command output;
- hidden reasoning or a model-generated claim that Krish expressed a preference.

Silence is not feedback. Unedited acceptance is weak positive evidence. Explicit praise is strong positive evidence. Rejection with a reason and a confirmed correction are strong evidence.

## Feedback confirmation

Portable feedback receipts use:

`studio-user-confirmation:<client>:feedback:<event_hash>:<human-readable receipt>`

Previously stored `codex-user-confirmation` receipts remain valid. A new client must never generate the legacy prefix.

The same portable form is accepted at every approval gate: `studio-user-confirmation:<client>:<gate>:<artifact_hash>:<human-readable receipt>`, where `<client>` is a lowercase token (a letter followed by 1 to 39 letters, digits or hyphens). Legacy `codex-user-confirmation:<gate>:<hash>:` and `control-center-confirmation:<gate>:<hash>:` receipts remain valid. A reference bound to another gate or hash, or with a malformed client segment, is not a confirmation. The shared check is `confirmationRefMatches` in `@mindmake/contracts`.

Low-confidence inference remains `observation_only`. A confirmed correction may create a narrow rule proposal. Scope broadening still requires three confirmed instances across at least two jobs plus separate approval. Performance proposals require three comparable tests and may never infer personal taste.

## Session close and recovery

Call `studio.session.close` when the client can do so. The response is a receipt containing the event count, observation count, pending confirmations, and event-chain hash.

Session closure is not the source of truth for capture. An inactivity sweeper may close abandoned sessions because every action has already been written continuously.

## Client behavior

- Codex reads `AGENTS.md` and the project `.codex/config.toml`.
- Claude Code reads `CLAUDE.md` and `.mcp.json`.
- Claude.ai, Claude Desktop, ChatGPT, and other remote clients connect to the same HTTPS MCP endpoint through their connector settings.
- Control Center calls the same internal service functions as MCP. It must not maintain a different learning path.

Consumer clients may require a one-time connector approval. GitHub access alone does not grant Studio mutation capabilities.

## Local client setup

Set `VIDEO_STUDIO_MCP_TOKEN` in the process environment before starting Codex or Claude Code. The committed client files read the token from that environment and never place it in GitHub.

Claude.ai and ChatGPT require the separately released OAuth connector. Until that release exists, those clients may read and reason from the repository but must report `read_only_untracked`; they must not reuse the local bearer token.
