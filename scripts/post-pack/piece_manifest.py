#!/usr/bin/env python3
"""piece_manifest: the piece's `0 Publish/manifest.json`, what Growth checks every go-live against (W2.8).

Growth posts what Krish approved (docs/GROWTH-HANDOFF.md). It reads this file by a direct download link and its sha256,
named in the go-live dispatch (`growth-go-live-manifest`, `piece_manifest`), and holds any Buffer draft that is not
exactly its channel's post here (growth-makeyourmindup engine/run/piece_manifest.py). The closed shape is Growth's,
copied from its main at 38fada1 into config/schema/piece-manifest.schema.json:

    {"schema": "content-engine-piece-manifest/1", "piece_id", "approval_sha256",
     "qa": {"state": "passed" | "held" | "failed", "checked_at"},
     "assets": [{"name", "drive_id", "sha256", "order"}],
     "channels": {channel: {"words", "alt_text": [text, ...] | null, "assets": [name, ...]}}}

Three steps, and nothing here sends anything unless Krish's yes is given for that exact send:

    python3 piece_manifest.py draft SPEC.json --out "0 Publish/manifest.draft.json"
        The draft, before he approves: every field but approval_sha256. Its sha256 is what the board's Approve for
        publish binds (week_board.py --publish-manifest DAY=<the draft>), so his press approves exactly these words,
        files and alt text. Growth refuses a draft (no approval digest: manifest_unapproved).
    python3 piece_manifest.py seal --draft D --approval APPROVAL.json --out "0 Publish/manifest.json"
        After his press: APPROVAL.json is his picks/<day>-publish document as the board API returns it
        ({"id", "updated_by", "body"}). It must be his (updated_by Krish), approved, for this piece, and bound to this
        draft's sha256; approval_sha256 is the sha256 of its body's canonical JSON. Prints the manifest's sha256.
    python3 piece_manifest.py dispatch --manifest M --url URL --run-id ID --slots SLOTS.json [--deliver --yes "..."]
        The go-live dispatch's client_payload: the slots Growth's drafts are (Growth's closed slot shape), each marked
        per_item_review true so every post is its own go-live (one decision per post), and piece_manifest {url, sha256}.
        Printed by default. --deliver sends the repository_dispatch to growth-makeyourmindup and needs --yes with
        Krish's words for this send (it is an external send).

SPEC.json (written by the session from the piece's record and its library folder):

    {"piece_id": "<uuid>", "qa": {"state": "passed", "checked_at": "2026-11-09T07:00:00Z"},
     "assets": [{"name": "short_video", "drive_id": "...", "sha256": "..."}, ...],   # in the order he uses them
     "channels": {"tiktok": {"words": "...", "alt_text": null, "assets": ["short_video"]}, ...}}
"""
import argparse
import hashlib
import json
import re
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import asset_spec  # noqa: E402  config/asset-spec.json: the asset names the engine produces now

SCHEMA = 'content-engine-piece-manifest/1'
SCHEMA_FILE = Path(__file__).resolve().parents[2] / 'config' / 'schema' / 'piece-manifest.schema.json'
# Growth's closed vocabularies (growth-makeyourmindup engine/run/release.py CHANNELS, engine/run/handoff.py, 38fada1).
CHANNELS = ('substack-notes', 'threads', 'x', 'instagram', 'facebook', 'tiktok', 'youtube', 'linkedin')
PIECE_ID = re.compile(r'^[A-Za-z0-9][A-Za-z0-9:._-]{0,119}$')
NAME = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$')
DRIVE_ID = re.compile(r'^[A-Za-z0-9_-]{10,100}$')
HEX64 = re.compile(r'^[0-9a-f]{64}$')
CHECKED_AT = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$')
RUN_ID = re.compile(r'^[A-Za-z0-9](?:[A-Za-z0-9:.-]{0,118}[A-Za-z0-9])?$')
SLOT_ID = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$')
BUFFER_ID = re.compile(r'^[a-f0-9]{24}$')
FORMAT = re.compile(r'^[a-z0-9][a-z0-9_-]{0,47}$')
PLACEMENT = re.compile(r'^[a-z][a-z0-9_]{0,31}$')
DUE_AT = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3}|\.\d{6})?(?:Z|[+-]\d{2}:\d{2})$')
SLOT_KEYS = ('slot', 'channel', 'buffer_draft_id', 'payload_sha256', 'per_item_review', 'format', 'due_at', 'link_placement', 'publish_mode')
GO_LIVE = 'growth-go-live-manifest'
GROWTH_REPO = 'krishanraja/growth-makeyourmindup'
YES = re.compile(r'^Krish, (\d{4}-\d{2}-\d{2}): (\S.{3,})$', re.S)
# A viewer page is not the file's bytes: Growth downloads the manifest itself and hashes what it gets.
VIEWER = re.compile(r'^https://(?:drive|docs)\.google\.com/(?:file/d/[^/]+/(?:view|edit|preview)|open\b|document/)')
MAX_BYTES = 262144
MAX_ASSETS = 40


class ManifestError(Exception):
    pass


def canonical(value):
    """The board API's canonical JSON (apps/control-plane/api/board/_contracts.ts canonical): keys sorted, no spaces."""
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def sha256(data):
    return hashlib.sha256(data if isinstance(data, bytes) else data.encode('utf-8')).hexdigest()


def encode(manifest):
    """The file's bytes: stable, so the same manifest always has the same sha256."""
    return (json.dumps(manifest, indent=1, ensure_ascii=False, sort_keys=False) + '\n').encode('utf-8')


def problems(value, draft=False):
    """Why this is not Growth's closed shape (or the draft's: everything but approval_sha256), [] when it is. Mirrors
    growth-makeyourmindup engine/run/piece_manifest.py validate()."""
    out = []
    keys = {'schema', 'piece_id', 'qa', 'assets', 'channels'} | (set() if draft else {'approval_sha256'})
    if not isinstance(value, dict) or set(value) != keys:
        return [f'the keys are exactly {sorted(keys)}']
    if value['schema'] != SCHEMA:
        out.append(f'schema is {SCHEMA}')
    if not isinstance(value['piece_id'], str) or not PIECE_ID.match(value['piece_id']):
        out.append('piece_id is the piece\'s id')
    if not draft and not (isinstance(value['approval_sha256'], str) and HEX64.match(value['approval_sha256'])):
        out.append('approval_sha256 is the sha256 of his approval')
    qa = value['qa']
    if not isinstance(qa, dict) or set(qa) != {'state', 'checked_at'} or qa.get('state') not in ('passed', 'held', 'failed') \
            or not (isinstance(qa.get('checked_at'), str) and CHECKED_AT.match(qa['checked_at'])):
        out.append('qa is {state: passed|held|failed, checked_at: a time with its zone}')
    assets = value['assets']
    names, orders = set(), set()
    if not isinstance(assets, list) or len(assets) > MAX_ASSETS:
        out.append(f'assets is a list of at most {MAX_ASSETS}')
        assets = []
    for a in assets:
        if not isinstance(a, dict) or set(a) != {'name', 'drive_id', 'sha256', 'order'} \
                or not (isinstance(a['name'], str) and NAME.match(a['name'])) \
                or not (isinstance(a['drive_id'], str) and DRIVE_ID.match(a['drive_id'])) \
                or not (isinstance(a['sha256'], str) and HEX64.match(a['sha256'])) \
                or isinstance(a['order'], bool) or not isinstance(a['order'], int) or a['order'] < 1:
            out.append(f'asset {a!r:.80}: name (letters, digits, . _ -), drive_id, sha256 and order from 1')
            continue
        if asset_spec.asset_kind(a['name']) is None:
            out.append(f'asset {a["name"]}: not an asset the engine produces now (config/asset-spec.json: '
                       f'{", ".join(asset_spec.known_names())})')
        if a['name'] in names or a['order'] in orders:
            out.append(f'asset {a["name"]}: a name or order used twice')
        names.add(a['name'])
        orders.add(a['order'])
    channels = value['channels']
    if not isinstance(channels, dict) or not channels:
        out.append('channels has at least one channel')
        channels = {}
    for ch, e in channels.items():
        if ch not in CHANNELS:
            out.append(f'{ch}: not one of Growth\'s channels ({", ".join(CHANNELS)})')
            continue
        if not isinstance(e, dict) or set(e) != {'words', 'alt_text', 'assets'} or not (isinstance(e['words'], str) and e['words'].strip()) \
                or not isinstance(e['assets'], list) or any(n not in names for n in e['assets']) or len(set(e['assets'])) != len(e['assets']):
            out.append(f'{ch}: words, alt_text and assets (names from assets, each once)')
            continue
        alt = e['alt_text']
        if alt is not None and not (isinstance(alt, list) and len(alt) == len(e['assets']) and all(isinstance(t, str) for t in alt)):
            out.append(f'{ch}: alt_text is null or one text per asset, in order')
    return out


def draft(spec):
    """The draft manifest from SPEC: the closed shape without approval_sha256. Each asset's order is its place in SPEC."""
    if not isinstance(spec, dict):
        raise ManifestError('SPEC is {"piece_id", "qa", "assets": [...], "channels": {...}}')
    assets = [{'name': a.get('name'), 'drive_id': a.get('drive_id'), 'sha256': a.get('sha256'), 'order': n}
              for n, a in enumerate(spec.get('assets') or [], 1) if isinstance(a, dict)]
    out = {'schema': SCHEMA, 'piece_id': spec.get('piece_id'), 'qa': spec.get('qa'), 'assets': assets,
           'channels': {ch: {'words': e.get('words'), 'alt_text': e.get('alt_text'), 'assets': e.get('assets') or []}
                        if isinstance(e, dict) else e for ch, e in (spec.get('channels') or {}).items()}}
    bad = problems(out, draft=True)
    if bad:
        raise ManifestError('the manifest is not Growth\'s shape:\n  ' + '\n  '.join(bad))
    return out


def seal(draft_bytes, approval):
    """The manifest Growth reads: the draft plus approval_sha256, only when his approval binds this draft."""
    try:
        d = json.loads(draft_bytes.decode('utf-8'))
    except (UnicodeDecodeError, ValueError):
        raise ManifestError('the draft is not JSON')
    bad = problems(d, draft=True)
    if bad:
        raise ManifestError('the draft is not Growth\'s shape:\n  ' + '\n  '.join(bad))
    if not isinstance(approval, dict) or approval.get('updated_by') != 'Krish':
        raise ManifestError('the approval is not his: only a picks/<day>-publish document Krish wrote counts')
    body = approval.get('body') if isinstance(approval.get('body'), dict) else {}
    if not re.fullmatch(r'(mon|wed|fri)-publish', str(approval.get('id') or '')) or body.get('kind') != 'approve_publish':
        raise ManifestError('the approval is his Approve for publish press, picks/<day>-publish')
    if body.get('approved') is not True:
        raise ManifestError('he has not approved it (or took his approval back)')
    if body.get('piece_id') != d['piece_id']:
        raise ManifestError(f'the approval is for {body.get("piece_id")}, not {d["piece_id"]}')
    if body.get('manifest_sha256') != sha256(draft_bytes):
        raise ManifestError('his approval is bound to another manifest: rebuild the board with this draft and have him approve it')
    if d['qa']['state'] != 'passed':
        raise ManifestError(f'QA is {d["qa"]["state"]}: Growth holds every slot until QA has passed')
    return {**{k: d[k] for k in ('schema', 'piece_id')}, 'approval_sha256': sha256(canonical(body)),
            **{k: d[k] for k in ('qa', 'assets', 'channels')}}


def dispatch_payload(manifest_bytes, url, run_id, slots, express=None):
    """The growth-go-live-manifest client_payload: every slot per_item_review true, and piece_manifest {url, sha256}."""
    try:
        m = json.loads(manifest_bytes.decode('utf-8'))
    except (UnicodeDecodeError, ValueError):
        raise ManifestError('the manifest is not JSON')
    bad = problems(m)
    if bad:
        raise ManifestError('the manifest is not Growth\'s shape (seal it first):\n  ' + '\n  '.join(bad))
    if len(manifest_bytes) > MAX_BYTES:
        raise ManifestError(f'the manifest is over {MAX_BYTES} bytes')
    if not isinstance(url, str) or not url.startswith('https://') or VIEWER.match(url):
        raise ManifestError('the url is a direct https download of the file itself, never a Drive viewer page')
    if not isinstance(run_id, str) or not RUN_ID.match(run_id) or not run_id.startswith('makeyourmindup:'):
        raise ManifestError('run_id is makeyourmindup:<run>')
    if not isinstance(slots, list) or not 1 <= len(slots) <= 60:
        raise ManifestError('give 1 to 60 slots')
    out, seen = [], set()
    for s in slots:
        if not isinstance(s, dict) or set(s) - set(SLOT_KEYS) - {'per_item_review'} or set(SLOT_KEYS) - {'per_item_review'} - set(s):
            raise ManifestError(f'a slot is exactly {", ".join(SLOT_KEYS)} ({s!r:.80})')
        if not SLOT_ID.match(str(s['slot'])) or s['slot'] in seen:
            raise ManifestError(f'slot {s["slot"]!r}: an id, each once')
        seen.add(s['slot'])
        if s['channel'] not in m['channels']:
            raise ManifestError(f'slot {s["slot"]}: {s["channel"]} has no post in the manifest, so Growth would hold it')
        if not BUFFER_ID.match(str(s['buffer_draft_id'])) or not HEX64.match(str(s['payload_sha256'])) or not FORMAT.match(str(s['format'])):
            raise ManifestError(f'slot {s["slot"]}: buffer_draft_id, payload_sha256 and format as Growth takes them')
        if s['due_at'] is not None and not DUE_AT.match(str(s['due_at'])):
            raise ManifestError(f'slot {s["slot"]}: due_at is a time with its zone, or null')
        if s['link_placement'] is not None and not PLACEMENT.match(str(s['link_placement'])):
            raise ManifestError(f'slot {s["slot"]}: link_placement')
        if s['publish_mode'] not in ('engine', 'krish_click') or (s['channel'] == 'linkedin' and s['publish_mode'] != 'krish_click'):
            raise ManifestError(f'slot {s["slot"]}: publish_mode is engine or krish_click, and LinkedIn is always krish_click')
        # One decision per post: every slot is its own go-live.
        out.append({k: (True if k == 'per_item_review' else s[k]) for k in SLOT_KEYS})
    payload = {'run_id': run_id, 'slots': out, 'piece_manifest': {'url': url, 'sha256': sha256(manifest_bytes)}}
    if express is not None:
        payload['express'] = bool(express)
    return payload


def deliver(payload, yes, call=None):
    """Send the repository_dispatch to Growth: an external send, only with Krish's words for it."""
    if not YES.match(str(yes or '').strip()):
        raise ManifestError('--deliver needs --yes "Krish, YYYY-MM-DD: <his words saying yes to this send>"')
    body = json.dumps({'event_type': GO_LIVE, 'client_payload': payload}).encode('utf-8')
    if call:
        return call(body)
    req = urllib.request.Request(f'https://api.github.com/repos/{GROWTH_REPO}/dispatches', data=body, method='POST',
                                 headers={'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status


def self_test():
    import tempfile
    problems_seen = []
    check = lambda name, ok: problems_seen.append(name) if not ok else None
    piece = '11111111-2222-4333-8444-555555555555'
    spec = {'piece_id': piece, 'qa': {'state': 'passed', 'checked_at': '2026-11-09T07:00:00Z'},
            'assets': [{'name': 'short_video', 'drive_id': 'a' * 25, 'sha256': '1' * 64},
                       {'name': 'vertical_cover', 'drive_id': 'b' * 25, 'sha256': '2' * 64}],
            'channels': {'tiktok': {'words': 'Synthetic caption.', 'alt_text': None, 'assets': ['short_video']},
                         'instagram': {'words': 'Synthetic caption.', 'alt_text': None, 'assets': ['short_video']},
                         'linkedin': {'words': 'Synthetic post.', 'alt_text': ['A synthetic cover.'], 'assets': ['vertical_cover']}}}
    d = draft(spec)
    db = encode(d)
    check('the draft is Growth\'s shape without approval_sha256', 'approval_sha256' not in d and problems(d, draft=True) == []
          and [a['order'] for a in d['assets']] == [1, 2])
    check('the same draft has the same bytes', encode(draft(spec)) == db)
    for bad, why in ((dict(spec, channels={'myspace': {'words': 'x', 'alt_text': None, 'assets': []}}), 'an unknown channel'),
                     (dict(spec, channels={'tiktok': {'words': 'x', 'alt_text': None, 'assets': ['nope']}}), 'an asset it does not hold'),
                     (dict(spec, channels={'tiktok': {'words': 'x', 'alt_text': ['a', 'b'], 'assets': ['short_video']}}), 'alt text not one per asset'),
                     (dict(spec, assets=[{'name': '3 Video/x.mp4', 'drive_id': 'a' * 25, 'sha256': '1' * 64}]), 'a name with spaces'),
                     (dict(spec, assets=spec['assets'] + [{'name': 'teaser_gif', 'drive_id': 'c' * 25, 'sha256': '3' * 64}]), 'an asset the spec does not hold')):
        try:
            draft(bad)
            check(f'the draft refuses {why}', False)
        except ManifestError:
            pass
    approval = {'id': 'mon-publish', 'updated_by': 'Krish',
                'body': {'kind': 'approve_publish', 'day': 'mon', 'piece_id': piece, 'approved': True, 'manifest_sha256': sha256(db), 'at': '2026-11-09T07:40:00Z'}}
    m = seal(db, approval)
    check('the sealed manifest is Growth\'s closed shape with his approval digest', problems(m) == []
          and m['approval_sha256'] == sha256(canonical(approval['body'])) and list(m) == ['schema', 'piece_id', 'approval_sha256', 'qa', 'assets', 'channels'])
    try:
        import jsonschema
        jsonschema.validate(m, json.loads(SCHEMA_FILE.read_text(encoding='utf-8')))
        check('the sealed manifest passes Growth\'s JSON schema', True)
    except ImportError:
        pass
    except Exception as error:  # noqa: BLE001 - a schema failure is reported as a failed check
        check(f'the sealed manifest passes Growth\'s JSON schema ({error})', False)
    for change, why in (({'updated_by': 'engine_operator'}, 'a document a session wrote'),
                        ({'body': dict(approval['body'], approved=False)}, 'an approval taken back'),
                        ({'body': dict(approval['body'], manifest_sha256='f' * 64)}, 'an approval of another manifest'),
                        ({'body': dict(approval['body'], piece_id='22222222-2222-4333-8444-555555555555')}, 'an approval of another piece'),
                        ({'id': 'mon-scripts'}, 'another press')):
        try:
            seal(db, {**approval, **change})
            check(f'seal refuses {why}', False)
        except ManifestError:
            pass
    held = encode(draft(dict(spec, qa={'state': 'held', 'checked_at': '2026-11-09T07:00:00Z'})))
    try:
        seal(held, {**approval, 'body': dict(approval['body'], manifest_sha256=sha256(held))})
        check('seal refuses a manifest whose QA has not passed', False)
    except ManifestError:
        pass
    mb = encode(m)
    slot = lambda n, ch, mode='engine': {'slot': f's{n}', 'channel': ch, 'buffer_draft_id': f'{n:024x}', 'payload_sha256': f'{n:064x}',
                                         'per_item_review': False, 'format': 'short_video', 'due_at': '2026-11-10T14:00:00Z',
                                         'link_placement': None, 'publish_mode': mode}
    url = 'https://drive.usercontent.google.com/download?id=' + 'c' * 25 + '&export=download'
    p = dispatch_payload(mb, url, 'makeyourmindup:2026-11-09-mon', [slot(1, 'tiktok'), slot(2, 'instagram'), slot(3, 'linkedin', 'krish_click')])
    check('every slot is per_item_review true, one decision per post', [s['per_item_review'] for s in p['slots']] == [True, True, True])
    check('the dispatch names the manifest by its url and the sha256 of its bytes', p['piece_manifest'] == {'url': url, 'sha256': sha256(mb)})
    # Growth's closed shape for this event (engine/run/handoff.py validate_manifest at 38fada1).
    check('the payload is Growth\'s closed growth-go-live-manifest shape', set(p) <= {'run_id', 'slots', 'express', 'piece_manifest'}
          and all(set(s) == set(SLOT_KEYS) for s in p['slots']) and set(p['piece_manifest']) == {'url', 'sha256'})
    for args, why in (((mb, 'https://drive.google.com/file/d/' + 'c' * 25 + '/view', 'makeyourmindup:r', [slot(1, 'tiktok')]), 'a Drive viewer page'),
                      ((mb, url, 'makeyourmindup:r', [slot(1, 'x')]), 'a slot on a channel the manifest has no post for'),
                      ((mb, url, 'makeyourmindup:r', [slot(1, 'linkedin')]), 'LinkedIn not as a click'),
                      ((mb, url, 'other:r', [slot(1, 'tiktok')]), 'a run id that is not makeyourmindup\'s'),
                      ((mb, url, 'makeyourmindup:r', [slot(1, 'tiktok'), slot(1, 'tiktok')]), 'a slot twice'),
                      ((db, url, 'makeyourmindup:r', [slot(1, 'tiktok')]), 'a draft that was never sealed')):
        try:
            dispatch_payload(*args)
            check(f'dispatch refuses {why}', False)
        except ManifestError:
            pass
    sent = []
    try:
        deliver(p, None, sent.append)
        check('deliver refuses without his words for the send', False)
    except ManifestError:
        pass
    deliver(p, 'Krish, 2026-11-09: yes, send Monday to Growth', sent.append)
    check('deliver sends one growth-go-live-manifest dispatch with the payload', len(sent) == 1
          and json.loads(sent[0]) == {'event_type': GO_LIVE, 'client_payload': p})
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / 'manifest.draft.json'
        rc = main(['draft', str(_write(Path(tmp) / 'spec.json', spec)), '--out', str(out)])
        check('the draft command writes the draft and its sha256', rc == 0 and out.read_bytes() == db)
    return problems_seen


def _write(path, value):
    path.write_text(json.dumps(value), encoding='utf-8')
    return path


def _read(path, what):
    try:
        return Path(path).read_bytes()
    except OSError as error:
        raise ManifestError(f'{what}: cannot read {path}: {error.strerror}')


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd')
    d = sub.add_parser('draft', help='the draft manifest, before he approves; its sha256 rides on Approve for publish')
    d.add_argument('spec')
    d.add_argument('--out', required=True)
    s = sub.add_parser('seal', help='the manifest Growth reads, once his Approve for publish binds the draft')
    s.add_argument('--draft', required=True)
    s.add_argument('--approval', required=True, help='his picks/<day>-publish document, as GET /api/board/<Monday>/picks returns it')
    s.add_argument('--out', required=True)
    g = sub.add_parser('dispatch', help='the growth-go-live-manifest client_payload; printed unless --deliver with his yes')
    g.add_argument('--manifest', required=True)
    g.add_argument('--url', required=True, help='a direct https download of the manifest file itself')
    g.add_argument('--run-id', required=True)
    g.add_argument('--slots', required=True, help='the slots Growth\'s drafts are, in its closed slot shape')
    g.add_argument('--express', action='store_true')
    g.add_argument('--deliver', action='store_true')
    g.add_argument('--yes', help='"Krish, YYYY-MM-DD: <his words>" saying yes to this send')
    sub.add_parser('self-test')
    a = ap.parse_args(argv)
    try:
        if a.cmd == 'self-test':
            bad = self_test()
            print('piece_manifest self-test ' + ('FAILED:\n  ' + '\n  '.join(bad) if bad else 'passed'))
            return 1 if bad else 0
        if a.cmd == 'draft':
            data = encode(draft(json.loads(_read(a.spec, 'SPEC').decode('utf-8'))))
            Path(a.out).parent.mkdir(parents=True, exist_ok=True)
            Path(a.out).write_bytes(data)
            print(f'wrote {a.out}, sha256 {sha256(data)}; build the board with --publish-manifest DAY={a.out}')
            return 0
        if a.cmd == 'seal':
            data = encode(seal(_read(a.draft, '--draft'), json.loads(_read(a.approval, '--approval').decode('utf-8'))))
            Path(a.out).write_bytes(data)
            print(f'wrote {a.out}, sha256 {sha256(data)}')
            return 0
        if a.cmd == 'dispatch':
            payload = dispatch_payload(_read(a.manifest, '--manifest'), a.url, a.run_id,
                                       json.loads(_read(a.slots, '--slots').decode('utf-8')), True if a.express else None)
            if a.deliver:
                print(f'sent {GO_LIVE} to {GROWTH_REPO}: HTTP {deliver(payload, a.yes)}')
            else:
                print(json.dumps({'event_type': GO_LIVE, 'client_payload': payload}, indent=1))
            return 0
    except (ManifestError, ValueError) as error:
        print(f'piece_manifest: {error}', file=sys.stderr)
        return 1
    ap.print_help()
    return 2


if __name__ == '__main__':
    raise SystemExit(main())
