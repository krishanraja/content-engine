#!/usr/bin/env python3
"""words_gate: no word of the signed script that Krish said in his take is lost
from the finished cut.

Krish, 24 Oct, of the published Wednesday long video: "random small cuts and
chopped words" (config/failures.json, chopped-words-published). Receipts and
sync windows had passed; nothing compared what he said with what the finished
file says. This does, on three word lists:

  - the signed script: the words he was given to say;
  - the take's words: what the transcriber heard in his take (word timings);
  - the final cut's words: faster-whisper on the finished file, or a words
    json already made from it (make.py's <cut>.heard.json).

A content word (any word not in FUNCTION_WORDS) that is in the signed script
AND heard in the take, but missing from the final cut, and not an approved
removal in the EDL, is a hard fail naming the word and where it was. A function
word ("the", "of", "to") missing is listed, never blocking. A word he added to
the script (an ad-lib) that is missing is listed too. Words that change what a
sentence says (not, no, never, every negative contraction, all, only, more,
numbers) are content words here, never function words.

The final is compared with the take less its approved removals (the EDL), so
a false start make.py cut on purpose is never "lost", and a word the cut
clipped out is. A removal that takes out the only time he said a word of the
script fails too, unless the row carries Krish's own words: a session's "say"
row is not his approval. Spellings fold (colour and color are one word),
numbers fold ("sixty-six" and "66", "twelfth" and "12th" are one word) and a
name the transcriber splits ("Higgs field", "open AI") is the same word as the
name whole, in the take as in the final.

A transcriber's mishearing of the finished file ("Claude" heard as "clawed")
is cleared only by a "heard_as" row in the EDL that carries Krish's words
({"said": "Claude", "heard": "clawed", "krish": "Krish, DATE: ..."}), listed in
the receipt under cleared_by_krish; never by editing a receipt.

Calibration (plan W3 3a): until Monday 26's accepted long and short cuts pass
and Wednesday 21's published long cut and Friday's 90-second cut from the 17
Oct words file fail, a pass is evidence, not proof. A clipped tail the
transcriber still hears as the whole word is not caught here; joins inside
words are the joins-in-gaps check (scripts/cutgates/gaps.py). check_aligners
runs the check on every aligner's pass (faster-whisper, plus any local pass
handed in; no paid aligner): a word fails only when every pass lost it.
The five calibration cuts are config/gate-calibration.json, run by
scripts/cutgates/calibrate.py. chopped-words-published stays open until they
behave as listed on the real files.

    python3 scripts/quick-edit/words_gate.py --script SCRIPT.txt --take-words TAKE.words.json \\
        --final CUT.mp4|CUT.heard.json [--edl EDL.json] [--receipt CUT.mp4.validation.json] [--no-receipt] [--model small.en]

Exit 0 when nothing was lost, 1 when a content word was lost (or the check
could not be made), with the JSON report on stdout. Only a run that heard the
finished file itself writes a receipt: with a video as --final, the result is
written into its .validation.json as checks.words (machine written, bound to
the video's sha256), and only when the receipt was checked against the same
signed script and take words (or names none yet). A words json as --final is
reported and never written into a receipt, so a pass cannot be made from words
copied by hand. --no-receipt reports a video's check without writing it.
"""
import argparse
import difflib
import hashlib
import json
import re
import sys
from pathlib import Path

VERSION = 'words-gate/2'
MACHINE = 'scripts/quick-edit/words_gate.py'
VIDEO_SUFFIXES = ('.mp4', '.mov', '.mkv', '.webm', '.m4v')
# A cut for a post dated from here (Wednesday 28 Oct, the first piece made after this gate) is delivered only with
# a words check; Monday 26 and older posts' cuts were made and reviewed before it existed.
REQUIRED_FROM = '2026-10-27'
CALIBRATION = {
    'status': 'uncalibrated',
    'note': ('OPEN until calibrated on real cuts (plan W3 3a): Monday 26 Oct\'s accepted long and short must pass; '
             'Wednesday 21 Oct\'s published long cut and Friday\'s 90-second cut from the 17 Oct words file must fail. '
             'A clipped tail the transcriber still hears whole is caught by joins-in-gaps (scripts/cutgates/gaps.py). '
             'The harness is scripts/cutgates/calibrate.py on config/gate-calibration.json.'),
}

# The fixed function-word list: articles, pronouns, prepositions, conjunctions,
# auxiliaries and modals, and fillers. Negatives, quantifiers and numbers are
# deliberately absent: losing "not" or "all" changes what he said.
FUNCTION_WORDS = frozenset('''
a an the
i me my mine myself we us our ours ourselves you your yours yourself yourselves he him his himself she her hers
herself it its itself they them their theirs themselves
this that these those who whom whose which what
am is are was were be been being have has had having do does did doing
will would shall should can could may might must
and but or nor so yet if then than because as while until though although
of at by for with about against between into through during before after above below to from up down in out on
off over under onto upon via per across along around among toward towards within without
again further once here there when where why how
just also too very really quite rather
i'm i've i'll i'd you're you've you'll you'd he'd he'll she'd she'll we're we've we'll we'd they're they've they'll
they'd there'd
um uh er erm ah oh hmm mm okay ok yeah well like
'''.split())

UNITS = {w: n for n, w in enumerate('zero one two three four five six seven eight nine ten eleven twelve thirteen '
                                    'fourteen fifteen sixteen seventeen eighteen nineteen'.split())}
TENS = {w: 10 * n for n, w in enumerate('twenty thirty forty fifty sixty seventy eighty ninety'.split(), start=2)}
ORDINALS = {w: n for n, w in enumerate('first second third fourth fifth sixth seventh eighth ninth tenth eleventh twelfth '
                                       'thirteenth fourteenth fifteenth sixteenth seventeenth eighteenth nineteenth'.split(),
                                       start=1)}
ORDINALS.update(twentieth=20, thirtieth=30)
# Number words are compared as numbers, never through the spelling fold, which
# reads "hundred" as "centre" is read and makes it "hunderd".
NUMBER_WORDS = frozenset(UNITS) | frozenset(TENS) | frozenset(ORDINALS) | {'hundred', 'thousand'}
CURRENCY = {'$': 'dollars', '£': 'pounds', '€': 'euros'}
# A currency sign becomes a marker token where the sign was; numbers() moves it
# after the number it stands before, so "$2", ".7", "billion" and "two point
# seven billion dollars" are the same tokens, whichever words the sign sat in.
MARKER = {sign: f'currencysign{word}' for sign, word in CURRENCY.items()}
SCALES = ('million', 'billion', 'trillion', '000')
# How many tokens a name may be split into and still be one word: "make your mind up" is "makeyourmindup".
JOINS = (1, 2, 3, 4)


class WordsGateError(Exception):
    """The check cannot be made (a missing file, a receipt for other bytes)."""


def fold(token):
    """British and US spellings as one key (spelling.py), when it is importable."""
    try:
        import spelling
    except ImportError:  # run from elsewhere: spellings are then compared as written
        return token
    return spelling.fold(token)


def canonical(text):
    """One word as its comparison tokens: lower case, letters and digits, a
    possessive 's dropped, %, $, £ and € said as words, spellings folded."""
    text = str(text).lower().replace('’', "'").replace('‘', "'")
    for sign, marker in MARKER.items():
        text = text.replace(sign, f' {marker} ')
    text = text.replace('%', ' percent ').replace('&', ' and ')
    out = []
    for token in re.findall(r"[a-z0-9]+(?:'[a-z]+)?", text):
        token = re.sub(r"'s$", '', token)
        out.append(fold(token) if token.isalpha() and token not in NUMBER_WORDS else token)
    return [t for t in out if t]


def krish_words(text):
    """Whether a row carries Krish's own words (they start "Krish"), the repository's mark of his approval."""
    return str(text or '').strip().lower().startswith('krish')


def ordinal(n):
    """12 as "12th", 21 as "21st": an ordinal the way the transcriber writes a date."""
    tail = 'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')
    return f'{n}{tail}'


def _value(run):
    """The number a run of number words says ("two hundred and six" is 206)."""
    value = 0
    for r in run:
        w = r['t']
        if w in UNITS:
            value += UNITS[w]
        elif w in TENS:
            value += TENS[w]
        elif w == 'hundred':
            value = max(value, 1) * 100
    return value


def _follows(prev, word):
    """Whether a number word can go on the number before it ("sixty" "six")."""
    if prev is None:
        return True
    if prev in TENS:
        return word in UNITS and 0 < UNITS[word] < 10
    if prev in UNITS:
        return word == 'hundred'
    if prev == 'hundred':
        return word in UNITS or word in TENS or word == 'and'
    if prev == 'and':
        return word in UNITS or word in TENS
    return False


def numbers(tokens):
    """Spelt numbers as digits, the way the transcriber writes them: "sixty six"
    is "66", "two point seven" is "2" "7" (as "2.7" splits), "thousand" is "000"
    (as "150,000" splits). Million and billion stay words, as the transcriber
    writes "60 million". Ordinals are written as the transcriber writes a date:
    "twelfth" is "12th", "twenty first" is "21st". Each token is a dict with 't';
    merged tokens keep the first one's start and the last one's end."""
    out, run = [], []

    def flush():
        if not run:
            return
        tail = []
        while run and run[-1]['t'] == 'and':  # "a hundred and" ends on a plain "and"
            tail.insert(0, run.pop())
        if run:
            out.append({**run[0], 't': str(_value(run)), 'e': run[-1].get('e'), 'last': run[-1].get('last', run[-1].get('i'))})
        out.extend(tail)
        run.clear()

    for tok in tokens:
        t = tok['t']
        if t in ORDINALS:
            if run and run[-1]['t'] in TENS and ORDINALS[t] < 10:  # "twenty first"
                out.append({**run[0], 't': ordinal(_value(run) + ORDINALS[t]), 'e': tok.get('e'),
                            'last': tok.get('last', tok.get('i'))})
                run.clear()
                continue
            flush()
            out.append({**tok, 't': ordinal(ORDINALS[t])})
            continue
        if t in UNITS or t in TENS or t == 'hundred' or (t == 'and' and run and run[-1]['t'] == 'hundred'):
            if run and not _follows(run[-1]['t'], t):
                flush()
            run.append(tok)
            continue
        flush()
        out.append(tok)
    flush()
    # "point" between two numbers is the decimal point the transcriber writes as "."
    joined = []
    for k, tok in enumerate(out):
        if (tok['t'] == 'point' and joined and joined[-1]['t'].isdigit()
                and k + 1 < len(out) and out[k + 1]['t'].isdigit()):
            continue
        joined.append({**tok, 't': '000'} if tok['t'] == 'thousand' else tok)
    # "$60 million" and "60 million dollars" are the same words said: the sign goes after its number.
    done, k = [], 0
    while k < len(joined):
        tok = joined[k]
        if tok['t'].startswith('currencysign'):
            j = k + 1
            while j < len(joined) and (joined[j]['t'].isdigit() or joined[j]['t'] in SCALES):
                j += 1
            done += joined[k + 1:j] + [{**tok, 't': tok['t'][len('currencysign'):]}]
            k = j
            continue
        done.append(tok)
        k += 1
    return done


def words_of(doc):
    """The word list of a words json: {"words": [...]} or a bare list, each {w, s, e}."""
    words = doc.get('words') if isinstance(doc, dict) else doc
    if not isinstance(words, list):
        raise WordsGateError('a words file needs a "words" list of {"w", "s", "e"}')
    for w in words:
        if not isinstance(w, dict) or not isinstance(w.get('w'), str):
            raise WordsGateError('every word needs its text in "w"')
    return words


def tokens_of(words):
    """Comparison tokens of timed words, each with its word's index and times."""
    raw = []
    for i, w in enumerate(words):
        for t in canonical(w['w']):
            raw.append({'t': t, 'w': w['w'].strip(), 's': w.get('s'), 'e': w.get('e'), 'i': i})
    return numbers(raw)


def script_tokens(text):
    raw = []
    for i, w in enumerate(str(text).split()):
        for t in canonical(w):
            raw.append({'t': t, 'w': w, 'i': i})
    return numbers(raw)


def approved_removals(edl, take_words):
    """The take word indexes the EDL removes on purpose, and each removal said
    plainly. An EDL is {"removals": [...]} or a bare list; a removal is an index
    pair [first, last] into the take's words, {"take_index": [first, last]}, or
    {"from_s": x, "to_s": y} on the take's clock (a word whose middle falls
    inside is removed). Extra keys ("krish", "words") travel with it."""
    if edl is None:
        return set(), []
    rows = edl.get('removals') if isinstance(edl, dict) else edl
    if not isinstance(rows, list):
        raise WordsGateError('an EDL needs a "removals" list')
    gone, said = set(), []
    for row in rows:
        if isinstance(row, (list, tuple)) and len(row) == 2:
            span = range(int(row[0]), int(row[1]) + 1)
        elif isinstance(row, dict) and isinstance(row.get('take_index'), (list, tuple)) and len(row['take_index']) == 2:
            span = range(int(row['take_index'][0]), int(row['take_index'][1]) + 1)
        elif isinstance(row, dict) and {'from_s', 'to_s'} <= set(row):
            a, b = float(row['from_s']), float(row['to_s'])
            span = [i for i, w in enumerate(take_words)
                    if isinstance(w.get('s'), (int, float)) and isinstance(w.get('e'), (int, float))
                    and a <= (w['s'] + w['e']) / 2 <= b]
        else:
            raise WordsGateError(f'an EDL removal must be [first, last], {{"take_index": [..]}} or {{"from_s", "to_s"}}: {row!r}')
        span = [i for i in span if 0 <= i < len(take_words)]
        if not span:
            raise WordsGateError(f'an EDL removal names no word of the take: {row!r}')
        gone.update(span)
        entry = {'take_index': [span[0], span[-1]], 'words': ' '.join(take_words[i]['w'].strip() for i in span)}
        if isinstance(row, dict) and row.get('krish'):
            entry['krish'] = row['krish']
        said.append(entry)
    return gone, said


def heard_as_rows(edl):
    """The mishearings of the finished file Krish has cleared, from the EDL's "heard_as":
    {"said": "Claude", "heard": "clawed", "krish": "Krish, DATE: his words"}. A row
    without his words is refused, so the check cannot be made: nothing but his word
    excuses a word the transcriber did not hear."""
    rows = edl.get('heard_as', []) if isinstance(edl, dict) else []
    if not isinstance(rows, list):
        raise WordsGateError('"heard_as" must be a list of {"said", "heard", "krish"}')
    out = []
    for row in rows:
        if not (isinstance(row, dict) and isinstance(row.get('said'), str) and isinstance(row.get('heard'), str)):
            raise WordsGateError(f'a heard_as row is {{"said": ..., "heard": ..., "krish": ...}}: {row!r}')
        if not krish_words(row.get('krish')):
            raise WordsGateError(f'a heard_as row clears a lost word only with Krish\'s own words in "krish" (starting "Krish"): {row!r}')
        said, heard = [t['t'] for t in script_tokens(row['said'])], [t['t'] for t in script_tokens(row['heard'])]
        if not said or not heard or said == heard:
            raise WordsGateError(f'a heard_as row needs the words he said and the different words the transcriber heard: {row!r}')
        out.append({'said': row['said'], 'heard': row['heard'], 'krish': row['krish'], 'said_t': said, 'heard_t': heard})
    return out


def scripted(take_toks, script_toks):
    """For each take token, whether it is a word of the script: the token itself, or
    its join with up to three neighbours ("open" "AI" for "OpenAI"), matches a
    script token or the join of up to four ("start up" for "startup"), as _excused
    matches the final."""
    s = [t['t'] for t in script_toks]
    keys = {''.join(s[p:p + n]) for n in JOINS for p in range(len(s) - n + 1)}
    t = [x['t'] for x in take_toks]
    marks = [False] * len(t)
    for p in range(len(t)):
        for n in JOINS:
            if p + n <= len(t) and ''.join(t[p:p + n]) in keys:
                marks[p:p + n] = [True] * n
    return marks


def _cleared(exp, fin, excused, used, rows):
    """Positions in a block of take tokens that a heard_as row of Krish's clears: the
    words he said, with the words the transcriber heard in their place in the final."""
    cleared = {}
    for row in rows:
        a, b = row['said_t'], row['heard_t']
        for p in range(len(exp) - len(a) + 1):
            if any(k in excused or k in cleared for k in range(p, p + len(a))) or [x['t'] for x in exp[p:p + len(a)]] != a:
                continue
            for q in range(len(fin) - len(b) + 1):
                if not used & set(range(q, q + len(b))) and [y['t'] for y in fin[q:q + len(b)]] == b:
                    for k in range(p, p + len(a)):
                        cleared[k] = row
                    used.update(range(q, q + len(b)))
                    break
    return cleared


def clock(t):
    return None if not isinstance(t, (int, float)) else f'{int(t // 60)}:{t % 60:05.2f}'


def _excused(exp, fin):
    """Positions in a block of take tokens that the final says differently but
    whole, and the final tokens that said them: a name split or joined ("Higgs
    field" for "Higgsfield", "AI" for "A I"). Only the exact letters count; a
    word heard shorter is never excused, because a clipped tail is the failure
    this gate exists for."""
    hit, used = {}, set()
    if exp and fin and ''.join(x['t'] for x in exp) == ''.join(y['t'] for y in fin):
        return {k: ' '.join(y['w'] for y in fin) for k in range(len(exp))}, set(range(len(fin)))
    windows = {}
    for q in range(len(fin)):
        for b in JOINS:
            if q + b <= len(fin):
                windows.setdefault(''.join(y['t'] for y in fin[q:q + b]), []).append((q, b))
    for p in range(len(exp)):
        for a in JOINS:
            if p + a > len(exp):
                break
            for q, b in windows.get(''.join(x['t'] for x in exp[p:p + a]), []):
                if a == 1 and b == 1:
                    continue  # the same single word unmatched is a different occurrence, not this one said differently
                for k in range(p, p + a):
                    hit.setdefault(k, ' '.join(y['w'] for y in fin[q:q + b]))
                used.update(range(q, q + b))
                break
    return hit, used


def _removals_checked(take_toks, expected, removals):
    """Each removal's script content words, and the removals that cut the only
    time he said one of them without Krish's words (his "krish" on the row): a
    session's "say" row is not his approval. A false start he said again passes."""
    kept, refused = {t['t'] for t in expected}, []
    for n, r in enumerate(removals, 1):
        removed = [t for t in take_toks if r['take_index'][0] <= t['i'] <= r['take_index'][1]]
        r['script_content_words'] = sorted({t['t'] for t in removed if t['scripted'] and t['t'] not in FUNCTION_WORDS})
        only = [w for w in r['script_content_words'] if w not in kept]
        if not only:
            continue
        r['only_said_here'] = only
        if not krish_words(r.get('krish')):
            refused.append({
                'removal': n, 'take_index': r['take_index'], 'words': r['words'], 'only_said_here': only,
                'message': (f'removal {n} (take words {r["take_index"][0]} to {r["take_index"][1]}: "{r["words"]}") cuts the only time '
                            f'he said {", ".join(only)} in the take and carries no words of Krish\'s approving it: keep the words '
                            'in the cut, or add his own words as "krish" (starting "Krish") on the removal')})
    return refused


def unapproved_removals(script, take, edl):
    """check()'s removal rule on its own, so make.py can refuse an EDL before it renders anything."""
    take = words_of(take)
    gone, removals = approved_removals(edl, take)
    take_toks = tokens_of(take)
    for tok, mark in zip(take_toks, scripted(take_toks, script_tokens(script))):
        tok['scripted'] = mark
    return _removals_checked(take_toks, [t for t in take_toks if t['i'] not in gone and t.get('last', t['i']) not in gone], removals)


def check(script, take, final, edl=None):
    """The words check. script: the signed script's text; take and final: timed
    word lists ({w, s, e}); edl: the approved removals (approved_removals) and the
    mishearings Krish cleared (heard_as_rows)."""
    result = {'machine': MACHINE, 'version': VERSION, 'status': 'fail', 'lost': [], 'unapproved_removals': [],
              'function_word_differences': [], 'adlib_losses': [], 'heard_differently': [], 'cleared_by_krish': [],
              'added_in_final': [], 'approved_removals': [], 'calibration': CALIBRATION}
    if not str(script or '').strip():
        result['reason'] = 'no signed script: the words gate cannot say which words he was meant to say, so the cut is held'
        return result
    take, final = words_of(take), words_of(final)
    gone, removals = approved_removals(edl, take)
    clears = heard_as_rows(edl)
    script_toks, take_toks, final_toks = script_tokens(script), tokens_of(take), tokens_of(final)
    if not take_toks:
        result['reason'] = 'the take has no words, so nothing can be compared'
        return result
    if not final_toks:
        result['reason'] = 'the final cut has no words: either the file is silent or the transcriber did not run on it'
        return result
    for tok, mark in zip(take_toks, scripted(take_toks, script_toks)):
        tok['scripted'] = mark
    expected = [t for t in take_toks if t['i'] not in gone and t.get('last', t['i']) not in gone]
    result['unapproved_removals'] = _removals_checked(take_toks, expected, removals)
    result['approved_removals'] = removals
    ops = difflib.SequenceMatcher(None, [t['t'] for t in expected], [t['t'] for t in final_toks], autojunk=False).get_opcodes()
    for op, i1, i2, j1, j2 in ops:
        if op == 'equal':
            continue
        if op == 'insert':
            result['added_in_final'] += [{'word': t['w'], 'final_s': t.get('s')} for t in final_toks[j1:j2]]
            continue
        block, said = expected[i1:i2], final_toks[j1:j2]
        excused, used = _excused(block, said)
        cleared = _cleared(block, said, excused, used, clears)
        heard_there = ' '.join(t['w'].strip() for q, t in enumerate(said) if q not in used) or None
        before = final_toks[j1 - 1].get('e') if j1 > 0 else 0.0
        after = final_toks[j2].get('s') if j2 < len(final_toks) else None
        for k, tok in enumerate(block):
            if k in excused:
                result['heard_differently'].append({'word': tok['w'], 'heard': excused[k], 'take_s': tok.get('s')})
                continue
            if k in cleared:
                result['cleared_by_krish'].append({'word': tok['w'], 'heard': cleared[k]['heard'], 'take_s': tok.get('s'),
                                                   'krish': cleared[k]['krish']})
                continue
            at = tok['i']
            context = ' '.join(['...'] + [w['w'].strip() for w in take[max(0, at - 4):at]] + [f"[{take[at]['w'].strip()}]"]
                               + [w['w'].strip() for w in take[at + 1:at + 5]] + ['...'])
            row = {'word': tok['w'], 'token': tok['t'], 'take_index': at, 'take_s': tok.get('s'), 'take_e': tok.get('e'),
                   'final_between_s': [before, after], 'context': context}
            if heard_there:
                row['final_heard_there'] = heard_there
            if tok['t'] in FUNCTION_WORDS:
                result['function_word_differences'].append(row)
            elif tok['scripted']:
                instead = f' (the final has "{heard_there}" there)' if heard_there else ''
                row['message'] = (f'"{tok["w"].strip()}" is lost: said at {clock(tok.get("s"))} in the take, not heard in the final cut '
                                  f'between {clock(before)} and {clock(after) or "the end"}{instead}: {context}')
                result['lost'].append(row)
            else:
                result['adlib_losses'].append(row)
        result['added_in_final'] += [{'word': t['w'], 'final_s': t.get('s')} for q, t in enumerate(said) if q not in used]
    for key in ('lost', 'function_word_differences', 'adlib_losses'):
        # One row a word: a word that is two tokens ("Character.AI") is named once.
        rows, seen = [], set()
        for row in result[key]:
            if row['take_index'] not in seen:
                seen.add(row['take_index'])
                rows.append(row)
        result[key] = rows
    result['counts'] = {'script_words': len(script_toks), 'take_words': len(take_toks), 'final_words': len(final_toks),
                        'removed_by_edl': len(gone), 'compared': len(expected),
                        'take_tokens_not_in_script': sum(1 for t in take_toks if not t['scripted'] and t['t'] not in FUNCTION_WORDS),
                        'script_content_words_not_said_in_take': len({t['t'] for t in script_toks if t['t'] not in FUNCTION_WORDS}
                                                                     - {t['t'] for t in take_toks}),
                        'lost': len(result['lost']), 'unapproved_removals': len(result['unapproved_removals']),
                        'cleared_by_krish': len(result['cleared_by_krish']),
                        'function_word_differences': len(result['function_word_differences']),
                        'adlib_losses': len(result['adlib_losses'])}
    reasons = []
    if result['lost']:
        reasons.append(f'{len(result["lost"])} content word(s) of the signed script he said in the take are missing from the final cut')
    if result['unapproved_removals']:
        reasons.append(f'{len(result["unapproved_removals"])} removal(s) cut the only time he said a word of the script, '
                       'without his words approving it')
    result['status'] = 'fail' if reasons else 'pass'
    if reasons:
        result['reason'] = '; '.join(reasons)
    return result


def check_aligners(script, take, finals, edl=None):
    """The words check on every aligner's pass of the finished file (plan W2.4). finals: {aligner: words}, in the
    order the aligners rank (faster-whisper first). A content word lost on every pass that could be compared
    fails the cut, named as check() names it; one lost on some passes and heard on another is listed under
    heard_by_one_aligner, never blocking. With one aligner the result says "single aligner" and is that pass's
    check, nothing more."""
    names = [n for n in finals]
    if not names:
        raise WordsGateError('no aligner heard the finished file')
    per = {n: check(script, take, finals[n], edl) for n in names}
    compared = [n for n in names if 'counts' in per[n]]
    base = dict(per[compared[0] if compared else names[0]])
    base['aligners'] = names
    base['agreement'] = 'single aligner' if len(names) == 1 else f'{len(names)} aligners'
    base['per_aligner'] = {n: {'status': r['status'], 'lost': [x['word'] for x in r.get('lost', [])],
                               **({'reason': r['reason']} if r.get('reason') else {})} for n, r in per.items()}
    if len(names) == 1 or not compared:
        base['heard_by_one_aligner'] = []
        return base
    lost_in = [{row['take_index'] for row in per[n]['lost']} for n in compared]
    everywhere = set.intersection(*lost_in)
    base['lost'] = [row for row in per[compared[0]]['lost'] if row['take_index'] in everywhere]
    seen, some = set(), []
    for n in compared:
        for row in per[n]['lost']:
            if row['take_index'] not in everywhere and row['take_index'] not in seen:
                seen.add(row['take_index'])
                some.append({**row, 'lost_by': [m for m in compared if row['take_index'] in {r['take_index'] for r in per[m]['lost']}]})
    base['heard_by_one_aligner'] = some
    base['not_compared'] = [n for n in names if n not in compared]
    base['counts'] = {**base.get('counts', {}), 'lost': len(base['lost']), 'heard_by_one_aligner': len(some)}
    reasons = []
    if base['lost']:
        reasons.append(f'{len(base["lost"])} content word(s) of the signed script he said in the take are missing from the final '
                       f'cut on every aligner\'s pass ({", ".join(compared)})')
    if base['unapproved_removals']:
        reasons.append(f'{len(base["unapproved_removals"])} removal(s) cut the only time he said a word of the script, '
                       'without his words approving it')
    base['status'] = 'fail' if reasons else 'pass'
    base.pop('reason', None)
    if reasons:
        base['reason'] = '; '.join(reasons)
    return base


def summary(result):
    """One line for a log or a refusal: what was lost, by name and place."""
    if result.get('status') == 'pass':
        return 'no content word lost'
    named = [r['message'] for r in (result.get('lost') or []) + (result.get('unapproved_removals') or [])]
    if not named:
        return result.get('reason', 'the words check did not pass')
    more = f' (and {len(named) - 6} more)' if len(named) > 6 else ''
    return f'{result.get("reason")}: {"; ".join(named[:6])}{more}'


def digest(path):
    with open(path, 'rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def bind(result, *, script=None, take=None, final_words=None, edl=None, video=None, final_provenance=None):
    """The check with the sha256 of everything it read, so it can be checked again."""
    files = {'script': script, 'take_words': take, 'final_words': final_words, 'edl': edl}
    bound = {**result, 'inputs': {k: {'path': str(p), 'sha256': digest(p) if Path(p).is_file() else None}
                                  for k, p in files.items() if p}}
    if video:
        bound['video_sha256'] = digest(video)
    if final_provenance:
        bound['final_transcript'] = final_provenance
    return bound


def record(receipt, words_check):
    """Write the check into a cut's .validation.json as checks.words. A receipt
    for other bytes is never touched; a missing one is started. A receipt that
    was checked before (make.py's own check) takes a new check only on the same
    signed script and take words, and one that names the take words its cut was
    made from takes a check only on those: a run by hand checks the cut again,
    never against words chosen to match it."""
    receipt = Path(receipt)
    report = json.loads(receipt.read_text(encoding='utf-8')) if receipt.is_file() else {}
    sha = words_check.get('video_sha256')
    if not sha:
        raise WordsGateError('the words check is not bound to video bytes, so it cannot go into a receipt')
    if report.get('video_sha256') not in (None, sha):
        raise WordsGateError(f'{receipt.name} belongs to different video bytes; the words check was not written into it')
    now = {k: (v or {}).get('sha256') for k, v in (words_check.get('inputs') or {}).items()}
    held = (report.get('checks') or {}).get('words')
    if isinstance(held, dict):
        was = {k: (v or {}).get('sha256') for k, v in (held.get('inputs') or {}).items()}
        for key in ('script', 'take_words'):
            if was.get(key) != now.get(key):
                raise WordsGateError(f'{receipt.name} was checked against another {key.replace("_", " ")} than this run read; '
                                     'a run by hand checks the same words again, so it was not written')
    made_from = (report.get('transcript_document') or {}).get('sha256')
    if made_from and now.get('take_words') != made_from:
        raise WordsGateError(f'{receipt.name} names the take words its cut was made from, and this run read others; it was not written')
    report.setdefault('video_sha256', sha)
    report.setdefault('checks', {})['words'] = words_check
    receipt.write_text(json.dumps(report, indent=2), encoding='utf-8')


def required_for(target):
    """Whether a cut filed at this library path must carry a words check: the
    path's own post folder (3 Posts/YYYY-MM-DD Day ...) is dated on or after
    REQUIRED_FROM. Keyed on where the cut goes, never on a mark in the receipt
    that a session could delete."""
    parts = str(target or '').replace('\\', '/').split('/')
    if len(parts) < 2 or parts[0] != '3 Posts':
        return False
    dated = re.match(r'(\d{4}-\d{2}-\d{2}) ', parts[1])
    return bool(dated) and dated.group(1) >= REQUIRED_FROM


def delivery_problems(report, target=None):
    """What the words check in a receipt says about delivery. quality.py asks
    this for every receipt: a failed check, or one bound to other bytes or to
    other take words than the cut was made from, blocks; so does no check at all
    for a cut going to a post dated from REQUIRED_FROM (target, else the
    receipt's own library_path). It never passes a receipt that is otherwise failing."""
    words = (report.get('checks') or {}).get('words')
    if words is None:
        if required_for(target or report.get('library_path')):
            return [f'words gate did not run: a cut for a post dated from {REQUIRED_FROM} needs the words check '
                    '(checks.words), which make.py writes, or words_gate.py run on the finished video']
        return []
    if not isinstance(words, dict) or words.get('status') != 'pass':
        reason = summary(words) if isinstance(words, dict) and 'status' in words else 'unreadable'
        return [f'words gate is not passed: {reason}']
    if words.get('machine') != MACHINE or words.get('video_sha256') != report.get('video_sha256'):
        return ['words gate result belongs to different video bytes or was not machine written']
    made_from = (report.get('transcript_document') or {}).get('sha256')
    if made_from and ((words.get('inputs') or {}).get('take_words') or {}).get('sha256') != made_from:
        return ['words gate result was checked against other take words than the cut was made from']
    return []


def transcribe(video, model):
    """faster-whisper on the finished file, as make.py transcribes (beam 5, VAD,
    word timings), with the same provenance make.py writes."""
    import quality
    import transcriber
    try:
        from faster_whisper import WhisperModel
    except ImportError as error:
        raise WordsGateError(f'faster-whisper is not importable ({error}): {transcriber.FIX}')
    segs, info = WhisperModel(model, device='cpu', compute_type='int8', cpu_threads=4).transcribe(
        str(video), word_timestamps=True, vad_filter=True, beam_size=5)
    words = [{'w': w.word, 's': round(w.start, 3), 'e': round(w.end, 3)} for seg in segs for w in seg.words]
    return {'duration': info.duration, 'words': words, 'provenance': quality.transcript_identity(video, 1, model)}


def main(argv=None):
    ap = argparse.ArgumentParser(description='The words gate: no content word of the signed script he said is lost from the cut.')
    ap.add_argument('--script', required=True, help='the signed script (plain text, the words he was given to say)')
    ap.add_argument('--take-words', required=True, help="the take's words json ({\"words\": [{w, s, e}]})")
    ap.add_argument('--final', required=True, help='the finished cut (a video, transcribed here) or a words json made from it')
    ap.add_argument('--edl', help='the approved removals ({"removals": [...]})')
    ap.add_argument('--receipt', help="the cut's .validation.json (default for a video: beside it; never for a words json)")
    ap.add_argument('--no-receipt', action='store_true', help="report a video's check without writing it into a receipt")
    ap.add_argument('--model', help="the faster-whisper model for a video (default: the take words' own model, else small.en)")
    a = ap.parse_args(argv)
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    try:
        script_path, take_path, final_path = Path(a.script), Path(a.take_words), Path(a.final)
        for p in (script_path, take_path, final_path) + ((Path(a.edl),) if a.edl else ()):
            if not p.is_file():
                raise WordsGateError(f'{p} is not a file')
        take_doc = json.loads(take_path.read_text(encoding='utf-8-sig'))
        edl = json.loads(Path(a.edl).read_text(encoding='utf-8-sig')) if a.edl else None
        video, words_file = None, final_path
        if final_path.suffix.lower() in VIDEO_SUFFIXES:
            video = final_path
            model = a.model or (take_doc.get('provenance') or {}).get('model') or take_doc.get('model') or 'small.en'
            final_doc = transcribe(video, model)
            words_file = final_path.with_name(final_path.name + '.words-gate.heard.json')
            words_file.write_text(json.dumps(final_doc, indent=0), encoding='utf-8')
        else:
            final_doc = json.loads(final_path.read_text(encoding='utf-8-sig'))
        result = check(script_path.read_text(encoding='utf-8-sig'), take_doc, final_doc, edl)
        provenance = final_doc.get('provenance') if isinstance(final_doc, dict) else None
        bound = bind(result, script=script_path, take=take_path, final_words=words_file, edl=Path(a.edl) if a.edl else None,
                     video=video, final_provenance=provenance)
        if video and not a.no_receipt:
            # Only a run that heard the finished file itself writes a receipt.
            receipt = Path(a.receipt) if a.receipt else Path(str(video) + '.validation.json')
            record(receipt, bound)
            bound['receipt'] = str(receipt)
        else:
            bound['receipt'] = None
            bound['receipt_not_written'] = ('--no-receipt' if video else 'a words json is reported, never written into a receipt: '
                                            'only a run that transcribes the finished video itself can write checks.words')
    except (WordsGateError, OSError, ValueError) as error:
        print(json.dumps({'machine': MACHINE, 'status': 'fail', 'reason': f'the words check could not be made: {error}'}, indent=1))
        return 1
    print(json.dumps(bound, indent=1))
    print(('words gate: PASS, ' if bound['status'] == 'pass' else 'words gate: FAIL, ') + summary(bound), file=sys.stderr)
    return 0 if bound['status'] == 'pass' else 1


if __name__ == '__main__':
    sys.exit(main())
