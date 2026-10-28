"""advisory_qc: the ve engine's joins, captions, brand and composition measures
(scripts/velib) run on a finished quick-edit cut where they can, and written
into its receipt as advisory rows.

Plan W3 3a (Wave 1): these are measured for information on every quick-edit
render and never block; they block once the design locks exist and each is
calibrated. Every row says so ("advisory": true, "blocking": false), and
quality.delivery_problems never reads them. A measure that cannot run here
(no tesseract, no house mark on this machine, a 16:9 cut the 9:16 lock does
not cover) says why instead of passing.
"""
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NOTE = ('Advisory only (plan W3 3a, Wave 1): measured for information on a quick-edit cut and never blocking. '
        'They block once the design locks exist and each measure is calibrated.')
# Where write_ass draws the captions on each shape, as approximate pixel bands
# [x, y, width, height]: the usual place, and the place over a graphic.
CAPTION_BANDS = {'9x16': {'normal': [60, 230, 960, 200], 'over_graphic': [60, 994, 960, 200]},
                 '16x9': {'normal': [360, 900, 1200, 160], 'over_graphic': [16, 900, 576, 160]}}
ASPECT = {'9x16': '9:16', '16x9': '16:9'}


def _row(measure):
    try:
        result = measure()
    except Exception as error:  # noqa: BLE001 an advisory measure never stops a cut
        return {'advisory': True, 'blocking': False, 'status': 'error', 'pass': None,
                'reason': f'{type(error).__name__}: {error}'[:600]}
    status = result.get('status') or ('not_applicable' if result.get('applies') is False
                                      else 'measured' if result.get('pass') is not None else 'not_run')
    return {'advisory': True, 'blocking': False, 'status': status, 'pass': result.get('pass'),
            **({'reason': result['reason']} if result.get('reason') else {}), 'result': result}


def _skip(status, reason):
    return {'advisory': True, 'blocking': False, 'status': status, 'pass': None, 'reason': reason}


def house_mark():
    """The house mark PNG the ve renderer places, when it is on this machine."""
    import json
    tokens = json.loads((ROOT / 'config/ve/brand-tokens.json').read_text(encoding='utf-8'))
    theme = next(t for t in json.loads((ROOT / 'config/studio.json').read_text(encoding='utf-8'))['brand_themes']
                 if t['theme_id'] == tokens['theme_id'])
    source = theme['publication']['mark']['source_path']
    for base in (ROOT / 'apps/renderer', ROOT):
        if (base / source).is_file():
            return base / source
    return None


def caption_pages(groups, wins, shape, offset, fps):
    """The caption pages as the ve measures read them: frames on the cut's own
    clock, each page shown whole on its first frame, with the band it sits in."""
    pages = []
    for k, g in enumerate(groups):
        s = g[0]['s']
        e = groups[k + 1][0]['s'] if k + 1 < len(groups) else g[-1]['e'] + 0.4
        e = min(e, g[-1]['e'] + 0.9)
        mid = (s + g[-1]['e']) / 2
        band = 'over_graphic' if any(c['s'] <= mid <= c['e'] for c in wins) else 'normal'
        first, last = round((offset + s) * fps), round((offset + e) * fps)
        if last > first:
            pages.append({'fromFrame': first, 'toFrame': last, 'band': band,
                          'words': [{'text': t['w'].strip(), 'atFrame': first} for t in g]})
    return pages


def beats_of(wins, main_s, offset, fps):
    """Each graphic as a beat on the cut's clock, or the whole main when there is none."""
    beats = [{'id': c.get('id', f'cue-{k}'), 'fromFrame': round((offset + c['s']) * fps), 'toFrame': round((offset + c['e']) * fps)}
             for k, c in enumerate(wins)]
    beats = [b for b in beats if b['toFrame'] > b['fromFrame']]
    return beats or [{'id': 'main', 'fromFrame': round(offset * fps), 'toFrame': round((offset + main_s) * fps)}]


def rows(video, *, shape, joins=None, pages=None, beats=None, mark=None):
    """The four advisory rows for one finished cut. Never raises."""
    out = {'note': NOTE, 'rows': {}}
    try:
        if str(ROOT / 'scripts') not in sys.path:
            sys.path.append(str(ROOT / 'scripts'))  # after quick-edit's own modules, never ahead of them
        from velib import designlock, qc_brand, qc_captions, qc_composition, qc_joins
    except Exception as error:  # noqa: BLE001 the measures are missing on this machine
        reason = f'the ve measures cannot load here ({type(error).__name__}: {error})'
        out['rows'] = {name: _skip('not_run', reason) for name in ('joins', 'captions', 'brand', 'composition')}
        return out
    video, tesseract = str(video), shutil.which('tesseract')
    r = out['rows']
    r['joins'] = (_skip('not_run', 'no join times were given') if joins is None
                  else _row(lambda: qc_joins.decoder(video, joins)))
    if pages is None:
        r['captions'] = _skip('not_run', 'no caption pages were given')
    elif not tesseract:
        r['captions'] = _skip('not_run', 'tesseract is not on PATH, so the burned captions cannot be read back')
    else:
        def captions():
            parts = {band: qc_captions.ocr(video, [p for p in pages if p['band'] == band], CAPTION_BANDS[shape][band])
                     for band in ('normal', 'over_graphic') if any(p['band'] == band for p in pages)}
            verdicts = [p.get('pass') for p in parts.values()]
            return {'pass': None if None in verdicts else all(verdicts), 'bands': parts}
        r['captions'] = _row(captions)
    try:
        mark = mark or house_mark()
    except (OSError, ValueError, KeyError, StopIteration) as error:
        mark = None
        r['brand'] = _skip('not_run', f'the house mark could not be found: {error}')
    if 'brand' not in r:
        r['brand'] = (_skip('not_run', 'the house mark PNG is not on this machine') if not mark
                      else _skip('not_run', 'no beats were given') if not beats
                      else _row(lambda: qc_brand.mark_tile(video, str(mark), beats, ASPECT[shape])))
    if shape != '9x16':
        r['composition'] = _skip('not_applicable', 'the design lock is 9:16 only')
    elif not tesseract:
        r['composition'] = _skip('not_run', 'tesseract is not on PATH, so the frame text cannot be measured')
    elif not beats:
        r['composition'] = _skip('not_run', 'no beats were given')
    else:
        props = {'aspect': '9:16', 'beats': beats, 'captions': [{k: p[k] for k in ('fromFrame', 'toFrame', 'words')} for p in pages or []]}
        r['composition'] = _row(lambda: qc_composition.composition_checks(video, props, designlock.load()))
    return out
