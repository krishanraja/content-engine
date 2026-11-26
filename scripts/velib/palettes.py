"""Style palettes: a style may bring its own colours (Ruling, Krish, 2026-11-16: "A style may bring in its own colours
and theming as long as it doesn't end up looking like a clown's apron"). config/ve/style-palettes.json holds them; a
spec names one in style.palette; compile draws the cut in it and keeps his brand marks in the house colours.

The rules that keep a palette from looking like a clown's apron, checked here: it fills exactly the five colour roles
the devices read, each a hex colour, five distinct colours at most; type reads on the ground (cream on ink at least
7:1, cream on ink_soft at least 4.5:1); type on the accent block is ink and reads (at least 4.5:1); the accent stands
off the ground (at least 3:1)."""
from __future__ import annotations

import json
import re
from pathlib import Path

from .common import ROOT

PALETTES = ROOT / 'config' / 've' / 'style-palettes.json'
ROLES = ('ink', 'ink_deep', 'ink_soft', 'cream', 'mint')
HEX = re.compile(r'^#[0-9A-Fa-f]{6}$')
CONTRAST = (('cream', 'ink', 7.0), ('cream', 'ink_soft', 4.5), ('ink', 'mint', 4.5), ('mint', 'ink', 3.0))


def _lum(hex_colour: str) -> float:
    h = hex_colour.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4  # noqa: E731
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def contrast(a: str, b: str) -> float:
    hi, lo = sorted((_lum(a), _lum(b)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def palette_problems(pid: str, palette: dict) -> list[str]:
    colours = (palette or {}).get('colours') if isinstance((palette or {}).get('colours'), dict) else {}
    out = []
    if set(colours) != set(ROLES):
        return [f'palette {pid}: colours fill exactly the roles {", ".join(ROLES)}']
    bad = [r for r in ROLES if not HEX.match(str(colours[r]))]
    if bad:
        return [f'palette {pid}: {", ".join(bad)} must be a colour like #1E2A5A']
    if len({c.upper() for c in colours.values()}) > len(ROLES):
        out.append(f'palette {pid}: five colours at most')
    for fg, bg, need in CONTRAST:
        got = contrast(colours[fg], colours[bg])
        if got < need:
            out.append(f'palette {pid}: {fg} on {bg} is {got:.1f}:1, under {need}:1')
    return out


def load(path: Path | None = None) -> dict:
    return json.loads(Path(path or PALETTES).read_text(encoding='utf-8')).get('palettes') or {}


def all_problems(path: Path | None = None) -> list[str]:
    return [p for pid, pal in load(path).items() for p in palette_problems(pid, pal)]


def spec_problems(spec: dict, path: Path | None = None) -> list[str]:
    """style.palette names a palette that exists and holds its rules; none is the house colours."""
    pid = (spec.get('style') or {}).get('palette')
    if pid is None:
        return []
    table = load(path)
    from .retirement import registry
    if ('palette', pid) in registry():
        return [f'palette {pid!r} is retired']
    if pid not in table:
        return [f'palette.unknown style.palette: {pid} is not in config/ve/style-palettes.json ({", ".join(sorted(table))})']
    return [f'palette.rules {p}' for p in palette_problems(pid, table[pid])]


def tokens_for(spec: dict, house: dict, path: Path | None = None) -> dict:
    """The colour roles a cut is drawn in: the palette the spec names, else the house's own."""
    pid = (spec.get('style') or {}).get('palette')
    if not pid:
        return house
    errors = spec_problems(spec, path)
    if errors:
        raise ValueError('; '.join(errors))
    colours = load(path)[pid]['colours']
    return {**house, **colours}
