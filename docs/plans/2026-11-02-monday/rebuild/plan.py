"""The two cuts' timelines, written from his word clock: every picture, push-in and cut lands on the word it belongs to.
Writes tl_long.js / tl_short.js (read by scene.html) and plan_<cut>.json (read by compose.py). python3 plan.py"""
import json, re
from pathlib import Path
H = Path(__file__).resolve().parent
def norm(w): return re.sub(r"[^a-z0-9%]", "", w.lower())

class Clock:
    def __init__(self, cut, off):
        self.w = json.load(open(H / f'words_{cut}.json')); self.n = [norm(x[0]) for x in self.w]; self.off = off
    def at(self, phrase, after=0.0, end=False):
        """output time of the first (or last) word of phrase, searching from take time `after`"""
        p = [norm(x) for x in phrase.split()]
        for i in range(len(self.n) - len(p) + 1):
            if self.w[i][1] >= after - 0.01 and self.n[i:i + len(p)] == p:
                return round((self.w[i + len(p) - 1][2] if end else self.w[i][1]) + self.off, 2)
        raise SystemExit(f'not found: {phrase!r} after {after}')

def seg(a_, b_, mode, scene=None, **p):
    a, b = a_, b_
    g = {'a': a, 'b': b, 'mode': mode}
    if scene: g['scene'] = scene
    d = p.pop('d', None); wipe = p.pop('wipe', None)
    if wipe: g['wipe'] = wipe
    rel = lambda v: round(v - a, 2) if isinstance(v, float) else ([rel(x) for x in v] if isinstance(v, list) and v and isinstance(v[0], float) else v)
    g['d'] = round(b - a, 2); g['p'] = {k: (v if k in ('pw', 'sk', 'sy') else rel(v)) for k, v in p.items()}
    return g

STRIPS = {  # the highlighted line on each page, with the lines around it (image px), and the page's size
    'report-managers.jpg': ([150, 228, 800, 292], 935, 520, 'ANTHROPIC · OCT 2026'),
    'report-not-hired.jpg': ([150, 241, 790, 302], 935, 520, 'ANTHROPIC · OCT 2026'),
    'report-object-level.jpg': ([150, 252, 790, 312], 935, 520, 'ANTHROPIC · OCT 2026'),
    'report-judgment.jpg': ([150, 255, 800, 288], 935, 365, 'ANTHROPIC · OCT 2026'),
    'stanford.jpg': ([10, 488, 710, 530], 1400, 900, 'HOSSEINI & LICHTINGER · 2025'),
    'stanford-slower.jpg': ([10, 557, 710, 598], 1400, 900, 'HOSSEINI & LICHTINGER · 2025'),
    'imf-cash.jpg': ([20, 250, 565, 312], 620, 520, 'IMF · BESSEN 2015'),
    'npr.jpg': ([462, 433, 920, 467], 1400, 900, 'NPR PLANET MONEY · 2015'),
}
def paper(a, b, img, mode='side', lift=0.85, **kw):
    st, w, h, cr = STRIPS[img]
    g = seg(a, b, mode, 'bpaper' if mode == 'band' else 'paper', img=img, strip=st, w=w, h=h, credit=cr, **kw)
    g['lift'] = min(lift, 1.2); g['p']['sweep'] = round(max(lift, 1.7), 2); return g

def long():
    off = -2.4; c = Clock('long', off); A = c.at        # take 2.40 ("Junior hiring") is output 0.0: his voice on the first frame
    S = []; P = []                                     # segments, push-ins (output seconds, strength)
    # 0 to 36.8: the approved proof, as it was
    # the proof's first 37 s, each time 3.0 s earlier now the music-only opener is gone
    S.append(seg(0.0, 9.6, 'brand')); P += [(1.2, .16), (5.1, .25), (11.55, .10)]
    S.append(seg(9.6, 17.6, 'side', 'ladder', lit=11.5, gap=1, cover=12.0, x=300))
    S.append(seg(17.6, 27.1, 'full', 'badges', count=20.7, fall=25.44, land=26.62))
    S.append(seg(26.75, 28.9, 'brand')); P += [(27.0, .22)]
    mg = A('and many of its managers', 30)
    S.append(seg(28.9, mg, 'side', 'bars', six=31.2))
    first = A('so when AI writes', 36)
    S.append(paper(mg, first, 'report-managers.jpg', lift=A('hiring less', 36) - mg + 0.0))
    alone = A('makes sense but Anthropic', 40)
    S.append(seg(first, alone, 'brand')); P += [(A('less first draft', 40), .2)]
    wh = A('where companies brought', 45)
    S.append(paper(alone, wh, 'stanford.jpg', lift=1.2))
    slow = A('and it happened through', 50)
    S.append(seg(wh, slow, 'side', 'lines', part=A('while senior jobs', 49)))
    pan = A('now before anyone panics', 55)
    S.append(paper(slow, pan, 'stanford-slower.jpg', lift=A('slower hiring', 54) - slow))
    cash = A('so you\'d have thought', 60)
    S.append(seg(pan, cash, 'brand')); P += [(pan, .14), (A('twice', 62), .26)]
    held = A('so teller jobs held up', 75)
    S.append(seg(cash, held, 'full', 'branch', shut=A('20 tellers to 13', 66), copy=A('open more branches', 72), pct=A('43%', 75)))
    another = A('another example is spreadsheets', 80)
    S.append(paper(held, another, 'imf-cash.jpg', lift=1.0, pw=520, sk=760))
    because = A('and that\'s because accounting', 90)
    S.append(seg(another, because, 'full', 'ledgers', count=A('about 400,000', 86), gone=A('have gone', 86, end=True) - 0.4, added=A('but 600,000', 92)))
    each = A('so each time', 98)
    S.append(paper(because, each, 'npr.jpg', lift=0.9, pw=600))
    worry = A('but here is the worry', 104)
    S.append(seg(each, worry, 'side', 'ladder', lit=each + 0.6, taller=A('actually got bigger', 102)))
    back = A('back then', 107)
    S.append(seg(worry, back, 'brand')); P += [(A('worry', 107), .24)]
    thistime = A('but this time AI', 115)
    S.append(seg(back, thistime, 'side', 'ladder', bright=A('first step', 109), labels=A('tellers moved', 112)))
    rep = A('Anthropic\'s own report', 120)
    S.append(seg(thistime, rep, 'full', 'ladder', drawn=1, lift=A('first draft itself', 118), wipe='fade'))
    feel = A('and juniors are the ones', 126)
    S.append(paper(rep, feel, 'report-object-level.jpg', lift=A('hands-on work', 123) - rep))
    quiet = A('and the cut is quiet', 129)
    S.append(seg(feel, quiet, 'brand')); P += [(A('feel that the most', 128), .22)]
    hm = A('really hiring managers', 138)
    S.append(paper(quiet, hm, 'report-not-hired.jpg', lift=A('never get hired', 135) - quiet))
    ifai = A('if AI writes the first draft you need', 145)
    S.append(paper(hm, ifai, 'report-judgment.jpg', lift=A('judgement as a skill', 140) - hm))
    take = A('you take away the junior years', 158)
    S.append(seg(ifai, take, 'brand')); P += [(A('tell good from bad', 147), .16), (A('where did people learn', 150), .24), (A('getting it wrong', 155), .14)]
    every = A('so this kind of looks', 164)
    S.append(seg(take, every, 'side', 'ladder', drawn=1, gap=1, judge=A('still need the judgement', 160) + 0.3))
    s75 = A('Anthropic staff expect', 170)
    S.append(seg(every, s75, 'brand')); P += [(A('every company\'s problem', 168), .22), (A('of course', 172), .12)]
    however = A('however however much', 178)
    S.append(seg(s75, however, 'side', 'pct2', pa=A('75%', 174), pb=A('75%', 174) + 1.3))
    picture = A('and picture a new hire', 186)
    S.append(seg(however, picture, 'side', 'ladder', drawn=1, gap=1, lit=however + 0.3, line=A('seniors are juniors', 182)))
    keep = A('they keep at it', 200)
    S.append(seg(picture, keep, 'full', 'sheet', weeks=A('by hand weeks', 192), tries=[A('the first attempt', 196) + 0.3, A('neither does the second', 199) + 0.2, A('they keep at it', 200) + 9.0]))
    shrink = A('then three weeks', 204)
    S.append(seg(keep, shrink, 'brand')); P += [(keep, .18)]
    lesson = A('now the real lesson', 208)
    S.append(seg(shrink, lesson, 'full', 'sheet', tries=[shrink - 1.2], fold=shrink + 0.9))
    q2 = A('here are two questions', 228)
    habit = A('it\'s the habit', 212); which = A('which is how you use AI', 222)
    S.append(seg(lesson, habit, 'brand')); P += [(lesson, .22)]
    S.append(seg(habit, which, 'side', 'sheet', tries=[A('asking whether', 216), A('sticking with the fix', 216) - 0.4, A('sticking with the fix', 216) + 1.0]))
    S.append(seg(which, q2, 'brand')); P += [(which, .2), (A('so what can you do', 227), .24)]
    good = A('good juniors will ask', 237)
    S.append(seg(q2, good, 'side', 'ladder', drawn=1, gap=1, lit=q2 + 0.2, qcards=[A('who on this team', 232), A('and what are they', 235)], qlabel=q2 + 0.5))
    each_team = A('for each team', 255)
    boring = A('if you find a boring', 248); hire = A('like the new hire', 254, end=True)
    S.append(seg(good, boring, 'brand')); P += [(good, .16), (A('if you\'re early on', 241), .2), (A('as opposed to just', 247), .16)]
    S.append(seg(boring, hire, 'side', 'sheet', tries=[A('then build the better way', 253) - 0.2]))
    S.append(seg(hire, each_team, 'brand')); P += [(A('here\'s what to do', 253), .22)]
    full = A('the full deep dive', 280)
    cards = [dict(at=each_team, label='Each team, 4 years out'), dict(at=A('look at your last three', 266), label='Your last 3 hires'), dict(at=A('and give a junior', 273), label='One dull weekly job')]
    for cd in cards: cd['at'] = round(cd['at'] - each_team, 2)
    S.append(seg(each_team, full, 'side', 'actions', cards=cards))
    close = round(A("I'll see you there", 286, end=True) + 0.35, 2)
    S.append(seg(full, close, 'brand')); P += [(full, .16), (A('makeyourmindup.ai.', 283), .22)]
    shakes = [[1.2, 14], [26.62, 10], [A('first draft itself', 118) + 0.1, 9], [A('20 tellers to 13', 66) + 0.9, 6]]
    take_end = close - off + 0.25
    return dict(cut='long', off=off, take_in=2.4, capFrom=2.4, closeAt=close, dur=round(close + 4.4, 2), take_end=round(take_end, 2),
                segs=S, push=P, shakes=shakes, dress=[])

def short():
    off = -0.8; c = Clock('short', off); A = c.at         # take 0.80 is output 0.0: his first word on the first frame
    S = []; P = []
    q = A('so where will', 5)
    S.append(seg(0.0, q, 'face')); P += [(1.2, .14), (A('has actually collapsed', 3), .2)]
    st = A('and Anthropic\'s study', 9)
    S.append(seg(q, st, 'band', 'bladder', lit=A('in 2030', 8)))
    many = A('and many of its managers', 15)
    S.append(seg(st, many, 'full', 'badges', count=A('one in four', 12) - 0.2, fall=A('fewer than one', 14), land=A('in 10', 15)))
    cash = A('cash machines', 18)
    S.append(seg(many, cash - 0.1, 'full', 'quote', img='report-managers.jpg', credit='ANTHROPIC · OCT 2026', text='Around a third of ML and a fifth of SWE managers reported hiring less due to AI.', hl=[11, 12, 13, 14, 15]))
    sp = A('and spreadsheets', 19)
    but = A('but I feel', 24)
    S.append(seg(cash - 0.1, sp + 0.9, 'full', 'branch', copy=cash + 0.2, pct=cash + 0.7))
    S.append(seg(sp + 0.9, but, 'full', 'ledgers', gone=sp + 1.2, added=A('both times', 22) + 0.2, wipe='fade'))
    ai = A('AI takes the first draft', 27)
    S.append(seg(but, ai, 'face')); P += [(A('a bit different', 26), .24)]
    no = A('and no one notices', 31)
    S.append(seg(ai, no, 'full', 'ladder', drawn=1, lift=A('first draft itself', 28)))
    pic = A('a picture of a new hire', 36)
    S.append(seg(no, pic, 'full', 'quote', img='report-not-hired.jpg', credit='ANTHROPIC · OCT 2026', text='Employment protections for incumbents will not benefit those not hired to begin with.', hl=[8, 9, 10, 11, 12]))
    before = A('and so before you cut', 44)
    S.append(seg(pic, before, 'full', 'sheet', tries=[pic + 2.4, pic + 4.2, pic + 6.0]))
    who = A('who will your seniors', 47)
    S.append(seg(before, who, 'face')); P += [(A('ask two things', 46), .22)]
    now = A('now here\'s what to do', 50)
    S.append(seg(who, now, 'band', 'bcards', cards=[dict(at=0.0, big='?', label='Who?'), dict(at=round(A('what are they learning', 48) - who, 2), big='?', label='Learning on what?')]))
    name = A('name each', 52)
    S.append(seg(now, name, 'face')); P += [(now, .2)]
    full = A('the full deep dive', 60)
    S.append(seg(name, full, 'band', 'bcards', cards=[dict(at=0.0, big='1', label='Name them'), dict(at=round(A('and give that junior', 56) - name, 2), big='2', label='One dull job')]))
    close = round(A('makeyourmindup.ai.', 61, end=True) + 0.45, 2)
    S.append(seg(full, close, 'face')); P += [(full, .14), (A('makeyourmindup.ai.', 61), .2)]
    shakes = [[1.2, 14], [A('first draft itself', 28) + 0.1, 9]]
    return dict(cut='short', off=off, take_in=0.8, capFrom=0.8, closeAt=close, dur=round(close + 4.4, 2), take_end=round(close - off + 0.2, 2),
                segs=S, push=P, shakes=shakes, dress=[[3.0, q - 0.3], [full, close - 0.75]])

for T in (long(), short()):
    words = json.load(open(H / f"words_{T['cut']}.json"))
    js = dict(T, words=words); js.pop('push')
    (H / f"tl_{T['cut']}.js").write_text(f"const TL_{T['cut'].upper()}=" + json.dumps(js) + ';\n')
    json.dump(T, open(H / f"plan_{T['cut']}.json", 'w'), indent=1)
    print(T['cut'], 'dur', T['dur'], 'segments', len(T['segs']), 'push-ins', len(T['push']))
    for g in T['segs']: print(f"  {g['a']:7.2f}-{g['b']:7.2f} {g['mode']:5} {g.get('scene','')} {json.dumps(g['p'])[:110]}")
