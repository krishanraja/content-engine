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
  - `close_problems(spec)`: every video dated from 26 Nov ends on the plain v5 outro card, so a spec naming an intro
    sting clip anywhere, or made in another theme, is refused (Ruling, Krish, 26 Nov: "1 agreed").
  - `marks_problems(spec)`: one wordmark per video, S3h on its v5 outro, so from 27 Nov a spec naming V4, V10, V6 or an
    -ink drawing anywhere, or asking for a body logo, a series pill or a wordmark on the title, is refused (Ruling, Krish, 27 Nov: "agree").
  - `freeze(directory)` / `engine_route(...)` / `engine_problems(...)`: the engine and the rules freeze at Sign storyboard
    (ve expect). Proof and render run on the commit pinned there by themselves; a fix on main reaches the piece only under
    Krish's standing engine-follows-main yes or when the house golden test passes on it, and nothing asks him to approve
    an engine hash (Ruling, Krish, 2026-11-19). A rule binds a piece only from a binds_from on or before its freeze day.
  - `record_render(...)` / `loop_problems(...)`: two full renders of a cut per press from Krish, then he sees it.
  - `type_treatments(props)` / `type_note(...)`: the type treatments a cut shows, listed on its proof for Krish to
    judge moving (advisory since his answer of 4 Nov; `type_problems` refuses only if config sets a limit mode).
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
from datetime import date, datetime, timezone
from pathlib import Path

from .common import CONFIG, ROOT, load_json, write_json

WORD = re.compile(r"[a-z0-9']+")
DEVICES = ROOT / 'apps' / 'renderer' / 'src' / 'engine' / 'devices'
ROLE = re.compile(r'HOUSE_FONTS\.([a-z]+)')


def config() -> dict:
    return load_json(CONFIG / 'production-guards.json')


_BIND_DAY: list[str | None] = [None]


def set_bind_day(day: str | None) -> None:
    """Kept for lint's call (showgate.effective_day, which is now always None): None means the piece's own publish_day."""
    _BIND_DAY[0] = day


def bind_day(spec: dict) -> str:
    """The day a rule's binds_from is compared with: the piece's publish_day, as always. Rules freeze at Sign storyboard by
    the pin, not by a date: a piece whose rule files moved on main since ve expect proofs and renders on its pinned commit,
    whose rules are the ones it froze with, and among those a rule binds by its binds_from as it always did (Ruling, Krish,
    2026-11-19). bind_unshown, which held a cut not yet shown to Krish to every rule existing on the day it was shown, is
    gone."""
    own = str(spec.get('publish_day') or '')
    return max(own, _BIND_DAY[0]) if _BIND_DAY[0] else own


def motion_from() -> str:
    from .proof import motion_from as mf  # noqa: PLC0415
    return mf()


def bound(spec: dict) -> bool:
    """A piece published from MOTION_FROM with at least one whole cut (a proof excerpt alone is never held)."""
    whole = any(not c.get('excerpt', False) for c in (spec.get('cuts') or {}).values())
    return whole and str(spec.get('publish_day') or '') >= motion_from()


def _approvals(spec: dict, directory: Path | None = None) -> list:
    """The spec's approvals and, beside them, those in the piece's ve folder (ENGINE_EXCEPTIONS), which bind even before
    the spec is written (Krish, 2026-11-10: "approve the engine change for Wednesday")."""
    extra = []
    if directory is not None and (Path(directory) / ENGINE_EXCEPTIONS).is_file():
        extra = load_json(Path(directory) / ENGINE_EXCEPTIONS).get('approvals') or []
    return [*(spec.get('approvals') or []), *extra]


def _exception(spec: dict, sha: str, directory: Path | None = None) -> dict | None:
    """Krish's exception approval bound to this exact hash, or None. An engine approval already given is honoured; nothing
    asks for a new one (Ruling, Krish, 2026-11-19)."""
    for a in _approvals(spec, directory):
        if isinstance(a, dict) and a.get('gate') == 'exception' and a.get('by') == 'Krish' and a.get('artifact_hash') == sha:
            return a
    return None


ENGINE_EXCEPTIONS = 'engine-exceptions.json'
FOLLOWS_MAIN = 'engine-follows-main'


def follows_main(spec: dict, directory: Path | None = None) -> dict | None:
    """Krish's standing yes for this piece to take the engine on main as it moves (scope engine-follows-main, in the
    spec's approvals or the piece's engine-exceptions.json), bound to no hash; or None."""
    for a in _approvals(spec, directory):
        if isinstance(a, dict) and a.get('gate') == 'exception' and a.get('by') == 'Krish' and a.get('scope') == FOLLOWS_MAIN:
            return a
    return None


def engine_only(approval: dict) -> bool:
    """An exception that approves an engine change and nothing else: it never waives a lint check or counts as a press
    on a cut."""
    return isinstance(approval, dict) and approval.get('scope') in ('engine', FOLLOWS_MAIN)


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


def close_problems(spec: dict) -> list[str]:
    """The close of a piece dated from 26 Nov, refused before anything is drawn (Ruling, Krish, 2026-11-26: "1 agreed"):
    every video, wide or tall, ends on the plain v5 outro card (config/brand-palette.json series_close), so the spec
    carries none of the intro sting clips anywhere (a path, file name or sha256 of config/intro-sting.json clips, or a
    path in their library folder), and a piece with a whole cut is made in the locked v5 look that draws that card. A
    series cut dated 23 to 25 Nov keeps the retired sting close it was signed with (F33); ve compile lays it."""
    from . import compile as ve_compile  # noqa: PLC0415
    rule = ve_compile.V5_CLOSE
    if str(spec.get('publish_day') or '')[:10] < rule['from']:
        return []
    out = []
    hits = ve_compile.carried_stings(spec, ve_compile._sting_marks(ve_compile._intro()), 'spec')
    if hits:
        out.append(f'close.v5_outro {hits[0]}: names an intro sting clip ({len(hits)} place{"s" if len(hits) > 1 else ""}), and '
                   f'the sting closes no cut: every video ends on the plain v5 outro card ({ve_compile.V5_CLOSE_RULING}); '
                   'remove it')
    whole = any(not c.get('excerpt', False) for c in (spec.get('cuts') or {}).values())
    if whole and spec.get('theme') != rule['theme']:
        out.append(f'close.v5_outro theme: {spec.get("theme")} does not draw the plain v5 outro card; every video ends on it '
                   f'({ve_compile.V5_CLOSE_RULING}), so the theme is {rule["theme"]}')
    return out


def marks_problems(spec: dict) -> list[str]:
    """The marks of a piece dated from 27 Nov, refused before anything is drawn (Ruling, Krish, 2026-11-27: "agree";
    config/brand-palette.json marks_rule): S3h on the v5 outro is the one wordmark per video, so the spec names V4
    nowhere (its file or sha256, either drawing) nor a retired mark (V10, V6 or any -ink drawing; Ruling, Krish,
    2026-11-25: wordmark on ink only; V10 retired), and asks for no body logo (brand.body_logo), no series pill
    (brand.series_pill) and no wordmark on the title (brand.title_wordmark, title_moment.wordmark). A cut dated before
    keeps the body it was signed with (F33)."""
    from . import compile as ve_compile  # noqa: PLC0415
    rule = ve_compile.MARKS_RULE
    if str(spec.get('publish_day') or '')[:10] < rule['from']:
        return []
    out = []
    hits = ve_compile.carried_v4(spec, 'spec')
    if hits:
        out.append(f'marks.one_wordmark {hits[0]}: names V4 ({len(hits)} place{"s" if len(hits) > 1 else ""}), and no body beat '
                   f'or title card carries it: S3h on the v5 outro is the one wordmark ({ve_compile.MARKS_RULING}); remove it')
    retired = ve_compile.carried_retired(spec, 'spec')
    if retired:
        out.append(f'marks.one_wordmark {retired[0]}: names a retired mark, V10, V6 or an -ink drawing ({len(retired)} '
                   f'place{"s" if len(retired) > 1 else ""}): S3h on the v5 outro is the one wordmark, on ink (Ruling, Krish, '
                   f'2026-11-25: wordmark on ink only; V10 retired; {ve_compile.MARKS_RULING}); remove it')
    brand = spec.get('brand') or {}
    asks = [(f'brand.{key}', what) for key, what in (('body_logo', 'a logo in the body'), ('series_pill', 'a series pill'),
                                                       ('title_wordmark', 'a wordmark on the title')) if brand.get(key)]
    if (spec.get('title_moment') or {}).get('wordmark'):
        asks.append(('title_moment.wordmark', 'a wordmark on the title'))
    out += [f'marks.one_wordmark {where}: asks for {what}, and from {rule["from"]} the cut carries none: S3h on the v5 outro is '
            f'the one wordmark and the sub brands do not feature ({ve_compile.MARKS_RULING}); remove it' for where, what in asks]
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
    if not qc_onscreen.bound(bind_day(spec)):
        return []
    beats = [b for cut in (spec.get('cuts') or {}).values() for b in cut.get('beats') or []]
    return [f"annotation.target {p['obj']}{' (beat ' + p['beat'] + ')' if p.get('beat') else ''}: {p['why']}"
            for p in qc_onscreen.annotation_problems(spec.get('objects') or [], beats)]


def one_object_problems(spec: dict) -> list[str]:
    """`idea.one_object` (Krish, 2026-11-18, the Tue 17 habits short): the idea's content, not only that it exists. Binds a whole
    cut of a piece published from config one_object.from, so no past piece is judged by it."""
    rules = config()['one_object']
    whole = any(not c.get('excerpt', False) for c in (spec.get('cuts') or {}).values())
    if not whole or bind_day(spec) < rules['from']:
        return []
    from . import ideaguard  # noqa: PLC0415
    return ideaguard.one_object_problems(spec, rules)


def pre_critic_bound(spec: dict) -> bool:
    whole = any(not c.get('excerpt', False) for c in (spec.get('cuts') or {}).values())
    return whole and bind_day(spec) >= config()['pre_critic']['from']


def pre_critic_lints(spec: dict, spec_path) -> list[str]:
    """`critic.pre`: the Critic's two questions were asked of this spec before anything was made, and the answer stands."""
    if not pre_critic_bound(spec):
        return []
    from . import precritic  # noqa: PLC0415
    ok, why = precritic.state(spec, spec_path)
    return [] if ok else [f'critic.pre {why}']


def spec_lints(spec: dict) -> list[str]:
    """The spec-level guards, for ve lint."""
    from .sfx import style_problems  # noqa: PLC0415
    from . import qc_frames  # noqa: PLC0415
    return (qc_frames.lints(spec) + idea_problems(spec) + one_object_problems(spec) + retype_problems(spec) + offday_problems(spec) + opening_problems(spec)
            + close_problems(spec) + marks_problems(spec) + annotation_lints(spec) + style_problems(spec))


# ---------------------------------------------------------------- 3. freeze the engine during a piece


def _hash_files(paths: list[str], skip: list[str], root: Path) -> dict[str, str]:
    """name -> sha256 of every file under the given paths (a file, a folder, or a glob such as config/ve/*.json)."""
    files = {}
    for rel in paths:
        if any(c in rel for c in '*?['):
            found = sorted(p for p in root.glob(rel) if p.is_file())
        else:
            base = root / rel
            found = [base] if base.is_file() else sorted(p for p in base.rglob('*') if p.is_file())
        for path in found:
            name = path.relative_to(root).as_posix()
            if any(name.endswith(s) for s in skip):
                continue
            files[name] = hashlib.sha256(path.read_bytes()).hexdigest()
    return files


def engine_files(root: Path | None = None) -> dict[str, str]:
    rules = config()['engine']
    return _hash_files(rules['paths'], rules['skip_suffixes'], Path(root) if root is not None else ROOT)


def rules_files(root: Path | None = None) -> dict[str, str]:
    """The rules a piece is held to (production-guards.json rules.paths: lint, the piece guards, config/ve/*.json and the
    brand palette), hashed at Sign storyboard beside the engine."""
    rules = config()['rules']
    return _hash_files(rules['paths'], rules.get('skip_suffixes') or [], Path(root) if root is not None else ROOT)


def engine_sha(files: dict[str, str] | None = None) -> str:
    return canonical_sha(files if files is not None else engine_files())


def lock_path(directory: Path) -> Path:
    return Path(directory) / 'engine.json'


def head_commit() -> str | None:
    """The commit the engine files were read at, or None outside a git checkout."""
    try:
        out = subprocess.run(['git', '-C', str(ROOT), 'rev-parse', 'HEAD'], capture_output=True, text=True, timeout=10)
        return out.stdout.strip() or None if out.returncode == 0 else None
    except (OSError, subprocess.SubprocessError):
        return None


def freeze(directory: Path, now: str | None = None) -> dict:
    """Record the engine and the rules as they are when the storyboard sheet is written (ve expect): what his Sign storyboard
    sees. Both freeze there (Ruling, Krish, 2026-11-19: rules and the engine freeze at Sign storyboard; a new rule or fix
    binds from the next piece)."""
    files, rules = engine_files(), rules_files()
    record = {'schema': 've-engine/1', 'sha256': engine_sha(files), 'at': now or _now(), 'files': files, 'commit': head_commit(),
              'rules': {'sha256': canonical_sha(rules), 'files': rules}}
    write_json(lock_path(directory), record)
    return record


def _changed(old: dict, new: dict) -> list[str]:
    return sorted(n for n in set(old) | set(new) if old.get(n) != new.get(n))


def rules_changed(directory: Path, root: Path | None = None) -> list[str]:
    """The rule files that differ from the ones frozen at Sign storyboard (they bind the next piece, never this one). A piece
    frozen before the rules were recorded (no rules in engine.json) has nothing to compare with and is never moved by them."""
    if not lock_path(directory).is_file():
        return []
    frozen = (load_json(lock_path(directory)).get('rules') or {}).get('files')
    if not frozen:
        return []
    return _changed(frozen, rules_files(root))


# The house golden test (apps/renderer/src/engine/houseGolden.test.ts) proves a renderer change draws every house frame
# exactly as before. It covers the renderer's source only, so only a change confined to it may follow main by it.
GOLDEN_TEST = 'apps/renderer/src/engine/houseGolden.test.ts'
GOLDEN_COVERS = ('apps/renderer/src/',)
# The test's own expected frames. A change that rewrites them passes the test by construction and proves nothing, so a
# change touching any of them never follows main by the golden test (it stays on its pin).
GOLDEN_EXPECTED = ('apps/renderer/src/engine/houseGolden.json', GOLDEN_TEST)


def golden_can_prove(changed: list[str]) -> bool:
    """Can the house golden test prove these engine changes draw every house frame as before? Only when every changed file
    is the renderer's source and neither the test nor its expected frames moved (nor any other golden or snapshot file)."""
    def expected(name: str) -> bool:
        low = name.lower()
        return name in GOLDEN_EXPECTED or 'golden' in low.rsplit('/', 1)[-1] or low.endswith('.snap') or '/__snapshots__/' in low
    return bool(changed) and all(n.startswith(GOLDEN_COVERS) and not expected(n) for n in changed)


def golden_cache(sha: str) -> Path:
    return ROOT / '.cache' / 've' / 'golden' / f'{sha}.json'


def golden_passes(sha: str) -> bool:
    """Does the house golden test pass on the engine in this checkout (sha)? Run once per engine and remembered in
    .cache/ve/golden; False when it cannot run (VE_GOLDEN=off, no node), so the piece stays on its pin."""
    if os.environ.get('VE_GOLDEN') == 'off':
        return False
    cache = golden_cache(sha)
    if cache.is_file():
        return bool(load_json(cache).get('pass'))
    try:
        out = subprocess.run(['npx', 'vitest', 'run', GOLDEN_TEST], cwd=ROOT, capture_output=True, text=True, timeout=900)
    except (OSError, subprocess.SubprocessError):
        return False
    ok = out.returncode == 0
    cache.parent.mkdir(parents=True, exist_ok=True)
    write_json(cache, {'sha256': sha, 'pass': ok, 'at': _now()})
    return ok


def _frozen_rules_sha(lock: dict) -> str | None:
    """The rules' hash ve expect recorded (None for a piece frozen before the rules were recorded)."""
    return (lock.get('rules') or {}).get('sha256') or None


def engine_route(spec: dict, directory: Path, golden=None) -> dict:
    """Where this piece's proof runs, decided by rule and never asked of Krish (Ruling, Krish, 2026-11-19): `here` when the
    engine and the rules are the ones frozen at ve expect, or when he gave the piece a standing engine-follows-main yes, or
    when the rules are unchanged and every changed engine file is the renderer's source, its golden frames untouched, and
    the house golden test passes on it; otherwise `pin`, the commit recorded at ve expect, which holds both."""
    path = lock_path(directory)
    if not path.is_file():
        return {'route': 'here', 'why': 'no engine record'}
    lock = load_json(path)
    files = engine_files()
    now = engine_sha(files)
    changed = _changed(lock.get('files') or {}, files) if now != lock.get('sha256') else []
    rules = rules_changed(directory)
    if not changed and not rules:
        return {'route': 'here', 'why': 'the engine and the rules are the ones frozen at Sign storyboard'}
    if follows_main(spec, directory) or (not rules and _exception(spec, now, directory)):
        return {'route': 'here', 'why': "Krish's standing yes for this piece to follow main", 'changed': changed + rules}
    if not rules and golden_can_prove(changed) and (golden or golden_passes)(now):
        return {'route': 'here', 'why': 'the house golden test passes on the engine on main', 'changed': changed}
    return {'route': 'pin', 'commit': lock.get('commit'), 'sha256': lock.get('sha256'), 'rules_sha256': _frozen_rules_sha(lock),
            'changed': changed + rules}


def _shown_files(changed: list[str]) -> str:
    return ', '.join(changed[:5]) + (f' and {len(changed) - 5} more' if len(changed) > 5 else '')


def pin_line(route: dict) -> str:
    """One line for a run that is not on the pinned engine: where it runs instead. Never a request for an approval."""
    changed = f" ({_shown_files(route['changed'])})" if route.get('changed') else ''
    since = route.get('since', 'the storyboard was signed')
    where = route.get('where', 'the commit pinned at ve expect')
    if not route.get('commit'):
        return (f'the engine changed since {since}{changed} and no commit was recorded to pin it to: run ve expect again '
                'from a git checkout of the engine the storyboard was signed on')
    return (f'the engine changed since {since}{changed}: this piece runs on {where} ({route["commit"][:12]}), and ve proof '
            'and ve render go there by themselves (run them through ve)')


def engine_problems(spec: dict, cut: str, directory: Path, golden=None) -> list[str]:
    """Why this cut cannot run on the engine in this checkout. Never a request for Krish to approve a hash: a piece whose
    engine moved runs on its pinned commit, which ve proof and ve render do by themselves."""
    from .proof import required  # noqa: PLC0415
    if cut not in (spec.get('cuts') or {}) or not required(spec, cut):
        return []
    path = lock_path(directory)
    if not path.is_file():
        return [f'no engine record for this piece: run ve expect <spec> when the storyboard goes to Krish; it records the '
                f'engine his signature stands for ({path.name})']
    route = engine_route(spec, directory, golden)
    return [] if route['route'] == 'here' else [pin_line(route)]


def render_route(spec: dict, cut: str, directory: Path, golden=None) -> dict:
    """Where a whole cut renders: on the engine its approved proof was drawn on (the proof record's engine_sha256 and
    engine_commit), so what he approved is what renders; a proof that recorded no engine renders by engine_route."""
    from .proof import record_path  # noqa: PLC0415
    path = record_path(directory, cut)
    want = (load_json(path) if path.is_file() else {}).get('engine_sha256')
    if not want:
        return engine_route(spec, directory, golden)
    record = load_json(path)
    files = engine_files()
    rules = rules_changed(directory)
    if engine_sha(files) == want and not rules:
        return {'route': 'here', 'why': 'the engine the approved proof was drawn on, and the rules frozen at Sign storyboard'}
    lock = load_json(lock_path(directory)) if lock_path(directory).is_file() else {}
    commit = record.get('engine_commit') or (lock.get('commit') if lock.get('sha256') == want else None)
    changed = _changed(lock.get('files') or {}, files) if lock.get('sha256') == want else []
    return {'route': 'pin', 'commit': commit, 'sha256': want, 'rules_sha256': _frozen_rules_sha(lock), 'changed': changed + rules,
            'since': 'his approved proof was drawn', 'where': 'the engine its approved proof was drawn on'}


def render_engine_problems(spec: dict, cut: str, directory: Path, golden=None) -> list[str]:
    """A whole cut renders only on the engine of the proof he approved (ve proof stamps engine_sha256 on it)."""
    from .proof import record_path, required  # noqa: PLC0415
    if cut not in (spec.get('cuts') or {}) or not required(spec, cut):
        return []
    path = record_path(directory, cut)
    if not (load_json(path) if path.is_file() else {}).get('engine_sha256'):
        return engine_problems(spec, cut, directory, golden)
    route = render_route(spec, cut, directory, golden)
    return [] if route['route'] == 'here' else [pin_line(route)]


PINS = ROOT / '.cache' / 've-pins'


def pin_checkout(commit: str, sha: str, rules_sha: str | None = None) -> Path:
    """A git worktree of the engine at the pinned commit (made once, under .cache/ve-pins), with this checkout's node_modules
    linked in, and checked to hold exactly the frozen engine (sha) and, when given, the frozen rules (rules_sha). Raises
    ValueError when it cannot."""
    path = PINS / commit[:12]
    if not (path / '.git').exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        out = subprocess.run(['git', '-C', str(ROOT), 'worktree', 'add', '--detach', str(path), commit],
                             capture_output=True, text=True, timeout=300)
        if out.returncode != 0:
            raise ValueError(f'the pinned commit {commit[:12]} could not be checked out: {(out.stderr or out.stdout).strip()[:200]}')
    for here in [ROOT, *ROOT.glob('*'), *ROOT.glob('*/*')]:
        modules = here / 'node_modules'
        if modules.is_dir() and '.cache' not in here.relative_to(ROOT).parts:
            target = path / modules.relative_to(ROOT)
            if target.parent.is_dir() and not target.exists():
                target.symlink_to(modules, target_is_directory=True)
    got = engine_sha(engine_files(path))
    if got != sha:
        raise ValueError(f'the pinned commit {commit[:12]} holds engine {got[:12]}, not the frozen {sha[:12]} (it was not '
                         'committed when ve expect ran): run ve expect again from a clean checkout')
    if rules_sha:
        got = canonical_sha(rules_files(path))
        if got != rules_sha:
            raise ValueError(f'the pinned commit {commit[:12]} holds rules {got[:12]}, not the frozen {rules_sha[:12]} (they were '
                             'not committed when ve expect ran): run ve expect again from a clean checkout')
    return path


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
    # An approval's `at` is the moment he pressed. An older record carries only its date (`on`) and is still read as that
    # day's midnight, as before; a press recorded with its time counts against renders made earlier the same day.
    times += [_when(a.get('at') or a.get('on')) for a in spec.get('approvals') or [] if isinstance(a, dict)
              and a.get('by') == 'Krish' and not engine_only(a)]
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
