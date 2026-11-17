"""ve lint: the schema gate (zod, via check-spec.ts) plus the crew lints. Each finding is one line:
`CODE path: message`. Errors block a render; there are no warnings, only fixes or an override_reason."""
from __future__ import annotations

import json
import math
import re
from pathlib import Path

from .common import CONFIG, ROOT, load_json, run

HEX = re.compile(r'#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b')
DIGIT = re.compile(r'\d')
DATA_DEVICES = {'kinetic_stat', 'bar_compare', 'test_grid', 'record_card', 'bar_race'}
SOUNDED_VERBS = {'enter', 'stamp', 'mark'}   # the moves a sound can sit on; none needs one (ruling 11)
SOUND_FROM = '2026-11-09'                      # the date the 9 Nov guards bind from (creative_direction.MOTION_FROM)
WORDS_PER_SECOND = 2.6  # Krish's measured read rate, used only before ingest gives real times
LONG_CUT_S = 90  # a cut allowed past this is a long cut: its bed is episode_bed


def short_cut() -> dict:
    """The short (tall) cut's limits, house rule TWO_CUTS: the JSON between // SHORT_CUT:BEGIN and :END in the house
    rules. Ruling (Krish, 2026-11-16), of Growth's audience brief, changes 1 and 2: "apply 1 to 6 from the next piece
    you make this week" (verticals of 20 to 35 seconds that win their first two seconds)."""
    text = (ROOT / 'apps' / 'control-plane' / 'api' / '_houseRules.ts').read_text(encoding='utf-8')
    block = text.split('// SHORT_CUT:BEGIN', 1)[1].split('// SHORT_CUT:END', 1)[0]
    return json.loads(block[block.index('{'):block.rindex('}') + 1])
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


def motion_not_drawable(spec: dict) -> list[str]:
    """style.motion names a style the renderer cannot draw yet (kit/motion-profiles.json needs_device): compile would
    carry only its id and the cut would render in the house motion without a word (fleet audit 14 Nov, ve-1). Refused
    here until its device is built and Krish says yes to its test render."""
    from .compile import MOTION_PROFILES  # noqa: PLC0415
    module = ((spec.get('style') or {}).get('motion') or {}).get('module')
    if not module:
        return []
    table = json.loads(MOTION_PROFILES.read_text(encoding='utf-8'))
    if module in table.get('needs_device', []):
        return [f'motion.not_drawable style.motion.module: {module} waits on its own device (kit/motion-profiles.json '
                'needs_device), so the cut would render in the house motion; pick a style the renderer draws']
    return []


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
    out.extend(motion_not_drawable(spec))
    from . import palettes  # noqa: PLC0415
    out.extend(palettes.spec_problems(spec))
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
    long on both shapes, and no cut carries a sting (Ruling, Krish, 2026-11-12: "Nothing before the hook, ever. Remove
    the sting exception for good."). A spec dated before the palette's applies_from is not checked."""
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
        record = {'date': when, 'format': 'long_cut' if shape == '16x9' else 'short_cut', 'shape': shape, 'kind': kind,
                  'opening': 'hook', 'sting': sting,
                  'close': {'id': 'statement_card' if shape == '16x9' else 'statement_beat',
                            'seconds': getattr(ve_compile, 'ENDING_FRAMES_BY_ASPECT', {}).get(cut.get('aspect'), ve_compile.ENDING_FRAMES)
                            / ve_compile.FPS, 'days_row': kind == 'series'}}
        out += [f'brand.palette cuts.{cut_id}: {p}' for p in brand_palette.check(record, palette)]
    return out


TITLE_MOMENT_FROM = '2026-11-16'


def _title_words(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9']+", str(text).lower()) if w not in {'the', 'a', 'an', 'of', 'to', 'and', 'is'}]


def title_moment_lints(spec: dict) -> list[str]:
    """title.moment: a series piece says its episode title as a natural sentence near the start, and the spec marks
    it so the renderer shows it as the title and the captions step aside (Krish, 2026-11-15: the episode title should be
    "integrated into a sentence seamlessly near the start of the video and the production suite knows that this is the
    moment to make it feel like the title, instead of regular captions"). From TITLE_MOMENT_FROM, on a series day."""
    when = spec.get('publish_day')
    if not when or when < TITLE_MOMENT_FROM:
        return []
    import sys  # noqa: PLC0415
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    import brand_palette  # noqa: PLC0415
    series = str((spec.get('brand') or {}).get('series') or '').replace('.', '_')
    day = brand_palette.day(when, brand_palette.load())
    if not (day['kind'] == 'series' and day.get('series') == series):
        return []
    moment = spec.get('title_moment')
    if not moment:
        return ['title.moment: a series piece names its episode title moment (title_moment: {title, line}): the sentence '
                'near the start where he says the title, shown as the title with the captions stepped aside (Krish, 2026-11-15)']
    title, line = _title_words(moment.get('title')), set(_title_words(moment.get('line')))
    if title and sum(w in line for w in title) / len(title) < 0.7:
        return ['title.moment: the line does not carry the title; the title is said inside a natural sentence']
    out = []
    for cut_id, span in (moment.get('spans') or {}).items():
        cut = spec['cuts'].get(cut_id)
        if cut is None:
            out.append(f'title.moment spans.{cut_id}: no such cut')
        elif span['to_w'] < span['from_w']:
            out.append(f'title.moment spans.{cut_id}: the span ends before it starts')
        elif cut.get('beats') and span['from_w'] > cut['beats'][min(2, len(cut['beats']) - 1)]['span']['to_w']:
            out.append(f'title.moment spans.{cut_id}: the title is said near the start, within the first three beats')
    return out


# INV-SYNTHETIC-OFF (config/ve/invariants.json; Krish, 2026-10-27: "on backup until trained and convincing"): no
# synthetic Krish voice or likeness until he approves it. That approval lives once, in krish-clone's registry
# (docs/REGISTRY.md there): one entry per approved clone, his exact words, the date and approved_sha256, the sha256 of
# exactly what he approved. His own say-so is enough (Ruling, Krish, 2026-11-15); a scored listening panel is optional.
# It is read live from krish-clone main, the way voice_score.mjs reads ai-harness, and only when a spec uses a synthetic
# capability or claims a synthetic approval, so every other lint stays offline. An unreadable or malformed registry
# refuses; it never passes.
SYNTHETIC_REGISTRY = 'https://raw.githubusercontent.com/krishanraja/krish-clone/main/config/synthetic-approvals.json'
SYNTHETIC_FORMAT = 'krish-clone.synthetic-approvals/1'
SYNTHETIC_KIND = {'voice_clone': 'voice', 'avatar': 'likeness', 'lipsync': 'likeness'}  # tools.json realism_test keys
SYNTHETIC_FIELDS = ('name', 'kind', 'platform', 'approved_sha256', 'approved_words', 'approved_on')
CLONE_NAME = re.compile(r':\s*([a-z][a-z0-9]*(?:-[a-z0-9]+)+)\s*$')


def synthetic_capabilities() -> dict[str, dict[str, str]]:
    """{tool: {capability: kind}} for each capability config/ve/tools.json holds behind the realism test. A capability
    this file has no kind for is 'unknown', which no registry entry matches, so it is refused until it is named here."""
    found: dict[str, dict[str, str]] = {}
    for tool, entry in load_json(CONFIG / 'tools.json')['tools'].items():
        for capability, ruling in (entry.get('requires_ruling') or {}).items():
            if ruling == 'realism_test':
                found.setdefault(tool, {})[capability] = SYNTHETIC_KIND.get(capability, 'unknown')
    return found


def synthetic_uses(spec: dict) -> list[dict]:
    """Each asset that is a synthetic Krish voice or likeness: its tool names a realism-test capability
    (elevenlabs.voice_clone:krish-voice-1, the clone's registry name after the colon), or it is generated footage from a
    tool whose ruled capabilities make a likeness (HeyGen's other slots only propose cuts of real footage), or it is a
    generated recording, which can only be a voice."""
    ruled = synthetic_capabilities()
    uses = []
    from . import voice_bank  # noqa: PLC0415
    for index, asset in enumerate(spec.get('assets') or []):
        tool = str(asset.get('tool') or '').strip().lower()
        # A stock ElevenLabs voice from the voice bank is never his voice or likeness: voice.clone_route holds it to the
        # bank instead (an approved stock voice; his own voice named as stock is refused there).
        if asset.get('kind') == 'voice' and voice_bank.stock_name(tool):
            continue
        head = CLONE_NAME.sub('', tool)  # the capability is read before the clone's name, never inside it
        base = re.split(r'[.:/\s]', head, maxsplit=1)[0]
        matched = [(owner, capability_kind) for owner, capabilities in ruled.items()
                   for capability, capability_kind in capabilities.items()
                   if re.search(r'(?<![a-z])' + capability.replace('_', '[ _-]?') + r'(?![a-z])', head)]
        kind = None
        if matched:
            kinds = {k for _, k in matched}
            kind = kinds.pop() if len(kinds) == 1 else 'unknown'  # two kinds in one tool fails closed
            owners = {o for o, _ in matched}
            if base not in ruled and len(owners) == 1:
                base = owners.pop()
        if asset.get('kind') == 'voice':  # a clone voice is a synthetic voice whatever its tool says; a likeness tool fails closed
            kind = 'voice' if kind in (None, 'voice') else 'unknown'
        if kind is None and asset.get('origin') == 'generated':
            if asset.get('kind') == 'recording':
                kind = 'voice'
            elif asset.get('kind') in ('broll', 'illustration') and 'likeness' in ruled.get(base, {}).values():
                kind = 'likeness'
        if kind:
            name = CLONE_NAME.search(tool)
            uses.append({'path': f'assets.{index}', 'tool': tool or '(no tool)', 'platform': base, 'kind': kind,
                         'name': name.group(1) if name else None, 'origin': asset.get('origin')})
    return uses


def fetch_synthetic_registry() -> str:
    """krish-clone's registry as main holds it now. curl honours the proxy on every machine ve runs on."""
    result = run(['curl', '-fsSL', '--max-time', '20', SYNTHETIC_REGISTRY])
    if result.returncode != 0:
        raise RuntimeError(f'curl exited {result.returncode}: {(result.stderr or "").strip()[:160]}')
    return result.stdout


def read_synthetic_registry(fetch=None) -> list[dict]:
    """The active entries. Raises on anything unreadable or malformed; the caller refuses."""
    data = json.loads((fetch or fetch_synthetic_registry)())
    if not isinstance(data, dict) or data.get('format') != SYNTHETIC_FORMAT:
        raise ValueError(f'format is not {SYNTHETIC_FORMAT}')
    entries = data.get('approvals')
    if not isinstance(entries, list):
        raise ValueError('approvals is not a list')
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict) or any(not isinstance(entry.get(k), str) or not entry[k].strip() for k in SYNTHETIC_FIELDS):
            raise ValueError(f'approvals[{index}] is incomplete')
        if not re.fullmatch(r'[0-9a-f]{64}', entry['approved_sha256']):
            raise ValueError(f'approvals[{index}] has no approved_sha256')
    return [entry for entry in entries if not entry.get('withdrawn')]


def _synthetic_match(entry: dict, approval: dict) -> bool:
    return (approval.get('gate') == 'synthetic' and approval.get('by') == 'Krish'
            and approval.get('artifact_hash') == entry['approved_sha256']
            and approval.get('said') == entry['approved_words'] and approval.get('on') == entry['approved_on'])


def synthetic_lints(spec: dict, fetch=None) -> list[str]:
    """voice.synthetic: every synthetic Krish voice or likeness names an approved clone in krish-clone's registry, and
    the spec carries that clone's approval (approvals[gate=synthetic]: by Krish, said, on and artifact_hash, copied
    exactly from the registry entry). A synthetic approval the registry does not hold is refused too."""
    uses = synthetic_uses(spec)
    claimed = [(i, a) for i, a in enumerate(spec.get('approvals') or []) if a.get('gate') == 'synthetic']
    if not uses and not claimed:
        return []
    try:
        registry, unreadable = read_synthetic_registry(fetch), None
    except Exception as failed:  # noqa: BLE001 - any failure to read is a refusal, never a pass
        registry, unreadable = [], f'{type(failed).__name__}: {failed}'
    out = []
    for use in uses:
        where = f"voice.synthetic {use['path']}"
        what = f"{use['tool']} is a synthetic Krish {use['kind']}"
        if unreadable:
            out.append(f'{where}: {what}, and the approvals registry could not be read ({unreadable}), so it is refused '
                       f'(INV-SYNTHETIC-OFF; {SYNTHETIC_REGISTRY})')
            continue
        if use['origin'] in ('capture', 'source', 'licensed'):
            out.append(f"{where}: {what} but is marked origin {use['origin']}; a synthetic voice or likeness is generated, "
                       'never evidence (INV-EVIDENCE-REAL)')
            continue
        if not use['name']:
            out.append(f'{where}: {what} that names no approved clone; write its tool as <tool>.<capability>:<clone name> '
                       "with the name from krish-clone's registry (INV-SYNTHETIC-OFF)")
            continue
        entry = next((e for e in registry if e['name'] == use['name'] and e['kind'] == use['kind']
                      and e['platform'] == use['platform']), None)
        if entry is None:
            out.append(f"{where}: {use['name']} is not an approved {use['kind']} from {use['platform']} in krish-clone's "
                       'registry; no spec uses a synthetic Krish until he approves it (INV-SYNTHETIC-OFF)')
        elif not any(_synthetic_match(entry, approval) for _, approval in claimed):
            out.append(f"{where}: {use['name']} is approved, but the spec carries no matching approval: add "
                       'approvals[gate=synthetic] with by Krish, and said, on and artifact_hash copied exactly from its '
                       f"registry entry (artifact_hash {entry['approved_sha256']})")
    for index, approval in claimed:
        if unreadable:
            out.append(f'voice.synthetic approvals.{index}: a synthetic approval cannot be checked; the approvals registry '
                       f'could not be read ({unreadable})')
        elif not any(_synthetic_match(entry, approval) for entry in registry):
            out.append(f"voice.synthetic approvals.{index}: this synthetic approval matches no active entry in krish-clone's "
                       'registry (his words, the date and its approved_sha256, exactly)')
    return out


# Off-day voiceover shorts may be voiced with his approved ElevenLabs clone; hero cuts stay on his real takes (Ruling,
# Krish, 2026-11-15). A spec carries the clone as one asset of kind voice (the schema holds its shape: a voiceover
# master, every cut a 9:16 short taking it). This row holds what the schema cannot read: the piece is published on an
# off day (guards.off_day, from config/studio.json's series days), and the voice is ElevenLabs' voice clone, the one the
# ruling names. voice.synthetic holds his approval of the clone itself in krish-clone's registry.
CLONE_VOICE_RULING = ('Ruling, Krish, 2026-11-15: off-day voiceover shorts may be voiced with his approved ElevenLabs '
                      'clone; hero cuts stay on his real takes')
CLONE_VOICE_PLATFORM, CLONE_VOICE_CAPABILITY = 'elevenlabs', 'voice_clone'


def clone_voices(spec: dict) -> list[tuple[int, dict]]:
    return [(index, asset) for index, asset in enumerate(spec.get('assets') or []) if asset.get('kind') == 'voice']


def clone_route_problems(spec: dict) -> list[str]:
    """Why this spec is not an off-day voiceover short his clone may voice, [] when it is. Read with or without the voice
    asset, so `ve voice clone` checks the route before anything is generated."""
    from . import guards
    route = f'his clone voices an off-day voiceover short only ({CLONE_VOICE_RULING})'
    out = []
    if not guards.off_day(spec):
        day, series = spec.get('publish_day'), (spec.get('brand') or {}).get('series')
        why = (f'{day} is the {series} day, so this is a hero piece and stays on his real takes' if day and guards.series_day(spec)
               else 'no off day can be read for this spec (publish_day and its series day)')
        out.append(f'voice.clone_route publish_day: {why}: {route}')
    if (spec.get('audio') or {}).get('master') != 'vo':
        out.append(f'voice.clone_route audio.master: a clone-voiced spec has the voiceover master (vo): {route}')
    for cut_id, cut in (spec.get('cuts') or {}).items():
        if cut.get('aspect') != '9:16':
            out.append(f'voice.clone_route cuts.{cut_id}.aspect: {cut.get("aspect")} is no short; every cut is 9:16: {route}')
    return out


def clone_tool_problem(asset: dict) -> str | None:
    """None when the asset's tool is ElevenLabs' voice clone with a registry name after the colon, or an approved stock
    voice from the voice bank (elevenlabs.stock_voice:<id>; Krish, 2026-11-17: "We should have some stock voices
    approved in Eleven Labs")."""
    from . import voice_bank  # noqa: PLC0415
    tool = str(asset.get('tool') or '').strip().lower()
    if voice_bank.stock_name(tool):
        return voice_bank.stock_problem(tool)
    head = CLONE_NAME.sub('', tool)
    platform = re.split(r'[.:/\s]', head, maxsplit=1)[0]
    if platform == CLONE_VOICE_PLATFORM and re.search(r'(?<![a-z])voice[ _-]?clone(?![a-z])', head) and CLONE_NAME.search(tool):
        return None
    return (f'{tool or "(no tool)"} is not his ElevenLabs voice clone; write it as '
            f'{CLONE_VOICE_PLATFORM}.{CLONE_VOICE_CAPABILITY}:<name in krish-clone\'s registry>, or an approved stock voice as '
            f'elevenlabs.stock_voice:<id in config/voice-bank.json> ({CLONE_VOICE_RULING})')


def clone_voice_lints(spec: dict) -> list[str]:
    """voice.clone_route: a spec carrying a clone voice is an off-day voiceover short of 9:16 cuts, each taking that
    voice, and the voice is ElevenLabs' voice clone. A hero cut can never carry it."""
    voices = clone_voices(spec)
    if not voices:
        return []
    out = clone_route_problems(spec)
    ids = {asset.get('id') for _, asset in voices}
    if len(voices) > 1:
        out.append(f'voice.clone_route assets: {len(voices)} clone voices; one per spec, the one every cut takes ({CLONE_VOICE_RULING})')
    for cut_id, cut in (spec.get('cuts') or {}).items():
        if cut.get('take') not in ids:
            out.append(f'voice.clone_route cuts.{cut_id}.take: {cut.get("take")} is not the clone voice; his take and his clone '
                       f'never share a clone-voiced spec ({CLONE_VOICE_RULING})')
    for index, asset in voices:
        problem = clone_tool_problem(asset)
        if problem:
            out.append(f'voice.clone_route assets.{index}.tool: {problem}')
    return out


def crew_lints(spec: dict, history: list[dict] | None = None) -> list[str]:
    from . import guards
    out: list[str] = (reference_lints(spec) + motion_lints(spec) + guards.spec_lints(spec) + palette_lints(spec)
                      + title_moment_lints(spec) + clone_voice_lints(spec) + synthetic_lints(spec))
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
        # style.sound places one sound on every handover and every device hit (docs/ve/INGREDIENTS.md), so it counts
        # here too: until Krish says in his words that ruling 11 changed, it cannot get round the one sound (audit ve-4).
        sounded = [e for b in beats for e in b['events'] if e.get('sfx')]
        styled = (spec.get('style') or {}).get('sound')
        styled = styled if isinstance(styled, dict) else {}
        placed = (max(len(beats) - 1, 0) if styled.get('handover') else 0) + \
            (sum(len(b['events']) for b in beats) if styled.get('hit') else 0)
        if len(sounded) + placed > 1 and (spec.get('publish_day') or '') >= SOUND_FROM:
            via = f' ({placed} placed by style.sound)' if placed else ''
            out.append(f'sound.one_moment {where}: {len(sounded) + placed} moves carry a sound{via}; one sound, on the big '
                       'moment only (THE_BAR ruling 11)')
        # dialogue
        short = short_cut()
        vertical_now = cut['aspect'] == '9:16' and (spec.get('publish_day') or '') >= short['from']
        if vertical_now and cut['max_s'] > short['most_s']:
            out.append(f'dialogue.short_max {where}.max_s: a 9:16 short published from {short["from"]} is {short["most_s"]} s or '
                       'less, one idea (house rule TWO_CUTS; Ruling, Krish, 2026-11-16)')
        elif cut['aspect'] == '9:16' and cut['max_s'] > 89:
            out.append(f'dialogue.short_max {where}.max_s: a 9:16 short is 89 s or less')
        # story
        first = beats[0]
        # A vertical wins its first two seconds (house rule FIRST_TWO_SECONDS): its first visual event lands by the
        # hook's second word, about 0.8 s at his pace, so the concrete thing and its words are on screen inside a second.
        reach = 1 if vertical_now else 4
        if not any(e['at_w'] <= first['span']['from_w'] + reach for e in first['events']):
            out.append(f'story.hook_event {where}.beats.0: the first visual event must land within the first {reach + 1} words of '
                       'the hook (' + ('by his second word, inside the first second, on a vertical: house rule FIRST_TWO_SECONDS'
                                       if vertical_now else 'about 1.5 s after his first word') +
                       '; the cut\'s first frame: nothing goes before the hook)')
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
