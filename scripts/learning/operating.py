"""The floor's operating standards: the ones about how sessions work with Krish, never taste (config/floor-groups.json
`operating`). The backfill reconciles each against the rules the repository holds now:

  contradicted  a later ruling of his says otherwise (CONTRADICTIONS: the ruling, its date, where it lives); the
                standard is older than the ruling
  covered       AGENTS.md or docs/AGENTS-REFERENCE.md already holds it (the paragraph whose words it shares most)
  live          neither: a standing rule with no home yet, for the loop to give one

Read-only: it proposes, and Krish decides what moves.
"""
from __future__ import annotations

import re

from . import common

# A later ruling and the standards it overturns. Each pattern is matched against the standard's own words.
CONTRADICTIONS = [
    {'pattern': r'merge by hand|merged? .{0,20}by hand|manual(ly)? merg',
     'ruling': 'Ruling, Krish, 2026-11-03: "Change everything to auto-merge all the time. No manual merging"',
     'on': '2026-11-03', 'where': 'AGENTS.md, Commit and closeout'},
    {'pattern': r'(keep|never drop) .{0,40}artifact|workroom artifact',
     'ruling': 'Krish, 2026-10-19: no Claude artifact, ever; the board is the web page at content.krishraja.com',
     'on': '2026-10-19', 'where': 'AGENTS.md rule 03 (docs/AGENTS-REFERENCE.md#rule-03)'},
    {'pattern': r'context (limit|nudge)|hand(ing)? over .{0,30}context',
     'ruling': 'Ruling, Krish, 2026-11-03: "Remove that stupid fucking limit as well" (cost guard G1 removed)',
     'on': '2026-11-03', 'where': 'docs/COST_GUARDS.md, G1'},
]
COVERED = 0.5


def _paragraphs() -> list[tuple[str, str]]:
    out = []
    for name in ('AGENTS.md', 'docs/AGENTS-REFERENCE.md', 'CLAUDE.md'):
        path = common.ROOT / name
        if not path.is_file():
            continue
        for para in re.split(r'\n\s*\n', path.read_text(encoding='utf-8')):
            text = para.strip()
            if len(text) > 60:
                out.append((name, text))
    return out


def classify(regs: dict) -> list[dict]:
    groups = regs.get('groups') or {}
    members = (groups.get('operating') or {}).get('members') or []
    standards = regs['floor'].get('standards') or {}
    paras = [(name, text, common.tokens(text)) for name, text in _paragraphs()]
    out = []
    for sid in members:
        s = standards.get(sid)
        if not s:
            continue
        rule = s.get('never_beneath', '')
        latest = max([str(w.get('on') or '') for w in s.get('his_words') or [] if isinstance(w, dict)] or [''])
        row = {'id': sid, 'rule': rule, 'said_last': latest}
        hit = next((c for c in CONTRADICTIONS if re.search(c['pattern'], rule, re.I) and (not latest or latest < c['on'])), None)
        if hit:
            out.append({**row, 'state': 'contradicted', 'by': hit['ruling'], 'where': hit['where']})
            continue
        words = common.tokens(rule)
        best = max(((common.containment(words, toks), name, text) for name, text, toks in paras), default=(0.0, '', ''))
        if best[0] >= COVERED:
            first = re.sub(r'\s+', ' ', best[2])[:110]
            out.append({**row, 'state': 'covered', 'by': f'{best[1]}: "{first}..." (shares {round(100 * best[0])}% of its words)',
                        'score': round(best[0], 2)})
        else:
            out.append({**row, 'state': 'live', 'by': None, 'score': round(best[0], 2)})
    return out
