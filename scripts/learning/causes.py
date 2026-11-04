"""Why a failure mode kept happening, traced deterministically first (Krish, 2026-11-04: "trace them back to why it
actually kept occurring (i.e the creative brief was not strong enough, the session did not check in on a specific
skill or standard before starting, etc)").

Each cause cites the field it rests on, so a reader can check it:
  standard_not_read  an incident's preflight receipt was missing or lacked the floor or failure read for its work;
                     or a register entry's cause says the standard was never read or checked first
  check_missing      the mode's failure entry is open, or guarded by markers alone (no guard names a `test`)
  brief_gap          an incident's brief_score is low, or the cause names the brief or the creative direction
  standard_missing   no floor group and no failure entry covers the mode
  handoff_loss       a Codex card or spec lacked the requirement (maker codex, or the cause names the card or handoff)
  tool_limit         the renderer, a device or a tool could not draw or do it (the cause names it)
  taste_new          his words name something no floor standard or group holds yet
A mode none of these explains is 'unresolved': only those go to the model (the weekly workflow's Claude step), whose
answer must quote an incident field word for word (merge_model) or it is thrown away.
"""
from __future__ import annotations

import json
import re

from . import common

LOW_BRIEF = 60
PATTERNS = {
    'standard_not_read': r"(never|not|didn't|did not|without) (read|check|load|open)\w*|before starting|skipp\w+ the (floor|standard|skill)|"
                         r"checked in|ignored the (rule|standard|floor)|no session read",
    'brief_gap': r'\bbrief\b|creative direction|direction (was|did)|spec (did not|lacked|had no)|narrative lock|no field for',
    'handoff_loss': r'\bcodex\b|\bcard\b.*(lack|miss|without)|hand\s?off|handed (over|to)|handover',
    'check_missing': r'no (gate|check|test|lint|qc)\w* (measured|caught|checked|read|looked|tested)|nothing (checked|measured|caught|tested)|'
                     r'the lint let|no check (yet )?(decodes|reads|measures)',
    'tool_limit': r'renderer|could not (draw|render)|cannot (draw|render)|look-?alike|device (could|can)not|ffmpeg|'
                  r'not (possible|supported) in|limit of the',
}


def _cites(item: dict, field: str, value) -> str:
    return f"{item['source']} {item['id']}.{field}: {json.dumps(value, ensure_ascii=False)[:240]}"


def _receipt_gap(item: dict) -> str | None:
    receipts = item.get('preflight')
    if item['source'] != 'incident':
        return None
    if not receipts:
        return _cites(item, 'preflight', receipts)
    held = {r.get('check') for r in receipts if isinstance(r, dict)}
    missing = [c for c in ('floor', 'failures') if c not in held]
    return _cites(item, 'preflight', sorted(held)) + f' (no {" or ".join(missing)} read)' if missing else None


def deterministic(mode: dict, regs: dict) -> list[dict]:
    """The causes the fields prove, each {cause, evidence}; at most one of each kind, strongest evidence first."""
    failures = {f['id']: f for f in regs['failures']['failures']}
    found: dict[str, str] = {}
    for it in mode['items']:
        gap = _receipt_gap(it)
        if gap:
            found.setdefault('standard_not_read', gap)
        if it['source'] == 'incident' and it.get('brief_score') is not None and float(it['brief_score']) < LOW_BRIEF:
            found.setdefault('brief_gap', _cites(it, 'brief_score', it['brief_score']))
        if it.get('maker') == 'codex':
            found.setdefault('handoff_loss', _cites(it, 'maker', 'codex'))
        for cause, pattern in PATTERNS.items():
            if it.get('cause_text') and re.search(pattern, it['cause_text'], re.I):
                found.setdefault(cause, _cites(it, 'cause', it['cause_text']))
    for fid in mode['failure_ids']:
        f = failures[fid]
        if f.get('cause'):
            for cause, pattern in PATTERNS.items():
                if re.search(pattern, f['cause'], re.I):
                    found.setdefault(cause, f'failures.json {fid}.cause: {json.dumps(f["cause"], ensure_ascii=False)[:240]}')
        if f.get('status') == 'open':
            found.setdefault('check_missing', f'failures.json {fid}.status: "open"')
        elif f.get('status') == 'guarded' and not any(g.get('test') for g in f.get('guards') or []):
            found.setdefault('check_missing', f'failures.json {fid}.guards: {len(f.get("guards") or [])} marker(s), none names a test')
    if not mode['failure_ids'] and (mode['group'] == 'ungrouped' or mode['group'].startswith('theme:')):
        found.setdefault('standard_missing', f'mode {mode["key"]}: group {mode["group"]}, no failure entry')
    taste = taste_new(mode, regs)
    if taste:
        found.setdefault('taste_new', taste)
    order = ('standard_not_read', 'brief_gap', 'check_missing', 'handoff_loss', 'tool_limit', 'standard_missing', 'taste_new')
    return [{'cause': c, 'evidence': found[c]} for c in order if c in found]


def taste_new(mode: dict, regs: dict, threshold: float = 0.08) -> str | None:
    """His words on a live rejection (an incident) that no standard on the floor shares: something new to his taste."""
    standards = [common.tokens(s.get('never_beneath', '')) for s in (regs['floor'].get('standards') or {}).values()]
    for it in mode['items']:
        if it['source'] != 'incident' or it.get('kind') != 'krish_reject' or not it.get('his_words'):
            continue
        words = common.tokens(it['his_words'])
        if words and max((common.cosine(words, s) for s in standards), default=0.0) < threshold:
            return _cites(it, 'his_words', it['his_words'])
    return None


def unresolved(modes: list[dict], traced: dict[str, list[dict]]) -> list[dict]:
    """What the model is asked: only repeating modes no field explains, with each incident's own fields to quote."""
    out = []
    for m in modes:
        if traced.get(m['key']) or not m['repeats']:
            continue
        out.append({'mode': m['key'], 'failure_ids': m['failure_ids'], 'incidents': [
            {k: it.get(k) for k in ('id', 'source', 'on', 'stage', 'kind', 'maker', 'what', 'his_words', 'cause_text', 'preflight',
                                    'brief_score')} for it in m['items']][:20]})
    return out


def merge_model(answers: list[dict], asked: list[dict]) -> dict[str, list[dict]]:
    """The model's causes, kept only when the cause is a known kind and its evidence quotes an asked item's field."""
    from_mode = {a['mode']: a for a in asked}
    kept: dict[str, list[dict]] = {}
    for ans in answers or []:
        mode = from_mode.get(ans.get('mode'))
        cause, quote = ans.get('cause'), str(ans.get('quote') or '').strip()
        if not mode or (cause not in PATTERNS and cause not in ('standard_missing', 'taste_new')) or len(quote) < 12:
            continue
        fields = [str(v) for it in mode['incidents'] for v in it.values() if v]
        if any(quote in f for f in fields):
            kept.setdefault(ans['mode'], []).append({'cause': cause, 'evidence': f'model, quoting: "{quote[:200]}"', 'by': 'model'})
    return kept
