#!/usr/bin/env python3
"""Does this article sound like Krish, or like a machine? The habits that make
detectors call prose AI-written, found paragraph by paragraph.

Krish, 2026-10-13: "they get flagged as 93% AI generated, can we do anything
about this?", then "build the sounds like Krish pass now". House rule
SOUNDS_LIKE_KRISH. The cure is never a trick on a detector: it is the piece
written the way he talks, with his own view and his own details. This check
finds where it is not, so the writer rewrites those paragraphs (krish-voice),
then runs it again until it passes.

What it looks for, each a habit of machine prose:
  - an even beat: sentences all about the same length (a person's vary a lot)
  - even paragraphs: every paragraph about the same size
  - the stock phrases ("delve", "in today's", "it's worth noting", "navigate",
    "landscape", "game-changer", "seamless", "unlock", "here's the thing" ...)
  - "it's not X, it's Y" and "isn't just X" turns
  - tidy lists of three, again and again
  - a question answered straight away by the next sentence
  - the colon reveal ("Here's why:", "The answer:")
  - a closing recap ("In short", "Ultimately", "The bottom line")
  - em dashes (house rule NO_EM_DASH)
  - no "I" or "my" anywhere: no person behind it
  - stiff, uncontracted English ("it is", "do not", "you are") where a person
    says "it's", "don't", "you're". Krish, 2026-10-13: "the article MUST not
    trigger AI written scans either - you need to bake this in and figure out
    how to add humanisms in there, abbreviations, "you're" instead of "you
    are"". Words inside quotation marks are someone else's and never count.

    python voice_check.py ARTICLE.md [--json] [--max-score N]

Exit 0: passes. Exit 1: the score is over the bar; each finding names its
paragraph and what to change. Exit 2: the file cannot be read.
"""
import argparse
import json
import re
import statistics
import sys
from pathlib import Path

MAX_SCORE = 12  # the bar: a score over this fails

STOCK = [
    'delve', 'in today\'s', 'in the world of', 'in a world where', 'it\'s worth noting', 'it is worth noting', 'it\'s important to note',
    'navigate', 'navigating', 'landscape', 'game-changer', 'game changer', 'seamless', 'seamlessly', 'unlock', 'unlocks', 'harness',
    'leverage', 'leveraging', 'robust', 'crucial', 'pivotal', 'moreover', 'furthermore', 'additionally', 'in conclusion',
    'here\'s the thing', 'the reality is', 'at the end of the day', 'when it comes to', 'a testament to', 'tapestry', 'realm',
    'ever-evolving', 'fast-paced', 'cutting-edge', 'revolutionize', 'revolutionise', 'transformative', 'paradigm', 'synergy',
    'buckle up', 'let\'s dive', 'dive in', 'deep dive', 'stands out', 'plays a crucial role', 'a new era', 'redefine', 'reshape',
    'heavy lifting', 'plainly', 'put simply', 'to be clear', 'make no mistake', 'in other words', 'simply put', 'the key takeaway',
    'worth watching', 'tells you everything', 'that\'s the point', 'is a mood', 'quietly',
]
SIGNPOST = re.compile(r"\b(?:two|three|four) (?:limits|things|reasons|points|caveats|lessons|questions)\b[^.]{0,20}[.:]|\bfirst(?:ly)?,[^.]{3,200}\.\s+second(?:ly)?,", re.I)
BOLD_LEAD = re.compile(r'^\*\*[^*\n]{2,80}\*\*')
NOT_BUT = re.compile(r"\b(?:it'?s|this is|that'?s|isn'?t|is not|wasn'?t|was not)\s+not\s+(?:just\s+|only\s+|about\s+)?[^.;:!?]{1,60}[,;]\s*(?:it'?s|but|this is|that'?s)\b"
                     r"|\bisn'?t\s+(?:just|only)\b|\bnot\s+(?:just|only)\s+[^.;:!?]{1,50},?\s+but\b"
                     r"|\b(?:is|are|was)\s+not\s+(?:just|only|about)\s+[^.;:!?]{1,50},\s*(?:it'?s|they'?re|but)\b", re.I)
TRIAD = re.compile(r"\b[\w'-]+(?:\s[\w'-]+){0,3},\s[\w'-]+(?:\s[\w'-]+){0,3},?\s(?:and|or)\s[\w'-]+", re.I)
REVEAL = re.compile(r"(?:^|[.!?]\s+)(?:here'?s\s+(?:why|how|what|the\s+\w+)|the\s+(?:answer|catch|twist|kicker|truth|short\s+answer)\s*(?:is)?)\s*:", re.I)
RECAP = re.compile(r"^(?:in short|in summary|to sum up|ultimately|in the end|the bottom line|all in all|overall|in conclusion)\b", re.I)
EM_DASH = re.compile(r"—|\s--\s")
# Uncontracted forms a person would contract in speech. A form that ends its
# clause ("that's what it is.") is left alone: there it is said in full.
STIFF = re.compile(r"\b(?:(?:it|that|there|here|what|who|he|she) is|(?:you|we|they) are|I am|I would|(?:you|we|they) would|"
                   r"(?:I|you|it|we|they) will|(?:do|does|did|is|are|was|were|have|has|had|would|could|should|will|must) not|cannot|let us)\b(?=\s+[\w$£])", re.I)
CONTRACTED = re.compile(r"\b\w+(?:n't|'s|'re|'ve|'ll|'d|'m)\b|\bcan't\b|\bwon't\b|\blet's\b", re.I)
QUOTED = re.compile(r'"[^"\n]*"|“[^”\n]*”')
FIRST_PERSON = re.compile(r"\b(?:I|I'm|I've|I'd|I'll|[Mm]y|[Mm]e)\b")


def paragraphs(text):
    """Prose paragraphs only: headings, lists, quotes, tables, images and links-only lines are left out."""
    out = []
    for block in re.split(r'\n\s*\n', text):
        b = block.strip()
        if not b or b.startswith(('#', '|', '!', '>', '- ', '* ', '```', '[^')) or re.match(r'^\d+\.\s', b):
            continue
        b = re.sub(r'\*\*|__|\*|_|`', '', b)
        b = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', b)
        if len(b.split()) >= 8:
            out.append(' '.join(b.split()))
    return out


def sentences(p):
    return [s for s in re.split(r'(?<=[.!?])\s+(?=[A-Z0-9"\'])', p) if len(s.split()) >= 2]


def check(text):
    paras = paragraphs(text)
    findings, score = [], 0.0
    raw_blocks = [b.strip() for b in re.split(r'\n\s*\n', text) if b.strip() and not b.strip().startswith(('#', '|', '!', '```'))]
    bold = sum(1 for b in raw_blocks if BOLD_LEAD.match(b))
    if bold >= 4:
        score += min(10, bold * 0.6)
        findings.append({'where': 'whole piece', 'habit': 'every paragraph opens the same way',
                         'detail': f'{bold} paragraphs start with a bold lead-in. Keep at most three; let the rest start the way he would say them'})
    openers = {}
    for p in paras:
        m = re.match(r'^((?:\w+\W+){1,2}?\w+:)', p)
        if m:
            openers[m.group(1).lower()] = openers.get(m.group(1).lower(), 0) + 1
    for o, n in openers.items():
        if n >= 3:
            score += n
            findings.append({'where': 'whole piece', 'habit': 'one formula on repeat', 'detail': f'"{o}" opens {n} paragraphs'})
    for phrase in ('my read', 'here is the', 'the short version', 'what this means'):
        n = len(re.findall(re.escape(phrase), text, re.I))
        if n >= 3 and not any(o.startswith(phrase) and c >= 3 for o, c in openers.items()):
            score += n
            findings.append({'where': 'whole piece', 'habit': 'one formula on repeat', 'detail': f'"{phrase}" {n} times'})
    all_sents = [s for p in paras for s in sentences(p)]
    lengths = [len(s.split()) for s in all_sents]
    words = sum(len(p.split()) for p in paras)
    if len(lengths) >= 8:
        cv = statistics.pstdev(lengths) / max(1e-9, statistics.mean(lengths))
        if cv < 0.45:
            score += (0.45 - cv) * 20
            findings.append({'where': 'whole piece', 'habit': 'an even beat',
                             'detail': f'sentence lengths barely vary (spread {cv:.2f}; a person writes above 0.45). Mix in very short '
                                       'sentences and the odd long one that runs on the way he talks'})
    plen = [len(p.split()) for p in paras]
    if len(plen) >= 5:
        cvp = statistics.pstdev(plen) / max(1e-9, statistics.mean(plen))
        if cvp < 0.35:
            score += (0.35 - cvp) * 10
            findings.append({'where': 'whole piece', 'habit': 'even paragraphs',
                             'detail': f'paragraphs are all about the same size (spread {cvp:.2f}). Let one be a single line, another longer'})
    triads = 0
    for i, p in enumerate(paras, 1):
        low = p.lower()
        lead = p[:70] + ('...' if len(p) > 70 else '')
        stock = sorted({w for w in STOCK if re.search(r'(?<![\w-])' + re.escape(w) + r'(?![\w-])', low)})
        if stock:
            score += 1.5 * len(stock)
            findings.append({'where': f'paragraph {i}: "{lead}"', 'habit': 'stock phrases', 'detail': ', '.join(stock)})
        for m in NOT_BUT.finditer(p):
            score += 2
            findings.append({'where': f'paragraph {i}: "{lead}"', 'habit': '"it\'s not X, it\'s Y"', 'detail': m.group(0)[:80]})
        if REVEAL.search(p):
            score += 1.5
            findings.append({'where': f'paragraph {i}: "{lead}"', 'habit': 'the colon reveal', 'detail': REVEAL.search(p).group(0).strip()})
        if SIGNPOST.search(p):
            score += 1.5
            findings.append({'where': f'paragraph {i}: "{lead}"', 'habit': 'neat signposting', 'detail': SIGNPOST.search(p).group(0)[:70]})
        if EM_DASH.search(p):
            score += 1
            findings.append({'where': f'paragraph {i}: "{lead}"', 'habit': 'an em dash', 'detail': 'house rule NO_EM_DASH'})
        sents = sentences(p)
        for a, b in zip(sents, sents[1:]):
            if a.rstrip().endswith('?') and len(b.split()) <= 14 and not a.lower().startswith(('should', 'would you', 'what do you')):
                score += 1
                findings.append({'where': f'paragraph {i}: "{lead}"', 'habit': 'a question answered at once',
                                 'detail': f'"{a.strip()[:60]}" then "{b.strip()[:50]}"'})
        triads += len(TRIAD.findall(p))
    if paras and RECAP.match(paras[-1]):
        score += 2
        findings.append({'where': f'paragraph {len(paras)} (the last)', 'habit': 'a closing recap',
                         'detail': 'end on his view or the question, not a summary'})
    if words and triads / max(1, words) * 1000 > 6:
        score += 2
        findings.append({'where': 'whole piece', 'habit': 'lists of three, again and again',
                         'detail': f'{triads} in {words} words. Keep the one that matters; give two, or four'})
    firsts = sum(len(FIRST_PERSON.findall(p)) for p in paras) - len(re.findall(r'\bmy read\b', ' '.join(paras), re.I))
    per_k = firsts / max(1, words) * 1000
    if words >= 300 and per_k < 4:
        score += 3 + (4 - per_k)
        findings.append({'where': 'whole piece', 'habit': 'no person behind it',
                         'detail': f'{firsts} "I" or "my" in {words} words. Put in his own view, a moment from his work, a line he would say'})
    stiff_by_para = []
    for i, p in enumerate(paras, 1):
        own = QUOTED.sub(' ', p.replace('’', "'"))
        hits = [m.group(0) for m in STIFF.finditer(own)]
        if hits:
            stiff_by_para.append((i, p, hits))
    stiff = sum(len(h) for _, _, h in stiff_by_para)
    contracted = sum(len(CONTRACTED.findall(QUOTED.sub(' ', p.replace('’', "'")))) for p in paras)
    if stiff >= 3 and stiff / max(1, stiff + contracted) > 0.25:
        score += min(8, stiff * 0.75)
        findings.append({'where': 'whole piece', 'habit': 'stiff, uncontracted English',
                         'detail': f'{stiff} full forms against {contracted} contractions. Say it the way he says it: '
                                   '"it\'s", "don\'t", "you\'re", "I\'d", outside quotes'})
        for i, p, hits in stiff_by_para:
            lead = p[:70] + ('...' if len(p) > 70 else '')
            findings.append({'where': f'paragraph {i}: "{lead}"', 'habit': 'uncontracted', 'detail': ', '.join(hits)})
    return {'score': round(score, 1), 'max_score': MAX_SCORE, 'passes': score <= MAX_SCORE, 'paragraphs': len(paras),
            'words': words, 'findings': findings}


def self_test():
    machine = ('In today\'s fast-paced landscape, AI is not just a tool, it\'s a partner. It helps teams navigate change. '
               'It helps leaders unlock value. It helps everyone move faster. What does this mean? It means everything changes.\n\n'
               'Moreover, the reality is that robust systems matter. They make work seamless, simple and safe. They are crucial for '
               'growth, trust and scale. They shape the future of work.\n\n'
               'Ultimately, the bottom line is clear: adoption is the key to success, speed and resilience in this new era.')
    person = ('I tried it on a Tuesday. It booked the dentist, which nobody has managed for me in three years.\n\n'
              'Then it got my cousin\'s name wrong twice, and I had to stop it before it emailed the wrong Raj. Funny, until it isn\'t. '
              'My whole contact book sits behind that one tap, and I gave it away in about four seconds without reading a word of what I '
              'was agreeing to, which is exactly what everyone else did too.\n\n'
              'Would I keep it? For the dull stuff, yes.')
    stiff = ('It is a good app. You are going to like it. I do not think it is perfect, and they are not saying it is. '
             'We are told it will not read your mail, and I would like to believe that.')
    quoted = ('Meta says people "do not need to worry, it is safe and you are in control". I\'m not so sure. It\'s early.')
    a, b = check(machine), check(person)
    checks = [
        ('machine prose fails', a['passes'], False),
        ('his kind of prose passes', b['passes'], True),
        ('stock phrases are named', any(f['habit'] == 'stock phrases' for f in a['findings']), True),
        ('"not X, it\'s Y" is found', any('not X' in f['habit'] for f in a['findings']), True),
        ('a closing recap is found', any(f['habit'] == 'a closing recap' for f in a['findings']), True),
        ('stiff English is found', any(f['habit'] == 'stiff, uncontracted English' for f in check(stiff)['findings']), True),
        ('quoted full forms do not count', any(f['habit'] == 'stiff, uncontracted English' for f in check(quoted)['findings']), False),
    ]
    bad = [(n, g, w) for n, g, w in checks if g != w]
    for n, g, w in bad:
        print(f'FAIL {n}: got {g!r}, want {w!r}')
    print('voice check self-test ' + ('passed' if not bad else 'FAILED') + f': {len(checks)} checks')
    return 1 if bad else 0


def main():
    if sys.argv[1:2] == ['--self-test']:
        sys.exit(self_test())
    ap = argparse.ArgumentParser(description='Does this article sound like Krish? Finds the habits of machine prose.')
    ap.add_argument('article')
    ap.add_argument('--json', action='store_true')
    ap.add_argument('--max-score', type=float, default=MAX_SCORE)
    a = ap.parse_args()
    try:
        text = Path(a.article).read_text(encoding='utf-8')
    except OSError as e:
        print(f'voice check: cannot read {a.article}: {e}', file=sys.stderr)
        sys.exit(2)
    r = check(text)
    r['max_score'] = a.max_score
    r['passes'] = r['score'] <= a.max_score
    if a.json:
        print(json.dumps(r, indent=1))
    else:
        for f in r['findings']:
            print(f"{f['habit']:<32} {f['where']}\n{'':<32} {f['detail']}")
        print(f"voice score {r['score']} (bar {a.max_score}, lower is more like him) over {r['paragraphs']} paragraphs, "
              f"{r['words']} words: {'passes' if r['passes'] else 'rewrite the paragraphs above in his voice, then run it again'}")
    sys.exit(0 if r['passes'] else 1)


if __name__ == '__main__':
    main()
