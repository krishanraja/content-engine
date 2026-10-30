#!/usr/bin/env python3
"""The overnight Critic route: one fresh, read-only Codex task per round that looks at a cut and names what failed.

    python scripts/overnight/critic_run.py judge --file CUT --day mon --cut long --round 1 [--scale 0.5] [--earlier a,b]
    python scripts/overnight/critic_run.py cases --out DIR --media-root DIR [--media-root DIR ...]

judge is config/overnight.json steps.critic: it prints the verdict (schema overnight-critic/1) as its last line, which
overnight.py reads. cases judges every case in config/critic-calibration.json with a fresh Critic each and writes
verdict.<case id>.json into DIR, ready for `critic.py calibrate --verdicts DIR`.

The Critic sees pictures only: the still itself, or contact sheets of the cut (one frame every SHEET_STEP seconds,
TILE x TILE a sheet, each sheet's times written into its card). Sound goes to the measured gates, never to the Critic.
Its card carries the rejection floor for the cut's maker (scripts/floor.py) and points it at docs/production/THE_BAR.md.
It answers with findings only. This script writes everything else in the verdict (the schema, a fresh critic_id, the
file's own sha256, the times viewed, the round), so a verdict cannot be about a file the Critic was not shown. Codex
runs with --sandbox read-only: it can read the repository and the sheets and change nothing. An answer that is not a
valid verdict is refused (exit 2, nothing printed on stdout), and the run holds the cut rather than guess.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import critic  # noqa: E402

SHEET_STEP = 1.5  # seconds between frames on a contact sheet
TILE = 4  # frames a side: 16 frames, 24 seconds, a sheet
FRAME_WIDTH = 480
STILL_SUFFIXES = {'.jpg', '.jpeg', '.png', '.webp'}

CARD = """You are the Critic for one finished cut of a Make Your Mind Up video. You judge what is on screen only.
A different agent made this cut; you never repair it, and you never say how to fix anything.

What you are looking at: {what}
{sheets}

Judge it against the house bar (read docs/production/THE_BAR.md in this repository) and the rejection floor below,
which lists what Krish has already rejected for this kind of piece. Look at every image.

The rejection floor for {maker}:
{floor}

Answer with one JSON object and nothing else:
{{"findings": [{{"failure": "...", "area": "...", "at_s": 0.0, "needs": "..."}}]}}

- A brief cross-fade between two layouts at a scene or act change is intended (Krish, 30 Oct: "the cross fades are
  fine"): a contact-sheet frame that catches one mid-dissolve, with both layouts faintly overlapping, is not a failure.
  It is a failure when two layouts stay stuck on screen together, or the overlap holds for more than a moment (it shows
  on two or more frames in a row, 1.5 s apart).
- One finding per failure you can see. An empty list means the cut passes. Do not invent failures to look thorough,
  and do not pass a cut that falls beneath the floor.
- failure: one line naming what failed on screen, under 300 characters. Name the failure only: never a fix, a
  suggestion, or anything about sound, music, voice or loudness (those are measured elsewhere). Do not use the words
  fix, should, instead, suggest, change it, replace it, sound, audio, music, voice, mix or loudness.
- area: one of {areas}.
- at_s: the time in seconds where it shows (for a still, 0).
- needs: "spec" if a change to the cut's direction mends it, "plates" if new pictures mend it, "take" if only a new
  recording of Krish mends it.
"""


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for block in iter(lambda: handle.read(1 << 20), b''):
            digest.update(block)
    return digest.hexdigest()


def duration(path: Path) -> float:
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1',
                          str(path)], capture_output=True, text=True).stdout.strip()
    return float(out) if out else 0.0


def contact_sheets(video: Path, folder: Path) -> tuple[list[Path], list[float], list[str]]:
    """Sheets of frames every SHEET_STEP seconds, the times they show, and a line per sheet for the card."""
    length = duration(video)
    times = [round(i * SHEET_STEP, 2) for i in range(max(1, int(length // SHEET_STEP) + 1)) if i * SHEET_STEP < length]
    per = TILE * TILE
    pattern = folder / 'sheet-%03d.jpg'
    subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-y', '-i', str(video), '-vf',
                    f'fps=1/{SHEET_STEP},scale={FRAME_WIDTH}:-2,tile={TILE}x{TILE}', '-q:v', '3', str(pattern)],
                   check=True)
    sheets = sorted(folder.glob('sheet-*.jpg'))
    lines = []
    for n, sheet in enumerate(sheets):
        shown = times[n * per:(n + 1) * per]
        if shown:
            lines.append(f'Image {n + 1}: {len(shown)} frames, left to right then down, at {shown[0]:.1f} s to '
                         f'{shown[-1]:.1f} s, one every {SHEET_STEP} s.')
    return sheets, times, lines


def floor_text(maker: str) -> str:
    proc = subprocess.run([sys.executable, str(ROOT / 'scripts' / 'floor.py'), '--format', maker],
                          cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace')
    return (proc.stdout or '').strip() or '(no floor recorded for this maker yet)'  # whole: a floor item cut off here could pass a cut beneath it


def codex_runner(images: list[Path], card: str, answer: Path) -> int:
    """One fresh Codex task, read-only, no approvals, its last message written to answer."""
    codex = os.environ.get('MINDMAKE_CODEX') or shutil.which('codex') or 'codex'
    argv = [codex, 'exec', '--sandbox', 'read-only', '--skip-git-repo-check', '--color', 'never',
            '--cd', str(ROOT), '--output-last-message', str(answer)]
    for image in images:
        argv += ['--image', str(image)]
    flags = 0x08000000 if sys.platform == 'win32' else 0  # no console window, as overnight.py runs everything
    proc = subprocess.run(argv + ['-'], input=card, capture_output=True, text=True, encoding='utf-8',
                          errors='replace', creationflags=flags)
    return proc.returncode


def findings_from(text: str) -> list | None:
    """The findings list from the Critic's answer, which may come fenced or with words around it."""
    for match in re.finditer(r'\{.*\}', text or '', re.S):
        try:
            doc = json.loads(match.group(0))
        except ValueError:
            continue
        if isinstance(doc, dict) and isinstance(doc.get('findings'), list):
            return [{k: f.get(k) for k in critic.FINDING_KEYS} for f in doc['findings'] if isinstance(f, dict)]
    return None


def judge(file: Path, *, day: str, cut: str, round_no: int, scale: float = 1.0, earlier=(), runner=codex_runner,
          maker: str | None = None, what: str | None = None) -> tuple[dict | None, list[str]]:
    """A fresh Critic's verdict on file, and why it was refused ([] when it is a valid verdict)."""
    file = Path(file)
    critic_id = f'codex-critic-{uuid.uuid4().hex[:12]}'
    while critic_id in set(earlier):
        critic_id = f'codex-critic-{uuid.uuid4().hex[:12]}'
    maker = maker or ('short_video' if cut == 'short' or cut == 'still' else 'long_video')
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        if file.suffix.lower() in STILL_SUFFIXES:
            images, viewed, lines = [file], [0.0], ['Image 1: the still itself.']
        else:
            images, viewed, lines = contact_sheets(file, work)
        card = CARD.format(what=what or f'the {cut} cut for {day}, round {round_no}', sheets='\n'.join(lines),
                           maker=maker, floor=floor_text(maker), areas=', '.join(critic.AREAS))
        answer = work / 'answer.txt'
        code = runner(images, card, answer)
        text = answer.read_text(encoding='utf-8', errors='replace') if answer.exists() else ''
    if code != 0:
        return None, [f'the Critic task exited {code}']
    findings = findings_from(text)
    if findings is None:
        return None, ['the Critic answered with no findings list']
    verdict = {'schema': critic.SCHEMA, 'critic_id': critic_id, 'round': int(round_no), 'day': day, 'cut': cut,
               'file_sha256': sha256(file), 'scale': float(scale), 'viewed': viewed, 'findings': findings,
               'blocking': bool(findings)}
    problems = critic.validate(verdict) + critic.check_fresh(verdict, earlier)
    return (verdict if not problems else None), problems


def find_case_media(case: dict, media_roots: list[Path]) -> Path | None:
    """A calibration case's file: its repository path, its name directly in a media root (where critic.py calibrate
    looks for it too), or a video under a media root with the sha256 the manifest names."""
    media = case['media']
    if media.get('repo_path'):
        path = ROOT / media['repo_path']
        return path if path.is_file() else None
    for root in media_roots:
        if media.get('name') and (Path(root) / media['name']).is_file():
            return Path(root) / media['name']
    if media.get('sha256'):
        for root in media_roots:
            for path in sorted(Path(root).rglob('*.mp4')):
                if sha256(path) == media['sha256']:
                    return path
    return None


def case_cut(case: dict) -> str:
    if case['media'].get('kind') == 'still':
        return 'still'
    key = (case['media'].get('name') or case['id']).lower()
    return 'short' if 'short' in key or 'tall' in key else 'long'


def judge_cases(out: Path, media_roots: list[Path], *, manifest=None, runner=codex_runner) -> list[dict]:
    out.mkdir(parents=True, exist_ok=True)
    rows, seen = [], []
    for case in critic.load_manifest(manifest)['cases']:
        path = find_case_media(case, media_roots)
        if path is None:
            rows.append({'case': case['id'], 'ok': False, 'problem': 'its media was not found under --media-root'})
            continue
        verdict, problems = judge(path, day='calibration', cut=case_cut(case), round_no=1, earlier=seen, runner=runner,
                                  what=f'calibration case {case["id"]}: {case.get("what") or path.name}')
        if verdict is None:
            rows.append({'case': case['id'], 'ok': False, 'problem': '; '.join(problems)})
            continue
        seen.append(verdict['critic_id'])
        (out / f'verdict.{case["id"]}.json').write_text(json.dumps(verdict, indent=1) + '\n', encoding='utf-8')
        rows.append({'case': case['id'], 'ok': True, 'blocking': verdict['blocking'], 'file': str(path)})
    return rows


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    j = sub.add_parser('judge')
    j.add_argument('--file', required=True)
    j.add_argument('--day', required=True)
    j.add_argument('--cut', required=True)
    j.add_argument('--round', type=int, default=1)
    j.add_argument('--scale', type=float, default=1.0)
    j.add_argument('--earlier', default='')
    c = sub.add_parser('cases')
    c.add_argument('--out', required=True)
    c.add_argument('--media-root', action='append', default=[])
    c.add_argument('--manifest')
    a = ap.parse_args(argv)
    if a.cmd == 'judge':
        verdict, problems = judge(Path(a.file), day=a.day, cut=a.cut, round_no=a.round, scale=a.scale,
                                  earlier=[x for x in a.earlier.split(',') if x])
        if verdict is None:
            print('critic refused: ' + '; '.join(problems), file=sys.stderr)
            return 2
        print(json.dumps(verdict))
        return 0
    rows = judge_cases(Path(a.out), [Path(r) for r in a.media_root], manifest=a.manifest)
    for row in rows:
        state = ('blocks' if row['blocking'] else 'passes') if row['ok'] else f'NOT JUDGED: {row["problem"]}'
        print(f'{row["case"]:28} {state}')
    print(f'verdicts in {a.out}; next: python scripts/overnight/critic.py calibrate --verdicts {a.out} --media-root ...')
    return 0 if all(r['ok'] for r in rows) else 1


if __name__ == '__main__':
    sys.exit(main())
