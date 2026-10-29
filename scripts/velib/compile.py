"""Compile a linted ProductionSpec to the renderer's single 30 fps clock.

assets_dir holds the cut-ready ``audio.<cut>.wav`` premix and recordings named
by cut.take (or the matching spec asset path). Brand source paths are resolved
under that directory too. Compilation describes assets; rendering checks them.
Word rows carry numeric w, onset_s and word (textual w is also accepted).
Every word needs a finite end_s at or after its onset.
"""
from __future__ import annotations

import math
import json
import re
from pathlib import Path, PureWindowsPath

from .common import ROOT, load_json
from .lint import pending_devices_error

FPS = 30
ENDING_FRAMES = 105


def source(path: str, assets_dir: str | Path) -> str:
    """Resolve only relative media paths contained by the assets folder."""
    root = Path(assets_dir).resolve()
    if (re.match(r'^https?://', path, re.I) or Path(path).is_absolute()
            or PureWindowsPath(path).drive or PureWindowsPath(path).root):
        raise ValueError(f'asset source must be relative and contained: {path}')
    resolved = (root / path.replace('\\', '/')).resolve()
    if not resolved.is_relative_to(root):
        raise ValueError(f'asset source escapes assets folder: {path}')
    return str(resolved)


def _frame(seconds: float) -> int:
    if not math.isfinite(seconds) or seconds < 0:
        raise ValueError('word times must be finite and nonnegative')
    return round(seconds * FPS)


# Mirror apps/renderer/src/engine/chrome/CaptionTrack.tsx captionLines.
# Exact advances/fallback from house/metrics.ts; sizes and insets from
# house/geometry.ts and engine/geometry.ts, including 0.1 em swipe padding.
_CAPTION_CHARACTERS = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\u2018\u2019\u201c\u201d\u2013\u2026\xa3\u20ac\xb7\xd7'
_CAPTION_ADVANCES = [233, 361, 545, 714, 676, 1080, 973, 300, 389, 389, 419, 703, 356, 373, 356, 307, 736, 698, 735, 737, 740, 737, 738, 709, 744, 738, 351, 356, 703, 703, 703, 674, 1120, 862, 851, 855, 852, 788, 734, 919, 917, 381, 714, 907, 724, 1071, 917, 917, 791, 917, 857, 799, 796, 908, 855, 1110, 866, 868, 796, 389, 307, 389, 703, 615, 325, 735, 728, 735, 728, 736, 455, 729, 725, 331, 328, 718, 331, 1096, 725, 736, 728, 728, 478, 676, 492, 725, 678, 1051, 746, 678, 618, 389, 287, 389, 703, 300, 300, 556, 556, 560, 1068, 730, 740, 374, 703]
_CAPTION_WIDTHS = dict(zip(_CAPTION_CHARACTERS, _CAPTION_ADVANCES))


def _text_width(text: str, size: int) -> float:
    return sum(_CAPTION_WIDTHS.get(char, 600) - 15 for char in text) * size / 1000


def caption_line_count(rows: list[dict], aspect: str = '9:16', emphasis=()) -> int:
    size, available = (54, 1400 - 42 * 2) if aspect == '16:9' else (68, 1080 - 72 - 108 - 42 * 2)
    space = _text_width(' ', size)
    width, lines = 0, 1
    for row in rows:
        word_width = _text_width(row['text'], size) + (0.1 * 2 * size if row['w'] in emphasis else 0)
        if word_width > available:
            raise ValueError(f"caption word exceeds one line: {row['text']}")
        if width and width + space + word_width > available:
            lines += 1
            width = 0
        width += (space if width else 0) + word_width
    return lines


def _caption_groups(rows: list[dict], aspect: str = '9:16', emphasis=()) -> list[list[dict]]:
    """Fit 2-5 words per page, preferring punctuation without stranding orphans."""
    size, available = (54, 1316) if aspect == '16:9' else (68, 816)
    for row in rows:
        caption_line_count([row], aspect, emphasis)
    # Suffix feasibility prevents greedy punctuation choices leaving an orphan.
    choices = {len(rows): 0}
    for start in range(len(rows) - 1, -1, -1):
        candidates = [n for n in range(2, min(5, len(rows) - start) + 1)
                      if start + n in choices
                      and sum(r['w'] in emphasis for r in rows[start:start + n]) <= 1
                      and caption_line_count(rows[start:start + n], aspect, emphasis) <= 2]
        punctuated = [n for n in candidates if re.search(r'[,.!?;:]["\x27)\u2019\u201d]*$', rows[start + n - 1]['text'])]
        if candidates:
            choices[start] = punctuated[0] if punctuated else candidates[-1]
        elif start + 1 in choices:
            row = rows[start]
            width = _text_width(row['text'], size) + (0.2 * size if row['w'] in emphasis else 0)
            if width >= available - _text_width(' ', size):
                choices[start] = 1
    if not rows or 0 not in choices:
        raise ValueError('captions cannot fit 2-5 words per page without a one-word orphan')
    groups, start = [], 0
    while start < len(rows):
        size = choices[start]
        groups.append(rows[start:start + size])
        start += size
    return groups


def _params(params: dict, source) -> dict:
    """Copy device params, resolving media paths (src, rows[].logoSrc) against the assets folder."""
    def visit(value):
        if isinstance(value, list):
            return [visit(item) for item in value]
        if isinstance(value, dict):
            return {key: source(item) if key in ('src', 'logoSrc') and isinstance(item, str)
                    else visit(item) for key, item in value.items()}
        return value
    return visit(params)


def compile_cut(spec: dict, cut_id: str, words: list[dict], assets_dir: str | Path, *, report: dict | None = None) -> dict:
    """Return EngineRenderProps without writing files or changing the spec."""
    pending_error = pending_devices_error(spec['format'])
    if pending_error:
        raise ValueError(pending_error)
    cut = spec['cuts'][cut_id]
    # These words already describe the dialogue master's final clock. Do not
    # silently apply source edits a second time, or retime only the picture.
    edit = cut.get('edit', {})
    if edit.get('remove') or edit.get('speed', 1) != 1:
        raise ValueError('compile needs a cut-ready dialogue master; source edits must be conformed before compilation')
    assets_dir = Path(assets_dir).resolve()

    def resolve_source(path: str) -> str:
        return source(path, assets_dir)

    rows = []
    by_word = {}
    previous = -1
    for index, word in enumerate(words):
        key = word['w'] if isinstance(word['w'], int) and not isinstance(word['w'], bool) else index
        text = word.get('word', word.get('text', word['w'] if isinstance(word['w'], str) else ''))
        onset = float(word['onset_s'])
        frame = _frame(onset)
        if key in by_word or key < 0 or onset < previous or not isinstance(text, str) or not text.strip():
            raise ValueError('words need unique nonnegative indexes, ordered onsets and caption text')
        end_s = word.get('end_s')
        if (isinstance(end_s, bool) or not isinstance(end_s, (int, float))
                or not math.isfinite(end_s) or end_s < onset):
            raise ValueError(f'words need end_s finite and at least onset_s: word {key}')
        row = {'w': key, 'text': text, 'atFrame': frame, 'end_s': float(end_s)}
        rows.append(row)
        by_word[key] = row
        previous = onset
    if not rows:
        raise ValueError('words cannot be empty')

    def at(index: int) -> int:
        if index not in by_word:
            raise ValueError(f'no timing for word {index}')
        return by_word[index]['atFrame']

    beats = []
    events = []
    selected = cut['beats']
    device_verbs = load_json(ROOT / 'config' / 've' / 'devices.json')['devices']
    by_object = {obj['obj']: obj for obj in spec.get('objects', [])}
    duration = _frame(rows[-1]['end_s']) + 12
    for index, beat in enumerate(selected):
        plate_root = ROOT / 'assets' / 'plates' / spec['format']
        has_phone = any(by_object.get(name, {}).get('device') == 'hand_phone_stage'
                        for name in beat.get('uses', []))
        plate_source = beat.get('plate', {}).get('source', 'take')
        sidecar = plate_root / 'plates.json'
        plate_backed = has_phone and sidecar.is_file()
        if plate_source not in ('take', 'none'):
            asset = next((a for a in spec.get('assets', [])
                          if 'asset:' + a['id'] == plate_source), {})
            manifest = load_json(sidecar) if plate_backed else {}
            allowed_paths = {'plates/' + spec['format'] + '/' + name
                             for name in manifest.get('files', {})}
            if asset.get('path') not in allowed_paths:
                raise ValueError(f'beat {beat["id"]}: asset plates arrive in Phase 2')
        if has_phone and spec['format'] == 'hand-held-screen' and not plate_backed:
            raise ValueError(f'beat {beat["id"]}: missing plate sidecar {sidecar}')
        # The first beat owns the opening frames (pre-roll included), so a cut never opens on bare ink.
        start = 0 if index == 0 else at(beat['span']['from_w'])
        at(beat['span']['to_w'])
        end = at(selected[index + 1]['span']['from_w']) if index + 1 < len(selected) else duration
        if end <= start:
            raise ValueError(f'beat {beat["id"]} has no positive frame interval')
        beats.append({'id': beat['id'], 'role': beat['role'], 'layout': beat['layout'],
                      'fromFrame': start, 'toFrame': end, 'uses': list(beat.get('uses', [])),
                      'transitionOut': beat.get('transition_out', 'cut'), 'sectionBeat': index == 0})
        # The v2 spec reserves extensible metadata in style; beat-level keyFrame
        # is not yet in its strict schema. Always emit an explicit engine frame.
        fraction = spec.get('style', {}).get('keyFrames', {}).get(beat['id'], 0.8)
        if isinstance(fraction, bool) or not isinstance(fraction, (int, float)) or not 0 <= fraction < 1:
            raise ValueError(f'beat {beat["id"]}: keyFrames fraction must be in [0, 1)')
        beats[-1]['keyFrame'] = min(end - 1, start + round((end - start) * fraction))
        for event_index, event in enumerate(beat.get('events', [])):
            event_frame = at(event['at_w'])
            if not start <= event_frame < end:
                raise ValueError(f'event outside beat {beat["id"]}')
            compiled = {'id': f'{beat["id"]}-{event_index}', 'obj': event['obj'], 'verb': event['verb'],
                        'toState': event['to_state'], 'atFrame': event_frame}
            obj = by_object.get(event['obj'])
            if obj is None:
                raise ValueError(f'event {compiled["id"]}: object {event["obj"]} is missing')
            device = obj['device']
            if device not in device_verbs:
                raise ValueError(f'event {compiled["id"]}: object {event["obj"]}, device {device}, '
                                 f'verb {event["verb"]}: device missing from devices.json')
            if event['verb'] not in device_verbs[device]['verbs']:
                raise ValueError(f'event {compiled["id"]}: object {event["obj"]}, device {device} '
                                 f'does not draw verb {event["verb"]}')
            if event.get('sfx'):
                compiled['sfx'] = event['sfx']
            events.append(compiled)
    by_beat = {beat['id']: beat for beat in beats}
    datasets = {dataset['id']: dataset for dataset in spec.get('datasets', [])}
    objects = []
    used = {name for beat in selected for name in beat.get('uses', [])}
    generated = {ref for asset in spec.get('assets', []) if asset.get('origin') == 'generated'
                 for ref in (asset['id'], 'asset:' + asset['id'], asset['path'])}

    def check_generated(node):
        if isinstance(node, dict):
            for value in node.values():
                check_generated(value)
        elif isinstance(node, list):
            for value in node:
                check_generated(value)
        elif isinstance(node, str) and node.replace('\\', '/').removeprefix('./') in generated:
            raise ValueError(f'generated asset {node}: the generated assets pipeline arrives in Phase 2')

    for obj in spec.get('objects', []):
        if obj['obj'] not in used:
            continue
        check_generated(obj.get('params', {}))
        persist = obj['persist']
        if persist['from_beat'] not in by_beat or persist['to_beat'] not in by_beat:
            raise ValueError(f'object {obj["obj"]} references a persist beat missing from cut {cut_id}')
        compiled = {key: obj[key] for key in ('obj', 'device', 'meaning')}
        compiled.update(fromFrame=by_beat[persist['from_beat']]['fromFrame'],
                        toFrame=by_beat[persist['to_beat']]['toFrame'],
                        variants=dict(spec['signature'].get('variants', {}).get(obj['device'], {})), params=_params(obj.get('params', {}), resolve_source))
        if compiled['toFrame'] <= compiled['fromFrame']:
            raise ValueError(f'object {obj["obj"]} has reversed persistence')
        if obj.get('dataset'):
            dataset = datasets[obj['dataset']]
            compiled['dataset'] = {'unit': dataset['unit'], 'denominator': dataset['denominator'],
                                   'producerLabel': dataset['producer_label'], 'rows': dataset['rows']}
        objects.append(compiled)

    theme = next(t for t in load_json(ROOT / 'config' / 'studio.json')['brand_themes'] if t['theme_id'] == spec['theme'])
    publication = theme['publication']
    house = publication['house_style']
    tokens = house['tokens']
    channel = spec['brand']['series'].replace('.', '_')
    identity = house['channels'][channel]
    emphasis = set(cut['captions'].get('emphasis', []))
    groups = _caption_groups(rows, cut['aspect'], emphasis)
    captions = []
    for index, group in enumerate(groups):
        hits = [i for i, word in enumerate(group) if word['w'] in emphasis]
        if len(hits) > 1:
            raise ValueError('a caption page can swipe only one emphasized word')
        captions.append({'fromFrame': group[0]['atFrame'],
                         'toFrame': groups[index + 1][0]['atFrame'] if index + 1 < len(groups) else duration,
                         'words': [{'text': word['text'], 'atFrame': word['atFrame']} for word in group],
                         'swipeIndex': hits[0] if hits else None})
    assets = {asset['id']: asset for asset in spec.get('assets', [])}
    take = resolve_source(assets[cut['take']]['path'] if cut['take'] in assets else cut['take'])
    props = {
        'pieceId': spec['piece_id'], 'cutId': cut_id, 'format': spec['format'], 'aspect': cut['aspect'],
        'fps': FPS, 'durationFrames': duration,
        'tokens': {'ink': tokens['ink'], 'inkDeep': tokens['ink_deep'], 'inkSoft': tokens['ink_soft'],
                   'cream': tokens['cream'], 'mint': tokens['mint'], 'channel': publication['channel_colors'][channel]},
        'series': {'label': spec['brand']['series'], 'day': identity['day'], 'promise': identity['promise'], 'site': house['copy']['site']},
        'brand': {key: {'src': resolve_source(publication[key]['source_path']), 'pixelWidth': publication[key]['pixel_width'],
                        'pixelHeight': publication[key]['pixel_height']} for key in ('mark', 'logo', 'stacked')},
        'segments': [] if spec['audio']['master'] == 'vo' else [
            {'src': take, 'trimBeforeFrames': 0, 'fromFrame': 0, 'durationFrames': duration}],
        'audio': {'stem': {'src': resolve_source(f'audio.{cut_id}.wav'), 'trimBeforeFrames': 0}, 'sfx': []},
        'captions': captions, 'beats': beats, 'objects': objects, 'events': events,
    }
    sfx, missing = [], []
    kit_path = ROOT / 'config' / 've' / 'sfx-kits' / f"{spec['audio']['sfx_kit']}.json"
    kit = load_json(kit_path) if kit_path.is_file() else {}
    for event in events:
        if not event.get('sfx'):
            continue
        sound = kit.get(event['sfx'])
        if sound is None:
            missing.append(event['id'])
            continue
        gain = sound['gain_db']
        if isinstance(gain, bool) or not isinstance(gain, (int, float)) or not math.isfinite(gain) or gain > 0:
            raise ValueError(f'invalid sfx gain for {event["id"]}')
        sfx.append({'src': resolve_source(sound['path']), 'atFrame': event['atFrame'], 'gainDb': gain})
    props['audio']['sfx'] = sfx
    if report is not None:
        report.update(lint='clean', sfx_missing=missing)
    if spec.get('call') and not cut.get('excerpt', False):
        props['ending'] = {'fromFrame': duration, 'url': props['series']['site']}
        props['durationFrames'] += ENDING_FRAMES
    if spec.get('call'):
        call = spec['call']
        props['call'] = {'statement': call['statement'], 'due': call['due'], 'confidencePercent': call['confidence_percent']}
    return props
