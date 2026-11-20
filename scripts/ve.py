#!/usr/bin/env python3
"""ve: the spec-driven video engine's command line (docs/ve/ENGINE.md).

  python scripts/ve.py doctor
  python scripts/ve.py start <piece>                 write the session pack
  python scripts/ve.py lint <spec.json>              schema + crew lints (blocks a render)
  python scripts/ve.py qc <cut.mp4> --format <id> [--out qc.json]
  python scripts/ve.py study <reference.mp4>         grammar card: cuts, change density, stills, loops
  python scripts/ve.py pace <cut.mp4> [--out pace.json]   events a second, energy and frame use, beside his references
  python scripts/ve.py pace --refs [--dir .cache/references]   re-measure the references into config/ve/pace-references.json
  python scripts/ve.py beats <audio> [--out beats.json] | --grid <track>|--all [--write]   tempo, bars, drops: measured, never snapped to
  python scripts/ve.py card <card.json>              write a Codex task card from its fields
  python scripts/ve.py dispatch <card.md> [--wait]   send it to Codex (pinned model and effort)
  python scripts/ve.py verify-card <card.md> --cwd <worktree>
  python scripts/ve.py lane route|queue|build|serve|status   the Codex lane: any session queues, the home PC builds
  python scripts/ve.py status <piece>                readiness, computed; nobody writes a pass
  python scripts/ve.py coverage                      failure register: behavioural guards vs markers

  python scripts/ve.py ledger <piece>               usage against the piece's caps
  python scripts/ve.py ledger <piece> reserve <provider> <amount>   reserve against Control Center's credit caps
  python scripts/ve.py budget pull|verify|hash|status|provisional|reconcile  the credit caps Control Center places on the publication
  python scripts/ve.py lock spend                    the design lock's spend consent becomes Control Center's caps
  python scripts/ve.py time <piece> start <phase>    time an engine phase (stop/status available)

  python scripts/ve.py ingest <piece> --take <id> --media <file> --aligner-a <name> --aligner-b <name> [--clock-a/-b <json>]
  python scripts/ve.py conform <piece> --cut <cut> [--render --assets-dir <dir> --joins-reel]
  python scripts/ve.py said <piece> --take <id> --teleprompter <script.txt>   what he said vs the script; proposed words
  python scripts/ve.py voice-ab <piece> --cut <cut> --assets-dir <dir> --at <s>  raw and repaired voice for his ear
  python scripts/ve.py sfx audition <piece> --cut <cut> --assets-dir <dir> --candidates <ids>   big-moment sounds for his ear
  python scripts/ve.py lab render --take <pinned take> --brand-dir <dir> | diff --against <dir> | verdict --module <id> --verdict <v> --said "<his words>" --on <date>
  python scripts/ve.py lab sample --layer motion|captions --module <id> --drive-id <ID> [--clip <the render>]   a sample for Pick a style
  python scripts/ve.py lab stills [--only <looks>] [--take <pinned take> --brand-dir <dir>]   one 540x960 still per style
  python scripts/ve.py lab still treatment|motion|captions <id> --drive <ID> [--file <the jpg>]   the still the board shows on hover
  python scripts/ve.py sfx approve --id <id> --words "<his words>" --on <date> --audition <ve>/sfx-audition.json | sfx stage --assets-dir <dir>
  python scripts/ve.py brief <piece> [--cut <cut>]   one brief per plate, with card fields; never dispatches
  python scripts/ve.py file <piece> --subject <text>  READY cuts to the archive and the post's 3 Video folder
  python scripts/ve.py judge <piece> --cut <cut> [--record scores.json --by ve-critic]   the blind judge's packet, then its score
  python scripts/ve.py lock draft|check|show|freeze|retire|rules-only  design locks (only Krish's Gate 2 freezes one; retire deletes a lock's key frames for good on his words; rules-only drops the picture-matching on his words)
  python scripts/ve.py golden show|check|fill        interim golden frames he names
  python scripts/ve.py signoff check|stills|gate2|add|apply   the three sign-offs as review cards on his board
  python scripts/ve.py expect <spec>                 expect.md: at most six lines of what this cut will and won't do
  python scripts/ve.py styles <spec> [--cut <cut>] [--top 3]   the shortlisted motion styles on his take, for his pick
  python scripts/ve.py proof <spec> --cut <cut>      the hardest beat, moving, from his take; a whole cut waits for it

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
MUSIC_LEDGER = ROOT / 'config' / 'music-library.json'  # beside config/ve, not in it


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
        from velib.common import FFMPEG_PIN, ffmpeg_version
        found = ffmpeg_version()
        pinned = found.startswith(FFMPEG_PIN)   # scripts/overnight/preflight.ps1 compares the same way
        check('ffmpeg pin', pinned,
              f'{found} is the pinned build' if pinned else
              f'{found} is not the pinned {FFMPEG_PIN}: a cut made here is not comparable with CI or the home computers '
              f'(on a home computer, `. scripts/ve-env.sh` first)', hard=False)
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
    from velib.cards import codex_thread
    try:
        check('codex_thread.mjs (the one way Claude starts Codex)', True, codex_thread())
    except SystemExit as error:
        check('codex_thread.mjs (the one way Claude starts Codex)', False, str(error), hard=False)
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
                print(f'{fmt}: ' + ('rules only (no key frames)' if ok and not designlock.picture_match(lock, fmt) else 'frozen' if ok else 'not frozen: ' + '; '.join(reasons)))
            for fmt, entry in lock.get('drafts', {}).items():
                print(f'{fmt}: draft, {entry["status"]} ({len(entry["beats"])} key-frame slots; '
                      f'modules: {", ".join(entry.get("modules", [])) or "none"})')
        elif args.action == 'draft':
            entry = designlock.draft(args.format, args.aspect, args.beats, anatomy=args.anatomy, motion=args.motion,
                                     modules=args.modules or [], purpose=args.purpose)
            print(f'design lock: drafted {designlock.lock_key(args.format, args.aspect)}, {entry["status"]}; '
                  'only Krish freezes it at Gate 2')
        elif args.action == 'rules-only':
            from datetime import date as _date
            entry = designlock.rules_only(args.format, words=args.words, on=args.on or _date.today().isoformat())
            print(f'design lock: {args.format} is a rules-only lock; no key frames are stored or matched, '
                  f'its {len(entry["beats"])} beats and the lock\'s zones and thresholds are its rules')
        elif args.action == 'retire':
            from datetime import date as _date
            entry = designlock.retire(args.format, words=args.words, on=args.on or _date.today().isoformat())
            print(f'design lock: retired {args.format}; its key frames are deleted for good and the format is a draft, '
                  f'{entry["status"]}; {len(entry["retired"]["files_removed"])} golden file(s) removed')
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
    if spec is not None:
        for line in _override_incidents(spec, Path(args.spec)):
            print(line)
    return 1 if problems else 0


def _override_incidents(spec, spec_file) -> list[str]:
    """Each lint the spec silences (a beat's override_reason) is one engine_incidents row, filed once (the failure loop:
    an override that recurs is a standard the engine keeps arguing with). Never stops the lint."""
    try:
        sys.path.insert(0, str(ROOT / 'scripts'))
        import incidents  # noqa: PLC0415
        from velib import preflight as gate, verdict
        directory = verdict.ve_dir(spec_file)
        found = []
        if not gate.real_piece(directory.parent):
            return found
        for cut_id, cut in (spec.get('cuts') or {}).items():
            for beat in cut.get('beats') or []:
                reason = str(beat.get('override_reason') or '').strip()
                if not reason:
                    continue
                result = incidents.record({
                    'stage': 'storyboard', 'kind': 'override', 'maker': incidents.maker_here(), 'skill': 've',
                    'piece_path': str(directory.parent.relative_to(ROOT) if directory.parent.is_relative_to(ROOT) else directory.parent)[:300],
                    'artifact_ref': f'{spec_file.name}#{cut_id}.{beat.get("id")}'[:500],
                    'preflight': list(gate._preflight().latest(gate._preflight().from_ledger(directory.parent)).values()) or None,
                    'meta': {'piece': spec.get('piece_id'), 'cut': cut_id, 'beat': beat.get('id'), 'override_reason': reason[:600]},
                    'client_ref': incidents.client_ref('override', spec.get('piece_id'), cut_id, beat.get('id'), reason)})
                found.append(f've lint: override on {cut_id}.{beat.get("id")} recorded for the failure loop ({result})')
        return found
    except Exception as error:  # noqa: BLE001
        return [f've lint: override not recorded for the failure loop ({type(error).__name__})']


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
    from velib.qc import inputs_from_props, run_qc, to_file_s
    props = load_json(args.props) if getattr(args, 'props', None) else None
    inputs = inputs_from_props(props) if props is not None else {}
    if getattr(args, 'edl', None):
        # The conformed take is one picture segment: its joins come from the EDL ve conform wrote, on the cut's own
        # clock. In the file a join after the sting falls its frames later (velib.qc.to_file_s).
        inputs['joins'] = [to_file_s(join['at_s'], props) for join in load_json(args.edl).get('joins', [])]
    if props is not None and props.get('aspect') == '9:16':
        inputs['composition_props'] = props
    if props is not None:
        inputs['frame_props'] = props   # the frame checks read every aspect (velib/qc_frames.py)
    inputs.update(_gate_inputs(args))
    if getattr(args, 'spec', None):
        # The spec supplies the publish day and the restarts he kept on purpose (cuts.<id>.kept_restarts).
        spec_doc = load_json(args.spec)
        inputs.setdefault('publish_day', spec_doc.get('publish_day'))
        inputs['kept_restarts'] = ((spec_doc.get('cuts') or {}).get((props or {}).get('cutId')) or {}).get('kept_restarts') or []
    if getattr(args, 'publish_day', None):
        inputs['publish_day'] = args.publish_day
    report = run_qc(args.cut, args.format, **inputs)
    out = Path(args.out) if args.out else Path(args.cut).with_suffix('.qc.json')
    write_json(out, report)
    _bed_receipt(args.cut, inputs.get('dialogue_master'), report)
    for name, check in report['checks'].items():
        state = check.get('status') or ('pass' if check['pass'] else 'FAIL')
        print(f"{state:8} {name:24} {json.dumps(check['value'])[:80]}  target {check['target']}")
    print(f"ve qc: {'measured checks pass' if report['measured_pass'] else 'FAILS'}; {'complete' if report['complete'] else 'incomplete (not_run checks)'} -> {out}")
    return 0 if report['measured_pass'] else 1


def _bed_receipt(cut: str, stem: str | None, report: dict) -> None:
    """<cut>.bed-shape.json for these bytes when the bed the premix made passed the one shape and ve qc's bed rows
    passed on this render (config/music-bed.json); a stale receipt is removed, so filing refuses the cut."""
    import bed_shape
    from velib import qc_audio
    receipt = bed_shape.receipt_path(cut)
    row = report.get('checks', {}).get('audio.bed', {})
    sidecar = qc_audio.sidecar_for(stem) if stem else None
    shape = None
    if sidecar is not None and sidecar.is_file():
        shape = json.loads(sidecar.read_text(encoding='utf-8')).get('bed', {}).get('shape')
    if row.get('pass') is True and isinstance(shape, dict) and shape.get('pass') is True:
        bed_shape.write_receipt(cut, 've', shape, machine='scripts/ve.py qc', extra={'premix': sidecar.name})
        print(f've qc: bed-shape receipt -> {receipt}')
    elif receipt.is_file():
        receipt.unlink()
        print(f've qc: the bed misses the one shape; {receipt.name} removed, so the cut cannot be filed')


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


def cmd_pace(args) -> int:
    """How fast a cut moves and how much of the frame it uses, beside the references he keeps (velib.pace)."""
    from velib import pace
    table = ROOT / 'config' / 've' / 'pace-references.json'
    try:
        if args.refs:
            folder = Path(args.dir)
            names = [r['file'] for r in json.loads((ROOT / 'config' / 'style-references.json').read_text(encoding='utf-8'))['references']
                     if str(r.get('file', '')).endswith('.mp4')]
            rows = []
            for name in names:
                if not (folder / name).is_file():
                    print(f've pace: {name} is not in {folder} (references.py fetch)')
                    continue
                card = pace.measure(folder / name)
                card['file'] = name
                card.pop('event_times_s', None)
                card.pop('note', None)
                rows.append(card)
                print(f"ve pace: {name}: {card['events_per_s']}/s, longest gap {card['longest_gap_s']} s, used {card['used_frame']}, active {card['active_frame']}")
            kept = json.loads(table.read_text(encoding='utf-8')) if table.is_file() else {}
            pace.write({'schema': 've-pace-references/1', 'note': pace.NOTE, 'grid': [pace.GRID_W, pace.GRID_H, pace.SAMPLE_FPS],
                        'references': rows, **{k: kept[k] for k in ('house', 'house_note') if k in kept}}, table)
            print(f've pace: {len(rows)} references -> {table}')
            return 0
        if not args.video:
            print('ve pace: give a cut, or --refs', file=sys.stderr)
            return 2
        card = pace.measure(args.video, args.seconds)
        loaded = json.loads(table.read_text(encoding='utf-8'))
        refs = loaded['references'] + loaded.get('house', [])
        verdict = pace.compare(card, refs)
        card['against_references'] = verdict
        out = Path(args.out) if args.out else Path(args.video).with_suffix('.pace.json')
        pace.write(card, out)
        for key, row in verdict['rows'].items():
            flag = '  BELOW EVERY REFERENCE' if row['below_all'] else ''
            print(f"ve pace: {key:14} {row['cut']:>6}   refs {row['ref_min']} .. {row['ref_median']} .. {row['ref_max']}{flag}")
        print(f've pace: {pace.NOTE}')
        print(f've pace: -> {out}')
        return 0
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        print(f've pace: {error}', file=sys.stderr)
        return 1


def cmd_recipe(args) -> int:
    """Krish's rating of a style recipe in his own words (velib/recipes.py): a score 0 to 10, or --approved with no number."""
    from velib import recipes
    try:
        block = recipes.rate(args.id, args.score, approved=args.approved, words=args.words, on=args.on)
    except ValueError as error:
        print(f've recipe rate: {error}', file=sys.stderr)
        return 1
    print(f've recipe rate: {args.id} rated {json.dumps(block, ensure_ascii=False)}')
    return 0


def cmd_judge(args) -> int:
    """The blind overall judge (velib/judge.py): assemble the cut beside his references under letters, or record the scores
    the ve-critic agent gave them. The model call is the session's; this only assembles, records and is enforced by ve status."""
    from velib import judge, verdict
    from velib.common import sha256_file
    try:
        _spec_file, spec, directory = _ve_dir(args.piece)
        if args.cut not in spec['cuts']:
            raise ValueError(f'no cut {args.cut} in the spec')
        video = verdict.video_path(verdict.read(directory / f'qc.{args.cut}.json'), directory)
        if not video.is_file():
            raise ValueError(f'no rendered cut for {args.cut} (its qc.{args.cut}.json names {video})')
        digest = sha256_file(video)
        if args.record:
            given = load_json(args.record)
            value = judge.record(directory, args.cut, digest, given.get('scores') or {}, by=args.by, notes=given.get('notes'))
            held = value['score'] < judge.PASS
            print(f"ve judge: {args.cut} scored {value['score']}/10 beside {value['references_scored']} reference clips"
                  + (f' (held: below {judge.PASS})' if held else ''))
            return 1 if held else 0
        made = judge.assemble(directory, args.cut, video, digest, refs_dir=Path(args.refs_dir) if args.refs_dir else None)
        print(f"ve judge: blind packet {made['packet']} ({len(made['letters'])} clips, letters only)")
        if made['missing']:
            print(f"ve judge: not on disk, so not in the packet: {', '.join(made['missing'])}")
        print('ve judge: hand the packet folder to the ve-critic agent ("The blind judge"), then record its scores with --record')
        return 0
    except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError) as error:
        print(f've judge: {error}', file=sys.stderr)
        return 1


def cmd_beats(args) -> int:
    """Where the beat is in a bed: tempo, bars, drops and how sure (velib.beats). It only measures; nothing snaps to it.
    --grid reads ledger tracks from MINDMAKE_MUSIC_ROOT on the machine that holds the music; --write keeps each grid in
    its track's row of config/music-library.json."""
    from velib import beats
    try:
        if args.grid is None and not args.all:
            if not args.audio:
                print('ve beats: give an audio file, or --grid <track id> | --grid --all', file=sys.stderr)
                return 2
            reading = beats.read(args.audio)
            out = Path(args.out) if args.out else Path(args.audio).with_suffix('.beats.json')
            write_json(out, reading)
            grid = reading.get('grid')
            print(f"ve beats: {reading['tempo_bpm']} a minute, confidence {reading['confidence']} "
                  f"({'grid of ' + str(len(grid['bars_s'])) + ' bars' if grid else reading.get('no_grid')}), "
                  f"drops at {[d['at_s'] for d in reading['drops']]}")
            print(f've beats: {beats.NOTE}')
            print(f've beats: -> {out}')
            return 0
        ledger = load_json(MUSIC_LEDGER)
        root = os.environ.get(ledger.get('root_env') or 'MINDMAKE_MUSIC_ROOT') or os.environ.get('MINDMAKE_MUSIC_ROOT')
        if not root:
            raise ValueError('MINDMAKE_MUSIC_ROOT is not set: run this on a home computer (python scripts/quick-edit/music.py fetch prints it)')
        wanted = [t for t in ledger['tracks'] if args.all or t['id'] == args.grid]
        if not wanted:
            raise ValueError(f'{args.grid} is not a track in config/music-library.json')
        for track in wanted:
            entry = beats.ledger_entry(beats.track_reading(track, root))
            track['beats'] = entry
            print(f"ve beats: {track['id']}: {entry['tempo_bpm']} a minute, confidence {entry['confidence']}, "
                  f"{'grid' if entry['grid'] else 'no grid'}, drops at {entry['drops_s']}")
        if args.write:
            MUSIC_LEDGER.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
            print(f've beats: {len(wanted)} grid(s) -> {MUSIC_LEDGER}')
        else:
            print('ve beats: nothing written; add --write to keep these in config/music-library.json')
        return 0
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        print(f've beats: {error}', file=sys.stderr)
        return 1


def cmd_study(args) -> int:
    """A reference's grammar card: cuts, motion, shots and pace, zooms, loudness and words a minute (velib.study)."""
    from velib import study
    card = study.study(args.ref, args.out)
    pace = card.get('pace') or {}
    print(f"ve study: {card['cuts_per_minute']} cuts/min, median shot {pace.get('median_shot_s')} s, picture changes in "
          f"{card['change_density'] * 100:.0f}% of seconds, longest still {card['longest_still_s']} s, "
          f"{card.get('loudness_lufs')} LUFS, {len(card.get('zooms') or [])} zoom(s) -> {args.out or Path(args.ref).with_suffix('.grammar.json')}")
    print(f"ve study: {study.NOTE}")
    return 0


def cmd_card(args) -> int:
    from velib.cards import _require_design_lock, write_card
    from velib.common import card_worktree, native_path
    fields = load_json(args.fields)
    out = Path(fields.pop('path'))
    _require_design_lock(fields)  # a card with no frozen lock is refused before anything else is resolved
    # The local layout's worktree, never a typed path (W2.11), in this machine's own form: dispatch compares it with
    # native_path, so a card written off Windows names /a/b, never a\b (18 Nov 2026: a Linux card was refused).
    fields.setdefault('cwd', str(native_path(card_worktree(fields['card_id']))))
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
    return 0


def cmd_dispatch(args) -> int:
    if getattr(args, 'visible', False):
        # One switch for the whole visible route: the home his Desktop app reads and card worktrees beside it
        # (velib.codex_route.card_root reads the same flag through codex_home.studio_opted_in).
        os.environ['VE_CODEX_VISIBLE'] = '1'
    if getattr(args, 'piece', None):
        from velib.ledger import require_within
        require_within(args.piece)
    if getattr(args, 'dry_run', False):
        # The command dispatch would launch, as one line: nothing reserved, no worktree made, Codex not started.
        from velib.cards import dry_run
        print(dry_run(Path(args.card), visible=getattr(args, 'visible', False), piece=getattr(args, 'piece', None)))
        return 0
    from velib import codex_lane
    if getattr(args, 'queue', False) or codex_lane.route() == 'queue':
        # Codex is not on this machine (a cloud session, Claude Desktop, a Windows-side Claude Code): the card goes to
        # the lane and his home computer builds it. Never a question to Krish about how to reach Codex.
        item = codex_lane.queue(Path(args.card), getattr(args, 'piece', None))
        print(f've dispatch: Codex is not on this machine; queued {item["id"]} for Codex on the home computer '
              '(its recordings pass picks it up within five minutes). Read the result with ve lane status.')
        return 0
    from velib.cards import dispatch
    result = dispatch(Path(args.card), background=not args.wait, visible=getattr(args, 'visible', False),
                      piece=getattr(args, 'piece', None))
    print((result.stdout or result.stderr).strip()[-2000:])
    return result.returncode


def cmd_codex(args) -> int:
    """The Codex minimum (Ruling, Krish, 2026-11-15): Claude records Codex's checked share of a piece; status reads it."""
    from velib import codex_minimum, verdict
    if args.action == 'where':
        from velib.cards import codex_env
        video = codex_env().get('CODEX_HOME') or str(Path.home() / '.codex')
        home, how = codex_minimum.desktop_home_found()
        print(f've codex: video cards and the lane run Codex under {video}, never shown in Codex Desktop; '
              f've dispatch --visible (social-media legwork from his own computer) runs under {home} (found by {how}), '
              'the home Codex Desktop reads (Ruling, Krish, 2026-11-15)')
        return 0
    if args.action == 'route':
        # How a card would start on this machine, for a stand-in card: the route and the exact command (in WSL with his
        # Windows home: Windows node and Windows Codex, never the Linux codex on /mnt/c). Starts nothing.
        from velib import codex_route
        from velib.cards import codex_env, plan
        from velib.common import card_worktree, native_path
        env = codex_env(getattr(args, 'visible', False))
        try:
            cwd = str(native_path(card_worktree('route-check')))
        except ValueError:
            cwd = str(ROOT)
        options = ['--cwd', cwd, '--sandbox', 'workspace-write', '--prompt-file',
                   str(ROOT / '.cache' / 've-dispatch' / 'route-check.prompt.md')]
        print(f"ve codex: Codex home {env.get('CODEX_HOME')}")
        argv, chosen, extra = plan(options, env)
        print(codex_route.describe(argv, chosen, extra))
        if chosen == 'wsl-windows':
            # Copy the script and start Windows node on it with no command (it prints its usage; no Codex starts),
            # exactly as a dispatch will, so a route that cannot run fails here with node's own error.
            from velib.cards import launch
            launch(options, env)
            print('ve codex: Windows node runs codex_thread.mjs from its Windows copy (usage printed; no Codex started)')
        return 0
    try:
        spec_file = spec_path_for(args.piece)
        spec = load_json(spec_file)
        directory = verdict.ve_dir(spec_file)
        if args.action == 'receipt':
            session, visible = args.session or '', None
            if args.cwd:
                from velib.cards import card_usage
                usage = card_usage(args.card, args.cwd)
                if usage and usage.get('log'):
                    session = session or Path(usage['log']).stem
                    visible = codex_minimum.visible_in_desktop(usage['log'])
            note = codex_minimum.record(directory, args.card, args.job, Path(args.evidence), args.verified_by,
                                        session=session, desktop_visible=visible)
            print(f"ve codex: receipt for {note['card']} ({note['job']}, {note['evidence_sha256'][:12]}) on {args.piece}")
            if visible is False:
                print('ve codex: that Codex session ran outside the home Codex Desktop reads; Krish cannot watch it there '
                      '(ve codex where names that home)')
            return 0
        state = codex_minimum.status(spec, directory)
        need = state['minimum']['receipts']
        print(f"ve codex: {state['counted']} of {need} counted receipt(s); required for pieces published from {state['required_from']}")
        for row in state['receipts']:
            seen = {True: 'visible in Codex Desktop', False: 'NOT visible in Codex Desktop', None: 'Desktop visibility unknown'}
            print(f"  {row.get('ts', '')[:16]}  {row.get('job'):<13} {row.get('card')}  checked by {row.get('verified_by')}; "
                  f"{seen[row.get('desktop_visible')]}")
        if any(codex_minimum.problems(spec, cut, directory) for cut in spec['cuts']):
            return 1
        return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f've codex: {error}', file=sys.stderr)
        return 1


def cmd_lane(args) -> int:
    from velib import codex_lane
    if args.action == 'route':
        print(codex_lane.route())
    elif args.action == 'queue':
        item = codex_lane.queue(Path(args.card), args.piece, args.ref)
        print(f've lane: queued {item["id"]} for Codex on the home computer. Follow it now, in the background: '
              f'python scripts/ve.py lane wait {item["id"]}')
    elif args.action == 'wait':
        result = codex_lane.wait(args.ids, every=args.every, limit_minutes=args.minutes)
        print(json.dumps(result))
        return 0 if all(s == 'built' for s in result.values()) else 1
    elif args.action == 'pending':
        print(json.dumps({'cards': codex_lane.all_pending()}))
    elif args.action == 'build-venture':
        result = codex_lane.build_venture(args.venture, args.branch, args.path)
        print(json.dumps(result))
        return 0 if result['ok'] else 1
    elif args.action == 'build':
        result = codex_lane.build(args.fields, args.ref, args.piece)
        if not args.json:
            for problem in result['problems']:
                print(problem)
        print(json.dumps(result))
        return 0 if result['ok'] else 1
    elif args.action == 'serve':
        print(json.dumps(codex_lane.serve()))
    elif args.action == 'status':
        for row in codex_lane.status():
            print(json.dumps(row))
    return 0


def cmd_verify_card(args) -> int:
    from velib.cards import verify
    notes: list[str] = []
    problems = verify(Path(args.card), Path(args.cwd), notes)
    for problem in problems:
        print(problem)
    for note in notes:
        print(f've verify-card: {note}')
    print('ve verify-card: ' + ('passes' + ('; the on-screen numbers were NOT checked (see not_run above)' if notes else '')
                                + '; now render its golden stills and look at them' if not problems else f'{len(problems)} problem(s)'))
    return 1 if problems else 0


def cmd_critic(args) -> int:
    """`ve critic --pre <piece>`: the Critic's two questions, asked of the spec, the storyboard and the card briefs before anything is
    made (velib/precritic.py). Without --write it writes the reviewer's inputs; with --write it records the answers."""
    from velib import guards, ideaguard, precritic
    if not args.pre:
        sys.exit('ve critic: only --pre is built; the cut review is `ve verdict write`')
    spec_file = spec_path_for(args.piece)
    spec = load_json(spec_file)
    mechanical = guards.idea_problems(spec) + [p for p in ideaguard.one_object_problems(spec, guards.config()['one_object'])]
    if not args.write:
        out = precritic.inputs(spec, spec_file, mechanical)
        print(f've critic --pre: wrote {out}; a reviewer who did not write the spec answers its two questions, then '
              f've critic --pre {args.piece} --write --reviewer NAME --answers answers.json [--findings findings.json]')
        for line in mechanical:
            print(f'  mechanical: {line}')
        return 0
    if not args.reviewer or not args.answers:
        sys.exit('ve critic --pre --write: --reviewer NAME and --answers FILE ({"one_idea": {"pass": bool, "line": "..."}, "no_invented_numbers": {...}})')
    try:
        path = precritic.write(spec, spec_file, args.reviewer, load_json(args.answers),
                               load_json(args.findings) if args.findings else [], mechanical)
    except (OSError, ValueError) as error:
        print(f've critic --pre: {error}')
        return 1
    ok, why = precritic.state(spec, spec_file)
    print(f've critic --pre: wrote {path}; {"passes" if ok else "BLOCKS: " + why}')
    return 0 if ok else 1


def cmd_verdict(args) -> int:
    from velib import verdict
    try:
        spec_file = spec_path_for(args.piece)
        spec = load_json(spec_file)
        findings = load_json(args.findings)
        if not isinstance(findings, list):
            raise ValueError('findings file must hold a list')
        viewed = [float(s) for s in args.viewed.split(',') if s.strip()]
        references = load_json(args.references) if getattr(args, 'references', None) else None
        path = verdict.write(spec, args.cut, verdict.ve_dir(spec_file), args.reviewer, findings, viewed, references)
        print(f've verdict: {path}')
        if (spec.get('brand') or {}).get('references'):
            from velib import board
            print(f've verdict: {board.record_uses(spec, spec_file, args.cut, references)}')
        return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f've verdict: {error}')
        return 1


def cmd_refs(args) -> int:
    """Write the reference sheets the Critic scores against: the cut's frames above each board card's frames."""
    from velib import refgate, verdict
    try:
        spec_file = spec_path_for(args.piece)
        spec = load_json(spec_file)
        directory = verdict.ve_dir(spec_file)
        qc = verdict.read(directory / f'qc.{args.cut}.json')
        video = verdict.video_path(qc, directory)
        if not video.is_file():
            raise ValueError(f'no QC-bound video for {args.cut}: run ve qc first')
        if not spec['brand'].get('references'):
            raise ValueError('the spec names no inspiration-board references (brand.references); read the board and add them')
        from velib import board
        problems, status = board.check(spec['brand']['references'])
        for problem in problems:
            print(f've refs: {problem}')
        if problems:
            print(f've refs: {len(problems)} reference problem(s) on the inspiration board; no sheet was made')
            return 1
        print(f've refs: board {status}')
        for path in refgate.sheets(spec, args.cut, directory, video):
            print(f've refs: {path}')
        # The cut in motion for the Critic: strips per beat, per move and per cut, and QC's numbers (velib.critic_inputs).
        from velib import critic_inputs
        if not (directory / f'props.{args.cut}.json').is_file():
            print(f've refs: no props.{args.cut}.json, so no motion strips for the Critic: run ve compile for this cut')
            return 0
        props, edl = critic_inputs.load_for(directory, args.cut)
        for path in critic_inputs.write(args.cut, directory, video, props, qc, edl, spec):
            print(f've refs: {path}')
        return 0
    except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError) as error:
        print(f've refs: {error}')
        return 1


def cmd_init(args) -> int:
    """Pre-fill brand.references on a piece's spec from the board's candidates, one card per role still unnamed,
    each marked offered: true for the session to confirm (ve lint refuses the flag). The spec is Claude's to write:
    this adds offers and changes nothing else."""
    from velib import board
    spec_file = spec_path_for(args.piece)
    spec = load_json(spec_file)
    added, status = board.offer(spec, args.format)
    if status != 'checked':
        print(f've init: board {status}; brand.references left as it was, take the cards from the board by hand')
        return 1
    if not added:
        print('ve init: every role already names a card, or the board offered none; nothing changed')
        return 0
    write_json(spec_file, spec)
    for ref in added:
        print(f"ve init: offered {ref['card']} ({ref['id']}) for {', '.join(ref['for'])}")
    print('ve init: open each offered card, confirm it serves this piece and delete "offered", or replace it')
    return 0


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
        print(f've packet: {out} (round {packet.rounds(directory)} of full cuts sent for this piece)')
        sheet = Path(out) / 'PACKET.md'
        if sheet.is_file():
            for line in sheet.read_text(encoding='utf-8').splitlines():
                if line.startswith('pace: '):
                    print(f've packet: {line}')
        from velib import gates
        print(f've packet: {gates.write_rounds(directory, packet.rounds(directory))}')
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
    from velib import filing
    record = load_json(directory / 'filed.json') if (directory / 'filed.json').is_file() else None
    try:
        root = filing.library_root()
    except ValueError:
        root = None
    ready = not problems
    print(f"lint: {'clean' if not problems else f'{len(problems)} finding(s)'}")
    for cut in spec['cuts']:
        state = packet.readiness(spec, cut, directory)
        mechanical, design, final = state['mechanical'], state['design'], state['final']
        if state.get('floor'):
            # Held means rebuild, never patch (Krish, 2026-11-19): one line, never a list of fixes.
            from velib import floor
            print(floor.held_line(cut, state['floor']))
            ready = False
            continue
        print(f'{cut}:')
        print('  mechanical: ' + ('INVALID (' + '; '.join(mechanical) + ')' if mechanical else 'VALID'))
        print('  design: ' + ('NOT APPROVED (' + '; '.join(design) + ')' if design else 'APPROVED'))
        codex = state.get('codex', [])
        if codex:
            print('  codex: ' + '; '.join(codex))
        # His final approval gates publishing only, never filing (Ruling, Krish, 2026-11-19): shown, not held.
        print('  publish: ' + ('APPROVED' if not final else
                               'awaits his Approve for publish on the board (' + '; '.join(final) + ')'))
        reasons = mechanical + design + codex
        print(f"{cut}: {'READY' if not reasons else 'NOT READY (' + '; '.join(reasons) + ')'}")
        # Done means in the post's 3 Posts folder, read back from the library, never from the receipt alone
        # (Ruling, Krish, 2026-11-03: "everything ready for post goes in the posts folder, not the growth folder").
        if not reasons:
            there, where = filing.delivered(record, root, cut)
            print(f"  delivered: {'DONE ' + where if there else 'NO (' + where + ')'}")
            reasons = [] if there else [where]
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


def _script_audit(directory, spec, take, path) -> None:
    """The three-way script audit of the take's cut (scripts/voice/script_audit.py), run as soon as its two clocks are
    written: the engine's draft, his approved words and what he said (Krish, 2026-11-18: "The whole system would learn
    so much from doing that after every video was produced"). Best effort, one line: it never fails the ingest. Only for
    a piece whose folder names its uuid (post.json), and never with SCRIPT_AUDIT_OFFLINE=1."""
    import os
    from velib import gates
    if os.environ.get('SCRIPT_AUDIT_OFFLINE') == '1':
        return
    piece = gates.piece_uuid(directory)
    if not piece:
        return
    sys.path.insert(0, str(Path(__file__).resolve().parent / 'voice'))
    import script_audit
    cut = script_audit.cut_of_take(take, list((spec.get('cuts') or {}).keys()) if isinstance(spec.get('cuts'), dict) else spec.get('cuts'))
    if not cut:
        print(f've ingest: script audit waits: take {take} does not say its cut (name it long-..., short-... or feature-...), '
              f'or run scripts/voice/script_audit.py report {piece} CUT --take {path}')
        return
    print(f've ingest: {script_audit.auto(piece, path, cut, Path(directory) / "audit")}')


def cmd_ingest(args) -> int:
    from velib import takes
    try:
        spec_file, spec, directory = _ve_dir(args.piece)
        path = takes.ingest(directory, spec['piece_id'], args.take, args.media, clock_a=args.clock_a, clock_b=args.clock_b,
                            aligner_a=args.aligner_a, aligner_b=args.aligner_b,
                            script_text=Path(args.teleprompter).read_text(encoding='utf-8-sig') if args.teleprompter else None)
        record = takes.load_take(directory, args.take)
        frame = record['media'].get('frame')
        size = f"{frame['width']}x{frame['height']} measured" if frame else 'no picture size measured'
        print(f"ve ingest: {args.take} ({record['media']['duration_s']} s; {len(record['aligners']['a']['words'])} words from "
              f"{record['aligners']['a']['name']}, {len(record['aligners']['b']['words'])} from {record['aligners']['b']['name']}; "
              f"frame {size}) -> {path}")
        _script_audit(directory, spec, args.take, path)
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
        from velib import hear, takes as take_records
        unheard = [name for name in (args.takes or take_records.list_takes(directory))
                   if hear.valid(take_records.load_take(directory, name)) is None]
        if unheard and not args.without_listen:
            raise ValueError(f"no listen pass for {', '.join(unheard)}: run ve hear {args.piece} --take <id> --ctc on the "
                             f"machine that holds the media (or --without-listen: fumbles only from the transcript)")
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
        unwritten = sum(len(f.get('unwritten', [])) for f in edl['flubs_removed'])
        if unwritten:
            print(f've conform: {unwritten} of the removed sounds were fumbles the transcript left out (ve hear)')
        for kept in edl['unscripted_kept']:
            print(f"  kept: \"{kept['word']}\" in line {kept['line']} ({kept['take']} at {kept['src_s']} s): no agreed gap lets it go")
        for row in edl.get('sounded_wrong', []):
            print(f"  for his ear: \"{row['word']}\" in line {row['line']} ({row['take']} at {row['src_s']} s): {'; '.join(row['why'])}")
        print(f've conform: {edl_path}\nve conform: {words_path}')
        from velib import faceflags
        cover = faceflags.write_cover(edl, directory)
        if cover:
            windows = load_json(cover)['windows']
            print(f've conform: {len(windows)} moment(s) in the cut a graphic could cover (ve faces; advisory, never '
                  f'changes the take): {cover}')
        if args.render:
            if not args.assets_dir:
                raise ValueError('--render needs --assets-dir')
            out = conform.render(edl, records, Path(args.assets_dir))
            for key in ('picture', 'dialogue'):
                if key in out:
                    print(f've conform: {out[key]} ({out[key + "_sha256"]})')
            for name, laid in (out.get('laid') or {}).items():
                print(f"ve conform: {name} {laid['laid']} at {laid['avg_rate']} fps"
                      + (f", {laid['hdr']} tone-mapped to BT.709" if laid.get('hdr') else ''))
            print(f"ve conform: ffmpeg {out.get('ffmpeg') or 'unknown'}")
            spoken = out.get('voice') or {}
            print(f"ve conform: voice pass: {spoken.get('sniffs', 0)} sniff(s) turned down 18 dB; repair chain "
                  f"{'on (his approval)' if spoken.get('repair') else 'off until he approves it by ear (ve voice-ab)'}")
            if args.joins_reel:
                reel = conform.joins_reel(edl, out['dialogue'], directory / f'joins.{args.cut}.wav')
                print(f've conform: joins reel {reel["reel"] or "(no joins)"}')
        return 0
    except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError) as error:
        print(f've conform: {error}', file=sys.stderr)
        return 1


def cmd_faces(args) -> int:
    """Where on a take he looks off the lens, closes his eyes or turns his head (advisory; F14)."""
    from velib import faceflags, takes
    try:
        _spec_file, _spec, directory = _ve_dir(args.piece)
        record = takes.load_take(directory, args.take)
        problem = takes.check_media(record)
        if problem:
            raise ValueError(problem)
        try:
            scanned = faceflags.scan(record['media']['path'])
        except ImportError:
            print('ve faces: mediapipe is not installed here (pip install mediapipe); nothing read', file=sys.stderr)
            return 1
        found = faceflags.flags(scanned)
        out = write_json(faceflags.faces_path(directory, args.take), {'take': args.take, 'media_sha256': record['media']['sha256'],
                                                                      **found, 'boxes': faceflags.boxes(scanned)})
        counts = {kind: sum(1 for w in found['windows'] if w['kind'] == kind) for kind in faceflags.KINDS}
        print(f"ve faces: {found['with_face']} of {found['samples']} samples see his face; "
              + ', '.join(f'{n} {kind.replace("_", " ")}' for kind, n in counts.items()) + ' window(s); advisory, uncalibrated')
        print(f've faces: {out}')
        return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f've faces: {error}', file=sys.stderr)
        return 1


def cmd_hear(args) -> int:
    """The listen pass: what is in the take's sound beyond the words the transcriber wrote (velib/hear.py)."""
    from velib import hear, lexicon, takes
    from velib.common import write_json as save
    try:
        _spec_file, _spec, directory = _ve_dir(args.piece)
        record = takes.load_take(directory, args.take)
        problem = takes.check_media(record)
        if problem:
            raise ValueError(problem)
        media = record['media']['path']
        doc = lexicon.load()
        ears = {}
        if args.ctc:
            ears['ctc:wav2vec2-960h'] = hear.ctc_words(media)
        if args.whisper:
            ears[f'whisper-verbatim:{args.whisper}'] = hear.whisper_words(media, args.whisper, lexicon_doc=doc)
        if not ears:
            print('ve hear: voice only; add --ctc (and --whisper large-v3) so hesitations the transcript left out are heard')
        record['listen'] = hear.listen(record, hear.decode(media), ears=ears, lexicon_doc=doc)
        save(takes.take_path(directory, args.take), record)
        block = record['listen']
        counted = hear.counts(block)
        print(f"ve hear: {args.take}: ears {', '.join(block['ears'])}; {len(block['quiet'])} quiet span(s); "
              f"{len(block['events'])} event(s): " + (', '.join(f'{k} {v}' for k, v in sorted(counted.items())) or 'none'))
        for ev in block['events'][:args.show]:
            print(f"  {ev['s']:7.2f}-{ev['e']:.2f} s  {ev['kind']:<10} {ev['use']:<5} {ev['text'] or '·':<10} {', '.join(ev['sources'])}")
        print(f've hear: {takes.take_path(directory, args.take)}')
        return 0
    except ImportError as error:
        print(f've hear: {error}: --ctc needs torch and torchaudio (CPU build), --whisper needs faster-whisper', file=sys.stderr)
        return 1
    except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError) as error:
        print(f've hear: {error}', file=sys.stderr)
        return 1


def cmd_lexicon(args) -> int:
    """His lexicon: what the engine has learned of the words he says (velib/lexicon.py)."""
    from velib import lexicon
    try:
        doc = lexicon.load()
        if args.action == 'learn':
            if not args.piece or not args.take or not args.teleprompter:
                raise ValueError('ve lexicon learn <piece> --take <id> --teleprompter <script.txt> (after ve said)')
            _spec_file, _spec, directory = _ve_dir(args.piece)
            report = load_json(directory / f'said.{args.take}.json')
            changed = lexicon.learn(doc, Path(args.teleprompter).read_text(encoding='utf-8-sig'), report)
            if changed.get('skipped'):
                print(f"ve lexicon: {changed['source']}: {changed['skipped']}")
                return 0
            path = lexicon.save(doc)
            print(f"ve lexicon: learned from {changed['source']}: {len(changed['terms'])} new term(s), "
                  f"{len(changed['fixes'])} mishearing(s), hesitations {changed['hesitations'] or 'none'}, "
                  f"added words {changed['added'] or 'none'} -> {path}")
        for line in lexicon.summary(doc):
            print(f've lexicon: {line}')
        return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f've lexicon: {error}', file=sys.stderr)
        return 1


def cmd_voice(args) -> int:
    """His voice profile in numbers, over every take a listen pass measured (velib/delivery.py); or, with `clone`, his
    approved clone reading an off-day voiceover short's signed script (velib/clone_voice.py)."""
    if args.action == 'clone':
        return cmd_voice_clone(args)
    from velib import delivery, hear, takes
    try:
        records = []
        for piece in args.pieces:
            _spec_file, _spec, directory = _ve_dir(piece)
            records += [takes.load_take(directory, name) for name in takes.list_takes(directory)]
        measured = [r for r in records if hear.valid(r)]
        if not measured:
            raise ValueError('no take with a listen pass: run ve hear first')
        doc = delivery.profile(measured)
        path = delivery.write_profile(doc, args.out)
        pitch, pace, tone = doc['pitch'], doc['pace'], doc['intonation']
        print(f"ve voice profile: {len(doc['takes'])} take(s); pitch median {pitch['median_hz']} Hz, range {pitch['range_st']} "
              f"semitones; phrase ends slope {tone['phrase_end_slope_st_s']} st/s; {pace['words_per_s_median']} words a "
              f"second; pause median {pace['pause_median_s']} s -> {path}")
        return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f've voice profile: {error}', file=sys.stderr)
        return 1


def cmd_voice_clone(args) -> int:
    """Off-day voiceover shorts may be voiced with his approved ElevenLabs clone; hero cuts stay on his real takes (Ruling,
    Krish, 2026-11-15). Plan by default (nothing spent); --generate runs exactly the plan printed, through the credit route."""
    from velib import clone_voice, verdict
    from velib.lint import schema
    try:
        if len(args.pieces) != 1:
            raise ValueError('ve voice clone takes one piece, or the path of its spec')
        if args.plan and args.generate:
            raise ValueError('--plan prints the generation; --generate runs it: give one')
        given = Path(args.pieces[0])
        spec_file = given if given.is_file() else spec_path_for(args.pieces[0])
        spec, problems = schema(spec_file)
        if spec is None:
            raise ValueError('the spec does not pass its schema: ' + '; '.join(problems[:5]))
        directory = verdict.ve_dir(spec_file)
        script = Path(args.script) if args.script else directory / 'script.words.json'
        if not script.is_file():
            raise ValueError(f'no signed script words at {script}: give --script')
        # No --voice: Record it myself until his default voice holds on a whole script (Ruling, Krish, 2026-11-17: "make
        # Record it myself the default until a voice passes"), which plan refuses with the Teleprompter route.
        from velib import voice_bank  # noqa: PLC0415
        voice = getattr(args, 'voice', None)
        if voice is None and voice_bank.default_voice(voice_bank.load()) == voice_bank.RECORD_MYSELF:
            voice = voice_bank.RECORD_MYSELF
        doc = clone_voice.plan(spec, script, voice=voice)
        plan_path = write_json(directory / clone_voice.PLAN_FILE, doc)
        clone, credits = doc['clone'], doc['credits']
        print(f"ve voice clone: {doc['piece']}, take {doc['take']} (cuts {', '.join(doc['cuts'])}; published {doc['publish_day']}, "
              'an off day)')
        if clone.get('kind') == 'stock':
            print(f"  voice: {clone['name']}, an ElevenLabs stock voice (voice id {clone['voice_id']}), approved by Krish on "
                  f"{clone['approved_on']} (config/voice-bank.json)")
        else:
            print(f"  clone: {clone['name']} ({clone['platform']}, voice id {clone['voice_id']}), approved by Krish on "
                  f"{clone['approved_on']} (registry sha256 {clone['approved_sha256'][:12]})")
        if doc.get('caution'):
            print(f"  caution: {doc['caution']}")
        print(f"  model: {doc['model']}; output: {doc['output_format']}, made into {doc['take']}.wav for ve ingest")
        print(f"  script: {doc['script']['file']} (sha256 {doc['script']['sha256'][:12]}, {doc['script']['words']} words)")
        print(f"  cost: {doc['characters']} characters, about {credits['estimate']} ElevenLabs credits ({credits['provider']}, "
              f"{credits['per_character']} a character; settled at what ElevenLabs reports)")
        print('  text, exactly as the clone will read it:')
        print(f"    {doc['text']}")
        print(f"  plan_sha256: {doc['plan_sha256']}  ({plan_path})")
        if not args.generate:
            print('ve voice clone: nothing generated or spent. To generate, on the machine that holds ELEVENLABS_API_KEY: book it '
                  f"with Control Center (reserve_credit_spend, pool elevenlabs, {credits['estimate']} credits), then\n"
                  f"  python scripts/ve.py voice clone {args.pieces[0]} --generate --plan-sha256 {doc['plan_sha256']} "
                  '--spend-id <its spend_id> --assets-dir <assets>')
            return 0
        receipt = clone_voice.generate(doc, plan_sha256=args.plan_sha256, spend_id=args.spend_id, assets_dir=args.assets_dir)
        receipt_path = write_json(directory / clone_voice.RECEIPT_FILE, receipt)
        spent = receipt['credits']
        print(f"ve voice clone: generated {receipt['voice']['name']} (sha256 {receipt['voice']['sha256'][:12]}) in {args.assets_dir}; "
              f"{spent['charged']:g} credits from {spent['charged_from']}, ledger reservation {spent['reservation']} settled "
              f"-> {receipt_path}")
        print(f"next: settle_credit_spend (spend_id {spent['spend_id']}, actual {spent['charged']:g}, job "
              f"{receipt.get('request_id') or 'none reported'}), then record_credit_balance")
        print('next: add this asset to the spec (every cut already takes it):')
        print('  ' + json.dumps(receipt['asset']))
        print(f"next: as for his recording: ve ingest {doc['piece']} --take {doc['take']} --media <assets>/{receipt['voice']['name']} "
              '(two local aligners), ve hear, ve said against the signed script, ve conform, ve premix, ve compile, ve proof; '
              'his Approve proof press hears the clone before any whole cut renders')
        return 0
    except SystemExit as stopped:  # the credit ledger refuses with a SystemExit naming the cap or the missing read
        print(f've voice clone: {stopped}', file=sys.stderr)
        return 1
    except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError) as error:
        print(f've voice clone: {error}', file=sys.stderr)
        return 1


def cmd_eyeline(args) -> int:
    """Eye gaze correction on a take, before ingest (velib/eyeline.py): his eyes toward the lens where they are off it,
    and nothing else changed. Krish, 2026-11-05: "For all post-processing of my makeyourmindup videos."
    """
    from velib import eyeline, qc_eyeline
    try:
        media = Path(args.media)
        if not media.is_file():
            raise ValueError(f'{media} is not a file')
        if args.out:
            out = Path(args.out)
        elif args.piece:
            _spec_file, _spec, directory = _ve_dir(args.piece)
            out = directory / 'eyeline'
        else:
            out = eyeline.EVAL_DIR / media.stem
        if args.lens:
            backend = eyeline.Calibrated(args.lens)
        elif args.backend == 'maxine':
            copy = args.maxine_copy
            if args.pod:
                from velib import maxine_pod
                pod = maxine_pod.run(media, out, yes=args.yes, max_usd=args.max_usd)
                print(f"ve eyeline: pod {pod['pod']} ran {pod['seconds']} s, about ${pod['cost_usd']}; "
                      f"terminated {pod.get('terminated')}")
                copy = pod['copy']
            backend = eyeline.Maxine(copy, eye=args.maxine_eye)
        else:
            backend = eyeline.BACKENDS[args.backend]()
        receipt = eyeline.run(media, out, backend, qc=None if args.no_qc else qc_eyeline.QC(), crf=args.crf)
        reasons = ', '.join(f'{k} {v}' for k, v in sorted(receipt['reasons'].items()))
        print(f"ve eyeline: {receipt['decision']}: {receipt['corrected_frames']} of {receipt['frames']} frames corrected "
              f"by {receipt['backend']} ({reasons})")
        for problem in receipt['problems']:
            print(f've eyeline: refused: {problem}')
        qc = receipt.get('qc') or {}
        for key in ('eye_flicker_ratio', 'seam_ratio'):
            if key in qc:
                print(f"ve eyeline: {key} {qc[key]} (proposed limit {qc['limits'][key]}, uncalibrated)")
        faces = qc.get('faces')
        if faces:
            print(f"ve eyeline: blinks {faces['before']['blinks']} before, {faces['after']['blinks']} after; off the lens "
                  f"{faces['before']['off_lens_s']} s before, {faces['after']['off_lens_s']} s after")
        for key in ('strips', 'loop'):
            if key in qc:
                print(f've eyeline: {qc[key]}')
        if receipt['decision'] != 'rejected':
            print(f"ve eyeline: {receipt['output']['path']}")
            if not backend.restricted:
                print(f"ve eyeline: next, ingest the corrected take: ve ingest <piece> --take <id> --media {receipt['output']['path']} ...")
            else:
                print(f've eyeline: {backend.name} is private evaluation only; its output is never ingested')
        return 0 if receipt['decision'] != 'rejected' else 1
    except (OSError, ValueError, KeyError, RuntimeError, ImportError, subprocess.CalledProcessError) as error:
        print(f've eyeline: {error}', file=sys.stderr)
        return 1


def cmd_said(args) -> int:
    """What he said on the take against the script he read (Krish, 4 Nov 2026: listen to the take, not the Teleprompter)."""
    from velib import said, takes
    try:
        _spec_file, _spec, directory = _ve_dir(args.piece)
        record = takes.load_take(directory, args.take)
        report = said.make(args.teleprompter, record, directory)
        rates = report['rates']
        print(f"ve said: {rates['said_words']} words said against {rates['script_words']} in the script; "
              f"{rates['own_words_pct']}% his own words; {rates['differences']} difference(s); "
              f"{report['heard_only']} word(s) heard only")
        rushed = [row for row in report['pace'] if row['rushed'] or row['pauses']]
        for row in rushed[:8]:
            notes = (['rushed'] if row['rushed'] else []) + [f"{p['pause_s']} s pause after \"{p['after']}\"" for p in row['pauses']]
            print(f"  line {row['line']} ({row['words_per_s']} words a second): {'; '.join(notes)}")
        for name in (f'said.{args.take}.md', f'said.{args.take}.json', 'script.words.proposed.json'):
            print(f've said: {directory / name}')
        print('ve said: read the proposal, then make it script.words.json; it is never applied by itself')
        return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f've said: {error}', file=sys.stderr)
        return 1


def cmd_voice_ab(args) -> int:
    """The 10-second pair Krish judges the voice repair chain by: his raw voice and the repaired one, delay removed."""
    from velib import voice
    try:
        _spec_file, _spec, directory = _ve_dir(args.piece)
        raw = Path(args.assets_dir) / f'dialogue.{args.cut}.raw.wav'
        if not raw.is_file():
            raise ValueError(f'{raw} is missing: run ve conform --render for this cut first')
        out = voice.ab(raw, directory / 'voice-ab', args.at, args.seconds)
        print(f"ve voice-ab: {out['raw']}\nve voice-ab: {out['repaired']}\nve voice-ab: chain delay {out['chain_latency_ms']} ms removed")
        print('ve voice-ab: play both to Krish; only his words in config/ve/voice-chain.json turn the chain on')
        return 0
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f've voice-ab: {error}', file=sys.stderr)
        return 1


def cmd_sfx(args) -> int:
    """The one sound on the big moment: audition the shortlist on his cut, approve only from his words, stage the kit."""
    from velib import sfx
    try:
        if args.action == 'approve':
            if not (args.id and args.words and args.on and args.audition):
                raise ValueError('approve needs --id, --words (his own), --on YYYY-MM-DD and --audition <sfx-audition.json>')
            kit = sfx.approve(args.id, args.words, args.on, Path(args.audition))
            print(f've sfx: {args.id} approved in his words; config/ve/sfx-kits/house-v1.json holds {len(kit)} sound(s)')
            return 0
        if args.action == 'stage':
            if not args.assets_dir:
                raise ValueError('stage needs --assets-dir')
            for sid, row in sorted(sfx.approved().items()):
                print(f've sfx: {sid} -> {sfx.stage(row, Path(args.assets_dir))}')
            return 0
        if not (args.piece and args.cut and args.assets_dir and args.candidates):
            raise ValueError('audition needs <piece> --cut --assets-dir --candidates <ids>')
        spec_file, spec, directory = _ve_dir(args.piece)
        props = load_json(directory / f'props.{args.cut}.json')
        from velib.render import render
        record = sfx.audition(spec, args.cut, directory, props, Path(args.assets_dir), args.candidates,
                              lambda p, o: render(p, o, args.scale), at_frame=args.at_frame, beat=args.beat)
        print(f"ve sfx: beat {record['beat']}, the moment at {record['at_s']} s")
        for row in record['candidates']:
            print(f"  {row['id']}: {directory / 'sfx' / row['clip']} (hit {row['hit_vs_voice_db']} dB against his voice, "
                  f"{row['level'] or 'not measured'})")
        print('ve sfx: play these to Krish; only his words approve one (ve sfx approve)')
        return 0
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        print(f've sfx: {error}', file=sys.stderr)
        return 1


def cmd_lab(args) -> int:
    """The style and caption lab: every drawable style and caption look on one window of his pinned take, outside
    any piece (Krish, 4 Nov 2026: "experiment carefully"); the same reel is the engine's regression check."""
    from velib import lab
    try:
        cfg = lab.config()
        out = Path(args.out) if args.out else lab.CACHE / lab.engine_id()

        def render_looks():
            if not (args.take and args.brand_dir):
                raise ValueError(f'{args.action} needs --take <the pinned recording> and --brand-dir <the brand marks>')
            assets = lab.stage(cfg, Path(args.take), Path(args.brand_dir), out)
            from velib.render import render
            manifest = lab.render(cfg, assets, lambda p, o: render(p, o, args.scale or cfg['scale']), out, args.only)
            print(f"ve lab: {len(manifest['looks'])} look(s) on engine {manifest['engine']} in {out}")
            return manifest

        if args.action == 'stills':
            folder = lab.stills_dir(out)   # refuses a folder in the repository before anything renders
            if args.take or args.brand_dir:
                render_looks()
            doc = lab.stills(out, args.only, cfg)
            print(json.dumps(doc, indent=1))
            print(f"ve lab: {len(doc['stills'])} still(s) at frame {doc['frame']} of the take in {folder}; look at each, "
                  'file it in Drive, then ve lab still <layer> <id> --drive <its Drive id> --file <the jpg>')
            return 0
        if args.action == 'covers':
            doc = lab.covers(out, args.only)
            print(f"ve lab: {len(doc['stills'])} cover(s) in {lab.stills_dir(out)}"
                  + (f"; not drawn: {', '.join(doc['missing'])}" if doc['missing'] else '')
                  + '; look at each, file it in Drive, then ve lab still <layer> <id> --drive <its Drive id> --file <the jpeg>')
            return 0
        if args.action == 'still':
            if len(args.target) != 2 or not args.drive_id:
                raise ValueError('still needs <layer> <id> (layer treatment, motion or captions), --drive <its file in Drive> '
                                 'and, from the lab, --file <the jpg>')
            layer, still_id = args.target
            lab.record_still(layer, still_id, args.drive_id, Path(args.file) if args.file else None)
            print(f've lab: the {layer} still of {still_id} is recorded (config/ve/style-samples.json stills; commit that file only)')
            return 0
        if args.target:
            raise ValueError(f'{args.action} takes no names: {" ".join(args.target)}')
        if args.action == 'render':
            manifest = render_looks()
            from velib import pace
            for look in manifest['looks']:
                if not look.get('same_as'):
                    print(f"ve lab: {look.get('id', look['file'])}: {pace.beside_references(out / look['file'])}")
            reel = lab.reel(out)
            print(f've lab: {reel}\nve lab: {lab.sheet(out)}')
            return 0
        if args.action == 'diff':
            if not args.against:
                raise ValueError('diff needs --against <an earlier lab folder>')
            report = lab.diff(out, Path(args.against))
            print(json.dumps(report, indent=1))
            print(f've lab: {lab.record(load_json(out / "manifest.json"), report, shot=lab.as_shot(out))}')
            return 1 if report['house_moved'] else 0
        if args.action == 'record':
            shot = lab.as_shot(out)
            moved = sorted(look for look, row in shot.items() if row['moved'])
            print(f've lab: as shot: {len(shot)} look(s) read; ' + (f"his room moved in {', '.join(moved)}" if moved
                  else 'none moved his room off the take'))
            print(f've lab: {lab.record(load_json(out / "manifest.json"), shot=shot)}')
            return 0
        if args.action == 'sample':
            if not (args.layer and args.module and args.drive_id):
                raise ValueError('sample needs --layer motion|captions, --module <the style> and --drive-id <its file in Drive> [--clip <the render>]')
            lab.record_sample(args.layer, args.module, args.drive_id, Path(args.clip) if args.clip else None)
            print(f've lab: {args.layer} {args.module} is the sample Pick a style shows (config/ve/style-samples.json)')
            return 0
        if not (args.module and args.verdict and args.on):
            raise ValueError('verdict needs --module, --verdict picked|seen|not-for-us, --said "<his words>" and --on <date>')
        m = lab.verdict(args.module, args.said, args.on, args.verdict)
        print(f"ve lab: {args.module} is {m.get('krish_verdict')} after {m.get('trials')} showing(s)")
        return 0
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        print(f've lab: {error}', file=sys.stderr)
        return 1


def _bound_post_folder(spec):
    """The post folder the piece is bound to now (making.py post_folder_of), or None before anything bound one. A piece
    whose binding cannot be read stops the filing: never a folder named from a guess (Krish, 2026-11-18: "bound to the
    piece in a bullet proof way")."""
    import re
    sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
    import making  # noqa: PLC0415
    piece = str(spec.get('piece_id') or '').lower()
    if not re.fullmatch(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', piece):
        return None
    try:
        return making.post_folder_of(piece)
    except making.MakingError as error:
        raise ValueError(f'the piece\'s post folder could not be read from the engine ({error}); nothing was filed') from error


def _bind_after_filing(spec, folder):
    """Binds the folder ve just filed into, when nothing bound one before (a writer binds only after its filing
    succeeded); says so loudly when another writer bound a different one in between."""
    import re
    sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
    import making  # noqa: PLC0415
    piece = str(spec.get('piece_id') or '').lower()
    if not re.fullmatch(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', piece):
        return
    try:
        bound = making.bind_post_folder(piece, folder)
    except making.MakingError as error:
        print(f've file: filed, but the post folder could not be bound on the piece ({error}); run ve file again to bind it', file=sys.stderr)
        return
    if bound != folder:
        print(f've file: another writer bound this piece to "{bound}" while this filed into "{folder}": tell Krish', file=sys.stderr)


def cmd_file(args) -> int:
    from velib import filing
    try:
        _spec_file, spec, directory = _ve_dir(args.piece)
        cuts = args.cut or list(spec['cuts'])
        from velib import showgate
        for cut_id in cuts:
            if spec['cuts'].get(cut_id, {}).get('excerpt'):
                continue
            ok, missing = showgate.state(spec, cut_id, directory)
            if not ok:
                print(f've file: refused: cut {cut_id} has no complete show receipt (docs/ve/ENGINE.md, "The show gate"):', file=sys.stderr)
                for line in missing[:8]:
                    print(f'  missing: {line}', file=sys.stderr)
                return 1
        bound = _bound_post_folder(spec)
        if not args.subject and not bound:
            raise ValueError('--subject is required: the topic the post folder is named by (the piece is bound to no folder yet)')
        if bound and args.subject:
            print(f've file: this piece is bound to the post folder "{bound}"; filing there')
        result = filing.file(spec, directory, cuts, subject=args.subject, when=args.date, archive_at=args.archive,
                             library_at=args.library, dry_run=args.dry_run, bound=bound)
        if not bound and not result.get('dry_run'):
            _bind_after_filing(spec, result['post_folder'])
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
    from velib import preflight as preflight_gate
    try:
        _spec_file, spec, directory = _ve_dir(args.piece)
        refused = [] if args.check else preflight_gate.problems(spec, directory, [args.cut] if args.cut else list(spec.get('cuts') or {}))
        if refused:
            print('ve brief: refused, read the standards first (the failure loop, from 9 Nov 2026):', file=sys.stderr)
            print('\n'.join(f'  - {reason}' for reason in refused), file=sys.stderr)
            return 1
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
            named = slot.get('status') == 'named'
            source = (slot.get('reference') or f"{slot.get('piece') or slot.get('piece_id')} ({slot.get('cut')} cut)") if named else ''
            said = f": \"{slot['said']}\"" if slot.get('said') else ' (his Approve on his board)' if slot.get('press') else ''
            print(f"{slot['slot']:4} " + (f"{source} at {slot['at']}{said}" if named else 'empty'))
        print(f"named {state['named']} of {state['min']} to {state['max']}; " +
              ('ready' if state['ready'] else f"waiting on Krish: {doc['fill']}"))
        moments = golden.interim(doc)
        print(f"interim: {len(moments)} Monday 26 moment(s) from config/reference-cuts.json serve beside them")
        return 1 if args.action == 'check' and not state['ready'] else 0
    except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError) as error:
        print(f've golden: {error}', file=sys.stderr)
        return 1


def signoffs_seconds(text: str) -> float:
    from velib import golden
    return golden.seconds(text)


def cmd_signoff(args) -> int:
    """The three video sign-offs as review cards on his Publish Board (Ruling, Krish, 2026-11-12): a session makes the
    samples (stills, gate2) and records each one filed in Drive (add); only his presses write the configs (apply)."""
    from velib import signoffs
    try:
        if args.action == 'check':
            problems = signoffs.validate(signoffs.load())
            print('\n'.join(problems) if problems else 've signoff: the manifest keeps its shape')
            return 1 if problems else 0
        if args.action == 'stills':
            found = signoffs.making_cut(args.piece, args.cut) if not args.path else {'path': args.path}
            out = Path(args.out)
            video = signoffs.library_fetch(found['path'], out / f'{args.piece[:8]}-{args.cut}.mp4', args.sha256)
            at = [signoffs_seconds(x) for x in args.at.split(',')] if args.at else None
            rows = signoffs.stills_for_cut(video, out, f'{args.piece[:8]}-{args.cut}', args.count, at)
            sheet = signoffs.contact_sheet([Path(r['file']) for r in rows], out / f'{args.piece[:8]}-{args.cut}-sheet.jpg',
                                           [r['at'] for r in rows])
            from velib.common import sha256_file
            write_json(out / f'{args.piece[:8]}-{args.cut}.json', {'piece_id': args.piece, 'cut': args.cut, 'path': found['path'],
                                                                     'cut_sha256': sha256_file(video), 'stills': rows})
            if not args.keep:
                video.unlink()
            print(f've signoff: {len(rows)} candidate frames from the {args.cut} cut; one look: {sheet}')
            return 0
        if args.action == 'gate2':
            from velib import designlock
            lock = designlock.load()
            entry = lock.get('drafts', {}).get(signoffs.GATE2_LOCK) or lock['formats'].get(signoffs.GATE2_LOCK)
            props = load_json(args.props)
            frames = signoffs.key_frames(props, entry['beats'])
            stills = signoffs.render_stills(Path(args.props), Path(args.out), frames)
            strip = signoffs.strip(stills, Path(args.out) / 'strip.jpg')
            for beat, path in stills.items():
                print(f've signoff: {beat} at frame {frames[beat]}: {path}')
            print(f've signoff: the four stills side by side: {strip}')
            return 0
        if args.action == 'add':
            item = json.loads(Path(args.item).read_text(encoding='utf-8'))
            row = signoffs.add_item(args.card, item, Path(args.file))
            print(f"ve signoff: {args.card} {row['id']} recorded ({row['sha256'][:12]})")
            return 0
        # apply: his presses, read from the engine, written into the configs through their own writers
        doc = signoffs.load()
        presses = json.loads(Path(args.presses).read_text(encoding='utf-8'))['presses'] if args.presses else signoffs.engine_presses()
        done = signoffs.apply(doc, signoffs.answers_of(presses), signoffs.engine_fetch_file, work=Path(args.work),
                              file_sound=signoffs.engine_file_sound)
        print('\n'.join(done) if done else 've signoff: nothing new to write')
        return 0
    except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError) as error:
        print(f've signoff: {error}', file=sys.stderr)
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
    if args.action == 'provisional':
        rows = ledger.provisional()
        for r in rows:
            print(f'{r["id"]}  {r["week"]}  {r["provider"]} {r["amount"]:g}  {r["note"]}  ({r.get("why", "")})')
        print(f've budget: {len(rows)} provisional reservation(s) to book with Control Center (reserve_credit_spend, '
              'engine growth-makeyourmindup, the provider\'s own pool), then ve budget reconcile ID --spend-id UUID')
        return 0
    if args.action == 'reconcile':
        if not (args.id and args.spend_id):
            print('ve budget reconcile: give the provisional id and --spend-id (the reserve_credit_spend answer)', file=sys.stderr)
            return 1
        try:
            ledger.reconcile(args.id, args.spend_id)
        except ValueError as error:
            print(f've budget reconcile: {error}', file=sys.stderr)
            return 1
        print(f've budget: {args.id} booked with Control Center as {args.spend_id}')
        return 0
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
    from velib import takes, verdict
    frame_source, take_frame = takes.cut_frame(spec, args.cut, verdict.ve_dir(Path(args.spec)))
    from velib import keepout
    ve = verdict.ve_dir(Path(args.spec))
    faces = {take: found for take in (sorted(edl['takes']) if edl is not None else [spec['cuts'][args.cut]['take']])
             if (found := keepout.track(ve, take)) is not None}
    props = compile_cut(spec, args.cut, words, args.assets_dir, report=report, edl=edl, take_frame=take_frame, faces=faces)
    if not faces:
        print('ve compile: no face track for this cut\'s take: nothing was kept off his face (run ve faces)')
    report['take_frame'] = {'source': frame_source, **(take_frame or {})}
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


def cmd_receipt(args) -> int:
    """The cut's validation receipt from its own piece folder (velib/receipt.py): what quality.delivery_problems reads
    before making.py records the cut or send.py files it. Prints each row and what still holds the cut."""
    from velib.receipt import build
    ve = ROOT / 'docs' / 'plans' / args.piece / 've'
    result = build(args.video, piece_id=args.piece_id, library_path=args.library_path, props=ve / f'props.{args.cut}.json',
                   spec=ve / 'spec.json', take_words=ve / 'words.json', voice_master=args.voice_master,
                   script=args.script,
                   rulings=ve / f'rulings.{args.cut}.json', qc=args.qc or ve / f'qc.{args.cut}.json',
                   verdict=args.verdict or ve / f'verdict.{args.cut}.json', clarity_dir=args.clarity, model=args.model)
    receipt = load_json(result['receipt'])
    for name, check in receipt['checks'].items():
        print(f"{check.get('status', '?'):15} {name}")
    for name, why in receipt['missing'].items():
        print(f"{'missing':15} {name}: {why}")
    print(chr(10).join(f'held: {p}' for p in result['problems']) or 'ready for delivery: quality.delivery_problems finds nothing')
    print(result['receipt'])
    return 1 if result['problems'] else 0


def bed_levels(levels: dict, bed: dict) -> dict:
    """The ledger's approved music levels for this cut, moved by the spec's trim_db (Krish's ear on the piece's music,
    never above the house levels). The premix records what it was given, so ve qc judges the bed by the same numbers."""
    trim = float(bed.get('trim_db') or 0)
    if trim > 0:
        raise ValueError(f'audio.bed.trim_db is {trim}: a bed is only ever turned down from the house levels')
    out = levels | {'chapter_lufs': levels.get('chapter_lufs', -22)}
    for key in ('intro_lufs', 'bed_lufs', 'outro_lufs', 'chapter_lufs'):
        if isinstance(out.get(key), (int, float)):
            out[key] = round(float(out[key]) + trim, 2)
    return out


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
        # A cut may name its own bed (cuts.<cut>.bed) when the piece's bed cannot hold its length to the one shape.
        if (spec['cuts'][args.cut].get('bed') or {}).get('ledger_id'):
            bed = {**bed, 'ledger_id': spec['cuts'][args.cut]['bed']['ledger_id']}
        ledger = load_json(MUSIC_LEDGER)
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
        # A cut that carries the series sting (props.sting, set by ve compile) has its frames in the stem where it plays:
        # straight after the hook (sting.atFrame). Every time from there on (his last word, lifts, clips, handovers)
        # moves by exactly those frames (velib.qc.to_file_s), and the stem runs the sting plus the cut. The sting's length
        # and place come from the props only, never a flag.
        from velib.qc import to_file_s  # noqa: PLC0415
        lead = int((props.get('sting') or {}).get('frames') or 0)
        at = int((props.get('sting') or {}).get('atFrame') or 0)
        moved = lambda t: to_file_s(float(t), props)  # noqa: E731
        lifts = [[moved(a), moved(b)] for a, b in (w.split('-', 1) for w in args.lift or [])]
        # The cut's own music plan (spec cuts.<cut>.music, Krish's words in its `said`): clips heard with their own
        # sound and a late bed, moved by the sting's frames like everything else on the stem's clock.
        plan = spec['cuts'][args.cut].get('music') or {}
        # A clip heard with its own sound, a handover or a lift that runs across the sting would play through it and
        # come back out of step with its picture: each sits wholly before the hook's end or after it.
        if at:
            at_s = at / fps
            across = [f"{w['asset']} {w['at_s']}-{w['end_s']}" for w in plan.get('clips') or [] if w['at_s'] < at_s < w['end_s']]
            across += [f'{a}-{b}' for a, b in [*(plan.get('handovers') or []), *((float(x), float(y)) for x, y in
                                                (w.split('-', 1) for w in args.lift or []))] if a < at_s < b]
            if across:
                raise ValueError(f'the sting plays at {at_s:.3f} s, after the hook; these run across it: {", ".join(across)}')
        clips = []
        if plan.get('clips'):
            if not args.assets_dir:
                raise ValueError('the cut\'s music plan names clips: give --assets-dir, the folder their asset paths are relative to')
            assets = {a['id']: a for a in spec.get('assets', [])}
            for clip in plan['clips']:
                asset = assets.get(clip['asset'])
                if asset is None or asset['kind'] not in ('broll', 'recording'):
                    raise ValueError(f"clip {clip['asset']} is not a broll or recording asset in the spec")
                src = Path(args.assets_dir) / asset['path']
                if sha256_file(src) != asset['sha256']:
                    raise ValueError(f"{src.name} does not match the spec's sha256 for {clip['asset']}")
                clips.append({**clip, 'src': str(src), 'at_s': moved(clip['at_s']), 'end_s': moved(clip['end_s']),
                              'points': [{'t': moved(p['t']), 'level': p['level']} for p in clip['points']]})
        result = audio.premix(args.dialogue, str(music), args.out, start_s, (lead + props['durationFrames']) / fps,
                              bed_start_s=float(track.get('intro_cue_s') or 0), under_vo_lu=bed['under_vo_lu'],
                              lufs=spec['audio'].get('targets', {}).get('lufs', -14), tp=spec['audio'].get('targets', {}).get('tp', -1),
                              mode=bed['mode'], last_word_end_s=moved(float(words[-1]['end_s']) - start_s),
                              levels=bed_levels(ledger['levels'], bed),
                              voice_start_s=moved(float(words[0]['onset_s']) - start_s), lifts=lifts, lead_frames=lead, fps=fps,
                              clips=clips, bed_enter_s=moved(plan['bed_enter_s']) if plan.get('bed_enter_s') else 0.0,
                              bed_fade_in_s=float(plan.get('bed_fade_in_s') or 0),
                              handovers=[[moved(a), moved(b)] for a, b in plan.get('handovers') or []], sting_at_frame=at)
        print(json.dumps({k: result[k] for k in ('stem', 'integrated_lufs', 'true_peak_dbtp', 'lead_frames')} | {'bed': {
            k: result['bed'].get(k) for k in ('mode', 'bed_lufs_in_master', 'crossfades_s', 'lifts', 'bed_under_speech_db', 'duck_depth_db')}}, indent=1))
        print(f've premix: {sha256_file(Path(args.out))}  {args.out}')
        return 0
    except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError) as error:
        print(f've premix: {error}', file=sys.stderr)
        return 1


def render_refusal(spec, spec_file, props, call=None) -> list[str]:
    """A whole cut of a piece published from MOTION_FROM renders only once Krish approved its moving proof (F04, F13):
    the proof file, the spec's structure and his press must all still agree (velib/proof.py)."""
    from velib import gates, proof, verdict
    cut = props.get('cutId')
    if cut not in (spec.get('cuts') or {}) or not proof.required(spec, cut):
        return []
    from velib import guards
    directory = verdict.ve_dir(Path(spec_file))
    found = gates.load(directory, spec, call)
    reasons = proof.problems(spec, cut, directory, found['gates'], props)
    # The Thursday 5 Nov guards (docs/learning/2026-11-04-thursday-killed.md): the engine of the proof he approved, two
    # full renders per press, one type system. The one engine gate is here: ve proof runs on the pinned engine by itself.
    reasons += guards.render_engine_problems(spec, cut, directory) + guards.loop_problems(spec, cut, directory, found['gates'])
    reasons += guards.type_problems(spec, props)
    if reasons and found['source'] != 'record':
        reasons.append(f"the piece's making record was {found['source']}; only the spec's approvals were read")
    return reasons


def cmd_render(args) -> int:
    try:
        # Before lint: a frozen piece is held to the rules and the engine it froze with, so when either moved on main the
        # whole command runs on its pinned commit, lint included (Ruling, Krish, 2026-11-19). A whole cut renders on the
        # engine its approved proof was drawn on; no engine hash is ever put to Krish.
        pinned = _pin_first(args.spec, 've render', getattr(args, 'props', None))
    except ValueError as error:
        print(f've render: {error}', file=sys.stderr)
        return 1
    if pinned is not None:
        return pinned
    from velib.lint import lint
    spec, problems = lint(Path(args.spec))
    if problems or spec is None:
        for problem in problems:
            print(problem)
        return 1
    from velib.render import check_asset_hashes, render
    from velib import preflight as preflight_gate, verdict
    check_asset_hashes(spec, args.assets_dir)
    props = load_json(args.props)
    unread = preflight_gate.problems(spec, verdict.ve_dir(Path(args.spec)), [props.get('cutId') or next(iter(spec['cuts']))])
    if unread:
        print('ve render: refused, read the standards first (the failure loop, from 9 Nov 2026):')
        print('\n'.join(f'  - {reason}' for reason in unread))
        return 1
    refused = render_refusal(spec, args.spec, props)
    if refused:
        print('ve render: refused, a whole cut renders only after Krish approves its moving proof (F04, F13) and holds '
              'to the Thursday guards (F33 to F36):')
        print('\n'.join(f'  - {reason}' for reason in refused))
        return 1
    from velib.sfx import missing_in_props
    gone = missing_in_props(props)
    if gone:
        # A sound the spec asks for is never dropped from a cut: it stops here, by name (ve compile stages approved
        # sounds from MINDMAKE_MUSIC_ROOT; run it again on a machine that has them).
        print('ve render: refused, a sound this cut plays is not on this machine (run ve compile again where '
              'MINDMAKE_MUSIC_ROOT holds it, or python scripts/quick-edit/music.py fetch):')
        print('\n'.join(f'  - {src}' for src in gone))
        return 1
    from velib.compile import sting_problems
    opening = sting_problems(props)
    if opening:
        # Nothing goes before the hook on any cut (Ruling, Krish, 2026-11-12: "Nothing before the hook, ever. Remove the
        # sting exception for good."; config/intro-sting.json, retired).
        print('ve render: refused, the cut must open on its hook:')
        print('\n'.join(f'  - {reason}' for reason in opening))
        return 1
    render(args.props, args.out, args.scale)
    from velib import guards, plainframes
    from velib.common import sha256_file
    cut = props.get('cutId')
    if cut in spec['cuts'] and not spec['cuts'][cut].get('excerpt') and Path(args.out).is_file():
        # F58: the rendered frames of a whole cut are read before it is recorded, never sent on a contact strip.
        seen = plainframes.check_frames(args.out, props)
        if seen.get('pass') is not True:
            print('ve render: the render is not recorded, its frames fail the v10 guards (plain dark areas, captions over content):')
            print('\n'.join(f'  - {line}' for line in plainframes.refusal_lines(seen)))
            return 1
    if cut in spec['cuts'] and not spec['cuts'][cut].get('excerpt') and Path(args.out).is_file():
        rows = guards.record_render(verdict.ve_dir(Path(args.spec)), cut, Path(args.out), sha256_file(args.out))
        print(f've render: full render {len(rows)} of {cut} recorded (two per press from Krish, then he sees it)')
    return 0


def _props_for(spec_file, cut, given):
    from velib import verdict
    path = Path(given) if given else verdict.ve_dir(Path(spec_file)) / f'props.{cut}.json'
    if not path.is_file():
        raise ValueError(f'no compiled props at {path}: run ve compile <spec> --cut {cut} first (the proof is cut from his take)')
    return path


def _show_target(args):
    """The file the gate is about: a whole cut (default) or the proof excerpt of it (--proof)."""
    from velib import proof
    spec_file, spec, directory = _ve_dir(args.piece)
    if args.cut not in spec['cuts']:
        raise ValueError(f'{args.cut} is not a cut in the spec')
    if args.proof:
        return spec, directory, proof.clip_path(directory, args.cut), f'proof.{args.cut}'
    return spec, directory, Path(args.clip) if args.clip else None, args.cut


def cmd_show_check(args) -> int:
    """`ve show-check <piece> --cut X [--proof]`: may this file be shown to Krish? Prints what is missing and writes the receipt."""
    from velib import showgate
    try:
        spec, directory, clip, label = _show_target(args)
        value = showgate.write(spec, args.cut, directory, clip, label)
        print(f"ve show-check: {label} {(value.get('cut_sha256') or '')[:12]} " + ('OK: receipt written, it may be shown to Krish' if value['ok'] else 'NOT READY'))
        for line in value['missing']:
            print(f'  missing: {line}')
        if not showgate.enforced(spec):
            print(f"ve show-check: this piece's publish_day is before {showgate.config()['enforce_from']}, so the board does not refuse it (config/ve/show-gate.json); the check is still honest")
        return 0 if value['ok'] else 1
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f've show-check: {error}', file=sys.stderr)
        return 1


def cmd_show_record(args) -> int:
    """`ve show-record <piece> --cut X --by NAME --frames 1,2.. --heard-s N --script --attest file.json`: record the full-size watch and listen."""
    from velib import showgate
    try:
        spec, directory, clip, label = _show_target(args)
        frames = [float(x) for x in args.frames.split(',') if x.strip()]
        attest = load_json(args.attest) if args.attest else {}
        path = showgate.record(spec, args.cut, directory, args.by, frames, float(args.heard_s), bool(args.script), attest, clip, label)
        print(f've show-record: {path}; now `ve show-check {args.piece} --cut {args.cut}' + (' --proof' if args.proof else '') + '`')
        return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f've show-record: {error}', file=sys.stderr)
        return 1


def cmd_defect(args) -> int:
    """`ve defect <piece> add --words "..." --where "..."` / `ve defect <piece> count`: faults Krish found himself (the target is zero)."""
    from velib import showgate
    try:
        _spec_file, _spec, directory = _ve_dir(args.piece)
        if args.action == 'add':
            showgate.defect_add(directory, args.words or '', args.where or 'unspecified', args.row)
        print(f've defect: {showgate.defect_count(directory)} found by Krish on this piece')
        return 0
    except (OSError, ValueError) as error:
        print(f've defect: {error}', file=sys.stderr)
        return 1


_ARGV: list[str] | None = None  # this run's own arguments (main sets it), so a pinned run can repeat them


def _exec_pinned(checkout: Path, argv: list[str]) -> int:
    """Run ve with these arguments from the pinned checkout's own scripts, in this same folder (the piece's files stay
    where they are; only the engine and the rules are the frozen ones)."""
    env = {**os.environ, 'VE_PINNED': '1'}
    return subprocess.run([sys.executable, str(checkout / 'scripts' / 've.py'), *argv], env=env).returncode


def _run_pinned(route: dict, label: str) -> int | None:
    """When the engine here is not the one this piece runs on (guards.engine_route, render_route), run this same command
    on the pinned commit and return its exit code; None means run here. Nothing is asked of Krish: the piece stays on the
    engine frozen at Sign storyboard (Ruling, Krish, 2026-11-19). Raises ValueError when the pin cannot be made."""
    from velib import guards
    if route.get('route') != 'pin' or os.environ.get('VE_PINNED') == '1' or not route.get('commit') or _ARGV is None:
        return None
    checkout = guards.pin_checkout(route['commit'], route['sha256'], route.get('rules_sha256'))
    argv = [str(Path(a).resolve()) if not a.startswith('-') and Path(a).exists() else a for a in _ARGV]
    print(f"{label}: the engine moved on main since this piece froze; running on its pinned engine {route['sha256'][:12]} "
          f"(commit {route['commit'][:12]}, {checkout})")
    return _exec_pinned(checkout, argv)


def _pin_first(spec_path, label: str, props_path=None) -> int | None:
    """Decide from the raw spec (no lint: lint is a rule, and a frozen piece's rules are its pinned commit's) whether this
    command runs here or on the pinned commit, and run it there if so. None means run here. A piece with no engine record
    (not frozen yet) reads nothing here, so lint still refuses before anything is read (test_lint_refuses_before_read_or_write)."""
    from velib import guards, verdict
    directory = verdict.ve_dir(Path(spec_path))
    if os.environ.get('VE_PINNED') == '1' or not guards.lock_path(directory).is_file():
        return None
    try:
        raw = load_json(Path(spec_path))
        cut = load_json(Path(props_path)).get('cutId') if props_path else None
    except (OSError, ValueError, AttributeError):
        return None
    if not isinstance(raw, dict):
        return None
    route = guards.render_route(raw, cut, directory) if cut else guards.engine_route(raw, directory)
    return _run_pinned(route, label)


def cmd_pin(args) -> int:
    """`ve pin <piece>`: make (or show) the checkout of the commit the engine was frozen at. ve proof and ve render use it
    by themselves whenever the engine here has moved; this only makes it ahead of time."""
    from velib import guards
    try:
        _spec_file, _spec, directory = _ve_dir(args.piece)
        lock = guards.lock_path(directory)
        if not lock.is_file():
            raise ValueError('no engine record: run ve expect first')
        record = load_json(lock)
        if not record.get('commit'):
            raise ValueError('ve expect recorded no commit for this engine: run ve expect again from a git checkout')
        checkout = guards.pin_checkout(record['commit'], record['sha256'], (record.get('rules') or {}).get('sha256'))
        print(f've pin: engine {record["sha256"][:12]} frozen at commit {record["commit"]}, checked out at {checkout}')
        print('  ve proof and ve render run there by themselves whenever the engine here differs; nothing to approve')
        return 0
    except (OSError, ValueError, KeyError) as error:
        print(f've pin: {error}', file=sys.stderr)
        return 1


def cmd_proof(args, render_fn=None) -> int:
    """Render only the cut's hardest beat from his real take, through the one render path, and record its hash."""
    from velib import proof, verdict
    from velib.lint import lint
    from velib.render import check_asset_hashes, render
    try:
        # Before lint: the proof runs on the engine and the rules frozen at Sign storyboard, here or on its pinned commit by
        # itself, lint included. The one engine gate is at render (render_refusal), and nothing asks Krish to approve an
        # engine hash (Ruling, Krish, 2026-11-19).
        pinned = _pin_first(args.spec, 've proof')
        if pinned is not None:
            return pinned
        spec, problems = lint(Path(args.spec))
        if problems or spec is None:
            print('\n'.join(problems[:20]) or 'the spec does not pass its schema')
            return 1
        if args.cut not in spec['cuts']:
            raise ValueError(f'{args.cut} is not a cut in the spec')
        if getattr(args, 'title_looked', None):
            from velib import guards as _guards
            proof.record_title_looked(verdict.ve_dir(Path(args.spec)), args.cut, args.title_looked, _guards._now())
            print(f've proof: recorded what you saw on the title frame for {args.cut}')
            return 0
        if getattr(args, 'compared', None):
            from velib import guards as _guards
            proof.record_compared(verdict.ve_dir(Path(args.spec)), args.cut, args.compared, _guards._now())
            print(f've proof: recorded what you compared for {args.cut}; the proof is sendable once its frames pass')
            return 0
        if args.assets_dir:
            check_asset_hashes(spec, args.assets_dir)
        chosen = json.loads(json.dumps(spec))
        if args.beat:
            chosen.setdefault('style', {})['proof'] = {'beat': args.beat}
        directory = verdict.ve_dir(Path(args.spec))
        props = load_json(_props_for(args.spec, args.cut, args.props))
        from velib import guards
        held = guards.type_problems(spec, props)
        if held:
            print('ve proof: refused (the Thursday guards, docs/learning/2026-11-04-thursday-killed.md):')
            print('\n'.join(f'  - {reason}' for reason in held))
            return 1

        def qc_fn(clip, props_path):
            from velib.qc import inputs_from_props, run_qc
            window = load_json(props_path)
            inputs = inputs_from_props(window)
            if window.get('aspect') == '9:16':
                inputs['composition_props'] = window
            inputs['frame_props'] = window
            inputs['kept_restarts'] = (spec['cuts'].get(window.get('cutId')) or {}).get('kept_restarts') or []
            from velib import showgate as _sg
            report = run_qc(str(clip), spec['format'], publish_day=max(str(spec.get('publish_day') or ''), _sg.effective_day(spec, directory) or ''), **inputs)
            write_json(Path(clip).with_suffix('.qc.json'), report)
            return report

        render_fn = render_fn or (lambda p, out: render(p, out, args.scale))
        # F58: the proof he last approved is kept, and the new one is put beside it when the engine or an asset changed.
        from velib import gates as _gates, plainframes
        proof.archive_previous(directory, args.cut)
        found = _gates.load(directory, spec)
        base_record, base_clip = proof.approved_baseline(directory, args.cut, found['gates'] if found.get('source') == 'record' else None)
        record = proof.make(chosen, args.cut, directory, props, render_fn, None if args.no_qc else qc_fn)
        # --beat chooses what is proved, never what the proof stands for: the hash is over the spec as written.
        record['spec_sha256'] = proof.structural_hash(spec, args.cut)
        record['structure'] = proof.structure(spec, args.cut)
        record['type'] = guards.type_treatments(props)  # listed for his Approve proof press, never refused by count
        record.update(proof.stamp(spec))
        record['made_at'] = guards._now()
        folder = proof.record_path(directory, args.cut).parent
        record['frames'] = plainframes.check_frames(str(proof.clip_path(directory, args.cut)), load_json(folder / f'props.{args.cut}.json'))
        if base_record is not None:
            reasons = proof.changed_since(base_record, spec)
            if reasons:
                compare = {'against': base_record.get('sha256'), 'reasons': reasons, 'compared': None}
                try:
                    compare.update(proof.compare_sheet(base_clip, proof.clip_path(directory, args.cut), folder / f'compare.{args.cut}.png',
                                                       float(base_record['end']) - float(base_record['start']),
                                                       float(record['end']) - float(record['start'])))
                except (OSError, ValueError, subprocess.CalledProcessError, ImportError) as error:
                    compare.update({'sheet': None, 'error': str(error)[:200]})
                record['compare'] = compare
        held_back = proof.sendable_problems(record)
        record['sendable'] = not held_back
        write_json(proof.record_path(directory, args.cut), record)
        print(f"ve proof: beat {record['beat']} ({record['rule']}), {record['start']} to {record['end']} s")
        if 'qc' in record:
            print(f"ve proof: qc {'measured pass' if record['qc'].get('measured_pass') else 'FAILS or not run'}; "
                  f"{'complete' if record['qc'].get('complete') else 'incomplete'}")
        print(f've proof: {guards.type_note(props)}')
        if record['structure'].get('voice'):
            asset, tool, sha = record['structure']['voice']
            print(f've proof: voiced by his approved clone ({tool}, {asset}, sha256 {str(sha)[:12]}), not his recording; '
                  'his Approve proof is his yes to this voice too, and a voice generated again needs it again')
        print(f"{record['sha256']}  {proof.clip_path(directory, args.cut)}")
        if held_back:
            print('ve proof: NOT SENDABLE to Krish (a proof visibly worse than the one he approved never reaches him; F58):')
            print('\n'.join(f'  - {reason}' for reason in held_back))
            return 1
        from velib import showgate
        pending = showgate.write(spec, args.cut, directory, proof.clip_path(directory, args.cut), f'proof.{args.cut}')
        if pending['ok']:
            print('ve proof: the show receipt is complete; file it on the piece so the board will take his Approve proof:')
            print(f'  python3 scripts/post-pack/board_session.py {spec["piece_id"]} add {showgate.receipt_path(directory, "proof." + args.cut)} --role show_receipt --kind note --title "Show receipt for the proof of {args.cut}"')
        else:
            print('ve proof: NOT yet shown-ready (nothing goes to Krish until it is): ve show-check lists what is missing:')
            for line in pending['missing'][:8]:
                print(f'  missing: {line}')
            print(f'next: record the watch (ve show-record {spec["piece_id"]} --cut {args.cut} --proof ...), then ve show-check {spec["piece_id"]} --cut {args.cut} --proof; only then does Krish press Approve proof')
            return 0
        print('next: Krish presses Approve proof (or Reject, with his words) on the board; ve render waits for it')
        return 0
    except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError) as error:
        print(f've proof: {error}', file=sys.stderr)
        return 1


def cmd_styles(args, render_fn=None) -> int:
    """The shortlisted motion styles, each rendered on the same window of his take, for his Pick a style press."""
    from velib import pace
    from velib import styles, verdict
    from velib.lint import lint
    from velib.render import render
    try:
        spec, problems = lint(Path(args.spec))
        if spec is None:
            print('\n'.join(problems[:20]) or 'the spec does not pass its schema')
            return 1
        cut = args.cut or next(iter(spec['cuts']))
        if cut not in spec['cuts']:
            raise ValueError(f'{cut} is not a cut in the spec')
        directory = verdict.ve_dir(Path(args.spec))
        own = Path(args.props) if args.props else directory / f'props.{cut}.json'
        label = "this piece's take"
        if not own.is_file():
            own = styles.last_take(spec, cut)
            if own is None:
                raise ValueError(f'no take is ingested for {spec["piece_id"]} and no earlier {spec["format"]} take is on '
                                 'record: ingest and compile his take first (never stock footage)')
            label = f'his last {spec["format"]} take ({own.parent.parent.name}), until this piece is recorded'
        points = [p.strip() for p in args.points.split(',') if p.strip()] if args.points else None
        def render_style(props_path, out, trial):
            # The trial spec is the style being drawn: its props must carry that style, or the clips would match.
            # The house clip, the look every option must differ from, carries no motion.
            drawn = (load_json(props_path).get('motion') or {}).get('style')
            wanted = ((trial.get('style') or {}).get('motion') or {}).get('module')
            if drawn != wanted:
                raise ValueError(f'{props_path} carries motion {drawn}, not {wanted or "the house motion"}')
            render(props_path, out, args.scale)
        render_fn = render_fn or render_style
        doc = styles.make(spec, cut, directory, load_json(own), render_fn, top=args.top, points=points, take_label=label)
        threshold = doc['distinctness']['threshold']
        for option in doc['options']:
            nearest = min(option['differs'].values())
            print(f"{option['module']}: {option['name']}  {option['file']}  ({option['why']}; differs by {nearest:g}, "
                  f"threshold {threshold:g})")
            print(f"  {pace.beside_references(directory / option['file'])}")
        for row in doc['skipped']:
            print(f"left out: {row['module']} ({row['why']})")
        if doc.get('note'):
            print(f"note: {doc['note']}")
        print(f've styles: {directory / "styles.json"} (on {label}); next: Krish presses Pick a style on the board')
        return 0
    except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError) as error:
        print(f've styles: {error}', file=sys.stderr)
        return 1


def cmd_expect(args) -> int:
    from velib import expect, verdict
    from velib.lint import lint
    spec, problems = lint(Path(args.spec))
    if spec is None:
        print('\n'.join(problems[:20]) or 'the spec does not pass its schema')
        return 1
    from velib import guards
    directory = verdict.ve_dir(Path(args.spec))
    path = expect.write(spec, directory)
    print(path.read_text(encoding='utf-8').rstrip())
    print(f've expect: {path}')
    # The storyboard sheet freezes the engine and the rules (Ruling, Krish, 2026-11-19): proof and render run on this
    # commit by themselves, and a rule dated after today binds the next piece.
    lock = guards.freeze(directory)
    print(f"ve expect: engine {lock['sha256'][:12]} and rules {lock['rules']['sha256'][:12]} frozen at commit "
          f"{lock.get('commit') or 'none'} ({len(lock['files'])} engine files, {len(lock['rules']['files'])} rule files); "
          'proof and render run on it by themselves, nothing to approve')
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
    a = actions.add_parser('retire', help="Krish's deletion of a frozen format's key frames for good: they leave the repository and the format returns to a draft")
    a.add_argument('format'); a.add_argument('--words', required=True, help='his exact words'); a.add_argument('--on', help='YYYY-MM-DD, default today')
    a = actions.add_parser('rules-only', help="Krish drops the picture-matching for a draft: it becomes a lock with no key frames, held to the rules, the Critic and his approval")
    a.add_argument('format'); a.add_argument('--words', required=True, help='his exact words'); a.add_argument('--on', help='YYYY-MM-DD, default today')
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
    p.add_argument('--publish-day', help="the piece's publish day (YYYY-MM-DD): the on-screen checks bind from config/ve/onscreen-checks.json binds_from")
    p.add_argument('--spec', help="the piece's spec: its publish day and the restarts it keeps on purpose (cuts.<id>.kept_restarts) for takes.restarts")
    p.add_argument('--script', help='the signed script, for words.lost')
    p.add_argument('--take-words', help="the take's words json, for words.lost")
    p.add_argument('--heard', action='append', metavar='ALIGNER=WORDS.json', help="an aligner's words for this render (repeatable)")
    p.add_argument('--transcribe', action='store_true', help='hear the render here with faster-whisper (no paid aligner)')
    p.add_argument('--captions-drawn-by', default='faster-whisper', help='the aligner whose words drew the captions')
    p.add_argument('--edl', help='the EDL ve conform wrote: QC measures its joins')
    p.set_defaults(fn=cmd_qc)
    p = sub.add_parser('receipt', help="write a cut's validation receipt from its piece folder (velib/receipt.py)")
    p.add_argument('video'); p.add_argument('--piece', required=True, help='the plan folder (docs/plans/PIECE/ve)')
    p.add_argument('--cut', required=True); p.add_argument('--piece-id', required=True, help="the making record's piece id")
    p.add_argument('--library-path', required=True, help='where the cut is filed (3 Posts/...)')
    p.add_argument('--script', required=True, help='the signed script, for the words gate')
    p.add_argument('--voice-master', required=True, help='the voice-only master the cut was mixed from, for the heard row')
    p.add_argument('--qc', help='ve qc on these bytes (default: the piece folder copy)')
    p.add_argument('--verdict', help='the Critic verdict on these bytes (default: the piece folder copy)')
    p.add_argument('--clarity', help='folder with visual-clarity.manifest.json and visual-clarity.review.json')
    p.add_argument('--model', default='small.en'); p.set_defaults(fn=cmd_receipt)
    p = sub.add_parser('keyframes', help='compare rendered beats with approved stills')
    p.add_argument('format'); p.add_argument('video'); p.add_argument('props'); p.add_argument('--sheet')
    p.set_defaults(fn=cmd_keyframes)
    p = sub.add_parser('study'); p.add_argument('ref'); p.add_argument('--out'); p.set_defaults(fn=cmd_study)
    p = sub.add_parser('pace', help='events a second, motion energy and frame use, beside the references he keeps')
    p.add_argument('video', nargs='?'); p.add_argument('--out'); p.add_argument('--seconds', type=float)
    p.add_argument('--refs', action='store_true'); p.add_argument('--dir', default=str(ROOT / '.cache' / 'references'))
    p.set_defaults(fn=cmd_pace)
    p = sub.add_parser('recipe', help="record Krish's rating of a style recipe, in his words")
    rsub = p.add_subparsers(dest='action', required=True)
    a = rsub.add_parser('rate', help='rate <id> <score 0-10> --words "..." or rate <id> --approved --words "..."')
    a.add_argument('id'); a.add_argument('score', nargs='?', type=float)
    a.add_argument('--approved', action='store_true', help='his approval with no number: records no score')
    a.add_argument('--words', required=True, help='his exact typed words'); a.add_argument('--on', help='YYYY-MM-DD, default today')
    p.set_defaults(fn=cmd_recipe)
    p = sub.add_parser('judge', help='the blind overall judge: the cut beside his references under letters, then its score')
    p.add_argument('piece'); p.add_argument('--cut', required=True); p.add_argument('--refs-dir')
    p.add_argument('--record', help='the judge JSON: {"scores": {letter: 0-10}, "notes": {...}}')
    p.add_argument('--by', default='ve-critic')
    p.set_defaults(fn=cmd_judge)
    p = sub.add_parser('beats', help='tempo, bars, drops and a confidence for a music bed; measured, never snapped to')
    p.add_argument('audio', nargs='?'); p.add_argument('--out')
    p.add_argument('--grid', nargs='?', const='', help='a ledger track id (or --all) read from MINDMAKE_MUSIC_ROOT')
    p.add_argument('--all', action='store_true'); p.add_argument('--write', action='store_true')
    p.set_defaults(fn=cmd_beats)
    p = sub.add_parser('card'); p.add_argument('fields'); p.set_defaults(fn=cmd_card)
    p = sub.add_parser('sprint', help='the weekly device sprint: brief, card, Gate 2 record (docs/ve/SPRINT.md)')
    actions = p.add_subparsers(dest='action', required=True)
    a = actions.add_parser('start'); a.add_argument('week'); a.add_argument('--ref', action='append', required=True)
    a = actions.add_parser('cards'); a.add_argument('week')
    a = actions.add_parser('gate2'); a.add_argument('device'); a.add_argument('--words', required=True)
    a.add_argument('--where', required=True); a.add_argument('--at', required=True)
    actions.add_parser('status')
    p.set_defaults(fn=cmd_sprint)
    p = sub.add_parser('dispatch'); p.add_argument('card'); p.add_argument('--wait', action='store_true')
    p.add_argument('--piece', help='refuse dispatch when this piece is over any budget cap')
    p.add_argument('--queue', action='store_true', help='send it to the Codex lane even when Codex is on this machine')
    # Codex is not counted (Ruling, Krish, 2026-11-17): an old --spend-id is accepted and ignored, never booked.
    p.add_argument('--spend-id', help=argparse.SUPPRESS)
    p.add_argument('--visible', action='store_true',
                   help="run under the Codex home his Desktop app reads, for social-media legwork started from his own "
                        "computer; video cards never use it (Ruling, Krish, 2026-11-15)")
    p.add_argument('--studio-home', action='store_true',
                   help="the default since 15 Nov: the Studio's own Codex home when built, NOT visible in Codex Desktop")
    p.add_argument('--dry-run', action='store_true', help='print the command it would launch and start nothing')
    p.set_defaults(fn=cmd_dispatch)
    p = sub.add_parser('codex', help="the Codex minimum: record Codex's checked share of a piece, or read it")
    actions = p.add_subparsers(dest='action', required=True)
    a = actions.add_parser('receipt', help='after Claude has checked the work: one receipt on the piece ledger')
    a.add_argument('piece'); a.add_argument('--card', required=True)
    a.add_argument('--job', required=True, choices=('art_direction', 'plates', 'device', 'browser'))
    a.add_argument('--evidence', required=True, help='the file Claude checked: a contact sheet, the chosen plate, verify output')
    a.add_argument('--verified-by', required=True, help='who checked it (never Codex)')
    a.add_argument('--cwd', help="the card's worktree, to find its Codex session log"); a.add_argument('--session')
    a = actions.add_parser('status'); a.add_argument('piece')
    actions.add_parser('where', help='the Codex homes dispatch runs under: the video route and the --visible route')
    a = actions.add_parser('route', help='the route and exact command a card would start Codex with here; starts nothing')
    a.add_argument('--visible', action='store_true', help='the --visible route (his Desktop home) instead of the video route')
    p.set_defaults(fn=cmd_codex)
    p = sub.add_parser('lane', help='the Codex lane: queue a card from any session; the home computer builds it')
    actions = p.add_subparsers(dest='action', required=True)
    actions.add_parser('route', help='local when Codex is on this machine, else queue')
    a = actions.add_parser('queue'); a.add_argument('card'); a.add_argument('--piece'); a.add_argument('--ref', default='main')
    a.add_argument('--spend-id', help=argparse.SUPPRESS)  # accepted and ignored: Codex is not counted
    a = actions.add_parser('build', help='on the machine with Codex: write the card, dispatch, verify-card, push its branch')
    a.add_argument('fields'); a.add_argument('--ref', default='main'); a.add_argument('--piece'); a.add_argument('--json', action='store_true')
    a.add_argument('--spend-id', help=argparse.SUPPRESS)  # accepted and ignored: a lane item queued before 17 Nov may carry one
    a = actions.add_parser('pending', help="the ventures' queued cards (config/codex-lanes.json)"); a.add_argument('--json', action='store_true')
    a = actions.add_parser('build-venture', help="on the machine with Codex: build one venture card and push codex/<id>")
    a.add_argument('venture'); a.add_argument('branch'); a.add_argument('path'); a.add_argument('--json', action='store_true')
    actions.add_parser('serve', help='the recordings pass: claim the next queued card and build it here or in WSL')
    actions.add_parser('status', help='the lane items and their state')
    a = actions.add_parser('wait', help='follow queued cards until each is built or failed (run it in the background right after queue)')
    a.add_argument('ids', nargs='+'); a.add_argument('--every', type=float, default=30); a.add_argument('--minutes', type=float, default=120)
    p.set_defaults(fn=cmd_lane)
    p = sub.add_parser('verify-card'); p.add_argument('card'); p.add_argument('--cwd', required=True); p.set_defaults(fn=cmd_verify_card)
    p = sub.add_parser('status'); p.add_argument('piece'); p.set_defaults(fn=cmd_status)
    p = sub.add_parser('verdict', help='record a hash-bound independent Critic review')
    actions = p.add_subparsers(dest='action', required=True)
    a = actions.add_parser('write'); a.add_argument('piece'); a.add_argument('cut')
    a.add_argument('--reviewer', required=True); a.add_argument('--findings', required=True)
    a.add_argument('--viewed', default='', help='comma-separated viewed frame times in seconds')
    a.add_argument('--references', help="JSON list of the Critic's scores against each board card (refgate)")
    a.set_defaults(fn=cmd_verdict)
    p = sub.add_parser('init', help="offer the board's top card per role into brand.references, marked offered")
    p.add_argument('piece'); p.add_argument('--format', help='prefer cards of this clip format (facets.format)')
    p.set_defaults(fn=cmd_init)
    p = sub.add_parser('critic', help="the Critic's two questions (one idea beside The Ladder; no invented numbers) before anything is made")
    p.add_argument('piece')
    p.add_argument('--pre', action='store_true')
    p.add_argument('--write', action='store_true')
    p.add_argument('--reviewer')
    p.add_argument('--answers')
    p.add_argument('--findings')
    p.set_defaults(fn=cmd_critic)
    p = sub.add_parser('refs', help="put the cut's frames beside each inspiration-board reference for the Critic")
    p.add_argument('piece'); p.add_argument('cut'); p.set_defaults(fn=cmd_refs)
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
    p.add_argument('--lift', action='append', metavar='FROM-TO', help='a chapter-card window in seconds on the cut\'s own clock (a sting in front is added by premix)')
    p.add_argument('--assets-dir', help="the piece's assets folder, for the clips a cut's music plan names")
    p.set_defaults(fn=cmd_premix)
    p = sub.add_parser('render', help='render compiled props through FormatMaster')
    p.add_argument('props'); p.add_argument('out'); p.add_argument('--scale', type=float, default=1.0)
    p.add_argument('--spec', required=True); p.add_argument('--assets-dir', required=True)
    p.set_defaults(fn=cmd_render)
    for name, fn, helptext in (('show-check', cmd_show_check, 'may this file be shown to Krish? lists what is missing, writes the show receipt'),
                               ('show-record', cmd_show_record, "record the full-size watch and listen and the checklist answers for this file")):
        p = sub.add_parser(name, help=helptext)
        p.add_argument('piece'); p.add_argument('--cut', required=True)
        p.add_argument('--proof', action='store_true', help="the proof excerpt of the cut, not the whole cut")
        p.add_argument('--clip', help='the rendered file (default: the file ve qc measured)')
        if name == 'show-record':
            p.add_argument('--by', required=True); p.add_argument('--frames', required=True, help='comma-separated seconds viewed at full size')
            p.add_argument('--heard-s', required=True, help='seconds of audio heard against the script'); p.add_argument('--script', action='store_true', help='the script was open beside it')
            p.add_argument('--attest', help='JSON {row_id: {"pass": true, "line": "one line citing a frame or time"}} for the checklist rows ve qc does not answer')
        p.set_defaults(fn=fn)
    p = sub.add_parser('defect', help='faults Krish found himself on a piece (target zero)')
    p.add_argument('piece'); p.add_argument('action', choices=('add', 'count'))
    p.add_argument('--words'); p.add_argument('--where'); p.add_argument('--row', help='the checklist row it should have been caught by')
    p.set_defaults(fn=cmd_defect)
    p = sub.add_parser('pin', help='check out the commit the engine was frozen at (ve proof and ve render use it by themselves)')
    p.add_argument('piece'); p.set_defaults(fn=cmd_pin)
    p = sub.add_parser('proof', help="render only the cut's hardest beat from his take; a whole cut waits for his approval of it")
    p.add_argument('spec'); p.add_argument('--cut', required=True); p.add_argument('--beat', help='prove this beat instead')
    p.add_argument('--props', help='default <ve dir>/props.<cut>.json'); p.add_argument('--assets-dir')
    p.add_argument('--scale', type=float, default=1.0); p.add_argument('--no-qc', action='store_true')
    p.add_argument('--title-looked', metavar='WORDS', help="record what you saw on the proof's title frame at full size (Ruling, Krish, 2026-11-19); renders nothing")
    p.add_argument('--compared', metavar='WORDS', help="record what you compared (every beat change at full size, beside the proof he approved and his standing notes); renders nothing")
    p.set_defaults(fn=cmd_proof)
    p = sub.add_parser('styles', help='render the proof window once per shortlisted motion style, for his pick')
    p.add_argument('spec'); p.add_argument('--cut'); p.add_argument('--top', type=int, default=3)
    p.add_argument('--points', help='comma list of point types; default from the spec'); p.add_argument('--props')
    p.add_argument('--scale', type=float, default=1.0)
    p.set_defaults(fn=cmd_styles)
    p = sub.add_parser('expect', help='write expect.md: at most six lines of what this cut will and will not do')
    p.add_argument('spec'); p.set_defaults(fn=cmd_expect)
    p = sub.add_parser('ledger', help='report or append piece usage against budget caps',
                       description='Show piece usage and OK/WARN/OVER budget checks. Exit 1 when over a cap.')
    p.add_argument('piece', help='piece folder name or existing directory')
    actions = p.add_subparsers(dest='action')
    a = actions.add_parser('add', help='append a usage entry and report the resulting totals',
                           description='Append usage without changing existing ledger lines.')
    a.add_argument('kind', choices=('claude_tokens', 'codex_tokens', 'credits',
                                   'engine_seconds', 'krish_wait_seconds'))
    a.add_argument('amount', type=float, help='finite non-negative amount')
    a.add_argument('--note', default='', help='description of this usage')
    a = actions.add_parser('reserve', help='reserve credits against the Control Center credit caps; refused over a cap',
                           description='Reserve before a dispatch or generation runs; settle it with what the provider charged.')
    a.add_argument('provider', choices=('runway_credits', 'higgsfield_credits', 'elevenlabs_credits'))
    a.add_argument('amount', type=float, help='finite non-negative amount')
    a.add_argument('--note', default='', help='what it is for')
    a = actions.add_parser('settle', help='record what a reservation really cost')
    a.add_argument('id'); a.add_argument('amount', type=float)
    p.set_defaults(fn=cmd_ledger)
    p = sub.add_parser('budget', help='pull, verify, hash or show the credit caps Control Center places on the publication')
    p.add_argument('action', choices=('pull', 'verify', 'hash', 'status', 'provisional', 'reconcile'))
    p.add_argument('id', nargs='?', help='reconcile: the provisional reservation id')
    p.add_argument('--spend-id', help='reconcile: the spend_id reserve_credit_spend returned')
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
    p.add_argument('--aligner-a', required=True, help='for example faster-whisper:large-v3 (the most accurate local model)')
    p.add_argument('--aligner-b', required=True, help='for example faster-whisper:medium.en (no paid aligner)')
    p.add_argument('--teleprompter', help='the script he read: its names prompt the local transcriber (with his lexicon)')
    p.set_defaults(fn=cmd_ingest)
    p = sub.add_parser('conform', help='choose takes line by line, remove flubs, cut only in agreed gaps, write the EDL')
    p.add_argument('piece'); p.add_argument('--cut', required=True); p.add_argument('--script')
    p.add_argument('--takes', nargs='+', help='take ids in preference order, later preferred (default: all ingested)')
    p.add_argument('--crossfade-ms', type=float, default=30.0, help='20 to 40 ms')
    p.add_argument('--render', action='store_true', help='render the conformed picture and dialogue in one graph')
    p.add_argument('--assets-dir'); p.add_argument('--joins-reel', action='store_true')
    p.add_argument('--without-listen', action='store_true',
                   help='conform a take with no listen pass (fumbles only from the transcript; no quiet check on joins)')
    p.set_defaults(fn=cmd_conform)
    p = sub.add_parser('hear', help='the listen pass: hesitations, broken words and unworded voice the transcript left out')
    p.add_argument('piece'); p.add_argument('--take', required=True)
    p.add_argument('--ctc', action='store_true', help='also hear with wav2vec2-960h letter by letter (needs torch)')
    p.add_argument('--whisper', help='also hear with a disfluent faster-whisper pass, for example large-v3')
    p.add_argument('--show', type=int, default=40, help='events to print')
    p.set_defaults(fn=cmd_hear)
    p = sub.add_parser('lexicon', help='his lexicon: names, mishearings, hesitations and the words he adds')
    p.add_argument('action', choices=('show', 'learn')); p.add_argument('piece', nargs='?')
    p.add_argument('--take'); p.add_argument('--teleprompter', help='the script text he read (as for ve said)')
    p.set_defaults(fn=cmd_lexicon)
    p = sub.add_parser('voice', help='his voice profile in numbers (profile); his approved clone reading an off-day '
                                     "voiceover short's signed script (clone: plan, or --generate)")
    p.add_argument('action', choices=('profile', 'clone')); p.add_argument('pieces', nargs='+')
    p.add_argument('--out', help='profile: default config/voice/profile.json')
    p.add_argument('--script', help="clone: the signed script words (default <ve dir>/script.words.json)")
    p.add_argument('--voice', help='clone: the voice bank id he picked on the Content Board (config/voice-bank.json); '
                                   'default his own Krish Remix voice, the registry clone')
    p.add_argument('--plan', action='store_true', help='clone: print and write the exact generation, spending nothing (the default)')
    p.add_argument('--generate', action='store_true',
                   help='clone: run the plan once, on the machine holding ELEVENLABS_API_KEY, through the credit ledger')
    p.add_argument('--plan-sha256', help='clone --generate: the plan_sha256 the plan printed')
    p.add_argument('--spend-id', help="clone --generate: the spend_id Control Center's reserve_credit_spend returned")
    p.add_argument('--assets-dir', help='clone --generate: where the voice is written (never committed)')
    p.set_defaults(fn=cmd_voice)
    p = sub.add_parser('faces', help='where on a take he looks off the lens, closes his eyes or turns his head (advisory)')
    p.add_argument('piece'); p.add_argument('--take', required=True)
    p.set_defaults(fn=cmd_faces)
    p = sub.add_parser('eyeline', help='eye gaze correction on a take before ingest: eyes toward the lens, sound and timing unchanged')
    p.add_argument('piece', nargs='?', help='the piece, for its ve folder (otherwise .cache/eyeline-eval/<take>)')
    p.add_argument('--media', required=True); p.add_argument('--out')
    p.add_argument('--backend', choices=('flx', 'maxine', 'identity'), default='flx',
                   help='flx: WangWilly/Hsu model, private evaluation only; maxine: NVIDIA Maxine Eye Contact on a rented RTX pod')
    p.add_argument('--maxine-copy', help="Maxine's redirected copy of the take, when it has already been made")
    p.add_argument('--maxine-eye', action='store_true',
                   help="also lay in Maxine's own eye on held glances past the push (off: it failed two blind reviews, 9 Nov)")
    p.add_argument('--lens', help="the eyeline receipt of a Maxine run on another take of the same session: its lens point, no pod")
    p.add_argument('--pod', action='store_true', help='make the Maxine copy on one rented RunPod RTX A5000 (spend)')
    p.add_argument('--yes', action='store_true', help="Krish approved this run's spend")
    p.add_argument('--max-usd', type=float, default=1.0, help='refuse a pod run that could cost more than this')
    p.add_argument('--crf', type=int, default=12); p.add_argument('--no-qc', action='store_true')
    p.set_defaults(fn=cmd_eyeline)
    p = sub.add_parser('said', help='what he said on a take against the script he read, and the words the cut should carry')
    p.add_argument('piece'); p.add_argument('--take', required=True)
    p.add_argument('--teleprompter', required=True, help='the script text he read (the Teleprompter script, saved as text)')
    p.set_defaults(fn=cmd_said)
    p = sub.add_parser('voice-ab', help='10 s of his raw and repaired voice for his by-ear call on the repair chain')
    p.add_argument('piece'); p.add_argument('--cut', required=True); p.add_argument('--assets-dir', required=True)
    p.add_argument('--at', type=float, required=True, help='start, in seconds of the conformed dialogue')
    p.add_argument('--seconds', type=float, default=10.0)
    p.set_defaults(fn=cmd_voice_ab)
    p = sub.add_parser('sfx', help='the one sound on the big moment: audition the shortlist, approve from his words, stage')
    p.add_argument('action', choices=('audition', 'approve', 'stage')); p.add_argument('piece', nargs='?')
    p.add_argument('--cut'); p.add_argument('--assets-dir'); p.add_argument('--candidates', nargs='+')
    p.add_argument('--at-frame', type=int); p.add_argument('--beat'); p.add_argument('--scale', type=float, default=0.5)
    p.add_argument('--id'); p.add_argument('--words'); p.add_argument('--on')
    p.add_argument('--audition', help="the piece's sfx-audition.json he heard the sound in")
    p.set_defaults(fn=cmd_sfx)
    p = sub.add_parser('lab', help='every drawable style and caption look on one window of his pinned take, outside any piece')
    p.add_argument('action', choices=('render', 'diff', 'record', 'verdict', 'sample', 'stills', 'still', 'covers'))
    p.add_argument('target', nargs='*', metavar='NAME', help='still: the layer (treatment, motion or captions) and the id')
    p.add_argument('--take'); p.add_argument('--brand-dir'); p.add_argument('--out'); p.add_argument('--against')
    p.add_argument('--layer', choices=('motion', 'captions'))
    p.add_argument('--drive-id', '--drive', dest='drive_id', help='its file id in Drive'); p.add_argument('--clip')
    p.add_argument('--file', help='still: the jpg filed in Drive (the lab\'s, for motion and captions)')
    p.add_argument('--scale', type=float); p.add_argument('--only', nargs='+')
    p.add_argument('--module'); p.add_argument('--verdict', choices=('picked', 'seen', 'not-for-us'))
    p.add_argument('--said', default=''); p.add_argument('--on')
    p.set_defaults(fn=cmd_lab)
    p = sub.add_parser('file', help="file READY cuts in the archive and the post's 3 Video folder, bound to piece_id")
    p.add_argument('piece'); p.add_argument('--subject'); p.add_argument('--date')
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
    p = sub.add_parser('signoff', help="the three video sign-offs as review cards on his board; only his presses write the configs")
    actions = p.add_subparsers(dest='action', required=True)
    actions.add_parser('check')
    a = actions.add_parser('stills', help='candidate golden frames from a published cut (the library copy)')
    a.add_argument('piece'); a.add_argument('--cut', choices=['long', 'short'], required=True)
    a.add_argument('--path', help='the library path, when the making record holds it relative to the post')
    a.add_argument('--sha256'); a.add_argument('--count', type=int, default=6); a.add_argument('--out', required=True)
    a.add_argument('--at', help='the times to cut, m:ss.s joined by commas (a reference moment); default: settled frames spread across it')
    a.add_argument('--keep', action='store_true', help='keep the downloaded cut')
    a = actions.add_parser('gate2', help='one still per locked beat of face-with-proof at 16:9, rendered from compiled props')
    a.add_argument('props'); a.add_argument('--out', required=True)
    a = actions.add_parser('add', help='record one sample filed in Drive (hashes the local copy)')
    a.add_argument('card', choices=['sfx', 'golden', 'gate2']); a.add_argument('--item', required=True, help='the item fields, a JSON file')
    a.add_argument('--file', required=True, help='the local copy of the exact bytes filed in Drive')
    a = actions.add_parser('apply', help="write his presses into the configs (signoff-apply.yml)")
    a.add_argument('--presses', help='his presses as a JSON file (tests); default: read from the engine')
    a.add_argument('--work', default=str(ROOT / '.ve-work' / 'signoff'))
    p.set_defaults(fn=cmd_signoff)
    p = sub.add_parser('stills'); p.add_argument('rest', nargs='*'); p.set_defaults(fn=not_yet('stills'))
    args = parser.parse_args()
    global _ARGV
    _ARGV = list(sys.argv[1:])
    return args.fn(args)


if __name__ == '__main__':
    sys.exit(main())
