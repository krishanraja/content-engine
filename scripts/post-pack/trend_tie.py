"""What is actually happening in the world: the trend gate on the Sunday ideas board.

Ruling (Krish, 2026-11-28): "Ultimately that week's ideas, memes, and carousels should be aligned to what is actually
happening in the world."

From the rule's `from` board every open Monday, Wednesday and Friday option, and every open off-day option but the
Saturday good news, carries trend {lane, line, source_url, date}: a lane of the hub's (config/hub-sources.json trends),
one plain line of the trend it follows that is not its so-what, and an https source dated within max_age_days before the
week starts. An option from his own words (source_kind his) or his Inspiration tick (from_inspiration) is his and is
never checked.

Every word reads config/trend-tie.json. It lives apart from idea_checks.py, as lens.py does, so the story engine v5 blind
proof's frozen engine files (config/story-proof.json engine_files) are unchanged.
"""
import json
from datetime import date, timedelta
from pathlib import Path

import idea_checks as ic

ROOT = Path(__file__).resolve().parents[2]
TIE = json.loads((ROOT / 'config' / 'trend-tie.json').read_text(encoding='utf-8'))
LANES = [t['key'] for t in json.loads((ROOT / 'config' / 'hub-sources.json').read_text(encoding='utf-8'))['trends']]
CODE = 'trend'
RULE = '(Ruling, Krish, 2026-11-28: every idea follows what is actually happening in the world; config/trend-tie.json)'


def his(o):
    """An option that is his: placed from his Inspiration tick, or from his own words."""
    return bool(o.get('from_inspiration')) or o.get('source_kind') == 'his'


def problems(o, week, cfg=None):
    """What is wrong with one option's trend, as short phrases; empty when it holds."""
    cfg = cfg or TIE
    t = o.get('trend')
    if not isinstance(t, dict):
        return [f'has no trend: write trend {{lane: one of {", ".join(LANES)}, line, source_url, date}}']
    out = []
    if t.get('lane') not in LANES:
        out.append(f'names trend.lane "{t.get("lane")}", which is not one of {", ".join(LANES)}')
    line = str(t.get('line') or '').strip()
    if len(line.split()) < int(cfg.get('line_min_words', 8)):
        out.append(f'has no trend.line of {cfg.get("line_min_words", 8)} words or more: the trend it follows, in one plain line')
    elif '\n' in line or len(line) > int(cfg.get('line_max_chars', 240)):
        out.append(f'has a trend.line longer than one line ({cfg.get("line_max_chars", 240)} characters at most)')
    elif ic.norm(line) == ic.norm(o.get('so_what') or ''):
        out.append('repeats its so_what as trend.line: say the trend it follows, not what the story means')
    if not str(t.get('source_url') or '').startswith('https://'):
        out.append('has no trend.source_url: an https page that shows the trend')
    try:
        when = date.fromisoformat(str(t.get('date') or '')[:10])
    except ValueError:
        out.append('has no trend.date: the day its source shows the trend (YYYY-MM-DD)')
    else:
        start = date.fromisoformat(str(week))
        oldest = start - timedelta(days=int(cfg.get('max_age_days', 21)))
        if not (oldest <= when <= start):
            out.append(f'has a trend dated {when.isoformat()}, outside {oldest.isoformat()} to {start.isoformat()}: find what is happening now')
    return out


def trend_findings(ideas, week, status=None, before=None, cfg=None):
    """The trend gate lines (code trend), each {code, ref, line}. A day with an answered option is his and is never
    checked, as lens_findings does."""
    cfg = cfg or TIE
    if not cfg or str(week) < str(cfg.get('from') or '9999'):
        return []
    had = ic.keys_on(before) if before is not None else None
    ideas = ideas or {}
    out = []

    def say(ref, line):
        out.append({'code': CODE, 'ref': ref, 'line': f'{CODE}: {ref} {line} {RULE}'})

    days = ideas.get('days') if isinstance(ideas.get('days'), dict) else {}
    for day in ('mon', 'wed', 'fri'):
        opts = [(n, o) for n, o in enumerate(days.get(day) or [], 1) if isinstance(o, dict)]
        if not opts or any(not ic.option_open(ic.status_key(day, True, o), status, had) for _n, o in opts):
            continue
        for n, o in opts:
            if not his(o):
                for p in problems(o, week, cfg):
                    say(f'{day}-{n} ({str(o.get("id") or "")[:8]})', p)
    skip = set(cfg.get('skip_offday_kinds') or [])
    off = ideas.get('offdays') if isinstance(ideas.get('offdays'), dict) else {}
    for day, opts in off.items():
        for o in opts or []:
            if not isinstance(o, dict) or his(o) or o.get('kind') in skip:
                continue
            if not ic.option_open(ic.status_key(day, False, o), status, had):
                continue
            for p in problems(o, week, cfg):
                say(f'off-{day}-{o.get("id")}', p)
    return out
