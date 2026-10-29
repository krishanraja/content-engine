#!/usr/bin/env python3
"""Thumbnails and covers made overnight, through the logo gate and the visual gate.

Wave 2, W2.5: "Thumbnails and covers made overnight through the visual and
logo gate." The overnight run (W2.6, on a home computer) calls this once per
piece. It makes nothing new of its own and spends nothing: it draws with the
house drawer that already makes them (scripts/pages/build.py --cover --thumbs,
Playwright on the machine's own fonts and the plan's own logo files), and no
paid generation is ever called.

In order, stopping at the first that holds:

  1. the logo gate (logo_gate.py, floor never 6): every logo file the facts
     name matches an official mark in config/logo-registry.json, so nothing
     redrawn reaches a drawer;
  2. the drawer: covers for every place and a thumbnail for every video size,
     with their receipts;
  3. the visual gate (visual_gate.py), when a post.json is given: the logos
     every company the piece names, the house cover and the house thumbnails.

It writes overnight-visuals.json beside the artwork: what was drawn, each
gate's result, and why anything was held. Exit 0 when everything passed, 2
when a gate held it (the morning board shows the reason), 1 on a usage error.

    python overnight_visuals.py FACTS.json --out DIR [--post post.json] [--assets DIR]
"""
import argparse
import datetime as dt
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import logo_gate  # noqa: E402

PY = sys.executable or 'python3'


def draw(facts_path, out, assets=None):
    """The house drawer, as a subprocess so its browser never lives in this one. (ok, output tail)."""
    cmd = [PY, str(ROOT / 'scripts/pages/build.py'), str(facts_path), '--cover', '--thumbs', '--out', str(out)]
    if assets:
        cmd += ['--assets', str(assets)]
    run = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
    return run.returncode == 0, (run.stdout + run.stderr)[-3000:]


def visual(post_path):
    run = subprocess.run([PY, str(HERE / 'visual_gate.py'), str(post_path)], cwd=ROOT, capture_output=True, text=True,
                         encoding='utf-8')
    return run.returncode == 0, (run.stdout + run.stderr)[-3000:]


def made(out):
    names = ['cover.png', 'cover-1200x630.png', 'cover-1200x675.png', 'cover-1080x1080.png', 'cover-1080x1920.png',
             'thumb-wide-1280x720.jpg', 'thumb-tall-1080x1920.jpg', 'thumbs.json', 'cover.json']
    return [n for n in names if (Path(out) / n).is_file()]


def run(facts_path, out, post=None, assets=None, drawer=draw, gate=visual, registry=logo_gate.REGISTRY):
    facts_path, out = Path(facts_path), Path(out)
    facts = json.loads(facts_path.read_text(encoding='utf-8-sig'))
    base = Path(assets) if assets else facts_path.resolve().parent
    out.mkdir(parents=True, exist_ok=True)
    report = {'facts': str(facts_path), 'started_at': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
              'paid_generation': False, 'drawer': 'scripts/pages/build.py --cover --thumbs'}
    logos = logo_gate.check_files(logo_gate.logo_files(facts, base), registry)
    report['logo_gate'] = logos
    if logos['status'] != 'pass':
        report.update(status='held', held_by='logo_gate', reason='; '.join(logos['problems']))
    else:
        ok, tail = drawer(facts_path, out, assets)
        report['drawn'] = made(out)
        report['drawer_output'] = tail
        if not ok:
            report.update(status='held', held_by='drawer', reason='the drawer refused: see drawer_output')
        elif post:
            ok, tail = gate(post)
            report['visual_gate'] = {'status': 'pass' if ok else 'fail', 'output': tail}
            report.update(status='made' if ok else 'held', **({} if ok else {'held_by': 'visual_gate',
                                                                              'reason': 'the visual gate did not pass'}))
        else:
            report['visual_gate'] = {'status': 'not_run', 'reason': 'no post.json given; the pack runs it again'}
            report['status'] = 'made'
    report['finished_at'] = dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')
    (out / 'overnight-visuals.json').write_text(json.dumps(report, indent=1) + '\n', encoding='utf-8')
    return report


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('facts')
    ap.add_argument('--out', required=True)
    ap.add_argument('--post')
    ap.add_argument('--assets')
    a = ap.parse_args(argv)
    report = run(a.facts, a.out, a.post, a.assets)
    print(json.dumps({k: report[k] for k in ('status', 'held_by', 'reason', 'drawn') if k in report}, indent=1))
    return 0 if report['status'] == 'made' else 2


if __name__ == '__main__':
    raise SystemExit(main())
