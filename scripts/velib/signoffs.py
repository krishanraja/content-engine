"""Krish's video sign-offs, one review card each on his Publish Board.

Ruling (Krish, 2026-11-12): the three video sign-offs are one review card each on his board, with samples, and only his
presses write the configs. His words: "One review card each: each goes on your Publish Board as a card with samples to
look at and listen to, plus Approve or Not this. About 10 minutes in total." The three that had waited on him:

  sfx      a set of approved sound effects (config/sfx-approved.json approved none), one press per sound;
  golden   at least 5 golden frames (config/ve/golden-frames.json, all 10 slots empty), one press per frame;
  gate2    Gate 2 on the face-with-proof layout at 16:9 (config/ve/design-lock.json drafts), one press for the card.

  config/ve/sign-offs.json  the cards and their samples. Each sample is a file in his Drive (its id and link) with the
                            sha256 of its bytes, which his press binds; only ids, hashes, pieces and times are committed,
                            never media (AGENTS.md).
  make, by a session        `ve signoff stills` cuts candidate frames from a published cut (the library's copy, found
                            by the making record's path and checked by its sha256); `ve signoff gate2` renders one still
                            per locked beat through the one render path (ve-render.mjs --stills); `ve signoff add`
                            records a sample filed in Drive, hashing the local file.
  press, by Krish only      POST /api/board/<Monday>/sign-off on the live board (apps/control-plane/api/board/_signOffs.ts).
  apply, by the engine      .github/workflows/signoff-apply.yml, started by his press: reads every press
                            (GET /api/board/sign-offs, the engine key), fetches each approved sample by its Drive id
                            through the engine and checks its sha256, and writes the configs through their own writers
                            (sfx.approve_reviewed, golden.fill_from_cut, designlock.freeze with his words). A Not this is
                            written as his no, with the date. Nothing is ever approved for him: a config row exists only
                            when a press of his names that sample's exact bytes.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

from .common import CONFIG, ROOT, ffmpeg, load_json, sha256_file, write_json

MANIFEST = CONFIG / 'sign-offs.json'
CARDS = ('sfx', 'golden', 'gate2')
KINDS = {'audio', 'image', 'video'}
SHA = re.compile(r'^[0-9a-f]{64}$')
DRIVE_ID = re.compile(r'^[A-Za-z0-9_-]{10,}$')
ITEM_ID = re.compile(r'^[a-z0-9][a-z0-9_.-]{0,63}$')
VERDICTS = ('approve', 'not_this')
GATE2_LOCK = 'face-with-proof@16:9'
CARD_ITEM = '*'   # the item a card-level press names (Gate 2: one press for the whole card)


def load(path: Path | str = MANIFEST) -> dict:
    return load_json(path)


def canonical(value) -> str:
    """The board's canonical JSON (_contracts.ts canonical): sorted keys, no spaces."""
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def digest(text: str) -> str:
    import hashlib  # noqa: PLC0415
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def card(doc: dict, card_id: str) -> dict:
    found = next((c for c in doc.get('cards') or [] if c.get('id') == card_id), None)
    if found is None:
        raise ValueError(f'no card {card_id} in the sign-offs manifest')
    return found


def card_sha256(entry: dict) -> str:
    """What a card-level press binds: the sha256 of the canonical map of each item's id to its sha256 (Gate 2's stills,
    one per beat), so the press names exactly the frames he saw."""
    return digest(canonical({i['id']: i['sha256'] for i in entry.get('items') or []}))


def validate(doc: dict) -> list[str]:
    """Every shape rule the board and the apply step rely on. A sample is a Drive file with the sha256 of its bytes."""
    out = []
    if doc.get('schema') != 've-sign-offs/1':
        out.append('schema is ve-sign-offs/1')
    ids = [c.get('id') for c in doc.get('cards') or []]
    if ids != list(CARDS):
        out.append(f'cards are {", ".join(CARDS)} in that order, one each (got {ids})')
    for entry in doc.get('cards') or []:
        cid = entry.get('id')
        if entry.get('presses') not in ('each', 'card'):
            out.append(f'{cid}: presses is each or card')
        if not str(entry.get('title') or '').strip() or not str(entry.get('ask') or '').strip():
            out.append(f'{cid}: a title and an ask in plain words')
        seen = set()
        for item in entry.get('items') or []:
            iid = item.get('id')
            where = f'{cid}.{iid}'
            if not isinstance(iid, str) or not ITEM_ID.match(iid) or iid in seen:
                out.append(f'{where}: a unique lower-case id')
            seen.add(iid)
            if item.get('kind') not in KINDS:
                out.append(f'{where}: kind is audio, image or video')
            if not SHA.match(str(item.get('sha256') or '')):
                out.append(f'{where}: the sha256 of the sample his press binds')
            drive = item.get('drive') or {}
            if not DRIVE_ID.match(str(drive.get('file_id') or '')) or not str(drive.get('url') or '').startswith('https://drive.google.com/'):
                out.append(f'{where}: its Drive file (file_id and its https://drive.google.com/ link)')
            if not str(item.get('title') or '').strip():
                out.append(f'{where}: a title')
            if cid == 'sfx' and (item.get('kind') != 'audio' or not item.get('provider_id') or not item.get('slot')):
                out.append(f'{where}: a sound is audio, with its provider_id and the slot it is for')
            if cid == 'golden' and (item.get('kind') != 'image' or not item.get('piece_id') or item.get('cut') not in ('long', 'short')
                                    or not isinstance(item.get('at_s'), (int, float)) or not SHA.match(str(item.get('cut_sha256') or ''))):
                out.append(f'{where}: a golden frame names its piece, its cut, its time and the cut file\'s sha256')
            if cid == 'gate2' and (item.get('kind') != 'image' or item.get('beat') != iid):
                out.append(f'{where}: a Gate 2 still is the image of the beat it is named for')
        if cid == 'gate2' and entry.get('items'):
            if entry.get('presses') != 'card':
                out.append('gate2: one press for the whole card')
            if entry.get('lock') != GATE2_LOCK:
                out.append(f'gate2: lock is {GATE2_LOCK}')
        if cid in ('sfx', 'golden') and entry.get('presses') != 'each':
            out.append(f'{cid}: one press per sample')
    return out


# ---------------------------------------------------------------- making the samples (a session)

def library_fetch(path: str, dest: Path, sha256: str | None = None, call=None) -> Path:
    """One file from the engine's library, by the path the making record holds, into dest; checked by the sha256 the
    library recorded (and the one given). The same route music.py fetch and produce_day use."""
    if call is None:
        import sys  # noqa: PLC0415
        sys.path.insert(0, str(ROOT / 'scripts'))
        import engine  # noqa: PLC0415  scripts/engine.py
        token = engine.operator_key()
        call = lambda method, route: engine.call(method, route, None, token, timeout=60)  # noqa: E731
    status, text = call('GET', '/api/library/file?path=' + urllib.parse.quote(path))
    answer = json.loads(text) if text and text.strip().startswith('{') else {}
    url = (answer.get('download') or {}).get('url')
    if status != 200 or not url or not str(url).startswith('https://'):
        raise ValueError(f'the library has no copy of {path} ({status})')
    want = sha256 or (answer.get('file') or {}).get('sha256')
    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_suffix(dest.suffix + '.part')
    with urllib.request.urlopen(url, timeout=900) as response, open(part, 'wb') as handle:
        shutil.copyfileobj(response, handle, 1 << 20)
    if want and sha256_file(part) != want:
        part.unlink()
        raise ValueError(f'{path}: the bytes that came back are not the file on the record')
    part.replace(dest)
    return dest


def probe_seconds(video: Path) -> float:
    out = subprocess.run([ffmpeg().replace('ffmpeg', 'ffprobe'), '-v', 'error', '-show_entries', 'format=duration',
                          '-of', 'csv=p=0', str(video)], capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def scene_cuts(video: Path, threshold: float = 0.3) -> list[float]:
    """The times the picture changes (ffmpeg's scene score), so a candidate is never a frame mid-transition."""
    result = subprocess.run([ffmpeg(), '-nostdin', '-v', 'info', '-i', str(video), '-an', '-vf',
                             f"scale=320:-2,select='gt(scene,{threshold})',showinfo", '-f', 'null', '-'],
                            capture_output=True, text=True)
    return [float(m) for m in re.findall(r'pts_time:([0-9.]+)', result.stderr)]


def settled_times(duration: float, cuts: list[float], count: int, *, settle: float = 1.2, edge: float = 1.5) -> list[float]:
    """Up to count times spread across the cut, each settle seconds after a picture change (or at a quiet point when the
    cut has few changes), never within edge seconds of either end. Pure, so the choice is testable."""
    starts = [0.0] + sorted(c for c in cuts if 0 < c < duration)
    ends = starts[1:] + [duration]
    shots = [(s, e) for s, e in zip(starts, ends) if e - s >= settle * 1.5]
    pool = []
    for s, e in shots:
        t = min(s + settle, (s + e) / 2)
        if edge <= t <= duration - edge:
            pool.append(round(t, 2))
    if len(pool) < count:   # few cuts (a talking take): add evenly spaced times between them
        step = (duration - 2 * edge) / max(count, 1)
        pool += [round(edge + step * (k + 0.5), 2) for k in range(count)]
        pool = sorted(set(pool))
    if len(pool) <= count:
        return pool
    picked = [pool[round(k * (len(pool) - 1) / (count - 1))] for k in range(count)] if count > 1 else [pool[len(pool) // 2]]
    return sorted(set(picked))


def still(video: Path, at_s: float, out: Path, quality: int = 2) -> Path:
    """One full-size frame of the file at its own clock."""
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-y', '-ss', f'{at_s:.3f}', '-i', str(video), '-frames:v', '1',
                    '-q:v', str(quality), str(out)], check=True, capture_output=True)
    return out


def contact_sheet(stills: list[Path], out: Path, labels: list[str], width: int = 320) -> Path:
    """One picture of the candidates with their labels, for the session to choose from (never for the board)."""
    from PIL import Image, ImageDraw  # noqa: PLC0415
    thumbs = []
    for path in stills:
        with Image.open(path) as image:
            image = image.convert('RGB')
            h = round(image.height * width / image.width)
            thumbs.append(image.resize((width, h)))
    cols = 4
    cell_h = max(t.height for t in thumbs) + 22
    sheet = Image.new('RGB', (cols * (width + 8), ((len(thumbs) + cols - 1) // cols) * cell_h), 'white')
    draw = ImageDraw.Draw(sheet)
    for k, (thumb, label) in enumerate(zip(thumbs, labels)):
        x, y = (k % cols) * (width + 8), (k // cols) * cell_h
        sheet.paste(thumb, (x, y))
        draw.text((x + 2, y + thumb.height + 4), label, fill='black')
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out, quality=80)
    return out


def making_cut(piece_id: str, cut: str, call=None) -> dict:
    """The newest file of one cut on a piece's making record (meta.making.video_assets): its library path and sha256."""
    if call is None:
        import sys  # noqa: PLC0415
        sys.path.insert(0, str(ROOT / 'scripts'))
        import engine  # noqa: PLC0415
        token = engine.operator_key()
        call = lambda method, route: engine.call(method, route, None, token, timeout=60)  # noqa: E731
    status, text = call('GET', f'/api/content-ideas/{piece_id}/making')
    answer = json.loads(text) if text and text.strip().startswith('{') else {}
    making = answer.get('making') or (answer.get('meta') or {}).get('making') or answer
    assets = [a for a in (making.get('video_assets') or []) if a.get('cut') == cut and a.get('path')]
    if status != 200 or not assets:
        raise ValueError(f'{piece_id}: no {cut} cut on its making record ({status})')
    newest = max(assets, key=lambda a: a.get('at') or '')
    folder = (making.get('pack') or {}).get('folder')
    # A path written relative to the post (3 Video/...) lives in the post's own folder (docs/PUBLISH_BOARDS.md, "A cut
    # always plays").
    path = newest['path'] if newest['path'].startswith('3 Posts/') else f'3 Posts/{folder}/{newest["path"]}' if folder else None
    if path is None:
        raise ValueError(f'{piece_id}: its {cut} cut is recorded relative to the post ({newest["path"]}); give --path')
    return {'path': path, 'drive_url': newest.get('url'), 'seconds': newest.get('seconds')}


def stills_for_cut(video: Path, out_dir: Path, stem: str, count: int, at: list[float] | None = None) -> list[dict]:
    """Candidate golden frames from one cut: the times given (a reference moment, config/reference-cuts.json), else
    settled frames spread across it; each a full-size JPEG with its time."""
    duration = probe_seconds(video)
    times = sorted(t for t in at if 0 <= t < duration) if at else settled_times(duration, scene_cuts(video), count)
    rows = []
    for t in times:
        minutes, seconds = divmod(t, 60)
        label = f'{int(minutes)}:{seconds:04.1f}'
        path = still(video, t, Path(out_dir) / f'{stem}-{int(t * 10):05d}.jpg')
        rows.append({'at_s': t, 'at': label, 'file': str(path), 'sha256': sha256_file(path)})
    return rows


def render_stills(props_path: Path, out_dir: Path, frames: dict[str, int]) -> dict[str, Path]:
    """One PNG per beat through the one render path (apps/renderer/scripts/ve-render.mjs --stills), named <beat>.png."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    work = out_dir / '.frames'
    if work.exists():
        shutil.rmtree(work)
    order = sorted(set(frames.values()))
    subprocess.run(['node', str(ROOT / 'apps/renderer/scripts/ve-render.mjs'), str(Path(props_path).resolve()),
                    str(work.resolve()), '--stills', ','.join(str(f) for f in order)], cwd=ROOT, check=True)
    made = sorted(work.glob('*.png'))
    if len(made) != len(order):
        raise ValueError(f'the renderer wrote {len(made)} stills for {len(order)} frames')
    by_frame = dict(zip(order, made))
    result = {}
    for beat, frame in frames.items():
        target = out_dir / f'{beat}.png'
        shutil.copyfile(by_frame[frame], target)
        result[beat] = target
    shutil.rmtree(work)
    return result


def key_frames(props: dict, beats: list[str]) -> dict[str, int]:
    """Each locked beat's key frame, by the rule QC compares them at (velib/qc_keyframes._frame): its keyFrame, else
    80% of the way through the beat."""
    from .qc import frame_span  # noqa: PLC0415
    out = {}
    for name in beats:
        beat = next((b for b in props.get('beats') or [] if b.get('id') == name), None)
        if beat is None:
            raise ValueError(f'the props have no {name} beat: a Gate 2 sample draws every locked beat')
        first, end = frame_span(beat)
        out[name] = beat.get('keyFrame', first + int((end - first) * 0.8))
    return out


def strip(stills: dict[str, Path], out: Path, height: int = 270) -> Path:
    """The four Gate 2 stills side by side, in the lock's beat order, for a glance."""
    from PIL import Image  # noqa: PLC0415
    images = []
    for path in stills.values():
        with Image.open(path) as image:
            images.append(image.convert('RGB').resize((round(image.width * height / image.height), height)))
    sheet = Image.new('RGB', (sum(i.width for i in images) + 8 * (len(images) - 1), height), 'black')
    x = 0
    for image in images:
        sheet.paste(image, (x, 0))
        x += image.width + 8
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out, quality=88)
    return out


def add_item(card_id: str, item: dict, local_file: Path, *, path: Path | str = MANIFEST) -> dict:
    """Record one sample filed in his Drive: hashes the local copy of the exact bytes filed, so his press binds them."""
    doc = load(path)
    entry = card(doc, card_id)
    row = {**item, 'sha256': sha256_file(local_file), 'bytes': Path(local_file).stat().st_size}
    entry['items'] = [i for i in entry.get('items') or [] if i.get('id') != row.get('id')] + [row]
    problems = [p for p in validate(doc) if p.startswith(f'{card_id}.{row.get("id")}:')]
    if problems:
        raise ValueError('; '.join(problems))
    write_json(path, doc)
    return row


# ---------------------------------------------------------------- applying his presses (the engine)

def answers_of(presses: list[dict]) -> dict:
    """His latest press on each sample: {card: {item: press}}, from every press the board kept (oldest first). Only a
    press by Krish counts; a press with no sha256 or another verdict is skipped."""
    out: dict[str, dict] = {}
    for p in sorted(presses, key=lambda p: str(p.get('at') or '')):
        if p.get('by') != 'Krish' or p.get('card') not in CARDS or p.get('verdict') not in VERDICTS or not SHA.match(str(p.get('sha256') or '')):
            continue
        out.setdefault(p['card'], {})[str(p.get('item'))] = p
    return out


def plan(doc: dict, answers: dict) -> list[dict]:
    """What his presses ask the configs to hold now, each bound to the sample he saw. A press on bytes that are no longer
    the manifest's sample (replaced since) is left out and said."""
    steps = []
    for entry in doc.get('cards') or []:
        mine = answers.get(entry['id'], {})
        if entry.get('presses') == 'card':
            p = mine.get(CARD_ITEM)
            if not p or not entry.get('items'):
                continue
            ok = p['sha256'] == card_sha256(entry)
            steps.append({'card': entry['id'], 'item': CARD_ITEM, 'verdict': p['verdict'], 'press': p, 'items': entry['items'],
                          'stale': not ok})
            continue
        for item in entry.get('items') or []:
            p = mine.get(item['id'])
            if p:
                steps.append({'card': entry['id'], 'item': item['id'], 'verdict': p['verdict'], 'press': p, 'sample': item,
                              'stale': p['sha256'] != item['sha256']})
    return steps


def _on(press: dict) -> str:
    return str(press.get('at') or date.today().isoformat())[:10]


def apply(doc: dict, answers: dict, fetch_file, *, work: Path, root: Path = ROOT) -> list[str]:
    """Write every press of his into the configs it names, through their own writers. fetch_file(drive_id, dest) brings
    one sample's bytes; each is checked against its sha256 before anything is written. Returns what it did, in words."""
    from . import designlock, golden, sfx  # noqa: PLC0415
    done = []
    steps = plan(doc, answers)
    for step in steps:
        if step['stale']:
            done.append(f"{step['card']} {step['item']}: his press names other bytes than the sample now on the card; left as it is")
    live = [s for s in steps if not s['stale']]
    approved_path = root / 'config' / 'sfx-approved.json'
    kit_path = root / 'config' / 've' / 'sfx-kits' / 'house-v1.json'
    golden_path = root / 'config' / 've' / 'golden-frames.json'
    lock_path = root / 'config' / 've' / 'design-lock.json'
    for step in [s for s in live if s['card'] == 'sfx']:
        p, sample = step['press'], step['sample']
        if step['verdict'] == 'approve':
            if sfx.reviewed_state(sample['id'], sample['sha256'], approved_path) == 'approved':
                continue
            sfx.approve_reviewed(sample, words=p.get('words') or '', on=_on(p), at=p.get('at'), approved_path=approved_path, kit_path=kit_path)
            done.append(f"sound {sample['id']}: approved in config/sfx-approved.json ({_on(p)})")
        else:
            if sfx.reviewed_state(sample['id'], sample['sha256'], approved_path) == 'declined':
                continue
            sfx.decline_reviewed(sample, words=p.get('words') or '', on=_on(p), at=p.get('at'), approved_path=approved_path, kit_path=kit_path)
            done.append(f"sound {sample['id']}: his Not this recorded in config/sfx-approved.json ({_on(p)})")
    for step in sorted([s for s in live if s['card'] == 'golden'], key=lambda s: str(s['press'].get('at'))):
        p, sample = step['press'], step['sample']
        state = golden.reviewed_state(sample['id'], golden_path)
        if step['verdict'] == 'approve':
            if state == 'named':
                continue
            dest = Path(work) / 'golden' / f"{sample['id']}.jpg"
            fetch_file(sample['drive']['file_id'], dest)
            if sha256_file(dest) != sample['sha256']:
                raise ValueError(f"golden {sample['id']}: the file in Drive is not the frame he saw")
            try:
                entry = golden.fill_from_cut(sample, words=p.get('words') or '', on=_on(p), at=p.get('at'), path=golden_path)
            except ValueError as error:   # every slot named: said, never forced
                done.append(f"golden frame {sample['id']}: not named ({error})")
                continue
            done.append(f"golden frame {sample['id']}: named in slot {entry['slot']} ({_on(p)})")
        else:
            if state == 'declined':
                continue
            golden.decline_reviewed(sample, words=p.get('words') or '', on=_on(p), at=p.get('at'), path=golden_path)
            done.append(f"golden frame {sample['id']}: his Not this recorded ({_on(p)})")
    for step in [s for s in live if s['card'] == 'gate2']:
        p, items = step['press'], step['items']
        lock = designlock.load(lock_path)
        if GATE2_LOCK in lock.get('formats', {}):
            continue
        if step['verdict'] == 'approve':
            folder = Path(work) / 'gate2'
            names = {item['beat']: f"{item['beat']}{'.png' if item.get('mime') == 'image/png' else '.jpg'}" for item in items}
            for item in items:
                dest = folder / names[item['beat']]
                fetch_file(item['drive']['file_id'], dest)
                if sha256_file(dest) != item['sha256']:
                    raise ValueError(f"gate2 {item['beat']}: the still in Drive is not the one he saw")
            mapping = names
            designlock.freeze(GATE2_LOCK, folder, mapping, lock_path=lock_path, today=_on(p),
                              approved={'by': 'Krish', 'on': _on(p), 'at': p.get('at'), 'words': p.get('words') or None,
                                        'where': 'his Publish Board, To review: Gate 2 on face-with-proof at 16:9 (Approve)',
                                        'scope': 'face-with-proof 16:9 key frames: one still per beat (hook, face, proof, close)',
                                        'sha256': p['sha256']})
            done.append(f"Gate 2: face-with-proof at 16:9 frozen from his approved stills ({_on(p)})")
        else:
            seen = (lock.get('drafts', {}).get(GATE2_LOCK) or {}).get('gate2')
            if seen and seen.get('sha256') == p['sha256'] and seen.get('verdict') == 'not_this':
                continue
            designlock.gate2_declined(GATE2_LOCK, words=p.get('words') or '', on=_on(p), at=p.get('at'), sha256=p['sha256'],
                                      lock_path=lock_path)
            done.append(f"Gate 2: his Not this recorded on the face-with-proof 16:9 draft ({_on(p)})")
    return done


def engine_fetch_file(drive_id: str, dest: Path) -> Path:
    """One sample's bytes by its Drive id, through the engine (GET /api/board/sign-offs?file=<id>, the engine key),
    which serves only the manifest's samples."""
    import sys  # noqa: PLC0415
    sys.path.insert(0, str(ROOT / 'scripts'))
    import engine  # noqa: PLC0415
    token = engine.operator_key()
    status, text = engine.call('GET', '/api/board/sign-offs?file=' + urllib.parse.quote(drive_id) + '&link=1', None, token, timeout=120)
    answer = json.loads(text) if text and text.strip().startswith('{') else {}
    url = answer.get('url')
    if status != 200 or not url or not str(url).startswith('https://'):
        raise ValueError(f'the engine could not serve the sample {drive_id} ({status})')
    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=600) as response, open(dest, 'wb') as handle:
        shutil.copyfileobj(response, handle, 1 << 20)
    return dest


def engine_presses() -> list[dict]:
    """Every press of his on the sign-off cards, as the engine kept them (GET /api/board/sign-offs, the engine key)."""
    import sys  # noqa: PLC0415
    sys.path.insert(0, str(ROOT / 'scripts'))
    import engine  # noqa: PLC0415
    token = engine.operator_key()
    status, text = engine.call('GET', '/api/board/sign-offs', None, token, timeout=60)
    answer = json.loads(text) if text and text.strip().startswith('{') else {}
    if status != 200 or not isinstance(answer.get('presses'), list):
        raise ValueError(f'the engine did not answer with his presses ({status})')
    return answer['presses']
