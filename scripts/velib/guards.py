"""The guards built from the Thursday 5 Nov failure report (docs/learning/2026-11-04-thursday-killed.md).

Krish, 4 Nov 2026, killing the piece: "Okay, this is shit. I'm going to kill this completely. The visuals are tacky.
The subtitles are all over the place typographically." Each guard below refuses a mechanical cause the report found,
and each enforces something he had already approved (config/ve/production-guards.json says which). Like the proof
gate they bind a whole cut of a piece published from creative_direction.MOTION_FROM (9 Nov 2026).

  - `idea_problems(spec)`: no idea, no production. `style.idea` names the one object or system, what each move means,
    a never-list, and the real artifact where proof exists (or why none exists). Model: Monday 2 Nov, "The Ladder".
  - `retype_problems(spec)`: a named real artifact is shown as itself; a device whose words copy it is refused.
  - `offday_problems(spec)`: an off-day piece beds on an off-day track and wears no series sting (Krish, 4 Nov:
    "Yes, give off days their own music and look - Rotate."); compile draws it in the house mint.
  - `opening_problems(spec)`: nothing before the hook on any cut, ever: a spec naming a sting (brand.intro_sting) or
    an episode card where the sting was (brand.opening_exception) is refused (Ruling, Krish, 12 Nov: "Nothing before the
    hook, ever. Remove the sting exception for good.").
  - `freeze(directory)` / `engine_problems(...)`: the engine the storyboard was signed on draws its proof and cut.
  - `record_render(...)` / `loop_problems(...)`: two full renders of a cut per press from Krish, then he sees it.
  - `type_treatments(props)` / `type_note(...)`: the type treatments a cut shows, listed on its proof for Krish to
    judge moving (advisory since his answer of 4 Nov; `type_problems` refuses only if config sets a limit mode).
"""
from __future__ import annotations

import hashlib
import json
import re
from datetime import date, datetime, timezone
from pathlib import Path

from .common import CONFIG, ROOT, load_json, write_json

WORD = re.compile(r"[a-z0-9']+")
DEVICES = ROOT / 'apps' / 'renderer' / 'src' / 'engine' / 'devices'
ROLE = re.compile(r'HOUSE_FONTS\.([a-z]+)')


def config() -> dict:
    return load_json(CONFIG / 'production-guards.json')


def motion_from() -> str:
    from .proof import motion_from as mf  # noqa: PLC0415
    return mf()


def bound(spec: dict) -> bool:
    """A piece published from MOTION_FROM with at least one whole cut (a proof excerpt alone is never held)."""
    whole = any(not c.get('excerpt', False) for c in (spec.get('cuts') or {}).values())
    return whole and str(spec.get('publish_day') or '') >= motion_from()


def _exception(spec: dict, sha: str, directory: Path | None = None) -> dict | None:
    """Krish's exception approval bound to this exact hash, or None. Beside the spec's approvals, an engine approval
    may sit in the piece's ve folder (ENGINE_EXCEPTIONS), so it binds even before the spec is written (Krish,
    2026-11-10: "approve the engine change for Wednesday")."""
    extra = []
    if directory is not None and (Path(directory) / ENGINE_EXCEPTIONS).is_file():
        extra = load_json(Path(directory) / ENGINE_EXCEPTIONS).get('approvals') or []
    for a in [*(spec.get('approvals') or []), *extra]:
        if isinstance(a, dict) and a.get('gate') == 'exception' and a.get('by') == 'Krish' and a.get('artifact_hash') == sha:
            return a
    return None


ENGINE_EXCEPTIONS = 'engine-exceptions.json'


def engine_only(approval: dict) -> bool:
    """An exception that approves an engine change and nothing else: it never waives a lint check or counts as a press
    on a cut."""
    return isinstance(approval, dict) and approval.get('scope') == 'engine'


def canonical_sha(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')).hexdigest()


# ---------------------------------------------------------------- 1. no idea, no production


def idea_problems(spec: dict) -> list[str]:
    if not bound(spec):
        return []
    rules = config()['idea']
    idea = (spec.get('style') or {}).get('idea')
    model = 'docs/plans/2026-11-02-monday/motion-system.md'
    if not isinstance(idea, dict):
        return [f'idea.required style.idea: name the one visual idea before the storyboard is signed: the object, what '
                f'each move means, a never-list and the real artifact (the bar: {model}, "The Ladder")']
    out = []
    if len(str(idea.get('object') or '').strip()) < rules['object_min_chars']:
        out.append('idea.object style.idea.object: the one object or system that carries the piece, in a sentence '
                   '(Monday: "One career ladder ... every number is drawn on, beside or instead of a rung")')
    moves = idea.get('moves')
    if not isinstance(moves, list) or not moves:
        out.append('idea.moves style.idea.moves: each move the object makes and what it means ({"move", "means"})')
    else:
        for i, move in enumerate(moves):
            if not isinstance(move, dict) or not str(move.get('move') or '').strip() \
                    or len(str(move.get('means') or '').strip()) < rules['means_min_chars']:
                out.append(f'idea.moves style.idea.moves.{i}: a move names itself and what it means ("means", a sentence)')
    never = idea.get('never')
    if not isinstance(never, list) or not [n for n in never if str(n).strip()]:
        out.append('idea.never style.idea.never: what the piece never does (Monday: "No figures or icons acting out a sentence")')
    real = idea.get('real_artifacts')
    none_because = str(idea.get('real_none') or '').strip()
    if not real and len(none_because) < 12:
        out.append('idea.real style.idea.real_artifacts: name the real artifact the piece shows as itself (an asset id and '
                   'the words it holds), or say in real_none why no real artifact exists')
    assets = {a['id']: a for a in spec.get('assets') or []}
    for i, row in enumerate(real or []):
        aid = row.get('asset') if isinstance(row, dict) else None
        asset = assets.get(aid)
        if asset is None:
            out.append(f'idea.real style.idea.real_artifacts.{i}: {aid!r} is not an asset in the spec; add the real file '
                       '(his screenshot, the report page) to assets with its sha256')
        elif asset.get('kind') not in rules['real_kinds'] or asset.get('origin') == 'generated':
            out.append(f'idea.real style.idea.real_artifacts.{i}: {aid} is a {asset.get("origin")} {asset.get("kind")}; a real '
                       f'artifact is a captured or sourced {", ".join(rules["real_kinds"])}')
        elif not shown(spec, asset):
            out.append(f'idea.real style.idea.real_artifacts.{i}: {aid} is never on screen; show it as itself (a beat plate '
                       f'asset:{aid}, or a device whose src is its file)')
    return out


def shown(spec: dict, asset: dict) -> bool:
    """The asset is on screen: a beat's plate, or a device parameter naming its id or its file."""
    for cut in (spec.get('cuts') or {}).values():
        if any((b.get('plate') or {}).get('source') == f"asset:{asset['id']}" for b in cut.get('beats') or []):
            return True
    names = {asset['id'], asset.get('path'), Path(str(asset.get('path') or '')).name}
    for obj in spec.get('objects') or []:
        from .lint import _strings  # noqa: PLC0415
        if any(text in names for _, text in _strings(obj.get('params') or {})):
            return True
    return False


# ---------------------------------------------------------------- 2. show the real thing, never re-type it


def _words(text: str) -> list[str]:
    return WORD.findall(str(text).lower())


def retype_problems(spec: dict) -> list[str]:
    if not bound(spec):
        return []
    rules = config()['retype']
    real = ((spec.get('style') or {}).get('idea') or {}).get('real_artifacts') or []
    vocab = {}
    for row in real:
        if isinstance(row, dict) and row.get('text'):
            vocab[row.get('asset')] = set(_words(row['text']))
    if not vocab:
        return []
    from .lint import public_strings  # noqa: PLC0415
    out = []
    for path, text in public_strings(spec):
        if not path.startswith('objects.'):
            continue
        words = _words(text)
        if len(words) < rules['min_words']:
            continue
        for aid, known in vocab.items():
            share = sum(w in known for w in words) / len(words)
            if share >= rules['overlap']:
                index = int(path.split('.')[1])
                obj = spec['objects'][index]
                out.append(f'real.retyped {path}: {obj["obj"]} ({obj["device"]}) re-types {round(share * 100)}% of {aid}\'s '
                           f'words ("{text[:60]}"); show {aid} itself, never a typed copy of it')
                break
    return out


# ---------------------------------------------------------------- 8. off days look neutral and sound different


def series_day(spec: dict) -> str | None:
    theme = next((t for t in load_json(ROOT / 'config' / 'studio.json')['brand_themes'] if t['theme_id'] == spec.get('theme')), None)
    if theme is None:
        return None
    channel = (theme['publication']['house_style']['channels'].get(str(spec['brand']['series']).replace('.', '_')) or {})
    return channel.get('day')


def off_day(spec: dict) -> bool:
    day, series = spec.get('publish_day'), series_day(spec)
    if not day or not series:
        return False
    return date.fromisoformat(day).strftime('%A').lower() != series.lower().rstrip('s')


def offday_problems(spec: dict, rules: dict | None = None) -> list[str]:
    rules = rules or config()['off_day']
    if rules.get('status') != 'approved' or not bound(spec) or not off_day(spec):
        return []
    out = []
    bed = spec['audio']['bed']['ledger_id']
    offday_beds = off_day_beds(rules)
    if bed not in offday_beds:
        out.append(f'offday.bed audio.bed.ledger_id: {bed} is not an off-day track; an off-day piece beds on one of '
                   f'{", ".join(offday_beds) or "the off-day tracks"} (config/music-library.json "for": "off-day"), in rotation')
    if sting_named(spec):
        out.append('offday.chrome brand.intro_sting: an off-day piece wears no series sting')
    return out


STINGS = ('follow_the_money', 'mind_the_gap', 'under_the_hood')  # the series' intro stings (config/intro-sting.json)


def sting_named(spec: dict) -> str | None:
    """The series sting brand.intro_sting names, or None: unset, or the sentence a piece with no sting carries
    (creative_direction.NO_STING), is no sting."""
    value = (spec.get('brand') or {}).get('intro_sting')
    return value if value in STINGS else None


def opening_problems(spec: dict) -> list[str]:
    """Anything a spec puts before the hook, refused on every cut and every date (Ruling, Krish, 2026-11-12: "Nothing
    before the hook, ever. Remove the sting exception for good."): a series sting named in brand.intro_sting (only
    creative_direction.NO_STING may stand there), or an episode card in brand.opening_exception (the 9 Nov exception
    that put one where the sting was). ve compile lays neither; this says so before anything is drawn."""
    brand = spec.get('brand') or {}
    out = []
    sting = sting_named(spec)
    if sting:
        out.append(f'opening.nothing_before_hook brand.intro_sting: {sting} would open a cut before its hook, and nothing goes '
                   'before the hook (Ruling, Krish, 2026-11-12: "Nothing before the hook, ever. Remove the sting exception for '
                   'good."): say none')
    if brand.get('opening_exception'):
        out.append('opening.nothing_before_hook brand.opening_exception: an episode card before the hook, and nothing goes '
                   'before the hook (Ruling, Krish, 2026-11-12: "Nothing before the hook, ever. Remove the sting exception for '
                   'good."): remove it')
    return out


def off_day_beds(rules: dict | None = None) -> list[str]:
    """The tracks the music ledger marks for off days, in ledger order (the rotation)."""
    want = (rules or config()['off_day']).get('off_day_for', 'off-day')
    tracks = load_json(ROOT / 'config' / 'music-library.json').get('tracks') or []
    return [t['id'] for t in tracks if t.get('for') == want]


def annotation_lints(spec: dict) -> list[str]:
    """A mark names the words it marks and is not drawn in frame pixels over a surface a camera moves (the 6 Nov reel's
    AT STAKE underline; velib/qc_onscreen.py, config/ve/onscreen-checks.json). Binds pieces from its binds_from, so a
    piece already in production is not refused mid-piece (F33)."""
    from . import qc_onscreen  # noqa: PLC0415
    if not qc_onscreen.bound(spec.get('publish_day')):
        return []
    beats = [b for cut in (spec.get('cuts') or {}).values() for b in cut.get('beats') or []]
    return [f"annotation.target {p['obj']}{' (beat ' + p['beat'] + ')' if p.get('beat') else ''}: {p['why']}"
            for p in qc_onscreen.annotation_problems(spec.get('objects') or [], beats)]


def spec_lints(spec: dict) -> list[str]:
    """The spec-level guards, for ve lint."""
    from .sfx import style_problems  # noqa: PLC0415
    return (idea_problems(spec) + retype_problems(spec) + offday_problems(spec) + opening_problems(spec)
            + annotation_lints(spec) + style_problems(spec))


# ---------------------------------------------------------------- 3. freeze the engine during a piece


def engine_files() -> dict[str, str]:
    rules = config()['engine']
    files = {}
    for rel in rules['paths']:
        base = ROOT / rel
        paths = [base] if base.is_file() else sorted(p for p in base.rglob('*') if p.is_file())
        for path in paths:
            name = path.relative_to(ROOT).as_posix()
            if any(name.endswith(s) for s in rules['skip_suffixes']):
                continue
            files[name] = hashlib.sha256(path.read_bytes()).hexdigest()
    return files


def engine_sha(files: dict[str, str] | None = None) -> str:
    return canonical_sha(files if files is not None else engine_files())


def lock_path(directory: Path) -> Path:
    return Path(directory) / 'engine.json'


def freeze(directory: Path, now: str | None = None) -> dict:
    """Record the engine as it is when the storyboard sheet is written (ve expect): what his Sign storyboard sees."""
    files = engine_files()
    record = {'schema': 've-engine/1', 'sha256': engine_sha(files), 'at': now or _now(), 'files': files}
    write_json(lock_path(directory), record)
    return record


def engine_problems(spec: dict, cut: str, directory: Path) -> list[str]:
    from .proof import required  # noqa: PLC0415
    if cut not in (spec.get('cuts') or {}) or not required(spec, cut):
        return []
    path = lock_path(directory)
    if not path.is_file():
        return [f'no engine record for this piece: run ve expect <spec> when the storyboard goes to Krish; it records the '
                f'engine his signature stands for ({path.name})']
    lock = load_json(path)
    files = engine_files()
    now = engine_sha(files)
    if now == lock.get('sha256') or _exception(spec, now, directory):
        return []
    old = lock.get('files') or {}
    changed = sorted(n for n in set(old) | set(files) if old.get(n) != files.get(n))
    shown_files = ', '.join(changed[:5]) + (f' and {len(changed) - 5} more' if len(changed) > 5 else '')
    return [f'the engine changed since the storyboard was signed ({shown_files}): render on the engine he signed for, or '
            f'Krish approves the change (an exception approval bound to engine sha256 {now})']


# ---------------------------------------------------------------- 4. two loops, then Krish


def renders_path(directory: Path, cut: str) -> Path:
    return Path(directory) / f'renders.{cut}.json'


def _now() -> str:
    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def _when(value) -> datetime | None:
    text = str(value or '').strip()
    if not text:
        return None
    try:
        if len(text) == 10:
            return datetime.fromisoformat(text).replace(tzinfo=timezone.utc)
        parsed = datetime.fromisoformat(text.replace('Z', '+00:00'))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def record_render(directory: Path, cut: str, out: Path, sha256: str | None, now: str | None = None) -> list[dict]:
    path = renders_path(directory, cut)
    rows = load_json(path).get('renders', []) if path.is_file() else []
    rows.append({'at': now or _now(), 'file': Path(out).name, 'sha256': sha256})
    write_json(path, {'schema': 've-renders/1', 'cut': cut, 'renders': rows})
    return rows


def last_press(spec: dict, gates: dict) -> datetime | None:
    """The latest press of any gate by Krish, on the record or in the spec's approvals."""
    times = [_when(row.get('at')) for rows in (gates or {}).values() for row in (rows if isinstance(rows, list) else [rows])
             if isinstance(row, dict) and row.get('by') == 'Krish']
    times += [_when(a.get('on')) for a in spec.get('approvals') or [] if isinstance(a, dict) and a.get('by') == 'Krish'
              and not engine_only(a)]
    times = [t for t in times if t is not None]
    return max(times) if times else None


def loop_problems(spec: dict, cut: str, directory: Path, gates: dict) -> list[str]:
    from .proof import required  # noqa: PLC0415
    if cut not in (spec.get('cuts') or {}) or not required(spec, cut):
        return []
    path = renders_path(directory, cut)
    if not path.is_file():
        return []
    allowed = config()['loops']['full_renders_per_press']
    since = last_press(spec, gates)
    rows = [r for r in load_json(path).get('renders', []) if since is None or (_when(r.get('at')) or since) > since]
    if len(rows) < allowed:
        return []
    when = since.strftime('%Y-%m-%d %H:%M UTC') if since else 'none yet'
    return [f'{len(rows)} full renders of {cut} since Krish last pressed anything ({when}); the runbook allows {allowed} fix '
            f'loops: bring him the last cut or one question, and render again after his next press']


# ---------------------------------------------------------------- 7. one type system


def device_roles(device: str) -> list[str]:
    """The house type roles a renderer device draws, read from its source (never edited here)."""
    folder = DEVICES / device
    if not folder.is_dir():
        return []
    found = set()
    for path in folder.rglob('*.tsx'):
        if '.test.' not in path.name:
            found.update(ROLE.findall(path.read_text(encoding='utf-8', errors='replace')))
    return sorted(found)


def type_treatments(props: dict) -> list[list[str]]:
    """[role, surface] pairs a compiled cut puts on screen: the caption (white over the picture, ink on the light
    graphics stage), its loud word, the held title and each device's roles on a card. Mirrors the renderer's
    WordCaption, HeldTitle and lightStage (face-with-proof) without importing them."""
    out = set()
    beats = props.get('beats') or []
    if props.get('captions'):
        if props.get('captionStyle') == 'word':
            if any(not (b.get('layout') == 'STAGE' and (b.get('plate') or {}).get('source') == 'none' and
                        props.get('format') == 'face-with-proof') for b in beats) or not beats:
                out.add(('structure', 'caption'))
            if props.get('format') == 'face-with-proof' and any(
                    b.get('layout') == 'STAGE' and (b.get('plate') or {}).get('source') == 'none' for b in beats):
                out.add(('structure', 'caption on the light stage'))
            if any(page.get('swipeIndex') == 0 for page in props['captions']):
                out.add(('dek', 'loud caption word'))
            if props.get('title'):
                out.add(('structure', 'held title'))
        else:
            out.add(('structure', 'caption'))
    alive = {o['obj']: o['device'] for o in props.get('objects') or []}
    used = {name for b in beats for name in b.get('uses') or []}
    for name, device in alive.items():
        if used and name not in used:
            continue
        for role in device_roles(device):
            out.add((role, 'card'))
    return sorted([list(row) for row in out])


def type_problems(spec: dict, props: dict) -> list[str]:
    from .proof import required  # noqa: PLC0415
    cut = props.get('cutId')
    if cut not in (spec.get('cuts') or {}) or not required(spec, cut):
        return []
    rules = config()['type']
    if rules.get('mode') == 'advisory':
        return []  # Krish, 2026-11-04: judged moving on the proof, never refused by count (type_note)
    limit = rules['max_treatments']
    found = type_treatments(props)
    if len(found) <= limit or _exception(spec, canonical_sha(found)):
        return []
    listed = '; '.join(f'{role} as {surface}' for role, surface in found)
    return [f'{len(found)} type treatments in {cut} ({listed}); the brand book has {limit} roles: drop a device or a caption '
            f'treatment, or Krish approves this set (an exception approval bound to sha256 {canonical_sha(found)})']


def type_note(props: dict) -> str:
    """One line for the proof: every type treatment the cut shows, so Krish judges them moving on his take."""
    found = type_treatments(props)
    listed = '; '.join(f'{role} as {surface}' for role, surface in found) or 'none'
    return f'{len(found)} type treatment(s): {listed}'
