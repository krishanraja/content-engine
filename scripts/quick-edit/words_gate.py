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
clipped out is. Spellings fold (colour and color are one word), numbers fold
("sixty-six" and "66" are one word) and a name the transcriber splits ("Higgs
field") is the same word as the name whole.

Calibration (plan W3 3a): until Monday 26's accepted long and short cuts pass
and Wednesday 21's published long cut and Friday's 90-second cut from the 17
Oct words file fail, a pass is evidence, not proof. A clipped tail the
transcriber still hears as the whole word is not caught here; joins inside
words are the joins-in-gaps check (Wave 2). chopped-words-published stays open
until then.

    python3 scripts/quick-edit/words_gate.py --script SCRIPT.txt --take-words TAKE.words.json \\
        --final CUT.mp4|CUT.heard.json [--edl EDL.json] [--receipt CUT.mp4.validation.json] [--model small.en]

Exit 0 when nothing was lost, 1 when a content word was lost (or the check
could not be made), with the JSON report on stdout. With a video as --final,
the result is written into its .validation.json as checks.words (machine
written, bound to the video's sha256); with a words json, only when --receipt
names the receipt and the words json's provenance names the same video bytes.
"""
import argparse
import difflib
import hashlib
import json
import re
import sys
from pathlib import Path

VERSION = 'words-gate/1'
MACHINE = 'scripts/quick-edit/words_gate.py'
VIDEO_SUFFIXES = ('.mp4', '.mov', '.mkv', '.webm', '.m4v')
CALIBRATION = {
    'status': 'uncalibrated',
    'note': ('OPEN until calibrated on real cuts (plan W3 3a): Monday 26 Oct\'s accepted long and short must pass; '
             'Wednesday 21 Oct\'s published long cut and Friday\'s 90-second cut from the 17 Oct words file must fail. '
             'A clipped tail the transcriber still hears whole is caught only by joins-in-gaps (Wave 2).'),
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
CURRENCY = {'$': 'dollars', '£': 'pounds', '€': 'euros'}
# A currency sign becomes a marker token where the sign was; numbers() moves it
# after the number it stands before, so "$2", ".7", "billion" and "two point
# seven billion dollars" are the same tokens, whichever words the sign sat in.
MARKER = {sign: f'currencysign{word}' for sign, word in CURRENCY.items()}
SCALES = ('million', 'billion', 'trillion', '000')


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
        out.append(fold(token) if token.isalpha() else token)
    return [t for t in out if t]


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
    writes "60 million". Each token is a dict with 't'; merged tokens keep the
    first one's start and the last one's end."""
    out, run = [], []

    def flush():
        if not run:
            return
        tail = []
        while run and run[-1]['t'] == 'and':  # "a hundred and" ends on a plain "and"
            tail.insert(0, run.pop())
        if run:
            value = 0
            for r in run:
                w = r['t']
                if w in UNITS:
                    value += UNITS[w]
                elif w in TENS:
                    value += TENS[w]
                elif w == 'hundred':
                    value = max(value, 1) * 100
            out.append({**run[0], 't': str(value), 'e': run[-1].get('e'), 'last': run[-1].get('last', run[-1].get('i'))})
        out.extend(tail)
        run.clear()

    for tok in tokens:
        t = tok['t']
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
        for b in (1, 2, 3):
            if q + b <= len(fin):
                windows.setdefault(''.join(y['t'] for y in fin[q:q + b]), []).append((q, b))
    for p in range(len(exp)):
        for a in (1, 2, 3):
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


def check(script, take, final, edl=None):
    """The words check. script: the signed script's text; take and final: timed
    word lists ({w, s, e}); edl: the approved removals (approved_removals)."""
    result = {'machine': MACHINE, 'version': VERSION, 'status': 'fail', 'lost': [], 'function_word_differences': [],
              'adlib_losses': [], 'heard_differently': [], 'added_in_final': [], 'approved_removals': [],
              'calibration': CALIBRATION}
    if not str(script or '').strip():
        result['reason'] = 'no signed script: the words gate cannot say which words he was meant to say, so the cut is held'
        return result
    take, final = words_of(take), words_of(final)
    gone, removals = approved_removals(edl, take)
    script_toks, take_toks, final_toks = script_tokens(script), tokens_of(take), tokens_of(final)
    if not take_toks:
        result['reason'] = 'the take has no words, so nothing can be compared'
        return result
    if not final_toks:
        result['reason'] = 'the final cut has no words: either the file is silent or the transcriber did not run on it'
        return result
    in_script = {t['t'] for t in script_toks}
    for r in removals:
        removed = [t['t'] for t in take_toks if r['take_index'][0] <= t['i'] <= r['take_index'][1]]
        r['script_content_words'] = sorted({t for t in removed if t in in_script and t not in FUNCTION_WORDS})
    result['approved_removals'] = removals
    expected = [t for t in take_toks if t['i'] not in gone and t.get('last', t['i']) not in gone]
    ops = difflib.SequenceMatcher(None, [t['t'] for t in expected], [t['t'] for t in final_toks], autojunk=False).get_opcodes()
    for op, i1, i2, j1, j2 in ops:
        if op == 'equal':
            continue
        if op == 'insert':
            result['added_in_final'] += [{'word': t['w'], 'final_s': t.get('s')} for t in final_toks[j1:j2]]
            continue
        block, said = expected[i1:i2], final_toks[j1:j2]
        excused, used = _excused(block, said)
        before = final_toks[j1 - 1].get('e') if j1 > 0 else 0.0
        after = final_toks[j2].get('s') if j2 < len(final_toks) else None
        for k, tok in enumerate(block):
            if k in excused:
                result['heard_differently'].append({'word': tok['w'], 'heard': excused[k], 'take_s': tok.get('s')})
                continue
            at = tok['i']
            context = ' '.join(['...'] + [w['w'].strip() for w in take[max(0, at - 4):at]] + [f"[{take[at]['w'].strip()}]"]
                               + [w['w'].strip() for w in take[at + 1:at + 5]] + ['...'])
            row = {'word': tok['w'], 'token': tok['t'], 'take_index': at, 'take_s': tok.get('s'), 'take_e': tok.get('e'),
                   'final_between_s': [before, after], 'context': context}
            if tok['t'] in FUNCTION_WORDS:
                result['function_word_differences'].append(row)
            elif tok['t'] in in_script:
                row['message'] = (f'"{tok["w"]}" is lost: said at {clock(tok.get("s"))} in the take, not heard in the final cut '
                                  f'between {clock(before)} and {clock(after) or "the end"}: {context}')
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
                        'script_content_words_not_said_in_take': len({t['t'] for t in script_toks if t['t'] not in FUNCTION_WORDS}
                                                                     - {t['t'] for t in take_toks}),
                        'lost': len(result['lost']), 'function_word_differences': len(result['function_word_differences']),
                        'adlib_losses': len(result['adlib_losses'])}
    result['status'] = 'fail' if result['lost'] else 'pass'
    if result['lost']:
        result['reason'] = f'{len(result["lost"])} content word(s) of the signed script he said in the take are missing from the final cut'
    return result


def summary(result):
    """One line for a log or a refusal: what was lost, by name and place."""
    if result.get('status') == 'pass':
        return 'no content word lost'
    lost = result.get('lost') or []
    if not lost:
        return result.get('reason', 'the words check did not pass')
    named = '; '.join(r['message'] for r in lost[:6])
    more = f' (and {len(lost) - 6} more)' if len(lost) > 6 else ''
    return f'{result.get("reason")}: {named}{more}'


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
    for other bytes is never touched; a missing one is started."""
    receipt = Path(receipt)
    report = json.loads(receipt.read_text(encoding='utf-8')) if receipt.is_file() else {}
    sha = words_check.get('video_sha256')
    if not sha:
        raise WordsGateError('the words check is not bound to video bytes, so it cannot go into a receipt')
    if report.get('video_sha256') not in (None, sha):
        raise WordsGateError(f'{receipt.name} belongs to different video bytes; the words check was not written into it')
    report.setdefault('video_sha256', sha)
    report.setdefault('checks', {})['words'] = words_check
    receipt.write_text(json.dumps(report, indent=2), encoding='utf-8')


def delivery_problems(report):
    """What the words check in a receipt says about delivery. quality.py asks
    this for every receipt that carries one: a failed check, or one bound to
    other bytes, blocks; it never passes a receipt that is otherwise failing."""
    words = (report.get('checks') or {}).get('words')
    if words is None:
        return []
    if not isinstance(words, dict) or words.get('status') != 'pass':
        reason = summary(words) if isinstance(words, dict) and 'status' in words else 'unreadable'
        return [f'words gate is not passed: {reason}']
    if words.get('machine') != MACHINE or words.get('video_sha256') != report.get('video_sha256'):
        return ['words gate result belongs to different video bytes or was not machine written']
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
    ap.add_argument('--receipt', help="the cut's .validation.json (default for a video: beside it)")
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
        receipt = Path(a.receipt) if a.receipt else (Path(str(video) + '.validation.json') if video else None)
        if receipt and not video:
            # A words json goes into a receipt only when it says which bytes it was heard from.
            made_from = (provenance or {}).get('source_sha256')
            held = json.loads(receipt.read_text(encoding='utf-8')).get('video_sha256') if receipt.is_file() else None
            if not made_from or (held and made_from != held):
                raise WordsGateError('the final words json does not name the video bytes it was heard from (provenance.source_sha256) '
                                     'or names other bytes than the receipt, so it was not written into the receipt')
            bound['video_sha256'] = made_from
        if receipt:
            record(receipt, bound)
            bound['receipt'] = str(receipt)
    except (WordsGateError, OSError, ValueError) as error:
        print(json.dumps({'machine': MACHINE, 'status': 'fail', 'reason': f'the words check could not be made: {error}'}, indent=1))
        return 1
    print(json.dumps(bound, indent=1))
    print(('words gate: PASS, ' if bound['status'] == 'pass' else 'words gate: FAIL, ') + summary(bound), file=sys.stderr)
    return 0 if bound['status'] == 'pass' else 1


if __name__ == '__main__':
    sys.exit(main())
