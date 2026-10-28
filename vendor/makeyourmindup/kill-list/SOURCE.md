# makeyourmindup's kill list, vendored

The deterministic gate from makeyourmindup's editorial canon: em dashes,
exclamation marks, retired names, Mindmake and CTRL inside an editorial piece,
corporate filler and closing morals. No model, no network, no secrets. The
make-piece skill runs it on the scripts and the public copy before any paid
call, beside the copy lint (`scripts/post-pack/copy_lint.py`). makeyourmindup
owns the rules; content-engine only runs them (plan of 28 Oct 2026, W2).

    node vendor/makeyourmindup/kill-list/kill-list.mjs <paths...>
    node vendor/makeyourmindup/kill-list/kill-list.mjs --stdin < script.md

Exit 1 on any veto. Warnings never fail the run.

## Where it came from

- Repository: `krishanraja/makeyourmindup`
- Commit: `54cd67d7795499e259fa4c400448b3e0bf809484` (main, 28 Oct 2026)
- The three files last changed upstream in `9fe587e882d882ac4bf8f8dc3d367626280c13d2` (19 Oct 2026)
- Rules version: `kill-list.v1`, adopted 2026-09-17

| Vendored file | Upstream path | Upstream sha256 | Vendored sha256 |
|---|---|---|---|
| `kill-list.mjs` | `scripts/qa/kill-list.mjs` | `7b01f7744dadc9841acaa7649514742a029b37ded0c7d1a00c34d9e9734e38cc` | `724cd41b104e5f6bbea4fa21228539e5b890dbbb6ecd4d9358da0d972fe6939c` |
| `kill-list.v1.json` | `quality/panel/kill-list.v1.json` | `70bc74ecad554fa94029c88b8c837d147d93dff2313ab142328dfb4a8c729fc1` | `70bc74ecad554fa94029c88b8c837d147d93dff2313ab142328dfb4a8c729fc1` |
| `kill-list-self-test.mjs` | `scripts/qa/kill-list-self-test.mjs` | `827b7120d21bd0be4387e7399d3d0dd8d24d3aac2e86442dc5441176363bd512` | `827b7120d21bd0be4387e7399d3d0dd8d24d3aac2e86442dc5441176363bd512` |

## The one local change

Upstream, the gate reads its rules two folders up. Here they sit beside it, so
one line of `kill-list.mjs` differs and nothing else does:

- Upstream line: `const RULES = JSON.parse(readFileSync(join(HERE, '../../quality/panel/kill-list.v1.json'), 'utf8'))`
- Vendored line: `const RULES = JSON.parse(readFileSync(join(HERE, 'kill-list.v1.json'), 'utf8'))`

`tests/vendor-kill-list.test.ts` checks every vendored file against its hash
here, puts the upstream line back and checks the upstream hash too, so no other
change can hide, and runs the upstream self-test on the vendored copy.

## Updating it

Never edit the rules here: a rule changes in makeyourmindup, its canon, and is
vendored again. To take a newer version, copy the three files from a newer
makeyourmindup commit, make the one change above, put the commit and the six
hashes in this file, and run `npx vitest run tests/vendor-kill-list.test.ts`.
