#!/usr/bin/env python3
"""The brand palette guard: one manifest (config/brand-palette.json), every maker held to it.

Krish, 12 Nov 2026: "I want that session to produce a rock-solid palette of brand asset templates that are
able to be used in our weekly calendar and the engine cannot deviate." Then, of the sheet: "I approve the
brand palette sheet, but only if it falls in line with the attached." The attached corpus is
docs/production/SOCIAL-BEST-PRACTICES-2026.md.

A maker describes what it is about to make as a record, and check() says why that record differs from the
palette for its day and format, or returns []. The makers that call it: scripts/quick-edit/make.py (before
any render, beside the sting stop), scripts/produce_day.py (through make.py) and scripts/velib/lint.py (a ve
spec). A record:

    {"date": "2026-11-16", "format": "short_cut", "kind": "series" | "off", "series": "follow_the_money",
     "opening": "hook" | "sting" | "clip", "sting": "none" | "after_hook" | "before_hook",
     "close": {"id": "statement_beat", "seconds": 1.8, "file": "endcard-9x16.mp4"},
     "body": {"icon": false, "wordmark": false, "series_pill": false}}

Keys a maker cannot know are left out and not checked. A record dated before applies_from is not checked
(Fri 13 Nov is made on an engine frozen at its storyboard, F33).

    python3 scripts/brand_palette.py expect --date 2026-11-16 --format short_cut [--kind off]
    python3 scripts/brand_palette.py check RECORD.json
    python3 scripts/brand_palette.py --self-test
"""
import argparse
import datetime as dt
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'config' / 'brand-palette.json'
WEEKDAYS = ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
SHAPE_OF = {'long_cut': '16x9', 'short_cut': '9x16'}


def load(path=MANIFEST):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def weekday(date):
    return WEEKDAYS[dt.date.fromisoformat(str(date)[:10]).weekday()]


def day(date, palette=None):
    """The palette's day entry for a date: {"kind": "series", "series": ...} or {"kind": "off"}."""
    palette = palette or load()
    return palette['days'][weekday(date)]


def applies(date, palette=None):
    palette = palette or load()
    try:
        return str(date)[:10] >= palette['applies_from']
    except TypeError:
        return True


def expect(date, fmt, kind=None, palette=None):
    """What the palette asks of this format on this date. kind may say "off" for an off-day asset on a series
    day (anything that is not the week's series piece and does not carry it); it can never make an off day a
    series day."""
    palette = palette or load()
    if fmt not in palette['formats']:
        raise ValueError(f'{fmt!r} is not a palette format ({", ".join(sorted(palette["formats"]))})')
    d = day(date, palette)
    k = 'off' if d['kind'] == 'off' or kind == 'off' else 'series'
    rules = palette['formats'][fmt].get(k)
    if rules is None:
        raise ValueError(f'the palette has no {k} {fmt} (it is made only on {", ".join(palette["formats"][fmt])} days)')
    return {'kind': k, 'series': d.get('series') if k == 'series' else None, 'shape': palette['formats'][fmt]['shape'], **rules}


def retired_close(name, palette=None):
    """The retired close a file name looks like, or None (the stand-off outro, the ticker band, a held sting)."""
    palette = palette or load()
    low = Path(str(name)).name.lower()
    if low.startswith('endcard-'):
        return None
    return next((m for m in palette['retired']['match'] if m in low), None)


def check(record, palette=None):
    """Why this record differs from the palette, or []. Each problem names the rule it breaks."""
    palette = palette or load()
    date, fmt = record.get('date'), record.get('format')
    if not date:
        return ['the record has no date, so its day in the palette cannot be told (config/brand-palette.json days)']
    try:
        dt.date.fromisoformat(str(date)[:10])
    except ValueError:
        return [f'the date {date!r} is not YYYY-MM-DD']
    if not applies(date, palette):
        return []
    try:
        want = expect(date, fmt, record.get('kind'), palette)
    except ValueError as exc:
        return [str(exc)]
    out = []
    say = f'{fmt} on {weekday(date).title()} {str(date)[:10]} ({want["kind"]} day)'
    if record.get('kind') == 'series' and want['kind'] == 'off':
        out.append(f'{say}: {weekday(date).title()} is an off day, so nothing on it wears a series (config/brand-palette.json days)')
    if want['kind'] == 'series' and record.get('series') and record['series'] != want['series']:
        out.append(f'{say}: the day\'s series is {want["series"]}, not {record["series"]}; an asset never wears another series')
    shape = record.get('shape')
    if shape and shape != want['shape']:
        out.append(f'{say}: shape {shape}, but the palette makes this format {want["shape"]}')
    if 'opening' in record and 'opening' in want and record['opening'] not in (want['opening'], 'sting' if want.get('sting') == 'after_hook' else None):
        out.append(f'{say}: opens on {record["opening"]}; the palette opens it on the {want["opening"]} (no logo-only cold open, '
                   'SOCIAL-BEST-PRACTICES-2026 section 4)')
    if 'sting' in record and 'sting' in want and record['sting'] != want['sting']:
        why = {'before_hook': 'a brand sting may follow the hook, never precede it (SOCIAL-BEST-PRACTICES-2026 section 4.3)',
               'none': 'this format carries no sting', 'after_hook': 'the series sting plays straight after the hook'}[want['sting']]
        out.append(f'{say}: sting {record["sting"]}, but the palette says {want["sting"]}: {why}')
    body = record.get('body') or {}
    for mark in ('icon', 'wordmark', 'series_pill'):
        if mark in body and mark in want.get('body', {}):
            allowed = want['body'][mark]
            if bool(body[mark]) != bool(allowed) or (allowed and body[mark] not in (True, allowed)):
                out.append(f'{say}: body {mark} is {body[mark]!r}, but the palette says {allowed!r}')
    if 'logo_top' in record and 'logo_top' in want and bool(record['logo_top']) != bool(want['logo_top']):
        out.append(f'{say}: a logo at the top; the palette keeps the first card free of it (docs/CAROUSEL-STANDARD.md, 3 Nov ruling)')
    close = record.get('close')
    if close is not None and 'close' in want:
        if want['close'] == 'none':
            if close:
                out.append(f'{say}: has a close, but this format has none')
        elif not close:
            out.append(f'{say}: has no close; the palette closes it on {want["close"]}')
        else:
            gone = retired_close(close.get('file', ''), palette) if close.get('file') else None
            if gone:
                out.append(f'{say}: closes on {Path(close["file"]).name}, a retired close ({gone}); the palette closes it on {want["close"]}')
            if close.get('id') and close['id'] != want['close']:
                out.append(f'{say}: closes on {close["id"]}, but the palette closes it on {want["close"]}')
            spec = palette['closes'].get(want['close'], {})
            secs = close.get('seconds')
            if isinstance(secs, (int, float)):
                if 'seconds_max' in spec and secs > spec['seconds_max'] + 0.05:
                    out.append(f'{say}: the close runs {secs:.2f} s; the palette\'s {want["close"]} is at most {spec["seconds_max"]} s '
                               '(a compact end beat, never a long card, SOCIAL-BEST-PRACTICES-2026 section 5)')
                if 'seconds_min' in spec and secs < spec['seconds_min'] - 0.05:
                    out.append(f'{say}: the close runs {secs:.2f} s; the palette\'s {want["close"]} runs at least {spec["seconds_min"]} s')
            if 'days_row' in close and 'days_row' in want and bool(close['days_row']) != bool(want['days_row']):
                out.append(f'{say}: the close {"shows" if close["days_row"] else "drops"} the series days; the palette says '
                           f'{"show" if want["days_row"] else "no series days on an off day"}')
    return out


def self_test():
    p = load()
    ok = []
    good_short = {'date': '2026-11-16', 'format': 'short_cut', 'kind': 'series', 'series': 'follow_the_money', 'shape': '9x16',
                  'opening': 'hook', 'sting': 'none', 'body': {'icon': False, 'wordmark': False, 'series_pill': False},
                  'close': {'id': 'statement_beat', 'seconds': 1.8, 'file': 'endcard-9x16.mp4', 'days_row': True}}
    ok.append(('a short cut built to the palette passes', check(good_short, p), []))
    ok.append(('the stand-off outro is refused', bool(check(dict(good_short, close={'file': 'outro-9x16.mp4', 'seconds': 6}), p)), True))
    ok.append(('a 6 s tall close is refused', bool(check(dict(good_short, close={'id': 'statement_beat', 'seconds': 6.0}), p)), True))
    ok.append(('a wordmark over a tall body is refused', bool(check(dict(good_short, body={'wordmark': True}), p)), True))
    ok.append(('an intro card is refused', bool(check(dict(good_short, opening='clip'), p)), True))
    ok.append(('Tuesday never wears a series', bool(check(dict(good_short, date='2026-11-17'), p)), True))
    ok.append(('Fri 13 Nov is not checked', check(dict(good_short, date='2026-11-13', close={'file': 'outro-9x16.mp4'}), p), []))
    long_cut = {'date': '2026-11-18', 'format': 'long_cut', 'opening': 'hook', 'sting': 'before_hook'}
    ok.append(('a sting in front of the hook is refused', bool(check(long_cut, p)), True))
    ok.append(('a sting after the hook passes', check(dict(long_cut, sting='after_hook'), p), []))
    bad = [(name, got, want) for name, got, want in ok if got != want]
    for name, got, want in ok:
        print(('ok   ' if (name, got, want) not in bad else 'FAIL ') + name + ('' if (name, got, want) not in bad else f': {got!r}'))
    return 1 if bad else 0


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--self-test', action='store_true')
    sub = ap.add_subparsers(dest='cmd')
    e = sub.add_parser('expect')
    e.add_argument('--date', required=True)
    e.add_argument('--format', required=True)
    e.add_argument('--kind', choices=('series', 'off'))
    c = sub.add_parser('check')
    c.add_argument('record')
    args = ap.parse_args(argv)
    if args.self_test:
        return self_test()
    if args.cmd == 'expect':
        print(json.dumps(expect(args.date, args.format, args.kind), indent=1))
        return 0
    if args.cmd == 'check':
        problems = check(json.loads(Path(args.record).read_text(encoding='utf-8')))
        print(json.dumps({'ok': not problems, 'problems': problems}, indent=1))
        return 1 if problems else 0
    ap.print_help()
    return 2


if __name__ == '__main__':
    sys.exit(main())
