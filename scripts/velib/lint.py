"""ve lint: the schema gate (zod, via check-spec.ts) plus the crew lints. Each finding is one line:
`CODE path: message`. Errors block a render; there are no warnings, only fixes or an override_reason."""
from __future__ import annotations

import json
import math
import re
from pathlib import Path

from .common import CONFIG, load_json, run

HEX = re.compile(r'#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b')
DIGIT = re.compile(r'\d')
DATA_DEVICES = {'kinetic_stat', 'bar_compare', 'test_grid', 'record_card', 'bar_race'}
SOUNDED_VERBS = {'enter', 'stamp', 'mark'}
WORDS_PER_SECOND = 2.6  # Krish's measured read rate, used only before ingest gives real times


def schema(spec_path: Path) -> tuple[dict | None, list[str]]:
    result = run(['npx', 'tsx', 'packages/contracts/scripts/check-spec.ts', str(spec_path), '--normalized'])
    if result.returncode == 0:
        return json.loads(result.stdout), []
    lines = [line for line in (result.stdout + result.stderr).splitlines() if line.strip()]
    return None, lines or [f'SCHEMA (root): check-spec exited {result.returncode}']


def _strings(node, path=''):
    if isinstance(node, dict):
        for key, value in node.items():
            yield from _strings(value, f'{path}.{key}' if path else key)
    elif isinstance(node, list):
        for index, value in enumerate(node):
            yield from _strings(value, f'{path}.{index}')
    elif isinstance(node, str):
        yield path, node


def crew_lints(spec: dict, history: list[dict] | None = None) -> list[str]:
    out: list[str] = []
    from . import designlock
    lock = designlock.load()
    if spec['format'] in lock['formats'] and not designlock.frozen(lock, spec['format'])[0]:
        out.append(f'format {spec["format"]} has no frozen design lock')
    fmt = load_json(CONFIG / 'formats' / f"{spec['format']}.json")
    objects = {o['obj']: o for o in spec['objects']}

    # brand
    for path, text in _strings(spec):
        if HEX.search(text) and not path.startswith('assets.'):
            out.append(f'brand.no_hex {path}: name a colour role from config/ve/brand-tokens.json, not hex')
    for obj in spec['objects']:
        if obj['device'] in DATA_DEVICES and not obj.get('dataset'):
            out.append(f"brand.digit_producer objects.{obj['obj']}: a {obj['device']} binds a dataset so its numbers name their producer")

    budget = spec['budget']['credits']
    used: dict[str, float] = {}
    for asset in spec['assets']:
        if asset.get('credits'):
            used[asset.get('tool', '?')] = used.get(asset.get('tool', '?'), 0) + asset['credits']
    for tool, total in used.items():
        if tool in budget and total > budget[tool]:
            out.append(f'provenance.credits_budget budget.credits.{tool}: {total} used against {budget[tool]} approved')

    for cut_id, cut in spec['cuts'].items():
        beats = cut['beats']
        where = f'cuts.{cut_id}'
        # dialogue
        if cut['aspect'] == '9:16' and cut['max_s'] > 89:
            out.append(f'dialogue.short_max {where}.max_s: a 9:16 short is 89 s or less')
        # story
        first = beats[0]
        if not any(e['at_w'] <= first['span']['from_w'] + 4 for e in first['events']):
            out.append(f'story.hook_event {where}.beats.0: the first visual event must land within the first 4 words (about 1.5 s)')
        roles = [b['role'] for b in beats]
        whole = not cut.get('excerpt')
        if whole and roles.count('payoff') != 1:
            out.append(f'story.one_payoff {where}: exactly one payoff beat (found {roles.count("payoff")})')
        if whole and spec['brand']['series'] == 'mind.the.gap' and 'call' not in roles:
            out.append(f'story.call {where}: mind.the.gap ends on a call beat carrying the dated call')
        run_role, run_len = None, 0
        for index, role in enumerate(roles):
            run_len = run_len + 1 if role == run_role else 1
            run_role = role
            if role in ('anchor', 'bridge') and run_len == 3:
                out.append(f'story.alternation {where}.beats.{index}: three {role} beats in a row; alternate anchor and bridge')
        # creative, motion, sound
        layouts = set()
        for index, beat in enumerate(beats):
            at = f'{where}.beats.{index}'
            layouts.add(beat['layout'])
            words = beat['span']['to_w'] - beat['span']['from_w'] + 1
            if index and not beat.get('override_reason'):
                prev = beats[index - 1]
                new_state = [e for e in beat['events'] if e['verb'] != 'carry']
                if prev['layout'] == beat['layout'] and prev['uses'] == beat['uses'] and not new_state:
                    out.append(f'creative.no_repeat {at}: same layout and devices as the beat before with no new state change')
            if DIGIT.search(beat['point']) and not beat.get('override_reason'):
                devices = {objects[u]['device'] if u in objects else u.split('@')[0] for u in beat['uses']}
                if not devices & DATA_DEVICES:
                    out.append(f'creative.decision_engine {at}: the point carries a number, so a data device shows it (kinetic_stat, bar_compare, test_grid, record_card) or give override_reason')
            needed = max(1, math.ceil(words / (WORDS_PER_SECOND * 3)))
            if beat['role'] not in ('call',) and len(beat['events']) < needed and not beat.get('override_reason'):
                out.append(f'motion.event_cadence {at}: {words} words need at least {needed} events (one every 3 s), found {len(beat["events"])}')
            for j, event in enumerate(beat['events']):
                obj = objects.get(event['obj'])
                if obj and event['obj'] not in beat['uses'] and f"{obj['device']}@" not in ' '.join(beat['uses']):
                    out.append(f"motion.carry {at}.events.{j}: event on {event['obj']}, which this beat does not use")
                if event['verb'] in SOUNDED_VERBS and not event.get('sfx') and not event.get('silent'):
                    out.append(f'sound.event_sfx {at}.events.{j}: a {event["verb"]} carries an sfx from the house kit or is marked silent')
            for used_obj in beat['uses']:
                if used_obj in objects:
                    persist = objects[used_obj]['persist']
                    ids = [b['id'] for b in beats]
                    if persist['from_beat'] in ids and persist['to_beat'] in ids:
                        lo, hi = ids.index(persist['from_beat']), ids.index(persist['to_beat'])
                        if not lo <= index <= hi:
                            out.append(f'motion.carry {at}.uses: {used_obj} is used outside its persist range {persist["from_beat"]}..{persist["to_beat"]}')
        first_verb: dict[str, tuple[int, str]] = {}
        for beat in beats:
            for event in beat['events']:
                first_verb.setdefault(event['obj'], (event['at_w'], event['verb']))
        for obj_id, (word, verb) in first_verb.items():
            if verb != 'enter':
                out.append(f'motion.enters {where}: {obj_id} first acts with "{verb}" at word {word}; an object enters before anything else happens to it, or it never appears')
        if cut['aspect'] == '9:16' and whole:
            minutes = max(1.0, (beats[-1]['span']['to_w'] - beats[0]['span']['from_w']) / (WORDS_PER_SECOND * 60))
            need = math.ceil(fmt['qc'].get('layout_types_per_min_tall', 1) * min(minutes, 1.0))
            if len(layouts) < need:
                out.append(f'motion.layout_variety {where}: {len(layouts)} layout types, the format needs at least {need} a minute')

    if spec['audio']['master'] == 'vo' and spec['audio']['bed']['mode'] != 'continuous':
        if not any(a['gate'] == 'exception' for a in spec['approvals']):
            out.append('sound.bed_continuous audio.bed.mode: a voiceover cut carries a continuous bed (episode mode needs an exception approval)')

    if history:
        hero = spec['signature']['hero']['device']
        recent = history[-3:]
        if any(h.get('hero') == hero for h in recent):
            out.append(f'creative.novelty signature.hero: {hero} was the hero in one of the last three pieces')
    return out


def lint(spec_path: Path) -> tuple[dict | None, list[str]]:
    spec, problems = schema(spec_path)
    if spec is None:
        return None, problems
    history_path = CONFIG / 'history.json'
    history = load_json(history_path)['pieces'] if history_path.exists() else []
    return spec, crew_lints(spec, history)
