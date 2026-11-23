# antislop in content-engine: the adapter

The antislop skills in `.agents/skills/antislop*` are vendored unmodified from
miqdadbadjuber/anti-slop (`VENDORED.md` beside each says which commit). This file
is the only place they are adjusted for this repository. Where this file and an
upstream `SKILL.md` differ, this file wins.

Ruling (Krish, 2026-11-23): install the antislop guardrail (miqdadbadjuber/anti-slop)
in content-engine and internal-auditor.

## Where it sits: a validator after the producer, never a writer

antislop is a check that runs on finished work. It never writes a piece, never picks a
style, a colour, a typeface or a word, and never competes with the skill that made the
work. Upstream says the same of itself: "a filter, not a style guide"; it "does not
impose an aesthetic" and "does not invent direction". The house supplies the direction.

Krish's own rules outrank it, in this order, and a FAIL that would break one of them is
reported as `N/A (house rule: <which>)`, never fixed:

1. Krish's typed rulings and his approved taste (`get_approved_taste`), the rejection
   floor (`python3 scripts/floor.py --format <maker>`) and `config/failures.json`.
2. His voice: krish-voice and its kill list (the voice check), the copy lint
   (`config/copy-lint.json`), the house rules, `docs/CREATIVE_DIRECTION.md`.
3. The brand: `config/brand-palette.json` (`docs/production/BRAND_PALETTE.md`), the brand
   kit, `docs/CAROUSEL-STANDARD.md`, the signed creative direction and its motion style.
4. Then antislop.

Examples of the house winning: capitals on on-screen words and cards are the house look,
so R-06 and the all-caps copy rule do not apply there; the palette, the typeface and the
wordmark come from the brand book, so R-01, R-06, R-20 and R-29 read "set by the brand
book"; the Receipt and the carousel layout are the house's own, so R-05 and R-30 do not
ask for a new one.

## What changes from upstream

- **No mode question.** The mode is fixed here: the check runs on the finished copy or
  visual, inside the producing skill's own check step. Never ask Krish "during or after",
  never read or write `~/.config/antislop/settings.json` or `%APPDATA%\antislop\`, and
  never print the `antislop active:` notice.
- **No audit file and no numbered findings for him to pick.** The PASS/FAIL report goes
  where the producing skill records its checks (the piece's making record, the session's
  verification notes). A FAIL that does not conflict with a house rule is fixed and the
  check run again. A FAIL on words he already approved (his scripts after Approve
  scripts, the thumbnail words he picked, his caption) is never changed: it becomes one
  line on the final review (`config/ve/asks.json`).
- **No asks.** R-23 (ask before creating an asset) and R-37 (direction required) are met
  by the signed narrative lock, the creative direction and the brand book. antislop never
  adds a question to Krish; the only asks are those in `config/ve/asks.json`.
- **Web-only items are N/A on media.** R-24, R-26, R-27, R-28, R-32, R-33, R-34, R-39 and
  R-40, the click-through in R-35, and the Liveliness dials (Block 3, which the signed
  motion style and creative direction already set) apply to an interactive page or app.
  On a card, a cover, a thumbnail, a cut or a caption, report them `N/A (not interactive)`.
- **Never update or install.** The "how to update" section and `npx antislop-ai` are not
  used here. A newer upstream release comes in as a new vendoring commit that records its
  sha in `VENDORED.md`.
- **Left out of the vendored copy:** antislop-human's `contrast-check.py` and
  `contrast-mcp.py`. Its `SKILL.md` falls back to computing contrast by hand when the
  script is absent.

## Which skill reads what

| The finished work | Read |
|---|---|
| Any public words: captions, titles, card text, article metadata, scripts | `antislop` (Block 1 and Block 4 rows that apply), `antislop-copywriting` |
| A card, cover, thumbnail or still | `antislop` (Block 1 R-17, R-18, R-25, R-36, R-38; Block 2), `antislop-ui` |
| A page or app (the control plane, a publish page) | `antislop`, `antislop-ui`, `antislop-layoutmobile`, `antislop-human` |
| Code | `antislop-code` (comments only; it never touches the code) |

## The report

One line per rule that applies, each PASS backed by evidence, each N/A naming why:

```
antislop R-02 PASS: no em dash in the caption or the card text (copy lint clean)
antislop R-17 PASS: every number is on a filed source (fact gate run 2026-11-23)
antislop R-16 FAIL: "world-class" on card 3; rewritten to the mechanism, rechecked PASS
antislop R-06 N/A (house rule: brand book typeface and on-screen capitals)
```

## The deterministic part

The mechanical text bans antislop names that neither the copy lint nor the krish-voice kill
list already held are in the copy lint itself, as the `antislop_` patterns in
`config/copy-lint.json` (an emoji leading a line, four or more capital words shouting in
prose, the hype phrases, a rounded "N+ users" count). `python3 scripts/post-pack/copy_lint.py`
and CI's `scripts/check-public-copy.ts` run them with every other copy rule.
