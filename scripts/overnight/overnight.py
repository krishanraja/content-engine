#!/usr/bin/env python3
"""The overnight run on Krish's home computers (plan Wave 2, W2.6): no Claude on a timer, Codex and scripts only.

Ruling (Krish, 2026-10-29): "FYI, I want zero Claude routines. No Claude schedules of any kind in this architecture".
So nothing here is on a timer of its own. His Titles press starts it: the recordings pass on each computer
(scripts/recordings-upload.ps1, the windowless task that already polls the engine every five minutes) asks `due`, and
when every picked day of the week has its Titles press it starts `run` once, with no window (Krish, 2026-10-28:
"HIDE ALL CONSOLE POP UPS FOREVER"). The primary computer makes the long cuts and builds the Monday 06:30 board; the
standby makes the shorts (config/overnight.json, the setting MINDMAKE_OVERNIGHT_ROLE on each).

For each cut:
  1. produce it (at reduced scale when the route takes a scale);
  2. a fresh Critic judges its visuals and only names each failure and where it is (scripts/overnight/critic.py);
  3. a failure only a different take mends holds the cut; any other goes to the repairer, which changes the spec or
     regenerates plates, the cut is rendered again at reduced scale and a fresh Critic judges again, up to
     repair.max_rounds;
  4. once a Critic passes it, the full-scale render runs once, then the measured gates.
A cut that does not get through is held, with the reason. The run never publishes, sends or posts anything: Codex
steps run only under config/codex-profile.json, audited first, and the board is built by week_board.py from its own
inputs (--materials, one section per day naming each cut made and each cut held and why). When the board holds a cut
a repair could mend, one bounded repair round is started in GitHub Actions (.github/workflows/repair-round.yml).

    python3 scripts/overnight/overnight.py due [--week MONDAY] [--json]       exit 0 due, 3 not yet, 1 cannot tell
    python3 scripts/overnight/overnight.py run --role primary|standby --week MONDAY
    python3 scripts/overnight/overnight.py board --week MONDAY [--dry-run]
    python3 scripts/overnight/overnight.py status --role ROLE                 the lane block for the recordings pass
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import codex_profile  # noqa: E402
import critic  # noqa: E402

CONFIG = ROOT / 'config' / 'overnight.json'
DAYS = ('mon', 'wed', 'fri')
OFFSET = {'mon': 0, 'wed': 2, 'fri': 4}
# Why a cut is held, in the words the board shows. The lane report carries the code only.
REASONS = {
    'needs_new_take': 'the Critic named a failure only a different take mends, so it is held, not repaired',
    'critic_still_blocks': 'the Critic still named a failure after the repair rounds',
    'no_repairer': 'the Critic named a failure and no repairer is wired overnight',
    'critic_failed': 'the Critic gave no valid verdict',
    'produce_failed': 'the cut could not be made',
    'final_failed': 'the full-scale render failed',
    'gate_failed': 'a measured gate held it',
    'codex_profile': "Codex's tool profile failed its audit, so no Codex step ran",
    'not_wired': 'the step that makes it is not wired on this computer',
    'not_finished': 'its computer had not finished by the board time',
}
REPAIRABLE = {'critic_still_blocks', 'no_repairer', 'gate_failed', 'critic_failed'}


class RunError(Exception):
    pass


def load_config(path=None) -> dict:
    return json.loads(Path(path or CONFIG).read_text(encoding='utf-8'))


def state_root() -> Path:
    override = os.environ.get('MINDMAKE_OVERNIGHT_ROOT')
    return Path(override) if override else Path.home() / 'Documents' / 'MindmakeVideoStudio' / 'overnight'


def now_utc() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def stamp(t: dt.datetime) -> str:
    return t.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    os.replace(tmp, path)


def read_json(path: Path):
    try:
        return json.loads(Path(path).read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return None


# ---- the start: his Titles press --------------------------------------------------------------------------------

def due(picks_docs, titles_docs) -> dict:
    """Whether every picked day of the week has its Titles press (api/board/_contracts.ts: picks/<day> is his pick,
    picks/<day>-titles his Titles press). Pure."""
    picked = {d['id']: d.get('body') or {} for d in picks_docs or [] if d.get('id') in DAYS}
    pressed = {}
    for d in titles_docs or []:
        body = d.get('body') or {}
        day = body.get('day')
        if body.get('kind') == 'titles' and day in DAYS and d.get('id') == f'{day}-titles' and body.get('picks'):
            pressed[day] = body
    days = [day for day in DAYS if day in picked]
    waiting = [day for day in days if day not in pressed]
    pieces = {day: pressed[day].get('piece_id') for day in days if day in pressed and pressed[day].get('piece_id')}
    return {'due': bool(days) and not waiting, 'days': days, 'waiting': waiting, 'pieces': pieces}


def candidate_weeks(today: dt.date) -> list[str]:
    """The week the run serves: eight days after the recording Sunday (scripts/sunday_ideas.py), and on a Monday
    morning also last night's, since a press made late on Sunday is read after midnight."""
    sys.path.insert(0, str(ROOT / 'scripts'))
    import sunday_ideas
    weeks = [sunday_ideas.target_monday(today).isoformat()]
    if today.weekday() == 0:
        weeks.insert(0, sunday_ideas.target_monday(today - dt.timedelta(days=1)).isoformat())
    return weeks


def board_read(week: str, collection: str) -> list:
    sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
    import board_web
    docs, offset = [], 0
    while offset is not None:
        answer = board_web.call('GET', f'/api/board/{week}/{collection}' + (f'?offset={offset}' if offset else ''))
        docs += answer.get('documents') or []
        offset = answer.get('next_offset')
    return docs


def cmd_due(args, reader=board_read, today=None) -> int:
    today = today or dt.datetime.now(dt.timezone.utc).date()
    weeks = [args.week] if args.week else candidate_weeks(today)
    answer = None
    try:
        for week in weeks:
            answer = dict(due(reader(week, 'picks'), reader(week, 'titles')), week=week)
            if answer['due']:
                break
    except Exception as error:  # noqa: BLE001 - any failure to read is "cannot tell", never a start
        print(json.dumps({'due': False, 'error': type(error).__name__}))
        return 1
    print(json.dumps(answer) if args.json else ('due' if answer['due'] else f'not yet: waiting on {", ".join(answer["waiting"]) or "a pick"}'))
    return 0 if answer['due'] else 3


# ---- one cut ------------------------------------------------------------------------------------------------------

def expand(argv, values: dict) -> list[str]:
    out = []
    for part in argv:
        if part == '{materials}':
            out += [x for day, path in values.get('materials', {}).items() for x in ('--materials', f'{day}={path}')]
            continue
        out.append(str(part).format(**{k: v for k, v in values.items() if not isinstance(v, dict)}))
    return out


def last_json(text: str):
    for line in reversed((text or '').strip().splitlines()):
        line = line.strip()
        if line.startswith('{'):
            try:
                return json.loads(line)
            except ValueError:
                return None
    return None


def run_step(step, values, runner) -> tuple[int, dict | None, str]:
    proc = runner(expand(step['argv'], values))
    tail = ((proc.stderr or '') + (proc.stdout or '')).strip().splitlines()[-1:] or ['']
    return proc.returncode, last_json(proc.stdout), tail[0][:200]


def default_runner(argv):
    flags = 0x08000000 if sys.platform == 'win32' else 0  # CREATE_NO_WINDOW: no console, ever
    return subprocess.run(argv, cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace',
                          stdin=subprocess.DEVNULL, creationflags=flags)


def calibrated() -> bool:
    record = read_json(state_root() / 'critic-calibrated.json')
    if not isinstance(record, dict) or record.get('schema') != 'critic-calibrated/1':
        return False
    return record.get('manifest_sha256') == critic._sha(critic.CALIBRATION)


def make_cut(job: dict, config: dict, runner, codex_ok: bool, is_calibrated: bool) -> dict:
    """One cut through produce, Critic, repair and the single full-scale render. Returns its record."""
    steps, repair = config['steps'], config['repair']
    record = {'day': job['day'], 'cut': job['cut'], 'piece_id': job['piece_id'], 'status': 'held', 'reason_code': None,
              'reason': None, 'where': None, 'file': None, 'url': None, 'rounds': [], 'renders': [], 'judged': False}

    def held(code, where=None, detail=None):
        record.update(status='held', reason_code=code, where=where,
                      reason=REASONS[code] + (f': {where}' if where else '') + (f' ({detail})' if detail else ''))
        return record

    def usable(name):
        step = steps.get(name)
        if not step:
            return None
        if step.get('codex') and not codex_ok:
            raise RunError('codex_profile')
        return step

    values = dict(job)
    try:
        produce = usable('produce')
    except RunError:
        return held('codex_profile')
    if not produce:
        return held('not_wired', detail='produce')
    scale = repair['reduced_scale'] if produce.get('takes_scale') else repair['full_scale']

    def render(step, at_scale, what):
        code, answer, tail = run_step(step, dict(values, scale=at_scale), runner)
        record['renders'].append({'step': what, 'scale': at_scale, 'exit': code})
        if code != 0 or not answer or not answer.get('file'):
            return None, tail
        return answer, tail

    answer, tail = render(produce, scale, 'produce')
    if not answer:
        return held('produce_failed', detail=tail)
    try:
        judge, fix = usable('critic'), usable('repair')
    except RunError:
        return held('codex_profile')
    critics = []
    if judge and is_calibrated:
        record['judged'] = True
        for round_no in range(1, repair['max_rounds'] + 2):
            code, verdict, tail = run_step(judge, dict(values, file=answer['file'], scale=scale, round=round_no,
                                                       earlier=','.join(critics)), runner)
            problems = critic.validate(verdict) if isinstance(verdict, dict) else ['no verdict']
            if not problems:
                problems = critic.check_fresh(verdict, critics, [r.get('repairer') for r in record['rounds'] if r.get('repairer')])
            if code != 0 or problems:
                return held('critic_failed', detail='; '.join(problems)[:200] or tail)
            critics.append(verdict['critic_id'])
            decision = critic.decide(verdict)
            record['rounds'].append({'round': round_no, 'critic_id': verdict['critic_id'], 'scale': scale, 'decision': decision})
            if decision == 'pass':
                break
            where = critic.first_failure(verdict)
            if decision == 'hold':
                return held('needs_new_take', where)
            if round_no > repair['max_rounds']:
                return held('critic_still_blocks', where)
            if not fix:
                return held('no_repairer', where)
            findings = state_root() / 'work' / f'{job["day"]}-{job["cut"]}-findings-{round_no}.json'
            write_json(findings, verdict)
            code, fixed, tail = run_step(fix, dict(values, findings=str(findings), round=round_no), runner)
            if code != 0:
                return held('critic_still_blocks', where, detail=f'the repair failed: {tail}')
            record['rounds'][-1]['repairer'] = (fixed or {}).get('repairer') or 'repairer'
            # The repair is rendered again at reduced scale, and a fresh Critic judges it on the next round.
            answer, tail = render(produce, scale, 'repair render')
            if not answer:
                return held('produce_failed', detail=tail)
    final = steps.get('final')
    if final:
        answer, tail = render(final, repair['full_scale'], 'final')
        if not answer:
            return held('final_failed', detail=tail)
    elif scale != repair['full_scale']:
        raise RunError('a route that renders at reduced scale needs a final full-scale step')
    gates = steps.get('gates')
    if gates:
        code, verdict, tail = run_step(gates, dict(values, file=answer['file']), runner)
        if code != 0 or not (verdict or {}).get('ok'):
            return held('gate_failed', detail=', '.join((verdict or {}).get('failed') or [])[:200] or tail)
    record.update(status='made', file=answer['file'], url=answer.get('url'))
    return record


# ---- the run --------------------------------------------------------------------------------------------------------

def jobs_for(role, week, pressed, config) -> list[dict]:
    monday = dt.date.fromisoformat(week)
    return [{'day': day, 'cut': cut, 'piece_id': pressed[day], 'week': week, 'python': sys.executable,
             'date': (monday + dt.timedelta(days=OFFSET[day])).isoformat()}
            for day in DAYS if day in pressed for cut in config['roles'][role]['cuts']]


def run_path(week: str, role: str) -> Path:
    return state_root() / week / f'run-{role}.json'


def run(role, week, pressed, config, runner=default_runner, clock=now_utc) -> dict:
    """Makes this computer's cuts for the week, once. Returns the run record (also kept at run_path)."""
    if role not in config['roles']:
        raise RunError(f'role must be one of {", ".join(config["roles"])}')
    path = run_path(week, role)
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with open(path.with_name(f'started-{role}'), 'x', encoding='utf-8') as handle:
            handle.write(stamp(clock()) + '\n')
    except FileExistsError:
        raise RunError(f'the {role} run for the week of {week} has started already') from None
    codex_ok = not codex_profile.audit(codex_profile.load())
    record = {'schema': 'overnight-run/1', 'week': week, 'role': role, 'state': 'running', 'started_at': stamp(clock()),
              'finished_at': None, 'codex_profile_ok': codex_ok, 'critic_calibrated': calibrated(), 'cuts': []}
    write_json(path, record)
    for job in jobs_for(role, week, pressed, config):
        try:
            cut = make_cut(job, config, runner, codex_ok, record['critic_calibrated'])
        except RunError as error:
            cut = {'day': job['day'], 'cut': job['cut'], 'piece_id': job['piece_id'], 'status': 'held',
                   'reason_code': 'not_wired', 'reason': f'{REASONS["not_wired"]} ({error})', 'where': None}
        record['cuts'].append(cut)
        write_json(path, record)
    record.update(state='finished', finished_at=stamp(clock()))
    write_json(path, record)
    return record


def lane_block(record) -> dict | None:
    """The run as the recordings pass sends it (api/library/_lanes.ts, parseOvernightHealth): codes, days and times,
    never a path or a message."""
    if not isinstance(record, dict):
        return None
    return {'week': record.get('week'), 'role': record.get('role'), 'state': record.get('state'),
            'started_at': record.get('started_at'), 'finished_at': record.get('finished_at'),
            'critic_calibrated': bool(record.get('critic_calibrated')),
            'cuts': [{'day': c.get('day'), 'cut': c.get('cut'), 'status': c.get('status'), 'reason_code': c.get('reason_code'),
                      'where': str(c['where']).split(': ', 1)[0] if c.get('where') else None,
                      'url': c.get('url')} for c in record.get('cuts') or []]}


# ---- the Monday board -----------------------------------------------------------------------------------------------

def other_from_lane(week, role) -> dict | None:
    """The other computer's run, from its last lane report (GET /api/library/recordings/lane, the engine key)."""
    sys.path.insert(0, str(ROOT / 'scripts'))
    import engine
    status, text = engine.call('GET', '/api/library/recordings/lane', None, engine.operator_key(), timeout=60)
    if status != 200:
        return None
    for report in json.loads(text).get('reports') or []:
        block = report.get('overnight') or {}
        if block.get('week') == week and block.get('role') == role:
            return block
    return None


def materials_for(day, piece_id, cuts, previous=None, calibrated_critic=True) -> dict:
    """The day's materials (scripts/post-pack/board_materials.py): what it held before, with one section naming every
    cut the overnight run made and every cut it held, and why. A held cut, or one no calibrated Critic judged, keeps
    the day on a review hold."""
    base = dict(previous or {})
    sections = [s for s in base.get('sections') or [] if s.get('id') != 'overnight']
    held = [c for c in cuts if c['status'] != 'made']
    made = [c for c in cuts if c['status'] == 'made']
    copy = []
    for c in cuts:
        label = f'{c["cut"].capitalize()} cut: ' + ('made' if c['status'] == 'made' else 'held')
        text = (c.get('reason') or REASONS.get(c.get('reason_code') or '', 'held')) if c['status'] != 'made' \
            else ('Made overnight.' + ('' if calibrated_critic else ' Not judged by a calibrated Critic yet: watch it before anyone calls it ready.'))
        if c['status'] != 'made' and c.get('where') and c['where'] not in text:
            text += f': {c["where"]}'
        copy.append({'label': label, 'text': text})
    files = [{'label': f'{c["cut"].capitalize()} cut', 'url': c['url']} for c in made if str(c.get('url') or '').startswith('https://')]
    section = {'id': 'overnight', 'title': 'Made overnight', 'copy': copy}
    if files:
        section['files'] = files
    names = ', '.join(f'the {c["cut"]} cut ({REASONS.get(c.get("reason_code") or "", "held")})' for c in held)
    note = (f'Overnight run: {len(made)} of {len(cuts)} cuts made.' + (f' Held: {names}.' if held else '')
            + ('' if calibrated_critic else ' No calibrated Critic judged them yet.'))
    status_before = base.get('status_before_overnight', base.get('status', 'ready'))
    ready = not held and calibrated_critic and status_before == 'ready'
    # What the day said before stays after this run's line; this run's line replaces an earlier run's.
    before = str(base.get('note_before_overnight', base.get('note')) or '').strip()
    return dict(base, piece_id=piece_id, status='ready' if ready else 'review', note_before_overnight=before,
                status_before_overnight=status_before,
                note=f'{note} {before}'.strip(), sections=sections + [section])


def board(week, records, config, runner=default_runner, dry_run=False) -> dict:
    """Builds the week's board from week_board.py's inputs: the current board as --previous, and one --materials
    file a day. Returns what it did, including the held cuts and whether a repair round was started."""
    sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
    import board_materials
    work = state_root() / week / 'board'
    work.mkdir(parents=True, exist_ok=True)
    values = {'week': week, 'python': sys.executable, 'previous': str(work / 'previous.html'), 'page': str(work / 'week-board.html')}
    steps = config['board_steps']
    code, _, tail = run_step({'argv': steps['download']}, values, runner)
    if code != 0:
        raise RunError(f'the current board could not be read: {tail}')
    try:
        previous = board_materials.previous(Path(values['previous']).read_text(encoding='utf-8-sig'))
    except OSError:
        previous = {}
    cuts = [c for r in records if r for c in r.get('cuts') or []]
    judged = all(r.get('critic_calibrated') for r in records if r)
    materials = {}
    for day in DAYS:
        mine = [c for c in cuts if c.get('day') == day]
        if not mine:
            continue
        piece = next((c.get('piece_id') for c in mine if c.get('piece_id')), None) or (previous.get(day) or {}).get('piece_id')
        path = work / f'materials-{day}.json'
        write_json(path, materials_for(day, piece, mine, previous.get(day), judged))
        materials[day] = str(path)
    held = [c for c in cuts if c.get('status') != 'made']
    result = {'week': week, 'held': [{'day': c['day'], 'cut': c['cut'], 'reason_code': c.get('reason_code')} for c in held],
              'built': False, 'published': False, 'repair_round': None}
    if dry_run:
        result['materials'] = materials
        return result
    code, _, tail = run_step({'argv': steps['build']}, dict(values, materials=materials), runner)
    if code != 0:
        raise RunError(f'week_board.py refused the build: {tail}')
    result['built'] = True
    code, _, tail = run_step({'argv': steps['publish']}, values, runner)
    if code != 0:
        raise RunError(f'the board was built but not published: {tail}')
    result['published'] = True
    result['repair_round'] = repair_round(week, held, config, runner)
    return result


def repair_round(week, held, config, runner) -> str | None:
    """One bounded repair round in GitHub Actions when a held cut is one a repair could mend; never a schedule."""
    mendable = [c for c in held if c.get('reason_code') in REPAIRABLE]
    if not mendable:
        return None
    setting = config.get('repair_round') or {}
    if setting.get('dispatch') != 'gh' or not shutil.which('gh'):
        return 'wanted'
    cuts = ','.join(f'{c["day"]}-{c["cut"]}' for c in mendable)
    proc = runner(['gh', 'workflow', 'run', setting['workflow'], '--repo', 'krishanraja/content-engine',
                   '-f', f'week={week}', '-f', f'cuts={cuts}'])
    return 'dispatched' if proc.returncode == 0 else 'wanted'


def wait_for_other(week, role, config, read=other_from_lane, clock=now_utc, sleep=time.sleep):
    """The other computer's finished run, or what it has when the board must be built."""
    import zoneinfo
    zone = zoneinfo.ZoneInfo(config['board']['timezone'])
    hour, minute = (int(x) for x in config['board']['wait_for_other_until'].split(':'))
    start = clock().astimezone(zone)
    deadline = start.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if deadline <= start:
        deadline += dt.timedelta(days=1)
    while True:
        try:
            block = read(week, role)
        except Exception:  # noqa: BLE001 - an unreachable engine is waited out like an unfinished run
            block = None
        if block and block.get('state') == 'finished':
            return block
        if clock().astimezone(zone) >= deadline:
            return block
        sleep(config['board']['poll_minutes'] * 60)


def unfinished(block, role, week, pressed, config) -> dict:
    """The other computer's cuts it had not finished by the board time, each named as held."""
    done = {(c['day'], c['cut']): c for c in (block or {}).get('cuts') or [] if c.get('status') in ('made', 'held')}
    cuts = []
    for job in jobs_for(role, week, pressed, config):
        c = done.get((job['day'], job['cut']))
        if c:
            cuts.append(dict(c, piece_id=job['piece_id'], reason=REASONS.get(c.get('reason_code') or '', None)))
        else:
            cuts.append({'day': job['day'], 'cut': job['cut'], 'piece_id': job['piece_id'], 'status': 'held',
                         'reason_code': 'not_finished', 'reason': REASONS['not_finished'], 'where': None})
    return {'role': role, 'cuts': cuts, 'critic_calibrated': bool((block or {}).get('critic_calibrated'))}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--config', help='default config/overnight.json')
    sub = ap.add_subparsers(dest='cmd', required=True)
    d = sub.add_parser('due'); d.add_argument('--week'); d.add_argument('--json', action='store_true')
    r = sub.add_parser('run'); r.add_argument('--role', required=True, choices=['primary', 'standby']); r.add_argument('--week', required=True)
    b = sub.add_parser('board'); b.add_argument('--week', required=True); b.add_argument('--dry-run', action='store_true')
    s = sub.add_parser('status'); s.add_argument('--role', required=True, choices=['primary', 'standby'])
    args = ap.parse_args(argv)
    config = load_config(args.config)
    if args.cmd == 'due':
        return cmd_due(args)
    if args.cmd == 'status':
        weeks = sorted(state_root().glob('*/run-' + args.role + '.json'))
        print(json.dumps(lane_block(read_json(weeks[-1])) if weeks else None))
        return 0
    try:
        week = dt.date.fromisoformat(args.week)
        if week.weekday() != 0 or week.isoformat() != args.week:
            raise ValueError
    except ValueError:
        print('overnight: --week must be a Monday, YYYY-MM-DD', file=sys.stderr)
        return 2
    try:
        answer = due(board_read(args.week, 'picks'), board_read(args.week, 'titles'))
        if not answer['due']:
            print(f'overnight: not due: waiting on {", ".join(answer["waiting"]) or "a pick"}', file=sys.stderr)
            return 3
        pressed = answer['pieces']
        mine = 'primary' if args.cmd == 'board' else args.role
        record = read_json(run_path(args.week, 'primary')) if args.cmd == 'board' else run(mine, args.week, pressed, config)
        if args.cmd == 'run' and not config['roles'][mine].get('builds_board'):
            print(json.dumps(lane_block(record)))
            return 0
        other = 'standby' if mine == 'primary' else 'primary'
        records = [record, unfinished(wait_for_other(args.week, other, config), other, args.week, pressed, config)]
        print(json.dumps(board(args.week, records, config, dry_run=getattr(args, 'dry_run', False))))
        return 0
    except RunError as error:
        print(f'overnight: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
