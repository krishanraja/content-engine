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
  python scripts/ve.py ledger <piece> reserve <provider> <amount>   reserve against Control Center's credit caps
  python scripts/ve.py budget pull|verify|hash|status  the credit caps Control Center places on the publication
  python scripts/ve.py lock spend                    the design lock's spend consent becomes Control Center's caps
  python scripts/ve.py time <piece> start <phase>    time an engine phase (stop/status available)

  python scripts/ve.py ingest <piece> --take <id> --media <file> --aligner-a <name> --aligner-b <name> [--clock-a/-b <json>]
  python scripts/ve.py conform <piece> --cut <cut> [--render --assets-dir <dir> --joins-reel]
  python scripts/ve.py brief <piece> [--cut <cut>]   one brief per plate, with card fields; never dispatches
  python scripts/ve.py file <piece> --subject <text>  READY cuts to the archive and the post's 3 Video folder
  python scripts/ve.py lock draft|check|show|freeze  design locks (only Krish's Gate 2 freezes one)
  python scripts/ve.py golden show|check|fill        interim golden frames he names

stills arrives later; until then it says so. ve has no publish, send or schedule verb."""
from __future__ import annotations

import argparse
import json
import os
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
        elif args.action == 'spend':
            from velib import credits
            record = credits.load(args.record) if args.record else credits.load()
            problems = credits.verify(record)
            if problems:
                raise ValueError('the credit read does not stand: ' + '; '.join(problems))
            designlock.spend_from_budget(record)
            print(f'design lock: spend is the credit caps Control Center placed, read on {record["pulled_on"]}')
        elif args.action == 'check':
            findings = designlock.validate(lock)
            if findings:
                print('\n'.join(findings))
                return 1
            print('design lock: valid')
            for fmt in lock['formats']:
                ok, reasons = designlock.frozen(lock, fmt)
                print(f'{fmt}: ' + ('frozen' if ok else 'not frozen: ' + '; '.join(reasons)))
            for fmt, entry in lock.get('drafts', {}).items():
                print(f'{fmt}: draft, {entry["status"]} ({len(entry["beats"])} key-frame slots; '
                      f'modules: {", ".join(entry.get("modules", [])) or "none"})')
        elif args.action == 'draft':
            entry = designlock.draft(args.format, args.aspect, args.beats, anatomy=args.anatomy, motion=args.motion,
                                     modules=args.modules or [], purpose=args.purpose)
            print(f'design lock: drafted {designlock.lock_key(args.format, args.aspect)}, {entry["status"]}; '
                  'only Krish freezes it at Gate 2')
        else:
            if args.mapping is None:
                entry = lock['formats'].get(args.format) or lock.get('drafts', {})[args.format]
                mapping = {beat: f'f{i}.png' for i, beat in enumerate(entry['beats'], 1)}
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


def _gate_inputs(args) -> dict:
    """The calibrated cut gates' inputs (plan W2.4): the signed script, the take's words, and every aligner's words
    for the render (--heard NAME=WORDS.json, or --transcribe: faster-whisper here; no paid aligner, Krish, 2026-10-29:
    "do not use eleven labs for this"). Nothing given, nothing added: those rows stay not_run and ve status reads the cut as not ready."""
    out, heard = {}, {}
    for item in getattr(args, 'heard', None) or []:
        name, _, path = item.partition('=')
        doc = load_json(path)
        heard[name] = doc.get('words') if isinstance(doc, dict) else doc
    if getattr(args, 'transcribe', False):
        from velib import qc_gates
        heard = qc_gates.heard_words(args.cut, heard=heard or None)
    if heard:
        out['heard'] = heard
    if getattr(args, 'script', None):
        out['script'] = Path(args.script).read_text(encoding='utf-8-sig')
    if getattr(args, 'take_words', None):
        doc = load_json(args.take_words)
        out['take_words'] = doc.get('words') if isinstance(doc, dict) else doc
    if getattr(args, 'captions_drawn_by', None) and out:
        out['captions_drawn_by'] = args.captions_drawn_by
    return out


def cmd_qc(args) -> int:
    from velib.qc import inputs_from_props, run_qc
    props = load_json(args.props) if getattr(args, 'props', None) else None
    inputs = inputs_from_props(props) if props is not None else {}
    if getattr(args, 'edl', None):
        # The conformed take is one picture segment: its joins come from the EDL ve conform wrote.
        inputs['joins'] = [join['at_s'] for join in load_json(args.edl).get('joins', [])]
    if props is not None and props.get('aspect') == '9:16':
        inputs['composition_props'] = props
    inputs.update(_gate_inputs(args))
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
            reports[filename] = qc_composition.measure(filename, lock, exempt=boxes)
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
    from velib.common import card_worktree
    fields = load_json(args.fields)
    out = Path(fields.pop('path'))
    fields.setdefault('cwd', card_worktree(fields['card_id']))  # the local layout's worktree, never a typed path (W2.11)
    print(f've card: wrote {write_card(out, **fields)}')
    return 0


def cmd_sprint(args) -> int:
    from velib import sprint
    if args.action == 'start':
        for path in sprint.start(args.week, args.ref):
            print(f've sprint: wrote {path.relative_to(ROOT)}; fill it from its brief and the reference, then ve sprint cards')
        if not sprint.has_ve_brief():
            print('ve sprint: ve brief is not on this checkout yet (W2.7): the briefs are pending and cards wait for them')
    elif args.action == 'cards':
        for card in sprint.cards(args.week):
            print(f've sprint: wrote {card.relative_to(ROOT)}; dispatch it with ve dispatch, then Gate 2')
    elif args.action == 'gate2':
        entry = sprint.gate2(args.device, args.words, args.where, args.at)
        print(f"ve sprint: Gate 2 yes recorded for {entry['device']} ({args.at})")
    elif args.action == 'status':
        s = sprint.status()
        print(f"ve sprint: {s['count']} library devices; {s['sprint_devices']} from sprints, {s['proven']} proven at Gate 2")
        for e in s['entries']:
            gate = f"Gate 2 yes {e['gate2']['at']}" if e.get('gate2') else ('built, awaiting Gate 2' if e['built'] else 'carded')
            print(f"  {e['week']}  {e['device']:<24} {e['aim']:<15} {gate}")
    elif args.action == 'feed':
        data = sprint.feed(Path(args.archive) if args.archive else None, Path(args.out))
        print(f"ve sprint: wrote {args.out} ({len(data['rows'])} Archive rows, {data['devices']['count']} devices)")
    return 0


def cmd_dispatch(args) -> int:
    if getattr(args, 'piece', None):
        from velib.ledger import require_within
        require_within(args.piece)
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
        state = packet.readiness(spec, cut, directory)
        mechanical, design, final = state['mechanical'], state['design'], state['final']
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


def _ve_dir(piece):
    from velib import verdict
    spec_file = spec_path_for(piece)
    return spec_file, load_json(spec_file), verdict.ve_dir(spec_file)


def cmd_ingest(args) -> int:
    from velib import takes
    try:
        spec_file, spec, directory = _ve_dir(args.piece)
        path = takes.ingest(directory, spec['piece_id'], args.take, args.media, clock_a=args.clock_a, clock_b=args.clock_b,
                            aligner_a=args.aligner_a, aligner_b=args.aligner_b)
        record = takes.load_take(directory, args.take)
        print(f"ve ingest: {args.take} ({record['media']['duration_s']} s; {len(record['aligners']['a']['words'])} words from "
              f"{record['aligners']['a']['name']}, {len(record['aligners']['b']['words'])} from {record['aligners']['b']['name']}) -> {path}")
        return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f've ingest: {error}', file=sys.stderr)
        return 1


def _script(directory, given):
    from velib import conform
    path = Path(given) if given else directory / 'script.words.json'
    if not path.is_file():
        raise ValueError(f'no signed script words at {path}: give --script')
    return conform.load_script(path)


def cmd_conform(args) -> int:
    from velib import conform
    try:
        spec_file, spec, directory = _ve_dir(args.piece)
        from velib.lint import lint
        linted, problems = lint(spec_file)
        if problems or linted is None:
            print('\n'.join(problems[:20]) or 'the spec does not pass its schema')
            return 1
        script, script_sha = _script(directory, args.script)
        edl = conform.conform(linted, args.cut, script, directory, takes=args.takes or None,
                              crossfade_s=args.crossfade_ms / 1000, script_sha256=script_sha)
        records = conform.records_for(edl, directory)
        findings = conform.lint_edl(edl, records, linted)
        if findings:
            print('\n'.join(findings))
            print('ve conform: the EDL fails the F09 lint; nothing written')
            return 1
        edl_path, words_path = conform.write(edl, directory)
        print(f"ve conform: {len(edl['segments'])} segment(s), {len(edl['joins'])} join(s), {len(edl['flubs_removed'])} flub(s) removed, "
              f"{len(edl['unscripted_kept'])} unscripted word(s) kept for his ear; {edl['duration_s']} s at speed {edl['speed']}")
        for kept in edl['unscripted_kept']:
            print(f"  kept: \"{kept['word']}\" in line {kept['line']} ({kept['take']} at {kept['src_s']} s): no agreed gap lets it go")
        print(f've conform: {edl_path}\nve conform: {words_path}')
        if args.render:
            if not args.assets_dir:
                raise ValueError('--render needs --assets-dir')
            out = conform.render(edl, records, Path(args.assets_dir))
            for key in ('picture', 'dialogue'):
                if key in out:
                    print(f've conform: {out[key]} ({out[key + "_sha256"]})')
            if args.joins_reel:
                reel = conform.joins_reel(edl, out['dialogue'], directory / f'joins.{args.cut}.wav')
                print(f've conform: joins reel {reel["reel"] or "(no joins)"}')
        return 0
    except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError) as error:
        print(f've conform: {error}', file=sys.stderr)
        return 1


def cmd_file(args) -> int:
    from velib import filing
    try:
        _spec_file, spec, directory = _ve_dir(args.piece)
        cuts = args.cut or list(spec['cuts'])
        result = filing.file(spec, directory, cuts, subject=args.subject, when=args.date, archive_at=args.archive,
                             library_at=args.library, dry_run=args.dry_run)
        if result.get('dry_run'):
            print(f"ve file (dry run): post folder {result['post_folder']}; archive folder {result['archive_folder']}")
            for item in result['files']:
                print(f"  {item['cut']} ({item['shape']}) -> {item['library']}")
            return 0
        print(f"ve file: archive {result['archive']}")
        for item in result['files']:
            print(f"  {item['cut']} ({item['shape']}, {item['sha256'][:12]}) -> {item['library']}")
        return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f've file: {error}', file=sys.stderr)
        return 1


def cmd_brief(args) -> int:
    from velib import brief
    try:
        _spec_file, spec, directory = _ve_dir(args.piece)
        script = None
        if (directory / 'script.words.json').is_file() or args.script:
            script, _sha = _script(directory, args.script)
        words = None
        cut = args.cut
        if cut and (directory / f'words.{cut}.json').is_file():
            words = load_json(directory / f'words.{cut}.json')
        moves = {}
        for item in args.move or []:
            beat, sep, move = item.partition('=')
            if not sep:
                raise ValueError(f'--move takes BEAT=MOVE, not {item}')
            moves[beat] = move
        if args.check:
            if not args.plate:
                raise ValueError('--check needs --plate')
            found = [b for b in brief.build_briefs(spec, cut=cut, script=script, words=words, beats=args.beat, moves=moves)
                     if b['plate'] == args.plate]
            if not found:
                raise ValueError(f'no plate {args.plate} in this piece')
            report = brief.check_candidates(found[0], args.check)
            for finding in report['findings']:
                print(finding)
            print(f"ve brief: {args.plate} candidates {'pass' if report['pass'] else 'FAIL'}; OCR {report['ocr']}")
            return 0 if report['pass'] else 1
        paths = brief.write_briefs(spec, directory, cut=cut, script=script, words=words, beats=args.beat, moves=moves)
        if not paths:
            print('ve brief: no plate slots (no beat uses a generated asset; name one with --beat)')
            return 0
        for path in paths:
            print(f've brief: {path}')
        print('ve brief: card fields beside each brief; ve card writes a card from them. Nothing was dispatched.')
        return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f've brief: {error}', file=sys.stderr)
        return 1


def cmd_golden(args) -> int:
    from velib import golden
    try:
        doc = golden.load()
        if args.action == 'fill':
            entry = golden.fill(args.slot, args.reference, args.at, args.said, clip=args.clip, force=args.force)
            print(f"ve golden: {entry['slot']} named: {entry['reference']} at {entry['at']}")
            doc = golden.load()
        state = golden.status(doc)
        for slot in doc['slots']:
            print(f"{slot['slot']:4} " + (f"{slot['reference']} at {slot['at']}: \"{slot['said']}\"" if slot.get('status') == 'named' else 'empty'))
        print(f"named {state['named']} of {state['min']} to {state['max']}; " +
              ('ready' if state['ready'] else f"waiting on Krish: {doc['fill']}"))
        moments = golden.interim(doc)
        print(f"interim: {len(moments)} Monday 26 moment(s) from config/reference-cuts.json serve beside them")
        return 1 if args.action == 'check' and not state['ready'] else 0
    except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError) as error:
        print(f've golden: {error}', file=sys.stderr)
        return 1


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
        action = getattr(args, 'action', None)
        if action == 'add':
            ledger.add(args.piece, args.kind, args.amount, args.note)
        elif action == 'reserve':
            print(f've ledger: reserved {args.amount:g} {args.provider}: {ledger.reserve(args.provider, args.amount, args.piece, args.note)}')
            return 0
        elif action == 'settle':
            ledger.settle(args.id, args.amount)
            print(f've ledger: settled {args.id} at {args.amount:g}')
            return 0
        return _ledger_report(args.piece)
    except (ValueError, OSError) as error:
        print(f've ledger: {error}', file=sys.stderr)
        return 1


def cmd_budget(args) -> int:
    from velib import credits, ledger
    path = Path(args.record) if args.record else credits.RECORD
    if args.action == 'pull':
        if not args.read:
            print('ve budget pull: give the get_engine_credits answer as a file (--read FILE)', file=sys.stderr)
            return 1
        try:
            record = credits.from_read(load_json(args.read))
        except (OSError, ValueError) as error:
            print(f've budget pull: {error}', file=sys.stderr)
            return 1
        saved = credits.save(record, path)
        problems = credits.verify(record)
        print(f've budget: saved {saved} ({record["record_sha256"][:12]})' + ('' if not problems else ': ' + '; '.join(problems)))
        return 0 if not problems else 1
    try:
        record = credits.load(path)
    except FileNotFoundError:
        print(f've budget: no {path.name}: run ve budget pull --read FILE with Control Center\'s credit read', file=sys.stderr)
        return 1
    except (OSError, ValueError) as error:
        print(f've budget: {error}', file=sys.stderr)
        return 1
    if args.action == 'hash':
        print(credits.record_hash(record))
        return 0
    problems = credits.verify(record)
    if args.action == 'verify':
        print('ve budget: ' + ('the credit read stands' if not problems else '; '.join(problems)))
        return 0 if not problems else 1
    week = credits.week_of()
    for provider, entry in ledger.weekly(week, record).items():
        cap = entry['cap'] if entry['cap'] is not None else f'no {credits.POOLS[provider]} pool placed'
        print(f'{provider}: {entry["used"]:g} used or reserved ({entry["settled"]:g} settled, {entry["open"]:g} open) / {cap}')
    print(f'week of {week}: ' + ('budget stands' if not problems else 'budget does not stand: ' + '; '.join(problems)))
    return 0 if not problems else 1


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
    edl = None
    if getattr(args, 'edl', None):
        from velib import conform, verdict
        edl = load_json(args.edl)
        findings = conform.lint_edl(edl, conform.records_for(edl, verdict.ve_dir(Path(args.spec))), spec)
        if findings:
            print('\n'.join(findings))
            return 1
    if not getattr(args, 'words', None) and edl is None:
        print('ve compile: give --words, or --edl from ve conform')
        return 1
    words = load_json(args.words) if args.words else edl['words']
    if isinstance(words, dict):
        words = words['words']
    report = {}
    props = compile_cut(spec, args.cut, words, args.assets_dir, report=report, edl=edl)
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


def cmd_premix(args) -> int:
    """The cut's premixed stem from the spec's own bed: the ledger track (by id, checked by hash, from
    MINDMAKE_MUSIC_ROOT), the ledger's approved levels, the cut's length from its props and the first and last word
    from its words. Only the chapter-card windows are given (--lift, checked to lie inside the cut); ve has no
    chapter-card layout yet, so a cut without cards has none."""
    from velib import audio
    from velib.common import sha256_file
    from velib.lint import lint
    try:
        spec, problems = lint(Path(args.spec))
        if problems or spec is None:
            print('\n'.join(problems[:20]) or 'the spec does not pass its schema')
            return 1
        if args.cut not in spec['cuts']:
            raise ValueError(f'{args.cut} is not a cut in the spec')
        bed = spec['audio']['bed']
        ledger = load_json(CONFIG / 'music-library.json')
        track = next((t for t in ledger['tracks'] if t['id'] == bed['ledger_id'] and t.get('status') == 'approved'), None)
        if track is None:
            raise ValueError(f"{bed['ledger_id']} is not an approved track in config/music-library.json")
        root = os.environ.get(ledger.get('root_env') or 'MINDMAKE_MUSIC_ROOT') or os.environ.get('MINDMAKE_MUSIC_ROOT')
        if not root:
            raise ValueError('MINDMAKE_MUSIC_ROOT is not set (python scripts/quick-edit/music.py fetch prints it)')
        music = Path(root) / Path(track['file']).name
        if track.get('sha256') and sha256_file(music) != track['sha256']:
            raise ValueError(f'{music.name} does not match the ledger sha256')
        props = load_json(args.props)
        if props.get('cutId') != args.cut:
            raise ValueError(f"the props are for {props.get('cutId')}, not {args.cut}")
        if props['audio']['stem'].get('trimBeforeFrames', 0):
            raise ValueError('the props trim the stem; the premix starts at frame 0 of the conformed dialogue')
        fps = props.get('fps', 30)
        words = load_json(args.words)
        words = words['words'] if isinstance(words, dict) else words
        start_s = 0.0  # dialogue.<cut>.wav is already conformed to the cut's clock
        lifts = [[float(a), float(b)] for a, b in (w.split('-', 1) for w in args.lift or [])]
        result = audio.premix(args.dialogue, str(music), args.out, start_s, props['durationFrames'] / fps,
                              bed_start_s=float(track.get('intro_cue_s') or 0), under_vo_lu=bed['under_vo_lu'],
                              lufs=spec['audio'].get('targets', {}).get('lufs', -14), tp=spec['audio'].get('targets', {}).get('tp', -1),
                              mode=bed['mode'], last_word_end_s=float(words[-1]['end_s']) - start_s,
                              levels=ledger['levels'] | {'chapter_lufs': ledger['levels'].get('chapter_lufs', -22)},
                              voice_start_s=float(words[0]['onset_s']) - start_s, lifts=lifts)
        print(json.dumps({k: result[k] for k in ('stem', 'integrated_lufs', 'true_peak_dbtp')} | {'bed': {
            k: result['bed'].get(k) for k in ('mode', 'bed_lufs_in_master', 'crossfades_s', 'lifts', 'bed_under_speech_db', 'duck_depth_db')}}, indent=1))
        print(f've premix: {sha256_file(Path(args.out))}  {args.out}')
        return 0
    except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError) as error:
        print(f've premix: {error}', file=sys.stderr)
        return 1


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
    p.add_argument('images', nargs='+')
    p.add_argument('--exempt', action='append', metavar='X,Y,W,H', help='real footage box whose text is evidence, never retyped')
    p.add_argument('--json', action='store_true'); p.set_defaults(fn=cmd_comp)
    p = sub.add_parser('lock', help='check, show or freeze approved format designs')
    actions = p.add_subparsers(dest='action', required=True)
    actions.add_parser('check')
    a = actions.add_parser('show'); a.add_argument('format', nargs='?')
    a = actions.add_parser('spend', help="replace the per-generation yes with the credit caps Control Center places")
    a.add_argument('--record', help='default config/ve/credit-budget.json')
    a = actions.add_parser('draft', help='write an unfrozen lock entry with key-frame slots; only Gate 2 freezes it')
    a.add_argument('format'); a.add_argument('--aspect', choices=('9:16', '16:9'), required=True)
    a.add_argument('--beats', nargs='+', required=True); a.add_argument('--modules', nargs='*')
    a.add_argument('--anatomy', required=True); a.add_argument('--motion', required=True)
    a.add_argument('--purpose', default='')
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
    p = sub.add_parser('qc'); p.add_argument('cut'); p.add_argument('--format', required=True); p.add_argument('--out'); p.add_argument('--props')
    p.add_argument('--script', help='the signed script, for words.lost')
    p.add_argument('--take-words', help="the take's words json, for words.lost")
    p.add_argument('--heard', action='append', metavar='ALIGNER=WORDS.json', help="an aligner's words for this render (repeatable)")
    p.add_argument('--transcribe', action='store_true', help='hear the render here with faster-whisper (no paid aligner)')
    p.add_argument('--captions-drawn-by', default='faster-whisper', help='the aligner whose words drew the captions')
    p.add_argument('--edl', help='the EDL ve conform wrote: QC measures its joins')
    p.set_defaults(fn=cmd_qc)
    p = sub.add_parser('keyframes', help='compare rendered beats with approved stills')
    p.add_argument('format'); p.add_argument('video'); p.add_argument('props'); p.add_argument('--sheet')
    p.set_defaults(fn=cmd_keyframes)
    p = sub.add_parser('study'); p.add_argument('ref'); p.add_argument('--out'); p.set_defaults(fn=cmd_study)
    p = sub.add_parser('card'); p.add_argument('fields'); p.set_defaults(fn=cmd_card)
    p = sub.add_parser('sprint', help='the weekly device sprint: brief, card, Gate 2 record (docs/ve/SPRINT.md)')
    actions = p.add_subparsers(dest='action', required=True)
    a = actions.add_parser('start'); a.add_argument('week'); a.add_argument('--ref', action='append', required=True)
    a = actions.add_parser('cards'); a.add_argument('week')
    a = actions.add_parser('gate2'); a.add_argument('device'); a.add_argument('--words', required=True)
    a.add_argument('--where', required=True); a.add_argument('--at', required=True)
    actions.add_parser('status')
    a = actions.add_parser('feed'); a.add_argument('--archive'); a.add_argument('--out', required=True)
    p.set_defaults(fn=cmd_sprint)
    p = sub.add_parser('dispatch'); p.add_argument('card'); p.add_argument('--wait', action='store_true')
    p.add_argument('--piece', help='refuse dispatch when this piece is over any budget cap')
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
    p.add_argument('spec'); p.add_argument('--cut', required=True); p.add_argument('--words')
    p.add_argument('--edl', help='the EDL from ve conform; its words are used when --words is absent')
    p.add_argument('--assets-dir', required=True); p.set_defaults(fn=cmd_compile)
    p = sub.add_parser('premix', help="premix the cut's dialogue with the spec's bed into audio.<cut>.wav")
    p.add_argument('spec'); p.add_argument('--cut', required=True); p.add_argument('--dialogue', required=True)
    p.add_argument('--words', required=True); p.add_argument('--props', required=True); p.add_argument('--out', required=True)
    p.add_argument('--lift', action='append', metavar='FROM-TO', help='a chapter-card window in seconds on the cut clock')
    p.set_defaults(fn=cmd_premix)
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
    a = actions.add_parser('reserve', help='reserve credits against the Control Center credit caps; refused over a cap',
                           description='Reserve before a dispatch or generation runs; settle it with what the provider charged.')
    a.add_argument('provider', choices=('codex_allowance_points', 'codex_paid_credits', 'runway_credits', 'higgsfield_credits',
                                        'elevenlabs_credits'))
    a.add_argument('amount', type=float, help='finite non-negative amount')
    a.add_argument('--note', default='', help='what it is for')
    a = actions.add_parser('settle', help='record what a reservation really cost')
    a.add_argument('id'); a.add_argument('amount', type=float)
    p.set_defaults(fn=cmd_ledger)
    p = sub.add_parser('budget', help='pull, verify, hash or show the credit caps Control Center places on the publication')
    p.add_argument('action', choices=('pull', 'verify', 'hash', 'status'))
    p.add_argument('--read', help='pull: a get_engine_credits answer (JSON) for growth-makeyourmindup')
    p.add_argument('--record', help='default .ve-work/credits/credit-budget.json (never committed), or VE_CREDIT_BUDGET')
    p.set_defaults(fn=cmd_budget)
    p = sub.add_parser('time', help='start, stop or inspect the piece engine clock',
                       description='Track engine phases separately from the append-only usage ledger.')
    p.add_argument('piece', help='piece folder name or existing directory')
    actions = p.add_subparsers(dest='action', required=True)
    a = actions.add_parser('start', help='start a phase unless engine minutes are over the cap')
    a.add_argument('phase', help='phase name recorded with elapsed engine seconds')
    actions.add_parser('stop', help='append elapsed engine seconds and remove the running clock')
    actions.add_parser('status', help='show the running phase and used minutes including elapsed time')
    p.set_defaults(fn=cmd_time)
    p = sub.add_parser('ingest', help='bring a take and its two word clocks into the piece (media hashed, never copied)')
    p.add_argument('piece'); p.add_argument('--take', required=True); p.add_argument('--media', required=True)
    p.add_argument('--clock-a', help='aligner A word clock JSON; without it a local faster-whisper:<model> runs')
    p.add_argument('--clock-b', help='aligner B word clock JSON (a second local model)')
    p.add_argument('--aligner-a', required=True, help='for example faster-whisper:small.en')
    p.add_argument('--aligner-b', required=True, help='for example faster-whisper:medium.en (no paid aligner)')
    p.set_defaults(fn=cmd_ingest)
    p = sub.add_parser('conform', help='choose takes line by line, remove flubs, cut only in agreed gaps, write the EDL')
    p.add_argument('piece'); p.add_argument('--cut', required=True); p.add_argument('--script')
    p.add_argument('--takes', nargs='+', help='take ids in preference order, later preferred (default: all ingested)')
    p.add_argument('--crossfade-ms', type=float, default=30.0, help='20 to 40 ms')
    p.add_argument('--render', action='store_true', help='render the conformed picture and dialogue in one graph')
    p.add_argument('--assets-dir'); p.add_argument('--joins-reel', action='store_true')
    p.set_defaults(fn=cmd_conform)
    p = sub.add_parser('file', help="file READY cuts in the archive and the post's 3 Video folder, bound to piece_id")
    p.add_argument('piece'); p.add_argument('--subject', required=True); p.add_argument('--date')
    p.add_argument('--cut', action='append', help='a cut to file (default: every cut; one per shape)')
    p.add_argument('--archive', help='the archive folder (default MINDMAKE_ARCHIVE_ROOT)')
    p.add_argument('--library', help='the makeyourmindup library folder (default MINDMAKE_LIBRARY_ROOT)')
    p.add_argument('--dry-run', action='store_true'); p.set_defaults(fn=cmd_file)
    p = sub.add_parser('brief', help='write one brief and its card fields per plate; never dispatches')
    p.add_argument('piece'); p.add_argument('--cut'); p.add_argument('--script')
    p.add_argument('--beat', nargs='+', help='brief these beats as plate slots too')
    p.add_argument('--move', nargs='+', metavar='BEAT=MOVE', help='a named move from config/ve/plate-moves.json')
    p.add_argument('--check', metavar='DIR', help="check a plate's candidates against its brief")
    p.add_argument('--plate'); p.set_defaults(fn=cmd_brief)
    p = sub.add_parser('golden', help="interim golden frames: Krish's named Production Inspo moments")
    actions = p.add_subparsers(dest='action', required=True)
    actions.add_parser('show'); actions.add_parser('check')
    a = actions.add_parser('fill'); a.add_argument('slot'); a.add_argument('--reference', required=True)
    a.add_argument('--at', required=True); a.add_argument('--said', required=True, help="Krish's exact words naming it")
    a.add_argument('--clip'); a.add_argument('--force', action='store_true')
    p.set_defaults(fn=cmd_golden)
    p = sub.add_parser('stills'); p.add_argument('rest', nargs='*'); p.set_defaults(fn=not_yet('stills'))
    args = parser.parse_args()
    return args.fn(args)


if __name__ == '__main__':
    sys.exit(main())
