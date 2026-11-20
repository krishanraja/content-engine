"""ve recipe rate: Krish's rating of a style recipe, in his own words, written into config/ve/recipes/<id>.json.

A recipe (config/ve/recipes/) locks one tested combination: the motion style, the caption style and its placement, the
transitions, camera, energy, the staging and any generated kinds. From floor.RECIPE_FROM a piece uses only a recipe he
rated 9 or more, or one he approved (Ruling, Krish, 2026-11-20: all ten style combinations on the style board are
approved), or its one named experiment (velib/floor.py recipe_lints).

    python scripts/ve.py recipe rate <id> <score 0-10> --words "<his exact words>" [--on YYYY-MM-DD]
    python scripts/ve.py recipe rate <id> --approved --words "<his exact words>" [--on YYYY-MM-DD]

A session records a rating only when he gives it, in his exact typed words; it never invents a score. --approved is his
yes with no number, and records none.
"""
from __future__ import annotations

import math
import re
from datetime import datetime, timezone
from pathlib import Path

from .common import load_json, write_json
from .floor import RECIPES

DAY = re.compile(r'^\d{4}-\d{2}-\d{2}$')


def rating(score=None, *, approved: bool = False, words: str, on: str | None = None) -> dict:
    """The rated block: {score, by, on, words} for a score, {approved: true, by, on, words} for his approval."""
    words = (words or '').strip()
    if not words:
        raise ValueError('a rating needs his exact words (--words): a score nobody can quote is never recorded')
    on = on or datetime.now(timezone.utc).strftime('%Y-%m-%d')
    if not DAY.match(on):
        raise ValueError(f'--on must be YYYY-MM-DD, not {on!r}')
    if approved:
        if score is not None:
            raise ValueError('give a score or --approved, not both: an approval carries no invented score')
        return {'approved': True, 'by': 'Krish', 'on': on, 'words': words}
    if score is None:
        raise ValueError('give a score from 0 to 10, or --approved')
    if isinstance(score, bool) or not isinstance(score, (int, float)) or not math.isfinite(score) or not 0 <= score <= 10:
        raise ValueError(f'a score is a number from 0 to 10, not {score!r}')
    return {'score': int(score) if float(score).is_integer() else float(score), 'by': 'Krish', 'on': on, 'words': words}


def rate(recipe_id: str, score=None, *, approved: bool = False, words: str, on: str | None = None,
         root: Path | None = None) -> dict:
    """Write his rating into the recipe file and return the rated block. Refuses an unknown recipe."""
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,63}', recipe_id or ''):
        raise ValueError(f'{recipe_id!r} is not a recipe id')
    path = Path(root or RECIPES) / f'{recipe_id}.json'
    if not path.is_file():
        raise ValueError(f'{recipe_id} is not a recipe in {path.parent}')
    block = rating(score, approved=approved, words=words, on=on)
    recipe = load_json(path)
    recipe['rated'] = block
    write_json(path, recipe)
    return block
