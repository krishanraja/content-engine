#!/usr/bin/env python3
"""edit_sweep: carry Krish's saved board edits into every other draft, and say what kind of change each was.

Krish, 2026-10-21: "If I make a statistical change or a narrative style change in one place, just make sure that those
changes propagate and the next draft is consistent. Don't just think about that one surgical edit I made because I may
have missed another place in another script for example." Asked how, he chose: apply the change everywhere in the piece
and in later drafts, show "also changed in" with an undo, and make a standing rule only when he approves it. Learning
edits-propagate-and-teach (config/learnings.json).

    python3 scripts/post-pack/edit_sweep.py DAY_OR_PIECE --week MONDAY --edits edits.json \\
        --review "mon=Article|docs/plans/x/article.md" --review "mon=Five-minute script|docs/plans/x/long.md" \\
        [--review "wed=..."] [--piece mon=UUID] [--recorded mon=short] [--making mon=making.json] \\
        [--apply] [--out sweep.json] [--post-ledger]
    python3 scripts/post-pack/edit_sweep.py --undo SWEEP.json ID [--apply]     put one carried change back (his Undo)
    python3 scripts/post-pack/edit_sweep.py --accept SWEEP.json ID [--apply]   make one suggestion too (his Change it too)
    python3 scripts/post-pack/edit_sweep.py --self-test

DAY_OR_PIECE is the day whose edits to sweep (mon, wed, fri) or its piece id (with --piece). --edits is the saved
answer of `board_web.py read WEEK edits`. --review takes the same DAY=LABEL|PATH as week_board.py: every draft of the
day (article, scripts, captions) and the drafts of later days still in review.

Only his saves count: a document whose updated_by is not Krish (the board's access-cookie writer) is left out and named.
For each saved edit (edits/<day>-<item>: text, base_sha256, at) it:

  1. checks the save was made on the words in the file (base_sha256); one made on older words is listed, never guessed;
  2. diffs it against those words and classifies each change, by rule and never by a model: number or fact (a figure,
     a date, a unit), claim (how sure or how broad: will, may, always, most, a negation), structure (a paragraph or a
     heading added, taken out or moved), tone (an intensifier, a contraction, an exclamation) or wording (anything
     else, including anything unclear);
  3. finds the same figure, phrase or claim in every other draft of the piece and in later drafts (and elsewhere in the
     draft he edited), and changes it there: a number or fact, or a claim, is changed; a change of tone or wording is
     only listed as a suggestion; a script he has already recorded is never touched, only listed (its take would stop
     counting), and on a day with recordings neither is a script whose cut cannot be told (a deep cut is the long one).
     A number is changed only where it counts the same thing: the same noun next to it ("of firms"), or two shared
     content words that are not claim or filler words; anything weaker is a suggestion, and no number his edit does not
     hold is ever put into a draft;
  4. runs the gates again on every draft that changed: story_check.py on a script, voice_check.py on the article;
  5. writes the sweep (default docs/plans/<Monday>-week/<day>-sweep.json) for week_board.py --sweep DAY=..., which
     shows it under the drafts as "Also changed", each with Undo, and one ledger row per edit (surface publish_board,
     action manual_edit, reason_code the class, decided_by Krish: his own saved words) for POST /api/content-edits.

Without --apply nothing is written but the sweep file. The figure matching reuses narration_diff.py's number words and
its lists of intensifiers and hedges.
"""
import argparse
import difflib
import hashlib
import json
import re
import sys
import tempfile
import uuid
from datetime import date, datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import narration_diff  # noqa: E402  number words, intensifiers, hedges, contractions
import story_check  # noqa: E402  the story check and the reading gate, on a script
import voice_check  # noqa: E402  the voice check, on an article

DAYS = (('mon', 'Monday'), ('wed', 'Wednesday'), ('fri', 'Friday'))
DAY_KEYS = {k: k for k, _ in DAYS} | {n.lower(): k for k, n in DAYS} | {n.lower()[:3]: k for k, n in DAYS}
DAY_NAME = dict(DAYS)
UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)
KINDS = ('number_fact', 'claim', 'structure', 'tone', 'wording')  # the order a box's main class is chosen in
LEDGER_NS = uuid.UUID('6f1c2d4e-8a7b-4c3d-9e2f-1a2b3c4d5e6f')  # idempotency keys: one row per save, however often run


class SweepError(Exception):
    pass


def sha(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def slug_of(label):
    """The board's item id for a label, as week_board.py makes it."""
    return re.sub(r'[^a-z0-9]+', '-', label.lower()).strip('-') or 'text'


PARA_SPLIT = re.compile(r'(\n(?:[ \t]*\n)+)')  # the board's paragraphs (week_board.paragraphs, week.js)


def paragraphs(text):
    return PARA_SPLIT.split(text)[0::2]


# ------------------------------------------------------------------ words, figures and classes

TOKEN = re.compile(r"[$£€]?\d[\d,]*(?:\.\d+)?%?|[A-Za-z0-9]+(?:['’][A-Za-z]+)*|[^\sA-Za-z0-9]")
NUMBER_WORDS = sorted((set(narration_diff.UNITS) - {'one'}) | set(narration_diff.TENS) | narration_diff.SCALES
                      | {'percent', 'half', 'quarter', 'dozen', 'bn', 'mn'}, key=len, reverse=True)
NUMBERISH = re.compile(r'\d|\b(?:' + '|'.join(NUMBER_WORDS) + r')\b|\bper cent\b', re.I)
DATEISH = re.compile(r'\b(?:jan(?:uary)?|feb(?:ruary)?|march|april|june|july|august|sept?(?:ember)?|october|november|december'
                     r'|monday|tuesday|wednesday|thursday|friday|saturday|sunday|yesterday|today|tomorrow|last (?:week|month|year)'
                     r'|next (?:week|month|year)|this (?:week|month|year))\b|\bmay \d', re.I)
# How sure or how broad a sentence is (narration_diff's hedges among them): a change to these is a change of claim.
CLAIM_WORDS = {'will', 'would', 'may', 'might', 'could', 'can', 'must', 'should', 'always', 'never', 'all', 'every', 'none',
               'most', 'many', 'some', 'few', 'only', 'proves', 'proved', 'proven', 'shows', 'showed', 'suggests', 'means',
               'certainly', 'definitely', 'probably', 'likely', 'unlikely', 'possibly', 'perhaps', 'maybe', 'guaranteed',
               'first', 'biggest', 'best', 'worst', 'largest', 'not', 'no', 'cannot', 'nobody', 'nothing', 'everyone',
               'everything', 'about', 'around', 'roughly', 'nearly', 'almost', 'over', 'under', 'more', 'less', 'fewer'} \
    | {w for h in narration_diff.HEDGES for w in h.split() if len(h.split()) == 1}
TONE_WORDS = set(narration_diff.INTENSIFIERS) | {'just', 'so', 'quite', 'pretty', 'rather', 'fairly', 'truly', 'simply',
                                                 'wow', 'oh', 'well', 'look', 'honestly', 'frankly'}
TONE_MARKS = {'!', '?', '…', '.', ',', ';', ':'}
STOP = {'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'is', 'are', 'was', 'were', 'be',
        'been', 'it', 'its', 'that', 'this', 'these', 'those', 'as', 'by', 'from', 'than', 'then', 'they', 'their', 'there',
        'you', 'your', 'we', 'our', 'he', 'she', 'his', 'her', 'them', 'what', 'which', 'who', 'how', 'why', 'when', 'have',
        'has', 'had', 'do', 'does', 'did', 'into', 'out', 'up', 'so', 'if', 'per', 'cent', 'percent'}


def tokens(text):
    return [(m.group(0), m.start(), m.end()) for m in TOKEN.finditer(text)]


def words(text):
    return [t.lower().replace('’', "'") for t, _, _ in tokens(text) if re.match(r'[A-Za-z0-9$£€]', t)]


def expanded(text):
    """Words with contractions written out (narration_diff's list), for telling a contraction from a change of words."""
    out = []
    for w in words(text):
        out += narration_diff.CONTRACT.get(w.replace("'", ''), w).split()
    return out


def classify(frm, to, para_a, para_b):
    """number_fact, claim, structure, tone or wording: by rule. Anything unclear is wording."""
    if para_a.lstrip().startswith('#') or para_b.lstrip().startswith('#'):
        return 'structure'
    if NUMBERISH.search(frm) or NUMBERISH.search(to) or DATEISH.search(frm) or DATEISH.search(to):
        return 'number_fact'
    a, b = set(words(frm)), set(words(to))
    marks_a = [t for t, _, _ in tokens(frm) if not re.match(r'\w', t)]
    marks_b = [t for t, _, _ in tokens(to) if not re.match(r'\w', t)]
    if expanded(frm) == expanded(to) and (frm.lower() != to.lower() or marks_a != marks_b):
        return 'tone'  # a contraction, an exclamation: the same words said another way
    if (a ^ b) & CLAIM_WORDS:
        return 'claim'
    if (a ^ b) and (a ^ b) <= TONE_WORDS:
        return 'tone'
    return 'wording'


UNIT = {'%': 'pct', 'percent': 'pct', 'per cent': 'pct', 'bn': 'bn', 'billion': 'bn', 'mn': 'mn', 'm': 'mn', 'million': 'mn',
        'k': 'k', 'thousand': 'k', 'tn': 'tn', 'trillion': 'tn', 'x': 'x', 'times': 'x'}
CURRENCY = {'$': 'usd', '£': 'gbp', '€': 'eur'}
_NUMWORD = r'(?:(?:' + '|'.join(sorted(narration_diff.TENS, key=len, reverse=True)) + r')(?:[- ](?:' \
    + '|'.join(sorted([w for w in narration_diff.UNITS if narration_diff.UNITS[w] < 10 and w != 'zero'], key=len, reverse=True)) \
    + r'))?|' + '|'.join(sorted(narration_diff.UNITS, key=len, reverse=True)) + r')(?:\s+hundred)?'
FIGURE = re.compile(r'(?P<cur>[$£€])?(?P<num>\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\b' + _NUMWORD + r'\b)'
                    r'(?P<unit>\s?%|\s?per cent\b|\s?percent\b|\s?(?:bn|billion|mn|million|m|k|thousand|tn|trillion|x|times)\b)?',
                    re.I)


def number_value(text):
    t = text.lower().replace(',', '').strip()
    if re.fullmatch(r'\d+(?:\.\d+)?', t):
        return float(t)
    n, total = 0, None
    for w in re.split(r'[- ]+', t):
        if w in narration_diff.UNITS:
            n += narration_diff.UNITS[w]
        elif w in narration_diff.TENS:
            n += narration_diff.TENS[w]
        elif w == 'hundred':
            n *= 100
        else:
            return None
        total = n
    return float(total) if total is not None else None


def figures(text):
    """Every figure in a text: {start, end, value, unit, cur, words (written in words), num_text, unit_text}."""
    out = []
    for m in FIGURE.finditer(text):
        v = number_value(m.group('num'))
        if v is None:
            continue
        unit_text = m.group('unit') or ''
        unit = UNIT.get(unit_text.strip().lower(), '')
        if m.group('num').isalpha() and not unit and v < 10 and not m.group('cur'):
            continue  # "two people", "three things": a small word on its own is not a figure worth carrying
        out.append({'start': m.start(), 'end': m.end(), 'value': v, 'unit': unit, 'cur': CURRENCY.get(m.group('cur') or '', ''),
                    'words': m.group('num')[0].isalpha(), 'num_text': m.group('num'), 'unit_text': unit_text,
                    'cur_text': m.group('cur') or ''})
    return out


def to_words(n):
    """0 to 999 in words, as a script writes a number to be said."""
    ones = [w for w, i in sorted(narration_diff.UNITS.items(), key=lambda x: x[1])]
    tens = {v: k for k, v in narration_diff.TENS.items()}
    if n < 20:
        return ones[n]
    if n < 100:
        return tens[n // 10 * 10] + ('' if n % 10 == 0 else '-' + ones[n % 10])
    rest = n % 100
    return ones[n // 100] + ' hundred' + ('' if not rest else ' and ' + to_words(rest))


def restyle(target, new):
    """The new figure written the way the target draft writes its figures (digits or words, its unit, its currency)."""
    v = new['value']
    if target['words'] and v == int(v) and 0 <= v < 1000:
        num = to_words(int(v))
        if target['num_text'][0].isupper():
            num = num[0].upper() + num[1:]
    else:
        num = new['num_text']
    unit = target['unit_text'] if new['unit'] == target['unit'] else new['unit_text']
    cur = target['cur_text'] if new['cur'] == target['cur'] or not new['cur'] else new['cur_text']
    return f'{cur}{num}{unit}'


def same_figure(a, b):
    return a['value'] == b['value'] and a['unit'] == b['unit'] and (a['cur'] == b['cur'] or not a['cur'] or not b['cur'])


def sentence_at(text, at):
    """The sentence of text around position at."""
    start = max(text.rfind('. ', 0, at), text.rfind('? ', 0, at), text.rfind('! ', 0, at), text.rfind('\n', 0, at))
    ends = [i for i in (text.find('. ', at), text.find('? ', at), text.find('! ', at), text.find('\n', at)) if i >= 0]
    return text[start + 1 if start >= 0 else 0:(min(ends) + 1) if ends else len(text)].strip()


def content(text):
    return {w for w in words(text) if len(w) >= 4 and w not in STOP and not NUMBERISH.search(w)}


FILLER = STOP | CLAIM_WORDS | TONE_WORDS


def stem(w):
    """A word without a plural s, so "firm" and "firms" are one noun."""
    w = w.lower().replace('’', "'")
    return w[:-1] if len(w) > 3 and w.endswith('s') and not w.endswith('ss') else w


def meaningful(text):
    """The content words of a sentence that say what it is about: no claim, tone or filler words ("about", "only")."""
    return {stem(w) for w in content(text) if w not in FILLER}


def neighbours(text, start, end, reach=3):
    """The noun right before and right after a figure, inside its sentence: (before, after), each a word or None.
    "About 40% of firms" gives (None, "firm"): "about" is a claim word and "of" is filler."""
    pre, post = text[max(0, start - 120):start], text[end:end + 120]
    cut = max(pre.rfind(m) for m in ('. ', '? ', '! ', '\n'))
    pre = pre[cut + 1:] if cut >= 0 else pre
    ends = [i for i in (post.find('. '), post.find('? '), post.find('! '), post.find('\n')) if i >= 0]
    post = post[:min(ends)] if ends else post

    def pick(ws):
        return next((stem(w) for w in ws if w not in FILLER and not NUMBERISH.search(w)), None)
    return pick(list(reversed(words(pre)))[:reach]), pick(words(post)[:reach])


def same_quantity(near, sentence, text, f):
    """Whether a figure in another draft counts the same thing as the figure he changed: the same noun next to it ("of
    firms"), or at least two content words shared with his sentence that are not claim or filler words. A different
    noun right after the figure ("of staff" against "of firms") is another quantity, whatever else the sentences share.
    Anything weaker is only a suggestion (Krish's "About 40% of firms" must never move "about 40 percent of staff")."""
    sb, sa = near or (None, None)
    tb, ta = neighbours(text, f['start'], f['end'])
    if sa and ta:
        return sa == ta
    if sb and tb and sb == tb:
        return True
    return len(meaningful(sentence) & meaningful(sentence_at(text, f['start']))) >= 2


def from_his_edit(new, his):
    """Every figure in new words is one his saved words hold: a number never enters a draft from anywhere else."""
    have = {(f['value'], f['unit']) for f in figures(his)}
    return all((f['value'], f['unit']) in have for f in figures(new))


def excerpt(text, at, end, width=90):
    a, b = max(0, at - width), min(len(text), end + width)
    return ('...' if a else '') + re.sub(r'\s+', ' ', text[a:b]).strip() + ('...' if b < len(text) else '')


# ------------------------------------------------------------------ a save, as its changes

def word_changes(pa, pb):
    """The changes inside one paragraph: [{from, to, region_a, region_b, sentence, fig_a, fig_b, kind}]."""
    ta, tb = tokens(pa), tokens(pb)
    sm = difflib.SequenceMatcher(None, [t for t, _, _ in ta], [t for t, _, _ in tb], autojunk=False)
    ops = [list(op) for op in sm.get_opcodes()]
    merged = []
    for op in ops:
        if op[0] == 'equal':
            merged.append(op)
            continue
        # A change, a word left alone and another change are one change ("about 40%" to "nearly 38%").
        if len(merged) >= 2 and merged[-1][0] == 'equal' and merged[-1][2] - merged[-1][1] <= 1 and merged[-2][0] != 'equal':
            gap = merged.pop()
            prev = merged[-1]
            merged[-1] = ['replace', prev[1], op[2], prev[3], op[4]]
            del gap
            continue
        merged.append(op)
    out = []

    def pos(tk, text, i):
        return tk[i][1] if i < len(tk) else len(text)
    for tag, i1, i2, j1, j2 in merged:
        if tag == 'equal':
            continue
        a0, a1 = pos(ta, pa, i1), (ta[i2 - 1][2] if i2 > i1 else pos(ta, pa, i1))
        b0, b1 = pos(tb, pb, j1), (tb[j2 - 1][2] if j2 > j1 else pos(tb, pb, j1))
        # The phrase it sits in: up to two tokens either side, so the same phrase can be found elsewhere.
        c1, c2 = max(0, i1 - 2), min(len(ta), i2 + 2)
        d1, d2 = max(0, j1 - 2), min(len(tb), j2 + 2)
        region_a = pa[pos(ta, pa, c1):(ta[c2 - 1][2] if c2 > c1 else a1)]
        region_b = pb[pos(tb, pb, d1):(tb[d2 - 1][2] if d2 > d1 else b1)]
        fa = [f for f in figures(pa) if f['start'] < max(a1, a0 + 1) and f['end'] > a0]
        fb = [f for f in figures(pb) if f['start'] < max(b1, b0 + 1) and f['end'] > b0]
        frm, to = pa[a0:a1], pb[b0:b1]
        out.append({'from': frm, 'to': to, 'region_a': region_a, 'region_b': region_b, 'sentence': sentence_at(pa, a0),
                    'fig_a': fa[0] if len(fa) == 1 else None, 'fig_b': fb[0] if len(fb) == 1 else None,
                    'near': neighbours(pa, fa[0]['start'], fa[0]['end']) if len(fa) == 1 else None,
                    'kind': classify(frm, to, pa, pb), 'excerpt': excerpt(pb, b0, b1)})
    return out


def changes_of(base, edited):
    """Every change between the words on the board and his saved words, paragraph by paragraph."""
    a, b = paragraphs(base), paragraphs(edited)
    sm = difflib.SequenceMatcher(None, [p.strip() for p in a], [p.strip() for p in b], autojunk=False)
    out, dropped, added = [], [], []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal':
            continue
        olds, news = list(range(i1, i2)), list(range(j1, j2))
        if tag == 'replace':
            # Pair each old paragraph with the most alike new one; a pair is edited, the rest added or taken out.
            for i in list(olds):
                best = max(news, key=lambda j: difflib.SequenceMatcher(None, a[i], b[j]).ratio(), default=None)
                if best is not None and difflib.SequenceMatcher(None, a[i], b[best]).ratio() >= 0.5:
                    out += word_changes(a[i], b[best])
                    olds.remove(i)
                    news.remove(best)
        dropped += [a[i].strip() for i in olds]
        added += [b[j].strip() for j in news]
    for p in dropped:
        moved = p in added
        if moved:
            added.remove(p)
        out.append({'from': p[:600], 'to': '' if not moved else p[:600] + ' (moved)', 'region_a': '', 'region_b': '',
                    'sentence': '', 'fig_a': None, 'fig_b': None, 'kind': 'structure', 'excerpt': p[:180]})
    for p in added:
        out.append({'from': '', 'to': p[:600], 'region_a': '', 'region_b': '', 'sentence': '', 'fig_a': None, 'fig_b': None,
                    'kind': 'structure', 'excerpt': p[:180]})
    return out


# ------------------------------------------------------------------ carrying one change into one draft

def phrase_pattern(region):
    parts = []
    for i, (t, s, e) in enumerate(tokens(region)):
        if i:
            prev = tokens(region)[i - 1]
            parts.append(r'\s+' if region[prev[2]:s].strip() == '' and region[prev[2]:s] else r'\s*')
        parts.append(re.escape(t).replace("'", "['’]").replace('’', "['’]"))
    return re.compile(''.join(parts), re.I)


def matches_in(change, text, skip=None):
    """Where a change applies in a draft's text: [(start, end, new text, sentence, contextual)]. skip: a span to leave."""
    found = []
    fa, fb = change['fig_a'], change['fig_b']
    if change['kind'] == 'number_fact' and fa and fb and not same_figure(fa, fb):
        for f in figures(text):
            if not same_figure(f, fa) or (skip and f['start'] < skip[1] and f['end'] > skip[0]):
                continue
            sent = sentence_at(text, f['start'])
            found.append((f['start'], f['end'], restyle(f, fb), sent, same_quantity(change.get('near'), change['sentence'], text, f)))
        return found
    region_a, region_b = change['region_a'], change['region_b']
    if len([w for w in words(region_a) if w not in STOP]) < 2 or len(words(region_a)) < 3 or region_a == region_b:
        return []  # too short to be the same phrase anywhere else
    for m in phrase_pattern(region_a).finditer(text):
        if skip and m.start() < skip[1] and m.end() > skip[0]:
            continue
        new = region_b
        if m.group(0)[:1].isupper() and new[:1].islower():
            new = new[0].upper() + new[1:]
        elif m.group(0)[:1].islower() and new[:1].isupper() and region_a[:1].isupper():
            new = new[0].lower() + new[1:]
        found.append((m.start(), m.end(), new, sentence_at(text, m.start()), True))
    return found


# ------------------------------------------------------------------ the drafts, the edits and the run

def read_reviews(values):
    """{day: [{slug, label, path, text}]} from --review DAY=LABEL|PATH, as week_board.py reads them."""
    out = {}
    for v in values or []:
        k, sep, rest = v.partition('=')
        day = DAY_KEYS.get(k.strip().lower())
        label, bar, path = rest.partition('|')
        if not (sep and day and bar and path.strip()):
            raise SweepError(f'--review {v}: give DAY=LABEL|PATH, e.g. mon=Article|docs/plans/x.md')
        p = Path(path.strip())
        try:
            text = p.read_text(encoding='utf-8').strip()
        except OSError as error:
            raise SweepError(f'--review {v}: cannot read {p}: {error.strerror}')
        out.setdefault(day, []).append({'slug': slug_of(label), 'label': label.strip(), 'path': p, 'text': text, 'day': day})
    return out


HIS = 'Krish'  # the board API's updated_by for the access-cookie writer (apps/control-plane/api/board/_contracts.ts actor())


def read_edits(path):
    """({doc id: body}, [what was left out]) from the saved answer of board_web.py read WEEK edits.

    Only his saves count: a document whose updated_by is not Krish (the access-cookie writer) is left out and named, so a
    save written with the operator key is never relayed as his words. A file that does not say who wrote each document
    (a bare {id: body}, or rows with no updated_by) gives nothing to sweep."""
    try:
        data = json.loads(Path(path).read_text(encoding='utf-8'))
    except (OSError, ValueError) as error:
        raise SweepError(f'--edits {path}: cannot read it as JSON ({error})')
    rows = data.get('documents') if isinstance(data, dict) and 'documents' in data else data
    if isinstance(rows, dict):
        rows = [{'id': k, 'body': v} for k, v in rows.items()]
    if not isinstance(rows, list):
        raise SweepError(f'--edits {path}: give the saved answer of board_web.py read WEEK edits')
    kept, left = {}, []
    for r in rows:
        if not (isinstance(r, dict) and isinstance(r.get('id'), str)):
            continue
        if r.get('updated_by') != HIS:
            left.append(f'{r["id"]}: written by {r.get("updated_by") or "nobody named"}, not Krish; not relayed as his')
            continue
        kept[r['id']] = r.get('body') or {}
    return kept, left


def is_script(d):
    return 'script' in d['label'].lower() or story_check.cut_of(d['label']) in ('long', 'short', 'feature', 'deep')


def cut_of(d):
    return story_check.cut_of(d['label']) or story_check.cut_of(d['path'].name)


def as_recorded(cut):
    """A cut as the recordings name it: a deep cut is the long one (the five-minute script, story_check's "deep")."""
    return 'long' if cut == 'deep' else cut


def recorded_cuts(args):
    """{day: {cut}} he has recorded: --recorded DAY=CUT, and the recordings on a saved making record (--making DAY=PATH)."""
    out = {}
    for v in args.recorded or []:
        k, _, cut = v.partition('=')
        day = DAY_KEYS.get(k.strip().lower())
        if not day or cut.strip() not in ('long', 'short', 'feature', 'deep'):
            raise SweepError(f'--recorded {v}: give DAY=CUT, CUT long, short or feature')
        out.setdefault(day, set()).add(as_recorded(cut.strip()))
    for v in args.making or []:
        k, _, path = v.partition('=')
        day = DAY_KEYS.get(k.strip().lower())
        try:
            data = json.loads(Path(path).read_text(encoding='utf-8'))
        except (OSError, ValueError) as error:
            raise SweepError(f'--making {v}: cannot read it ({error})')
        making = data.get('making') if isinstance(data, dict) and isinstance(data.get('making'), dict) else data
        for rec in (making or {}).get('recordings') or []:
            if isinstance(rec, dict) and rec.get('cut'):
                out.setdefault(day, set()).add(as_recorded(rec['cut']))
    return out


def gate(d, text):
    """What the gate for this draft says about these words: {check, ok, problems}, or None for a draft with no gate."""
    if is_script(d):
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp) / d['path'].name
            f.write_text(text + '\n', encoding='utf-8')
            found = story_check.check_file(str(f), cut_of(d))
        return {'check': 'story_check', 'ok': not found, 'problems': [str(x) for x in found][:10]}
    if 'article' in d['label'].lower():
        r = voice_check.check(text)
        ok = r['score'] <= voice_check.MAX_SCORE
        return {'check': 'voice_check', 'ok': ok,
                'problems': [] if ok else [f"voice score {r['score']} over the bar of {voice_check.MAX_SCORE}"]
                + [f"{f['habit']}: {f['where']}" for f in r['findings'][:6]]}
    return None


def sweep(day, drafts, edits, pieces=None, recorded=None, week=None):
    """The sweep of one day's saved edits: (result for the board and the ledger, {path: new text})."""
    pieces, recorded = pieces or {}, recorded or {}
    order = [k for k, _ in DAYS]
    mine = drafts.get(day) or []
    later = [d for k in order[order.index(day) + 1:] for d in drafts.get(k) or []]
    texts = {str(d['path']): d['text'] for k in drafts for d in drafts[k]}
    by_path = {str(d['path']): d for k in drafts for d in drafts[k]}
    also, tips, held, notes, ledger, done = [], [], [], [], [], []
    seen_held = set()

    def where(d):
        return f'{DAY_NAME[d["day"]]}, {d["label"]}'

    def held_why(d):
        """Why a script is left alone: it is recorded, or that day has takes and its cut cannot be told. None: free."""
        cuts = {as_recorded(c) for c in recorded.get(d['day'], set())}
        if not (is_script(d) and cuts):
            return None
        cut = as_recorded(cut_of(d))
        if cut is None:
            return ('you have recordings that day and I cannot tell which cut this script is, so it is left alone '
                    'in case its take would stop counting')
        if cut in cuts:
            return f'you have recorded it; changing it would make your {cut} take stop counting'
        return None

    def is_recorded(d):
        return held_why(d) is not None
    for d in mine:
        rid = f'{day}-{d["slug"]}'
        body = edits.get(rid)
        if not body or not isinstance(body.get('text'), str):
            continue
        saved, base = body['text'].strip(), d['text']
        if saved == base:
            done.append({'id': rid, 'state': 'already in the words', 'at': body.get('at')})
            continue
        if body.get('base_sha256') and body['base_sha256'] != sha(base):
            notes.append(f'{rid}: saved on words that have changed since ({body.get("at")}); read it with board_web.py and fold it '
                         'in by hand, then build again')
            done.append({'id': rid, 'state': 'made on older words', 'at': body.get('at')})
            continue
        if not body.get('base_sha256'):
            notes.append(f'{rid}: an older save with no base_sha256; diffed against the words in {d["path"]}')
        changes = changes_of(base, saved)
        texts[str(d['path'])] = saved  # his own words, first
        if is_recorded(d):
            notes.append(f'{rid}: you changed the {cut_of(d) or "uncut"} script on a day with recordings; a take of the old words '
                         'stops counting once making.py scripts checks the new words')
        for c in changes:
            if c['kind'] == 'structure':
                continue  # a paragraph added, taken out or moved is his, here; it is not carried by rule
            applied_kind = c['kind'] in ('number_fact', 'claim')
            # Elsewhere in the draft he edited, then every other draft of the piece, then later days' drafts.
            for t in [d] + [x for x in mine if x is not d] + later:
                key = str(t['path'])
                text = texts[key]
                skip = None
                if t is d:
                    at = text.find(c['region_b'] or c['to']) if (c['region_b'] or c['to']) else -1
                    skip = (at, at + len(c['region_b'] or c['to'])) if at >= 0 else None
                hits = matches_in(c, text, skip)
                for start, end, new, sent, contextual in sorted(hits, key=lambda h: -h[0]):
                    old = text[start:end]
                    if old == new:
                        continue
                    entry = {'where': where(t), 'kind': c['kind'], 'from': old, 'to': new,
                             'context': excerpt(text[:start] + new + text[end:], start, start + len(new)),
                             'undo': {'path': key, 'before': text[max(0, start - 40):start], 'after': text[end:end + 40]}}
                    if not from_his_edit(new, saved):
                        notes.append(f'{rid}: "{new}" for "{old}" in {where(t)} would put a number his edit does not hold; '
                                     'left alone')
                        continue
                    if is_recorded(t):
                        k = (key, old, new)
                        if k not in seen_held:
                            seen_held.add(k)
                            held.append({'where': where(t), 'why': held_why(t), 'from': old, 'to': new})
                        continue
                    if applied_kind and contextual:
                        text = text[:start] + new + text[end:]
                        also.append(entry)
                    else:
                        tips.append(entry)
                texts[key] = text
        kinds = [c['kind'] for c in changes]
        main = next((k for k in KINDS if k in kinds), 'wording')
        piece = pieces.get(day)
        if piece:
            ledger.append({
                'idempotency_key': str(uuid.uuid5(LEDGER_NS, f'{week}:{rid}:{sha(saved)}')),
                'subject_table': 'content_ideas', 'subject_id': piece,
                'artifact_kind': 'script' if is_script(d) else 'draft', 'action': 'manual_edit',
                'surface': 'publish_board', 'client': 'claude_code', 'decided_by': 'Krish',
                'before_hash': sha(base), 'after_hash': sha(saved), 'chars_before': len(base), 'chars_after': len(saved),
                'reason_code': main,
                'delta_features': [{'kind': c['kind'], 'from': c['from'][:120], 'to': c['to'][:120]} for c in changes][:50],
            })
        else:
            notes.append(f'{rid}: no piece id for {DAY_NAME[day]} (--piece {day}=UUID), so no ledger row')
        done.append({'id': rid, 'state': 'swept', 'at': body.get('at'), 'kinds': sorted(set(kinds), key=KINDS.index)})
    for n, e in enumerate(also, 1):
        e['id'] = f's{n}'
    for n, e in enumerate(tips, 1):
        e['id'] = f't{n}'
    gates = []
    for key, text in texts.items():
        d = by_path[key]
        if text != d['text']:
            g = gate(d, text)
            if g:
                gates.append({'where': where(d), **g})
    result = {'day': day, 'piece_id': pieces.get(day), 'swept_at': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
              'also_changed': also, 'suggestions': tips, 'held': held, 'gates': gates, 'ledger': ledger,
              'edits': done + [{'note': n} for n in notes]}
    changed = {key: text for key, text in texts.items() if text != by_path[key]['text']}
    return result, changed


def write_texts(changed):
    for key, text in changed.items():
        Path(key).write_text(text + '\n', encoding='utf-8')


def one_change(sweep_path, cid, reverse, apply):
    """His Undo (reverse: put the old words back) or his Change it too (a suggestion made), on one change by its id."""
    data = json.loads(Path(sweep_path).read_text(encoding='utf-8'))
    pool = data.get('also_changed' if reverse else 'suggestions') or []
    c = next((x for x in pool if x.get('id') == cid), None)
    if not c or not isinstance(c.get('undo'), dict):
        raise SweepError(f'{sweep_path}: no {"carried change" if reverse else "suggestion"} {cid!r} with its place recorded')
    path = Path(c['undo']['path'])
    text = path.read_text(encoding='utf-8').strip()
    now, then = (c['to'], c['from']) if reverse else (c['from'], c['to'])
    pre, post = c['undo'].get('before', ''), c['undo'].get('after', '')
    at = text.find(pre + now + post)
    if at >= 0:
        new = text[:at] + pre + then + post + text[at + len(pre + now + post):]
    elif text.count(now) == 1:
        new = text.replace(now, then, 1)
    else:
        raise SweepError(f'{cid}: "{now}" is no longer where it was in {path}; change it by hand')
    if apply:
        path.write_text(new + '\n', encoding='utf-8')
        pool.remove(c)
        if not reverse:
            data.setdefault('also_changed', []).append(c)
        Path(sweep_path).write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    return f'{"put back" if reverse else "made"} {cid} in {path}: "{now}" to "{then}"' + ('' if apply else ' (dry run: give --apply)')


def post_ledger(rows, call=None):
    """Each row to POST /api/content-edits, relayed as his (decided_by Krish). A replay writes nothing twice."""
    import making
    call = call or making._engine_call
    said = []
    for row in rows:
        status, text = call('POST', '/api/content-edits', row)
        said.append(f'{row["idempotency_key"]}: HTTP {status}' + ('' if status == 200 else f' {str(text)[:160]}'))
    return said


# ------------------------------------------------------------------ self-test

def self_test():
    problems = []

    def check(name, ok):
        if not ok:
            problems.append(name)
    check('a figure is a number or fact', classify('40%', '38%', 'x', 'x') == 'number_fact')
    check('a date is a number or fact', classify('October', 'November', 'x', 'x') == 'number_fact')
    check('"will" to "may" is a claim', classify('will', 'may', 'x', 'x') == 'claim')
    check('a contraction is tone', classify('do not', "don't", 'x', 'x') == 'tone')
    check('an intensifier taken out is tone', classify('really ', '', 'x', 'x') == 'tone')
    check('an exclamation is tone', classify('.', '!', 'x', 'x') == 'tone')
    check('a heading changed is structure', classify('Why', 'How', '## Why it matters', '## How it matters') == 'structure')
    check('anything else is wording', classify('firms', 'companies', 'x', 'x') == 'wording')
    check('"one" alone is not a figure', classify('no one', 'nobody', 'x', 'x') == 'claim')
    check('number words read', number_value('forty-two') == 42 and number_value('three hundred') == 300 and to_words(38) == 'thirty-eight')
    check('a paragraph added is structure', [c['kind'] for c in changes_of('One.\n\nTwo.', 'One.\n\nTwo.\n\nThree is new here.')] == ['structure'])
    check('a paragraph moved is one structure change', [c['kind'] for c in changes_of('A first.\n\nB second.', 'B second.\n\nA first.')] == ['structure'])
    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp)
        files = {
            'article.md': '# Who pays\n\nAbout 40% of firms now pay for AI pictures. That is a big shift.\n\nThe tools are really cheap now.',
            'long.md': 'Here is the thing. Forty percent of firms now pay for AI pictures. The tools are really cheap now.\n\n'
                       'Last year 40% of buyers said no to it.',
            'short.md': 'About 40 percent of firms now pay for AI pictures.',
            'wed.md': 'On Monday we saw 40% of firms now pay for pictures.',
        }
        for name, text in files.items():
            (t / name).write_text(text + '\n', encoding='utf-8')
        reviews = read_reviews([f'mon=Article|{t / "article.md"}', f'mon=Five-minute script|{t / "long.md"}',
                                f'mon=90-second script|{t / "short.md"}', f'wed=Article|{t / "wed.md"}'])
        base = reviews['mon'][0]['text']
        saved = base.replace('About 40% of firms', 'About 38% of firms').replace('really cheap', 'cheap')
        edits = {'mon-article': {'text': saved, 'day': 'mon', 'item': 'article', 'base_sha256': sha(base), 'at': '2026-10-26T07:00:00Z'}}
        piece = '11111111-2222-4333-8444-555555555555'
        result, changed = sweep('mon', reviews, edits, {'mon': piece}, {'mon': {'short'}}, '2026-10-26')
        long_new = changed.get(str(t / 'long.md'), '')
        check('the number is carried into the long script, in its own words', 'Thirty-eight percent of firms' in long_new)
        check('the same number in another sentence is not changed', 'Last year 40% of buyers' in long_new)
        check('a later piece in draft gets the number too', '38% of firms' in changed.get(str(t / 'wed.md'), ''))
        check('the recorded short script is left alone and listed', str(t / 'short.md') not in changed
              and any('recorded' in h['why'] and h['where'] == 'Monday, 90-second script' for h in result['held']))
        check('his own words are written to his draft', changed.get(str(t / 'article.md')) == saved)
        check('each carried change is listed with where it is', {e['where'] for e in result['also_changed']}
              == {'Monday, Five-minute script', 'Wednesday, Article'} and all(e['kind'] == 'number_fact' for e in result['also_changed']))
        check('the tone change is only suggested elsewhere', any(e['kind'] == 'tone' and e['where'] == 'Monday, Five-minute script'
                                                                 for e in result['suggestions'])
              and 'really cheap' in long_new)
        check('one ledger row for the save: his, on the board, with its main class', len(result['ledger']) == 1
              and result['ledger'][0]['reason_code'] == 'number_fact' and result['ledger'][0]['surface'] == 'publish_board'
              and result['ledger'][0]['decided_by'] == 'Krish' and result['ledger'][0]['subject_id'] == piece)
        again, _ = sweep('mon', reviews, edits, {'mon': piece}, {'mon': {'short'}}, '2026-10-26')
        check('run twice, the ledger row is the same row', again['ledger'][0]['idempotency_key'] == result['ledger'][0]['idempotency_key'])
        check('the gates ran on what changed', {g['where'] for g in result['gates']} >= {'Monday, Five-minute script', 'Monday, Article'})
        sys.path.insert(0, str(HERE))
        import week_board
        try:
            week_board.read_sweep(json.loads(json.dumps(result)))
            check('the board takes the sweep as written', True)
        except week_board.BoardError as error:
            check(f'the board takes the sweep as written ({error})', False)
        stale = {'mon-article': dict(edits['mon-article'], base_sha256='0' * 64)}
        r2, c2 = sweep('mon', reviews, stale, {'mon': piece}, {}, '2026-10-26')
        check('a save on older words is listed, never guessed', not c2 and not r2['also_changed'] and any('older' in str(x) for x in r2['edits']))
        write_texts(changed)
        out = t / 'sweep.json'
        out.write_text(json.dumps(result), encoding='utf-8')
        sid = next(e['id'] for e in result['also_changed'] if e['where'] == 'Monday, Five-minute script')
        one_change(out, sid, True, True)
        check('Undo puts the old words back in that draft', 'Forty percent of firms' in (t / 'long.md').read_text(encoding='utf-8'))
        tid = next(e['id'] for e in result['suggestions'] if e['kind'] == 'tone')
        one_change(out, tid, False, True)
        check('Change it too makes the suggestion', 'The tools are cheap now' in (t / 'long.md').read_text(encoding='utf-8'))
        rows = []
        post_ledger(result['ledger'], lambda m, p, b: rows.append((m, p, b)) or (200, '{"ok":true}'))
        check('the ledger rows go to POST /api/content-edits', rows and rows[0][:2] == ('POST', '/api/content-edits'))

        # A number moves only where it counts the same thing (review, 2026-10-21: "About 40% of firms" to 38% had also
        # changed "Only about 40 percent of staff trust the results", which shares nothing with it but "about").
        (t / 'a2.md').write_text('About 40% of firms now pay for AI pictures.\n', encoding='utf-8')
        (t / 'l2.md').write_text('Forty percent of firms now pay for AI pictures. Only about 40 percent of staff trust the '
                                 'results. Staff at 40% of companies now pay for AI pictures, like firms.\n', encoding='utf-8')
        r3 = read_reviews([f'mon=Article|{t / "a2.md"}', f'mon=Five-minute script|{t / "l2.md"}'])
        b3 = r3['mon'][0]['text']
        e3 = {'mon-article': {'text': b3.replace('40%', '38%'), 'base_sha256': sha(b3)}}
        res3, ch3 = sweep('mon', r3, e3, {}, {}, '2026-10-26')
        l3 = ch3.get(str(t / 'l2.md'), '')
        check('a number moves where the same noun sits next to it ("of firms")', 'Thirty-eight percent of firms' in l3)
        check('a number never moves into a sentence that shares only a claim word ("about 40 percent of staff")',
              'Only about 40 percent of staff' in l3 and any(e['from'] == '40 percent' and 'staff' in e['context']
                                                              for e in res3['suggestions']))
        check('another noun next to the figure is another quantity, whatever else the sentences share',
              '40% of companies' in l3)
        check('every number put in a draft came from his edit', all(from_his_edit(e['to'], e3['mon-article']['text'])
                                                                   for e in res3['also_changed']))
        check('a number his edit does not hold is refused', not from_his_edit('41 percent', 'About 38% of firms')
              and from_his_edit('thirty-eight percent', 'About 38% of firms'))

        # On a day with recordings, a script whose cut cannot be told is held; a deep cut is the long one.
        (t / 'dl.md').write_text('Forty percent of firms now pay for AI pictures.\n', encoding='utf-8')
        (t / 'un.md').write_text('Forty percent of firms now pay for AI pictures.\n', encoding='utf-8')
        r4 = read_reviews([f'mon=Article|{t / "a2.md"}', f'mon=Deep-cut script|{t / "dl.md"}', f'mon=Script|{t / "un.md"}'])
        res4, ch4 = sweep('mon', r4, e3, {}, {'mon': {'long'}}, '2026-10-26')
        check('a deep-cut script counts as the recorded long cut and is held', str(t / 'dl.md') not in ch4
              and any(h['where'] == 'Monday, Deep-cut script' and 'recorded' in h['why'] for h in res4['held']))
        check('a script of unknown cut on a day with recordings is held, never changed', str(t / 'un.md') not in ch4
              and any(h['where'] == 'Monday, Script' and 'cannot tell' in h['why'] for h in res4['held']))
        res5, ch5 = sweep('mon', r4, e3, {}, {}, '2026-10-26')
        check('with no recordings that day the same scripts are changed', str(t / 'un.md') in ch5 and str(t / 'dl.md') in ch5)
        args = argparse.Namespace(recorded=['mon=deep'], making=None)
        check('a recorded deep cut is the long one', recorded_cuts(args) == {'mon': {'long'}})

        # Only his saves count: the board stamps his access-cookie writes "Krish"; anything else is left out.
        saved_edits = t / 'edits.json'
        saved_edits.write_text(json.dumps({'documents': [
            {'id': 'mon-article', 'body': e3['mon-article'], 'updated_by': 'Krish'},
            {'id': 'mon-five-minute-script', 'body': {'text': 'x'}, 'updated_by': 'engine_operator'},
            {'id': 'wed-article', 'body': {'text': 'y'}}]}), encoding='utf-8')
        kept, left = read_edits(saved_edits)
        check('only documents Krish wrote are relayed', set(kept) == {'mon-article'} and len(left) == 2
              and any('engine_operator' in x for x in left))
        bare = t / 'bare.json'
        bare.write_text(json.dumps({'mon-article': e3['mon-article']}), encoding='utf-8')
        check('a file that does not say who wrote it gives nothing to sweep', read_edits(bare)[0] == {})
    for p in problems:
        print(f'FAIL {p}')
    print(f'edit sweep self-test {"FAILED" if problems else "passed"}')
    return 1 if problems else 0


# ------------------------------------------------------------------ command line

def main(argv=None):
    ap = argparse.ArgumentParser(description='Carry Krish\'s saved board edits into every other draft, and classify each change.')
    ap.add_argument('target', nargs='?', help='the day whose edits to sweep (mon, wed, fri), or its piece id with --piece')
    ap.add_argument('--week', help='the Monday, YYYY-MM-DD')
    ap.add_argument('--edits', help='the saved answer of board_web.py read WEEK edits')
    ap.add_argument('--review', action='append', metavar='DAY=LABEL|PATH', help='each draft, as week_board.py takes it')
    ap.add_argument('--piece', action='append', metavar='DAY=UUID', help='the piece a day holds (for the ledger rows)')
    ap.add_argument('--recorded', action='append', metavar='DAY=CUT', help='a cut he has recorded: never changed, only listed')
    ap.add_argument('--making', action='append', metavar='DAY=PATH', help='a saved making record: its recordings are recorded cuts')
    ap.add_argument('--apply', action='store_true', help='write the changed drafts (without it only the sweep file is written)')
    ap.add_argument('--out', help='the sweep file (default docs/plans/<Monday>-week/<day>-sweep.json)')
    ap.add_argument('--post-ledger', action='store_true', help='POST each ledger row to /api/content-edits, relayed as his')
    ap.add_argument('--undo', nargs=2, metavar=('SWEEP', 'ID'), help='put one carried change back (his Undo on the board)')
    ap.add_argument('--accept', nargs=2, metavar=('SWEEP', 'ID'), help='make one suggestion too (his Change it too on the board)')
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args(argv)
    try:
        if a.self_test:
            return self_test()
        if a.undo or a.accept:
            print(one_change(*(a.undo or a.accept), bool(a.undo), a.apply))
            return 0
        if not (a.target and a.week and a.edits and a.review):
            ap.error('give the day (or piece), --week, --edits and every --review')
        monday = date.fromisoformat(a.week)
        if monday.weekday() != 0:
            raise SweepError(f'--week {a.week} is not a Monday')
        pieces = {}
        for v in a.piece or []:
            k, _, p = v.partition('=')
            if not (DAY_KEYS.get(k.strip().lower()) and UUID.match(p.strip())):
                raise SweepError(f'--piece {v}: give DAY=UUID')
            pieces[DAY_KEYS[k.strip().lower()]] = p.strip()
        day = DAY_KEYS.get(a.target.strip().lower()) or next((k for k, p in pieces.items() if p == a.target.strip()), None)
        if not day:
            raise SweepError(f'{a.target}: not a day (mon, wed, fri), nor a piece named with --piece')
        drafts = read_reviews(a.review)
        if day not in drafts:
            raise SweepError(f'no --review for {DAY_NAME[day]}: give every draft of the day')
        edits, left = read_edits(a.edits)
        result, changed = sweep(day, drafts, edits, pieces, recorded_cuts(a), monday.isoformat())
        result['edits'] += [{'note': n} for n in left]
        out = Path(a.out) if a.out else ROOT / 'docs' / 'plans' / f'{monday.isoformat()}-week' / f'{day}-sweep.json'
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(result, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
        if a.apply:
            write_texts(changed)
        print(f'{out}: {len(result["also_changed"])} carried, {len(result["suggestions"])} suggested, {len(result["held"])} left alone '
              f'(recorded), {len(result["ledger"])} ledger row(s)' + ('' if a.apply else '; dry run, nothing else written (give --apply)'))
        for e in result['edits']:
            print(f'  {e.get("id", "")} {e.get("state", "")} {", ".join(e.get("kinds") or [])}{e.get("note", "")}'.rstrip())
        for g in result['gates']:
            print(f'  {"passes" if g["ok"] else "FAILS"} {g["check"]}: {g["where"]}' + ('' if g['ok'] else ': ' + '; '.join(g['problems'][:3])))
        if a.post_ledger:
            for line in post_ledger(result['ledger']):
                print(f'  ledger {line}')
        print(f'then: week_board.py ... --sweep {day}={out}')
        return 0 if all(g['ok'] for g in result['gates']) else 1
    except SweepError as error:
        print(f'edit sweep: {error}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
