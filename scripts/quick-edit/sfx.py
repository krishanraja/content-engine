#!/usr/bin/env python3
"""One sound on the big moment: the hook only (Wave 2, W2.5).

Krish, 29 Oct 2026, under test: one sound under a piece's biggest moment and
nothing anywhere else; a small set is chosen and played to him first, and
nothing is used before he approves it by ear (docs/production/THE_BAR.md).
So this module picks nothing and mixes nothing. It holds:

  the slot    a cut config's "sfx" list ({"id", "at_s"} each, at most one) is
              refused unless every sound is in config/sfx-approved.json by id
              and sha256 with his approval words; the set starts empty, so
              today any sound is refused;
  the record  sfx_used: true | false on the cut's report, joined later to the
              making record's production_choices.big_moment_sound.

    python sfx.py --check CONFIG.json
"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APPROVED = ROOT / 'config' / 'sfx-approved.json'


class SoundRefused(ValueError):
    pass


def approved(path=APPROVED):
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    out = {}
    for row in data.get('approved') or []:
        if row.get('id') and row.get('sha256') and row.get('approved_by') == 'Krish' and row.get('approval_words'):
            out[row['id']] = row
    return out


def slot(cfg, path=APPROVED):
    """The cut's sound record. Raises SoundRefused for any sound not in the approved set."""
    placed = cfg.get('sfx') or []
    if not isinstance(placed, list):
        raise SoundRefused('"sfx" is a list of {"id", "at_s"}')
    if len(placed) > 1:
        raise SoundRefused('one sound on the big moment and nothing anywhere else: "sfx" holds at most one')
    ok = approved(path)
    for row in placed:
        sid = row.get('id') if isinstance(row, dict) else None
        if sid not in ok:
            raise SoundRefused(f'sound {sid!r} is not in the approved set (config/sfx-approved.json); nothing is used '
                               'before Krish approves it by ear')
        if row.get('sha256') and row.get('sha256') != ok[sid]['sha256']:
            raise SoundRefused(f'sound {sid!r} is not the file he approved (sha256 differs)')
        if not isinstance(row.get('at_s'), (int, float)) or row['at_s'] < 0:
            raise SoundRefused(f'sound {sid!r} needs "at_s", where the big moment lands')
    if placed:
        # Reachable only once he has approved a set: the mix is built with that first approved sound, not before.
        raise SoundRefused('an approved sound is placed, but the big-moment mix is not built yet; build it with the first '
                           'approved sound')
    return {'sfx_used': False, 'sounds': [], 'approved_set': 'config/sfx-approved.json', 'approved_count': len(ok),
            'line': f'sound on the big moment: none used (approved set holds {len(ok)}; sfx_used: false)'}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--check', required=True)
    a = ap.parse_args(argv)
    try:
        print(json.dumps(slot(json.loads(Path(a.check).read_text(encoding='utf-8'))), indent=1))
    except SoundRefused as error:
        print(f'refused: {error}')
        return 2
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
