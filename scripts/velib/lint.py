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
SOUNDED_VERBS = {'enter', 'stamp', 'mark'}   # the moves a sound can sit on; none needs one (ruling 11)
SOUND_FROM = '2026-11-09'                      # the date the 9 Nov guards bind from (creative_direction.MOTION_FROM)
WORDS_PER_SECOND = 2.6  # Krish's measured read rate, used only before ingest gives real times
LONG_CUT_S = 90  # a cut allowed past this is a long cut: its bed is episode_bed
# His name, a spelling or handle of it, or a possessive of it ("KRISH'S TEST", "@TheRealKrisho", "krishraja.com").
# Krish, 28 Oct 2026: "Remember, no content refers to Krish, ever." One pattern: copy-lint's no_name once
# config/copy-lint.json carries it, this same regex until then. "Raja" alone and "Krishna" pass.
NO_NAME = (r'\b(?:the[ \t_.-]?real[ \t_.-]?krisho|krisho|krish(?:an)?raja\d*|krish(?:an)?(?:[ \t]+raja)?)\b', 'i')
NOT_PUBLIC = {'src', 'id', 'path'}  # device params that name a file or an id, never words on screen


def schema(spec_path: Path) -> tuple[dict | None, list[str]]:
    # Installed TypeScript in-process, matching ve_compile_test.py. Avoid
    # tsx/esbuild's child process (EPERM in the Windows card sandbox).
    code = r"""
const fs = require('node:fs'), ts = require('typescript'), Module = require('node:module');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(id, parent, ...rest) {
  try { return resolve.call(this, id, parent, ...rest); }
  catch (error) {
    if (id.startsWith('.') && id.endsWith('.js')) return resolve.call(this, id.slice(0, -3) + '.ts', parent, ...rest);
    throw error;
  }
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText, filename);
process.argv = [process.argv[0], 'check-spec.ts', process.argv[1], '--normalized'];
require('./packages/contracts/scripts/check-spec.ts');
"""
    result = run(['node', '-e', code, str(spec_path)])
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


def no_name_pattern() -> re.Pattern:
    regex, flags = NO_NAME
    rules = CONFIG.parent / 'copy-lint.json'
    if rules.is_file():
        for rule in load_json(rules).get('patterns', []):
            if rule.get('id') == 'no_name':
                regex, flags = rule['regex'], rule.get('flags', '')
    bits = re.ASCII | (re.IGNORECASE if 'i' in flags else 0) | (re.MULTILINE if 'm' in flags else 0)
    return re.compile(regex, bits)


def public_strings(spec: dict):
    """The spec's words that reach the screen: device params (never a src, id or path), each dataset's producer
    label, unit and row labels, and the dated call. Records such as signed.by, licence and take_edits.why name
    him by right and are never read."""
    for index, obj in enumerate(spec.get('objects', [])):
        for path, text in _strings(obj.get('params', {}), f'objects.{index}.params'):
            if path.rsplit('.', 1)[-1] not in NOT_PUBLIC:
                yield path, text
    for index, dataset in enumerate(spec.get('datasets', [])):
        for key in ('producer_label', 'unit'):
            if isinstance(dataset.get(key), str):
                yield f'datasets.{index}.{key}', dataset[key]
        for row, entry in enumerate(dataset.get('rows', [])):
            if isinstance(entry.get('label'), str):
                yield f'datasets.{index}.rows.{row}.label', entry['label']
    statement = (spec.get('call') or {}).get('statement')
    if isinstance(statement, str):
        yield 'call.statement', statement


def pending_devices_error(format_id: str, fmt: dict | None = None) -> str | None:
    """A format becomes usable only when all its pending devices are registered."""
    if fmt is None:
        fmt = load_json(CONFIG / 'formats' / f'{format_id}.json')
    pending = fmt.get('pending_devices', [])
    if not pending:
        return None
    devices = load_json(CONFIG / 'devices.json')['devices']
    missing = [name for name in pending if name not in devices]
    if missing:
        return f"format {format_id} needs devices not built yet: {', '.join(missing)}"
    return None


def locked_beat_ids(lock: dict, fmt: str) -> tuple[list[str], dict[str, list[str]]]:
    """The format's own locked beat names, and the beat names of every module format (role "module")."""
    own = lock['formats'][fmt]['beats']
    modules = {name: settings['beats'] for name, settings in lock['formats'].items()
               if name != fmt and settings.get('role') == 'module'}
    return own, modules


def beat_sequence_problem(lock: dict, fmt: str, ids: list) -> str | None:
    """A cut is the format's locked beats, in lock order and complete, plus any extra beats the story needs
    (hook, stats, call, close) and the beats of a module format (for example two-passports) in that module's
    order. A beat id the lock does not name has no golden frame: it is composition-checked only."""
    own, modules = locked_beat_ids(lock, fmt)
    if not ids:
        return f'beat ids must be {", ".join(own)} for format {fmt}'
    if [i for i in ids if i in own] != own:
        return f'beat ids must be {", ".join(own)} for format {fmt}'
    for name, names in modules.items():
        used = [i for i in ids if i in names and i not in own]
        if used != [n for n in names if n in used]:
            return f'module {name} beats must keep its order {", ".join(names)}'
    if len(set(ids)) != len(ids):
        return 'beat ids must be unique'
    return None


# Krish, 2026-11-03: "I even gave literal inspiration in the inspiration board on the quality I expect, and also the
# subtitle builds we could have." A spec names the board cards it is held to: one each for look, motion and the
# caption build. Pieces publishing on or before 5 Nov were in flight when this gate landed and are exempt.
REFERENCE_ROLES = ('look', 'motion', 'captions')
REFERENCE_FROM = '2026-11-06'


def reference_lints(spec: dict) -> list[str]:
    day = spec.get('publish_day')
    if day and day < REFERENCE_FROM:
        return []
    refs = spec['brand'].get('references') or []
    out = []
    for role in REFERENCE_ROLES:
        if not any(role in r.get('for', []) for r in refs):
            out.append(f'reference.required brand.references: name an inspiration-board card for {role} '
                       f'(id, card, for, drive_id, takeaway); take it from the board: GET /api/inspiration/candidates, '
                       f'or ve init')
    # A card is named by its board id, so the board, the making record and card_uses join on it (Wave 3,
    # docs/handovers/2026-11-03-engine-audit.md). Whether the id is a live production card is checked online by ve refs;
    # lint stays offline and deterministic.
    for index, ref in enumerate(refs):
        if not ref.get('id'):
            out.append(f'reference.id brand.references.{index}: {ref["card"]} needs its Inspiration card id '
                       '(inspiration_items.id); read it from GET /api/inspiration/cards or the candidates route')
        if ref.get('offered'):
            out.append(f'reference.offered brand.references.{index}: {ref["card"]} was offered by ve init, not chosen; '
                       'open the card, confirm it serves this piece and delete "offered", or replace it')
    ids = [r['id'] for r in refs if r.get('id')]
    for card_id in sorted({i for i in ids if ids.count(i) > 1}):
        out.append(f'reference.duplicate brand.references: card id {card_id} is listed twice; give it one entry with every role it serves')
    cards = [r['card'] for r in refs]
    for card in sorted({c for c in cards if cards.count(c) > 1}):
        out.append(f'reference.duplicate brand.references: {card} is listed twice; give it one entry with every role it serves')
    return out


def motion_style_problems(spec: dict) -> list[str]:
    """style.motion: one module from the motion layer of config/style-references.json, with the point it lands. The
    same rule and start date the creative direction uses (scripts/post-pack/creative_direction.py motion_problems), so
    the ve route and the quick-edit direction can never hold different motion rules."""
    import sys
    from .common import ROOT
    sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
    import creative_direction  # noqa: E402
    return creative_direction.motion_problems(spec)


def motion_lints(spec: dict) -> list[str]:
    """The premium motion standard (docs/ve/MOTION_STANDARD.md) where a spec alone can show it."""
    out = []
    objects = {o['obj']: o for o in spec['objects']}
    if spec['signature']['hero']['device'] == 'stamp':
        out.append('motion.stamp_not_hero signature.hero.device: the stamp draws fixed 30 px mono text; it labels, it is '
                   'never the hero (docs/ve/MOTION_STANDARD.md)')
    day = spec.get('publish_day')
    if spec['format'] == 'face-with-proof' and spec['brand'].get('captions') != 'word' and not (day and day < REFERENCE_FROM):
        out.append('captions.word_default brand.captions: face-with-proof uses the word caption build, one word at a time '
                   'off the face (signed by Krish, 3 Nov 2026, docs/ve/MOTION_STANDARD.md)')
    out.extend(f'motion.required {problem}' for problem in motion_style_problems(spec))
    for cut_id, cut in spec['cuts'].items():
        for index, beat in enumerate(cut['beats']):
            used = [objects[name]['device'] for name in beat['uses'] if name in objects]
            if used and all(device == 'stamp' for device in used):
                out.append(f'motion.stamp_not_hero cuts.{cut_id}.beats.{index}: beat {beat["id"]} shows only stamps; '
                           'a stamp labels a hero card, it never carries a beat alone')
    return out


def palette_lints(spec: dict) -> list[str]:
    """brand.palette: each whole cut's opening, sting and close against config/brand-palette.json for its day
    (Ruling, Krish, 2026-11-12: "I approve the brand palette sheet, but only if it falls in line with the
    attached"). What ve will draw is read from compile, the one place it is decided: its close is ENDING_FRAMES
    long on both shapes, and its sting sits where STING_POSITION says (in front of the hook until compile names
    another). A spec dated before the palette's applies_from is not checked."""
    import sys  # noqa: PLC0415
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    import brand_palette  # noqa: PLC0415
    from . import compile as ve_compile  # noqa: PLC0415
    when = spec.get('publish_day')
    if not when:
        return []
    palette = brand_palette.load()
    series = str((spec.get('brand') or {}).get('series') or '').replace('.', '_')
    day = brand_palette.day(when, palette)
    kind = 'series' if day['kind'] == 'series' and day.get('series') == series else 'off'
    out = []
    for cut_id, cut in spec['cuts'].items():
        if cut.get('excerpt'):
            continue
        shape = {'16:9': '16x9', '9:16': '9x16'}.get(cut.get('aspect'))
        if not shape:
            continue
        sting = 'none'
        if shape == '16x9' and kind == 'series':
            sting = getattr(ve_compile, 'STING_POSITION', 'before_hook')
        record = {'date': when, 'format': 'long_cut' if shape == '16x9' else 'short_cut', 'shape': shape, 'kind': kind,
                  'opening': 'hook', 'sting': sting,
                  'close': {'id': 'statement_card' if shape == '16x9' else 'statement_beat',
                            'seconds': ve_compile.ENDING_FRAMES / ve_compile.FPS}}
        out += [f'brand.palette cuts.{cut_id}: {p}' for p in brand_palette.check(record, palette)]
    return out


def crew_lints(spec: dict, history: list[dict] | None = None) -> list[str]:
    from . import guards
    out: list[str] = reference_lints(spec) + motion_lints(spec) + guards.spec_lints(spec) + palette_lints(spec)
    from . import character
    out.extend(character.spec_lints(spec))  # nothing unless the spec names a character
    from . import designlock
    lock = designlock.load()
    if spec['format'] in lock['formats'] and not designlock.frozen(lock, spec['format'])[0]:
        out.append(f'format {spec["format"]} has no frozen design lock')
    fmt = load_json(CONFIG / 'formats' / f"{spec['format']}.json")
    objects = {o['obj']: o for o in spec['objects']}
    if spec['format'] in lock['formats']:
        allowed = lock.get('thresholds', {}).get('scribbles_per_beat', 1)
        for cut_id, cut in spec['cuts'].items():
            for index, beat in enumerate(cut['beats']):
                scribbles = sum(objects.get(name, {}).get('device') == 'scribble' for name in set(beat['uses']))
                if scribbles > allowed:
                    out.append(f'scribbles_per_beat cuts.{cut_id}.beats.{index}: beat {beat["id"]} uses {scribbles} scribbles, the design lock allows {allowed}')
    pending_error = pending_devices_error(spec['format'], fmt)
    if pending_error:
        return out + [pending_error]

    # brand
    for path, text in _strings(spec):
        if HEX.search(text) and not path.startswith('assets.'):
            out.append(f'brand.no_hex {path}: name a colour role from config/ve/brand-tokens.json, not hex')
    for obj in spec['objects']:
        if obj['device'] in DATA_DEVICES and not obj.get('dataset'):
            out.append(f"brand.digit_producer objects.{obj['obj']}: a {obj['device']} binds a dataset so its numbers name their producer")
    # No override: any Krish on screen is refused, another person's included (Krish picked "Yes, block it", 28 Oct 2026).
    name = no_name_pattern()
    for path, text in public_strings(spec):
        hit = name.search(text)
        if hit:
            out.append(f'brand.no_name {path}: "{hit.group(0)}" puts his name on screen; no public word names him, '
                       'and a test the publication ran reads OUR TEST · <date>')

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
        if spec['format'] in lock['formats']:
            problem = beat_sequence_problem(lock, spec['format'], [beat.get('id') for beat in beats])
            if problem:
                out.append(f'{where}: {problem}')
            if not beats:
                continue
        # sound: one, on the big moment only (Krish, 29 Oct 2026, THE_BAR ruling 11: "Only the big moment"); every
        # other move is silent by default, so a move with no sound is no longer a finding. Binds pieces from 9 Nov.
        sounded = [e for b in beats for e in b['events'] if e.get('sfx')]
        if len(sounded) > 1 and (spec.get('publish_day') or '') >= SOUND_FROM:
            out.append(f'sound.one_moment {where}: {len(sounded)} moves carry a sound; one sound, on the big moment only '
                       '(THE_BAR ruling 11)')
        # dialogue
        if cut['aspect'] == '9:16' and cut['max_s'] > 89:
            out.append(f'dialogue.short_max {where}.max_s: a 9:16 short is 89 s or less')
        # story
        first = beats[0]
        if not any(e['at_w'] <= first['span']['from_w'] + 4 for e in first['events']):
            out.append(f'story.hook_event {where}.beats.0: the first visual event must land within the first 4 words of the hook '
                       '(about 1.5 s after his first word, which follows the intro sting on a wide series cut)')
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
            if verb != 'enter' and not ((verb, objects.get(obj_id, {}).get('device')) in {('draw', 'scribble'), ('stamp', 'stamp')}):
                out.append(f'motion.enters {where}: {obj_id} first acts with "{verb}" at word {word}; an object enters before anything else happens to it, or it never appears')
        if cut['aspect'] == '9:16' and whole:
            minutes = max(1.0, (beats[-1]['span']['to_w'] - beats[0]['span']['from_w']) / (WORDS_PER_SECOND * 60))
            need = math.ceil(fmt['qc'].get('layout_types_per_min_tall', 1) * min(minutes, 1.0))
            # Krish may waive variety for a piece in his own words (an exception approval), as for Thursday 5 Nov:
            # "This Thursday video should be the simplest to produce and feature my face minimally".
            if len(layouts) < need and not any(a['gate'] == 'exception' and a.get('scope') != 'engine' for a in spec['approvals']):
                out.append(f'motion.layout_variety {where}: {len(layouts)} layout types, the format needs at least {need} a minute')

    bed_mode = spec['audio']['bed']['mode']
    if spec['audio']['master'] == 'vo' and bed_mode not in ('continuous', 'ducked', 'episode_bed'):
        if not any(a['gate'] == 'exception' and a.get('scope') != 'engine' for a in spec['approvals']):
            out.append('sound.bed_continuous audio.bed.mode: a voiceover cut carries a continuous, ducked or episode_bed bed (episode mode needs an exception approval)')
    # A long cut carries the approved episode bed: one low level under the voice, lifts only at chapter cards
    # (config/learnings.json deep-cut-music-always-under). Krish, Gate 2, 2026-10-30, of a ducked long cut:
    # "Sometimes it just turns off randomly. Sometimes it's quiet. Sometimes it gets louder." and of its ducked
    # 90-second cut: "Same issue with the 90-second video on that day". So no cut carries a ducked bed.
    long_cuts = [cid for cid, cut in spec['cuts'].items() if cut['max_s'] > LONG_CUT_S and not cut.get('excerpt')]
    # Every finished cut carries the approved episode bed, short cuts too: its ledger levels lift the music before
    # the first word and over the ending band, which a flat continuous bed never does (Krish, 2026-11-03: "We
    # fucking have standards for intro, background audio and outro"). Only a proof excerpt may run a plain bed.
    whole_cuts = [cid for cid, cut in spec['cuts'].items() if not cut.get('excerpt')]
    if whole_cuts and bed_mode != 'episode_bed' and not long_cuts:
        out.append(f'sound.whole_cut_bed audio.bed.mode: {", ".join(whole_cuts)} is a finished cut, so the bed is episode_bed (the approved intro, bed and outro levels), not {bed_mode}')
    if long_cuts and bed_mode != 'episode_bed':
        out.append(f'sound.long_cut_bed audio.bed.mode: {", ".join(long_cuts)} run past {LONG_CUT_S} s, so the bed is episode_bed, not {bed_mode}')
    elif bed_mode == 'ducked':
        out.append('sound.bed_steady audio.bed.mode: a ducked bed swings with the voice; use episode_bed (or continuous)')

    return out


NOVELTY_LAST = 3
HISTORY = 'history.json'   # config/ve/history.json, one row per filed piece (velib.filing.record_history)


def novelty_note(spec: dict, history: list[dict] | None = None) -> str | None:
    """A line for the expectations sheet when the hero device or motion style repeats one of the last three filed
    pieces (ghost-editor's rule: a reel uses parts the last reels did not). Advisory, never a refusal: no repeat rule
    has his approval, and every earlier ve spec used the same hero (F14: no gate on an unproven method)."""
    if history is None:
        path = CONFIG / HISTORY
        history = load_json(path)['pieces'] if path.exists() else []
    recent = history[-NOVELTY_LAST:]
    hero = (spec.get('signature') or {}).get('hero', {}).get('device')
    motion = ((spec.get('style') or {}).get('motion') or {})
    module = motion.get('module') if isinstance(motion, dict) else None
    repeats = []
    if hero and any(h.get('hero') == hero for h in recent):
        repeats.append(f'the hero device {hero}')
    if module and any(h.get('motion') == module for h in recent):
        repeats.append(f'the motion style {module}')
    if not repeats:
        return None
    return f"Repeats {' and '.join(repeats)} from one of the last {NOVELTY_LAST} pieces filed; say why, or change it."


def lint(spec_path: Path) -> tuple[dict | None, list[str]]:
    spec, problems = schema(spec_path)
    if spec is None:
        return None, problems
    return spec, crew_lints(spec)
