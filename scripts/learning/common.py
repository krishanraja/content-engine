"""What every stage of the failure loop shares: the registers, the items the loop reasons over, and plain-word text
matching. Deterministic and standard library only, so the weekly job runs it before any model is asked anything.

An item is one thing that went wrong, from any source, in one shape:
    {id, source, on, stage, kind, maker, what, his_words, group, theme, formats, failure_ids, learning_ids,
     preflight, brief_score, cause_text, piece, meta}
Sources: 'incident' (engine_incidents rows, the live capture), and for the backfill 'failure' (config/failures.json),
'learning' (config/learnings.json) and 'floor_record' (config/rejection-floor.json records he rejected).
"""
from __future__ import annotations

import json
import math
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / 'config'
FAILURES = CONFIG / 'failures.json'
LEARNINGS = CONFIG / 'learnings.json'
FLOOR = CONFIG / 'rejection-floor.json'
GROUPS = CONFIG / 'floor-groups.json'
STAGES = ('brief', 'script', 'storyboard', 'style', 'proof', 'cut', 'package', 'post', 'board', 'session')

STOP = set('''a about above after again against all also always am an and any are as at be because been before being
below between both but by can cannot could did do does doing down during each even ever every few for from further had
has have having he her here hers him his how i if in into is it its itself just krish let like make many may me more
most much must my never no nor not now of off on once one only or other our out over own same she should so some still
such than that the their them then there these they this those through to too under until up upon us very was we
were what when where which while who whom why will with within without would you your yours piece pieces session
sessions engine thing things way get got gets use used using said says say want wants wanted need needs needed
already new next first last day days week today time made making'''.split())
WORD = re.compile(r"[a-z][a-z0-9]+")


def load_json(path: Path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def stem(word: str) -> str:
    for suffix in ('ing', 'edly', 'ed', 'es', 's', 'ly'):
        if len(word) > len(suffix) + 3 and word.endswith(suffix):
            return word[: -len(suffix)]
    return word


def tokens(text: str) -> set[str]:
    """The content words of a text, lower case and lightly stemmed: what two texts are compared on."""
    return {stem(w.strip("'")) for w in WORD.findall(str(text or '').lower()) if w not in STOP and len(w) > 2}


def jaccard(a: set, b: set) -> float:
    return len(a & b) / len(a | b) if a and b else 0.0


def cosine(a, b) -> float:
    """Cosine of two word bags (a set counts each word once): long and short texts compare fairly."""
    a = a if isinstance(a, Counter) else Counter(a)
    b = b if isinstance(b, Counter) else Counter(b)
    if not a or not b:
        return 0.0
    num = sum(v * b[k] for k, v in a.items() if k in b)
    return num / math.sqrt(sum(v * v for v in a.values()) * sum(v * v for v in b.values()))


def containment(small: set, big: set) -> float:
    """How much of the smaller text the bigger one holds: a short rule inside a long paragraph still matches."""
    return len(small & big) / len(small) if small else 0.0


FORMAT_STAGE = {
    'script': 'script', 'prediction': 'brief', 'title': 'package', 'thumbnail': 'package', 'cover': 'package',
    'carousel': 'package', 'card': 'package', 'captions': 'cut', 'short_video': 'cut', 'long_video': 'cut',
    'motion': 'cut', 'audio': 'cut', 'intro_outro': 'cut', 'article': 'post', 'site': 'post', 'board': 'board',
    'session': 'session', 'pipeline': 'session',
}
STAGE_WORDS = [
    ('proof', r'\bproof'), ('style', r'\bstyle'), ('storyboard', r'storyboard|\bbeat'), ('brief', r'\bbrief|direction|narrative lock'),
    ('script', r'script|teleprompter|hook|reading age'), ('package', r'thumbnail|cover|title|carousel|caption'),
    ('board', r'\bboard|publish manager|tab\b'), ('post', r'article|substack|\bpost'),
    ('cut', r'\bcut\b|video|render|motion|audio|music|frame'), ('session', r'session|codex|merge|commit|drive|routine'),
]


def stage_of(formats=(), text='') -> str:
    """The stage a failure belongs to: from the makers it names, else from its words, else session."""
    for fmt in formats or ():
        if fmt in FORMAT_STAGE:
            return FORMAT_STAGE[fmt]
    low = str(text or '').lower()
    for stage, pattern in STAGE_WORDS:
        if re.search(pattern, low):
            return stage
    return 'session'


def registers(groups_path: Path | None = None) -> dict:
    """The four files the loop reads. floor-groups.json may be absent (the groups arrive by their own pull request);
    then items fall back to the floor's themes."""
    groups_path = Path(groups_path) if groups_path else GROUPS
    return {
        'failures': load_json(FAILURES),
        'learnings': load_json(LEARNINGS),
        'floor': load_json(FLOOR),
        'groups': load_json(groups_path) if groups_path.is_file() else None,
    }


def group_index(regs: dict) -> dict:
    """{standard id: group key}, {record id: group key} and each group's words, from floor-groups.json."""
    floor, groups = regs['floor'], regs['groups']
    of_standard, of_record, words = {}, {}, {}
    if not groups:
        return {'standard': of_standard, 'record': of_record, 'words': words, 'operating': set()}
    for g in groups.get('groups') or []:
        words[g['key']] = tokens(' '.join([g.get('title', ''), g.get('never_beneath', ''), g.get('check', '')]))
        for sid in g.get('members') or []:
            of_standard[sid] = g['key']
    operating = set((groups.get('operating') or {}).get('members') or [])
    for sid in operating:
        of_standard[sid] = 'operating'
    for sid, s in (floor.get('standards') or {}).items():
        for rid in s.get('records') or []:
            if sid in of_standard:
                of_record.setdefault(rid, of_standard[sid])
    return {'standard': of_standard, 'record': of_record, 'words': words, 'operating': operating}


def best_group(text_tokens: set, index: dict, floor_theme: str | None = None, threshold: float = 0.1) -> str:
    """The floor group whose words a text shares most (cosine), or theme:<theme>, or ungrouped."""
    best, score = None, 0.0
    for key, words in index['words'].items():
        s = cosine(text_tokens, words)
        if s > score:
            best, score = key, s
    if best and score >= threshold:
        return best
    return f'theme:{floor_theme}' if floor_theme else 'ungrouped'


def item(**fields) -> dict:
    base = {'id': None, 'source': 'incident', 'on': '', 'stage': 'session', 'kind': 'krish_reject', 'maker': 'unknown',
            'what': '', 'his_words': '', 'group': 'ungrouped', 'theme': None, 'formats': [], 'failure_ids': [],
            'learning_ids': [], 'preflight': None, 'brief_score': None, 'cause_text': '', 'piece': None, 'meta': {}}
    base.update({k: v for k, v in fields.items() if v is not None})
    return base


def backfill_items(regs: dict) -> list[dict]:
    """Every failure, learning and floor rejection as an item, so the loop can be run over the history at once."""
    index = group_index(regs)
    out = []
    for f in regs['failures']['failures']:
        what = ' '.join(x for x in (f.get('what'), f.get('symptom')) if x)
        toks = tokens(what + ' ' + f.get('krish', ''))
        out.append(item(id=f['id'], source='failure', on=f.get('on', ''), stage=stage_of((), what), kind='krish_reject',
                        what=what, his_words=f.get('krish', ''), group=best_group(toks, index), failure_ids=[f['id']],
                        learning_ids=list(f.get('related') or []), cause_text=f.get('cause', '') or '',
                        meta={'status': f.get('status'), 'guards': len(f.get('guards') or [])}))
    for lr in regs['learnings']['learnings']:
        what = lr.get('means', '')
        toks = tokens(what + ' ' + lr.get('krish', ''))
        out.append(item(id=lr['id'], source='learning', on=lr.get('on', ''), stage=stage_of((), what), kind='krish_reject',
                        what=what, his_words=lr.get('krish', ''), group=best_group(toks, index), learning_ids=[lr['id']],
                        cause_text=lr.get('why', ''), meta={'status': lr.get('status')}))
    for rid, r in (regs['floor'].get('records') or {}).items():
        if r.get('kind') == 'liked':
            continue
        words = ' '.join(w.get('said', '') if isinstance(w, dict) else str(w) for w in r.get('his_words') or [])
        what = ' '.join(x for x in (r.get('what'), r.get('wanted_instead')) if x)
        group = index['record'].get(rid)
        if group in (None, 'operating'):
            # A process rejection is grouped by what it is about; only one about no floor group stays 'operating'.
            found = best_group(tokens(what + ' ' + words), index, r.get('theme'))
            group = found if group is None or not found.startswith(('theme:', 'ungrouped')) else group
        out.append(item(id=rid, source='floor_record', on=r.get('on', ''), stage=stage_of(r.get('formats') or (), what),
                        kind='krish_reject', what=what, his_words=words, group=group, theme=r.get('theme'),
                        formats=list(r.get('formats') or []), piece=r.get('piece'), meta={'kind': r.get('kind')}))
    return out


def incident_items(rows: list[dict], regs: dict) -> list[dict]:
    """engine_incidents rows as items: their groups come from the row, else from their words."""
    index = group_index(regs)
    failures = {f['id']: f for f in regs['failures']['failures']}
    out = []
    for row in rows:
        meta = row.get('meta') or {}
        findings = ' '.join(str(f.get('text', '')) for f in meta.get('findings') or [] if isinstance(f, dict))
        what = ' '.join(str(x) for x in (row.get('his_words'), findings, meta.get('override_reason'), meta.get('label'),
                                         ' '.join(failures[i]['what'] for i in row.get('failure_ids') or [] if i in failures)) if x)
        groups = list(row.get('floor_groups') or [])
        out.append(item(id=row.get('id'), source='incident', on=str(row.get('at') or '')[:10], stage=row.get('stage') or 'session',
                        kind=row.get('kind'), maker=row.get('maker') or 'unknown', what=what, his_words=row.get('his_words') or '',
                        group=groups[0] if groups else best_group(tokens(what), index),
                        failure_ids=list(row.get('failure_ids') or []), preflight=row.get('preflight'),
                        brief_score=row.get('brief_score'), piece=row.get('piece_id') or row.get('piece_path'),
                        meta={'skill': row.get('skill'), 'artifact_ref': row.get('artifact_ref'), **meta}))
    return out
