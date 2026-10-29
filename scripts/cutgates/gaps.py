"""Joins in gaps: the one rule every route uses to say where a cut may join.

F09 (27 Oct): speech joins were cut on one transcriber's timings with 2 ms fades, about 10 ms after the end of
"all"; Krish rejected the ten-join reel ("clipping after answered all the"). The rule (config/gates.json, joins):
a join sits in a gap between words that every aligner agrees on, at least 80 ms wide, with at least 30 ms between
the join and the word on each side. A gap every aligner agrees on is time no aligner heard a word in.

    joins_in_gaps(joins, {'faster-whisper': words, 'scribe': words}) -> report

`joins` are seconds on the same clock as the words (a finished cut and the words heard in it, or a take and its
words before a render: ve conform calls this on the take's clock). Words are {w, s, e} in seconds. With one
aligner the report says "single aligner": nothing is claimed about agreement it did not measure.
"""
from __future__ import annotations

import math

from . import settings

MACHINE = 'scripts/cutgates/gaps.py'
VERSION = 'joins-in-gaps/1'


def _timed(words):
    out = []
    for w in words or []:
        s, e = w.get('s'), w.get('e')
        if isinstance(s, (int, float)) and isinstance(e, (int, float)) and math.isfinite(s) and math.isfinite(e) and e >= s:
            out.append({'w': str(w.get('w', '')).strip(), 's': float(s), 'e': float(e)})
    return sorted(out, key=lambda w: (w['s'], w['e']))


def _clock(t):
    if t is None or not math.isfinite(t):
        return 'the edge of the file'
    return f'{int(t // 60)}:{t % 60:06.3f}'


def agreed_gaps(aligners: dict, start: float = 0.0, end: float | None = None) -> list[dict]:
    """The gaps every aligner agrees on: the complement of every word any aligner heard, between start and end
    (end None runs to the last word and past it). Each gap names the word before and after it and who heard them."""
    spans = sorted(({**w, 'by': name} for name, words in aligners.items() for w in _timed(words)), key=lambda w: w['s'])
    gaps, cursor, before = [], start, None
    for w in spans:
        if w['s'] > cursor:
            gaps.append({'from_s': cursor, 'to_s': w['s'], 'before': before, 'after': w})
        if w['e'] > cursor:
            cursor, before = w['e'], w
    gaps.append({'from_s': cursor, 'to_s': math.inf if end is None else end, 'before': before, 'after': None})
    return [g for g in gaps if g['to_s'] > g['from_s']]


def _speech_at(aligners, t):
    return [{**w, 'by': name} for name, words in aligners.items() for w in _timed(words) if w['s'] < t < w['e']]


def _near(aligners, t):
    """The word that ends last before t and the one that starts first after it, over every aligner."""
    words = [{**w, 'by': name} for name, words in aligners.items() for w in _timed(words)]
    before = max((w for w in words if w['e'] <= t), key=lambda w: w['e'], default=None)
    after = min((w for w in words if w['s'] >= t), key=lambda w: w['s'], default=None)
    return before, after


def _word(w):
    return None if w is None else {'word': w['w'], 's': round(w['s'], 3), 'e': round(w['e'], 3), 'heard_by': w['by']}


def joins_in_gaps(joins, aligners: dict, *, min_gap_ms: float | None = None, clearance_ms: float | None = None,
                  start: float = 0.0, end: float | None = None) -> dict:
    """Every join against the gaps every aligner agrees on. A join fails when it sits inside a word any aligner
    heard, or in a gap narrower than min_gap_ms, or nearer than clearance_ms to the word on either side. Each
    failure names the join's time and the words around it."""
    rule = settings.rule('joins')
    min_gap = float(rule['min_gap_ms'] if min_gap_ms is None else min_gap_ms) / 1000
    clear = float(rule['clearance_ms'] if clearance_ms is None else clearance_ms) / 1000
    names = [n for n, words in aligners.items() if _timed(words)]
    report = {'machine': MACHINE, 'version': VERSION, 'rule': {'min_gap_ms': min_gap * 1000, 'clearance_ms': clear * 1000},
              'aligners': names, 'agreement': settings.mode(names) if names else 'no aligner', 'joins': [], 'failed': []}
    if not names:
        report.update(status='fail', reason='no aligner heard any words, so no join can be placed in a gap')
        return report
    live = {n: aligners[n] for n in names}
    gaps = agreed_gaps(live, start, end)
    for raw in joins:
        t = float(raw['time_s'] if isinstance(raw, dict) else raw)
        before, after = _near(live, t)
        row = {'at_s': round(t, 3), 'at': _clock(t), 'before': _word(before), 'after': _word(after)}
        inside = _speech_at(live, t)
        gap = next((g for g in gaps if g['from_s'] <= t <= g['to_s']), None)
        if inside or gap is None:
            heard = inside[0] if inside else (before or after)
            row.update(status='fail', gap_ms=0.0,
                       message=(f'join at {row["at"]} sits inside "{heard["w"]}" ({heard["s"]:.3f} to {heard["e"]:.3f} s, '
                                f'heard by {heard["by"]}): ' + _around(before, after)))
        else:
            width = gap['to_s'] - gap['from_s']
            lead, tail = t - gap['from_s'], gap['to_s'] - t
            row.update(gap_ms=round(width * 1000, 1) if math.isfinite(width) else None,
                       clearance_before_ms=round(lead * 1000, 1) if math.isfinite(lead) else None,
                       clearance_after_ms=round(tail * 1000, 1) if math.isfinite(tail) else None)
            problems = []
            if width < min_gap - 1e-9:
                problems.append(f'the gap is {width * 1000:.0f} ms, under {min_gap * 1000:.0f} ms')
            if lead < clear - 1e-9:
                problems.append(f'{lead * 1000:.0f} ms after the word before, under {clear * 1000:.0f} ms')
            if tail < clear - 1e-9:
                problems.append(f'{tail * 1000:.0f} ms before the word after, under {clear * 1000:.0f} ms')
            row['status'] = 'fail' if problems else 'pass'
            if problems:
                row['message'] = f'join at {row["at"]}: {"; ".join(problems)}: ' + _around(before, after)
        report['joins'].append(row)
    report['failed'] = [r for r in report['joins'] if r['status'] == 'fail']
    report['status'] = 'fail' if report['failed'] else 'pass'
    if report['failed']:
        who = (f'single aligner, {names[0]}' if len(names) == 1 else f'the gap {", ".join(names)} all agree on')
        report['reason'] = f'{len(report["failed"])} of {len(report["joins"])} join(s) are not in a clear gap ({who})'
    return report


def _around(before, after):
    said = [f'after "{before["w"]}" (ends {before["e"]:.3f} s, {before["by"]})' if before else 'at the start',
            f'before "{after["w"]}" (starts {after["s"]:.3f} s, {after["by"]})' if after else 'at the end']
    return ', '.join(said)


def summary(report) -> str:
    if report.get('status') == 'pass':
        return f'every join is in an agreed gap ({report.get("agreement")})'
    named = [r['message'] for r in report.get('failed') or []]
    more = f' (and {len(named) - 6} more)' if len(named) > 6 else ''
    return f'{report.get("reason")}: {"; ".join(named[:6])}{more}' if named else report.get('reason', 'joins not checked')
