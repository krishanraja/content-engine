"""Shared helpers for ve (docs/ve/ENGINE.md). Standard library plus numpy only."""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / 'config' / 've'
WORK = ROOT / '.ve-work'


def load_json(path: Path | str):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def write_json(path: Path | str, data) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    return path


def sha256_file(path: Path | str) -> str:
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for block in iter(lambda: handle.read(1 << 20), b''):
            digest.update(block)
    return digest.hexdigest()


def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    """Run a command; on Windows resolve npx/npm/node shims through the shell."""
    shell = sys.platform == 'win32' and cmd and cmd[0] in ('npx', 'npm')
    return subprocess.run(cmd if not shell else subprocess.list2cmdline(cmd), shell=shell, cwd=kwargs.pop('cwd', ROOT),
                          capture_output=True, text=kwargs.pop('text', True), **kwargs)


def ffmpeg() -> str:
    exe = shutil.which('ffmpeg')
    if not exe:
        sys.exit('ve: ffmpeg is not on PATH (ve doctor explains)')
    return exe


def piece_dir(piece: str) -> Path:
    """A piece is its plan folder under docs/plans, or a path to one."""
    candidate = Path(piece)
    if candidate.is_dir():
        return candidate.resolve()
    return (ROOT / 'docs' / 'plans' / piece).resolve()


def crew_for(format_id: str) -> list[str]:
    return load_json(CONFIG / 'formats' / f'{format_id}.json')['crew']
