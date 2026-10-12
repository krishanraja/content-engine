#!/usr/bin/env python3
"""plan_files: where a piece's own scripts and pictures are, on whichever
machine asks.

A piece's post.json (docs/plans/<plan>/post.json) names each file as it was
called in the working folder the piece was made in ("script.md",
"money.png"). That folder lives on the machine that made the piece, so any
other machine has to find the same file somewhere else: the dated drafts the
repository keeps, the pack build.py staged, or the post's folder in the
library once the pack is sent. Every tool that needs one asks here, so they
all look in the same places in the same order:

  1. beside post.json, by its post.json name;
  2. a script only: the draft the repository keeps beside the plan,
     docs/plans/<date>-draft-<file>, the date taken from the plan folder's
     name (2026-10-12-monday gives docs/plans/2026-10-12-draft-script.md and
     docs/plans/2026-10-12-draft-script-90s.md), as
     recording_match.scripts_for names it;
  3. the pack build.py stages on this machine:
     .cache/post-pack/<pack folder>/<section>/<packed name>;
  4. each folder given (kit.py --files), in the order given: a working
     folder by post.json names; the post's packed folder, one of its
     sections or the folder above it by packed names; then one file of that
     name up to three folders down, never inside another post's folder, and
     only when there is exactly one;
  5. the library on this machine, <library>/3 Posts/<pack folder>/<section>/<packed name>:
     MINDMAKE_LIBRARY_ROOT, and on Windows runtime.library_root in
     config/studio.json, as recording_match.library_roots reads them.

The pack folder and the packed names are build.py's: the folder from the
post's date, day, subchannel and subject (library.post_folder); the name from
the entry's "name", else the kind's fixed name ("video-script" keeps the
file's type), else the file's own name, made safe by the archive rule. A
script is also looked for by the pack's usual names (video-script.md,
video-script-90-seconds.md), as recording_match does.

    python plan_files.py POST_JSON [--files DIR ...] [--json]
    python plan_files.py --self-test

It reads only. Exit 0 when every script and picture the video needs is
found, 1 when any is not (each one named with every place looked in), 2
when the post.json cannot be read.
"""
import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
import library  # noqa: E402  the library's rules: post_folder, the section names, archive.safe_text
import story_check  # noqa: E402  cut_of: what a file name says it is

STAGED = REPO / '.cache' / 'post-pack'  # build.py's default: <pack folder>/<section>/<packed name>
STUDIO_CONFIG = REPO / 'config' / 'studio.json'
SECTION = {'video-script': library.VIDEO, 'image': library.COVERS}  # build.KINDS
FIXED = {'video-script': 'video-script'}  # build.KINDS: the name the pack gives a kind, the file's type kept
USUAL = {'long': 'video-script.md', 'short': 'video-script-90-seconds.md'}  # recording_match.PACK_NAMES
CUTS = ('long', 'short')
DATED_PLAN = re.compile(r'^(\d{4}-\d{2}-\d{2})-')
POST_FOLDER = re.compile(r'^\d{4}-\d{2}-\d{2} ')  # 2026-10-12 Mon follow.the.money - Who gets paid
SEARCH_DEPTH = 3

BESIDE, DRAFT, STAGED_PACK, GIVEN, LIBRARY = ('beside post.json', 'the draft beside the plan', 'the pack staged on this machine',
                                              'a folder given with --files', 'the library on this machine')


class PlanFilesError(ValueError):
    """A reason to stop, in words a person can act on."""


# ---------------------------------------------------------------- names

def load_post(path):
    try:
        post = json.loads(Path(path).read_text(encoding='utf-8-sig'))
    except (OSError, ValueError) as e:
        raise PlanFilesError(f'cannot read {path}: {e}') from None
    if not isinstance(post, dict) or not isinstance(post.get('files'), list):
        raise PlanFilesError(f'{path} is not a post.json: it needs a "files" list')
    return post


def pack_folder(post):
    """The post's folder in the pack and the library, as build.py names it, or None."""
    try:
        return library.post_folder(post.get('date'), post.get('subject'), post.get('subchannel'),
                                   bool(post.get('launch')), post.get('day'))
    except (library.LibraryError, ValueError, TypeError):
        return None


def _raw(entry):
    raw = entry.get('file')
    return raw.strip() if isinstance(raw, str) and raw.strip() else None


def packed_name(entry):
    """The name build.py gives the entry's file in the pack, or None."""
    raw = _raw(entry)
    fixed = FIXED.get(entry.get('kind'))
    if entry.get('name'):
        name = str(entry['name'])
    elif fixed and raw:
        name = fixed + Path(raw).suffix.lower()
    elif fixed:
        name = f'{fixed}.md'  # given as "text"
    elif raw:
        name = Path(raw).name
    else:
        return None
    stem, dot, extension = name.rpartition('.')
    clean = library.archive.safe_text(stem) if dot and stem else ''
    return f'{clean}.{extension.lower()}' if clean else None


def cut_of(entry):
    """The cut a video-script entry is for: its "cut", else what its name says, else None."""
    if entry.get('cut') in CUTS:
        return entry['cut']
    return story_check.cut_of(entry.get('name') or entry.get('file') or '')


def draft_of(post_path, raw):
    """docs/plans/<date>-draft-<file> beside the plan folder, when the folder's name starts with its date."""
    dated = DATED_PLAN.match(Path(post_path).parent.name)
    return Path(post_path).parent.parent / f'{dated.group(1)}-draft-{Path(raw).name}' if dated and raw else None


def library_roots(env=None, config=STUDIO_CONFIG, windows=None):
    """<library>/3 Posts on this machine: MINDMAKE_LIBRARY_ROOT, and on
    Windows runtime.library_root (recording_match.library_roots, less the
    staged pack, which comes before the folders given here)."""
    env = os.environ if env is None else env
    windows = (os.name == 'nt') if windows is None else windows
    roots = []
    given = str(env.get('MINDMAKE_LIBRARY_ROOT') or '').strip()
    if given:
        roots.append(Path(given) / library.POSTS)
    if windows:
        try:
            configured = json.loads(Path(config).read_text(encoding='utf-8')).get('runtime', {}).get('library_root')
        except (OSError, ValueError, AttributeError):
            configured = None
        if configured:
            roots.append(Path(configured) / library.POSTS)
    return list(dict.fromkeys(roots))


def shown(path):
    """A path as a person reads it: from the repository when inside it, forward slashes everywhere."""
    path = Path(path).resolve()
    try:
        return path.relative_to(REPO).as_posix()
    except ValueError:
        return path.as_posix()


# ---------------------------------------------------------------- the places, in order

def places(post_path, post, entry, files=(), staged=STAGED, library_at=None, cut=None):
    """Every place the entry's file may be, in the order to try:
    [(how, path, why)], how 'file' for a path to try, 'search' for a folder
    given with --files to search when nothing named matched."""
    post_path = Path(post_path)
    kind = entry.get('kind')
    raw = _raw(entry)
    section = SECTION.get(kind)
    folder = pack_folder(post)
    names = [packed_name(entry)]
    if kind == 'video-script':
        names.append(USUAL.get(cut or cut_of(entry)))
    names = [n for n in dict.fromkeys(names) if n]
    out = []
    if raw:
        out.append(('file', post_path.parent / raw, BESIDE))
    if kind == 'video-script' and raw:
        draft = draft_of(post_path, raw)
        if draft:
            out.append(('file', draft, DRAFT))
    if staged and folder and section:
        out += [('file', Path(staged) / folder / section / n, STAGED_PACK) for n in names]
    for root in files:
        root = Path(root)
        if raw:
            out.append(('file', root / raw, GIVEN))
        if section:
            for n in names:
                out.append(('file', root / section / n, GIVEN))
                out.append(('file', root / n, GIVEN))
                if folder:
                    out.append(('file', root / folder / section / n, GIVEN))
    for root in files:
        out.append(('search', Path(root), GIVEN))
    for root in (library_roots() if library_at is None else library_at):
        if folder and section:
            out += [('file', Path(root) / folder / section / n, LIBRARY) for n in names]
    seen, unique = set(), []
    for item in out:
        key = (item[0], str(item[1]))
        if key not in seen:
            seen.add(key)
            unique.append(item)
    return unique


def search(root, names, folder, depth=SEARCH_DEPTH):
    """(path or None, clash): the one file with one of `names` (tried in
    order) up to `depth` folders under root, never inside another post's
    folder nor a hidden one. Copies with the same bytes count as one; two
    different files of one name are a clash, not a hit."""
    root = Path(root)
    if not root.is_dir():
        return None, None
    found = {n: [] for n in names}
    for dirpath, dirnames, filenames in os.walk(root):
        level = len(Path(dirpath).relative_to(root).parts)
        dirnames[:] = sorted(d for d in dirnames if not d.startswith('.') and not (POST_FOLDER.match(d) and d != folder)) \
            if level < depth else []
        for n in names:
            if n in filenames:
                found[n].append(Path(dirpath) / n)
    for n in names:
        hits = sorted(found[n])
        if hits and len({_sha256(p) for p in hits}) == 1:
            return hits[0], None
        if hits:
            return None, f'{len(hits)} different files called {n} under {shown(root)}, so none was taken'
    return None, None


def _sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest()


def find(post_path, post, entry, files=(), staged=STAGED, library_at=None, cut=None):
    """{'path', 'why', 'tried'}: the first place that holds the entry's file,
    and every place looked in before it (all of them when none does)."""
    names = [n for n in dict.fromkeys([Path(_raw(entry) or '').name, packed_name(entry),
                                        USUAL.get(cut or cut_of(entry)) if entry.get('kind') == 'video-script' else None]) if n]
    tried = []
    for how, path, why in places(post_path, post, entry, files, staged, library_at, cut):
        if how == 'file':
            if path.is_file():
                return {'path': path, 'why': why, 'tried': tried}
            tried.append(f'{shown(path)} ({why})')
        else:
            hit, clash = search(path, names, pack_folder(post))
            if hit:
                return {'path': hit, 'why': why, 'tried': tried}
            tried.append(clash or f'{shown(path)} and up to {SEARCH_DEPTH} folders down ({why})')
    return {'path': None, 'why': None, 'tried': tried}


def video_files(post_path, post=None, files=(), staged=STAGED, library_at=None):
    """Every script and picture the video needs, with where it is:
    [{'kind', 'cut', 'file', 'name', 'path', 'why', 'tried'}]."""
    post = load_post(post_path) if post is None else post
    out = []
    for entry in post['files']:
        if not isinstance(entry, dict) or entry.get('kind') not in SECTION:
            continue
        item = {'kind': entry['kind'], 'cut': cut_of(entry) if entry['kind'] == 'video-script' else None,
                'file': entry.get('file'), 'name': packed_name(entry)}
        if entry['kind'] == 'video-script' and isinstance(entry.get('text'), str) and entry['text'].strip():
            item.update(path=None, why='post.json (its text)', tried=[])
        elif not _raw(entry):
            item.update(path=None, why=None, tried=['the entry names no "file"'])
        else:
            hit = find(post_path, post, entry, files, staged, library_at, item['cut'])
            item.update(path=hit['path'], why=hit['why'], tried=hit['tried'])
        out.append(item)
    return out


# ---------------------------------------------------------------- self-test

def self_test():
    from importlib import util
    checks = []

    def check(label, got, want):
        checks.append((label, got, want))

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        plans = tmp / 'docs' / 'plans'
        plan = plans / '2026-10-12-monday'
        plan.mkdir(parents=True)
        post = {'date': '2026-10-12', 'subchannel': 'follow.the.money', 'subject': 'Who gets paid for AI songs', 'files': [
            {'kind': 'image', 'file': 'money.png', 'name': '1-who-gets-paid.png'},
            {'kind': 'image', 'file': 'pileup.png'},
            {'kind': 'video-script', 'file': 'script.md', 'cut': 'long'},
            {'kind': 'video-script', 'file': 'script-90s.md', 'name': 'video-script-90-seconds.md', 'cut': 'short'},
            {'kind': 'cover', 'file': 'cover.png'},
        ]}
        (plan / 'post.json').write_text(json.dumps(post), encoding='utf-8')
        post_path = plan / 'post.json'
        folder = pack_folder(post)
        check('the pack folder is build.py\'s', folder, '2026-10-12 Mon follow.the.money - Who gets paid for AI songs')
        money, pileup, long_, short = post['files'][:4]
        check('packed names: its "name", the kind\'s fixed name with the file\'s type, else its own name',
              [packed_name(e) for e in post['files']], ['1-who-gets-paid.png', 'pileup.png', 'video-script.md',
                                                        'video-script-90-seconds.md', 'cover.png'])
        check('a name is made safe by the archive rule', packed_name({'kind': 'image', 'name': 'a: b?.PNG'}), 'a b.png')
        check('the draft beside a dated plan', draft_of(post_path, 'script-90s.md'), plans / '2026-10-12-draft-script-90s.md')
        check('a plan folder with no date has no draft', draft_of(tmp / 'loose' / 'post.json', 'script.md'), None)

        staged = tmp / 'staged'
        given = tmp / 'work'
        packed = tmp / 'library' / library.POSTS / folder
        lib = [tmp / 'library' / library.POSTS]

        def where(entry, files=(given,), cut=None):
            hit = find(post_path, post, entry, files, staged, lib, cut)
            return (hit['why'], hit['path'].relative_to(tmp).as_posix()) if hit['path'] else (None, None)

        def put(path, text='x'):
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding='utf-8')

        check('nowhere: not found, and every place is named', (where(long_), len(find(post_path, post, long_, (given,), staged, lib)['tried'])),
              ((None, None), 9))
        put(packed / library.VIDEO / 'video-script.md')
        check('5. the library, by packed name', where(long_), (LIBRARY, f'library/3 Posts/{folder}/3 Video/video-script.md'))
        put(given / 'deep' / 'script.md')
        check('4. a folder given, searched: one file of that name', where(long_), (GIVEN, 'work/deep/script.md'))
        put(given / 'other' / 'script.md')
        check('copies with the same bytes count as one', where(long_), (GIVEN, 'work/deep/script.md'))
        put(given / 'other' / 'script.md', 'y')
        hit = find(post_path, post, long_, (given,), staged, lib)
        check('two different files of one name are a clash, said so, and the search goes on to the library',
              (hit['why'], any('2 different files called script.md' in t for t in hit['tried'])), (LIBRARY, True))
        put(given / '2026-10-05 Mon follow.the.money - Another piece' / '3 Video' / 'video-script-90-seconds.md')
        check('never inside another post\'s folder', where(short), (None, None))
        put(given / folder / library.VIDEO / 'video-script-90-seconds.md')
        check('4. the folder above the packed post folder, by packed name', where(short),
              (GIVEN, f'work/{folder}/3 Video/video-script-90-seconds.md'))
        put(given / 'script.md')
        check('4. a working folder, by its post.json name', where(long_), (GIVEN, 'work/script.md'))
        put(staged / folder / library.VIDEO / 'video-script.md')
        check('3. the staged pack comes before a folder given', where(long_), (STAGED_PACK, f'staged/{folder}/3 Video/video-script.md'))
        put(plans / '2026-10-12-draft-script.md')
        check('2. the dated draft comes before the staged pack', where(long_), (DRAFT, 'docs/plans/2026-10-12-draft-script.md'))
        put(plan / 'script.md')
        check('1. beside post.json comes first', where(long_), (BESIDE, 'docs/plans/2026-10-12-monday/script.md'))
        unnamed = {'kind': 'video-script', 'file': 'take-90.md'}
        check('a short script with no "name" is looked for by build.py\'s name, then the pack\'s usual one',
              [p.name for how, p, why in places(post_path, post, unnamed, (), tmp / 'staged2', []) if why == STAGED_PACK],
              ['video-script.md', 'video-script-90-seconds.md'])
        put(tmp / 'staged2' / folder / library.VIDEO / 'video-script-90-seconds.md')
        check('... and found by the usual one', find(post_path, post, unnamed, (), tmp / 'staged2', [])['path'].name,
              'video-script-90-seconds.md')
        check('a picture has no draft: a working folder misses, then the library\'s packed name', where(money, files=()), (None, None))
        put(packed / library.COVERS / '1-who-gets-paid.png')
        check('... found in the library under 2 Covers and images', where(money, files=()),
              (LIBRARY, f'library/3 Posts/{folder}/2 Covers and images/1-who-gets-paid.png'))
        put(given / library.COVERS / 'pileup.png')
        check('the packed post folder itself given with --files', where(pileup), (GIVEN, 'work/2 Covers and images/pileup.png'))
        listed = video_files(post_path, post, (given,), staged, lib)
        check('video_files lists the scripts and pictures only, each with its cut',
              [(i['kind'], i['cut'], i['why'] is not None) for i in listed],
              [('image', None, True), ('image', None, True), ('video-script', 'long', True), ('video-script', 'short', True)])
        check('a script given as text needs no file', video_files(post_path, {'files': [{'kind': 'video-script', 'cut': 'long', 'text': 'Hi.'}]})[0]['why'],
              'post.json (its text)')
        check('library roots: MINDMAKE_LIBRARY_ROOT, and runtime.library_root only on Windows',
              ([r.as_posix() for r in library_roots({'MINDMAKE_LIBRARY_ROOT': '/lib'}, windows=False)],
               len(library_roots({}, windows=True)), library_roots({}, windows=False)),
              (['/lib/3 Posts'], 1, []))

        # build.py packs under exactly these names: its own plan() of the same post.
        spec = util.spec_from_file_location('post_pack_build', HERE / 'build.py')
        build = util.module_from_spec(spec)
        try:
            spec.loader.exec_module(build)
            work = tmp / 'pack-src'
            work.mkdir()
            entries = []
            for e in post['files'][:4]:
                put(work / e['file'], 'Hello.\n')
                entries.append({**e, 'story_check_override': 'Krish, self-test', 'edge_check_override': 'Krish, self-test'})
            from PIL import Image
            for e in entries[:2]:
                Image.new('RGB', (40, 40), (12, 21, 18)).save(work / e['file'])
            pack_folder_name, planned = build.plan({**post, 'files': entries}, work)
            check('build.py packs into the same folder, sections and names',
                  (pack_folder_name, sorted(i['path'] for i in planned)),
                  (folder, sorted(f'{SECTION[e["kind"]]}/{packed_name(e)}' for e in entries)))
            check('and its kinds agree', [build.KINDS[k][0] for k in SECTION] + [build.KINDS['video-script'][1]],
                  [SECTION[k] for k in SECTION] + [FIXED['video-script']])
        except Exception as e:  # noqa: BLE001 build.py must import and plan for this check
            check(f'build.py plans the same post ({type(e).__name__}: {e})', False, True)

    bad = [f'{label}: got {got!r}, want {want!r}' for label, got, want in checks if got != want]
    print('\n'.join(bad) if bad else f'plan_files self-test passed: {len(checks)} checks')
    return 1 if bad else 0


# ---------------------------------------------------------------- command line

def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if argv[:1] == ['--self-test']:
        return self_test()
    ap = argparse.ArgumentParser(description="Where a piece's scripts and pictures are on this machine.")
    ap.add_argument('post', help="the piece's post.json")
    ap.add_argument('--files', action='append', default=[], help='a working folder or the post\'s library folder to look in too; may repeat')
    ap.add_argument('--json', action='store_true', help='print the answer as JSON')
    args = ap.parse_args(argv)
    try:
        listed = video_files(Path(args.post).resolve(), files=[Path(f).resolve() for f in args.files])
    except PlanFilesError as e:
        print(f'plan_files: {e}', file=sys.stderr)
        return 2
    missing = [i for i in listed if not i['why']]
    if args.json:
        print(json.dumps({'post': shown(Path(args.post)), 'pack_folder': pack_folder(load_post(args.post)),
                          'files': [{**i, 'path': shown(i['path']) if i['path'] else None} for i in listed],
                          'missing': len(missing)}, indent=1, ensure_ascii=False))
    else:
        for i in listed:
            label = f'{i["cut"]} script' if i['kind'] == 'video-script' else 'picture'
            if i['why']:
                print(f'found    {label} {i["file"] or ""}: {shown(i["path"]) if i["path"] else "its text"} ({i["why"]})')
            else:
                print(f'MISSING  {label} {i["file"]!r}, looked in:\n           ' + '\n           '.join(i['tried']))
    return 1 if missing else 0


if __name__ == '__main__':
    sys.exit(main())
