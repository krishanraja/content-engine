"""Invoke the shared FormatMaster renderer; no per-piece render code."""
from __future__ import annotations

import math
import subprocess
from pathlib import Path

from .common import ROOT


def render(props_path: str | Path, out_mp4: str | Path, scale: float = 1.0) -> None:
    if not math.isfinite(scale) or scale <= 0:
        raise ValueError('scale must be finite and positive')
    subprocess.run(['node', str(ROOT / 'apps/renderer/scripts/ve-render.mjs'),
                    str(Path(props_path).resolve()), str(Path(out_mp4).resolve()), '--scale', str(scale)],
                   cwd=ROOT, check=True)
