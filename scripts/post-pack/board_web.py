#!/usr/bin/env python3
"""Web board build adapter and explicit operator commands. No write runs by default."""
import argparse
import hashlib
import json
import mimetypes
import os
from pathlib import Path
import re
import sys
import urllib.request
import urllib.error
import urllib.parse

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import engine
sys.path.insert(0, str(HERE.parent/'quick-edit'))
import media_standard

def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))

def sha(data):
    return hashlib.sha256(data).hexdigest()

def web_page(page, manifest):
    """Keep artifact markup intact; substitute only its runtime dependency."""
    week = manifest['week_start']
    adapter = (HERE / 'week_board' / 'web.js').read_text(encoding='utf-8').replace('__WEB_WEEK__', json.dumps(week))
    # Substitute runtime calls only, never a matching phrase in saved wording.
    page = re.sub(r'<script\b[^>]*>.*?</script>',
                  lambda match: match.group(0).replace('window.claude', 'window.boardRuntime'), page, flags=re.S)
    # Update generated help only; editorial wording and saved drafts stay verbatim.
    page = page.replace(
        '<p class="rv-how">Change any word below and press Save, or press Comment to say what to change. Claude reads your saved words and your comments and comes back with the next version.</p>',
        '<p class="rv-how">Change any word below and press Save, or press Comment to say what to change. Your saved words and comments guide the next version through the content workflows.</p>')
    page = page.replace(
        '<p class="qd-how">Ideas you queued earlier that fit this day. Ask Claude to start one, or pick from the new ideas below.</p>',
        '<p class="qd-how">Ideas you queued earlier that fit this day. Ask your content workflow to start one, or pick from the new ideas below.</p>')
    first = page.find('<script')
    if first < 0:
        raise ValueError('board has no runtime')
    page = page[:first] + '<script>\n' + adapter + '\n</script>\n' + page[first:]
    import engine_stamp
    page = engine_stamp.stamp(page, 'week_board')
    manifest['target'] = 'web'
    manifest['web_url'] = f'https://content.krishraja.com/board/{week}'
    manifest['publish'] = {'command': 'board_web.py publish-web', 'approval_required': True}
    manifest['bytes'] = len(page.encode('utf-8'))
    manifest['sha256'] = sha(page.encode('utf-8'))
    return page, manifest

def call(method, path, body=None):
    key = os.environ.get('ENGINE_OPERATOR_TOKEN')
    if not key:
        key, _ = engine.windows_key()
    if not key:
        raise ValueError('Engine operator credential unavailable; use the approved environment or Credential Manager entry.')
    base = os.environ.get('BOARD_BASE_URL', 'https://content.krishraja.com').rstrip('/')
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

def spec(week, path, mime=None):
    data = Path(path).read_bytes()
    digest = sha(data)
    return {'sha256': digest, 'bytes': len(data), 'type': mime or mimetypes.guess_type(path)[0] or 'application/octet-stream',
            'name': Path(path).name, 'key': f'boards/{week}/{digest}'}, data

def upload(week, file, data):
    response = call('POST', f'/api/board/{week}/uploads', {'file': file})
    if response.get('exists'):
        return
    url = response.get('upload_url', '')
    # Only the storage host used by the engine is eligible; no bearer is forwarded.
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != 'https' or not parsed.hostname or not parsed.hostname.endswith('.supabase.co'):
        raise ValueError('Invalid signed upload destination')
    request = urllib.request.Request(url, data=data, method='PUT', headers={'Content-Type': file['type']})
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            if response.status not in (200, 201):
                raise ValueError('Storage upload failed')
    except urllib.error.URLError:
        raise ValueError('Storage upload failed; signed URL withheld') from None

def publish(args):
    import week_board
    path = Path(args.page)
    page = path.read_text(encoding='utf-8')
    meta = json.loads(path.with_suffix('.json').read_text(encoding='utf-8'))
    if meta.get('target') != 'web' or 'window.claude' in page:
        raise ValueError('Build with week_board.py --target web first')
    issues = week_board.verify(page)
    if issues:
        raise ValueError('; '.join(issues))
    week = meta['week_start']
    assets, payloads = {}, []
    state = call('GET', f'/api/board/{week}')
    if getattr(args, 'expected_build', None) and state.get('build_id') != args.expected_build:
        raise ValueError('Active board changed since preparation; download it and rebuild before publishing')
    mappings = json.loads(Path(args.assets).read_text(encoding='utf-8')) if args.assets else []
    for item in mappings:
        asset_id = item['id']
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}', asset_id) or asset_id in assets:
            raise ValueError('Invalid or duplicate asset id')
        if item.get('existing_sha256'):
            file = ((state.get('manifest') or {}).get('assets') or {}).get(asset_id)
            if not file or file.get('sha256') != item['existing_sha256']:
                raise ValueError(f'Existing asset {asset_id} changed or is missing; refresh the mapping')
        else:
            file, data = spec(week, item['path'], item.get('type'))
            payloads.append((file, data))
        assets[asset_id] = file
        source = item['source_url']
        if source not in page:
            raise ValueError(f'Asset {asset_id} has no matching link in the board')
        page = page.replace(source, f'/api/board/{week}/assets/{asset_id}?sha={file["sha256"]}')
    if re.search(r'https://(?:drive\.google\.com/(?:uc\?|download\?)|drive\.usercontent\.google\.com/download\?)', page):
        raise ValueError('Map every Drive download to an immutable library asset with --assets')
    page = week_board.engine_stamp.stamp(page, 'week_board')
    issues = week_board.verify(page)
    if issues: raise ValueError('; '.join(issues))
    data = page.encode('utf-8')
    if len(data) >= 16 * 1024 * 1024:
        raise ValueError('Board exceeds 16 MB')
    html = {'sha256': sha(data), 'bytes': len(data), 'type': 'text/html', 'name': path.name, 'key': f'boards/{week}/{sha(data)}'}
    manifest = {'version': 1, 'week': week, 'html': html, 'assets': assets}
    if not args.apply:
        print(canonical({'dry_run': True, 'week': week, 'build_id': sha(canonical(manifest).encode()), 'html_bytes': len(data), 'assets': len(assets)}))
        return
    if media_standard.enforced():
        review_path = path.with_suffix('.delivery-review.json')
        if not review_path.is_file():
            raise ValueError('Independent board delivery review missing for this exact build')
        delivery_review = json.loads(review_path.read_text(encoding='utf-8'))
        manifest['delivery_review'] = delivery_review
    for file, content in payloads + [(html, data)]:
        upload(week, file, content)
    result = call('PUT', f'/api/board/{week}', {'manifest': manifest, 'revision': state['revision']})
    actual = call('GET', f'/api/board/{week}')
    if actual['build_id'] != result['build_id'] or actual['manifest'] != manifest:
        raise ValueError('Published build readback mismatch')
    print(canonical({'verified': True, 'week': week, 'build_id': result['build_id']}))

def convert_export(args):
    """Upgrade an explicitly identified native HTML export without rebuilding its content."""
    import week_board
    data = Path(args.page).read_bytes()
    if sha(data) != args.expected_sha256:
        raise ValueError('Source export digest does not match the reviewed bytes')
    expected = json.loads((HERE.parents[1] / 'config/boards.json').read_text(encoding='utf-8'))['weeks']
    if args.source not in expected.get(args.week, []):
        raise ValueError('Source is not a registered artifact for this week')
    page = data.decode('utf-8')
    scripts = list(re.finditer(r'<script\b[^>]*>(.*?)</script>', page, re.S))
    if len(scripts) != 1 or "week_board.py fills CONF" not in scripts[0].group(1):
        raise ValueError('Source must have exactly one recognized week-board runtime')
    match = re.search(r'const CONF = (.*?);\s*\n', scripts[0].group(1))
    if not match: raise ValueError('Source configuration is unavailable')
    conf = json.loads(match.group(1))
    if conf.get('week') != args.week: raise ValueError('Source week mismatch')
    # Leave every panel, image, current wording and built-at edit guard intact.
    runtime = scripts[0]
    page = page[:runtime.start()] + '<script>\n' + week_board.script(conf) + '\n</script>' + page[runtime.end():]
    meta = {'kind':'week_board','version':1,'week_start':args.week,
            'source_export':{'artifact':args.source,'sha256':sha(data),'bytes':len(data)},
            'migration_note':'Original content retained; shared runtime upgraded for web persistence.'}
    page, meta = web_page(page, meta)
    issues = week_board.verify(page)
    if issues: raise ValueError('; '.join(issues))
    week_board.write(page, meta, args.output)
    print(canonical({'converted':True,'week':args.week,'source_sha256':sha(data),'web_sha256':meta['sha256']}))

def main():
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest='command', required=True)
    pub = sub.add_parser('publish-web'); pub.add_argument('page'); pub.add_argument('--assets'); pub.add_argument('--apply', action='store_true')
    pub.add_argument('--expected-build', help='refuse to replace a build other than the one used for preparation')
    convert = sub.add_parser('convert-export'); convert.add_argument('page'); convert.add_argument('--week',required=True); convert.add_argument('--source',required=True); convert.add_argument('--expected-sha256',required=True); convert.add_argument('--output',required=True)
    # approvals and titles are read-only views of his day decisions in picks (api/board/_contracts.ts views).
    read = sub.add_parser('read'); read.add_argument('week'); read.add_argument('collection', choices=['ticks','links','edits','picks','queue','comments','approvals','titles'])
    download = sub.add_parser('download'); download.add_argument('week'); download.add_argument('--output', required=True)
    rollback = sub.add_parser('rollback'); rollback.add_argument('week'); rollback.add_argument('build'); rollback.add_argument('--apply', action='store_true')
    args = p.parse_args()
    if args.command == 'publish-web': publish(args)
    elif args.command == 'convert-export': convert_export(args)
    elif args.command == 'read': print(json.dumps(call('GET', f'/api/board/{args.week}/{args.collection}'), ensure_ascii=False, indent=2))
    elif args.command == 'download':
        state = call('GET', f'/api/board/{args.week}')
        if not state.get('manifest'): raise ValueError('Board is not published')
        key = os.environ.get('ENGINE_OPERATOR_TOKEN') or engine.windows_key()[0]
        base = os.environ.get('BOARD_BASE_URL', 'https://content.krishraja.com').rstrip('/')
        request = urllib.request.Request(base + f'/board/{args.week}', headers={'Authorization':'Bearer ' + key})
        with urllib.request.urlopen(request, timeout=300) as response: data = response.read()
        expected = state['manifest']['html']
        if len(data) != expected['bytes'] or sha(data) != expected['sha256']: raise ValueError('Board changed during download; retry')
        output = Path(args.output); output.parent.mkdir(parents=True, exist_ok=True); output.write_bytes(data)
        print(canonical({'saved':str(output),'build_id':state['build_id'],'sha256':sha(data)}))
    else:
        previous = call('GET', f'/api/board/{args.week}?build={args.build}')
        current = call('GET', f'/api/board/{args.week}')
        if args.apply:
            result = call('PUT', f'/api/board/{args.week}', {'manifest': previous['manifest'], 'revision': current['revision']})
            actual = call('GET', f'/api/board/{args.week}')
            if actual['build_id'] != args.build: raise ValueError('Rollback readback mismatch')
            print(canonical(result))
        else: print(canonical({'dry_run': True, 'restore': previous['build_id'], 'current': current['build_id']}))

if __name__ == '__main__':
    try: main()
    except (ValueError, OSError, KeyError) as error:
        print(f'board web: {error}', file=sys.stderr); sys.exit(1)
