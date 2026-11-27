"""Build docs/plans/2026-12-07-week/ideas.json from heroes.py, templates.py, offdays.py, carry.json and ids.json.
Keeps any fields the scoring steps already wrote onto an option (story, wildcard.distance, read_back) by id."""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import heroes  # noqa: E402
import templates  # noqa: E402

WEEK = HERE.parent
OUT = WEEK / 'ideas.json'
ids = json.loads((HERE / 'ids.json').read_text())
carry = json.loads((HERE / 'carry.json').read_text())
look = json.loads((WEEK / 'lookalike.json').read_text())
DROPPED = {'fri/samebook'}  # the engine's ingest gate dropped it as off-topic (via ingest_gate), so it is not an option

old = json.loads(OUT.read_text()) if OUT.exists() else {}
KEEP_FROM_OLD = ('story_score', 'score', 'order', 'read_back', 'distance', 'thin_week')


def old_option(day, oid, off=False):
    src = (old.get('offdays') if off else old.get('days')) or {}
    for o in src.get(day) or []:
        if str(o.get('id')) == str(oid):
            return o
    return {}


def hero(day, o):
    oid = ids[f'{day}/{o["key"]}']
    q, frm_find = o['pitch']['question'], o['research']
    opt = {
        'id': oid, 'source_kind': 'engine', 'source_tag': o['source_tag'],
        'so_what': o['so_what'], 'story': o['story'], 'why_now': o['why_now'], 'fact': o['fact'],
        'source': o['source'], 'sources': o.get('sources') or [],
        'first_reported': o.get('first_reported') or o['source']['url'],
        'beats': o['beats'], 'pitch': o['pitch'], 'style': o['style'],
        'research_prompt': heroes.rp(day, q.replace('Wildcard: ', ''), frm_find[0], frm_find[1]),
        'shape': o['shape'], 'dive': o['dive'], 'aim': o['aim'], 'funny': o['funny'], 'lookalike': o['lookalike'],
    }
    if o.get('wildcard'):
        prev = old_option(day, oid).get('wildcard') or {}
        opt['wildcard'] = {'kind': o['wild']['kind'], 'why_unexpected': o['wild']['why_unexpected']}
        if prev.get('distance') is not None and prev.get('why_unexpected') == o['wild']['why_unexpected']:
            opt['wildcard']['distance'] = prev['distance']
    prev = old_option(day, oid)
    for k in prev:
        if k not in opt and k not in ('recommended',):
            opt[k] = prev[k]
    return opt


def template(t):
    opt = {'id': t['id'], 'kind': 'meme', 'format': 'Meme template, your caption on the clip, 9:16 and 4:5',
           'source': {'label': t['label'], 'url': t['page']}, 'source_tag': 'instagram' if t['place'] == 'sheet' else 'trade_press',
           'copy': f"{t['what']} It becomes the AI moment the caption names, in the reader's world.",
           'hook': t['title'], 'pitch': {'see': t['what'], 'lands': t['why']},
           'aim': 'humour', 'shape': 'story', 'funny': t['funny'],
           'template': {'title': t['title'], 'clip': {'url': t['page'], 'page': t['page'], 'poster': None, 'seconds': t['seconds']},
                        'found': {'place': t['place'], 'label': t['label'], 'url': t['page']}, 'credit': t['credit'],
                        'what_happens': t['what'], 'why_it_works': t['why'], 'mechanism': t['mech'], 'moment': t['moment'], 'date': t['date']},
           'caption_ideas': t['caps']}
    prev = old_option(t['day'], t['id'], off=True)
    for k in prev:
        if k not in opt:
            opt[k] = prev[k]
    return opt


def build():
    days = {}
    for day, opts in heroes.DAYS.items():
        days[day] = [hero(day, o) for o in opts if f'{day}/{o["key"]}' not in DROPPED]
        if days[day]:
            days[day][0]['recommended'] = True
    offdays = {'tue': [], 'thu': [], 'sat': []}
    try:
        import offdays as od  # noqa: E402
        for day, opts in od.OFFDAYS.items():
            for o in opts:
                prev = old_option(day, o['id'], off=True)
                for k in prev:
                    if k not in o:
                        o[k] = prev[k]
                offdays[day].append(o)
    except ImportError:
        pass
    for t in templates.T:
        offdays[t['day']].append(template(t))
    about = ("The ideas board for the week of 7 December 2026, steps 1 to 7 of plan-week, run in a Claude Code session on 27 "
             "November 2026 (Krish asked for it in the session; the Sunday ideas workflow had failed its gate five runs running). "
             "Researched with web search and web fetch; the turn's shared web-search budget ran out part-way, so later research "
             "read outlet and vendor pages directly. Drive and Firecrawl were not used, so the Cold Ideas & Inspo folder was not "
             "read. Reddit could not be read for the meme templates (HTTP 403 from r/MemeTemplatesOfficial and r/memes), and "
             "Apify was not run (no paid run without his approval of that run). " + ' '.join(json.loads((WEEK / 'lookalike-input.json').read_text())['warnings']))
    data = {
        '_about': about, 'week_start': '2026-12-07', 'checked_on': '2026-11-27',
        'days': days, 'offdays': offdays,
        'considered': {'mon': 8, 'wed': 8, 'fri': 8},
        'accounted': carry['accounted'], 'held': carry['held'],
        'vetoes': [{'subject': 'Infosys', 'said': 'Told you already. Infosys is boring.', 'at': '2026-11-09', 'ref': '2026-11-16/queue/off-tue-infosys', 'day': 'tue'}],
        'split': [],
        'his_empty': {
            'mon': "Nothing of his fits Monday: no idea from Krish since 22 Nov, and his open money asks (ads in the chatbots) went out on the 23 Nov board.",
            'wed': "Nothing of his fits Wednesday: his ask on software editing itself has no dated creative-industry story this fortnight (held, with his words).",
            'fri': "Nothing of his fits Friday: his ask on AI correcting what people believed is held until a newer checked case lands.",
        },
    }
    for k in ('repeat_review', 'thin_week'):
        if old.get(k):
            data[k] = old[k]
    OUT.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    return data


if __name__ == '__main__':
    d = build()
    print('wrote', OUT, {k: len(v) for k, v in d['days'].items()}, {k: len(v) for k, v in d['offdays'].items()})
