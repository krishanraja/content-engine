"""The fumble pass: what conform does with what the listen pass heard (velib/hear.py).

One function, `clocks(record)`, turns a take record into the clocks conform cuts on:

  - every `word` and `trim` event becomes an unscripted word in clock A, written <uh>, <partial:cl>, <stutter:the> or
    <sound>. It never matches a script word, so conform skips it like any flub: cut out when agreed gaps bound it,
    kept and reported when they do not (F09 unchanged: a cut still needs a gap both aligners agree on);
  - a `trim` event, heard inside a clock word by two ears that write words, moves that word's edge off it in both
    clocks, so the folded-in hesitation can be cut without touching the word;
  - `quiet` is where the sound is quiet and unvoiced; conform puts every join and both ends of the cut inside it, so
    no join lands on a sound nobody wrote down (config/failures.json chopped-words-published);
  - `suspect` names the clock-A words that sounded wrong: a `flag` event inside them, both clocks unsure of them, or
    far longer than his norm. A suspect word is never cut (it may be his word, said badly); its reading loses to a
    cleaner reading of the same line in another take.

Nothing scripted is ever removed here: the floor (2026-10-19, "my words randomly chop out") holds.
"""
from __future__ import annotations

from . import hear

DEFAULTS = {'probability_min': 0.35, 'score_min': 0.35, 'dur_ratio_max': 2.4, 'min_word_s': 0.05}


def thresholds() -> dict:
    try:
        from cutgates import settings  # noqa: PLC0415
        return {**DEFAULTS, **{k: v for k, v in settings.rule('listen').items() if k in DEFAULTS}}
    except (KeyError, ImportError, OSError, ValueError):
        return dict(DEFAULTS)


def label(event: dict) -> str:
    if event['kind'] == 'hesitation':
        return f"<{event['text'] or 'uh'}>"
    if event['kind'] == 'unworded':
        return '<sound>'
    return f"<{event['kind']}:{event['text']}>"


def is_pseudo(word: dict) -> bool:
    return bool(word.get('heard_by'))


def _trimmable(words: list[dict], event: dict, min_word_s: float) -> bool:
    """An event may be trimmed off a word only where it reaches the word's edge: a sound in the middle of a word
    ("clea-uh-rly") is never trimmed, or the rest of the word would become a gap a join could land in."""
    if event['e'] - event['s'] < min_word_s:
        return False
    for w in words:
        if hear._overlap(w['onset_s'], w['end_s'], event['s'], event['e']) <= 0:
            continue
        tail = event['e'] >= w['end_s'] - 1e-6 and event['s'] - w['onset_s'] >= min_word_s
        head = event['s'] <= w['onset_s'] + 1e-6 and w['end_s'] - event['e'] >= min_word_s
        if not (tail or head):
            return False
    return True


def _trim(words: list[dict], event: dict) -> None:
    """Move the edge of any word the event reaches off it (_trimmable has checked each one)."""
    for w in words:
        if hear._overlap(w['onset_s'], w['end_s'], event['s'], event['e']) <= 0:
            continue
        if event['e'] >= w['end_s'] - 1e-6:
            w['end_s'] = round(event['s'], 4)
        else:
            w['onset_s'] = round(event['e'], 4)


def suspects(record: dict, a: list[dict], b: list[dict], block: dict | None, limits: dict) -> dict[int, list[str]]:
    """Clock-A words (by their place in `a`) that sounded wrong, with why."""
    out: dict[int, list[str]] = {}
    if not block:
        return out
    rows = {r['i']: r for r in block.get('words', [])}
    flags = [e for e in block.get('events', []) if e['use'] == 'flag']
    for j, w in enumerate(a):
        if is_pseudo(w):
            continue
        row, why = rows.get(w.get('i'), {}), []
        if any(hear._overlap(w['onset_s'], w['end_s'], e['s'], e['e']) > 0 for e in flags):
            why.append('a hesitation heard inside it by one ear')
        if row.get('dur_ratio', 0) > limits['dur_ratio_max']:
            why.append(f"{row['dur_ratio']}x his usual length")
        unsure_a = isinstance(w.get('probability'), (int, float)) and w['probability'] < limits['probability_min'] or \
            isinstance(w.get('score'), (int, float)) and w['score'] < limits['score_min']
        if unsure_a:
            twin = next((x for x in b if hear._overlap(x['onset_s'], x['end_s'], w['onset_s'], w['end_s']) > 0), None)
            if twin is not None and (isinstance(twin.get('probability'), (int, float)) and twin['probability'] < limits['probability_min']
                                     or isinstance(twin.get('score'), (int, float)) and twin['score'] < limits['score_min']):
                why.append('both clocks unsure of it')
        if why:
            out[j] = why
    return out


def clocks(record: dict) -> dict:
    """Clock A and B for conform, with the listen pass folded in; when the record has no valid listen pass, the
    clocks as ingested, quiet None (no sound check) and no suspects."""
    a = [dict(w) for w in record['aligners']['a']['words']]
    b = [dict(w) for w in record['aligners']['b']['words']]
    block = hear.valid(record)
    if not block:
        return {'a': a, 'b': b, 'quiet': None, 'suspect': {}, 'listen': None}
    limits = thresholds()
    pseudo = []
    for event in block.get('events', []):
        if event['use'] not in ('word', 'trim'):
            continue
        if event['use'] == 'trim':
            if not (_trimmable(a, event, limits['min_word_s']) and _trimmable(b, event, limits['min_word_s'])):
                continue                     # left as it was heard: the word keeps its sound, nothing is cut
            _trim(a, event)
            _trim(b, event)
        pseudo.append({'i': None, 'text': label(event), 'onset_s': round(event['s'], 4), 'end_s': round(event['e'], 4),
                       'heard_by': event['sources'], 'kind': event['kind']})
    # A pseudo word never overlaps a clock word: it is clipped to the time no word covers, or dropped when little is left.
    kept = []
    for p in pseudo:
        for w in a:
            if hear._overlap(p['onset_s'], p['end_s'], w['onset_s'], w['end_s']) > 0:
                if w['onset_s'] <= p['onset_s']:
                    p['onset_s'] = max(p['onset_s'], w['end_s'])
                else:
                    p['end_s'] = min(p['end_s'], w['onset_s'])
        if p['end_s'] - p['onset_s'] >= limits['min_word_s']:
            kept.append(p)
    pseudo = kept
    merged = sorted(a + pseudo, key=lambda w: (w['onset_s'], w['end_s']))
    return {'a': merged, 'b': b, 'quiet': block.get('quiet', []), 'suspect': suspects(record, merged, b, block, limits),
            'listen': block}
