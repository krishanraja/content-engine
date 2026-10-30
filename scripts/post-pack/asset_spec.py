#!/usr/bin/env python3
"""asset_spec: config/asset-spec.json, what the engine produces now, read in one place.

    python3 asset_spec.py show            the formats, their limits and their assets
    python3 asset_spec.py self-test

piece_manifest.py refuses an asset whose name is not one the spec holds (a numbered one, such as carousel_slide_3,
counts by its stem), and snackable.py takes the off-day snackable's length and frame from it.
"""
import json
import re
import sys
from pathlib import Path

SPEC_FILE = Path(__file__).resolve().parents[2] / 'config' / 'asset-spec.json'
SCHEMA = 'content-engine-asset-spec/1'
NUMBERED = re.compile(r'^(?P<stem>[a-z][a-z0-9_]*?)_(?P<n>[1-9][0-9]{0,2})$')


class SpecError(Exception):
    pass


def load(path=SPEC_FILE):
    try:
        spec = json.loads(Path(path).read_text(encoding='utf-8'))
    except (OSError, ValueError) as error:
        raise SpecError(f'{path}: cannot be read ({error})')
    if not isinstance(spec, dict) or spec.get('schema') != SCHEMA or not isinstance(spec.get('assets'), dict) \
            or not isinstance(spec.get('formats'), dict):
        raise SpecError(f'{path}: not {SCHEMA}')
    for name, fmt in spec['formats'].items():
        for a in fmt.get('assets') or []:
            if a not in spec['assets']:
                raise SpecError(f'{path}: format {name} names an asset the spec does not hold: {a}')
    return spec


def asset_kind(name, spec=None):
    """The spec's asset a manifest name stands for (carousel_slide_3 is carousel_slide), or None."""
    spec = spec or load()
    if name in spec['assets'] and not spec['assets'][name].get('numbered'):
        return name
    m = NUMBERED.match(str(name))
    if m and spec['assets'].get(m.group('stem'), {}).get('numbered'):
        return m.group('stem')
    return None


def known_names(spec=None):
    spec = spec or load()
    return sorted(f'{k}_<n>' if v.get('numbered') else k for k, v in spec['assets'].items())


def snackable(spec=None):
    """(min_seconds, max_seconds, (width, height)) of the off-day snackable."""
    spec = spec or load()
    length = spec['formats']['snackable']['length_seconds']
    frame = spec['assets']['snackable_video']['frame']
    return float(length['min']), float(length['max']), (int(frame[0]), int(frame[1]))


def show(spec):
    lines = []
    for key, fmt in spec['formats'].items():
        lines.append(f'{fmt.get("name", key)} ({key})')
        for field in ('title', 'subtitle', 'description', 'length_seconds'):
            v = fmt.get(field)
            if isinstance(v, dict):
                lines.append(f'  {field}: ' + ', '.join(f'{k} {v[k]}' for k in v if k not in ('source', 'why')))
        for a in fmt.get('assets') or []:
            frame = spec['assets'][a].get('frame')
            lines.append(f'  asset {a}: ' + (f'{frame[0]} x {frame[1]}' if frame else 'size not set'))
        if fmt.get('open'):
            lines.append(f'  open: {fmt["open"]}')
    return '\n'.join(lines)


def self_test():
    bad = []
    check = lambda name, ok: bad.append(name) if not ok else None
    spec = load()
    check('a plain asset is itself', asset_kind('short_video', spec) == 'short_video')
    check('a numbered asset counts by its stem', asset_kind('carousel_slide_3', spec) == 'carousel_slide')
    check('a numbered asset needs its number', asset_kind('carousel_slide', spec) is None)
    check('a plain asset takes no number', asset_kind('short_video_2', spec) is None)
    check('an unknown name is refused', asset_kind('teaser_gif', spec) is None)
    check('the snackable is 5 to 90 s, 9:16', snackable(spec) == (5.0, 90.0, (1080, 1920)))
    print('asset_spec self-test ' + ('FAILED:\n  ' + '\n  '.join(bad) if bad else 'passed'))
    return 1 if bad else 0


def main(argv):
    if argv[:1] == ['self-test']:
        return self_test()
    if argv[:1] == ['show']:
        print(show(load()))
        return 0
    print(__doc__)
    return 2


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
