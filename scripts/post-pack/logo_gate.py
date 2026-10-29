#!/usr/bin/env python3
"""The logo-registry gate: official marks only, never redrawn (floor never 6).

Krish, 29 Oct 2026, the floor: "real logos and images with rights, never
redrawn"; and 6 Oct: "Once again don't be afraid to use the real logos for any
companies mentioned." visual_gate.py checks that the companies a piece names
have a logo on its pictures. This gate checks the files themselves: every logo
file a render uses (a cover's or thumbnail's rows and strip, an article
receipt's rows, a card's declared logos) must match, byte for byte by sha256,
a mark in config/logo-registry.json "marks", each the company's full-colour
version or its own one-colour version, with where it came from. A file that
matches none is refused, whatever it looks like: a redrawn or edited mark has
different bytes.

    python logo_gate.py check FILE [FILE ...]            # each file against the registry
    python logo_gate.py facts post.json [--assets DIR]    # every logo file the facts name
    python logo_gate.py register FILE --company NAME --variant full_colour|one_colour --source URL
    python logo_gate.py --self-test
"""
import argparse
import hashlib
import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REGISTRY = ROOT / 'config' / 'logo-registry.json'
VARIANTS = ('full_colour', 'one_colour')


def sha256(path):
    with open(path, 'rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def load(path=REGISTRY):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def marks(path=REGISTRY):
    """sha256 -> mark entry, for the entries that are whole."""
    data = load(path)
    known = {c['names'][0] for c in data.get('companies') or [] if c.get('names')}
    out = {}
    for m in data.get('marks') or []:
        if m.get('company') in known and m.get('variant') in VARIANTS and m.get('sha256') and m.get('source'):
            out[m['sha256']] = m
    return out


def check_files(files, path=REGISTRY):
    """{'status', 'files': [...], 'problems': [...]} for the logo files a render uses."""
    known, rows, problems = marks(path), [], []
    for f in files:
        f = Path(f)
        if not f.is_file():
            problems.append(f'{f}: the logo file is missing')
            rows.append({'file': str(f), 'status': 'missing'})
            continue
        digest = sha256(f)
        m = known.get(digest)
        if m:
            rows.append({'file': str(f), 'sha256': digest, 'status': 'pass', 'company': m['company'], 'variant': m['variant']})
        else:
            problems.append(f'{f.name}: not an official mark in config/logo-registry.json (sha256 {digest[:12]}); use the '
                            "company's own full-colour or one-colour file, never a redrawn or edited one (floor never 6)")
            rows.append({'file': str(f), 'sha256': digest, 'status': 'fail'})
    return {'status': 'fail' if problems else 'pass', 'floor_never': 6, 'blocking': True, 'files': rows, 'problems': problems,
            'line': f'logos: {sum(r["status"] == "pass" for r in rows)} of {len(rows)} files match an official mark (floor never 6)'}


def logo_files(facts, base):
    """Every logo file the page facts name, resolved against base: cover, thumbs and hero receipt rows and strips."""
    base, out = Path(base), []

    def add(item):
        if isinstance(item, dict) and isinstance(item.get('logo'), str) and item['logo']:
            p = Path(item['logo'])
            p = p if p.is_absolute() else base / p
            if p not in out:
                out.append(p)
    for key in ('cover', 'thumbs'):
        block = facts.get(key) or {}
        if isinstance(block, dict):
            for item in (block.get('rows') or []) + (block.get('strip') or []):
                add(item)
    receipt = (facts.get('hero') or {}).get('receipt') or {}
    for item in (receipt.get('rows') or []) + [receipt.get('customer') or {}]:
        add(item)
    for item in facts.get('logo_files') or []:
        add({'logo': item})
    return out


def register(file, company, variant, source, path=REGISTRY):
    """Add one official mark to the registry (a local edit to the repository's config; nothing is fetched)."""
    if variant not in VARIANTS:
        raise ValueError(f'variant is one of {", ".join(VARIANTS)}')
    data = load(path)
    names = [c['names'][0] for c in data.get('companies') or [] if c.get('names')]
    if company not in names:
        raise ValueError(f'{company!r} is not a company in the registry; add it to "companies" first')
    if not source or not str(source).strip():
        raise ValueError('a mark needs its source: the brand page or the Brandfetch asset it came from')
    f = Path(file).resolve()
    try:
        rel = f.relative_to(Path(path).resolve().parents[1]).as_posix()
    except ValueError:
        rel = str(f)
    entry = {'company': company, 'variant': variant, 'file': rel, 'sha256': sha256(f), 'source': source}
    data['marks'] = [m for m in data.get('marks') or [] if m.get('sha256') != entry['sha256']] + [entry]
    Path(path).write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    return entry


def self_test():
    failures = []

    def check(label, got, want):
        print(f'{"ok  " if got == want else "FAIL"} {label}')
        if got != want:
            failures.append(f'{label}: got {got!r}, want {want!r}')
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        reg = tmp / 'config' / 'logo-registry.json'
        reg.parent.mkdir()
        reg.write_text(json.dumps({'companies': [{'names': ['OpenAI'], 'domain': 'openai.com'}], 'marks': []}), encoding='utf-8')
        official = tmp / 'openai.svg'
        official.write_text('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v10z" fill="#000"/></svg>', encoding='utf-8')
        redrawn = tmp / 'openai-redrawn.svg'
        redrawn.write_text('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v9z" fill="#000"/></svg>', encoding='utf-8')
        check('an empty registry refuses every logo file', check_files([official], reg)['status'], 'fail')
        entry = register(official, 'OpenAI', 'full_colour', 'https://openai.com/brand', reg)
        check('a registered mark is stored by its sha256 and path', (entry['sha256'] == sha256(official), entry['file']),
              (True, 'openai.svg'))
        check('the registered file passes', check_files([official], reg)['status'], 'pass')
        check('a redrawn file (different bytes) is refused', check_files([official, redrawn], reg)['problems'][0].startswith('openai-redrawn.svg'), True)
        check('a missing file is refused', check_files([tmp / 'gone.svg'], reg)['status'], 'fail')
        for bad in ({'company': 'Nobody', 'variant': 'full_colour'}, {'company': 'OpenAI', 'variant': 'recoloured'}):
            try:
                register(official, bad['company'], bad['variant'], 'x', reg)
                check(f'register refuses {bad}', 'accepted', 'refused')
            except ValueError:
                check(f'register refuses {bad}', 'refused', 'refused')
        facts = {'cover': {'rows': [{'name': 'OpenAI', 'logo': 'openai.svg'}], 'strip': [{'logo': 'openai-redrawn.svg'}]},
                 'thumbs': {'rows': [{'logo': 'openai.svg'}]}}
        check('the facts name each logo file once', [p.name for p in logo_files(facts, tmp)], ['openai.svg', 'openai-redrawn.svg'])
    check('the repository registry reads', isinstance(marks(), dict), True)
    if failures:
        print('\n'.join(failures))
        return 1
    print('logo gate: all checks pass')
    return 0


def main(argv=None):
    if argv is None:
        argv = sys.argv[1:]
    if argv == ['--self-test']:
        return self_test()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    c = sub.add_parser('check')
    c.add_argument('files', nargs='+')
    f = sub.add_parser('facts')
    f.add_argument('facts')
    f.add_argument('--assets')
    r = sub.add_parser('register')
    r.add_argument('file')
    r.add_argument('--company', required=True)
    r.add_argument('--variant', required=True, choices=VARIANTS)
    r.add_argument('--source', required=True)
    a = ap.parse_args(argv)
    if a.cmd == 'register':
        print(json.dumps(register(a.file, a.company, a.variant, a.source), indent=1))
        return 0
    if a.cmd == 'facts':
        facts = json.loads(Path(a.facts).read_text(encoding='utf-8'))
        files = logo_files(facts, a.assets or Path(a.facts).parent)
    else:
        files = a.files
    result = check_files(files)
    print(json.dumps(result, indent=1))
    return 0 if result['status'] == 'pass' else 2


if __name__ == '__main__':
    raise SystemExit(main())
