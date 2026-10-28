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

  python scripts/ve.py ledger <piece>               usage against the piece's caps
  python scripts/ve.py time <piece> start <phase>    time an engine phase (stop/status available)

ingest, stills and file arrive with the Phase 1 cards; until then they say so.
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

    from velib import designlock
    try:
        findings = designlock.validate(designlock.load())
        check('design lock', not findings, '; '.join(findings) or 'valid')
    except (OSError, ValueError, KeyError, TypeError) as error:
        check('design lock', False, str(error))

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
    from velib import fonts
    fonts_ok, font_lines = fonts.check()
    check('brand fonts', fonts_ok, '; '.join(font_lines))
    try:
        kit = load_json(fonts.MANIFEST).get('source')
        check('Drive font kit', bool(kit) and Path(kit).is_dir(), kit or 'source is absent from font manifest', hard=False)
    except (OSError, ValueError, TypeError) as error:
        check('Drive font kit', False, str(error), hard=False)
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


def cmd_lock(args) -> int:
    from velib import designlock
    try:
        lock = designlock.load()
        if args.action == 'show':
            print(json.dumps(lock['formats'][args.format] if args.format else lock, indent=2))
        elif args.action == 'check':
            findings = designlock.validate(lock)
            if findings:
                print('\n'.join(findings))
                return 1
            print('design lock: valid')
            for fmt in lock['formats']:
                ok, reasons = designlock.frozen(lock, fmt)
                print(f'{fmt}: ' + ('frozen' if ok else 'not frozen: ' + '; '.join(reasons)))
        else:
            if args.mapping is None:
                mapping = {beat: f'f{i}.png' for i, beat in enumerate(lock['formats'][args.format]['beats'], 1)}
            else:
                mapping = {}
                for item in args.mapping:
                    beat, sep, filename = item.partition('=')
                    if not sep or not filename or beat in mapping:
                        raise ValueError(f'invalid or duplicate --map entry: {item}')
                    mapping[beat] = filename
            designlock.freeze(args.format, args.src_dir, mapping, force=args.force)
            print(f'design lock: frozen {args.format}')
        return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f've lock: {error}', file=sys.stderr)
        return 1


def cmd_fonts(args) -> int:
    from velib import fonts
    try:
        if args.action == 'check':
            ok, lines = fonts.check()
            print('\n'.join(lines))
            return 0 if ok else 1
        if args.action == 'css':
            print(fonts.css(args.rel), end='')
            return 0
        source = args.kit_dir or load_json(fonts.MANIFEST).get('source')
        if not source:
            print('ve fonts sync: source is absent from font manifest; supply --from', file=sys.stderr)
            return 1
        print('\n'.join(fonts.sync(source, update_manifest=args.update_manifest)))
        return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f've fonts: {error}', file=sys.stderr)
        return 1


def spec_path_for(piece: str) -> Path:
    folder = piece_dir(piece)
    for name in ('ve/spec.json', 'creative-direction.json'):
        if (folder / name).exists():
            return folder / name
    sys.exit(f've: no spec in {folder} (expected ve/spec.json or creative-direction.json with schema_version 2)')


def cmd_lint(args) -> int:
    from velib.lint import lint
    spec, problems = lint(Path(args.spec))
    if spec is not None:
        from velib import designlock
        if spec['format'] not in designlock.load()['formats']:
            print(f'note: format {spec["format"]} is legacy: composition and design approval are enforced at packet time')
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
    from velib.qc import inputs_from_props, run_qc
    props = load_json(args.props) if getattr(args, 'props', None) else None
    inputs = inputs_from_props(props) if props is not None else {}
    if props is not None and props.get('aspect') == '9:16':
        inputs['composition_props'] = props
    report = run_qc(args.cut, args.format, **inputs)
    out = Path(args.out) if args.out else Path(args.cut).with_suffix('.qc.json')
    write_json(out, report)
    for name, check in report['checks'].items():
        state = check.get('status') or ('pass' if check['pass'] else 'FAIL')
        print(f"{state:8} {name:24} {json.dumps(check['value'])[:80]}  target {check['target']}")
    print(f"ve qc: {'measured checks pass' if report['measured_pass'] else 'FAILS'}; {'complete' if report['complete'] else 'incomplete (not_run checks)'} -> {out}")
    return 0 if report['measured_pass'] else 1


def cmd_comp(args) -> int:
    from velib import designlock, qc_composition
    lock = designlock.load()
    reports = {}
    for filename in args.images:
        try:
            boxes = [tuple(int(v) for v in box.split(',')) for box in (args.exempt or [])]
            reports[filename] = qc_composition.measure(filename, lock, plate_on_screen=args.plate, exempt=boxes)
        except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError) as error:
            reports[filename] = {'pass': False, 'checks': {}, 'findings': [str(error)]}
    if args.json:
        print(json.dumps(reports, indent=2))
    else:
        for filename, report in reports.items():
            print(f"{'PASS' if report['pass'] else 'FAIL'} {filename}")
            for finding in report['findings']:
                print(f'  {finding}')
    return 0 if all(report['pass'] for report in reports.values()) else 1


def cmd_keyframes(args) -> int:
    from velib import designlock, qc_keyframes
    try:
        lock, props = designlock.load(), load_json(args.props)
        report = qc_keyframes.keyframe_checks(args.video, props, lock, args.format)
        if not report['applies']:
            print(report['note'])
            return 0
        for name, row in report['beats'].items():
            score = f'{row["ssim"]:.4f}' if row['ssim'] is not None else 'unavailable'
            print(f'{name} ssim {score} min {row["min"]:.2f} {"pass" if row["pass"] else "FAIL"}')
        for finding in report['findings']:
            print(finding)
        if args.sheet:
            qc_keyframes.sheet(args.video, props, lock, args.format, args.sheet)
        return 0 if report['pass'] else 1
    except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError) as error:
        print(f've keyframes: {error}', file=sys.stderr)
        return 1


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
    if getattr(args, 'piece', None):
        from velib.ledger import require_within
        require_within(args.piece)
    from velib.cards import dispatch
    result = dispatch(Path(args.card), background=not args.wait, spend_approved=args.spend_approved)
    print((result.stdout or result.stderr).strip()[-2000:])
    return result.returncode


def cmd_verify_card(args) -> int:
    from velib.cards import verify
    problems = verify(Path(args.card), Path(args.cwd))
    for problem in problems:
        print(problem)
    print('ve verify-card: ' + ('passes; now render its golden stills and look at them' if not problems else f'{len(problems)} problem(s)'))
    return 1 if problems else 0


def cmd_verdict(args) -> int:
    from velib import verdict
    try:
        spec_file = spec_path_for(args.piece)
        spec = load_json(spec_file)
        findings = load_json(args.findings)
        if not isinstance(findings, list):
            raise ValueError('findings file must hold a list')
        viewed = [float(s) for s in args.viewed.split(',') if s.strip()]
        path = verdict.write(spec, args.cut, verdict.ve_dir(spec_file), args.reviewer, findings, viewed)
        print(f've verdict: {path}')
        return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f've verdict: {error}')
        return 1


def cmd_packet(args) -> int:
    from velib import packet, verdict
    try:
        spec_file = spec_path_for(args.piece)
        spec = load_json(spec_file)
        directory = verdict.ve_dir(spec_file)
        for cut in args.legacy_ok:
            if spec['format'] not in packet.designlock.load()['formats']:
                print(f'{cut}: LEGACY: no design lock')
        out = packet.assemble(spec, directory, args.out or directory / 'packet', args.legacy_ok)
        print(f've packet: {out}')
        return 0
    except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError) as error:
        print(f've packet: {error}')
        return 1


def cmd_status(args) -> int:
    from velib import packet, verdict
    from velib.lint import lint
    spec_file = spec_path_for(args.piece)
    spec, problems = lint(spec_file)
    if spec is None:
        print('NOT READY: the spec does not pass its schema')
        return 1
    directory = verdict.ve_dir(spec_file)
    ready = not problems
    print(f"lint: {'clean' if not problems else f'{len(problems)} finding(s)'}")
    for cut in spec['cuts']:
        try:
            mechanical, qc, video, digest = packet.mechanical(spec, cut, directory)
            compile_file = directory / f'compile.{cut}.json'
            if compile_file.exists() and load_json(compile_file).get('sfx_missing') and 'sfx kit missing' not in mechanical:
                mechanical.append('sfx kit missing')
            design = packet.design(spec, cut, directory, digest)
            final = [] if digest and any(a.get('gate') == 'final' and a.get('by') == 'Krish'
                                         and a.get('artifact_hash') == digest for a in spec.get('approvals', [])) else [
                                             'no final approval from Krish for this file']
        except (OSError, ValueError, KeyError, TypeError) as error:
            mechanical, design, final = [str(error)], ['design could not be checked'], []
        print(f'{cut}:')
        print('  mechanical: ' + ('INVALID (' + '; '.join(mechanical) + ')' if mechanical else 'VALID'))
        print('  design: ' + ('NOT APPROVED (' + '; '.join(design) + ')' if design else 'APPROVED'))
        reasons = mechanical + design + final
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


def _usage_number(value):
    return f'{value / 1000000:.1f}M' if abs(value) >= 1000000 else f'{value:g}'


def _ledger_report(piece) -> int:
    from velib import ledger
    usage, limits = ledger.totals(piece), ledger.budget()
    values = ledger.measures(usage)
    for key, label, cap_key in ledger.MEASURES:
        amount, cap = values[key], limits[cap_key]
        print(f'{label} {_usage_number(amount)} / {_usage_number(cap)} ({amount / cap:.0%})')
    print(f'credits {usage["credits"]:g}')
    print(f'Krish-wait minutes {usage["krish_wait_seconds"] / 60:g}')
    ok, lines = ledger._check(usage, limits)
    for line in lines:
        print(line)
    return 0 if ok else 1


def cmd_ledger(args) -> int:
    from velib import ledger
    try:
        if getattr(args, 'action', None) == 'add':
            ledger.add(args.piece, args.kind, args.amount, args.note)
        return _ledger_report(args.piece)
    except (ValueError, OSError) as error:
        print(f've ledger: {error}', file=sys.stderr)
        return 1


def cmd_time(args) -> int:
    from velib import ledger
    try:
        if args.action == 'start':
            ledger.start_clock(args.piece, args.phase)
            print(f've time: started phase {args.phase!r}')
        elif args.action == 'stop':
            seconds = ledger.stop_clock(args.piece)
            print(f've time: recorded {seconds} engine seconds')
            return _ledger_report(args.piece)
        running = ledger.clock_status(args.piece)
        seconds = ledger.totals(args.piece)['engine_seconds']
        if running:
            seconds += ledger.elapsed_seconds(running)
        cap = ledger.budget()['engine_minutes_cap']
        print(f'phase {running["phase"]!r}' if running else 'no running phase')
        print(f'engine minutes {seconds / 60:g} / {cap:g} ({seconds / 60 / cap:.0%})')
        return 1 if seconds / 60 > cap else 0
    except (ValueError, OSError) as error:
        print(f've time: {error}', file=sys.stderr)
        return 1


def cmd_compile(args) -> int:
    from velib.lint import lint
    spec, problems = lint(Path(args.spec))
    if problems or spec is None:
        for problem in problems:
            print(problem)
        return 1
    from velib.compile import compile_cut
    from velib.common import sha256_file
    words = load_json(args.words)
    if isinstance(words, dict):
        words = words['words']
    report = {}
    props = compile_cut(spec, args.cut, words, args.assets_dir, report=report)
    # The piece id is a directory name, never an arbitrary output path.
    piece = spec['piece_id']
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_-]*', piece):
        raise ValueError('piece_id must be a safe plan folder name')
    if not re.fullmatch(r'[a-z0-9][a-z0-9_-]{0,63}', args.cut):
        raise ValueError('cut id must be a slug')
    out = ROOT / 'docs' / 'plans' / piece / 've' / f'props.{args.cut}.json'
    write_json(out, props)
    report['props_sha256'] = sha256_file(out)
    write_json(out.with_name(f'compile.{args.cut}.json'), report)
    for event_id in report['sfx_missing']:
        print(f'sfx missing: {event_id}')
    print(f'{report["props_sha256"]}  {out}')
    return 0


def cmd_render(args) -> int:
    from velib.lint import lint
    spec, problems = lint(Path(args.spec))
    if problems or spec is None:
        for problem in problems:
            print(problem)
        return 1
    from velib.render import check_asset_hashes, render
    check_asset_hashes(spec, args.assets_dir)
    render(args.props, args.out, args.scale)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog='ve', description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='cmd', required=True)
    sub.add_parser('doctor').set_defaults(fn=cmd_doctor)
    p = sub.add_parser('comp', help='measure still composition against the tall design lock')
    p.add_argument('images', nargs='+'); p.add_argument('--plate', action='store_true')
    p.add_argument('--exempt', action='append', metavar='X,Y,W,H', help='real footage box whose text is evidence, never retyped')
    p.add_argument('--json', action='store_true'); p.set_defaults(fn=cmd_comp)
    p = sub.add_parser('lock', help='check, show or freeze approved format designs')
    actions = p.add_subparsers(dest='action', required=True)
    actions.add_parser('check')
    a = actions.add_parser('show'); a.add_argument('format', nargs='?')
    a = actions.add_parser('freeze'); a.add_argument('format'); a.add_argument('--from', dest='src_dir', required=True)
    a.add_argument('--map', dest='mapping', nargs='+', action='extend'); a.add_argument('--force', action='store_true')
    p.set_defaults(fn=cmd_lock)
    p = sub.add_parser('fonts', help='check, declare or sync the offline brand font kit')
    actions = p.add_subparsers(dest='action', required=True)
    actions.add_parser('check')
    a = actions.add_parser('css'); a.add_argument('--rel', default='assets/fonts/makeyourmindup')
    a = actions.add_parser('sync'); a.add_argument('--from', dest='kit_dir')
    a.add_argument('--update-manifest', action='store_true')
    p.set_defaults(fn=cmd_fonts)
    p = sub.add_parser('start'); p.add_argument('piece'); p.set_defaults(fn=cmd_start)
    p = sub.add_parser('lint'); p.add_argument('spec'); p.set_defaults(fn=cmd_lint)
    p = sub.add_parser('qc'); p.add_argument('cut'); p.add_argument('--format', required=True); p.add_argument('--out'); p.add_argument('--props'); p.set_defaults(fn=cmd_qc)
    p = sub.add_parser('keyframes', help='compare rendered beats with approved stills')
    p.add_argument('format'); p.add_argument('video'); p.add_argument('props'); p.add_argument('--sheet')
    p.set_defaults(fn=cmd_keyframes)
    p = sub.add_parser('study'); p.add_argument('ref'); p.add_argument('--out'); p.set_defaults(fn=cmd_study)
    p = sub.add_parser('card'); p.add_argument('fields'); p.set_defaults(fn=cmd_card)
    p = sub.add_parser('dispatch'); p.add_argument('card'); p.add_argument('--wait', action='store_true')
    p.add_argument('--piece', help='refuse dispatch when this piece is over any budget cap')
    p.add_argument('--spend-approved', action='store_true', help="only after Krish's yes, in his words, to Codex drawing paid credits")
    p.set_defaults(fn=cmd_dispatch)
    p = sub.add_parser('verify-card'); p.add_argument('card'); p.add_argument('--cwd', required=True); p.set_defaults(fn=cmd_verify_card)
    p = sub.add_parser('status'); p.add_argument('piece'); p.set_defaults(fn=cmd_status)
    p = sub.add_parser('verdict', help='record a hash-bound independent Critic review')
    actions = p.add_subparsers(dest='action', required=True)
    a = actions.add_parser('write'); a.add_argument('piece'); a.add_argument('cut')
    a.add_argument('--reviewer', required=True); a.add_argument('--findings', required=True)
    a.add_argument('--viewed', default='', help='comma-separated viewed frame times in seconds')
    a.set_defaults(fn=cmd_verdict)
    p = sub.add_parser('packet', help='assemble measured and judged cuts for approval')
    p.add_argument('piece'); p.add_argument('--out')
    p.add_argument('--legacy-ok', action='append', default=[], metavar='CUT',
                   help='explicitly identify a legacy cut; QC and Critic remain mandatory')
    p.set_defaults(fn=cmd_packet)
    sub.add_parser('coverage').set_defaults(fn=cmd_coverage)
    p = sub.add_parser('compile', help='compile a linted spec and cut-ready word timings')
    p.add_argument('spec'); p.add_argument('--cut', required=True); p.add_argument('--words', required=True)
    p.add_argument('--assets-dir', required=True); p.set_defaults(fn=cmd_compile)
    p = sub.add_parser('render', help='render compiled props through FormatMaster')
    p.add_argument('props'); p.add_argument('out'); p.add_argument('--scale', type=float, default=1.0)
    p.add_argument('--spec', required=True); p.add_argument('--assets-dir', required=True)
    p.set_defaults(fn=cmd_render)
    p = sub.add_parser('ledger', help='report or append piece usage against budget caps',
                       description='Show piece usage and OK/WARN/OVER budget checks. Exit 1 when over a cap.')
    p.add_argument('piece', help='piece folder name or existing directory')
    actions = p.add_subparsers(dest='action')
    a = actions.add_parser('add', help='append a usage entry and report the resulting totals',
                           description='Append usage without changing existing ledger lines.')
    a.add_argument('kind', choices=('claude_tokens', 'codex_tokens', 'allowance_points', 'credits',
                                   'engine_seconds', 'krish_wait_seconds'))
    a.add_argument('amount', type=float, help='finite non-negative amount')
    a.add_argument('--note', default='', help='description of this usage')
    p.set_defaults(fn=cmd_ledger)
    p = sub.add_parser('time', help='start, stop or inspect the piece engine clock',
                       description='Track engine phases separately from the append-only usage ledger.')
    p.add_argument('piece', help='piece folder name or existing directory')
    actions = p.add_subparsers(dest='action', required=True)
    a = actions.add_parser('start', help='start a phase unless engine minutes are over the cap')
    a.add_argument('phase', help='phase name recorded with elapsed engine seconds')
    actions.add_parser('stop', help='append elapsed engine seconds and remove the running clock')
    actions.add_parser('status', help='show the running phase and used minutes including elapsed time')
    p.set_defaults(fn=cmd_time)
    for name in ('ingest', 'stills', 'file'):
        p = sub.add_parser(name); p.add_argument('rest', nargs='*'); p.set_defaults(fn=not_yet(name))
    args = parser.parse_args()
    return args.fn(args)


if __name__ == '__main__':
    sys.exit(main())
