"""The quality floor: a 0/10 cut never reaches Krish again (Krish, 2026-11-19).

His words, of the week's cuts: "they are so poor that I can't even bring myself to publish them. I refuse to. They're
just the worst. Visually, motion, post-production, and everything is a zero out of ten. I'm going to need you to make
sure that this can never happen again." The rejected long measured, with `ve pace`, 2.21 events a second against his
references' 2.87 to 4.6 and 5% of the frame active against 10% to 100%: BELOW EVERY REFERENCE on both, while `ve pace`
was written to flag and never refuse. Its picture was his take in a pillar on the right and two thirds of the frame a
blurred dark backdrop with nothing on it.

Four parts, each one rule in one place:

- the pace floor (`pace_problems`): a cut with any `ve pace` measure below every reference in
  config/ve/pace-references.json is held. `ve status` never says READY and `ve file` refuses it. The bottom of his own
  references is a floor; rates above it are never a target (THE_BAR, docs/ve/INGREDIENTS.md). `ve pace` itself stays a
  description; the floor lives here, in readiness.
- no dead panel (`dead_panel_lints`): on a staged cut (pillar, band, stage, tray) the panel beside his take carries a
  device, a plate or a figure; a backdrop alone, or nothing, for more than DEAD_PANEL_S is refused before render.
- held means rebuild (`held_line`): a held cut is one line for Krish, never a list of patches. The session re-renders
  once on a proven recipe; if that is still held, one line to Krish and nothing is filed.
- recipes rated before use (`recipe_lints`, Ruling, Krish, 2026-11-19: recipes plus one named experiment slot proven
  before Sign storyboard): from RECIPE_FROM, a spec's style is a recipe in config/ve/recipes/ that Krish rated 9 or more
  or approved (Ruling, Krish, 2026-11-20: all ten style combinations on the style board are approved), or its one named experiment (`style.experiment`); its caption style and any generated asset come from the recipe.
"""
from __future__ import annotations

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from .common import CONFIG, load_json, write_json

# ---------------------------------------------------------------------------------------------------------- pace floor

PACE_FILE = 'pace.{cut}.json'


def _measure_cached(video: Path, digest: str | None, directory: Path, cut: str, measure_fn=None) -> dict:
    """`ve pace` of this exact file, kept beside the cut as pace.<cut>.json and bound to its sha256, so ve status does
    not decode the cut on every run."""
    from . import pace  # noqa: PLC0415
    path = Path(directory) / PACE_FILE.format(cut=cut)
    if digest and path.is_file():
        try:
            kept = load_json(path)
        except (OSError, ValueError):
            kept = {}
        if kept.get('sha256') == digest and isinstance(kept.get('card'), dict):
            return kept['card']
    card = (measure_fn or pace.measure)(video)
    card['file'] = Path(video).name
    if digest:
        write_json(path, {'schema': 've-pace-floor/1', 'sha256': digest, 'card': card})
    return card


def pace_problems(video, digest: str | None, directory: Path, cut: str, *, table: Path | None = None,
                  measure_fn=None) -> list[str]:
    """The floor: every `ve pace` measure of this cut against the references he keeps. One reason when any measure is
    below every reference (or a dead gap longer than any of theirs), naming each measure and the references' range; one
    reason when the cut cannot be measured, since a cut nobody measured is never shown to him (held, not passed)."""
    from . import pace  # noqa: PLC0415
    if not video or not Path(video).is_file():
        return []   # the mechanical row already says there is no file
    try:
        card = _measure_cached(Path(video), digest, Path(directory), cut, measure_fn)
        loaded = json.loads(Path(table or pace.TABLE).read_text(encoding='utf-8'))
        verdict = pace.compare(card, loaded['references'] + loaded.get('house', []))
    except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError) as error:
        return [f'below the floor: pace not measured ({error})']
    low = verdict['below_all']
    if not low:
        return []
    parts = [f"{pace.SHORT.get(k, k)} {verdict['rows'][k]['cut']} (his references {verdict['rows'][k]['ref_min']} .. "
             f"{verdict['rows'][k]['ref_max']})" for k in low]
    return ['below the floor: ' + ', '.join(parts) + ' is below every reference he keeps']


def held_problems(video, digest: str | None, directory: Path, cut: str, *, today: str | None = None) -> list[str]:
    """Everything the floor holds a cut on, for readiness: the pace floor, then the blind judge (velib/judge.py)."""
    from . import judge  # noqa: PLC0415
    return (pace_problems(video, digest, directory, cut)
            + judge.problems(Path(directory), cut, digest, bind=binds(Path(directory), today)))


def held_line(cut: str, floor: list[str]) -> str:
    """The one line Krish sees for a held cut: never a list of patches (Krish, 2026-11-19)."""
    why = '; '.join(r.removeprefix('below the floor: ') for r in floor)
    return (f'{cut}: held: below the floor ({why}). Rebuild once on a proven recipe, never patch beat by beat; '
            'if still held, one line to Krish and nothing is filed.')


# ----------------------------------------------------------------------------------------------------- dead panel lint

STAGINGS = ('band', 'stage', 'tray', 'pillar')
DEAD_PANEL_S = 1.5
WORDS_PER_SECOND = 2.6          # Krish's measured read rate (velib.lint), before ingest gives real times
NOT_CONTENT = {'stamp'}          # a stamp labels a hero card; it never fills a panel alone (motion.stamp_not_hero)


def staging_mode(spec: dict, cut_id: str, directory: Path | None = None) -> str | None:
    """The staging a cut is drawn with: style.layout.mode, else compile's default (pillar for a vertical take on 16:9,
    from the take frame ve ingest measured)."""
    from . import takes  # noqa: PLC0415
    from .compile import default_layout  # noqa: PLC0415
    mode = ((spec.get('style') or {}).get('layout') or {}).get('mode') or \
        default_layout(spec, cut_id, takes.cut_frame(spec, cut_id, directory)[1])
    aspect = spec['cuts'][cut_id]['aspect']
    if mode not in STAGINGS or (mode == 'pillar' and aspect == '9:16'):
        return None   # kit/staging.ts isStaging: a pillar never stages a tall cut
    return mode


def shows_take(beat: dict) -> bool:
    """kit/staging.ts staged(): the beat shows his take and keeps no lock of its own."""
    layout = beat.get('layout')
    if layout in ('SPLIT', 'WINDOW'):
        return False
    source = (beat.get('plate') or {}).get('source', 'take')
    return not (layout == 'STAGE' and source == 'none') and beat.get('face') != 'off'


def _content(spec: dict, beat: dict, objects: dict) -> list[dict]:
    return [objects[u] for u in beat.get('uses', []) if u in objects and objects[u]['device'] not in NOT_CONTENT]


def dead_panel_lints(spec: dict, directory: Path | None = None) -> list[str]:
    """floor.dead_panel: on a staged beat, the panel beside his take is empty (a backdrop or the ink alone) from the
    beat's start until a device, plate or figure enters, or for the whole beat. More than DEAD_PANEL_S of it is refused.
    Seconds are read at his read rate from the words, as the other spec lints are."""
    objects = {o['obj']: o for o in spec.get('objects', [])}
    figure_cuts = set(((spec.get('character') or {}).get('cuts')) or [])
    out = []
    for cut_id, cut in spec['cuts'].items():
        mode = staging_mode(spec, cut_id, directory)
        if mode is None or cut_id in figure_cuts:
            continue
        seen: set[str] = set()   # content objects already on screen, carried from an earlier beat
        for index, beat in enumerate(cut['beats']):
            content = _content(spec, beat, objects)
            plate = (beat.get('plate') or {}).get('source', 'take')
            if not shows_take(beat) or plate.startswith('asset:'):
                seen.update(o['obj'] for o in content)
                continue
            carried = [o for o in content if o['obj'] in seen]
            start = beat['span']['from_w']
            if carried:
                empty_words = 0
            else:
                enters = [e['at_w'] for e in beat.get('events', []) if e['obj'] in {o['obj'] for o in content}]
                empty_words = (min(enters) if enters else beat['span']['to_w'] + 1) - start
            seconds = empty_words / WORDS_PER_SECOND
            if seconds > DEAD_PANEL_S:
                what = 'only a backdrop' if beat.get('backdrop') else 'nothing'
                out.append(f'floor.dead_panel cuts.{cut_id}.beats.{index}: on the {mode} staging the panel beside his take '
                           f'holds {what} for about {seconds:.1f} s (beat {beat["id"]}); put a device, a plate or a figure '
                           f'in it within {DEAD_PANEL_S} s (Krish, 2026-11-19: "Visually, motion, post-production, and '
                           'everything is a zero out of ten")')
            seen.update(o['obj'] for o in content)
    return out


# ------------------------------------------------------------------------------------------------- recipes, from a date

RECIPE_FROM = '2026-11-23'      # binds pieces frozen at ve expect on or after this day, so nothing in flight breaks
RECIPES = CONFIG / 'recipes'
RATED_AT_LEAST = 9


def freeze_day(directory: Path | None, today: str | None = None) -> str:
    """The day the piece's engine and rules froze at ve expect (engine.json `at`); a piece not frozen yet freezes today
    or later, so today stands in for it."""
    if directory is not None:
        lock = Path(directory) / 'engine.json'
        if lock.is_file():
            try:
                at = str(load_json(lock).get('at') or '')
            except (OSError, ValueError):
                at = ''
            if len(at) >= 10:
                return at[:10]
    return today or datetime.now(timezone.utc).strftime('%Y-%m-%d')


def binds(directory: Path | None, today: str | None = None) -> bool:
    return freeze_day(directory, today) >= RECIPE_FROM


def experiment(spec: dict) -> bool:
    """The one named experiment slot (style.experiment): true, or {name, reason}."""
    value = (spec.get('style') or {}).get('experiment')
    return value is True or (isinstance(value, dict) and bool(value.get('name')))


def recipe(name: str | None, root: Path | None = None) -> dict | None:
    if not name:
        return None
    path = Path(root or RECIPES) / f'{name}.json'
    return load_json(path) if path.is_file() else None


def rated(r: dict | None) -> bool:
    """Krish rated the recipe 9 or more, or approved it with no number (Ruling, Krish, 2026-11-20: all ten style combinations
    on the style board are approved; `ve recipe rate <id> --approved`, velib/recipes.py). Either needs his words."""
    rating = (r or {}).get('rated')
    if not isinstance(rating, dict) or rating.get('by') != 'Krish':
        return False
    if rating.get('approved') is True:
        return bool(str(rating.get('words') or '').strip())
    score = rating.get('score')
    return isinstance(score, (int, float)) and not isinstance(score, bool) and score >= RATED_AT_LEAST


def recipe_lints(spec: dict, directory: Path | None = None, *, today: str | None = None, root: Path | None = None) -> list[str]:
    """floor.recipe, floor.recipe_captions and floor.recipe_generated, for a piece frozen on or after RECIPE_FROM."""
    if not binds(directory, today):
        return []
    style = spec.get('style') or {}
    name = style.get('recipe')
    if experiment(spec):
        return []
    r = recipe(name, root)
    if r is None:
        return [f'floor.recipe style.recipe: {name or "none"} is not a recipe in config/ve/recipes/; a piece frozen from '
                f'{RECIPE_FROM} uses a recipe Krish rated {RATED_AT_LEAST} or more, or names its one experiment '
                '(style.experiment) (Ruling, Krish, 2026-11-19: recipes plus one named experiment slot)']
    out = []
    if not rated(r):
        out.append(f'floor.recipe style.recipe: {name} has no rating of {RATED_AT_LEAST} or more, and no approval, from Krish '
                   f'(config/ve/recipes/{name}.json rated); use a rated recipe or name the piece\'s one experiment')
    theme = (style.get('captions') or {}).get('theme')
    allowed = r.get('caption_themes') or []
    if theme and theme not in allowed:
        out.append(f'floor.recipe_captions style.captions.theme: {theme} is not one of recipe {name}\'s caption styles '
                   f'({", ".join(allowed) or "its own word build only"}); captions come only from the recipe')
    kinds = r.get('generated_kinds') or []
    for asset in spec.get('assets', []):
        if asset.get('origin') == 'generated' and asset.get('kind') not in kinds:
            out.append(f'floor.recipe_generated assets.{asset.get("id")}: a generated {asset.get("kind")} is not a slot recipe '
                       f'{name} names ({", ".join(kinds) or "it names none, so generation is off"}); generated animation '
                       'only from the recipe')
    return out


def lints(spec: dict, spec_path: Path | None = None, *, today: str | None = None) -> list[str]:
    """Every floor lint for ve lint."""
    from .verdict import ve_dir  # noqa: PLC0415
    from . import keepout  # noqa: PLC0415
    directory = ve_dir(spec_path) if spec_path else None
    # The dead panel binds from RECIPE_FROM too (Ruling, Krish, 2026-11-19: rules and the engine freeze at Sign storyboard; a
    # new rule or fix binds from the next piece), so it never blocks a proof or render of a piece already in production. The
    # pace floor and the judge are not lints: they only hold a cut from being filed or shown, and ask nothing mid-production.
    dead = dead_panel_lints(spec, directory) if binds(directory, today) else []
    return dead + recipe_lints(spec, directory, today=today) + keepout.missing_lints(spec, directory, today=today)
