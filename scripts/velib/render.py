"""Invoke the shared FormatMaster renderer; no per-piece render code."""
from __future__ import annotations

import math
import subprocess
from pathlib import Path

from .common import ROOT, sha256_file
from .compile import source


def check_asset_hashes(spec: dict, assets_dir: str | Path) -> None:
    """Verify declared hashes for all staged spec assets before rendering."""
    for asset in spec.get('assets', []):
        if not asset.get('sha256'):
            continue
        staged = Path(source(asset['path'], assets_dir))
        if staged.exists() and (not staged.is_file() or sha256_file(staged) != asset['sha256']):
            raise ValueError(f'asset {asset["id"]}: sha256 mismatch')


def render(props_path: str | Path, out_mp4: str | Path, scale: float = 1.0) -> None:
    if not math.isfinite(scale) or scale <= 0:
        raise ValueError('scale must be finite and positive')
    subprocess.run(['node', str(ROOT / 'apps/renderer/scripts/ve-render.mjs'),
                    str(Path(props_path).resolve()), str(Path(out_mp4).resolve()), '--scale', str(scale)],
                   cwd=ROOT, check=True)
