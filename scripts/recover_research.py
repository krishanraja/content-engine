#!/usr/bin/env python3
"""Find research a session left on this computer and file it in the piece store, so it reaches the research library.

Krish, 2026-11-11: "Sometimes it's done invisibly by a session and held in scratch, in which case we'll have to go and
hunt them down ... I'm hoping that all historical research is not lost and is recoverable."

Run it once on each home computer, from the content-engine checkout, in a normal terminal (not inside Codex's sandbox,
which cannot read the engine key):

    python scripts/recover_research.py find     # looks, files nothing, writes the list
    python scripts/recover_research.py file     # files every line of the list marked yes
    python scripts/recover_research.py all      # both, one after the other

Where it looks (read only; it never moves, edits or deletes anything it finds):
  - scratch folders: ~/.scratch, the temp folder's claude* scratchpads, and every .scratch folder in the checkouts
    beside this one (and under ~/dev), up to four folders deep;
  - files git does not hold yet in those checkouts (untracked or changed), when they look like research;
  - Claude Code's transcripts (~/.claude/projects/*/*.jsonl, subagents too): every file a session wrote (the Write
    tool, or `cat > file <<EOF` in a shell) and every long report a research subagent handed back;
  - Codex's transcripts (~/.codex/sessions and ~/.codex/archived_sessions): every file a patch added and every
    `cat > file <<EOF` write.
A transcript is never filed whole: only the documents in it (AGENTS.md: exact excerpts, never whole transcripts).

What counts as research: a text file (.md .txt .json .csv .html) of at least 800 characters whose name says so
(research, sources, corpus, dossier, fact check or ledger, deep dive, evidence, findings, notes, interview, teardown,
claims, citations, investigation, lock questions), or a write-up (.md .txt .html) citing at least five web pages. It must belong
to Make Your Mind Up: from a Make Your Mind Up repository or session, or naming the show or one of its three series.
Anything that looks like it holds a key or a password is listed and never filed.

The list is .scratch/research-recovery/found.tsv (in this checkout; .scratch is never committed). Each line says where
the document came from, what it is, where it will be filed and why, with `yes` or `no` in the first column. Change a
`yes` to `no` (or the other way) before `file` to decide by hand. `file` writes each `yes` through the store's own route
(the same one scripts/post-pack/board_session.py uses), with source `backfill`, a key and a note naming the computer, the
path or transcript and the date, onto the piece when the document names one (`piece_id:` near its top, or in its session's
first message), else onto its day (day:<Monday>/<day>) from a date in its path or the day it was written; when the
engine does not know that piece, onto the day it was written. The
store keeps each exact text once: filing the same bytes again adds nothing, so running it twice is safe. Each answer
says whether the research library copied it. The ledger of what happened is .scratch/research-recovery/filed.jsonl.

Before running Claude Code again on a computer, its old transcripts may be cleared on start (Claude Code keeps 30 days
by default, `cleanupPeriodDays` in ~/.claude/settings.json). Run `find` first.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import json
import os
import platform
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.scratch' / 'research-recovery'
TEXT_SUFFIXES = {'.md', '.markdown', '.txt', '.json', '.csv', '.html', '.htm', '.tsv'}
PROSE_SUFFIXES = {'.md', '.markdown', '.txt', '.html', '.htm'}
MIN_CHARS = 800
MAX_BYTES = 2_000_000
DAYS = ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')
DAY_WORDS = {'monday': 'mon', 'tuesday': 'tue', 'wednesday': 'wed', 'thursday': 'thu', 'friday': 'fri', 'saturday': 'sat',
             'sunday': 'sun', **{d: d for d in DAYS}}
RESEARCH_NAME = re.compile(
    r'research|sources?\b|source-|corpus|dossier|fact[-_ ]?(check|ledger|review|sign|run)|(?<![a-z])facts\b|deep[-_ ]?dive|evidence'
    r'|findings|notes?\b|interview|teardown|claims?\b|claim-|citations?|investigat|lock[-_ ]questions?|background'
    r'|perplexity|apify|scrape', re.I)
NOT_RESEARCH = re.compile(r'(^|[\\/])(node_modules|\.git|dist|build|renders?|\.cache|\.next|coverage)([\\/]|$)'
                          r'|package(-lock)?\.json$|tsconfig|\.env|(^|[\\/])(AGENTS|CLAUDE|README|NOW|WORKBENCH|CHANGELOG)\.md$'
                          r'|now-notes', re.I)
OURS = re.compile(r'make\s*your\s*mind\s*up|makeyourmindup|follow\.the\.money|under\.the\.hood|mind\.the\.gap'
                  r'|content-engine|mindmake-studio|inspirationhouse|video-engine', re.I)
SECRET = re.compile(r'sk-ant-[\w-]{20,}|sk-[A-Za-z0-9]{32,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_\w{30,}|AKIA[0-9A-Z]{16}'
                    r'|xox[abpr]-[\w-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY|eyJ[\w-]{20,}\.eyJ[\w-]{20,}\.[\w-]{20,}'
                    r'|AIza[0-9A-Za-z_-]{35}|(?i:password|secret|api[_-]?key|token)\s*[:=]\s*["\']?[^\s"\']{16,}')
URL = re.compile(r'https?://[^\s)\]>"\']+')
PIECE_LINE = re.compile(r'piece_id:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', re.I)
DATE = re.compile(r'(20\d\d)-(\d\d)-(\d\d)')
HEREDOC = re.compile(r"cat\s+>\s*(['\"]?)([^\s'\"<>|;&]+)\1\s*<<-?\s*['\"]?([A-Za-z_]\w*)['\"]?\s*\n(.*?)\n\3\s*(?:\n|$)", re.S)
ADD_FILE = re.compile(r'^\*\*\* Add File: (.+)$', re.M)
COLUMNS = ('file', 'why', 'scope', 'title', 'chars', 'sha256', 'written', 'origin', 'where', 'saved')


# ---- what counts -----------------------------------------------------------------------------------------------------

def judge(name: str, text: str, ours_hint: bool) -> tuple[bool, str]:
    """(file it?, why) for one document."""
    if NOT_RESEARCH.search(name):
        return False, 'not research (build, dependency or settings file)'
    if len(text) < MIN_CHARS:
        return False, f'too short ({len(text)} characters)'
    if len(text.encode('utf-8')) > MAX_BYTES:
        return False, 'over 2 MB of text; file it by hand with board_session.py add'
    if SECRET.search(text):
        return False, 'looks like it holds a key or a password; never filed'
    base = Path(name.replace('\\', '/'))
    if base.suffix.lower() not in TEXT_SUFFIXES:
        return False, f'not a text document ({base.suffix or "no extension"})'
    named = bool(RESEARCH_NAME.search(base.name))
    # Many web pages make a write-up research; a data file (JSON, CSV) only counts by its name.
    cites = len(set(URL.findall(text))) if base.suffix.lower() in PROSE_SUFFIXES else 0
    if not (named or cites >= 5):
        return False, f'does not look like research (name, {cites} web pages cited)'
    if not (ours_hint or OURS.search(name) or OURS.search(text[:20000])):
        return False, 'not clearly Make Your Mind Up (another venture?)'
    return True, ('research by name' if named else f'cites {cites} web pages')


def place(name: str, text: str, written: str, session_piece: str | None) -> str:
    """The scope to file on: a piece id, or day:<Monday>/<day>."""
    if session_piece:
        return session_piece
    m = PIECE_LINE.search(text[:4000])
    if m:
        return m.group(1).lower()
    when = None
    for y, mo, d in DATE.findall(name):
        try:
            when = dt.date(int(y), int(mo), int(d))
        except ValueError:
            continue
    day = None
    for part in re.split(r'[-_.\\/ ]', Path(name.replace('\\', '/')).name.lower() + ' ' + name.lower()):
        if part in DAY_WORDS:
            day = DAY_WORDS[part]
            break
    if when is None:
        when = dt.date.fromisoformat(written[:10])
        day = day or DAYS[when.weekday()]
    monday = when - dt.timedelta(days=when.weekday())
    if day is None:
        # A plan folder named for a week (2026-11-09-week) is the week; a date that is not a Monday is that day.
        day = 'week' if ('-week' in name.lower() and when == monday) else DAYS[when.weekday()]
    return f'day:{monday.isoformat()}/{day}'


# ---- where it looks --------------------------------------------------------------------------------------------------

def iso(ts: float) -> str:
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).isoformat(timespec='seconds')


def walk(root: Path, depth: int):
    try:
        entries = list(os.scandir(root))
    except OSError:
        return
    for e in entries:
        try:
            if e.is_dir(follow_symlinks=False):
                # A checkout inside scratch is code whose history git keeps, and research-recovery is this script's own.
                inner = Path(e.path)
                if depth > 0 and not NOT_RESEARCH.search('/' + e.name + '/') and e.name != 'research-recovery' \
                        and not (inner / '.git').exists():
                    yield from walk(inner, depth - 1)
            elif e.is_file(follow_symlinks=False):
                yield Path(e.path)
        except OSError:
            continue


def scratch_roots(home: Path, checkouts_parent: Path, tmp: Path) -> list[Path]:
    roots = [home / '.scratch']
    roots += sorted(p for p in tmp.glob('claude*') if p.is_dir())
    roots += sorted(p for p in (tmp / 'claude').glob('*') if p.is_dir()) if (tmp / 'claude').is_dir() else []
    for base in {checkouts_parent, home / 'dev'}:
        if base.is_dir():
            roots += [p for p in walk_dirs(base, 4) if p.name == '.scratch']
    seen, out = set(), []
    for r in roots:
        k = str(r.resolve()) if r.exists() else str(r)
        if k not in seen and r.is_dir():
            seen.add(k)
            out.append(r)
    return out


def walk_dirs(root: Path, depth: int):
    try:
        entries = list(os.scandir(root))
    except OSError:
        return
    for e in entries:
        if e.is_dir(follow_symlinks=False) and e.name not in ('node_modules', '.git', '.cache'):
            yield Path(e.path)
            if depth > 0:
                yield from walk_dirs(Path(e.path), depth - 1)


def read_text(p: Path) -> str | None:
    try:
        if p.suffix.lower() not in TEXT_SUFFIXES or p.stat().st_size > MAX_BYTES:
            return None
        return p.read_text(encoding='utf-8')
    except (OSError, UnicodeDecodeError):
        return None


def from_files(roots: list[Path], since: float, origin: str):
    for root in roots:
        for p in walk(root, 6):
            try:
                mtime = p.stat().st_mtime
            except OSError:
                continue
            if mtime < since:
                continue
            text = read_text(p)
            if text is not None:
                yield {'origin': origin, 'where': str(p), 'name': str(p), 'text': text, 'written': iso(mtime),
                       'ours': bool(OURS.search(str(p))), 'piece': None}


def from_git(checkouts_parent: Path, home: Path, since: float):
    """Untracked or changed files in each git checkout beside this one, or under ~/dev."""
    seen = set()
    for base in (checkouts_parent, home / 'dev'):
        for d in ([base] + list(walk_dirs(base, 2))) if base.is_dir() else []:
            if not (d / '.git').exists() or str(d) in seen:
                continue
            seen.add(str(d))
            try:
                out = subprocess.run(['git', '-C', str(d), 'status', '--porcelain', '--untracked-files=all'],
                                     capture_output=True, text=True, timeout=60).stdout
            except (OSError, subprocess.SubprocessError):
                continue
            for line in out.splitlines():
                rel = line[3:].strip().strip('"')
                if ' -> ' in rel:
                    rel = rel.split(' -> ', 1)[1]
                p = d / rel
                if '.scratch' in Path(rel).parts:
                    continue  # the scratch walk covers it
                try:
                    if not p.is_file() or p.stat().st_mtime < since:
                        continue
                except OSError:
                    continue
                text = read_text(p)
                if text is not None:
                    yield {'origin': f'git working tree ({d.name})', 'where': str(p), 'name': str(p), 'text': text,
                           'written': iso(p.stat().st_mtime), 'ours': bool(OURS.search(str(d))), 'piece': None}


def strings(x):
    if isinstance(x, str):
        yield x
    elif isinstance(x, dict):
        for v in x.values():
            yield from strings(v)
    elif isinstance(x, list):
        for v in x:
            yield from strings(v)


def text_of(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return '\n'.join(text_of(c.get('text') if isinstance(c, dict) and 'text' in c else c.get('content') if isinstance(c, dict) else c)
                         for c in content)
    return ''


def claude_transcript(path: Path, since: float):
    """Documents written in one Claude Code transcript (a .jsonl of events)."""
    piece, ours, names = None, bool(OURS.search(str(path))), {}
    try:
        lines = path.read_text(encoding='utf-8', errors='replace').splitlines()
    except OSError:
        return
    for raw in lines:
        try:
            ev = json.loads(raw)
        except ValueError:
            continue
        ts = str(ev.get('timestamp') or '')
        if ev.get('cwd') and OURS.search(str(ev.get('cwd'))):
            ours = True
        msg = ev.get('message') or {}
        content = msg.get('content')
        if ev.get('type') == 'user' and piece is None:
            m = PIECE_LINE.search(text_of(content)[:4000])
            if m:
                piece = m.group(1).lower()
        if not isinstance(content, list):
            continue
        for b in content:
            if not isinstance(b, dict):
                continue
            if b.get('type') == 'tool_use':
                names[b.get('id')] = b.get('name')
                inp = b.get('input') or {}
                if b.get('name') in ('Write', 'create_file') and isinstance(inp.get('content'), str):
                    yield ts, str(inp.get('file_path') or inp.get('path') or 'written.md'), inp['content'], piece, ours
                elif isinstance(inp.get('command'), str) and '<<' in inp['command']:
                    for m in HEREDOC.finditer(inp['command']):
                        yield ts, m.group(2), m.group(4) + '\n', piece, ours
            elif b.get('type') == 'tool_result' and names.get(b.get('tool_use_id')) in ('Agent', 'Task'):
                txt = text_of(b.get('content'))
                if len(txt) >= 3000:
                    yield ts, f'subagent-report-{(b.get("tool_use_id") or "")[-8:]}-research.md', txt, piece, ours


def codex_transcript(path: Path, since: float):
    """Documents written in one Codex rollout (.jsonl): files a patch added, and heredoc writes."""
    piece, ours = None, False
    try:
        lines = path.read_text(encoding='utf-8', errors='replace').splitlines()
    except OSError:
        return
    for raw in lines:
        try:
            ev = json.loads(raw)
        except ValueError:
            continue
        ts = str(ev.get('timestamp') or '')
        for s in strings(ev):
            if not ours and OURS.search(s[:2000]):
                ours = True
            if piece is None:
                m = PIECE_LINE.search(s[:4000])
                if m:
                    piece = m.group(1).lower()
            if '*** Add File:' in s:
                heads = list(ADD_FILE.finditer(s))
                for i, h in enumerate(heads):
                    end = heads[i + 1].start() if i + 1 < len(heads) else len(s)
                    body = s[h.end():end]
                    body = body.split('\n*** ', 1)[0]
                    lines_ = [ln[1:] for ln in body.splitlines() if ln.startswith('+')]
                    if lines_:
                        yield ts, h.group(1).strip(), '\n'.join(lines_) + '\n', piece, ours
            elif 'cat >' in s and '<<' in s:
                for m in HEREDOC.finditer(s):
                    yield ts, m.group(2), m.group(4) + '\n', piece, ours


def from_transcripts(home: Path, since: float):
    sources = [('Claude Code transcript', claude_transcript, sorted((home / '.claude' / 'projects').glob('**/*.jsonl'))),
               ('Codex transcript', codex_transcript, sorted(list((home / '.codex' / 'sessions').glob('**/*.jsonl'))
                                                             + list((home / '.codex' / 'archived_sessions').glob('**/*.jsonl'))))]
    for origin, reader, files in sources:
        for f in files:
            try:
                mtime = f.stat().st_mtime
            except OSError:
                continue
            if mtime < since:
                continue
            for ts, name, text, piece, ours in reader(f, since):
                yield {'origin': origin, 'where': f'{f} -> {name}', 'name': name, 'text': text,
                       'written': ts[:19] or iso(mtime), 'ours': ours, 'piece': piece}


# ---- the two commands ------------------------------------------------------------------------------------------------

def find(args) -> int:
    home = Path(args.home).expanduser() if args.home else Path.home()
    since = dt.datetime.fromisoformat(args.since).replace(tzinfo=dt.timezone.utc).timestamp()
    checkouts = Path(args.checkouts).expanduser() if args.checkouts else ROOT.parent
    tmp = Path(args.tmp).expanduser() if args.tmp else Path(tempfile.gettempdir())
    roots = scratch_roots(home, checkouts, tmp) + [Path(r).expanduser() for r in args.root]
    found = []
    streams = [from_files(roots, since, 'scratch folder'), from_git(checkouts, home, since), from_transcripts(home, since)]
    for stream in streams:
        for d in stream:
            ok, why = judge(d['name'], d['text'], d['ours'])
            sha = hashlib.sha256(d['text'].encode('utf-8')).hexdigest()
            try:
                scope = place(d['name'], d['text'], d['written'] or iso(0), d['piece']) if ok else ''
            except ValueError:
                ok, why, scope = False, 'no date to file it under; file it by hand', ''
            found.append({'file': 'yes' if ok else 'no', 'why': why, 'scope': scope,
                          'title': Path(d['name'].replace('\\', '/')).name[:150], 'chars': len(d['text']), 'sha256': sha,
                          'written': d['written'], 'origin': d['origin'], 'where': d['where'], 'text': d['text']})
    # One line per exact text. Of the places it was found, the line keeps the one to file (yes over no), then the one
    # that names its piece, then the earliest; the rest are counted in its why.
    best = lambda f: (f['file'] != 'yes', f['scope'].startswith('day:') or not f['scope'], f['written'])
    by_sha: dict[str, dict] = {}
    for f in sorted(found, key=best):
        first = by_sha.get(f['sha256'])
        if first is None:
            by_sha[f['sha256']] = f
        else:
            first['also'] = first.get('also', 0) + 1
    rows = sorted(by_sha.values(), key=lambda r: (r['file'] != 'yes', r['written']))
    out = Path(args.out)
    (out / 'texts').mkdir(parents=True, exist_ok=True)
    with open(out / 'found.tsv', 'w', encoding='utf-8', newline='') as fh:
        w = csv.writer(fh, delimiter='\t')
        w.writerow(COLUMNS)
        for r in rows:
            saved = ''
            if r['file'] == 'yes':
                saved = str(out / 'texts' / f"{r['sha256']}.txt")
                Path(saved).write_text(r['text'], encoding='utf-8')
            why = r['why'] + (f" (also found {r['also']} more time(s))" if r.get('also') else '')
            w.writerow([r['file'], why, r['scope'], r['title'], r['chars'], r['sha256'], r['written'], r['origin'],
                        r['where'], saved])
    yes = sum(1 for r in rows if r['file'] == 'yes')
    print(f"Looked in {len(roots)} scratch folder(s), the git checkouts beside this one and the Claude Code and Codex "
          f"transcripts in {home}.")
    print(f"Found {len(rows)} distinct documents; {yes} look like Make Your Mind Up research and are marked yes.")
    print(f"The list: {out / 'found.tsv'}. Change yes or no in its first column, then run: "
          f"python scripts/recover_research.py file")
    return 0


def file_all(args) -> int:
    sys.path.insert(0, str(ROOT / 'scripts'))
    sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
    import board_session  # noqa: E402  (its call() carries the engine key, never printed)
    out = Path(args.out)
    listing = out / 'found.tsv'
    if not listing.is_file():
        print('No list yet: run `python scripts/recover_research.py find` first.')
        return 1
    host = platform.node() or 'this computer'
    done = set()
    ledger_path = out / 'filed.jsonl'
    if ledger_path.is_file():
        for line in ledger_path.read_text(encoding='utf-8').splitlines():
            try:
                rec = json.loads(line)
            except ValueError:
                continue
            if rec.get('ok'):
                done.add(rec.get('sha256'))
    counts = {'filed': 0, 'already': 0, 'skipped': 0, 'failed': 0, 'copied': 0}
    with open(listing, encoding='utf-8', newline='') as fh, open(ledger_path, 'a', encoding='utf-8') as ledger:
        for row in csv.DictReader(fh, delimiter='\t'):
            if (row.get('file') or '').strip().lower() != 'yes':
                counts['skipped'] += 1
                continue
            if row['sha256'] in done:
                counts['already'] += 1
                continue
            text = Path(row['saved']).read_text(encoding='utf-8') if row.get('saved') and Path(row['saved']).is_file() else None
            if text is None or hashlib.sha256(text.encode('utf-8')).hexdigest() != row['sha256']:
                counts['failed'] += 1
                ledger.write(json.dumps({'ok': False, 'sha256': row['sha256'], 'why': 'saved text missing or changed'}) + '\n')
                continue
            scope = row['scope']
            target = {'piece_id': scope} if not scope.startswith('day:') else dict(
                zip(('week', 'day'), scope[4:].split('/', 1)))
            if target.get('day') == 'week':
                target.pop('day')
            body = {**target, 'content': text, 'title': f"{row['written'][:10]} {row['title']}"[:200], 'kind': 'research',
                    'role': 'research', 'source': 'backfill', 'by': args.by,
                    'material_key': f"local:{row['where']}"[:300],
                    'source_ref': f"{host}:{row['where']}"[:500],
                    'note': (f"Recovered by scripts/recover_research.py on {host} from a {row['origin']}: {row['where']}. "
                             f"Written {row['written']}. {row['why']}. Filed exactly as found.")[:2000]}
            if args.dry_run:
                print(f"would file {row['title']} on {scope} ({row['chars']} characters)")
                continue
            status, answer = board_session.call('POST', '/api/content-ideas/store?op=text', body)
            if status in (400, 404) and 'piece_id' in body:
                # A piece the engine does not know: file it on the day it was written instead.
                when = dt.date.fromisoformat(row['written'][:10])
                monday = when - dt.timedelta(days=when.weekday())
                scope = f'day:{monday.isoformat()}/{DAYS[when.weekday()]}'
                body = {**{k: v for k, v in body.items() if k != 'piece_id'}, 'week': monday.isoformat(), 'day': DAYS[when.weekday()]}
                status, answer = board_session.call('POST', '/api/content-ideas/store?op=text', body)
            ok = status in (200, 201) and (answer.get('material') or {}).get('sha256') == row['sha256']
            lib = (answer.get('library') or {}).get('state')
            ledger.write(json.dumps({'ok': ok, 'sha256': row['sha256'], 'scope': scope, 'where': row['where'], 'status': status,
                                     'material': (answer.get('material') or {}).get('id'), 'duplicate': answer.get('duplicate'),
                                     'library': answer.get('library'), 'error': None if ok else answer.get('error')}) + '\n')
            ledger.flush()
            if not ok:
                counts['failed'] += 1
                print(f"Not filed: {row['title']} ({status} {answer.get('error') or ''})")
                continue
            counts['already' if answer.get('duplicate') else 'filed'] += 1
            counts['copied'] += 1 if lib in ('copied', 'already') else 0
    if args.dry_run:
        print(f"Dry run: nothing filed; {counts['skipped']} marked no.")
        return 0
    print(f"Filed {counts['filed']} new, {counts['already']} already on file, {counts['skipped']} marked no, "
          f"{counts['failed']} failed; {counts['copied']} confirmed in the research library (the hourly sweep copies the rest).")
    print(f"What happened to each: {ledger_path}")
    return 0 if counts['failed'] == 0 else 1


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('command', choices=('find', 'file', 'all'))
    p.add_argument('--since', default='2026-06-01', help='only what was written on or after this day (default 2026-06-01)')
    p.add_argument('--root', action='append', default=[], help='another folder to look in (repeatable)')
    p.add_argument('--home', help='another home folder to read (default: yours)')
    p.add_argument('--checkouts', help='the folder holding the checkouts (default: the one holding this checkout)')
    p.add_argument('--tmp', help='the temp folder whose claude* scratchpads to read (default: this computer\'s)')
    p.add_argument('--out', default=str(OUT))
    p.add_argument('--by', default='Claude Code (local recovery)')
    p.add_argument('--dry-run', action='store_true', help='with file: say what would be filed, file nothing')
    args = p.parse_args(argv)
    if args.command in ('find', 'all'):
        find(args)
    if args.command in ('file', 'all'):
        try:
            return file_all(args)
        except Exception as e:  # engine.NoKey / Unreachable say what to do
            print(str(e))
            return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
