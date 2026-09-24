# The three-piece walk

A live log of taking one ready idea per subchannel from "judged ready" to the
edge of publishing, driven from a Claude Code session straight against the
engine's API rather than through Control Center. The point is to harden the
backend first and to leave durable knowledge for the front-end work that
follows, so nobody has to sift a chat transcript to learn what the engine
actually does.

Started 2026-09-24. Pieces are walked in series: the first finds the
structural holes, the second shows which were one-offs, the third proves the
path repeats.

**How to read this.** Four running sections sit above the per-piece logs and
are kept current as the walk goes:

1. *What the backend actually does*: verified behaviour, route by route, with
   the evidence. Code that was read counts as a claim until a live call has
   confirmed it, and each entry says which.
2. *Hardening*: every engine change made during the walk, with its commit.
3. *Front-end implications*: what Control Center must change, and why, stated
   so a front-end session can act on it without this conversation.
4. *Open questions for Krish*: decisions that are his, never settled here.

Each step in a piece's log records one of three outcomes: **works** (note it),
**missing** (build it), **wrong** (fix it).

---

## 1. What the backend actually does

### Reaching it

- Production API: the `content-engine` Vercel project. Control Center reaches
  it through a proxy or rewrite (see section 3 once confirmed).
- **Auth is split in two, and half the surface has none.** Verified
  2026-09-24 by reading every handler under `api/content-ideas/` and by live
  probe:
  - `guard()` (`api/_auth.ts`) checks the `cc_access` cookie, which is a
    sha256 of the dashboard access code. It fails open only when that env var
    is unset; it is set in production (a POST to `judge` for a nonexistent id
    returned 401). Routes using it: `challenge`, `dive-deeper`,
    `editorial-route`, `judge`, `production-brief`, `archive-stale`,
    `cluster`.
  - `preamble()` (`api/_content.ts:690`) checks only the HTTP method and sets
    `Access-Control-Allow-Origin: *`. It has **no auth**. Routes using it:
    `channel-cut`, `chat`, `deepen`, `final-pass`, `materials`, `revise`,
    `save-draft`, `schedule`, `score`, `video-script`, `research-topic`,
    `synthesize`, `voice`. Several call models (`revise` names
    `claude-opus-4-8`) and several write rows. Anyone holding the URL can
    spend on the Anthropic key or overwrite a draft.
- This session holds no dashboard access code and no Anthropic key. It does
  hold the Supabase service role, so reads and verification go straight to
  the database.

## 2. Hardening

| # | Change | Why | Commit |
|---|---|---|---|
| | | | |

## 3. Front-end implications

- *(pending)*

## 4. Open questions for Krish

- *(none yet)*

---

## Piece 1: split.the.bill

`6cb0d213-1aa6-44d3-8dc2-0b91d8dde4df`. "Amazon's takedown of Muse is a
pricing dispute wearing a security notice." Panel 7, three model judges at 8,
lowest model judge 7; the only fault the panel named is the deterministic
voice check (an em dash or banned phrase in the angle).

| Step | Call | Result | Spend | Outcome |
|---|---|---|---|---|
| | | | | |

## Piece 2: mind.the.gap

`904658db-4df2-4537-a0ed-ebe93e081db7`. "Every AI lab now sells a menu instead
of a model, and the menu is the price list." Four model judges at 8; lowest
model judge `consequence` at 3. First live test of the missing mind.the.gap
corpus playbook.

## Piece 3: lift.the.lid

`5255dcd8-3772-420d-994c-6bf2ab5f06e3`. Salesforce's Koa
split. No judge at 8; lowest model judge `novelty` at 6.
