"""Compile a linted ProductionSpec to the renderer's single 30 fps clock.

assets_dir holds the cut-ready ``audio.<cut>.wav`` premix and recordings named
by cut.take (or the matching spec asset path). Brand source paths are resolved
under that directory too. Compilation describes assets; rendering checks them.
Word rows carry numeric w, onset_s and word (textual w is also accepted).
An optional end_s supplies the last word's end; otherwise its onset is used.
"""
from __future__ import annotations

import math
import json
import re
from pathlib import Path

from .common import ROOT, load_json

FPS = 30


def _frame(seconds: float) -> int:
    if not math.isfinite(seconds) or seconds < 0:
        raise ValueError('word times must be finite and nonnegative')
    return round(seconds * FPS)


def _caption_groups(rows: list[dict]) -> list[list[dict]]:
    """Prefer punctuation boundaries, keeping every page at 2-5 words.

    A single-word punctuation phrase must share a page with its neighbour.
    Never leave a one-word orphan at the end.
    """
    if len(rows) < 2:
        raise ValueError('captions need at least two words')
    groups = []
    start = 0
    while start < len(rows):
        remaining = len(rows) - start
        candidates = [n for n in range(2, min(5, remaining) + 1) if remaining - n != 1]
        punctuated = [n for n in candidates if re.search(r'[,.!?;:][\"\u2019\u201d\x27)]*$', rows[start + n - 1]['text'])]
        size = punctuated[0] if punctuated else candidates[-1]
        groups.append(rows[start:start + size])
        start += size
    return groups


def _params(params: dict, source) -> dict:
    """Copy device params, resolving media paths (src, rows[].logoSrc) against the assets folder."""
    out = json.loads(json.dumps(params))
    if isinstance(out.get('src'), str):
        out['src'] = source(out['src'])
    for row in out.get('rows', []) if isinstance(out.get('rows'), list) else []:
        if isinstance(row, dict) and isinstance(row.get('logoSrc'), str):
            row['logoSrc'] = source(row['logoSrc'])
    return out


def compile_cut(spec: dict, cut_id: str, words: list[dict], assets_dir: str | Path) -> dict:
    """Return EngineRenderProps without writing files or changing the spec."""
    cut = spec['cuts'][cut_id]
    # These words already describe the dialogue master's final clock. Do not
    # silently apply source edits a second time, or retime only the picture.
    edit = cut.get('edit', {})
    if edit.get('remove') or edit.get('speed', 1) != 1:
        raise ValueError('compile needs a cut-ready dialogue master; source edits must be conformed before compilation')
    assets_dir = Path(assets_dir).resolve()

    def source(path: str) -> str:
        if re.match(r'^https?://', path):
            return path
        return str((assets_dir / path).resolve())

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
        row = {'w': key, 'text': text, 'atFrame': frame, 'end_s': float(word.get('end_s', onset))}
        if row['end_s'] < onset:
            raise ValueError('word end precedes its onset')
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
    duration = _frame(rows[-1]['end_s']) + 12
    for index, beat in enumerate(selected):
        # The first beat owns the opening frames (pre-roll included), so a cut never opens on bare ink.
        start = 0 if index == 0 else at(beat['span']['from_w'])
        at(beat['span']['to_w'])
        end = at(selected[index + 1]['span']['from_w']) if index + 1 < len(selected) else duration
        if end <= start:
            raise ValueError(f'beat {beat["id"]} has no positive frame interval')
        beats.append({'id': beat['id'], 'role': beat['role'], 'layout': beat['layout'],
                      'fromFrame': start, 'toFrame': end, 'uses': list(beat.get('uses', [])),
                      'transitionOut': beat.get('transition_out', 'cut'), 'sectionBeat': index == 0})
        for event_index, event in enumerate(beat.get('events', [])):
            event_frame = at(event['at_w'])
            if not start <= event_frame < end:
                raise ValueError(f'event outside beat {beat["id"]}')
            compiled = {'id': f'{beat["id"]}-{event_index}', 'obj': event['obj'], 'verb': event['verb'],
                        'toState': event['to_state'], 'atFrame': event_frame}
            if event.get('sfx'):
                compiled['sfx'] = event['sfx']
            events.append(compiled)
    by_beat = {beat['id']: beat for beat in beats}
    datasets = {dataset['id']: dataset for dataset in spec.get('datasets', [])}
    objects = []
    for obj in spec.get('objects', []):
        persist = obj['persist']
        if persist['from_beat'] not in by_beat or persist['to_beat'] not in by_beat:
            raise ValueError(f'object {obj["obj"]} references a persist beat missing from cut {cut_id}')
        compiled = {key: obj[key] for key in ('obj', 'device', 'meaning')}
        compiled.update(fromFrame=by_beat[persist['from_beat']]['fromFrame'],
                        toFrame=by_beat[persist['to_beat']]['toFrame'],
                        variants=dict(spec['signature'].get('variants', {}).get(obj['device'], {})), params=_params(obj.get('params', {}), source))
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
    groups = _caption_groups(rows)
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
    take = source(assets[cut['take']]['path'] if cut['take'] in assets else cut['take'])
    props = {
        'pieceId': spec['piece_id'], 'cutId': cut_id, 'format': spec['format'], 'aspect': cut['aspect'],
        'fps': FPS, 'durationFrames': duration,
        'tokens': {'ink': tokens['ink'], 'inkDeep': tokens['ink_deep'], 'inkSoft': tokens['ink_soft'],
                   'cream': tokens['cream'], 'mint': tokens['mint'], 'channel': publication['channel_colors'][channel]},
        'series': {'label': spec['brand']['series'], 'day': identity['day'], 'promise': identity['promise'], 'site': house['copy']['site']},
        'brand': {key: {'src': source(publication[key]['source_path']), 'pixelWidth': publication[key]['pixel_width'],
                        'pixelHeight': publication[key]['pixel_height']} for key in ('mark', 'logo', 'stacked')},
        'segments': [] if spec['audio']['master'] == 'vo' else [
            {'src': take, 'trimBeforeFrames': 0, 'fromFrame': 0, 'durationFrames': duration}],
        'audio': {'stem': {'src': source(f'audio.{cut_id}.wav'), 'trimBeforeFrames': 0}, 'sfx': []},
        'captions': captions, 'beats': beats, 'objects': objects, 'events': events, 'illustrationLabels': [],
    }
    if spec.get('call'):
        call = spec['call']
        props['call'] = {'statement': call['statement'], 'due': call['due'], 'confidencePercent': call['confidence_percent']}
    return props
