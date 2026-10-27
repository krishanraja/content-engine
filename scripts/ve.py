#!/usr/bin/env python3
"""ve: the spec-driven video engine's command line (docs/ve/ENGINE.md).

  python scripts/ve.py doctor
  python scripts/ve.py start <piece>                 write the session pack
  python scripts/ve.py lint <spec.json>              schema + crew lints (blocks a render)
  python scripts/ve.py qc <cut.mp4> --format <id> [--out qc.json]
  python scripts/ve.py study <reference.mp4>         grammar card: cuts, change density, stills, loops
  python scripts/ve.py card <card.json>              write a Codex task card from its fields
  python scripts/ve.py dispatch <card.md> [--wait]   send it to Codex (pinned model and effort)
  python scripts/ve.py verify-card <card.md> --cwd <worktree>
  python scripts/ve.py status <piece>                readiness, computed; nobody writes a pass
  python scripts/ve.py coverage                      failure register: behavioural guards vs markers

ingest, compile, render, stills, ledger and file arrive with the Phase 1 cards; until then they say so.
ve has no publish, send or schedule verb."""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from velib.common import CONFIG, ROOT, load_json, piece_dir, run, write_json  # noqa: E402

PACK_LIMIT = 36 * 1024


def cmd_doctor(_args) -> int:
    rows: list[tuple[str, str, str]] = []

    def check(name, ok, detail, hard=True):
        rows.append(('PASS' if ok else ('FAIL' if hard else 'WARN'), name, detail))

    exe = shutil.which('ffmpeg')
    version = subprocess.run([exe, '-version'], capture_output=True, text=True).stdout.split('\n')[0] if exe else ''
    check('ffmpeg', bool(exe), version or 'not on PATH')
    if exe:
        fps_mode = subprocess.run([exe, '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=d=0.1:s=32x32', '-fps_mode', 'passthrough',
                                   '-frames:v', '1', '-f', 'null', '-'], capture_output=True).returncode == 0
        check('ffmpeg -fps_mode', fps_mode, 'used instead of the removed -vsync')
    node = shutil.which('node')
    check('node', bool(node), subprocess.run([node, '--version'], capture_output=True, text=True).stdout.strip() if node else 'missing')
    check('remotion', (ROOT / 'node_modules' / 'remotion' / 'package.json').exists(), 'node_modules/remotion')
    check('house fonts', (ROOT / 'node_modules' / '@fontsource' / 'anton').exists(), '@fontsource/anton and friends')
    try:
        import numpy  # noqa: F401
        check('numpy', True, numpy.__version__)
    except ImportError:
        check('numpy', False, 'pip install numpy')
    try:
        import faster_whisper  # noqa: F401
        check('faster-whisper', True, 'first aligner')
    except ImportError:
        check('faster-whisper', False, 'needed by ve ingest', hard=False)
    codex = shutil.which('codex')
    login = subprocess.run([codex, 'login', 'status'], capture_output=True, text=True) if codex else None
    status = (login.stdout + login.stderr).strip() if login else ''
    check('codex login', 'ChatGPT' in status, status or 'codex CLI missing: Codex cards cannot run', hard=False)
    from velib.cards import allowance, companion
    import time
    try:
        check('codex plugin companion', True, companion())
    except SystemExit as error:
        check('codex plugin companion', False, str(error), hard=False)
    info = allowance()
    if info:
        days = (info['resets_at'] - time.time()) / 86400 if info['resets_at'] else None
        detail = f"{info['used_percent']:.0f}% of the week used" + (f", resets in {days:.1f} days" if days and days > 0 else '') +                  (f"; above 80% Codex draws paid credits (balance {info['credits']:,.0f}), so cards need Krish's spend approval" if info['used_percent'] > 80 else '')
        check('codex weekly allowance', info['used_percent'] <= 80, detail, hard=False)
    else:
        check('codex weekly allowance', True, 'unknown (no Codex session log yet)', hard=False)
    tools = load_json(CONFIG / 'tools.json')['tools']
    mcp = sorted(k for k, v in tools.items() if 'MCP' in v.get('route', ''))
    rows.append(('INFO', 'connectors', 'Claude: probe these with ToolSearch for this account and record gaps: ' + ', '.join(mcp)))
    for row in rows:
        print(f'{row[0]:5} {row[1]:24} {row[2]}')
    return 1 if any(r[0] == 'FAIL' for r in rows) else 0


def spec_path_for(piece: str) -> Path:
    folder = piece_dir(piece)
    for name in ('ve/spec.json', 'creative-direction.json'):
        if (folder / name).exists():
            return folder / name
    sys.exit(f've: no spec in {folder} (expected ve/spec.json or creative-direction.json with schema_version 2)')


def cmd_lint(args) -> int:
    from velib.lint import lint
    spec, problems = lint(Path(args.spec))
    for line in problems[:20]:
        print(line)
    if len(problems) > 20:
        print(f'... and {len(problems) - 20} more')
    if not problems:
        print(f've lint: clean ({spec["format"]}, {len(spec["cuts"])} cut(s))')
    return 1 if problems else 0


def cmd_start(args) -> int:
    from velib.lint import lint
    spec_file = spec_path_for(args.piece)
    spec, problems = lint(spec_file)
    fmt_id = spec['format'] if spec else json.loads(spec_file.read_text(encoding='utf-8')).get('format', 'face-with-proof')
    fmt = load_json(CONFIG / 'formats' / f'{fmt_id}.json')
    parts = [(ROOT / 'docs' / 've' / 'ENGINE.md').read_text(encoding='utf-8'),
             f"# Format: {fmt_id} ({fmt['status']})\n\n{fmt['purpose']}\n\nLayers: {' > '.join(fmt['layers'])}\n\n"
             f"Layouts: {', '.join(fmt['layouts'])}. Devices allowed: {', '.join(fmt['devices'])}.\n\nHard QC: {json.dumps(fmt['qc'])}\n"]
    for member in fmt['crew'] + ['critic']:
        parts.append((CONFIG / 'crew' / f'{member}.card.md').read_text(encoding='utf-8'))
    approvals = {a['gate'] for a in spec['approvals']} if spec else set()
    parts.append('# Open lint findings\n\n' + ('\n'.join(problems[:20]) or 'none') +
                 f"\n\n# Gates\n\nApproved: {', '.join(sorted(approvals)) or 'none yet'}\n")
    pack = '\n\n---\n\n'.join(parts)
    if len(pack.encode('utf-8')) > PACK_LIMIT:
        sys.exit(f've start: the session pack is {len(pack.encode())} bytes, over the {PACK_LIMIT} cap; trim cards, not the cap')
    out = spec_file.parent / ('session-pack.md' if spec_file.parent.name == 've' else 've/session-pack.md')
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(pack, encoding='utf-8')
    print(f've start: wrote {out.relative_to(ROOT)} ({len(pack.encode()) // 1024} KB, crew: {", ".join(fmt["crew"])})')
    return 0


def cmd_qc(args) -> int:
    from velib.qc import run_qc
    report = run_qc(args.cut, args.format)
    out = Path(args.out) if args.out else Path(args.cut).with_suffix('.qc.json')
    write_json(out, report)
    for name, check in report['checks'].items():
        state = check.get('status') or ('pass' if check['pass'] else 'FAIL')
        print(f"{state:8} {name:24} {json.dumps(check['value'])[:80]}  target {check['target']}")
    print(f"ve qc: {'measured checks pass' if report['measured_pass'] else 'FAILS'}; {'complete' if report['complete'] else 'incomplete (not_run checks)'} -> {out}")
    return 0 if report['measured_pass'] else 1


def cmd_study(args) -> int:
    from velib.qc import duration_s, frame_diffs, motion
    from velib.common import ffmpeg
    text = subprocess.run([ffmpeg(), '-hide_banner', '-nostats', '-i', args.ref, '-vf', 'scdet=threshold=5,metadata=print', '-f', 'null', '-'],
                          capture_output=True, text=True, errors='replace').stderr
    cuts = [round(float(t), 2) for t in re.findall(r'lavfi\.scd\.time: ([\d.]+)', text)]
    move = motion(frame_diffs(args.ref))
    length = duration_s(args.ref)
    card = {'reference': args.ref, 'duration_s': round(length, 2), 'cuts': cuts,
            'cuts_per_minute': round(len(cuts) / (length / 60), 1) if length else 0, **move}
    out = Path(args.out) if args.out else Path(args.ref).with_suffix('.grammar.json')
    write_json(out, card)
    print(f"ve study: {card['cuts_per_minute']} cuts/min, picture changes in {move['change_density'] * 100:.0f}% of seconds, "
          f"longest still {move['longest_still_s']} s, loop {move['loop_period_s']} -> {out}")
    return 0


def cmd_card(args) -> int:
    from velib.cards import write_card
    fields = load_json(args.fields)
    out = Path(fields.pop('path'))
    print(f've card: wrote {write_card(out, **fields)}')
    return 0


def cmd_dispatch(args) -> int:
    from velib.cards import dispatch
    result = dispatch(Path(args.card), background=not args.wait)
    print((result.stdout or result.stderr).strip()[-2000:])
    return result.returncode


def cmd_verify_card(args) -> int:
    from velib.cards import verify
    problems = verify(Path(args.card), Path(args.cwd))
    for problem in problems:
        print(problem)
    print('ve verify-card: ' + ('passes; now render its golden stills and look at them' if not problems else f'{len(problems)} problem(s)'))
    return 1 if problems else 0


def cmd_status(args) -> int:
    from velib.common import sha256_file
    from velib.lint import lint
    spec_file = spec_path_for(args.piece)
    spec, problems = lint(spec_file)
    if spec is None:
        print('NOT READY: the spec does not pass its schema')
        return 1
    ve_dir = spec_file.parent if spec_file.parent.name == 've' else spec_file.parent / 've'
    finals = {a['artifact_hash']: a for a in spec['approvals'] if a['gate'] == 'final'}
    ready = not problems
    print(f"lint: {'clean' if not problems else f'{len(problems)} finding(s)'}")
    for cut in spec['cuts']:
        qc_file, verdict_file = ve_dir / f'qc.{cut}.json', ve_dir / f'verdict.{cut}.json'
        reasons = []
        if not qc_file.exists():
            reasons.append('no qc')
        else:
            qc = load_json(qc_file)
            if not Path(qc['file']).exists() or sha256_file(qc['file']) != qc['sha256']:
                reasons.append('qc is for a different file')
            if not qc['measured_pass']:
                reasons.append('measured checks fail')
            if not qc['complete']:
                reasons.append('qc incomplete')
            if qc['sha256'] not in finals:
                reasons.append("no final approval from Krish for this file")
        if not verdict_file.exists():
            reasons.append('no Critic verdict')
        elif load_json(verdict_file).get('blocking'):
            reasons.append('Critic blocks')
        print(f"{cut}: {'READY' if not reasons else 'NOT READY (' + '; '.join(reasons) + ')'}")
        ready = ready and not reasons
    return 0 if ready else 1


def cmd_coverage(_args) -> int:
    register = load_json(ROOT / 'config' / 'failures.json')['failures']
    behavioural = marker = planned = none = 0
    for entry in register:
        guards = entry.get('guards') or []
        if any(g.get('test') or g.get('run') for g in guards):
            behavioural += 1
        elif guards:
            marker += 1
        elif entry.get('planned_mechanism') or entry.get('mechanism'):
            planned += 1
        else:
            none += 1
    total = len(register)
    print(f've coverage: {total} failures; behavioural {behavioural}, marker-only {marker} (scores 0), planned {planned}, none {none}')
    print(f'score: {behavioural}/{total} prevented by a mechanism with a passing test')
    return 0


def not_yet(name: str):
    def handler(_args) -> int:
        print(f've {name}: not built yet. It arrives with the Phase 1 cards (docs/ve/ENGINE.md). Use quick-edit until then.')
        return 2
    return handler


def main() -> int:
    parser = argparse.ArgumentParser(prog='ve', description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='cmd', required=True)
    sub.add_parser('doctor').set_defaults(fn=cmd_doctor)
    p = sub.add_parser('start'); p.add_argument('piece'); p.set_defaults(fn=cmd_start)
    p = sub.add_parser('lint'); p.add_argument('spec'); p.set_defaults(fn=cmd_lint)
    p = sub.add_parser('qc'); p.add_argument('cut'); p.add_argument('--format', required=True); p.add_argument('--out'); p.set_defaults(fn=cmd_qc)
    p = sub.add_parser('study'); p.add_argument('ref'); p.add_argument('--out'); p.set_defaults(fn=cmd_study)
    p = sub.add_parser('card'); p.add_argument('fields'); p.set_defaults(fn=cmd_card)
    p = sub.add_parser('dispatch'); p.add_argument('card'); p.add_argument('--wait', action='store_true'); p.set_defaults(fn=cmd_dispatch)
    p = sub.add_parser('verify-card'); p.add_argument('card'); p.add_argument('--cwd', required=True); p.set_defaults(fn=cmd_verify_card)
    p = sub.add_parser('status'); p.add_argument('piece'); p.set_defaults(fn=cmd_status)
    sub.add_parser('coverage').set_defaults(fn=cmd_coverage)
    for name in ('ingest', 'compile', 'render', 'stills', 'ledger', 'file'):
        p = sub.add_parser(name); p.add_argument('rest', nargs='*'); p.set_defaults(fn=not_yet(name))
    args = parser.parse_args()
    return args.fn(args)


if __name__ == '__main__':
    sys.exit(main())
