"""Caption words for the rebuild: the transcriber's clock, with its mishearings put right against the script where the
two line up word for word, plus a short list of fixes heard by ear. Writes words_long.json and words_short.json as
[[display word, take seconds], ...]. Run from anywhere: python3 words.py"""
import json, re, difflib
from pathlib import Path
H = Path(__file__).resolve().parent; P = H.parent
def norm(w): return re.sub(r"[^a-z0-9%]", "", w.lower())
FIX = {'anthropic': 'Anthropic', "anthropic's": "Anthropic's", 'claude': 'Claude', 'ai': 'AI', 'us': 'US'}
def build(cut):
    d = json.load(open(P / f'takes/{cut}.words.json'))
    ws = [[x['w'].strip(), x['s'], x['e']] for x in d['words'] if x['w'].strip()]
    # glue the transcriber's split tokens: "400" ",000" ; "75" "%" ; "hands" "-on" ; "makeyourmindup" ".ai"
    out = []
    for w in ws:
        if out and (w[0].startswith((',', '%', '-', '.')) and len(w[0]) > 1 or w[0] == '%'):
            out[-1][0] += w[0]; out[-1][2] = w[2]
        else: out.append(w)
    ws = out
    script = (P / f'script-{cut}.md').read_text().split()
    a = [norm(w[0]) for w in ws]; b = [norm(x) for x in script]
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    res = [w[0] for w in ws]
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == 'equal' or (op == 'replace' and i2 - i1 == 1 and j2 - j1 == 1
                             and difflib.SequenceMatcher(None, a[i1], b[j1]).ratio() >= 0.6):
            for k in range(i2 - i1): res[i1 + k] = script[j1 + k]
    final = []
    for (w, s, e), r in zip(ws, res):
        r = FIX.get(r.lower(), r) if r == w else r
        final.append([r, round(s, 2), round(e, 2)])
    for i, x in enumerate(final):   # sentence case from what he said, not from where the script's sentences fell
        w = x[0]; core = re.sub(r"[^A-Za-z']", '', w)
        start = i == 0 or final[i - 1][0][-1] in '.?!'
        if start: x[0] = w[:1].upper() + w[1:]
        elif core and core not in PROPER and not core.isupper() and w[:1].isupper(): x[0] = w[:1].lower() + w[1:]
    return final
PROPER = {'Anthropic', "Anthropic's", 'Claude', 'I', "I'll", "I'd", "I've", 'America', 'August', 'US', 'AI'}
def apply(words, fixes):
    s = ' '.join(w[0] for w in words)
    for old, new in fixes:
        # replace a run of words by the same number of words (or merge)
        o = old.split(); n = len(o)
        for i in range(len(words) - n + 1):
            if [norm(x[0]) for x in words[i:i + n]] == [norm(x) for x in o]:
                nw = new.split()
                if len(nw) == n:
                    for k in range(n): words[i + k][0] = nw[k]
                else:
                    st, en = words[i][1], words[i + n - 1][2]; step = (en - st) / max(1, len(nw))
                    words[i:i + n] = [[x, round(st + k * step, 2), round(st + (k + 1) * step, 2)] for k, x in enumerate(nw)]
                break
        else: print('  fix not found:', old)
    return words
LONG_FIX = [("buying", "behind"), ("the same task over and over", "the same task over and over."), ("the AI company behind Claude", "the AI company behind Claude,"),
 ("twenty seven percent down to nine percent", "27% down to 9%."), 
 ("make your mind hop.ai.", "makeyourmindup.ai."), ("when from meeting", "went from needing"),
 ("43 percent", "43%"), ("hires of juniors", "hires were juniors."), ("why is that by", "why is that? By"), ("reports their", "report says"), ("says stuff", "says staff"), ("a junior hiring", "a Junior hiring"), ("when from meeting", "went from needing"), ("own stuff", "own staff."), ("their stuff", "their staff"), ("anthropic zone", "Anthropic's own"),
 ("account accountant", "accountant"), ("Judgment", "judgement"), ("they are to do", "AI to do"), ("leaning on", "leaning on"),
 ("info that like this", "info like this."), ("There's left", "there's less"), ("this time out", "this time,")]
SHORT_FIX = [("took start to work", "took starter work"), ("spot a work the repeats,", "spot the work that repeats,"), ("opens up", "opens up."), ("this info name", "this info. Name"), ("be in", "be?"), ("until it works", "until it works."), ("junior hiring Anthropic", "Junior hiring at Anthropic,"),
 ("keep a better way", "keep at a better way"), ("handed, a dull,", "handed a dull,")]
for cut, fx in (('long', LONG_FIX), ('short', SHORT_FIX)):
    w = apply(build(cut), fx)
    for i, x in enumerate(w):
        if i == 0 or w[i - 1][0][-1] in '.?!': x[0] = x[0][:1].upper() + x[0][1:]
    json.dump([[x[0], x[1], x[2]] for x in w], open(H / f'words_{cut}.json', 'w'))
    print(cut, len(w)); line = []; st = None
    for x in w:
        st = x[1] if st is None else st; line.append(x[0])
        if x[0][-1] in '.?!' or len(line) >= 18: print(f'{st:7.2f} ' + ' '.join(line)); line = []; st = None
    if line: print(f'{st:7.2f} ' + ' '.join(line))
