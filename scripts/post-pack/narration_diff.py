#!/usr/bin/env python3
"""narration_diff: what Krish actually said on camera, set against the script he read.

Krish, 2026-10-17, after his 14-minute Friday take: "I also need you to list
everything about my narration that deviated from the script, down to the fact
that I talk in, let's say, about 30% of that. Thats how script should be written
in the future."

So every take is lined up with the script it was read from, word by word, and
every difference is listed: what he added, what he skipped, what he said his own
way, and how (a filler, a hedge, an aside of his own, a number said differently,
a restart). The rates (how much of what he says is his own, how often he hedges,
how he starts a sentence) are what the next script is written to, and
`patterns` sets several takes side by side so a habit is told from a one-off.

    python scripts/post-pack/narration_diff.py SCRIPT WORDS.json [--md OUT.md] [--json OUT.json] [--label NAME]
    python scripts/post-pack/narration_diff.py patterns A.json B.json ... [--md OUT.md]
    python scripts/post-pack/narration_diff.py ledger REPORT.json --cut short|long|deep|feature --date YYYY-MM-DD [--piece ID]
                                     keep the take's rates in config/narration-ledger.json, which
                                     story_check reads to say how long a script will run when he says it
    python scripts/post-pack/narration_diff.py --self-test

SCRIPT is the text he read (a Teleprompter script, or a draft whose spoken lines
story_check.spoken_paragraphs finds). WORDS.json is the take heard with word
timings (make.py's words file: {"words": [{"w", "s", "e"}]}).

Transcriber habits are not his: "$40 billion" and "forty billion dollars", "5 .5"
and "5.5", "chat GPT" and "ChatGPT", "realize" and "realise" are the same words
here. Everything else he said differently is listed.
"""
import argparse
import difflib
import json
import re
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / 'quick-edit'))
import spelling  # noqa: E402  British and US spellings folded together
import story_check  # noqa: E402  the spoken lines of a draft script

UNITS = {w: i for i, w in enumerate('zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen '
                                    'fifteen sixteen seventeen eighteen nineteen'.split())}
TENS = {'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90}
SCALES = {'hundred', 'thousand', 'million', 'billion', 'trillion'}
# The words he puts in that carry no content: how he talks, not what he says.
FILLERS = {'so', 'now', 'and', 'but', 'see', 'well', 'right', 'okay', 'ok', 'actually', 'really', 'just', 'like', 'um', 'uh',
           'look', 'yeah', 'you', 'know', 'basically', 'obviously', 'honestly', 'literally', 'then', 'also', 'even', 'still',
           'kind', 'of', 'sort', 'pretty', 'quite', 'a', 'bit', 'little', 'the', 'that', 'this', 'its', "it's", 'is', 'i', 'mean'}
HEDGES = ['i think', 'i reckon', 'i guess', 'i feel like', 'i suppose', 'in my opinion', 'kind of', 'sort of', 'a little bit',
          'a bit', 'probably', 'maybe', 'perhaps', 'pretty', 'quite', 'fairly', "let's say", "i'd say", 'roughly', 'about',
          'more or less', 'i would say', 'my guess', 'i believe']
INTENSIFIERS = ['really', 'very', 'actually', 'definitely', 'absolutely', 'obviously', 'literally', 'super', 'hugely', 'massively',
                'totally', 'completely', 'genuinely', 'honestly', 'incredibly', 'seriously']
SIGNPOSTS = ['so', 'now', 'firstly', 'secondly', 'first', 'okay', 'right', 'look', 'see', 'well', "let's", 'let me',
             "here's the thing", 'anyway', 'basically']
VIEWER = ['you', 'your', "you're", "you'll", "you've", 'we', 'us', 'our', "we're", "let's"]
CONTRACT = {"it's": 'it is', "that's": 'that is', "there's": 'there is', "here's": 'here is', "what's": 'what is',
            "don't": 'do not', "doesn't": 'does not', "didn't": 'did not', "isn't": 'is not', "aren't": 'are not',
            "wasn't": 'was not', "won't": 'will not', "can't": 'cannot', "couldn't": 'could not', "wouldn't": 'would not',
            "shouldn't": 'should not', "i'm": 'i am', "i've": 'i have', "i'll": 'i will', "i'd": 'i would', "you're": 'you are',
            "you'll": 'you will', "you've": 'you have', "we're": 'we are', "we've": 'we have', "they're": 'they are',
            "they'd": 'they would', "let's": 'let us', "she's": 'she is', "he's": 'he is'}
CONTRACT = {k.replace("'", ''): v for k, v in CONTRACT.items()}
FILLERS = {f.replace("'", '') for f in FILLERS}
VIEWER = [v.replace("'", '') for v in VIEWER]
SIGNPOSTS = [x.replace("'", '') for x in SIGNPOSTS]
HEDGES = [h.replace("'", '') for h in HEDGES]
SENTENCE_END = re.compile(r'[.!?]["\'’”)]*$')


# --------------------------------------------------------------------------- tokens

def canon(word):
    """A word as compared: lower case, letters and digits (a decimal point and
    % and $ kept), apostrophes straightened, British and US spellings folded."""
    w = word.strip().lower().replace('’', "'").replace('‘', "'")
    w = re.sub(r'(?<=\d)(st|nd|rd|th)$', '', w)  # "9th" is said as the 9 the script writes
    w = re.sub(r"(?<=\d)[.,](?=\d)", '\x00', w)
    w = re.sub(r"[^a-z0-9'%$\x00-]", '', w).replace('\x00', '.').strip("'-")
    if not w or re.search(r'\d', w) or w in UNITS or w in TENS or w in SCALES:
        return w
    # An apostrophe is never heard: "its" and "it's", "singers'" and "singer's" are the same sound.
    return spelling.fold(w).replace("'", '')


def number_words(tokens):
    """Runs of number words as one figure ("forty" -> "40", "two hundred" ->
    "200", "thirteen" -> "13"); scale words above a hundred kept as words, so
    "forty billion" and "$40 billion" meet as "40 billion"."""
    out, i = [], 0
    while i < len(tokens):
        t = tokens[i]
        if t['c'] in UNITS or t['c'] in TENS:
            n, j = 0, i
            while j < len(tokens) and (tokens[j]['c'] in UNITS or tokens[j]['c'] in TENS or tokens[j]['c'] == 'hundred'):
                c = tokens[j]['c']
                n = n * 100 if c == 'hundred' else n + (UNITS.get(c) if c in UNITS else TENS[c])
                j += 1
            out.append({**t, 'c': str(n), 'w': ' '.join(x['w'] for x in tokens[i:j]), 'e': tokens[j - 1].get('e', t.get('e'))})
            i = j
            continue
        out.append(t)
        i += 1
    return out


def expand(tokens):
    """$, % and the word pieces a transcriber splits off, put in one form:
    "$40" -> "40 ... dollar", "30%" -> "30 percent", "dollars" -> "dollar",
    "5" ".5" -> "5.5", "well" "-known" -> "well-known"."""
    merged = []
    for t in tokens:
        c = t['c']
        if merged and (re.match(r'^\.\d', c) and re.search(r'\d$', merged[-1]['c'])):
            merged[-1] = {**merged[-1], 'c': merged[-1]['c'] + c, 'w': merged[-1]['w'] + t['w'].strip(), 'e': t.get('e')}
            continue
        if merged and c.startswith('-') and len(c) > 1:
            merged[-1] = {**merged[-1], 'c': merged[-1]['c'] + c, 'w': merged[-1]['w'] + t['w'].strip(), 'e': t.get('e')}
            continue
        merged.append(t)
    out, owed = [], False
    for k, t in enumerate(merged):
        c = t['c'].replace('-', '')
        if not c:
            continue
        if c.startswith('$') and len(c) > 1:
            out.append({**t, 'c': c[1:]})
            owed = True
            nxt = merged[k + 1]['c'] if k + 1 < len(merged) else ''
            if nxt not in SCALES:
                out.append({**t, 'c': 'dollar', 'w': ''})
                owed = False
            continue
        if c.endswith('%') and len(c) > 1:
            out.append({**t, 'c': c[:-1]})
            out.append({**t, 'c': 'percent', 'w': ''})
            continue
        if c in ('dollars', 'dollar'):
            out.append({**t, 'c': 'dollar'})
            continue
        if c in ('per', ) and k + 1 < len(merged) and merged[k + 1]['c'] == 'cent':
            out.append({**t, 'c': 'percent'})
            continue
        if c == 'cent' and out and out[-1]['c'] == 'percent':
            continue
        if c == 'percent':
            out.append({**t, 'c': 'percent'})
            continue
        out.append({**t, 'c': c})
        if owed and c in SCALES:
            out.append({**t, 'c': 'dollar', 'w': ''})
            owed = False
    return out


def script_tokens(text):
    """The script's spoken words, each with its sentence number."""
    paragraphs = story_check.spoken_paragraphs(text) or [p for p in text.split('\n\n') if p.strip()]
    toks, sent = [], 0
    for para in paragraphs:
        for raw in para.split():
            for piece in re.split(r'(?<=[a-z])\.(?=[a-z])', raw):  # mind.the.gap is said as three words
                c = canon(piece)
                if c:
                    toks.append({'w': piece, 'c': c, 'sent': sent})
            if SENTENCE_END.search(raw):
                sent += 1
        sent += 1
    return expand(number_words(toks))


def spoken_tokens(words):
    raw = []
    for w in words:
        t = w['w'].strip()
        # The pieces a transcriber splits off: "5" ".5" is 5.5, "well" "-known" is well-known.
        if raw and ((re.match(r'^[.,]\d', t) and re.search(r'\d$', raw[-1]['w'])) or (re.match(r'^-[A-Za-z0-9]', t) and raw[-1]['w'])
                    or (t.startswith('%') and re.search(r'\d$', raw[-1]['w']))):
            raw[-1] = {**raw[-1], 'w': raw[-1]['w'] + t, 'e': w['e']}
            continue
        raw.append({'w': t, 's': w['s'], 'e': w['e']})
    toks = [{**w, 'c': canon(w['w'])} for w in raw]
    return expand(number_words([t for t in toks if t['c'] or t['w'].startswith(('-', '.'))]))


def join_split_names(spoken, script):
    """Two or three spoken pieces that make one script word ("chat" "gpt" for
    ChatGPT) put back as that word, so a transcriber's split is not a change."""
    vocab = {t['c'] for t in script if len(t['c']) >= 5}
    out, i = [], 0
    while i < len(spoken):
        hit = None
        for k in (3, 2):
            run = spoken[i:i + k]
            if len(run) == k and ''.join(t['c'] for t in run) in vocab:
                hit = ({**run[0], 'c': ''.join(t['c'] for t in run), 'w': ' '.join(t['w'] for t in run), 'e': run[-1]['e']}, k)
                break
        if hit:
            out.append(hit[0])
            i += hit[1]
        else:
            out.append(spoken[i])
            i += 1
    return out


# --------------------------------------------------------------------------- the diff

def blocks(a, b):
    """difflib's opcodes, with an equal run of one or two words between two
    changes folded into one change, so a rephrase reads as one difference."""
    ops = difflib.SequenceMatcher(None, [t['c'] for t in a], [t['c'] for t in b], autojunk=False).get_opcodes()
    out = []
    for op in ops:
        out.append(list(op))
    changed = True
    while changed:
        changed = False
        for k in range(1, len(out) - 1):
            tag, i1, i2, j1, j2 = out[k]
            if tag == 'equal' and max(i2 - i1, j2 - j1) <= 2 and out[k - 1][0] != 'equal' and out[k + 1][0] != 'equal':
                prev, nxt = out[k - 1], out[k + 1]
                out[k - 1:k + 2] = [['replace', prev[1], nxt[2], prev[3], nxt[4]]]
                changed = True
                break
    return [tuple(o) for o in out]


def has_phrase(words, phrase):
    w, p = ' ' + ' '.join(words) + ' ', ' ' + phrase + ' '
    return p in w


def tags_of(kind, said, read, before=(), after=()):
    """What kind of difference it is, from the words alone (and the words he
    said just before and after it, to tell a restart)."""
    s, r = [t['c'] for t in said], [t['c'] for t in read]
    b, a = [t['c'] for t in before], [t['c'] for t in after]
    added = [x for x in s if x not in r] if kind != 'insert' else s
    tags = []
    if kind == 'insert' and s and all(x in FILLERS for x in s):
        tags.append('filler')
    if any(has_phrase(s, h) and not has_phrase(r, h) for h in HEDGES):
        tags.append('hedge')
    if any(x in INTENSIFIERS for x in added):
        tags.append('intensifier')
    if s and s[0] in SIGNPOSTS and (not r or r[0] != s[0]):
        tags.append('signpost')
    if any(x in VIEWER for x in added):
        tags.append('to the viewer')
    exp = lambda xs: ' '.join(CONTRACT.get(x, x) for x in xs)
    if s and r and exp(s) == exp(r) and s != r:
        tags.append('contraction')
    nums = lambda xs: [x for x in xs if re.search(r'\d', x) or x in ('percent', 'dollar', 'third', 'half', 'quarter')]
    if nums(s) != nums(r):
        tags.append('number')
    starts_again = len(s) >= 2 and len(a) >= 2 and s[:2] == a[:2]
    said_again = len(s) >= 1 and len(b) >= len(s) and b[-len(s):] == s and kind == 'insert'
    if any(s[k] == s[k + 1] for k in range(len(s) - 1)) or any(s[k:k + 2] == s[k + 2:k + 4] for k in range(len(s) - 3)) \
            or 'sorry' in added or starts_again or said_again:
        tags.append('restart')
    content = [x for x in added if x not in FILLERS]
    if (kind == 'insert' and len(content) >= 4) or (kind == 'replace' and len(content) >= 6 and len(s) >= len(r) + 5):
        tags.append('aside')
    if kind == 'delete' and any(x not in FILLERS for x in r):
        tags.append('skip')
    if kind == 'replace' and not set(tags) & {'contraction', 'restart'}:
        tags.append('rephrase')
    return tags or [{'insert': 'addition', 'delete': 'dropped', 'replace': 'rephrase'}[kind]]


def diff(script_text, words):
    read = script_tokens(script_text)
    said = join_split_names(spoken_tokens(words), read)
    out = []
    for tag, i1, i2, j1, j2 in blocks(read, said):
        if tag == 'equal':
            continue
        r, s = read[i1:i2], said[j1:j2]
        at = s[0]['s'] if s else (said[j1]['s'] if j1 < len(said) else (said[-1]['e'] if said else 0.0))
        kind = {'insert': 'added', 'delete': 'skipped', 'replace': 'said differently'}[tag]
        out.append({'at': round(at, 2), 'kind': kind, 'tags': tags_of(tag, s, r, said[max(0, j1 - 4):j1], said[j2:j2 + 4]),
                    'script': ' '.join(t['w'] for t in r if t['w']).strip(), 'said': ' '.join(t['w'] for t in s if t['w']).strip(),
                    'script_words': len(r), 'said_words': len(s)})
    matched = sum(i2 - i1 for tag, i1, i2, j1, j2 in blocks(read, said) if tag == 'equal')
    return read, said, out, matched


# --------------------------------------------------------------------------- the rates

def sentence_starts(texts):
    firsts = Counter()
    for t in texts:
        m = re.match(r"\W*([A-Za-z']+)", t)
        if m:
            firsts[m.group(1).lower()] += 1
    return firsts


def spoken_sentences(words):
    out, cur = [], []
    for w in words:
        cur.append(w['w'].strip())
        if SENTENCE_END.search(w['w'].strip()):
            out.append(' '.join(cur))
            cur = []
    if cur:
        out.append(' '.join(cur))
    return out


def script_sentences(text):
    paragraphs = story_check.spoken_paragraphs(text) or [p for p in text.split('\n\n') if p.strip()]
    return [s for p in paragraphs for s in re.split(r'(?<=[.!?])\s+', p) if s.strip()]


def rates(script_text, words, read, said, devs, matched):
    secs = (words[-1]['e'] - words[0]['s']) if words else 0.0
    talk = sum(min(b['s'] - a['e'], 0.9) for a, b in zip(words, words[1:])) + sum(w['e'] - w['s'] for w in words)
    own = sum(d['said_words'] for d in devs)
    tag_count = Counter(t for d in devs for t in d['tags'])
    said_s, read_s = spoken_sentences(words), script_sentences(script_text)
    starts_said, starts_read = sentence_starts(said_s), sentence_starts(read_s)
    joiners = ('so', 'and', 'but', 'now', 'see')
    added_words = Counter(t for d in devs for t in re.findall(r"[a-z']+", d['said'].lower()))
    removed_words = Counter(t for d in devs for t in re.findall(r"[a-z']+", d['script'].lower()))
    mins = secs / 60 if secs else 1
    return {
        'script_words': len(read), 'said_words': len(said), 'word_for_word': matched,
        'said_more_pct': round(100 * (len(said) - len(read)) / max(1, len(read)), 1),
        'own_words_pct': round(100 * own / max(1, len(said)), 1),
        'script_kept_pct': round(100 * matched / max(1, len(read)), 1),
        'minutes': round(secs / 60, 2), 'words_a_minute': round(len(said) / mins, 1),
        'words_a_minute_talking': round(len(said) / max(1e-6, talk / 60), 1),
        'differences': len(devs), 'differences_a_minute': round(len(devs) / mins, 1),
        'tags': dict(tag_count.most_common()), 'tags_a_minute': {k: round(v / mins, 2) for k, v in tag_count.most_common()},
        'sentence_words_said': round(len(said) / max(1, len(said_s)), 1), 'sentence_words_script': round(len(read) / max(1, len(read_s)), 1),
        'sentences_starting_with_a_joiner_pct': {
            'said': round(100 * sum(starts_said[j] for j in joiners) / max(1, len(said_s)), 1),
            'script': round(100 * sum(starts_read[j] for j in joiners) / max(1, len(read_s)), 1)},
        'top_starts_said': starts_said.most_common(8),
        'top_words_added': [(w, n) for w, n in added_words.most_common(40) if w not in ('the', 'a', 'to', 'of', 'it', 'is', 'in', 'that')][:20],
        'top_words_dropped': [(w, n) for w, n in removed_words.most_common(40) if w not in ('the', 'a', 'to', 'of', 'it', 'is', 'in', 'that')][:15],
    }


def clock(t):
    return f'{int(t) // 60}:{t % 60:05.2f}'


# Krish, 2026-10-26: "they're not really slips as much as they are just me talking naturally", and "I'm pretty
# sure I said "I reckon," and you're mishearing it" (config/learnings.json, natural-speech-stays).
LESSON = ('- Read these differences as how he talks, never as slips: propose a cut only for a serious flaw (a wrong fact or a '
          'legal risk), only where it cuts without sounding clipped, and only after hearing it, because the transcriber mishears.')


def markdown(label, r, devs):
    lines = [f'# {label}: what he said against the script', '',
             f'- The script has {r["script_words"]} words; he said {r["said_words"]} ({r["said_more_pct"]:+}%), over {r["minutes"]} minutes '
             f'({r["words_a_minute"]} words a minute, {r["words_a_minute_talking"]} while talking).',
             f'- {r["own_words_pct"]}% of what he said is his own words, not the script\'s; {r["script_kept_pct"]}% of the script was said word for word.',
             f'- {r["differences"]} differences, {r["differences_a_minute"]} a minute.',
             f'- His sentences run {r["sentence_words_said"]} words on average (the script\'s {r["sentence_words_script"]}); '
             f'{r["sentences_starting_with_a_joiner_pct"]["said"]}% of them start with So, And, But, Now or See '
             f'(the script\'s {r["sentences_starting_with_a_joiner_pct"]["script"]}%).',
             '- By kind: ' + ', '.join(f'{k} {v}' for k, v in r['tags'].items()) + '.',
             '- The words he adds most: ' + ', '.join(f'"{w}" {n}' for w, n in r['top_words_added'][:15]) + '.',
             '- The script words he drops or changes most: ' + ', '.join(f'"{w}" {n}' for w, n in r['top_words_dropped'][:10]) + '.',
             LESSON,
             '', '## Every difference, in order', '', '| At | What | The script | He said |', '|---|---|---|---|']
    esc = lambda s: (s or '').replace('|', '\\|') or '·'
    for d in devs:
        lines.append(f'| {clock(d["at"])} | {d["kind"]}: {", ".join(d["tags"])} | {esc(d["script"])} | {esc(d["said"])} |')
    return '\n'.join(lines) + '\n'


def apply_fixes(words, pairs):
    """The take's words with a cut config's verified fixes for what the
    transcriber misheard (make.py "replacements": [heard run, fixed run]), so a
    mishearing is never counted as his: each heard run becomes the fixed words,
    sharing its time."""
    words = [dict(w) for w in words]
    for heard, fixed in pairs:
        h = [canon(x) for x in heard.split() if canon(x)]
        f = fixed.split()
        if not h or not f:
            continue
        i = 0
        while i + len(h) <= len(words):
            if [canon(w['w']) for w in words[i:i + len(h)]] == h:
                s0, e0 = words[i]['s'], words[i + len(h) - 1]['e']
                step = (e0 - s0) / len(f)
                tail = re.sub(r'^.*?([.,!?;:]*)$', r'\1', words[i + len(h) - 1]['w'])
                new = [{'w': ' ' + x + (tail if k == len(f) - 1 and not re.search(r'[.,!?;:]$', x) else ''), 's': round(s0 + k * step, 3),
                        'e': round(s0 + (k + 1) * step, 3)} for k, x in enumerate(f)]
                words[i:i + len(h)] = new
                i += len(new)
            else:
                i += 1
    return words


def run(script_path, words_path, label=None, fixes=None):
    text = Path(script_path).read_text(encoding='utf-8-sig')
    words = json.loads(Path(words_path).read_text(encoding='utf-8'))['words']
    if fixes:
        words = apply_fixes(words, fixes)
    read, said, devs, matched = diff(text, words)
    r = rates(text, words, read, said, devs, matched)
    return {'label': label or Path(words_path).stem, 'script': str(script_path), 'words': str(words_path), 'rates': r, 'differences': devs}


# --------------------------------------------------------------------------- across takes

PATTERN_ROWS = [
    ('Said more than the script (%)', lambda r: r['said_more_pct']),
    ('His own words, of all he said (%)', lambda r: r['own_words_pct']),
    ('Script said word for word (%)', lambda r: r['script_kept_pct']),
    ('Words a minute', lambda r: r['words_a_minute']),
    ('Differences a minute', lambda r: r['differences_a_minute']),
    ('Sentence length said / script', lambda r: f'{r["sentence_words_said"]} / {r["sentence_words_script"]}'),
    ('Sentences opening So/And/But/Now/See, said / script (%)',
     lambda r: f'{r["sentences_starting_with_a_joiner_pct"]["said"]} / {r["sentences_starting_with_a_joiner_pct"]["script"]}'),
] + [(f'{t} a minute', (lambda t: lambda r: r['tags_a_minute'].get(t, 0))(t)) for t in
     ('filler', 'hedge', 'intensifier', 'signpost', 'to the viewer', 'aside', 'rephrase', 'skip', 'number', 'contraction', 'restart')]


def patterns(paths):
    takes = [json.loads(Path(p).read_text(encoding='utf-8')) for p in paths]
    head = '| | ' + ' | '.join(t['label'] for t in takes) + ' |'
    lines = [head, '|' + '---|' * (len(takes) + 1)]
    for name, f in PATTERN_ROWS:
        lines.append(f'| {name} | ' + ' | '.join(str(f(t['rates'])) for t in takes) + ' |')
    added = Counter()
    for t in takes:
        for w, n in t['rates']['top_words_added']:
            added[w] += 1
    common = [w for w, n in added.most_common() if n >= max(2, (len(takes) + 1) // 2)]
    lines += ['', 'Words he adds in most takes (among each take\'s top 20): ' + ', '.join(f'"{w}"' for w in common[:20])]
    return '\n'.join(lines) + '\n'


# --------------------------------------------------------------------------- the ledger

LEDGER = HERE.parent.parent / 'config' / 'narration-ledger.json'
KEEP = ('script_words', 'said_words', 'said_more_pct', 'own_words_pct', 'script_kept_pct', 'minutes', 'words_a_minute',
        'words_a_minute_talking', 'sentence_words_said', 'sentence_words_script', 'sentences_starting_with_a_joiner_pct', 'tags_a_minute')


def ledger_add(report, cut, date, piece=None, path=None):
    """Keep one take's rates (replacing an earlier entry for the same take)."""
    path = Path(path or LEDGER)
    data = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {
        '_about': ('Every take Krish has recorded, set against the script he read (scripts/post-pack/narration_diff.py): how much he '
                   'adds, how fast he talks, how he opens his sentences. Krish, 2026-10-17: "I also need you to list everything about my '
                   'narration that deviated from the script ... Thats how script should be written in the future." story_check.py reads '
                   'it to say how long a script will run when he says it. Add a take with narration_diff.py ledger.'),
        'takes': []}
    entry = {'take': report['label'], 'cut': cut, 'date': date, **({'piece': piece} if piece else {}),
             **{k: report['rates'][k] for k in KEEP if k in report['rates']}}
    data['takes'] = [t for t in data['takes'] if t['take'] != entry['take']] + [entry]
    data['takes'].sort(key=lambda t: (t['date'], t['take']))
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    return entry


def spoken_estimate(script_words, cut, path=None, last=5):
    """How long a script of this many words runs when he says it, from his
    last takes of the same cut: (seconds, how it was worked out), or None
    when no take of that cut is in the ledger."""
    path = Path(path or LEDGER)
    if not path.exists():
        return None
    takes = [t for t in json.loads(path.read_text(encoding='utf-8')).get('takes', []) if t.get('cut') == cut][-last:]
    if not takes:
        return None
    # The mean, not the median: he adds more as the weeks go on (9% on 12 Oct, 38% by 16 Oct), and the mean follows that.
    mean = lambda xs: round(sum(xs) / len(xs), 1)
    more, wpm = mean([t['said_more_pct'] for t in takes]), mean([t['words_a_minute'] for t in takes])
    secs = script_words * (1 + more / 100) / wpm * 60
    return round(secs, 1), f'his last {len(takes)} {cut} take(s): he adds about {more:g}% to the script and talks at about {wpm:g} words a minute'


# --------------------------------------------------------------------------- tests

def self_test():
    fails = []

    def check(name, got, want):
        if got != want:
            fails.append(f'{name}: got {got!r}, want {want!r}')

    script = ('Sam Altman said investors were putting in forty billion dollars. It sounds sure. She signs. '
              'It costs about eleven times as much, but its score only goes up by about a third. Opus 5.5 is on ChatGPT.')
    said = ('So Sam Altman said investors were putting in $40 billion. And she sounds pretty sure, signs the contract. '
            'It costs about 11 times as much, but its score really only goes up by about 30%. Opus 5 .5 is on chat GPT.')
    words = [{'w': ' ' + w, 's': i * 0.4, 'e': i * 0.4 + 0.3} for i, w in enumerate(said.split())]
    read, heard, devs, matched = diff(script, words)
    texts = [(d['kind'], d['said']) for d in devs]
    check('a transcriber\'s "$40 billion", "11", "5 .5" and "chat GPT" are not differences',
          any('40' in d['said'] or '5 .5' in d['said'] or 'GPT' in d['said'] or d['said'].startswith('11') for d in devs), False)
    check('an added "So" is a filler and a signpost', [d['tags'] for d in devs if d['said'] == 'So'], [['filler', 'signpost']])
    check('"about a third" said "about 30%" is a number said differently',
          any('number' in d['tags'] and '30%' in d['said'] for d in devs), True)
    check('"really" added is an intensifier', any('intensifier' in d['tags'] and 'really' in d['said'] for d in devs), True)
    check('"It sounds sure. She signs." said his way is a rephrase with a hedge ("pretty")',
          any('hedge' in d['tags'] and 'pretty' in d['said'] for d in devs), True)
    r = rates(script, words, read, heard, devs, matched)
    check('the rates add up: own words plus word for word are all he said',
          sum(d['said_words'] for d in devs) + matched, len(heard))
    check('he said more than the script', r['said_more_pct'] > 0, True)
    restart = [{'w': ' ' + w, 's': i * 0.4, 'e': i * 0.4 + 0.3} for i, w in enumerate('the old one for the old one top gear'.split())]
    _, _, rd, _ = diff('the old one top gear', restart)
    _, _, hd, _ = diff('He paid $150,000 on the 9 of May. It is 70% sure.', [{'w': ' ' + w, 's': i * 0.4, 'e': i * 0.4 + 0.3} for i, w in
                       enumerate('He paid $150 ,000 on the 9th of May. It is 70 % sure.'.split())])
    check('a split number, an ordinal and a split % are the transcriber\'s, not his', hd, [])
    check('a phrase said twice is a restart', any('restart' in d['tags'] for d in rd), True)
    check('mind.the.gap is three spoken words', [t['c'] for t in script_tokens('This is mind.the.gap today.')], ['this', 'is', 'mind', 'the', 'gap', 'today'])
    check('number words become one figure', [t['c'] for t in script_tokens('two hundred dollar plan, thirteen times')],
          ['200', 'dollar', 'plan', '13', 'times'])
    fixed = apply_fixes([{'w': ' She', 's': 0.0, 'e': 0.3}, {'w': ' pays', 's': 0.4, 'e': 0.7}, {'w': ' the', 's': 0.8, 'e': 0.9},
                         {'w': ' deal.', 's': 1.0, 'e': 1.3}], [['pays the deal', 'pastes the deal']])
    check('a verified mishearing is fixed before the diff, its punctuation kept', [w['w'].strip() for w in fixed], ['She', 'pastes', 'the', 'deal.'])
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        led = Path(tmp) / 'ledger.json'
        rep = {'label': 'a', 'rates': {**r, 'said_more_pct': 20.0, 'words_a_minute': 180.0}}
        ledger_add(rep, 'short', '2026-10-12', path=led)
        ledger_add({**rep, 'label': 'a'}, 'short', '2026-10-12', path=led)
        check('the ledger keeps one entry a take', len(json.loads(led.read_text())['takes']), 1)
        check('a 225-word script runs 90 s when he adds 20% at 180 a minute', spoken_estimate(225, 'short', led)[0], 90.0)
        check('no take of that cut, no estimate', spoken_estimate(225, 'long', led), None)
    md = markdown('test', r, devs)
    check('the report lists every difference', md.count('\n| ') - 1, len(devs))
    check('the report reads his differences as how he talks, never as slips', 'never as slips' in md, True)
    print('\n'.join(fails) if fails else f'narration_diff self-test passed: {17} checks')
    return 1 if fails else 0


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if argv[:1] == ['--self-test']:
        return self_test()
    if argv[:1] == ['ledger']:
        ap = argparse.ArgumentParser(prog='narration_diff.py ledger')
        ap.add_argument('report')
        ap.add_argument('--cut', required=True, choices=['short', 'long', 'deep', 'feature'])  # feature: house rule FEATURE
        ap.add_argument('--date', required=True)
        ap.add_argument('--piece')
        a = ap.parse_args(argv[1:])
        e = ledger_add(json.loads(Path(a.report).read_text(encoding='utf-8')), a.cut, a.date, a.piece)
        print(f'kept {e["take"]} ({e["cut"]}, {e["date"]}): +{e["said_more_pct"]}% said, {e["own_words_pct"]}% his own words')
        return 0
    if argv[:1] == ['patterns']:
        ap = argparse.ArgumentParser(prog='narration_diff.py patterns')
        ap.add_argument('reports', nargs='+')
        ap.add_argument('--md')
        a = ap.parse_args(argv[1:])
        text = patterns(a.reports)
        if a.md:
            Path(a.md).write_text(text, encoding='utf-8')
        print(text)
        return 0
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('script')
    ap.add_argument('words')
    ap.add_argument('--md')
    ap.add_argument('--json')
    ap.add_argument('--label')
    ap.add_argument('--fixes', help='a make.py cut config whose "replacements" fix what the transcriber misheard')
    a = ap.parse_args(argv)
    fixes = json.loads(Path(a.fixes).read_text(encoding='utf-8')).get('replacements') if a.fixes else None
    got = run(a.script, a.words, a.label, fixes)
    if a.json:
        Path(a.json).write_text(json.dumps(got, indent=1, ensure_ascii=False), encoding='utf-8')
    md = markdown(got['label'], got['rates'], got['differences'])
    if a.md:
        Path(a.md).write_text(md, encoding='utf-8')
    print(md.split('\n## ')[0])
    return 0


if __name__ == '__main__':
    sys.exit(main())
