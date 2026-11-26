"""Publication choices retired by the v5 ruling. History remains readable."""
import json
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def registry():
    rows = json.loads((Path(__file__).resolve().parents[2] / 'config/retired-styles.json').read_text(encoding='utf-8'))
    return {(row['kind'], row['id']) for row in rows}


def problems(spec):
    style = spec.get('style') or {}
    motion = style.get('motion') or {}
    captions = style.get('captions') or {}
    choices = [('format_look', spec.get('format')), ('palette', style.get('palette')),
               ('motion_style', motion.get('module') if isinstance(motion, dict) else motion),
               ('recipe', style.get('recipe')), ('caption_theme', (spec.get('brand') or {}).get('caption_theme')),
               ('caption_theme', captions.get('theme') if isinstance(captions, dict) else captions)]
    choices.extend(('device', obj.get('device')) for obj in spec.get('objects') or [] if isinstance(obj, dict))
    return [f'{kind} {name!r} is retired by the v5 ruling' for kind, name in choices
            if isinstance(name, str) and (kind, name) in registry()]
