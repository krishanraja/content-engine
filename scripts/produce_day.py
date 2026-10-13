#!/usr/bin/env python3
"""The midday production run: one day's two videos, made from start to finish
on whatever machine runs this, with nobody starting anything.

Krish, 2026-10-12: "every Monday, Wednesday and Friday at midday there is a
scheduled task that checks the inbox for that days videos and produces the
videos and puts them in the right folder, and thereafter the publish board
auto incorporates the links ... design a system that is literally one click
and impossible for you to fuck up. This MUST go out with music". He chose
"GitHub always renders": .github/workflows/produce-day.yml runs this on
GitHub's machine at 12:00 New York, and its Run workflow button is the one
click. The home computers only feed it (takes and music, scripts/
recordings-upload.ps1) and file the result in Drive (Library Sync).

Nothing here needs H:. Every input comes from the engine:
  - the day's piece:        GET /api/week/options (the piece scheduled for the date)
  - its takes:              its making record, then scripts/post-pack/recording.py get
  - the music:              scripts/quick-edit/music.py fetch
  - the pictures:           GET /api/library/file for the post's pack, staged where plan_files.py looks
  - the story intro/outro:  scripts/quick-edit/story_io.py, from the plan's cover-facts.json

Then kit.py (both cuts), make.py (plan, then render), the thumbnails, send.py
into the post's "3 Video" folder (Library Sync writes it into Drive) and
making.py video for both cuts. On a stop it writes one board item saying
exactly what stopped, and exits non-zero; it never asks Krish to do what a
machine can.

    python scripts/produce_day.py [--date YYYY-MM-DD] [--piece UUID] [--wait-minutes 120] [--dry-run]
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / 'scripts'))
sys.path.insert(0, str(REPO / 'scripts' / 'post-pack'))
import engine  # noqa: E402
import plan_files  # noqa: E402

TZ = ZoneInfo('America/New_York')  # system_config.operator_timezone (docs/CADENCE.md)
SERIES = {0: 'follow_the_money', 2: 'under_the_hood', 4: 'mind_the_gap'}
SHAPE = {'long': '16x9', 'short': '9x16'}
PY = sys.executable
WORK_ROOT = REPO / '.cache' / 'produce'
STORY_CONFIG = REPO / 'config' / 'story-intro-outro.json'


class Stop(Exception):
    """A reason the run cannot go on, said in plain words."""


def log(msg):
    print(f'{datetime.now(TZ):%H:%M:%S}  {msg}', flush=True)


def call(method, path, body=None):
    status, text = engine.call(method, path, body, engine.operator_key(), timeout=120)
    try:
        data = json.loads(text)
    except ValueError:
        data = {}
    return status, data


def run(args, env=None, ok=(0,), what=''):
    log('run ' + ' '.join(str(a) for a in args[:4]) + (' ...' if len(args) > 4 else ''))
    p = subprocess.run([str(a) for a in args], cwd=REPO, env={**os.environ, **(env or {})}, text=True,
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    sys.stdout.write(p.stdout[-6000:])
    if p.returncode not in ok:
        raise Stop(f'{what or Path(str(args[1])).name} stopped (exit {p.returncode}): '
                   + ' '.join(p.stdout.strip().splitlines()[-3:])[:600])
    return p


def board(item_id, lane, title, detail, piece, link=None):
    item = {'id': item_id, 'lane': lane, 'rank': 1, 'area': 'Videos', 'title': title, 'detail': detail, 'idea_id': piece,
            'closes_on': 'video'}
    if link:
        item.update(link=link, link_label='Open')
    try:
        call('POST', '/api/workbench', {'action': 'upsert_items', 'client': 'claude_code', 'items': [item]})
    except Exception as e:  # the board is a report; it never hides the real stop
        log(f'the board item was not written: {e}')


# ---------------------------------------------------------------- the day's piece

def the_piece(when):
    if when.weekday() not in SERIES:
        raise Stop(f'{when:%A} is not a publishing day (Monday, Wednesday, Friday)')
    monday = when - timedelta(days=when.weekday())
    status, data = call('GET', f'/api/week/options?week_start={monday.isoformat()}')
    if status != 200:
        raise Stop(f'the week options could not be read ({status})')
    data = data.get('data', data)
    for series in data.get('series') or []:
        if series.get('slug') != SERIES[when.weekday()]:
            continue
        for item in (series.get('scheduled') or series.get('in_flight') or []):
            if item.get('scheduled_for') == when.isoformat() and item.get('id'):
                return item['id']
    raise Stop(f'no piece is scheduled for {when:%A %-d %B}')


def plan_of(piece):
    for post in sorted((REPO / 'docs' / 'plans').glob('*/post.json')):
        try:
            if json.loads(post.read_text(encoding='utf-8-sig')).get('piece_id') == piece:
                return post
        except ValueError:
            continue
    raise Stop(f'no plan in docs/plans carries piece_id {piece}: the piece is not made yet (make-piece)')


def making(piece):
    status, data = call('GET', f'/api/content-ideas/{piece}/making')
    if status != 200:
        raise Stop(f'the piece\'s record could not be read ({status})')
    return (data.get('data') or data).get('making') or {}


def takes(piece, wait_minutes):
    """{cut: 'recordings/<sha>.<ext>'}: the newest take of each cut read from its current script."""
    deadline = time.time() + wait_minutes * 60
    while True:
        m = making(piece)
        hashes = ((m.get('script_check') or {}).get('hashes') or {})
        found = {}
        for cut in ('long', 'short'):
            fits = [r for r in m.get('recordings') or [] if r.get('cut') == cut and r.get('path')
                    and (not r.get('script_sha256') or not hashes.get(cut) or r['script_sha256'] == hashes[cut])]
            if fits:
                found[cut] = max(fits, key=lambda r: r.get('at') or '')['path']
        if len(found) == 2:
            return found
        missing = ', '.join(c for c in ('long', 'short') if c not in found)
        if time.time() >= deadline:
            raise Stop(f'no take of the {missing} cut reached the engine by {datetime.now(TZ):%-I:%M %p}: '
                       'drop it at the top of the Video Engine Inbox and press Run workflow (produce-day) again')
        log(f'waiting for the {missing} take (the Inbox lane places it within about ten minutes)')
        time.sleep(300)


# ---------------------------------------------------------------- inputs

def fetch_takes(found, work):
    out = work / 'takes'
    paths = {}
    for cut, path in found.items():
        run([PY, 'scripts/post-pack/recording.py', 'get', path, '--out', out], what=f'getting the {cut} take')
        sha = Path(path).stem
        hits = [p for p in out.iterdir() if p.is_file() and not p.name.endswith('.part')]
        # recording.py names the file as it sat in the Inbox: find it by sha256.
        import hashlib
        for p in hits:
            h = hashlib.sha256()
            with open(p, 'rb') as f:
                for chunk in iter(lambda: f.read(1 << 20), b''):
                    h.update(chunk)
            if h.hexdigest() == sha:
                paths[cut] = p
                break
        if cut not in paths:
            raise Stop(f'the {cut} take came down but is not the one on the record ({sha[:12]})')
    return paths


def fetch_music():
    p = run([PY, 'scripts/quick-edit/music.py', 'fetch'], ok=(0, 2), what='getting the music')
    root = re.search(r'MINDMAKE_MUSIC_ROOT=(.+)', p.stdout)
    if p.returncode != 0 or not root:
        raise Stop('the licensed music is not in the engine yet: a home computer publishes it on its next five-minute pass')
    return root.group(1).strip()


def fetch_pictures(post_path):
    """Stages every picture the plan names, from the post's pack in the library,
    where plan_files.py looks (.cache/post-pack/<post>/<section>/<name>)."""
    post = plan_files.load_post(post_path)
    folder = plan_files.pack_folder(post)
    for item in plan_files.video_files(post_path, post):
        if item['kind'] != 'image' or item.get('path') or not item.get('name') or not folder:
            continue
        section = plan_files.SECTION['image']
        target = plan_files.STAGED / folder / section / item['name']
        library_path = f'3 Posts/{folder}/{section}/{item["name"]}'
        status, data = call('GET', '/api/library/file?path=' + urllib.parse.quote(library_path))
        url = (data.get('download') or {}).get('url')
        if status != 200 or not url:
            raise Stop(f'the picture {item["name"]} is not in the post\'s library pack ({status}): send the pack (send.py)')
        target.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(url, target)
        log(f'staged {library_path}')


def story_clips(post_path, work):
    """The story intro and outro rendered for this piece, both shapes, and Krish's words that let them in."""
    cfg = json.loads(STORY_CONFIG.read_text(encoding='utf-8'))
    approved = cfg.get('approved') or {}
    words = approved.get('words') if isinstance(approved, dict) else None
    if cfg.get('status') != 'approved' or not words:
        raise Stop('the story intro and outro design is not approved in config/story-intro-outro.json')
    out = work / 'story-io'
    props = out / 'props.json'
    run([PY, 'scripts/quick-edit/story_io.py', 'props', '--plan', post_path.parent, '--out', props],
        what='the story intro props')
    run([PY, 'scripts/quick-edit/story_io.py', 'render', '--piece-props', props, '--out', out], what='rendering the story intro and outro')
    clips = {shape: {'intro': out / f'intro-{shape}.mp4', 'outro': out / f'outro-{shape}.mp4'} for shape in ('16x9', '9x16')}
    for shape, pair in clips.items():
        for what, path in pair.items():
            if not path.is_file():
                raise Stop(f'the story {what} for {shape} was not rendered')
    return clips, f'Krish, {approved.get("on", "")}: {words}'


# ---------------------------------------------------------------- the cuts

def make_cuts(post_path, piece, takes_at, music_root, clips, intro_words, work, dry_run):
    kit = work / 'kit'
    env = {'MINDMAKE_MUSIC_ROOT': music_root}
    for cut, take in takes_at.items():
        p = run([PY, 'scripts/quick-edit/kit.py', post_path, '--cut', cut, '--recording', take, '--out', kit, '--force'],
                env=env, ok=(0, 1), what=f'the {cut} kit')
        if p.returncode == 1:
            # A picture whose words come out too small to read in this cut's
            # shape (house rule SUBSTACK_FIT) stays out of this cut; the
            # other cut keeps it. Any other CHECK stops the run.
            checks = re.findall(r'^CHECK (\S+?): (.*)$', p.stdout, re.M)
            small = {cid for cid, why in checks if 'a viewer can read' in why}
            if not checks or len(small) != len(checks):
                raise Stop(f'the {cut} kit: ' + '; '.join(f'{c}: {w}' for c, w in checks if c not in small)[:600])
            cfg_path = kit / f'{cut}.json'
            cfg = json.loads(cfg_path.read_text(encoding='utf-8'))
            cfg['cues'] = [c for c in cfg.get('cues') or [] if c.get('id') not in small]
            cfg_path.write_text(json.dumps(cfg, indent=2), encoding='utf-8')
            log(f'the {cut} cut leaves out {", ".join(sorted(small))}: too small to read in its shape (the other cut shows them)')
    # The music is sized to the long cut as it will run (trimmed, with the
    # story intro and outro), not to its raw take: a track a little shorter
    # than the take still covers the finished cut. Both cuts ask for the same.
    probe = run([PY, 'scripts/quick-edit/make.py', kit / 'long.json', '--out', work / 'long', '--only', '16x9', '--plan'],
                env=env, ok=(0, 1), what='measuring the long cut')
    try:
        trimmed = json.loads(probe.stdout[probe.stdout.index('{'):probe.stdout.rindex('}') + 1])['cut_seconds']
    except (ValueError, KeyError):
        raise Stop('measuring the long cut gave no plan: ' + ' '.join(probe.stdout.strip().splitlines()[-3:])[:600])
    for cut in SHAPE:
        cfg_path = kit / f'{cut}.json'
        cfg = json.loads(cfg_path.read_text(encoding='utf-8'))
        cfg['music_seconds'] = round(float(trimmed) + 3.0 + 4.0 + 2.0, 1)
        cfg_path.write_text(json.dumps(cfg, indent=2), encoding='utf-8')
    rendered = {}
    for cut, shape in SHAPE.items():
        cfg_path = kit / f'{cut}.json'
        cfg = json.loads(cfg_path.read_text(encoding='utf-8'))
        cfg['intro'] = {shape: str(clips[shape]['intro'])}
        cfg['intro_override'] = intro_words
        cfg['endcard'] = {**(cfg.get('endcard') or {}), shape: str(clips[shape]['outro'])}
        cfg_path.write_text(json.dumps(cfg, indent=2), encoding='utf-8')
        out = work / cut
        plan = run([PY, 'scripts/quick-edit/make.py', cfg_path, '--out', out, '--only', shape, '--plan'], env=env, ok=(0, 1),
                   what=f'planning the {cut} cut')
        try:
            report = json.loads(plan.stdout[plan.stdout.index('{'):plan.stdout.rindex('}') + 1])
        except ValueError:
            raise Stop(f'planning the {cut} cut gave no plan: ' + ' '.join(plan.stdout.strip().splitlines()[-3:])[:600])
        if report.get('missing_cues'):
            # The words he said differ from the script's: the picture stays out of this cut, said in the log.
            cfg['cues'] = [c for c in cfg.get('cues') or [] if c.get('id') not in set(report['missing_cues'])]
            cfg_path.write_text(json.dumps(cfg, indent=2), encoding='utf-8')
            log(f'the {cut} cut: no line found for {", ".join(report["missing_cues"])}; those pictures are left out')
        if not (report.get('shapes', {}).get(shape) or {}).get('music'):
            raise Stop(f'the {cut} cut would go out without music: ' + '; '.join((report.get('shapes', {}).get(shape) or {}).get('warnings') or []))
        if dry_run:
            continue
        run([PY, 'scripts/quick-edit/make.py', cfg_path, '--out', out, '--only', shape, '--share-mib', '29'], env=env,
            what=f'rendering the {cut} cut')
        files = sorted(out.glob(f'*-{shape}.mp4'))
        if not files:
            raise Stop(f'the {cut} cut rendered no {shape} file')
        rendered[cut] = files[0]
    return rendered


def thumbs(post_path, work):
    out = work / 'thumbs'
    run([PY, 'scripts/pages/build.py', post_path.parent / 'cover-facts.json', '--thumbs', '--out', out], what='the thumbnails')
    return {'long': out / 'thumb-wide-1280x720.jpg', 'short': out / 'thumb-tall-1080x1920.jpg'}


def file_and_record(post_path, piece, rendered, thumb, work):
    post = plan_files.load_post(post_path)
    folder = plan_files.pack_folder(post)
    subject = post.get('subject') or folder
    names = {'long': f'{subject} - wide 16x9 - YouTube, Substack', 'short': f'{subject} - tall 9x16 - Shorts, Reels, TikTok, LinkedIn'}
    staged = work / 'send'
    staged.mkdir(parents=True, exist_ok=True)
    for cut, src in rendered.items():
        (staged / f'{names[cut]}.mp4').write_bytes(Path(src).read_bytes())
        (staged / f'{names[cut]}.jpg').write_bytes(Path(thumb[cut]).read_bytes())
    run([PY, 'scripts/post-pack/send.py', staged, '--as', f'3 Posts/{folder}/3 Video', '--purpose',
         'the finished video and its thumbnail, made by the midday run'], what='sending the videos to the library')
    for cut, src in rendered.items():
        seconds = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(src)],
                                 text=True, capture_output=True).stdout.strip() or '0'
        run([PY, 'scripts/post-pack/making.py', '--by', 'Midday run', piece, 'video', cut, f'{names[cut]}.mp4',
             f'3 Posts/{folder}/3 Video/{names[cut]}.mp4', '--seconds', str(round(float(seconds))),
             '--thumb', f'3 Posts/{folder}/3 Video/{names[cut]}.jpg', '--thumb-file', thumb[cut],
             '--music', 'no-curves-instrumental'], what=f'recording the {cut} cut')
    return folder


def main():
    ap = argparse.ArgumentParser(description='Make one publishing day\'s two videos, end to end.')
    ap.add_argument('--date', help='the publishing day, YYYY-MM-DD (default: today in New York)')
    ap.add_argument('--piece', help='the piece id (default: the one scheduled for the date)')
    ap.add_argument('--wait-minutes', type=int, default=120, help='how long to wait for both takes')
    ap.add_argument('--dry-run', action='store_true', help='everything up to the plans; nothing rendered, sent or recorded')
    a = ap.parse_args()
    when = date.fromisoformat(a.date) if a.date else datetime.now(TZ).date()
    piece = a.piece
    try:
        piece = piece or the_piece(when)
        post_path = plan_of(piece)
        work = WORK_ROOT / f'{when.isoformat()}-{piece[:8]}'
        work.mkdir(parents=True, exist_ok=True)
        log(f'{when:%A %-d %B}: piece {piece}, plan {post_path.parent.name}')
        takes_at = fetch_takes(takes(piece, a.wait_minutes), work)
        music_root = fetch_music()
        fetch_pictures(post_path)
        clips, words = story_clips(post_path, work)
        rendered = make_cuts(post_path, piece, takes_at, music_root, clips, words, work, a.dry_run)
        if a.dry_run:
            log('dry run: both cuts planned with music, the story intro and outro; nothing rendered, sent or recorded')
            return 0
        thumb = thumbs(post_path, work)
        folder = file_and_record(post_path, piece, rendered, thumb, work)
        # Nothing is written on the board: the video step is on the record now, so
        # Control Center's done-check sweep closes an earlier stop's item by itself
        # (closes_on video), and a new item about a step already done is refused.
        log(f'both cuts are in 3 Posts/{folder}/3 Video; the publish board picks them up at 1:30 pm')
        log('done')
        return 0
    except (Stop, engine.NoKey, engine.Unreachable, plan_files.PlanFilesError) as e:
        log(f'STOPPED: {e}')
        if piece:
            # Held for a session, never on Krish's list: a stopped run is a session's to fix
            # (AGENTS.md, produce-video: never relay a runner's status as his blocker).
            board(f'videos-{when.isoformat()}', 'in_progress', f'{when:%A}\'s videos stopped', str(e), piece,
                  'https://github.com/krishanraja/content-engine/actions/workflows/produce-day.yml')
        return 1


if __name__ == '__main__':
    sys.exit(main())
