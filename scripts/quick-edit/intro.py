#!/usr/bin/env python3
"""The makeyourmindup intro sting: a 1 to 2 second animated opening before
Krish's face comes in, one clip per shape and per series.

Krish, 2026-10-12: "I also want the video to have a 1-2 sec animated make
your mind up intro visual before my face comes in".

The design lives in the renderer as Remotion compositions named in
config/intro-sting.json ("compositions": tall 9x16 and wide 16x9). Each
composition takes the piece's series as a prop, {"series": "follow_the_money"},
"mind_the_gap" or "under_the_hood", so each series renders in its own colour;
a piece with no series, or one this does not know, gets follow_the_money's.
(A shape may instead name one composition per series, {"follow_the_money":
id, ...}; the series is passed as a prop either way.)

This renders each to .cache/quick-edit/intro/<hash>-<shape>-<series>.mp4:
30 fps, yuv420p, square pixels, exactly `seconds` long, with a silent 48 kHz
stereo AAC track, so make.py can join it in front of the captioned cut
without retiming a word. <hash> is the sting's source hash:

  - the files the sting is built from: every file under apps/renderer/src
    with "sting" in its path, the sting modules the file that registers the
    compositions imports, and every file those import in turn (relative
    imports, followed to the end, so a shared house component counts too);
  - the <Composition> elements that register the sting's ids, and any module
    the file that registers them imports for its effects alone (a global
    stylesheet or font file shapes the sting too);
  - its seconds, composition names and series.

A registration may use only what it imports, never a value defined in the
same file (a defaultProps object, a size, a colour): that is refused by name,
since the hash would not see it change.

Only files git tracks are hashed, and each text file with its line endings
turned to LF first, so a Windows checkout and a Linux one give the same hash.
A sting file git ignores (a *.png, say) is refused by name, since no other
machine would have it, and so is one git does not track yet (git add it) and
an asset reached through staticFile(), which the hash cannot follow.

The design waits for Krish. config/intro-sting.json says "candidate" until he
approves it, and while it does:
  - `render --preview` renders preview-<hash>-<shape>-<series>.mp4 to show him;
  - `render` without --preview refuses;
  - make.py renders without an intro and says so in its report.
`approve --words "..."` records his words and the 64-hex source hash of the
previews he saw (every shape and series). An approval with no such hash is no
approval. A sting whose source changes after that is not used until he
approves again. "last_decision" records his latest word on a design, a
rejection included.

    python intro.py status [--json]
    python intro.py render --preview [--shape 9x16|16x9] [--series SERIES] [--browser PATH]
    python intro.py approve --words "Krish's exact words"
    python intro.py render [--shape ..] [--series ..]
    python intro.py --self-test
"""
import argparse
import glob
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CONFIG = REPO / 'config' / 'intro-sting.json'
CACHE = REPO / '.cache' / 'quick-edit' / 'intro'
RENDERER = REPO / 'apps' / 'renderer' / 'src'
SHAPES = {'9x16': (1080, 1920), '16x9': (1920, 1080)}
# The three series (subchannels) and the one whose colour a piece gets when
# it names none, or one this does not know.
SERIES = ('follow_the_money', 'mind_the_gap', 'under_the_hood')
DEFAULT_SERIES = 'follow_the_money'
FPS = 30
RATE = 48000
SECONDS = (1.0, 2.0)
INK = '0x0C1512'
SHA256 = re.compile(r'[0-9a-f]{64}')
DECISIONS = ('approved', 'rejected')
# What a sting module may import, and the endings tried when an import names
# a module without one (as TypeScript and the Remotion bundler do).
CODE = ('.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs')
ENDINGS = CODE + ('.json', '.css')
# Where Remotion's browser is in this cloud container; on the runner machines
# the Studio's own copy is used, else Remotion fetches one.
CONTAINER_BROWSER = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'


class IntroError(ValueError):
    """A reason the sting cannot be used or rendered, in plain words."""


def series_name(value):
    """'mind_the_gap' from 'mind_the_gap', 'mind.the.gap', 'Mind the gap' or
    any capitals; None when it is none of the three series."""
    wanted = re.sub(r'[.\-\s]+', '_', str(value or '').strip().lower())
    return wanted if wanted in SERIES else None


def load(path=None):
    path = Path(path or CONFIG)
    cfg = json.loads(path.read_text(encoding='utf-8'))
    if cfg.get('schema_version') != 1:
        raise IntroError(f'{path}: schema_version must be 1')
    if cfg.get('status') not in ('candidate', 'approved'):
        raise IntroError(f'{path}: status is "candidate" or "approved"')
    secs = cfg.get('seconds')
    if not isinstance(secs, (int, float)) or not SECONDS[0] <= secs <= SECONDS[1]:
        raise IntroError(f'{path}: seconds is between {SECONDS[0]} and {SECONDS[1]}')
    series = cfg.setdefault('series', list(SERIES))
    if not isinstance(series, list) or not series or any(s not in SERIES for s in series) or DEFAULT_SERIES not in series:
        raise IntroError(f'{path}: series lists the series the sting renders, from {", ".join(SERIES)}, {DEFAULT_SERIES} among them')
    comps = cfg.get('compositions') or {}
    if sorted(comps) != sorted(SHAPES):
        raise IntroError(f'{path}: compositions names the composition for each of {", ".join(SHAPES)}')
    for shape, value in comps.items():
        if isinstance(value, dict):
            if sorted(value) != sorted(series) or not all(isinstance(v, str) and v for v in value.values()):
                raise IntroError(f'{path}: compositions.{shape} names one composition for each series ({", ".join(series)})')
        elif not (isinstance(value, str) and value):
            raise IntroError(f'{path}: compositions.{shape} is a composition id, or one per series')
    decision = cfg.get('last_decision')
    if decision is not None:
        if not (isinstance(decision, dict) and decision.get('decision') in DECISIONS
                and str(decision.get('by') or '').lower().startswith('krish') and str(decision.get('words') or '').strip()):
            raise IntroError(f'{path}: last_decision is Krish\'s latest word on a design: {{"on", "by": "Krish", "decision": '
                             f'"approved" or "rejected", "words": his exact words}}')
    if cfg['status'] == 'approved':
        if not (str(cfg.get('approved_by') or '').lower().startswith('krish') and str(cfg.get('approval_words') or '').strip()):
            raise IntroError(f'{path}: an approved sting carries Krish\'s approval and his words')
        if not SHA256.fullmatch(str(cfg.get('source_sha256') or '')):
            raise IntroError(f'{path}: an approved sting carries the 64-hex source_sha256 of the preview Krish saw; '
                             'without it nothing is approved')
        if decision is not None and decision.get('decision') != 'approved':
            raise IntroError(f'{path}: the sting says approved, but Krish\'s last decision was "{decision.get("decision")}"')
    return cfg


def composition(cfg, shape, series):
    """The composition id for this shape and series."""
    value = cfg['compositions'][shape]
    return value[series] if isinstance(value, dict) else value


def composition_ids(cfg):
    ids = []
    for value in cfg['compositions'].values():
        for cid in (value.values() if isinstance(value, dict) else [value]):
            if cid not in ids:
                ids.append(cid)
    return ids


# The source: what the sting is built from, as git tracks it.

IMPORT = re.compile(r'''(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(['"])([^'"\n]+)\1''')
# A module the registering file loads for its effects alone (import './fonts.css'):
# it shapes every composition the file registers, the sting's too.
SIDE_EFFECT = re.compile(r'''(?m)^\s*import\s+(['"])(\.[^'"\n]+)\1''')
DECLARED = re.compile(r'\b(?:const|let|var|function\*?|class|enum)\s+([A-Za-z_$][\w$]*)')
DESTRUCTURED = re.compile(r'\b(?:const|let|var)\s*[{\[]([^}\]=]*)[}\]]\s*=')
JS_STRING = re.compile(r'''(['"`])(?:\\.|(?!\1).)*\1''', re.S)
IDENT = re.compile(r'(?<![\w$.])[A-Za-z_$][\w$]*')
CSS_URL = re.compile(r'''(?:@import\s+(['"])([^'"\n]+)\1|url\(\s*(['"]?)([^'")\n]+)\3\s*\))''')
IMPORT_BINDINGS = re.compile(r'''\bimport\s+(?:type\s+)?([\w$*\s{},]+?)\s+from\s*(['"])([^'"\n]+)\2''')


def imports(path, text):
    """The relative modules and files a source file names (outside its
    comments)."""
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    if path.suffix != '.css':
        text = re.sub(r'(?m)^\s*//.*$', '', text)
    found = [m.group(2) for m in IMPORT.finditer(text)]
    if path.suffix == '.css':
        found += [m.group(2) or m.group(4) for m in CSS_URL.finditer(text)]
    return [spec.split('?')[0].split('#')[0] for spec in found if spec.startswith('.')]


def code_only(text):
    """Source text with its comments taken out."""
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    return re.sub(r'(?m)^\s*//.*$', '', text)


def local_names(text):
    """The values a file defines itself (const, let, var, function, class,
    enum, and names unpacked from an object or a list)."""
    text = code_only(text)
    names = set(DECLARED.findall(text))
    for group in DESTRUCTURED.findall(text):
        names.update(IDENT.findall(group))
    return names


def imported_names(text):
    """The names a file imports."""
    names = set()
    for m in IMPORT_BINDINGS.finditer(code_only(text)):
        names.update(re.findall(r'[\w$]+', m.group(1).replace(' as ', ' ')))
    return names - {'type'}


def element_refs(element):
    """The names a <Composition> element uses in its {...} values (outside
    strings): a component, defaultProps, a size, a schema."""
    text, inside, depth = JS_STRING.sub('""', element), [], 0
    for ch in text:
        if ch == '{':
            depth += 1
            inside.append(' ')
        elif ch == '}':
            depth -= 1
            inside.append(' ')
        elif depth > 0:
            inside.append(ch)
    return set(IDENT.findall(''.join(inside)))


def resolve_import(src, spec):
    base = (src.parent / spec)
    for candidate in [base] + [Path(f'{base}{end}') for end in ENDINGS] + [base / f'index{end}' for end in ENDINGS]:
        if candidate.is_file():
            return candidate.resolve()
    return None


def registration(text, cid):
    """The <Composition ... /> element that registers `cid`, or None."""
    m = re.search(r'''\bid\s*=\s*\{?\s*(['"])''' + re.escape(cid) + r'\1', text)
    if not m:
        return None
    start = text.rfind('<Composition', 0, m.start())
    if start < 0:
        return None
    depth, quote, i = 0, None, start
    while i < len(text):
        ch = text[i]
        if quote:
            if ch == '\\':
                i += 2
                continue
            if ch == quote:
                quote = None
        elif ch in '\'"`':
            quote = ch
        elif ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
        elif ch == '>' and depth == 0:
            return text[start:i + 1]
        i += 1
    return None


def git_top(path):
    try:
        p = subprocess.run(['git', '-C', str(path), 'rev-parse', '--show-toplevel'], capture_output=True, text=True)
    except OSError:
        raise IntroError('git is not on the PATH, so the sting\'s tracked source cannot be told apart from stray files') from None
    if p.returncode:
        raise IntroError(f'{path} is not in a git checkout, so the sting\'s tracked source cannot be told apart from stray files')
    return Path(p.stdout.strip()).resolve()


def git_state(top, paths):
    """{path: 'tracked' | 'ignored' (with the rule) | 'untracked'} for files in the checkout at `top`."""
    rel = {p: p.relative_to(top).as_posix() for p in paths}
    listed = subprocess.run(['git', '-C', str(top), 'ls-files', '-z', '--', *rel.values()], capture_output=True)
    tracked = set(listed.stdout.decode('utf-8').split('\0')) - {''}
    state = {p: 'tracked' for p, r in rel.items() if r in tracked}
    rest = [p for p in paths if p not in state]
    if rest:
        # Bytes, not text: on Windows text mode would send each name with a
        # carriage return, and git would match none of them.
        p = subprocess.run(['git', '-C', str(top), 'check-ignore', '-v', '--stdin'],
                           input=('\n'.join(rel[x] for x in rest) + '\n').encode('utf-8'), capture_output=True)
        rules = {}
        for line in p.stdout.decode('utf-8', errors='replace').splitlines():
            how, _, name = line.partition('\t')
            rules[name.strip().strip('"')] = how.rsplit(':', 1)[-1] if how else ''
        for x in rest:
            state[x] = f'ignored ({rules[rel[x]]})' if rel[x] in rules else 'untracked'
    return state


def sting_sources(cfg, root=None):
    """(files, registrations, top): every file the sting is built from, the
    text of each <Composition> that registers one of its ids, and the git
    checkout they sit in. ([], [], None) when there is no sting source yet.
    Raises IntroError, naming the file, for an import that is not there, a
    sting file git ignores or does not track, and a staticFile() asset."""
    root = Path(root or RENDERER).resolve()
    if not root.is_dir():
        return [], [], None
    every = [p for p in root.rglob('*') if p.is_file() and 'node_modules' not in p.parts]
    starts = {p.resolve() for p in every if re.search('sting', p.relative_to(root).as_posix(), re.I)}
    ids = composition_ids(cfg)
    registrations = []
    for p in sorted(every):
        if p.suffix not in CODE:
            continue
        text = p.read_text(encoding='utf-8', errors='replace')
        elements = [(cid, registration(text, cid)) for cid in ids]
        elements = [(cid, el) for cid, el in elements if el]
        if not elements:
            continue
        registrations += [(p.resolve(), cid, el) for cid, el in elements]
        # Everything the registration uses must come from an import, which the
        # hash follows: a value defined in this file (a defaultProps object,
        # a size, a colour) would change the sting's look with the hash the same.
        here = local_names(text) - imported_names(text)
        for cid, el in elements:
            leaning = sorted(element_refs(el) & here)
            if leaning:
                raise IntroError(f'{p.relative_to(root).as_posix()} registers {cid} with {", ".join(leaning)}, defined in that same file, '
                                 'which the sting\'s hash does not cover: define it in the sting module, or a file it imports, and import it '
                                 'here, so Krish\'s approval binds it')
        for m in SIDE_EFFECT.finditer(code_only(text)):
            hit = resolve_import(p, m.group(2))
            if not hit:
                raise IntroError(f'{p.relative_to(root).as_posix()} imports {m.group(2)!r}, and it is not there')
            starts.add(hit)
        # The sting's entry: the modules this file imports for the sting,
        # by name ("sting" in the path) or by the component it registers.
        used = ' '.join(el for _, el in elements)
        for m in IMPORT_BINDINGS.finditer(text):
            names = set(re.findall(r'[\w$]+', m.group(1).replace(' as ', ' '))) - {'type'}
            if m.group(3).startswith('.') and ('sting' in m.group(3).lower() or any(re.search(rf'\b{re.escape(n)}\b', used) for n in names)):
                hit = resolve_import(p, m.group(3))
                if not hit:
                    raise IntroError(f'{p.relative_to(root).as_posix()} imports {m.group(3)!r} for the sting, and it is not there')
                starts.add(hit)
    if not starts and not registrations:
        return [], [], None
    seen, queue = set(), sorted(starts)
    while queue:
        f = queue.pop()
        if f in seen:
            continue
        seen.add(f)
        if f.suffix not in CODE + ('.css',):
            continue
        text = f.read_text(encoding='utf-8', errors='replace')
        if f.suffix in CODE and re.search(r'\bstaticFile\s*\(', text):
            raise IntroError(f'{f.name} reaches an asset through staticFile(), which the sting\'s hash cannot follow: '
                             'import the asset instead, so the approval binds it')
        for spec in imports(f, text):
            target = resolve_import(f, spec)
            if not target:
                raise IntroError(f'{f.name} imports {spec!r}, and it is not there')
            queue.append(target)
    top = git_top(root)
    outside = [f for f in seen if not f.is_relative_to(top)]
    if outside:
        raise IntroError(f'the sting reaches files outside the repository: {", ".join(str(f) for f in sorted(outside))}')
    state = git_state(top, sorted(seen | {r[0] for r in registrations}))
    ignored = sorted(f.relative_to(top).as_posix() + f' {s}' for f, s in state.items() if s.startswith('ignored'))
    if ignored:
        raise IntroError('git ignores these sting source files, so no other machine has them and the sting cannot be approved '
                         f'or used while it needs them: {"; ".join(ignored)}')
    untracked = sorted(f.relative_to(top).as_posix() for f, s in state.items() if s == 'untracked')
    if untracked:
        raise IntroError(f'git does not track these sting source files yet: {", ".join(untracked)}. git add them first, '
                         'so the approval binds what will be committed')
    # Ordered by the posix path, case and all, so Windows (whose paths compare
    # without case) hashes in the same order as everywhere else.
    return sorted(seen, key=lambda f: f.relative_to(top).as_posix()), registrations, top


def lf(data):
    """A text file's bytes with CRLF line endings turned to LF; binary data as it is."""
    return data if b'\0' in data else data.replace(b'\r\n', b'\n')


def source_hash(cfg, root=None):
    """The sting's identity: its tracked source (line endings as LF), its
    registrations, seconds, composition names and series. (None, []) when
    there is no sting source in the renderer yet."""
    files, registrations, top = sting_sources(cfg, root)
    if not files and not registrations:
        return None, []
    h = hashlib.sha256(json.dumps({'seconds': cfg['seconds'], 'compositions': cfg['compositions'], 'series': cfg['series']},
                                  sort_keys=True).encode())
    for f in files:
        h.update(f.relative_to(top).as_posix().encode() + b'\0' + lf(f.read_bytes()) + b'\0')
    for path, cid, element in sorted(registrations, key=lambda r: (r[1], r[0].as_posix())):
        h.update(b'registration\0' + cid.encode() + b'\0' + lf(element.encode('utf-8')) + b'\0')
    shown = [f.relative_to(top).as_posix() for f in files]
    shown += [f'{path.relative_to(top).as_posix()} (the {cid} registration)' for path, cid, _ in registrations if path not in files]
    return h.hexdigest(), shown


def registered(cfg, root=None):
    """Whether each composition's id appears in the renderer's source."""
    root = Path(root or RENDERER)
    text = ''.join(p.read_text(encoding='utf-8', errors='ignore') for p in root.rglob('*') if p.suffix in CODE) if root.is_dir() else ''
    return {cid: f'"{cid}"' in text or f"'{cid}'" in text for cid in composition_ids(cfg)}


def cached(shape, digest, preview=False, cache=None, series=DEFAULT_SERIES):
    return Path(cache or CACHE) / f'{"preview-" if preview else ""}{digest[:16]}-{shape}-{series}.mp4'


def finish(src, dst, shape, seconds):
    """Any clip into the sting's exact form: the shape's size (fitted on ink
    if it is not already), 30 fps, square pixels, yuv420p, exactly `seconds`
    long (the last frame held if the clip is short), with a silent 48 kHz
    stereo AAC track. The same path for a Remotion render and a test clip."""
    w, h = SHAPES[shape]
    frames = round(seconds * FPS)
    dst = Path(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst.with_name(dst.stem + '.part.mp4')
    vf = (f'fps={FPS},scale={w}:{h}:force_original_aspect_ratio=decrease:flags=lanczos,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color={INK},'
          f'setsar=1,format=yuv420p,tpad=stop_mode=clone:stop_duration={seconds},trim=end_frame={frames},setpts=PTS-STARTPTS')
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', str(src),
                    '-f', 'lavfi', '-i', f'anullsrc=r={RATE}:cl=stereo',
                    '-filter_complex', f'[0:v]{vf}[v];[1:a]atrim=end_sample={round(seconds * RATE)},asetpts=PTS-STARTPTS[a]',
                    '-map', '[v]', '-map', '[a]', '-frames:v', str(frames),
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', str(FPS),
                    '-c:a', 'aac', '-b:a', '192k', '-ar', str(RATE), '-ac', '2', '-movflags', '+faststart', str(tmp)], check=True)
    info = describe(tmp)
    want = {'width': w, 'height': h, 'fps': '30/1', 'frames': frames, 'pix_fmt': 'yuv420p', 'sar': '1:1', 'sample_rate': RATE, 'channels': 2, 'audio': 'aac'}
    wrong = {k: (info.get(k), v) for k, v in want.items() if info.get(k) != v}
    if wrong:
        tmp.unlink(missing_ok=True)
        raise IntroError(f'the finished sting is not in the house form: {wrong}')
    os.replace(tmp, dst)
    return info


def describe(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-show_entries',
                          'stream=codec_type,codec_name,width,height,r_frame_rate,nb_read_frames,pix_fmt,sample_aspect_ratio,sample_rate,channels:format=duration',
                          '-of', 'json', str(path)], capture_output=True, text=True, check=True)
    data = json.loads(out.stdout)
    v = next((s for s in data['streams'] if s['codec_type'] == 'video'), {})
    a = next((s for s in data['streams'] if s['codec_type'] == 'audio'), {})
    return {'width': v.get('width'), 'height': v.get('height'), 'fps': v.get('r_frame_rate'), 'frames': int(v.get('nb_read_frames') or 0),
            'pix_fmt': v.get('pix_fmt'), 'sar': v.get('sample_aspect_ratio') or '1:1', 'seconds': round(float(data['format']['duration']), 3),
            'audio': a.get('codec_name'), 'sample_rate': int(a.get('sample_rate') or 0), 'channels': a.get('channels')}


def browser(given=None):
    if given:
        return given
    if os.environ.get('REMOTION_BROWSER_EXECUTABLE'):
        return os.environ['REMOTION_BROWSER_EXECUTABLE']
    runtime = os.environ.get('MINDMAKE_RUNTIME_ROOT') or str(Path.home() / 'Documents' / 'MindmakeVideoStudio' / 'runtime')
    found = sorted(glob.glob(os.path.join(runtime, 'browser', 'remotion-*', 'headless-shell', 'chrome-headless-shell*')))
    if found:
        return found[-1]
    return CONTAINER_BROWSER if Path(CONTAINER_BROWSER).exists() else None


REMOTION = r"""
import { bundle } from '@remotion/bundler'
import { getCompositions, renderMedia } from '@remotion/renderer'
const job = JSON.parse(process.env.MINDMAKE_INTRO_JOB)
const opts = job.browser ? { browserExecutable: job.browser } : {}
const inputProps = job.inputProps || {}
const serveUrl = await bundle({ entryPoint: job.entry })
const all = await getCompositions(serveUrl, { inputProps, ...opts })
const composition = all.find((c) => c.id === job.id)
if (!composition) {
  console.error(`not registered: ${job.id}; the renderer has ${all.map((c) => c.id).join(', ')}`)
  process.exit(3)
}
await renderMedia({ composition, serveUrl, codec: 'h264', crf: 14, imageFormat: 'png', pixelFormat: 'yuv420p', muted: true,
  outputLocation: job.out, inputProps, logLevel: 'error', ...opts })
console.log(JSON.stringify({ id: composition.id, width: composition.width, height: composition.height, fps: composition.fps, frames: composition.durationInFrames }))
"""


def remotion(composition_id, out, entry=None, browser_path=None, series=DEFAULT_SERIES):
    """One Remotion composition to an mp4, with the series as its prop,
    through node from the repository root (where @remotion/bundler and
    @remotion/renderer are installed)."""
    if not shutil.which('node'):
        raise IntroError('node is not on the PATH, so the sting cannot be rendered here')
    job = {'entry': str(Path(entry or RENDERER / 'index.ts').resolve()), 'id': composition_id, 'out': str(out), 'browser': browser(browser_path),
           'inputProps': {'series': series}}
    p = subprocess.run(['node', '--input-type=module', '-e', REMOTION], cwd=REPO, capture_output=True, text=True,
                       env={**os.environ, 'MINDMAKE_INTRO_JOB': json.dumps(job)})
    if p.returncode:
        said = (p.stderr or '') + (p.stdout or '')
        missing = re.search(r'not registered: .*', said)
        if missing:
            raise IntroError(f'the composition {composition_id} is {missing.group(0)}')
        raise IntroError(f'Remotion could not render {composition_id}: {said.strip()[-600:]}')
    return json.loads(p.stdout.strip().splitlines()[-1])


def render(shape, cfg=None, preview=False, browser_path=None, entry=None, force=False, cache=None, root=None, series=DEFAULT_SERIES):
    """The finished sting for one shape and series. Without `preview` it
    renders only an approved sting whose source is the one Krish approved."""
    cfg = cfg or load()
    series = series_name(series) or DEFAULT_SERIES
    if series not in cfg['series']:
        raise IntroError(f'the sting does not render {series}: config/intro-sting.json lists {", ".join(cfg["series"])}')
    root = root or (Path(entry).resolve().parent if entry else None)
    if not preview and cfg['status'] != 'approved':
        raise IntroError('the sting is still a candidate: render --preview, show Krish, and record his words with approve')
    digest, _ = source_hash(cfg, root)
    if not digest:
        raise IntroError('there is no sting source in the renderer yet (no file under apps/renderer/src has "sting" in its path)')
    if not preview and cfg.get('source_sha256') != digest:
        raise IntroError('the sting\'s source is not the one Krish approved: render --preview and ask him again')
    out = cached(shape, digest, preview, cache, series)
    if out.exists() and not force:
        return out
    seen = cached(shape, digest, True, cache, series)
    if not preview and seen.exists() and not force:
        # The approved render is the preview Krish saw: same source, same file.
        shutil.copyfile(seen, out)
        return out
    raw = out.with_name(f'raw-{out.name}')
    raw.parent.mkdir(parents=True, exist_ok=True)
    made = remotion(composition(cfg, shape, series), raw, entry, browser_path, series)
    want = SHAPES[shape]
    if (made['width'], made['height']) != want:
        raw.unlink(missing_ok=True)
        raise IntroError(f'{made["id"]} is {made["width"]}x{made["height"]}, the {shape} sting is {want[0]}x{want[1]}')
    finish(raw, out, shape, cfg['seconds'])
    raw.unlink(missing_ok=True)
    return out


def sting_for(shape, config=None, cache=None, root=None, render_missing=True, series=None):
    """What make.py asks: the approved sting for this shape and series (an
    unknown or missing series gets follow_the_money's), or None and why. It
    never raises: a render goes on without an intro rather than stop."""
    try:
        cfg = load(config)
        series = series_name(series) or DEFAULT_SERIES
        if series not in cfg['series']:
            series = DEFAULT_SERIES
        if cfg['status'] != 'approved':
            return None, 'the intro sting is still a candidate waiting for Krish\'s approval (config/intro-sting.json), so this cut has no intro'
        digest, _ = source_hash(cfg, root)
        if not digest:
            return None, 'the intro sting is approved but its source is not in apps/renderer, so this cut has no intro'
        if cfg.get('source_sha256') != digest:
            return None, 'the intro sting\'s source changed after Krish approved it, so this cut has no intro: preview it and ask him again'
        out = cached(shape, digest, False, cache, series)
        if out.exists():
            return out, None
        if not render_missing:
            return None, f'the approved intro sting is not rendered on this machine for {shape} {series} yet: run python scripts/quick-edit/intro.py render'
        return render(shape, cfg, cache=cache, root=root, series=series), None
    except (IntroError, OSError, ValueError, subprocess.CalledProcessError) as e:
        return None, f'the intro sting could not be used, so this cut has no intro: {e}'


def status(config=None):
    cfg = load(config)
    try:
        digest, files = source_hash(cfg)
        problem = None
    except IntroError as e:
        digest, files, problem = None, [], str(e)
    return {'status': cfg['status'], 'seconds': cfg['seconds'], 'compositions': cfg['compositions'], 'series': cfg['series'],
            'registered': registered(cfg), 'source_sha256': digest, 'source_problem': problem,
            'approved_source_sha256': cfg.get('source_sha256'), 'source_files': files,
            'approved_by': cfg.get('approved_by'), 'approved_on': cfg.get('approved_on'), 'last_decision': cfg.get('last_decision'),
            'renders': {shape: {series: {'approved': str(cached(shape, digest, False, None, series)) if digest and cached(shape, digest, False, None, series).exists() else None,
                                         'preview': str(cached(shape, digest, True, None, series)) if digest and cached(shape, digest, True, None, series).exists() else None}
                                for series in cfg['series']}
                        for shape in SHAPES}}


def approve(path, words, by='Krish', on=None, root=None, cache=None):
    """Record Krish's approval of the previewed sting, bound to its source hash."""
    words = (words or '').strip()
    if not words:
        raise IntroError('--words is Krish\'s own words of approval, exactly as he said them')
    if not by.lower().startswith('krish'):
        raise IntroError('only Krish approves the intro sting')
    path = Path(path or CONFIG)
    cfg = load(path)
    digest, _ = source_hash(cfg, root)
    if not digest:
        raise IntroError('there is no sting source to approve')
    unseen = [f'{shape} {series}' for shape in SHAPES for series in cfg['series'] if not cached(shape, digest, True, cache, series).exists()]
    if unseen:
        raise IntroError(f'no preview of this exact sting for {", ".join(unseen)}: render --preview and show Krish first')
    on = on or date.today().isoformat()
    cfg.update(status='approved', approved_by=by, approved_on=on, approval_words=words, source_sha256=digest,
               last_decision={'on': on, 'by': by, 'decision': 'approved', 'words': words})
    path.write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    return digest


def self_test():
    """A synthetic ffmpeg colour clip through the same finishing path; the
    source hash on a stand-in git checkout (tracked files only, LF and CRLF
    alike, shared imports followed, ignored and untracked files refused); and
    the approval gate per series. All under .cache."""
    checks = []
    work = REPO / '.cache' / 'quick-edit' / 'self-test' / 'intro'
    shutil.rmtree(work, ignore_errors=True)
    work.mkdir(parents=True)
    cfg = load()
    checks.append(('the committed config waits for Krish', (cfg['status'], cfg['approved_by'], cfg['source_sha256']), ('candidate', None, None)))
    decision = cfg.get('last_decision') or {}
    checks.append(('the committed config records his last word on the first design', (decision.get('decision'), decision.get('by')), ('rejected', 'Krish')))
    checks.append(('the committed sting is 1 to 2 seconds', SECONDS[0] <= cfg['seconds'] <= SECONDS[1], True))
    checks.append(('the committed sting renders all three series', sorted(cfg['series']), sorted(SERIES)))
    # A lilac clip with a moving block, 25 fps and the wrong size: the
    # finishing path must make it the house form for both shapes.
    src = work / 'synthetic.mp4'
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0xB7A6FF:s=720x1280:r=25:d=1.2',
                    '-vf', "drawbox=x='t*300':y=600:w=120:h=120:color=0x0C1512:t=fill", '-c:v', 'libx264', '-pix_fmt', 'yuv420p', str(src)], check=True)
    for shape in SHAPES:
        out = work / f'sting-{shape}.mp4'
        info = finish(src, out, shape, 1.5)
        checks.append((f'{shape}: the house form', (info['width'], info['height'], info['fps'], info['frames'], info['pix_fmt'], info['sar']),
                       (*SHAPES[shape], '30/1', 45, 'yuv420p', '1:1')))
        checks.append((f'{shape}: a silent 48 kHz stereo AAC track', (info['audio'], info['sample_rate'], info['channels']), ('aac', RATE, 2)))
        level = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(out), '-af', 'volumedetect', '-f', 'null', '-'],
                               capture_output=True, text=True).stderr
        checks.append((f'{shape}: the track is silent', '-91.0 dB' in level or 'max_volume: -inf' in level, True))

    # The source hash, on a stand-in checkout of its own.
    def checkout(name, eol='\n'):
        top = work / name
        src_root = top / 'apps' / 'renderer' / 'src'
        files = {
            '.gitignore': '*.png\n',
            'apps/renderer/src/index.ts': "import { registerRoot } from 'remotion'\nimport { Root } from './Root'\nregisterRoot(Root)\n",
            'apps/renderer/src/Root.tsx': ("import React from 'react'\nimport { Composition } from 'remotion'\nimport { Other } from './Other'\n"
                                           "import { Tall, Wide } from './opening/Opening'\n\nexport const Root = () => (\n  <>\n"
                                           "    <Composition id=\"Other\" component={Other} durationInFrames={30} fps={30} width={10} height={10} />\n"
                                           "    <Composition id=\"MakeyourmindupStingTall\" component={Tall} durationInFrames={45} fps={30}\n"
                                           "      width={1080} height={1920} defaultProps={{ series: 'follow_the_money' }} />\n"
                                           "    <Composition id=\"MakeyourmindupStingWide\" component={Wide} durationInFrames={45} fps={30}\n"
                                           "      width={1920} height={1080} defaultProps={{ series: 'follow_the_money' }} />\n  </>\n)\n"),
            'apps/renderer/src/Other.tsx': 'export const Other = () => null\n',
            'apps/renderer/src/opening/Opening.tsx': ("import { colourFor } from '../house/colour'\nimport './opening.css'\n"
                                                      "export const Tall = ({ series }: { series: string }) => colourFor(series)\n"
                                                      "export const Wide = Tall\n"),
            'apps/renderer/src/opening/opening.css': '.opening { color: #7FE3B4; }\n',
            'apps/renderer/src/house/colour.ts': "export const colourFor = (series: string) => (series === 'mind_the_gap' ? '#B7A6FF' : '#7FE3B4')\n",
        }
        for rel, text in files.items():
            (top / rel).parent.mkdir(parents=True, exist_ok=True)
            (top / rel).write_bytes(text.replace('\n', eol).encode())
        subprocess.run(['git', 'init', '-q', str(top)], check=True)
        subprocess.run(['git', '-C', str(top), 'config', 'core.autocrlf', 'false'], check=True)
        subprocess.run(['git', '-C', str(top), 'add', '-A'], check=True)
        return top, src_root

    git_add = lambda top: subprocess.run(['git', '-C', str(top), 'add', '-A'], check=True)
    top, root = checkout('lf')
    digest, files = source_hash(cfg, root)
    checks.append(('the hash covers the registered sting entry, what it imports and its registration, nothing else',
                   files, ['apps/renderer/src/house/colour.ts', 'apps/renderer/src/opening/Opening.tsx', 'apps/renderer/src/opening/opening.css',
                           'apps/renderer/src/Root.tsx (the MakeyourmindupStingTall registration)',
                           'apps/renderer/src/Root.tsx (the MakeyourmindupStingWide registration)']))
    _, crlf_root = checkout('crlf', '\r\n')
    checks.append(('LF and CRLF copies of the same sting hash the same', source_hash(cfg, crlf_root)[0], digest))
    root_tsx = root / 'Root.tsx'
    root_tsx.write_text(root_tsx.read_text().replace('width={10}', 'width={20}'))
    checks.append(('another composition\'s change leaves the sting\'s hash alone', source_hash(cfg, root)[0], digest))
    shared = root / 'house' / 'colour.ts'
    shared.write_text(shared.read_text().replace('#B7A6FF', '#C4B5FF'))
    changed_shared = source_hash(cfg, root)[0]
    checks.append(('a change to a shared house file the sting imports changes the hash', changed_shared != digest, True))
    root_tsx.write_text(root_tsx.read_text().replace("defaultProps={{ series: 'follow_the_money' }} />\n    <Composition id=\"MakeyourmindupStingWide\"",
                                                     "defaultProps={{ series: 'under_the_hood' }} />\n    <Composition id=\"MakeyourmindupStingWide\""))
    checks.append(('a change to the sting\'s registration changes the hash', source_hash(cfg, root)[0] not in (digest, changed_shared), True))

    def refused(label, run, want):
        try:
            got = run()
            checks.append((label, f'accepted: {got!r}', f'refused, naming {want}'))
        except IntroError as e:
            checks.append((label, want in str(e), True))

    # The second reviewer's case (2026-10-12): a defaultProps object defined in
    # the registering file changed the look with the hash the same.
    look_top, look_root = checkout('local')
    look_tsx = look_root / 'Root.tsx'
    plain_root = look_tsx.read_text()
    plain_digest = source_hash(cfg, look_root)[0]
    look_tsx.write_text(plain_root.replace("export const Root", "const LOOK = { accent: '#7FE3B4', motion: 'slide' }\n\nexport const Root")
                        .replace("defaultProps={{ series: 'follow_the_money' }} />\n    <Composition id=\"MakeyourmindupStingWide\"",
                                 "defaultProps={LOOK} />\n    <Composition id=\"MakeyourmindupStingWide\""))
    git_add(look_top)
    refused('a sting registration that uses a value defined in its own file is refused, naming it', lambda: source_hash(cfg, look_root), 'LOOK')
    look_tsx.write_text(plain_root.replace("export const Root", "const SIZE = 1080\n\nexport const Root"))
    git_add(look_top)
    checks.append(('a value in that file the sting does not use is no matter: no refusal, the same hash', source_hash(cfg, look_root)[0], plain_digest))
    (look_root / 'global.css').write_text('body { font-family: Archivo; }\n')
    look_tsx.write_text("import './global.css'\n" + plain_root)
    git_add(look_top)
    with_global, listed = source_hash(cfg, look_root)
    checks.append(('a module the registering file imports for its effects is hashed', 'apps/renderer/src/global.css' in listed, True))
    (look_root / 'global.css').write_text('body { font-family: Comic Sans; }\n')
    checks.append(('and a change to it changes the hash', source_hash(cfg, look_root)[0] != with_global, True))

    opening = root / 'opening' / 'Opening.tsx'
    good_opening = opening.read_text()
    (root / 'opening' / 'mark.png').write_bytes(b'\x89PNG\r\n\x1a\n\0\0')
    opening.write_text("import mark from './mark.png'\n" + good_opening)
    refused('a sting file git ignores is refused by name', lambda: source_hash(cfg, root), 'apps/renderer/src/opening/mark.png')
    refused('and the refusal says git ignores it', lambda: source_hash(cfg, root), 'git ignores')
    (root / 'opening' / 'mark.png').unlink()
    (root / 'opening' / 'extra.ts').write_text('export const extra = 1\n')
    opening.write_text("import { extra } from './extra'\n" + good_opening)
    refused('a sting file git does not track is refused by name', lambda: source_hash(cfg, root), 'apps/renderer/src/opening/extra.ts')
    git_add(top)
    checks.append(('once git tracks it, it is hashed', 'apps/renderer/src/opening/extra.ts' in source_hash(cfg, root)[1], True))
    opening.write_text("import { staticFile } from 'remotion'\nconst m = staticFile('mark.svg')\n" + good_opening)
    refused('an asset reached through staticFile() is refused', lambda: source_hash(cfg, root), 'staticFile')
    opening.write_text("import { gone } from './gone'\n" + good_opening)
    refused('an import that is not there is refused by name', lambda: source_hash(cfg, root), "'./gone'")
    opening.write_text(good_opening)
    git_add(top)

    # The gate, per series.
    cache = work / 'cache'
    candidate = work / 'candidate.json'
    candidate.write_text(json.dumps(cfg))
    try:
        render('9x16', cfg, root=root, cache=cache)
        checks.append(('a candidate is refused without --preview', 'rendered', 'refused'))
    except IntroError:
        checks.append(('a candidate is refused without --preview', 'refused', 'refused'))
    got, why = sting_for('9x16', candidate, cache, root)
    checks.append(('make.py gets no sting while it is a candidate', (got, 'candidate' in (why or '')), (None, True)))
    digest, _ = source_hash(cfg, root)
    approved = dict(cfg, status='approved', approved_by='Krish', approved_on='2026-10-12', approval_words='synthetic self-test, not a real approval',
                    source_sha256=digest, last_decision={'on': '2026-10-12', 'by': 'Krish', 'decision': 'approved',
                                                         'words': 'synthetic self-test, not a real approval'})
    good = work / 'approved.json'
    good.write_text(json.dumps(approved))
    unbound = work / 'unbound.json'
    unbound.write_text(json.dumps(dict(approved, source_sha256=None)))
    refused('an approval with no source hash is no approval', lambda: load(unbound), '64-hex source_sha256')
    got, why = sting_for('9x16', unbound, cache, root)
    checks.append(('make.py gets no sting from an approval with no source hash', (got, '64-hex' in (why or '')), (None, True)))
    still_rejected = work / 'contradiction.json'
    still_rejected.write_text(json.dumps(dict(approved, last_decision=cfg['last_decision'])))
    refused('approved over his last word, a rejection, is refused', lambda: load(still_rejected), 'last decision')
    cache.mkdir(parents=True, exist_ok=True)
    for series in SERIES:
        shutil.copyfile(work / 'sting-9x16.mp4', cached('9x16', digest, False, cache, series))
    got, why = sting_for('9x16', good, cache, root, series='mind.the.gap')
    checks.append(('a piece of mind.the.gap gets the mind_the_gap sting', got, cached('9x16', digest, False, cache, 'mind_the_gap')))
    got, why = sting_for('9x16', good, cache, root, series='under_the_hood')
    checks.append(('a piece of under_the_hood gets its own', got, cached('9x16', digest, False, cache, 'under_the_hood')))
    for given in (None, 'built_with_ai'):
        got, why = sting_for('9x16', good, cache, root, series=given)
        checks.append((f'a series of {given!r} falls back to follow_the_money', got, cached('9x16', digest, False, cache, DEFAULT_SERIES)))
    cached('9x16', digest, False, cache, 'under_the_hood').unlink()
    got, why = sting_for('9x16', good, cache, root, render_missing=False, series='under_the_hood')
    checks.append(('a series not rendered here says so, rendering nothing', (got, 'not rendered on this machine' in (why or '')), (None, True)))
    shared.write_text(shared.read_text() + '// a change after approval\n')
    got, why = sting_for('9x16', good, cache, root)
    checks.append(('a sting changed after approval is not used', (got, 'changed' in (why or '')), (None, True)))
    bad = work / 'bad.json'
    bad.write_text(json.dumps(dict(cfg, seconds=2.5)))
    refused('a 2.5 second sting is refused', lambda: load(bad), 'seconds')
    failed = [f'{label}: got {got!r}, want {want!r}' for label, got, want in checks if got != want]
    print('\n'.join(failed) if failed else f'intro self-test passed: {len(checks)} checks')
    return 1 if failed else 0


def main():
    if sys.argv[1:2] == ['--self-test']:
        sys.exit(self_test())
    ap = argparse.ArgumentParser(description='The makeyourmindup intro sting, rendered per shape and series.')
    ap.add_argument('--config', help='default: config/intro-sting.json')
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('status', help='the approval, the source hash and what is rendered')
    p.add_argument('--json', action='store_true')
    p = sub.add_parser('render', help='render the sting for each shape and series')
    p.add_argument('--preview', action='store_true', help='render a candidate to show Krish')
    p.add_argument('--shape', choices=sorted(SHAPES))
    p.add_argument('--series', choices=SERIES, help='one series (default: every series in the config)')
    p.add_argument('--browser', help='the headless browser Remotion uses (default: REMOTION_BROWSER_EXECUTABLE, else the Studio\'s copy)')
    p.add_argument('--entry', help='the Remotion entry point (default: apps/renderer/src/index.ts)')
    p.add_argument('--force', action='store_true', help='render again even if the file is there')
    p = sub.add_parser('approve', help='record Krish\'s approval of the previewed sting, in his words')
    p.add_argument('--words')
    p.add_argument('--by', default='Krish')
    p.add_argument('--on', default=date.today().isoformat())
    a = ap.parse_args()
    try:
        if a.cmd == 'status':
            s = status(a.config)
            if a.json:
                print(json.dumps(s, indent=1))
            else:
                print(f'intro sting: {s["status"]}, {s["seconds"]} s, compositions {s["compositions"]}, series {", ".join(s["series"])}')
                if s['last_decision']:
                    d = s['last_decision']
                    print(f'last decision: {d["decision"]} by {d["by"]} on {d.get("on")}: "{d["words"]}"')
                print(f'registered in the renderer: {s["registered"]}')
                if s['source_problem']:
                    print(f'source: cannot be used: {s["source_problem"]}')
                else:
                    print(f'source: {s["source_sha256"] or "none yet"} ({len(s["source_files"])} files)')
                if s['approved_source_sha256'] and s['approved_source_sha256'] != s['source_sha256']:
                    print('the source has changed since Krish approved it')
                for shape, per in s['renders'].items():
                    for series, r in per.items():
                        print(f'{shape} {series}: approved render {r["approved"] or "none"}; preview {r["preview"] or "none"}')
        elif a.cmd == 'render':
            cfg = load(a.config)
            for shape in [a.shape] if a.shape else list(SHAPES):
                for series in [a.series] if a.series else cfg['series']:
                    out = render(shape, cfg, a.preview, a.browser, a.entry, a.force, series=series)
                    print(f'{shape} {series}: {out}')
        elif a.cmd == 'approve':
            digest = approve(a.config, a.words, a.by, a.on)
            print(f'intro sting approved by {a.by} on {a.on}, source {digest[:16]}')
    except IntroError as e:
        sys.exit(f'intro: {e}')


if __name__ == '__main__':
    main()
