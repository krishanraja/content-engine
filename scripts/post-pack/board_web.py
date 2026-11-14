#!/usr/bin/env python3
"""The board's store, read and signalled from a session or a run: the engine's routes under /api/board/<Monday>, on the
engine operator's key. Nothing here builds, publishes, downloads or rolls back a board page: those were retired for good
on 13 November 2026 (Ruling, Krish, 2026-11-13: "We need to retire the old publish boards now permanently";
docs/history/2026-11-13-old-boards-retired.md). The one live board is Control Centre's Content tab
(scripts/post-pack/live_board.py); how to feed it is docs/PUBLISH_BOARDS.md.

    python3 scripts/post-pack/board_web.py read <Monday> <collection>   his saved picks, presses, edits and comments
    python3 scripts/post-pack/board_web.py touch <Monday> [--source S]  bump the week's change signal

call() is the client the other scripts use (board_feed.py, yes.py, the overnight run).
"""
import argparse
import json
import os
from pathlib import Path
import re
import sys
import urllib.request
import urllib.error
import urllib.parse

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import engine  # noqa: E402


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def call(method, path, body=None, base=None):
    """One request to the board's routes (BOARD_BASE_URL, by default the board's API host), every page of a listing
    gathered. Never prints a key, a signed URL or a provider's body."""
    key = os.environ.get('ENGINE_OPERATOR_TOKEN')
    if not key:
        key, _ = engine.windows_key()
    if not key:
        raise ValueError('Engine operator credential unavailable; use the approved environment or Credential Manager entry.')
    base = (base or os.environ.get('BOARD_BASE_URL', 'https://content.krishraja.com')).rstrip('/')
    if not base.startswith('https://'):
        raise ValueError('BOARD_BASE_URL must use HTTPS')
    try:
        result, next_path, seen = None, path, set()
        while True:
            request = urllib.request.Request(base + next_path, method=method, data=canonical(body).encode() if body is not None else None,
                                             headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
            with urllib.request.urlopen(request, timeout=300) as response:
                page = json.load(response)
            if result is None:
                result = page
            else:
                field = 'documents' if 'documents' in result else 'records'
                result[field].extend(page[field])
            offset = page.get('next_offset') if method == 'GET' else None
            if offset is None:
                if 'next_offset' in result: result['next_offset'] = None
                break
            if not isinstance(offset, int) or offset < 0 or offset in seen:
                raise ValueError('Board pagination did not advance')
            seen.add(offset)
            parts = urllib.parse.urlsplit(path)
            query = dict(urllib.parse.parse_qsl(parts.query)); query['offset'] = str(offset)
            next_path = parts.path + '?' + urllib.parse.urlencode(query)
        return result
    except urllib.error.HTTPError as error:
        # Never print signed URLs, headers or provider bodies.
        raise ValueError(f'Board request failed: HTTP {error.code} ({method} {path.split("?")[0]})') from None


def main():
    p = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    sub = p.add_subparsers(dest='command', required=True)
    # approvals and titles are read-only views of his day decisions in picks (api/board/_contracts.ts views).
    read = sub.add_parser('read'); read.add_argument('week'); read.add_argument('collection', choices=['ticks','links','edits','picks','queue','comments','approvals','titles'])
    # The week's change signal (POST /api/board/<Monday>/touch): after a run pushes the week's plan files, the live board
    # in Control Centre reads the week again at once (Ruling, Krish, 2026-11-11: one live board, in Control Centre).
    touch = sub.add_parser('touch'); touch.add_argument('week'); touch.add_argument('--source', default='plan')
    args = p.parse_args()
    if args.command == 'read':
        print(json.dumps(call('GET', f'/api/board/{args.week}/{args.collection}'), ensure_ascii=False, indent=2))
    else:
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', args.week) or not re.fullmatch(r'[a-z][a-z_-]{0,39}', args.source): raise ValueError('touch takes a Monday and a one-word source')
        print(canonical(call('POST', f'/api/board/{args.week}/touch', {'source': args.source})))


if __name__ == '__main__':
    try: main()
    except (ValueError, OSError, KeyError) as error:
        print(f'board web: {error}', file=sys.stderr); sys.exit(1)
