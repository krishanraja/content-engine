"""The accent kit: five warm colours for big moments, gradients and duotone cut-outs on series days only.

Krish approved on 2026-11-20 (the polish board): ember, ember_deep, plum, plum_deep and peach join the brand kit, scoped to
big moments, gradients and duotone cut-outs on Monday, Wednesday and Friday only; off days are unchanged (mint, never
coral). The values live once, in config/ve/brand-tokens.json accent_kit; config/brand-palette.json colour.accent names
them. A spec names an accent only as the value of one of its role keys (accent_kit.role_keys: "ground" for a big moment,
"gradient", "duotone"), never in hex (ve lint brand.no_hex) and never anywhere else. ve lint runs accent_problems.

    python3 -m velib.accent_kit SPEC.json        (from scripts/)
"""
from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path

from .common import ROOT

TOKENS = ROOT / 'config' / 've' / 'brand-tokens.json'
WEEKDAYS = ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
FROM = '2026-11-20'


def kit() -> dict:
    return json.loads(TOKENS.read_text(encoding='utf-8'))['accent_kit']


def names(k: dict | None = None) -> set[str]:
    """Every name a spec may use for the kit: each colour, plus the named gradients and the duotone."""
    k = k or kit()
    return set(k['colours']) | {f'{g}_gradient' for g in k['gradients'] if isinstance(k['gradients'][g], list)} | {'duotone_ember'}


def _walk(value, path=''):
    if isinstance(value, dict):
        for key, item in value.items():
            yield from _walk(item, f'{path}.{key}' if path else str(key))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from _walk(item, f'{path}.{index}')
    elif isinstance(value, str):
        yield path, value


def series_day(spec: dict) -> bool | None:
    """True when the spec's publish day is one of the kit's days (a series day); None when it has no date."""
    when = spec.get('publish_day')
    if not when:
        return None
    try:
        return WEEKDAYS[dt.date.fromisoformat(str(when)[:10]).weekday()] in kit()['days']
    except ValueError:
        return None


def accent_problems(spec: dict) -> list[str]:
    """Why a spec's use of the accent kit breaks its scope, or []: an accent on an off day, or outside its roles."""
    k = kit()
    known = names(k)
    out = []
    day = series_day(spec)
    for path, text in _walk(spec):
        # A colour is named as a whole value (a word inside a caption or a script line is not a colour).
        if path.startswith('assets.') or text.strip() not in known:
            continue
        key = path.rsplit('.', 1)[-1]
        if key not in k['role_keys']:
            out.append(f'brand.accent {path}: the accent kit ({", ".join(sorted(k["colours"]))}) is only the whole value of a '
                       f'{"/".join(k["role_keys"])} key (big moments, gradients, duotone cut-outs; Krish, 2026-11-20)')
            continue
        if day is False:
            out.append(f'brand.accent {path}: {text} on an off day; the accent kit is for Monday, Wednesday and Friday only, '
                       'and off days stay mint (Krish, 2026-11-20; config/brand-palette.json colour.off)')
    return out


def main(argv=None) -> int:
    args = list(argv if argv is not None else sys.argv[1:])
    if not args:
        print(__doc__)
        return 2
    problems = accent_problems(json.loads(Path(args[0]).read_text(encoding='utf-8')))
    print('\n'.join(problems) or 'accent kit: ok')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
