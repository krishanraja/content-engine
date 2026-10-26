"""Read-only production evidence: HTML, every download, and retained interactions."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'scripts/post-pack'))
import board_web as web
import week_board
CACHE=ROOT/'.cache/monday-release-gates'
PLAN=ROOT/'docs/plans/2026-10-19-monday'
def save(p,d): p.write_text(json.dumps(d,indent=2)+'\n',encoding='utf8')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def main():
    key = web.os.environ.get('ENGINE_OPERATOR_TOKEN') or web.engine.windows_key()[0]
    assert key, 'Operator credential unavailable'
    base = 'https://content.krishraja.com'
    receipts = []
    for week in ['2026-10-19']:
        state = web.call('GET', f'/api/board/{week}')
        manifest = state['manifest']
        req = urllib.request.Request(base + f'/board/{week}', headers={'Authorization': 'Bearer ' + key})
        with urllib.request.urlopen(req, timeout=300) as response:
            page = response.read()
            cache_control = response.headers.get('Cache-Control', '')
        assert len(page) == manifest['html']['bytes'] and web.sha(page) == manifest['html']['sha256']
        assert 'no-store' in cache_control
        text = page.decode('utf8')
        assert not week_board.verify(text)
        assert '/prepared/' not in text and 'drive.usercontent.google.com/download' not in text
        (CACHE / f'{week}-live.html').write_bytes(page)
        save(CACHE / f'{week}-active-after.json', state)

        def verify_asset(pair):
            aid, spec = pair
            path = f'/api/board/{week}/assets/{aid}?sha={spec["sha256"]}'
            req = urllib.request.Request(base + path, headers={'Authorization': 'Bearer ' + key})
            try:
                urllib.request.build_opener(NoRedirect).open(req, timeout=120)
                raise AssertionError('Expected a fresh signed redirect')
            except urllib.error.HTTPError as error:
                assert error.code == 303
                url = error.headers['Location']
            parsed = urllib.parse.urlparse(url)
            assert parsed.scheme == 'https' and parsed.hostname.endswith('.supabase.co')
            digest = hashlib.sha256()
            count = 0
            # A separate request deliberately carries no operator Authorization.
            with urllib.request.urlopen(urllib.request.Request(url), timeout=60) as response:
                mime = response.headers.get_content_type()
                while chunk := response.read(1024 * 1024):
                    count += len(chunk)
                    digest.update(chunk)
            assert count == spec['bytes'] and digest.hexdigest() == spec['sha256'], aid
            expected_type = spec['type'].split(';')[0]
            # Storage serves downloadable HTML as plain text to prevent inline execution.
            assert mime == expected_type or (expected_type == 'text/html' and mime == 'text/plain'), (aid, mime, expected_type)
            print(json.dumps({'asset_verified': aid, 'bytes': count}), flush=True)
            return {'id': aid, 'bytes': count, 'sha256': digest.hexdigest(), 'type': mime, 'verified': True}

        with ThreadPoolExecutor(max_workers=3) as pool:
            assets = list(pool.map(verify_asset, manifest['assets'].items()))
        collections = {}
        for collection in ['ticks', 'links', 'edits', 'picks', 'queue', 'comments']:
            previous = json.loads((CACHE / 'stores-before.json').read_text(encoding='utf8'))[collection]
            current = web.call('GET', f'/api/board/{week}/{collection}')
            normalize = lambda value: sorted(value['documents'], key=lambda row: row['id'])
            assert normalize(previous) == normalize(current), f'{week} {collection} changed: inspect before accepting'
            collections[collection] = {'count': len(current['documents']), 'exactly_preserved': True}
        receipts.append({'week': week, 'build_id': state['build_id'], 'html': manifest['html'],
                         'private_no_store': True, 'assets': assets, 'collections': collections})
        print(json.dumps({'week': week, 'assets_verified': len(assets), 'collections_preserved': collections}), flush=True)
    save(PLAN / 'release-receipt.json', {'checked_at': datetime.now(timezone.utc).isoformat(), 'boards': receipts})


if __name__ == '__main__':
    try:
        main()
    except urllib.error.URLError:
        raise SystemExit('Network verification failed; signed URLs withheld') from None
