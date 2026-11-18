# divergent-thinker on call, at will

divergent-thinker (krishanraja/divergent-thinker) is the fleet's divergent thinking engine: it maps the obvious answers
to a question first, then pushes ideas away from them and from everything already in its archive. Any session in this
repository can ask it, whenever it needs to, through one script:

    python3 scripts/post-pack/divergent.py <op> ...

It reaches Control Center's `POST /api/divergent/content-engine` on the engine's operator key (`ENGINE_OPERATOR_TOKEN`,
the key `humour_check.py` uses). plan-week keeps its own two uses, the day's wildcard and the repeat guard
(`.agents/skills/plan-week/references/divergent.md`); this page is for every other moment.

## The walls

- **It proposes; it decides nothing.** It holds no taste. An at-will answer is for the session to read and is never
  written to a board by the script. Only Krish's presses put anything on a board.
- **An idea it made is the engine's.** An option, angle or line taken from a spark is labelled `source_kind: engine`,
  with `"divergent": {"run_id": "...", "spark": "..."}` where it lands on a record, and is never posed as his. It still
  goes through every gate a written idea goes through: the fact gate, the refute pass, the reviewer.
- **Never generate titles or hooks with it.** Krish rejects obscure lines. Titles stay his pick after he records
  (house rule TITLES_AFTER_RECORDING); the engine only scores a title against what went out.
- **Exit 2 is never a pass:** not served, refused by the chain cap, or no key. Carry on exactly as without it and say
  once which step it skipped.

## When to use each op here

| Moment | Op | Cost |
|---|---|---|
| A piece's angle, before the narrative lock: see the obvious take first | `map --problem "<the piece's question>"` | 1 call |
| The angle he and the room chose, attacked before he signs it | `challenge --problem "..." --idea "<the angle>"` | 3 calls |
| An off-day idea or a wildcard outside plan-week's slot | `provoke --problem "..." --cliche "<a recent title>"` | 2 calls, about $0.15 |
| directed-shoot step 1, "the most ambitious version first" | `provoke --temperament wild --lane shoots`; or `diverge` only on his yes to the spend | 2 calls; diverge about 25 calls, about $1.30, 1 a day |
| A title or hook that feels familiar | `score --problem "..." --ideas-file mine.txt --obvious-file past.txt --lane titles` | free: `obvious` given, no `--judge` |
| After a piece publishes | `record "<title>. <its one-line point>"` (or `--items-file`) | free |

`score` makes no model call only when `--obvious-file` is given and `--judge` is not; otherwise the engine spends calls
to find the obvious or to judge, so the script treats it as paid. Exit 1 from `score` is a flag for a reader, never a
reason to drop a line on the engine's word alone.

## Flags

`--problem` (every op but `record`), `--context`, `--idea` (challenge), `--ideas-file`, `--obvious-file`,
`--items-file` (a JSON list of strings, or plain text with one item a line), `--cliche` (repeatable: worn ground to steer
away from), `--count N` (provoke and diverge, 1 to 8), `--target` (default `writing`), `--temperament`
(`grounded`, `balanced`, `wild`), `--lane NAME` (namespace `content-engine:<lane>`, default `ideas`, which plan-week
reads), `--judge` (score). `bannedWords` is always the kill list's banned vocabulary. Every op prints JSON. Exit 0 done,
1 flagged, 2 not served, capped or no key.

## Costs and the cap

Every paid op (`map`, `provoke`, `challenge`, `diverge`, a judged or unanchored `score`) checks this week's chain spend
first and is refused over the $15 a week chain cap (Ruling, Krish, 2026-11-18; `config/chain-cap.json`, family
`divergent`, metered as agent `divergent-content-engine`). Control Center also holds its own daily limits: 20 quick
calls and $5 a day, and one `diverge` a day. `record` and an anchored `score` are free. See `docs/COST_GUARDS.md`.

## From Krish's own Claude sessions

His own sessions can reach the same engine through the Control Center connector tools `divergent_score`,
`divergent_record` and `divergent_run`, with namespace `content-engine` (or `content-engine:<lane>`). The same walls
hold.
