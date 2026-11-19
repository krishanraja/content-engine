"""Watch any video Krish points at in his Drive, whatever its size, from any machine.

    python3 scripts/post-pack/drive_review.py <Drive link or file ID> [--out DIR] [--no-pace]

The Drive connector downloads nothing over 10 MB, so a session handed a 268 MB long cut could not see it (Krish,
2026-11-19: "you need to figure out how to watch the long video"). This asks the engine
(POST /api/library/drive-review) to copy the file, read only, into a private review area and downloads it from the
signed URL it answers. Then it writes what a reviewer needs and nothing more: a contact sheet of the whole cut, a
denser sheet of its first 20 seconds, and `ve pace` against his references.

Nothing is filed, placed as a take or written to Drive. The engine key comes from scripts/engine.py.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))

import engine  # noqa: E402

DRIVE_ID = re.compile(r'^[A-Za-z0-9_-]{10,120}$')


def file_id(link: str) -> str:
    """The Drive file ID inside a link (/file/d/<id>/, ?id=<id>) or the ID itself."""
    m = re.search(r'/file/d/([A-Za-z0-9_-]+)', link) or re.search(r'[?&]id=([A-Za-z0-9_-]+)', link)
    candidate = m.group(1) if m else link.strip()
    if not DRIVE_ID.match(candidate):
        raise SystemExit(f'drive_review: {link!r} is not a Drive link or file ID')
    return candidate


def fetch(fid: str, out_dir: Path) -> Path:
    token = engine.operator_key()
    status, text = engine.call('POST', '/api/library/drive-review', {'file_id': fid}, token, timeout=620)
    if status != 200:
        raise SystemExit(f'drive_review: the engine answered {status}: {text[:300]}')
    answer = json.loads(text)
    name = re.sub(r'[^A-Za-z0-9._-]+', '-', answer['file']['name']) or f'{fid}.mp4'
    target = out_dir / f'{fid}-{name}'
    if not (target.exists() and target.stat().st_size == answer['file']['bytes']):
        with urllib.request.urlopen(answer['download']['url'], timeout=900) as r, open(target, 'wb') as fh:
            while chunk := r.read(1 << 20):
                fh.write(chunk)
    if target.stat().st_size != answer['file']['bytes']:
        raise SystemExit(f'drive_review: downloaded {target.stat().st_size} bytes, expected {answer["file"]["bytes"]}')
    return target


def sheets(video: Path, out_dir: Path) -> list[Path]:
    probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(video)],
                           capture_output=True, text=True, check=True)
    duration = max(float(probe.stdout.strip() or 1), 1.0)
    whole = out_dir / f'{video.stem}.sheet.png'
    opening = out_dir / f'{video.stem}.opening.png'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(video), '-vf', f'fps=30/{duration},scale=480:-1,tile=6x5',
                    '-frames:v', '1', str(whole)], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-t', '20', '-i', str(video), '-vf', 'fps=1,scale=480:-1,tile=5x4',
                    '-frames:v', '1', str(opening)], check=True)
    return [whole, opening]


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('link')
    ap.add_argument('--out', default=str(ROOT / '.scratch' / 'drive-review'))
    ap.add_argument('--no-pace', action='store_true')
    args = ap.parse_args(argv)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    video = fetch(file_id(args.link), out_dir)
    print(f'drive_review: {video}')
    for sheet in sheets(video, out_dir):
        print(f'drive_review: sheet {sheet}')
    if not args.no_pace:
        subprocess.run([sys.executable, str(ROOT / 'scripts' / 've.py'), 'pace', str(video)], check=False)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
