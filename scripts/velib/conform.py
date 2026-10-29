"""ve conform: the deterministic dialogue editor (F09).

From the signed script, the cut's approved edit (removed word ranges, one speed factor with Krish's words) and the
ingested takes (each with two aligners' word clocks), conform:

  1. splits the kept script into lines (at . ? ! and at removed ranges);
  2. finds every reading of each line in every take, on aligner A's words, skipping a flub (a restart, a repeat, a
     filler) with a cut only where both aligners agree there is a gap (velib.gaps), or keeping an unscripted word
     through when no such gap exists, which is reported for Krish's ear;
  3. chooses one reading per line over the whole cut, so consecutive lines from one take play through with no join,
     preferring in order: fewer unscripted words kept, fewer joins, more words both aligners heard, the later take,
     the later reading;
  4. places every join in an agreed gap with clearance, crossfades it over 20 to 40 ms, and applies the single
     approved speed factor to picture and sound in one ffmpeg graph, so the two can never drift (F10);
  5. writes edl.<cut>.json and words.<cut>.json: the clock compile, the captions, QC's joins decoder and the joins
     reel all read.

lint_edl re-derives every gap from the take records and refuses an EDL that breaks the rule, whoever wrote it.
"""
from __future__ import annotations

import math
import re
import subprocess
from pathlib import Path

from . import gaps as rule
from .common import ffmpeg, load_json, sha256_file, write_json
from .takes import check_media, list_takes, load_take

SCHEMA = 've-edl/1'
FPS = 30
PAD_S = 0.12            # room kept before a line's first word and after its last, inside the gap
TAIL_S = 0.5            # after the cut's last word: compile holds the picture 12 frames past it
CROSSFADE_S = 0.030
MAX_KEEP_THROUGH = 3    # unscripted words a reading may keep inside it when no agreed gap lets them go
READINGS_PER_TAKE = 8
CONFIRM_S = 0.15        # aligner B confirms a word it heard with the same text, starting within this of A's onset
LINE_END = re.compile(r'[.?!]["”\')\]]*$')


def token(text: str) -> str:
    return re.sub(r"[^0-9a-z]+", '', text.lower().replace('’', "'"))


def script_words(raw) -> list[dict]:
    words = raw.get('words') if isinstance(raw, dict) else raw
    out = []
    for index, item in enumerate(words or []):
        text = item.get('word', item.get('text'))
        w = item.get('w', index)
        if not isinstance(text, str) or not token(text) or type(w) is not int or w != index:
            raise ValueError('script words need consecutive indexes w from 0 and words with letters or digits')
        out.append({'w': w, 'word': text})
    if not out:
        raise ValueError('the script has no words')
    return out


def lines_of(script: list[dict], removed: set[int]) -> list[list[dict]]:
    lines, current = [], []
    for word in script:
        if word['w'] in removed:
            if current:
                lines.append(current)
                current = []
            continue
        current.append(word)
        if LINE_END.search(word['word']):
            lines.append(current)
            current = []
    if current:
        lines.append(current)
    return lines


class TakeClock:
    """One take's two clocks, the agreed gaps between them, and where each A word may be cut before or after."""

    def __init__(self, record: dict, rank: int):
        self.record, self.id, self.rank = record, record['take'], rank
        self.a = record['aligners']['a']['words']
        self.b = record['aligners']['b']['words']
        self.duration = record['media']['duration_s']
        self.tokens = [token(w['text']) for w in self.a]
        self.gaps = rule.agreed_gaps(self.a, self.b, start_s=0.0, end_s=self.duration)
        self.spans = rule.speech(self.a, self.b)
        self.positions: dict[str, list[int]] = {}
        for index, tok in enumerate(self.tokens):
            self.positions.setdefault(tok, []).append(index)
        self.confirmed = [self._confirmed(w) for w in self.a]

    def _confirmed(self, word) -> bool:
        tok = token(word['text'])
        return any(token(b['text']) == tok and abs(b['onset_s'] - word['onset_s']) <= CONFIRM_S for b in self.b)

    def _span(self, j):
        word = self.a[j]
        return next(s for s in self.spans if s[0] - 1e-9 <= word['onset_s'] and word['end_s'] <= s[1] + 1e-9)

    def gap_after(self, j):
        """The agreed gap straight after A word j, when no other speech (either aligner) comes first."""
        span = self._span(j)
        if j + 1 < len(self.a) and self.a[j + 1]['onset_s'] < span[1] - 1e-9:
            return None
        return next((g for g in self.gaps if abs(g[0] - span[1]) < 1e-6), None)

    def gap_before(self, j):
        span = self._span(j)
        if j > 0 and self.a[j - 1]['end_s'] > span[0] + 1e-9:
            return None
        return next((g for g in self.gaps if abs(g[1] - span[0]) < 1e-6), None)

    def out_point(self, j, pad_s=PAD_S):
        gap = self.gap_after(j)
        if gap is None:
            return None
        room = gap[1] - gap[0]
        pad = max(rule.CLEARANCE_S, min(pad_s, room - rule.CLEARANCE_S if pad_s > PAD_S else room / 2))
        return round(gap[0] + pad, 4) if room - pad + 1e-9 >= rule.CLEARANCE_S else None

    def in_point(self, j):
        gap = self.gap_before(j)
        if gap is None:
            return None
        room = gap[1] - gap[0]
        pad = max(rule.CLEARANCE_S, min(PAD_S, room / 2))
        return round(gap[1] - pad, 4) if room - pad + 1e-9 >= rule.CLEARANCE_S else None


def _readings(clock: TakeClock, line: list[dict]) -> list[dict]:
    """Every way this take reads the line, best first. A reading is pieces of consecutive A words."""
    want = [token(w['word']) for w in line]
    # layers[i][j][start]: the best way to read line words 0..i ending on A word j, for each first A word.
    layers = []
    for i, tok in enumerate(want):
        layer = {}
        for j in clock.positions.get(tok, []):
            if i == 0:
                layer[j] = {j: ((0, 0), [j], [])}
                continue
            options = {}
            for k, starts in layers[i - 1].items():
                if k >= j:
                    continue
                between = j - k - 1
                for start, ((extras, cuts), path, kept) in starts.items():
                    if between == 0:
                        option = ((extras, cuts), path + [j], kept)
                    elif clock.a[j]['onset_s'] - clock.a[k]['end_s'] > 15:
                        continue
                    elif clock.out_point(k) is not None and clock.in_point(j) is not None:
                        option = ((extras, cuts + 1), path + [j], kept)
                    elif between <= MAX_KEEP_THROUGH:
                        option = ((extras + between, cuts), path + [j], kept + list(range(k + 1, j)))
                    else:
                        continue
                    if start not in options or option[0] < options[start][0]:
                        options[start] = option
            if options:
                layer[j] = options
        layers.append(layer)
        if not layer:
            return []
    out = []
    for starts in layers[-1].values():
        for (extras, cuts), path, kept in starts.values():
            pieces, start = [], path[0]
            for a, b in zip(path, path[1:]):
                if b != a + 1 and not all(x in kept for x in range(a + 1, b)):
                    pieces.append((start, a))
                    start = b
            pieces.append((start, path[-1]))
            unconfirmed = sum(not clock.confirmed[x] for x in path)
            out.append({'take': clock.id, 'rank': clock.rank, 'pieces': pieces, 'words': path, 'kept': kept,
                        'extras': extras, 'cuts': cuts, 'unconfirmed': unconfirmed})
    out.sort(key=lambda r: (r['extras'], r['cuts'], r['unconfirmed'], -r['rank'], -r['words'][0]))
    return out[:READINGS_PER_TAKE]


def _cost(reading):
    return (reading['extras'], reading['cuts'], reading['unconfirmed'], -reading['rank'], -reading['words'][0])


def _plus(a, b):
    return tuple(x + y for x, y in zip(a, b))


def choose(clocks: dict[str, TakeClock], lines: list[list[dict]]) -> list[dict]:
    """One reading per line, chosen over the whole cut. Refuses a line no take read, or a sequence with no clean join."""
    candidates = []
    for number, line in enumerate(lines, 1):
        found = [r for clock in clocks.values() for r in _readings(clock, line)]
        if not found:
            text = ' '.join(w['word'] for w in line)
            raise ValueError(f'line {number} was never read in full by any take: "{text}"')
        candidates.append(found)
    # Dynamic programme over lines: cost is (joins between lines + the readings' own costs), lexicographic.
    best = [{i: (_cost(r), None) for i, r in enumerate(candidates[0])
             if clocks[r['take']].in_point(r['pieces'][0][0]) is not None}]
    if not best[0]:
        raise ValueError('line 1 has no reading that starts in an agreed gap')
    for n in range(1, len(candidates)):
        layer = {}
        for i, reading in enumerate(candidates[n]):
            for p, (cost, _back) in best[n - 1].items():
                previous = candidates[n - 1][p]
                last, first = previous['pieces'][-1][1], reading['pieces'][0][0]
                through = previous['take'] == reading['take'] and first == last + 1
                if not through:
                    if clocks[previous['take']].out_point(last) is None or clocks[reading['take']].in_point(first) is None:
                        continue
                total = _plus(_plus(cost, _cost(reading)), (0, 0 if through else 1, 0, 0, 0))
                if i not in layer or total < layer[i][0]:
                    layer[i] = (total, p)
        if not layer:
            text = ' '.join(w['word'] for w in lines[n])
            raise ValueError(f'line {n + 1} cannot be joined to line {n} in a gap both aligners agree on: "{text}"')
        best.append(layer)
    ends = {i: v for i, v in best[-1].items()
            if clocks[candidates[-1][i]['take']].out_point(candidates[-1][i]['pieces'][-1][1]) is not None}
    if not ends:
        raise ValueError('the last line has no reading that ends in an agreed gap')
    index = min(ends, key=lambda i: ends[i][0])
    chosen = []
    for n in range(len(candidates) - 1, -1, -1):
        chosen.append(candidates[n][index])
        index = best[n][index][1]
    return chosen[::-1]


def conform(spec: dict, cut_id: str, script: list[dict], ve_dir: Path, *, takes: list[str] | None = None,
            crossfade_s: float = CROSSFADE_S, script_sha256: str | None = None) -> dict:
    """Return the EDL for one cut. Pure: reads the take records, writes nothing."""
    cut = spec['cuts'][cut_id]
    edit = cut.get('edit', {})
    speed = edit.get('speed', 1)
    if isinstance(speed, bool) or not isinstance(speed, (int, float)) or not 1 <= speed <= 1.35:
        raise ValueError('the speed factor must be between 1 and 1.35')
    if speed != 1 and not edit.get('speed_said'):
        raise ValueError("a speed change needs Krish's words in edit.speed_said")
    problem = rule.crossfade_problem(crossfade_s)
    if problem:
        raise ValueError(problem)
    names = takes or list_takes(ve_dir)
    if not names:
        raise ValueError('no takes ingested for this piece: run ve ingest first')
    records = [load_take(ve_dir, name) for name in names]
    clocks = {r['take']: TakeClock(r, rank) for rank, r in enumerate(records)}
    removed = {w for r in edit.get('remove', []) for w in range(r['from_w'], r['to_w'] + 1)}
    lines = lines_of(script, removed)
    chosen = choose(clocks, lines)

    # Pieces in play order, merged where one take plays straight through.
    pieces = []
    for reading in chosen:
        for start, end in reading['pieces']:
            if pieces and pieces[-1]['take'] == reading['take'] and start == pieces[-1]['last'] + 1:
                pieces[-1]['last'] = end
            else:
                pieces.append({'take': reading['take'], 'first': start, 'last': end})
    by_line_word = {}
    for line, reading in zip(lines, chosen):
        for word, j in zip(line, reading['words']):
            by_line_word[word['w']] = (reading['take'], j)

    segments, cursor = [], 0.0
    for number, piece in enumerate(pieces):
        clock = clocks[piece['take']]
        src_in = clock.in_point(piece['first'])
        src_out = clock.out_point(piece['last'], TAIL_S if number == len(pieces) - 1 else PAD_S)
        if src_in is None or src_out is None:
            raise ValueError(f'take {piece["take"]}: a piece cannot be cut in an agreed gap')
        length = (src_out - src_in) / speed
        segments.append({'take': piece['take'], 'src_in_s': src_in, 'src_out_s': src_out,
                         'out_in_s': round(cursor, 4), 'out_out_s': round(cursor + length, 4),
                         'first_word': piece['first'], 'last_word': piece['last']})
        cursor += length
    frames, previous = 0, 0
    for segment in segments:
        end_frame = round(segment['out_out_s'] * FPS)
        segment['frames'] = end_frame - previous
        previous = end_frame
        frames += segment['frames']

    joins = []
    for k in range(1, len(segments)):
        joins.append({'at_s': segments[k]['out_in_s'], 'at_frame': round(segments[k]['out_in_s'] * FPS),
                      'crossfade_ms': round(crossfade_s * 1000, 1),
                      'from': {'take': segments[k - 1]['take'], 'src_s': segments[k - 1]['src_out_s']},
                      'to': {'take': segments[k]['take'], 'src_s': segments[k]['src_in_s']}})

    words = []
    for word in script:
        if word['w'] in removed:
            continue
        take, j = by_line_word[word['w']]
        segment = next(s for s in segments if s['take'] == take and s['first_word'] <= j <= s['last_word'])
        a = clocks[take].a[j]

        def out(t, s=segment):
            return round(s['out_in_s'] + (t - s['src_in_s']) / speed, 4)
        row = {'w': word['w'], 'word': word['word'], 'onset_s': out(a['onset_s']), 'end_s': out(a['end_s']), 'take': take}
        match = next((b for b in clocks[take].b if token(b['text']) == token(a['text'])
                      and abs(b['onset_s'] - a['onset_s']) <= CONFIRM_S), None)
        if match:
            row.update(b_onset_s=out(match['onset_s']), b_end_s=out(match['end_s']))
        words.append(row)

    flubs, kept = [], []
    for previous, segment in zip(segments, segments[1:]):
        if previous['take'] == segment['take'] and segment['first_word'] > previous['last_word'] + 1:
            clock = clocks[segment['take']]
            skipped = clock.a[previous['last_word'] + 1:segment['first_word']]
            flubs.append({'take': segment['take'], 'words': ' '.join(w['text'] for w in skipped),
                          'from_s': skipped[0]['onset_s'], 'to_s': skipped[-1]['end_s']})
    for number, reading in enumerate(chosen, 1):
        clock = clocks[reading['take']]
        for j in reading['kept']:
            kept.append({'line': number, 'take': reading['take'], 'word': clock.a[j]['text'], 'src_s': clock.a[j]['onset_s']})

    return {
        'schema': SCHEMA, 'piece': spec['piece_id'], 'cut': cut_id, 'aspect': cut['aspect'], 'fps': FPS,
        'edit': {'remove': edit.get('remove', []), 'speed': speed, **({'speed_said': edit['speed_said']} if edit.get('speed_said') else {})},
        'speed': speed, 'crossfade_ms': round(crossfade_s * 1000, 1),
        'rule': {'min_gap_ms': rule.MIN_GAP_S * 1000, 'clearance_ms': rule.CLEARANCE_S * 1000,
                 'crossfade_ms': [rule.CROSSFADE_MIN_S * 1000, rule.CROSSFADE_MAX_S * 1000], 'aligners': 'both'},
        'script_sha256': script_sha256,
        'takes': {name: {'media': clocks[name].record['media'],
                         'aligners': [clocks[name].record['aligners'][k]['name'] for k in ('a', 'b')]} for name in names},
        'lines': [{'line': n, 'text': ' '.join(w['word'] for w in line), 'take': r['take'],
                   'from_w': line[0]['w'], 'to_w': line[-1]['w'], 'unconfirmed_words': r['unconfirmed']}
                  for n, (line, r) in enumerate(zip(lines, chosen), 1)],
        'segments': segments, 'joins': joins, 'words': words, 'flubs_removed': flubs, 'unscripted_kept': kept,
        'duration_s': round(cursor, 4), 'duration_frames': frames,
        'conformed': {'picture': f'conformed.{cut_id}.mp4', 'dialogue': f'dialogue.{cut_id}.wav'},
    }


def lint_edl(edl: dict, records: dict[str, dict], spec: dict | None = None) -> list[str]:
    """The F09 lint: every finding blocks. Gaps are re-derived from the take records, never read from the EDL."""
    out = []
    if edl.get('schema') != SCHEMA:
        return [f'edl schema must be {SCHEMA}']
    speed = edl.get('speed')
    if isinstance(speed, bool) or not isinstance(speed, (int, float)) or not 1 <= speed <= 1.35:
        out.append('dialogue.speed: one factor between 1 and 1.35')
        speed = 1
    if speed != 1 and not edl.get('edit', {}).get('speed_said'):
        out.append("dialogue.speed: a speed change needs Krish's words")
    if edl.get('edit', {}).get('speed') != speed:
        out.append('dialogue.speed: picture and sound take the one approved factor')
    if spec is not None:
        cut = spec['cuts'].get(edl.get('cut'), {})
        edit = cut.get('edit', {})
        if edl.get('piece') != spec.get('piece_id') or not cut:
            out.append('edl is for a different piece or cut')
        elif (edit.get('remove', []) != edl['edit'].get('remove') or edit.get('speed', 1) != edl['edit'].get('speed')
              or edit.get('speed_said') != edl['edit'].get('speed_said')):
            out.append("edl edit differs from the spec's approved edit: conform again")
    problem = rule.crossfade_problem((edl.get('crossfade_ms') or 0) / 1000)
    if problem:
        out.append(f'dialogue.crossfade: {problem}')
    segments = edl.get('segments') or []
    if not segments:
        return out + ['edl has no segments']
    cursor = 0.0
    clocks = {}
    for index, segment in enumerate(segments):
        record = records.get(segment['take'])
        if record is None:
            out.append(f'segment {index}: take {segment["take"]} is not ingested')
            continue
        if record['media']['sha256'] != edl['takes'].get(segment['take'], {}).get('media', {}).get('sha256'):
            out.append(f'segment {index}: take {segment["take"]} changed since conform')
        clock = clocks.setdefault(segment['take'], TakeClock(record, 0))
        for label in ('src_in_s', 'src_out_s'):
            problem = rule.join_problem(segment[label], clock.gaps)
            if problem:
                out.append(f'dialogue.join segment {index} {label}: {problem}')
        half = (edl.get('crossfade_ms') or 0) / 2000 * speed
        if index > 0 and segment['src_in_s'] - half < -1e-9:
            out.append(f'segment {index}: crossfade starts before the media')
        if index + 1 < len(segments) and segment['src_out_s'] + half > record['media']['duration_s'] + 1e-9:
            out.append(f'segment {index}: crossfade runs past the media')
        if segment['src_out_s'] <= segment['src_in_s']:
            out.append(f'segment {index}: out point must follow in point')
        if abs(segment['out_in_s'] - cursor) > 0.002:
            out.append(f'segment {index}: output clock is not continuous')
        length = (segment['src_out_s'] - segment['src_in_s']) / speed
        if abs(segment['out_out_s'] - segment['out_in_s'] - length) > 0.002:
            out.append(f'segment {index}: output length does not equal source length / speed')
        cursor = segment['out_out_s']
    if sum(s.get('frames', 0) for s in segments) != edl.get('duration_frames') or edl.get('duration_frames') != round(cursor * FPS):
        out.append('picture frames do not add up to the cut length')
    joins = edl.get('joins') or []
    if [round(j['at_s'], 3) for j in joins] != [round(s['out_in_s'], 3) for s in segments[1:]]:
        out.append('joins must sit exactly at the segment boundaries')
    previous = -1.0
    seen = set()
    for word in edl.get('words') or []:
        if word['w'] in seen:
            out.append(f'word {word["w"]} appears twice')
        seen.add(word['w'])
        if word['onset_s'] < previous:
            out.append(f'word {word["w"]} is out of order')
        previous = word['onset_s']
        inside = any(s['out_in_s'] - 1e-6 <= word['onset_s'] and word['end_s'] <= s['out_out_s'] + 1e-6 for s in segments)
        if not inside:
            out.append(f'word {word["w"]} "{word["word"]}" is clipped by a join')
    removed = {w for r in edl.get('edit', {}).get('remove', []) for w in range(r['from_w'], r['to_w'] + 1)}
    if removed & seen:
        out.append('a word the approved edit removes is still in the cut')
    return out


def write(edl: dict, ve_dir: Path) -> tuple[Path, Path]:
    cut = edl['cut']
    if not re.fullmatch(r'[a-z0-9][a-z0-9_-]{0,63}', cut):
        raise ValueError('cut id must be a slug')
    edl_path = write_json(Path(ve_dir) / f'edl.{cut}.json', edl)
    words_path = write_json(Path(ve_dir) / f'words.{cut}.json',
                            [{'w': w['w'], 'word': w['word'], 'onset_s': w['onset_s'], 'end_s': w['end_s']} for w in edl['words']])
    return edl_path, words_path


def records_for(edl: dict, ve_dir: Path) -> dict[str, dict]:
    return {name: load_take(ve_dir, name) for name in edl['takes']}


def _has_video(path: str) -> bool:
    text = subprocess.run([ffmpeg(), '-hide_banner', '-i', path], capture_output=True, text=True, errors='replace').stderr
    return bool(re.search(r'Stream #\S+.*: Video:', text))


def render(edl: dict, records: dict[str, dict], assets_dir: Path) -> dict:
    """Render the conformed picture and dialogue from ONE ffmpeg graph: one speed factor, the same cut points."""
    findings = lint_edl(edl, records)
    if findings:
        raise ValueError('the EDL fails the F09 lint: ' + '; '.join(findings[:5]))
    for record in records.values():
        problem = check_media(record)
        if problem:
            raise ValueError(problem)
    assets_dir = Path(assets_dir)
    assets_dir.mkdir(parents=True, exist_ok=True)
    order = list(dict.fromkeys(s['take'] for s in edl['segments']))
    media = [records[name]['media']['path'] for name in order]
    video = all(_has_video(path) for path in media)
    speed, half = edl['speed'], edl['crossfade_ms'] / 2000
    graph, last = [], len(edl['segments']) - 1
    for k, segment in enumerate(edl['segments']):
        m = order.index(segment['take'])
        start = segment['src_in_s'] - (half * speed if k > 0 else 0)
        end = segment['src_out_s'] + (half * speed if k < last else 0)
        tempo = f',atempo={speed:.6f}' if speed != 1 else ''
        graph.append(f'[{m}:a]atrim=start={start:.6f}:end={end:.6f},asetpts=PTS-STARTPTS{tempo},'
                     f'aresample=48000,aformat=channel_layouts=mono[a{k}]')
        if video:
            span = (segment['frames'] + 1) / FPS * speed
            graph.append(f'[{m}:v]trim=start={segment["src_in_s"]:.6f}:end={segment["src_in_s"] + span:.6f},'
                         f'setpts=(PTS-STARTPTS)/{speed:.6f},fps={FPS},trim=end_frame={segment["frames"]},'
                         f'setpts=PTS-STARTPTS[v{k}]')
    current = 'a0'
    for k in range(1, last + 1):
        graph.append(f'[{current}][a{k}]acrossfade=d={edl["crossfade_ms"] / 1000:.4f}:c1=tri:c2=tri[x{k}]')
        current = f'x{k}'
    graph.append(f'[{current}]asplit=2[amux][awav]')
    if video:
        graph.append(''.join(f'[v{k}]' for k in range(last + 1)) + f'concat=n={last + 1}:v=1:a=0[vout]')
    picture = assets_dir / edl['conformed']['picture']
    dialogue = assets_dir / edl['conformed']['dialogue']
    cmd = [ffmpeg(), '-nostdin', '-v', 'error', '-y']
    for path in media:
        cmd += ['-i', path]
    cmd += ['-filter_complex', ';'.join(graph)]
    if video:
        cmd += ['-map', '[vout]', '-map', '[amux]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', str(FPS),
                '-c:a', 'aac', '-b:a', '192k', str(picture)]
    cmd += ['-map', '[awav]', '-c:a', 'pcm_s16le', '-ar', '48000', str(dialogue)]
    subprocess.run(cmd, check=True, capture_output=True)
    out = {'dialogue': str(dialogue), 'dialogue_sha256': sha256_file(dialogue)}
    if video:
        out.update(picture=str(picture), picture_sha256=sha256_file(picture))
    return out


def joins_reel(edl: dict, dialogue: str | Path, out: str | Path, *, around_s: float = 1.5, between_s: float = 0.5) -> dict:
    """Each join with around_s either side, one after another with a short silence: what Krish hears at Gate 3."""
    joins = edl.get('joins') or []
    out = Path(out)
    if not joins:
        return {'reel': None, 'joins': []}
    parts, rows, cursor = [], [], 0.0
    for k, join in enumerate(joins):
        start = max(0.0, join['at_s'] - around_s)
        end = min(edl['duration_s'], join['at_s'] + around_s)
        parts.append(f'[0:a]atrim=start={start:.4f}:end={end:.4f},asetpts=PTS-STARTPTS[p{k}]')
        parts.append(f'aevalsrc=0:d={between_s}:s=48000[s{k}]')
        rows.append({'join': k + 1, 'cut_at_s': join['at_s'], 'reel_at_s': round(cursor + join['at_s'] - start, 3)})
        cursor += end - start + between_s
    parts.append(''.join(f'[p{k}][s{k}]' for k in range(len(joins))) + f'concat=n={2 * len(joins)}:v=0:a=1[reel]')
    subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-y', '-i', str(dialogue), '-filter_complex', ';'.join(parts),
                    '-map', '[reel]', '-ac', '1', '-ar', '48000', str(out)], check=True, capture_output=True)
    write_json(out.with_suffix('.json'), {'cut': edl['cut'], 'reel': out.name, 'joins': rows})
    return {'reel': str(out), 'joins': rows}


def finite(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def load_script(path: Path) -> tuple[list[dict], str]:
    return script_words(load_json(path)), sha256_file(path)
