#!/usr/bin/env python3
"""judge_assets: the make flow asks content-engine's 10/10 judges itself, before a carousel or a Short goes to Growth.

Ruling (Krish, 2026-11-12): "Judge them; count passes." Ruling (Krish, 2026-11-26): content-engine makes every asset,
so the asset is judged where it is made: this asks POST /api/board/<Monday>/judge with `op: judge` on the engine
operator's key (apps/control-plane/api/board/_judge.ts; recorded as written by content-engine). Growth keeps `op: bind`
(a pass tied to its saved Buffer post) and `op: live`. The same artifact judged again on the same roster answers from
the record and costs nothing; a new one runs the judges' panel on Control Center's side, at most DAILY_CAP a day.

    python3 scripts/post-pack/judge_assets.py ask REQUEST.json --week <Monday>

REQUEST.json: {"item", "format": "carousel" | "short-video", "channel", "words" | "words_file",
               "assets": [{"name", "file", "view_url"?}], "layout": "<carousel_check --cards receipt>"?,
               "claim"?, "concept_id"?}
Each asset's sha256 is its file's. A carousel carries its cards (each card's bytes, or its Drive view_url for the route
to read) and the drawn cards' receipt from `python3 scripts/carousel_check.py --cards`, bound to the same sha256s.

Exit 0 every judge passes; 1 it failed (the judges' fixes are printed); 2 not asked (no engine key, the route
unreachable, the day's cap reached or a malformed request): the step holds, never a pass.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
from pathlib import Path
import sys
import urllib.error

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
MIME = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp'}
FORMATS = ('carousel', 'short-video')


class NotAsked(Exception):
    pass


def body_of(request, base=Path('.')):
    """The op judge body from REQUEST: each asset's sha256 from its file, a carousel's cards and its layout receipt."""
    if not isinstance(request, dict) or request.get('format') not in FORMATS:
        raise NotAsked(f'the request names a format: {", ".join(FORMATS)}')
    words = request.get('words')
    if words is None and request.get('words_file'):
        words = (base / request['words_file']).read_text(encoding='utf-8')
    if not isinstance(words, str) or not words.strip():
        raise NotAsked('the request carries the post\'s exact words')
    assets, images = [], []
    for a in request.get('assets') or []:
        data = (base / a['file']).read_bytes()
        row = {'name': a['name'], 'sha256': hashlib.sha256(data).hexdigest()}
        if a.get('view_url'):
            row['view_url'] = a['view_url']
        assets.append(row)
        if request['format'] == 'carousel' and not a.get('view_url'):
            mime = MIME.get(Path(a['file']).suffix.lower())
            if not mime:
                raise NotAsked(f'{a["file"]}: a card is a PNG, JPEG or WebP picture')
            images.append({'mime': mime, 'data': base64.b64encode(data).decode('ascii')})
    body = {'op': 'judge', 'item': request.get('item'), 'format': request['format'], 'channel': request.get('channel'),
            'words': words, 'assets': assets}
    if images:
        if len(images) != len(assets):
            raise NotAsked('send every card as its bytes, or every card as its Drive view_url, never a mix')
        body['images'] = images
    if request['format'] == 'carousel':
        layout = request.get('layout')
        if not layout:
            raise NotAsked('a carousel carries its drawn cards\' receipt (python3 scripts/carousel_check.py --cards)')
        body['layout'] = json.loads((base / layout).read_text(encoding='utf-8')) if isinstance(layout, str) else layout
    for key in ('claim', 'concept_id'):
        if request.get(key):
            body[key] = request[key]
    return body


def ask(week, body, call=None):
    """(passed, answer) from the judge route; NotAsked when it could not be asked."""
    if call is None:
        import board_web
        call = board_web.call
    try:
        answer = call('POST', f'/api/board/{week}/judge', body)
    except (ValueError, OSError, urllib.error.URLError) as e:
        raise NotAsked(f'the judges could not be asked ({type(e).__name__}); this step holds') from None
    if not isinstance(answer, dict) or answer.get('ok') is not True:
        error = answer.get('error') if isinstance(answer, dict) else None
        raise NotAsked(f'the judges did not answer ({error or "no answer"}); this step holds')
    return answer.get('verdict') == 'pass', answer


def main(argv=None, call=None, out=print):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('ask')
    p.add_argument('request', type=Path)
    p.add_argument('--week', required=True, help='the Monday of the board week, YYYY-MM-DD')
    a = ap.parse_args(argv)
    try:
        body = body_of(json.loads(a.request.read_text(encoding='utf-8')), a.request.parent)
        passed, answer = ask(a.week, body, call)
    except NotAsked as e:
        out('NOT ASKED  ' + str(e))
        return 2
    again = ' (from the record)' if answer.get('again') else ''
    if passed:
        out(f'PASS  every judge passes{again}: score {answer.get("score")}, artifact {answer.get("artifact_sha256")}')
        return 0
    out(f'FAIL  the judges did not pass it{again}: score {answer.get("score")}, band {answer.get("band")}')
    for r in answer.get('reasons') or []:
        out(f'  {r.get("judge")}: {r.get("fix")}')
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
