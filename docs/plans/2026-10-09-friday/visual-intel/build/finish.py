"""Write docs/plans/2026-10-09-friday/visual-intel/render.json from the renderer's figures.json and draw.py's draw.json.

Before writing, scans every visible word on each exhibit, its alt text and its caption for what the hard rules forbid:
em or en dashes, car and gear shorthand, American spellings, a bare multiplication sign.

Run: python3 -I /home/user/content-engine/.cache/visual-intel/scripts/finish.py
"""
import datetime as dt
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path('/home/user/content-engine')
OUT = ROOT / '.cache/visual-intel'
VI = ROOT / 'docs/plans/2026-10-09-friday/visual-intel'
EX = json.loads((VI / 'exhibits.json').read_text(encoding='utf-8'))
FIG = json.loads((OUT / 'figures.json').read_text(encoding='utf-8'))
DRAW = json.loads((OUT / 'draw.json').read_text(encoding='utf-8'))

FORBIDDEN = [
    (r'[—–]', 'an em or en dash'),
    (r'\bgears?\b|\blow gear\b|\bbadges?\b|\bcar\b|\bengine\b|\baccelerat', 'car shorthand'),
    (r'\bcolor|\blabeled\b|\bcenter\b|\banalyz|\bfavor|\bmodeling\b|\boptimiz', 'an American spelling'),
    (r'×', 'a multiplication sign'),
]


def visible_text(doc):
    body = doc.split('<div id="card">', 1)[1]
    body = re.sub(r'<style.*?</style>|<script.*?</script>', ' ', body, flags=re.S)
    body = re.sub(r'<title>.*?</title>', ' ', body, flags=re.S)       # the logo's accessible name, not drawn
    return html.unescape(re.sub(r'<[^>]+>', ' ', body))


problems = []
exhibits = []
figures = []
for e in sorted(EX['exhibits'], key=lambda x: x['order']):
    i = e['id']
    fig, drw = FIG[i], DRAW[i]
    doc = (OUT / f'{i}.html').read_text(encoding='utf-8')
    for where, words in (('exhibit', visible_text(doc)), ('alt', fig['alt']), ('caption', fig['caption'])):
        for pat, what in FORBIDDEN:
            m = re.search(pat, words, flags=re.I)
            if m:
                problems.append(f'{i}: {what} in the {where}: {m.group(0)!r}')
    if 'Intelligence Index (0 to 100' not in fig['caption'] and i != 'launches':
        problems.append(f'{i}: the caption names a score without its scale')
    if not drw['card_py']['passed'] or not drw['layout_checks']['passed']:
        problems.append(f'{i}: did not pass its checks')
    png = drw['png']
    entry = {'after': e['after'], 'image': png, 'alt': fig['alt'], 'caption': fig['caption']}
    figures.append(entry)
    exhibits.append({
        'id': i, 'order': e['order'], 'question': e['question'], 'heading': e['heading'],
        'after_section': e['after_section'], 'after_paragraph_number': e['after_paragraph_number'],
        'optional': e.get('optional', False),
        'html': drw['html'], 'png': png, 'phone_png': drw['phone_png'], 'size': drw['size'], 'png_sha256': drw['png_sha256'],
        'phone_check': {'passed': drw['card_py']['passed'], 'result': drw['card_py']['result'],
                        'runs_of_words': drw['card_py']['runs_of_words'], 'too_small': drw['card_py']['too_small'],
                        'command': drw['card_py']['command']},
        'layout_checks': {'passed': drw['layout_checks']['passed'], 'problems': drw['layout_checks']['problems'],
                          'what': 'no word crosses the 64 px side margins; no two runs of words overlap'},
        'logos': [EX['design_system']['logos'][k]['company'] for k in e['logos']],
        'figure': entry,
    })

if problems:
    print('PROBLEMS:')
    for p in problems:
        print('  -', p)
    sys.exit(1)

out = {
    'what_this_is': ('Friday\'s five Substack exhibits (mind.the.gap, "Why Claude and ChatGPT launches keep speeding up, and who '
                     'will decide how hard your AI thinks"), rendered from exhibits.json with every number computed from '
                     'data-final.json rows (by Artificial Analysis slug) and the spec\'s dated launch rows, and checked against '
                     'derived.json. Each was checked with scripts/pages/card.py at 1360 wide and looked at in full. Nothing '
                     'published, sent or committed; the article is unchanged.'),
    'built_at': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'article': 'docs/plans/2026-10-09-draft-body-v5.md (unchanged; every "after" is found once in it, and once in '
               'scripts/pages/build.py\'s plain text of it)',
    'spec': str(VI / 'exhibits.json'),
    'data': [str(VI / 'data-final.json'), str(VI / 'derived.json')],
    'how_to_redraw': [
        'python3 -I /home/user/content-engine/.cache/visual-intel/scripts/render.py',
        'python3 -I /home/user/content-engine/.cache/visual-intel/scripts/draw.py   (runs scripts/pages/card.py on each)',
        'python3 -I /home/user/content-engine/.cache/visual-intel/scripts/finish.py',
    ],
    'all_pass_phone_check': all(x['phone_check']['passed'] for x in exhibits),
    'exhibits': exhibits,
    'figures': figures,
    'notes': [
        ('Cost measure: plotted and printed as cost per task (Artificial Analysis\'s average cost to run one of its test '
         'tasks, in US dollars, at list prices), as exhibits.json sets it, because every dollar figure and multiple in the '
         'article is per task ($5.98 v $0.55, "about 11 times", "28% more"). Every exhibit and caption says so. The cost to '
         'run the full test set is kept beside each row in exhibits.json; the patterns hold on both.'),
        ('Changes from the spec\'s layout, made after looking at the renders: Exhibit 3 puts each panel\'s totals ("+15.3 '
         'points / for 10.9 times the cost") in a header above its plot instead of inside it, where they sat on the lines '
         'and gridlines, and keeps every title on one line; Exhibit 4 shows each new version\'s five levels as thin marks '
         'on a lighter band instead of dots, which overlapped; Exhibit 5 puts each row\'s score at the end of its bar line, '
         'because "Claude Haiku 5.5 at Medium *" pushed it past the right margin. Exhibit 2 keeps its two-line key under '
         'each panel title (it carries the release dates); every other mark is labelled directly.'),
        'Exhibit 1 is optional (exhibits.json: the other four stand alone).',
        ('From exhibits.json flags_for_krish, still open: no exhibit carries a Meta logo, so another picture in the pack must '
         'if the logo gate asks for it; Artificial Analysis is credited with its logo on Exhibits 2 to 5 but is not in '
         'config/logo-registry.json.'),
    ],
}
(VI / 'render.json').write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
print('wrote', VI / 'render.json', 'all_pass_phone_check', out['all_pass_phone_check'])
