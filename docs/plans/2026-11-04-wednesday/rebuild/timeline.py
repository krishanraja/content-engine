"""Wednesday 4 Nov (Claude Duet) rebuild, in the style of the approved Monday proof (Krish, 2026-10-31: "Good, build all
four this way"). One timeline per cut: the take plays once, continuously; each segment says how the frame is laid out
(face on the branded frame, face beside a picture, a full-frame picture, the close), which picture, and the word clocks
its motion lands on. compose.py and scene.html both read what this writes. Run from the repository root:
    python3 docs/plans/2026-11-04-wednesday/rebuild/timeline.py
Writes .cache/proof/wed/timeline-long.json and timeline-short.json."""
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
PLAN = ROOT / 'docs/plans/2026-11-04-wednesday'
OUT = ROOT / '.cache/proof/wed'; OUT.mkdir(parents=True, exist_ok=True)
PANELS = ROOT / '.cache/produce/2026-11-04-b63d2507/panels'

# captions only; the sound is never touched (the transcriber's mishearings, direction take_edits)
REPLACE = [['DeWitt', 'Duet'], ['Dewitt', 'Duet'], ['Clairvaux', 'Claire Vo'], ['MakeYourMindUp.ai', 'makeyourmindup.ai'],
           ["you're connected apps", 'your connected apps'], ['let it draw', 'let it draft'], ["Lenny's newsletter", "Lenny's Newsletter"],
           ['favor', 'favour'], ['customize', 'customise']]


def words(cut):
    w = json.load(open(PLAN / f'takes/{cut}.words.json'))['words']
    out = [[x['w'].strip(), x['s'], x['e']] for x in w if x['w'].strip()]
    # glue a split ".ai." back on
    glued = []
    for x in out:
        if glued and x[0].startswith('.'):
            glued[-1][0] += x[0]; glued[-1][2] = x[2]
        else:
            glued.append(x)
    text = [x[0] for x in glued]
    for a, b in REPLACE:
        aw, bw = a.split(), b.split()
        i = 0
        while i <= len(text) - len(aw):
            core = lambda t: re.sub(r'^[^\w]+|[^\w]+$', '', t).lower()
            if [core(t) for t in text[i:i + len(aw)]] == [core(t) for t in aw]:
                if len(aw) == 1:
                    text[i] = text[i].replace(re.sub(r'^[^\w]+|[^\w]+$', '', text[i]), b)
                else:
                    for k in range(len(aw)):
                        text[i + k] = (bw[k] + re.sub(r'^.*?([^\w]*)$', r'\1', text[i + k])) if k < len(bw) else text[i + k]
            i += 1
    for x, t in zip(glued, text):
        x[0] = t
    return glued


def finder(ws):
    norm = [re.sub(r"[^a-z0-9']", '', x[0].lower()) for x in ws]
    def find(phrase, after=0.0):
        p = [re.sub(r"[^a-z0-9']", '', t.lower()) for t in phrase.split()]
        for i in range(len(norm) - len(p) + 1):
            if ws[i][1] >= after and norm[i:i + len(p)] == p:
                return ws[i][1]
        raise SystemExit(f'not found: {phrase!r} after {after}')
    return find


def clip(name, fmt):
    f = PANELS / f'{name}-{fmt}.mp4'
    if name == 'calendar':   # the UK time line barred (bar_calendar.py; reviewer, 2026-11-01)
        f = ROOT / '.cache/proof/wed/calendar-16x9-barred.mp4'
    assert f.exists(), f
    return str(f.relative_to(ROOT))


def long_cut():
    ws = words('long'); F = finder(ws); OFF = 0.6
    o = lambda x: round(x + OFF, 3)
    f = lambda p, a=0.0: o(F(p, a))
    S = []
    def seg(a, b, mode, pic=None, **kw):
        S.append(dict(a=o(a), b=o(b), mode=mode, pic=pic, **kw))
    seg(2.40, 13.48, 'face', 'brand')
    seg(13.48, 22.70, 'face', 'brand')
    seg(22.70, 25.20, 'side', 'phone', clip=clip('first', '16x9'))
    seg(25.20, 31.76, 'side', 'logos', ev=dict(email=f('email'), cal=f('calendar', 26), slack=f('Slack'), more=f('whatever')))
    seg(31.76, 42.36, 'side', 'phone', clip=clip('brief', '16x9'), strip='REFRESHES AT 6:30 EVERY MORNING')
    seg(42.36, 52.52, 'full', 'queue', ev=dict(send=f('sends', 42), pay=f('pays', 42), sign=f('signs', 42), delete=f('deletes', 42),
                                               yes=f('yes', 46), approved=f('approved', 49)))
    seg(52.52, 59.78, 'side', 'phone', clip=clip('setup', '16x9'))
    seg(59.78, 64.52, 'side', 'page', page='duet-carries-over', hl=[705, 448], src='claude.com · Claude Duet, 21 Oct 2026')
    seg(64.52, 73.08, 'face', 'brand')
    seg(73.08, 77.74, 'face', 'brand', tag='ONE EMAIL ACCOUNT PER DUET')
    seg(77.74, 87.64, 'face', 'brand')
    seg(87.64, 95.94, 'side', 'page', page='help-microsoft', hl=[865, 429], src='Claude Help Centre · Get started with Claude Duet',
        stamp=dict(at=f('Microsoft', 87), logo='microsoft-365', text='NOT YET'))
    seg(95.94, 98.08, 'side', 'phone', clip=clip('tasks', '16x9'))
    seg(98.08, 105.76, 'side', 'phone', clip=clip('reply', '16x9'))
    seg(105.76, 120.74, 'side', 'phone', clip=clip('todo', '16x9'))
    seg(120.74, 126.60, 'side', 'phone', clip=clip('think', '16x9'), strip='THE WAIT, SPED UP 8×')
    seg(126.60, 129.26, 'side', 'phone', clip=clip('make', '16x9'))
    seg(129.26, 138.38, 'side', 'phone', clip=clip('calendar', '16x9'))
    seg(138.38, 146.32, 'face', 'brand')
    seg(146.32, 150.82, 'face', 'brand', tag='SCHEDULING APPS · NOTE-TAKING APPS')
    seg(150.82, 162.58, 'full', 'tool', ev=dict(ask=f('ask', 150), builds=f('builds', 150), again=f('again', 155)))
    seg(162.58, 171.96, 'full', 'today', ev=dict(today=f('Today'), thread=f('thread'), invite=f('invite'), notes=f('notes', 165), ask=f('question', 165)))
    seg(171.96, 177.28, 'full', 'duet', ev=dict(work=f('work turns up'), yes=f('yes or no')))
    seg(177.28, 187.24, 'side', 'quote', ev=dict(normal=f('normal'), thought=f("hadn't thought")))
    seg(187.24, 198.04, 'full', 'hours', ev=dict(caught=f('caught up'), day=f('day and a half')))
    seg(198.04, 202.04, 'face', 'brand')
    seg(202.04, 206.32, 'side', 'page', page='claire-vo-review', hl=[560, 430], src="Claire Vo · How I AI · Lenny's Newsletter")
    seg(206.32, 217.76, 'face', 'brand')
    seg(217.76, 225.44, 'side', 'page', page='help-limits', hl=[546, 429], src='Claude Help Centre · Get started with Claude Duet',
        bar=dict(at=f('counts'), full=f('sooner', 218)))
    seg(225.44, 235.48, 'side', 'plans', ev=dict(pro=f('pro'), us=f('US'), company=f('company', 226), later=f('yet', 229)))
    seg(235.48, 245.14, 'face', 'brand')
    seg(245.14, 261.96, 'side', 'it', ev=dict(connect=f('connect', 245), personal=f('personal', 245), puts=f('puts'), control=f('control'),
                                             decide=f('decide'), allowed=f('allowed')))
    seg(261.96, 264.40, 'face', 'brand')
    seg(264.40, 271.90, 'side', 'steps12', ev=dict(one=f('pick'), fire=f('fire', 264), info=f('information', 267), reach=f('reach', 270)))
    seg(271.90, 281.80, 'side', 'steps34', ev=dict(week=f('week', 272), draft=f('draft', 274), settings=f('settings', 276),
                                                  used=f('used', 277), sending=f('sending', 279), spending=f('spending', 279)))
    take_end = ws[-1][2]
    dur = round(o(take_end) + 4.6, 2)
    seg(281.80, dur - OFF, 'close', 'close')
    pushes = [  # (output time, punch) on the pivotal lines
        (f('weird'), .16), (f('knows', 10), .10), (f('actually change'), .14), (f('different'), .10),
        (f('walked'), .14), (f('one catch'), .2), (f('15'), .12), (f('bills'), .18),
        (f('tool back'), .2), (f('dashboard', 143), .14), (f('worried'), .22),
        (f('catch', 197), .2), (f('read', 205), .1), (f('nudged'), .16), (f('nudging'), .14),
        (f('which', 238), .24), (f('hand', 243), .12), (f("here's what I do"), .2)]
    return dict(cut='long', fmt='16x9', W=1920, H=1080, off=OFF, take='.cache/produce/2026-11-04-b63d2507/takes/long-stable.mp4',
                take_in=2.4, take_fps=24, face=[500, 780], dur=dur, voice_end=o(take_end), segs=S, pushes=pushes,
                words=[[x[0], o(x[1])] for x in ws])


def short_cut():
    ws = words('short'); F = finder(ws); OFF = 2.1
    o = lambda x: round(x + OFF, 3)
    f = lambda p, a=0.0: o(F(p, a))
    S = []
    def seg(a, b, mode, pic=None, **kw):
        S.append(dict(a=o(a), b=o(b), mode=mode, pic=pic, **kw))
    seg(0.90, 10.34, 'face', 'brand')
    seg(10.34, 14.14, 'full', 'phone', clip=clip('first', '16x9'))
    seg(14.14, 20.30, 'full', 'phone', clip=clip('brief', '16x9'), strip='GMAIL · CALENDAR · EVERY FEW HOURS')
    seg(20.30, 25.30, 'full', 'queue', ev=dict(send=o(20.6), pay=o(21.0), sign=o(21.4), delete=o(21.8),
                                               yes=f('anything', 21) + 0.25, approved=f('anything', 21) + 0.9))
    seg(25.30, 30.02, 'full', 'phone', clip=clip('setup', '16x9'))
    seg(30.02, 36.98, 'face', 'top', ms=True, tagAt=f('one email'))
    seg(36.98, 41.58, 'full', 'phone', clip=clip('todo', '16x9'))
    seg(41.58, 44.04, 'full', 'phone', clip=clip('think', '16x9'), strip='THE WAIT, SPED UP 8×')
    seg(44.04, 47.22, 'face', 'top')
    seg(47.22, 52.38, 'full', 'phone', clip=clip('calendar', '16x9'))
    seg(52.38, 59.48, 'full', 'tool', ev=dict(ask=f('ask', 52), builds=f('ask', 52) + 0.9, again=f('get', 56)))
    seg(59.48, 63.58, 'face', 'top')
    seg(63.58, 71.78, 'full', 'steps', ev=dict(one=f('pick'), fire=f('nudges'), draft=f('check every'), yes=f('yes', 66), never=f('no sending')))
    take_end = ws[-1][2]
    dur = round(o(take_end) + 4.4, 2)
    seg(71.78, dur - OFF, 'close', 'close')
    pushes = [(f('early access'), .14), (f('actually change'), .16), (f('break it down'), .12),
              (f('one email'), .16), (f('bills'), .2), (f('use up'), .14), (f("here's what I do"), .18), (f('when you get'), .1)]
    return dict(cut='short', fmt='9x16', W=1080, H=1920, off=OFF, take='.cache/produce/2026-11-04-b63d2507/takes/short-stable.mp4',
                take_in=0.9, take_fps=24, face=[670, 790], dur=dur, voice_end=o(take_end), segs=S, pushes=pushes,
                words=[[x[0], o(x[1])] for x in ws])


if __name__ == '__main__':
    for tl in (long_cut(), short_cut()):
        (OUT / f"timeline-{tl['cut']}.json").write_text(json.dumps(tl))
        print(tl['cut'], 'dur', tl['dur'], 'segments', len(tl['segs']), 'words', len(tl['words']))
