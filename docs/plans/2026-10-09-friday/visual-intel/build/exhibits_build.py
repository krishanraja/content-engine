"""Write the design spec for Friday's Substack exhibits: visual-intel/exhibits.json.

Run: python3 -I /home/user/content-engine/.cache/visual-intel/scripts/exhibits_build.py

Reads only data-final.json, derived.json, the v5 article and the evidence file; writes only
docs/plans/2026-10-09-friday/visual-intel/exhibits.json (and, with --heights FILE, folds in the
text heights measured in a browser by measure_text.py). Every number shown on an exhibit is taken
from a confirmed Artificial Analysis row (by slug) or worked out here from those rows, with the
formula beside it. Nothing is published, sent or committed.
"""
import datetime
import json
import re
import sys
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

ROOT = Path('/home/user/content-engine')
PLAN = ROOT / 'docs/plans/2026-10-09-friday'
VI = PLAN / 'visual-intel'
ARTICLE = ROOT / 'docs/plans/2026-10-09-draft-body-v5.md'
EVIDENCE = PLAN / 'evidence-v3.md'
OUT = VI / 'exhibits.json'
NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

DATA = json.loads((VI / 'data-final.json').read_text(encoding='utf-8'))
DERIVED = json.loads((VI / 'derived.json').read_text(encoding='utf-8'))
ROWS = {r['slug']: r for r in DATA['rows']}
ARTICLE_TEXT = ARTICLE.read_text(encoding='utf-8')
PARAS = [p.strip() for p in ARTICLE_TEXT.split('\n\n') if p.strip()]
EVIDENCE_TEXT = EVIDENCE.read_text(encoding='utf-8')

problems = []


def D(x):
    return Decimal(str(x))


def r_half(x, places):
    q = Decimal(1).scaleb(-places)
    return D(x).quantize(q, rounding=ROUND_HALF_UP)


def pts(x):
    """Points on the index, one decimal, signed."""
    v = r_half(x, 1)
    return ('+' if v >= 0 else '') + f'{v}'


def times(x, places=1):
    return f'{r_half(x, places)}'


def usd(x):
    return f'${r_half(x, 2)}'


def row(slug):
    if slug not in ROWS:
        problems.append(f'slug not in data-final.json: {slug}')
        return {}
    r = ROWS[slug]
    return {
        'slug': slug,
        'creator': r['creator'],
        'model': r['model'],
        'thinking_level': r['thinking_level_label'],
        'score': r['score'],
        'cost_per_task_usd': r['cost_per_task_usd'],
        'cost_usd_full_test_set': r['cost_usd'],
        'release_date': r['release_date'],
        'aa_marks_deprecated': r['aa_marks_deprecated'],
        'page_url': r['page_url'],
        'api_read_at': r['api_field']['read_at'],
    }


def S(slug, key='score'):
    return ROWS[slug][key]


def C(slug):
    return ROWS[slug]['cost_per_task_usd']


def para(prefix):
    hits = [p for p in PARAS if p.startswith(prefix)]
    if len(hits) != 1:
        problems.append(f'paragraph starting {prefix!r} found {len(hits)} times')
        return ''
    return hits[0]


# ------------------------------------------------------------------ the models as Artificial Analysis lists them

LEVELS = ['Non-reasoning', 'Low', 'Medium', 'High', 'Xhigh', 'Max']
SLUGS = {
    'Claude Opus 5.5': ['claude-opus-5-5-low', 'claude-opus-5-5-medium', 'claude-opus-5-5-high', 'claude-opus-5-5-xhigh', 'claude-opus-5-5'],
    'Claude Opus 5': ['claude-opus-5-low', 'claude-opus-5-medium', 'claude-opus-5-high', 'claude-opus-5-xhigh', 'claude-opus-5'],
    'Claude Sonnet 5.5': ['claude-sonnet-5-5-low', 'claude-sonnet-5-5-medium', 'claude-sonnet-5-5-high', 'claude-sonnet-5-5-xhigh', 'claude-sonnet-5-5'],
    'Claude Haiku 5.5': ['claude-haiku-5-5-low', 'claude-haiku-5-5-medium', 'claude-haiku-5-5-high', 'claude-haiku-5-5-xhigh', 'claude-haiku-5-5'],
    'Claude Fable 5.1': ['claude-fable-5-1-low', 'claude-fable-5-1-medium', 'claude-fable-5-1-high', 'claude-fable-5-1-xhigh', 'claude-fable-5-1'],
    'GPT-6 Sol': ['gpt-6-sol-non-reasoning', 'gpt-6-sol-low', 'gpt-6-sol-medium', 'gpt-6-sol-high', 'gpt-6-sol-xhigh', 'gpt-6-sol'],
    'GPT-6.1 Sol': ['gpt-6-1-sol-low', 'gpt-6-1-sol-medium', 'gpt-6-1-sol-high', 'gpt-6-1-sol-xhigh', 'gpt-6-1-sol'],
}
for m, ss in SLUGS.items():
    for s in ss:
        if s not in ROWS or ROWS[s]['model'] != m:
            problems.append(f'{s} is not a {m} row')

CURRENT = [m for m in SLUGS if not ROWS[SLUGS[m][-1]]['aa_marks_deprecated']]

# ------------------------------------------------------------------ house look (scripts/pages/brand.py, config/studio.json)

studio = json.loads((ROOT / 'config/studio.json').read_text(encoding='utf-8'))
theme = [t for t in studio['brand_themes'] if (t.get('publication') or {}).get('house_style')][0]
TOK = theme['publication']['house_style']['tokens']
ACCENT = studio['series']['mind_the_gap']['accent']

PHONE_COLUMN, MIN_READ, MIN_FINE, WIDTH = 358, 14, 11, 1360
k = min(1.0, PHONE_COLUMN / WIDTH)
import math  # noqa: E402
READ_PX, FINE_PX = math.ceil(MIN_READ / k), math.ceil(MIN_FINE / k)

LOGO_DIR = PLAN / 'logos'


def logo(name, file, use):
    import hashlib
    p = LOGO_DIR / file
    if not p.exists():
        problems.append(f'logo missing: {p}')
        return {}
    return {'company': name, 'file': str(p.relative_to(ROOT)), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest(), 'use': use}


LOGOS = {
    'anthropic': logo('Anthropic', 'anthropic-symbol-cream.svg', 'symbol, 56 px tall, beside the Anthropic lane, panel or row group'),
    'openai': logo('OpenAI', 'openai-symbol-cream.svg', 'symbol, 56 px tall, beside the OpenAI lane, panel or row group'),
    'google': logo('Google', 'google-cream.svg', 'wordmark, 44 px tall, beside the Gemini row'),
    'aa': logo('Artificial Analysis', 'artificialanalysis-cream.svg', 'lockup, 44 px tall (402 x 44), first item of the source block: the credit'),
}

SCORE_SCALE = "Artificial Analysis's Intelligence Index, 0 to 100, higher is better"
COST_IS = "cost per task: Artificial Analysis's average cost to run one of its test tasks, in US dollars, at list prices"

DESIGN = {
    'canvas': {'width': WIDTH, 'height': 'per exhibit, set by its content (see each size); nothing clipped, no inner scroll',
               'background': TOK['ink'], 'padding': {'sides': 64, 'top': 64, 'bottom': 56}, 'content_width': WIDTH - 128},
    'phone_floor': {
        'why': 'scripts/pages/card.py: Substack shows a 1360-wide image at about 358 CSS pixels on a phone, so a word a reader needs must be drawn at '
               f'{READ_PX} px or more and fine print (sources, marked data-fine-print) at {FINE_PX} px or more. Every exhibit is checked with card.py before it becomes a PNG.',
        'words_min_px': READ_PX, 'fine_print_min_px': FINE_PX,
    },
    'faces': {
        'heading': 'Anton 400, 92 px, line-height 1.04, cream; one sentence of 72 to 81 characters, which sets as three lines at 1232 px (measured), the same shape on all five',
        'kicker': f'IBM Plex Mono 500, 42 px, letter-spacing 0.03em, upper case, {ACCENT}; one line, at most 46 characters (44 px with wider spacing wrapped to two lines when measured); marked data-fine-print (it is the source and date)',
        'standfirst': 'Archivo 500, 54 px, line-height 1.25, cream at 82%; says what is drawn, its scale and which way is better',
        'labels': 'Archivo 700, 54 to 60 px, cream or the series colour of the mark it names',
        'big_numbers': 'Anton 400, 72 to 96 px',
        'axis_ticks': 'IBM Plex Mono 500, 54 px, cream at 70%',
        'source_block': 'IBM Plex Mono 400, 42 px, line-height 1.3, cream at 70%, data-fine-print, under a 2 px rule of cream at 20%',
        'files': 'scripts/pages/brand.py FONT_FILES (node_modules/@fontsource*): Anton 400, Archivo variable, IBM Plex Mono 400/500/700 (no 600)',
    },
    'colours': {
        'ink': TOK['ink'], 'ink_soft': TOK['ink_soft'], 'cream': TOK['cream'], 'mint': TOK['mint'], 'mind_the_gap_accent': ACCENT,
        'grammar': {
            'mint': 'the answer: the mark the heading is about (the newest version, the lever that adds most, the step that pays)',
            'accent': f'{ACCENT}, mind.the.gap: the kicker, and where money buys little (the top step, the costly multiple, the callout ring)',
            'cream': 'words, and context marks at 45 to 60% (older versions, other models)',
            'grid': 'cream at 14%, 2 px; no chart borders, no shadows, no gradients',
        },
        'contrast': f'cream, mint and {ACCENT} on ink all pass 4.5:1; dashed context lines at 55% stay above 3:1',
    },
    'device': 'One device for all five, in the channel style (CHANNEL_HEADINGS): a numbered kicker "EXHIBIT N · SOURCE · DATE", then one heading of one shape, a short claim (or, for the last, a promise) naming the real products, then a one-line standfirst saying what is measured. Every chart labels its marks directly; no separate legend box.',
    'words': [
        "Thinking level is the term on every exhibit. Exhibit 2, the first data exhibit, defines it as what Anthropic calls effort and OpenAI calls reasoning.",
        "Settings are printed with Artificial Analysis's names: Non-reasoning (thinking off), Low, Medium, High, Xhigh (extra high, glossed once per exhibit), Max.",
        'No car, gear or badge words on any exhibit: the article carries the car; the charts carry the real setting names (ANALOGY_IN_SCRIPTS_ONLY).',
        'No em dashes or en dashes; British spelling; "times" in words, not a multiplication sign; a score always with its scale (PLAIN_SCORES).',
    ],
    'logos': LOGOS,
    'footer': 'Optional, fine print, right of the source block: "mind.the.gap · makeyourmindup"',
}

COST_MEASURE = {
    'plotted': 'cost_per_task_usd',
    'printed_as': COST_IS,
    'why': ('Every Artificial Analysis dollar figure and multiple in the article is cost per task ($5.98 v $0.55; "about two and a half times as much per task"; '
            '"another four and a half times"; "about 11 times"; "28% more"; "less than half the cost per task"), and Friday\'s video cards use cost per task too. '
            'An exhibit printed beside those sentences on the full-test-set cost would show 1.89, 5.35, 10.12, 1.45 and 0.38 times instead, so the reader would see two '
            'sets of numbers for one claim. data-final.json allows either, if the exhibit says which.'),
    'alternative': ('cost_usd (what it cost Artificial Analysis to run its full test set once, US dollars, at list prices) is kept beside every plotted row as '
                    'cost_usd_full_test_set, so any exhibit can be redrawn on it. Every pattern claimed below holds on both measures (checked: see checks).'),
}
SCORE_BASIS = ("The API's one-decimal score (data-final.json score; derived.json points_gained) throughout. Artificial Analysis's pages print whole numbers; "
               'never round a one-decimal figure again (29.5, 34.5 and 33.5 are rounding traps).')

# ------------------------------------------------------------------ exhibit 1: the launches (evidence-v3 P2-03, P2-04, P2-10)

ANTH = 'https://platform.claude.com/docs/en/about-claude/model-deprecations'
OAI_RN = 'https://help.openai.com/en/articles/6825453-chatgpt-release-notes'
OAI_MRN = 'https://help.openai.com/en/articles/9624314-model-release-notes'
LAUNCHES = [
    # (lane, date, names, source, label on chart)
    ('Anthropic', '2025-11-24', ['Claude Opus 4.5'], ANTH, None),
    ('Anthropic', '2026-02-05', ['Claude Opus 4.6'], ANTH, None),
    ('Anthropic', '2026-02-17', ['Claude Sonnet 4.6'], ANTH, None),
    ('Anthropic', '2026-04-07', ['Claude Mythos Preview (partners only)'], ANTH, None),
    ('Anthropic', '2026-04-16', ['Claude Opus 4.7'], ANTH, None),
    ('Anthropic', '2026-05-28', ['Claude Opus 4.8'], ANTH, 'Opus 4.8'),
    ('Anthropic', '2026-06-09', ['Claude Fable 5', 'Claude Mythos 5'], ANTH, None),
    ('Anthropic', '2026-06-30', ['Claude Sonnet 5'], ANTH, None),
    ('Anthropic', '2026-07-24', ['Claude Opus 5'], ANTH, 'Opus 5'),
    ('Anthropic', '2026-09-01', ['Claude Fable 5.1', 'Claude Mythos 5.1'], ANTH, None),
    ('Anthropic', '2026-09-22', ['Claude Opus 5.5'], ANTH, 'Opus 5.5'),
    ('Anthropic', '2026-09-28', ['Claude Sonnet 5.5'], ANTH, None),
    ('Anthropic', '2026-10-07', ['Claude Haiku 5.5'], ANTH, None),
    ('OpenAI', '2025-11-12', ['GPT-5.1 Instant', 'GPT-5.1 Thinking'], OAI_RN, 'GPT-5.1'),
    ('OpenAI', '2025-11-19', ['GPT-5.1 Pro'], OAI_RN, None),
    ('OpenAI', '2025-12-11', ['GPT-5.2'], OAI_RN, None),
    ('OpenAI', '2026-02-05', ['GPT-5.3-Codex'], OAI_MRN, None),
    ('OpenAI', '2026-03-03', ['GPT-5.3 Instant'], OAI_RN, None),
    ('OpenAI', '2026-03-05', ['GPT-5.4 Thinking'], OAI_RN, None),
    ('OpenAI', '2026-03-18', ['GPT-5.4 mini'], OAI_RN, None),
    ('OpenAI', '2026-04-09', ['GPT-5.3 Instant Mini'], OAI_RN, None),
    ('OpenAI', '2026-04-24', ['GPT-5.5'], 'OpenAI GPT-5.5 post, "Update on April 24, 2026" (developer availability); its 23 April ChatGPT date is from press coverage only', None),
    ('OpenAI', '2026-05-05', ['GPT-5.5 Instant'], OAI_RN, None),
    ('OpenAI', '2026-07-06', ['GPT-5.5 Instant Mini'], OAI_RN, None),
    ('OpenAI', '2026-07-09', ['GPT-5.6 Sol in ChatGPT'], OAI_MRN, None),
    ('OpenAI', '2026-09-03', ['GPT-6 Astra'], OAI_RN, None),
    ('OpenAI', '2026-09-22', ['GPT-6 Sol', 'GPT-6 Luna (Work and Codex)'], OAI_RN, None),
    ('OpenAI', '2026-09-29', ['GPT-6.1 Sol'], OAI_RN, 'GPT-6.1 Sol'),
    ('OpenAI', '2026-10-07', ['GPT-6 in ChatGPT'], OAI_RN, None),
]
for _lane, _date, _names, _src, _lab in LAUNCHES:
    # every launch name must be in the evidence file's cadence entries
    base = _names[0].replace(' (partners only)', '').replace('Claude ', '').replace(' in ChatGPT', '').replace(' (Work and Codex)', '')
    if base.split(' ')[0] not in EVIDENCE_TEXT:
        problems.append(f'launch {base} not found in evidence-v3.md')
anth_days = sorted({d for l, d, *_ in LAUNCHES if l == 'Anthropic'})
oai_days = sorted({d for l, d, *_ in LAUNCHES if l == 'OpenAI'})
anth_names = sum(len(n) for l, d, n, *_ in LAUNCHES if l == 'Anthropic')
all_days = sorted(set(anth_days) | set(oai_days))
first, last = datetime.date.fromisoformat(all_days[0]), datetime.date.fromisoformat(all_days[-1])
weeks_span = (last - first).days / 7
cluster = [d for d in all_days if '2026-09-22' <= d <= '2026-10-07']
cluster_launches = [(l, d) for l, d, *_ in LAUNCHES if '2026-09-22' <= d <= '2026-10-07']
assert len(anth_days) == 13 and anth_names == 15, (len(anth_days), anth_names)
assert len(oai_days) == 16, len(oai_days)
assert len(all_days) == 26, len(all_days)
assert len(cluster_launches) == 6, cluster_launches
half = '2026-04-16'
anth_first_half = len([d for d in anth_days if d < half])
anth_second_half = len([d for d in anth_days if d >= half])

E1 = {
    'id': 'launches',
    'order': 1,
    'optional': True,
    'optional_why': ('Krish asked for model v thinking level v cost; this one sets up the story\'s first beat ("so many recent AI model releases") from the '
                     'evidence file. Drop it if the page needs fewer figures: the other four stand alone. It is a dated record, unlike the pile-up of page screenshots, '
                     'so the two can sit together or this can replace it.'),
    'question': 'How often are Anthropic and OpenAI putting out new models?',
    'kicker': 'EXHIBIT 1 · ANTHROPIC, OPENAI · 15 OCT 2026',
    'heading': 'Anthropic and OpenAI put out a new model about every two weeks for a year',
    'standfirst': 'Each dot is a day one of them launched a new model, as dated on its own pages.',
    'takeaway': (f'Between them the two labs launched new models on at least {len(all_days)} days in under a year, and six of those launches came in the 16 days '
                 'from 22 September to 7 October 2026.'),
    'notes': [
        {'text': 'GPT-5.5 is dated 24 April 2026, the date its OpenAI post gives.', 'placement': 'source block, second line'},
    ],
    'chart': {
        'type': 'two-lane dot timeline (a strip plot on a date axis)',
        'encoding': {
            'x': 'date, linear, 1 Nov 2025 to 15 Oct 2026, full content width (1232 px, about 103 px a month)',
            'lanes': 'two horizontal lanes, Anthropic above OpenAI, each a 2 px cream-at-30% rule with its logo and label above it',
            'mark': 'one filled dot, 30 px, per launch day; a day with two new names is still one dot (counts are in the lane label)',
            'colour': 'cream dots; the five the article names (Opus 4.8, Opus 5, Opus 5.5, GPT-5.1, GPT-6.1 Sol) in mint with a direct label; the 22 Sep to 7 Oct cluster on a band of the accent colour at 16% behind both lanes, a 5 px accent rule along its top and its label above that, right-aligned',
            'stacking': 'dots closer than 32 px stack upward in 32 px steps (3 and 5 Mar, 7 and 16 Apr, 6 and 9 Jul, 22 Sep), so every launch day stays countable',
        },
        'axis': {'ticks': 'a 12 px tick at the first of every month', 'tick_labels': ['Nov', 'Jan', 'Mar', 'May', 'Jul', 'Sep'],
                 'year_labels': {'Nov': '2025', 'Jan': '2026'}, 'font': 'IBM Plex Mono 500, 54 px'},
        'lane_labels': {
            'Anthropic': f'Anthropic: {anth_names} new Claude names on {len(anth_days)} days',
            'OpenAI': f'OpenAI: at least {len(oai_days)} launch days',
        },
        'point_labels': [
            {'lane': l, 'date': d, 'text': lab, 'placement': {'Opus 4.8': 'below the lane, first tier, right edge at the dot', 'Opus 5': 'below the lane, first tier, centred', 'Opus 5.5': 'below the lane, second tier, right edge at the dot', 'GPT-5.1': 'below the lane, left edge at the dot', 'GPT-6.1 Sol': 'below the lane, right edge at the dot'}[lab] + '; a 2 px mint leader from the dot; tiers 96 and 162 px below the lane'}
            for l, d, n, s, lab in LAUNCHES if lab
        ],
        'annotations': [
            {'kind': 'bracket', 'from': '2026-09-22', 'to': '2026-10-07', 'spans': 'both lanes', 'colour': ACCENT,
             'text': '6 launches in 16 days', 'placement': 'its own row above the Anthropic lane label, right edge at the band\'s right edge'},
        ],
    },
    'data': {
        'kind': 'dated launches from the companies\' own pages (evidence-v3.md P2-03 and P2-04, checker-confirmed or corrected; the cluster is P2-10)',
        'rows': [{'lane': l, 'date': d, 'names': n, 'source': s} for l, d, n, s, lab in LAUNCHES],
        'derived': [
            {'what': 'Anthropic launch days and new names, 16 Oct 2025 to 15 Oct 2026', 'value': {'days': len(anth_days), 'names': anth_names},
             'formula': 'count of rows in lane Anthropic; names counted one by one (Fable 5 and Mythos 5 share a day, as do Fable 5.1 and Mythos 5.1)'},
            {'what': 'OpenAI launch days dated on its release notes, 12 Nov 2025 to 7 Oct 2026', 'value': len(oai_days),
             'formula': 'count of rows in lane OpenAI; "at least" because the list holds the dated entries the evidence found, not a complete catalogue'},
            {'what': 'launch days, both labs', 'value': len(all_days), 'formula': f'union of the two lanes ({len(anth_days)} + {len(oai_days)} - 3 shared days: 5 Feb, 22 Sep, 7 Oct)'},
            {'what': 'weeks per launch day', 'value': round(weeks_span / (len(all_days) - 1), 2),
             'formula': f'{all_days[0]} to {all_days[-1]} is {weeks_span:.1f} weeks; {len(all_days) - 1} gaps between {len(all_days)} days, so about every two weeks'},
            {'what': 'launches 22 Sep to 7 Oct 2026', 'value': len(cluster_launches), 'formula': 'one per lane per day: Opus 5.5, GPT-6 Sol and Luna (22 Sep), Sonnet 5.5 (28 Sep), GPT-6.1 Sol (29 Sep), Haiku 5.5 and GPT-6 in ChatGPT (7 Oct)'},
            {'what': 'Anthropic launch days before and after 16 Apr 2026 (for the story, not printed)', 'value': {'before': anth_first_half, 'after': anth_second_half},
             'formula': 'count by half year'},
        ],
    },
    'source_line': ('Sources: Anthropic, model deprecations table and launch pages; OpenAI, ChatGPT and model release notes; read 15 Oct 2026. '
                    'Days counted by us.'),
    'logos': ['anthropic', 'openai'],
    'size': {'width': WIDTH, 'height_estimate': 1520},
    'alt': ('Timeline from November 2025 to October 2026. Anthropic launched 15 new Claude models on 13 days, including Opus 4.8 in May, Opus 5 in July and '
            'Opus 5.5 in September. OpenAI launched models on at least 16 days, from GPT-5.1 in November 2025 to GPT-6.1 Sol in September 2026. Six launches '
            'came between 22 September and 7 October 2026.'),
}

# ------------------------------------------------------------------ exhibit 2: the hero map

def rng(m):
    ss = SLUGS[m]
    lo, hi = ss[0], ss[-1]
    return {'from': lo, 'to': hi, 'points': round(S(hi) - S(lo), 1), 'cost_times_per_task': float(r_half(C(hi) / C(lo), 2)),
            'cost_times_full_test_set': float(r_half(ROWS[hi]['cost_usd'] / ROWS[lo]['cost_usd'], 2))}


def upgrade(old, new):
    out = []
    for so, sn in zip(SLUGS[old][-5:], SLUGS[new][-5:]):
        assert ROWS[so]['thinking_level'] == ROWS[sn]['thinking_level']
        out.append({'level': ROWS[sn]['thinking_level_label'], 'from': so, 'to': sn, 'points': round(S(sn) - S(so), 1),
                    'cost_times_per_task': float(r_half(C(sn) / C(so), 2)),
                    'cost_times_full_test_set': float(r_half(ROWS[sn]['cost_usd'] / ROWS[so]['cost_usd'], 2))})
    return out


R = {m: rng(m) for m in SLUGS}
UP_OPUS = upgrade('Claude Opus 5', 'Claude Opus 5.5')
UP_GPT = upgrade('GPT-6 Sol', 'GPT-6.1 Sol')
think_pts = [R[m]['points'] for m in ('Claude Opus 5', 'Claude Opus 5.5', 'GPT-6 Sol', 'GPT-6.1 Sol')]
think_x = [R[m]['cost_times_per_task'] for m in ('Claude Opus 5', 'Claude Opus 5.5', 'GPT-6 Sol', 'GPT-6.1 Sol')]
ver_pts = [u['points'] for u in UP_OPUS + UP_GPT]
cheaper = sum(1 for u in UP_OPUS + UP_GPT if u['cost_times_per_task'] < 1)
cheaper_full = sum(1 for u in UP_OPUS + UP_GPT if u['cost_times_full_test_set'] < 1)
assert min(think_pts) > max(ver_pts), (think_pts, ver_pts)

E2 = {
    'id': 'model-or-thinking-level',
    'order': 2,
    'hero': True,
    'question': 'Which changes the score more, a new model version or the thinking level, and what does each cost?',
    'kicker': 'EXHIBIT 2 · ARTIFICIAL ANALYSIS · 17 OCT 2026',
    'heading': 'Turning up the thinking lifted Claude and GPT more than a new version did',
    'standfirst': ('Each line is one model, from its lowest thinking level (what Anthropic calls effort and OpenAI calls reasoning) to its highest.'),
    'takeaway': (f'On Artificial Analysis\'s 0 to 100 index, each line climbs {min(think_pts)} to {max(think_pts)} points from its lowest to its highest thinking level, while the newer version sits only '
                 f'{min(ver_pts)} to {max(ver_pts)} points above the older one at the same level, and mostly to its left, because it costs less to run.'),
    'notes': [
        {'text': "Max is a developer setting; ChatGPT's highest is Extra High.", 'placement': 'fine print under the OpenAI panel, left-aligned'},
        {'text': 'Artificial Analysis now lists Claude Opus 5 and GPT-6 Sol as deprecated; results as measured.', 'placement': 'source block, second sentence'},
    ],
    'chart': {
        'type': 'connected scatter, two stacked panels on the same axes (small multiples), one per company',
        'why_two_panels': ('At the 54 px phone floor, four lines in one plot collide where GPT-6 Sol at Xhigh ($0.52, 44.2) sits on Opus 5.5 at Low ($0.55, 42.3). '
                           'Two panels with identical axes keep every label legible and still let the eye compare across them.'),
        'encoding': {
            'x': 'cost per task, US dollars, log scale, domain $0.05 to $10 over the full 1232 px (the extra room left of $0.10 holds the Low labels); labelled gridlines at $0.10, $1 and $10, faint unlabelled ones at $0.30 and $3',
            'y': f'{SCORE_SCALE}; domain 24 to 62 over a 470 px plot, gridlines at 30, 40, 50, 60 with their numbers inside the plot at the left, above each line (a line chart, so the axis need not start at zero)',
            'lines': 'one line per model version, joining its settings in order (Non-reasoning, Low, Medium, High, Xhigh, Max), so moving along a line is turning up the thinking and the gap between lines is the new version',
            'newer_version': f'mint {TOK["mint"]}, 8 px solid line, 26 px filled dots',
            'older_version': 'cream at 55%, 6 px dashed line (16 on, 12 off), 24 px hollow dots with a 5 px ring',
            'direction': 'draw lines in setting order, never sorted by cost: GPT-6 Sol runs left from Non-reasoning to Low, because thinking off cost more to run',
        },
        'panels': [
            {'company': 'Anthropic', 'logo': 'anthropic', 'title': 'Claude Opus',
             'lines': [
                 {'model': 'Claude Opus 5.5', 'style': 'newer_version', 'label': 'Claude Opus 5.5 · 22 Sep 2026', 'slugs': SLUGS['Claude Opus 5.5']},
                 {'model': 'Claude Opus 5', 'style': 'older_version', 'label': 'Claude Opus 5 · 24 Jul 2026', 'slugs': SLUGS['Claude Opus 5']},
             ],
             'key': 'under the panel title, one line each with its swatch: "Claude Opus 5.5 · 22 Sep 2026" (mint) and "Claude Opus 5 · 24 Jul 2026" (cream at 75%)',
             'end_labels': 'setting names beside the end dots, 54 px Archivo 700 in the line\'s colour: Opus 5.5 "Low" left of its dot and "Max" above it; Opus 5 "Low" left of its dot and "Max" right of it',
             'callout': {'rings': ['claude-opus-5', 'claude-opus-5-5-low'], 'ring': f'{ACCENT}, 5 px, 44 px across',
                         'text': 'Opus 5 at Max beat Opus 5.5 at Low', 'placement': 'two lines ("Opus 5 at Max beat" / "Opus 5.5 at Low") in the empty lower right, from x 760; a straight 2 px leader down from the Opus 5 Max ring, and an L-shaped one down from the Opus 5.5 Low ring then right to the text, so neither crosses a label'}},
            {'company': 'OpenAI', 'logo': 'openai', 'title': 'GPT Sol',
             'lines': [
                 {'model': 'GPT-6.1 Sol', 'style': 'newer_version', 'label': 'GPT-6.1 Sol · 29 Sep 2026', 'slugs': SLUGS['GPT-6.1 Sol']},
                 {'model': 'GPT-6 Sol', 'style': 'older_version', 'label': 'GPT-6 Sol · 22 Sep 2026', 'slugs': SLUGS['GPT-6 Sol']},
             ],
             'key': 'under the panel title: "GPT-6.1 Sol · 29 Sep 2026" (mint) and "GPT-6 Sol · 22 Sep 2026" (cream at 75%)',
             'end_labels': 'GPT-6.1 Sol: "Low" left of its dot, "Max" above it. GPT-6 Sol: "Low" left of its dot, "Max" right of it; its Non-reasoning dot is named by the callout',
             'callout': {'rings': ['gpt-6-sol-non-reasoning'], 'ring': f'{ACCENT}, 5 px, 44 px across',
                         'text': 'Non-reasoning (thinking off) cost more to run than Low', 'placement': 'two lines ("Non-reasoning (thinking off)" / "cost more to run than Low") starting 50 px right of the ring, in the empty right half'}},
        ],
        'axes_text': {
            'y_title': 'Intelligence Index, 0 to 100, higher is better',
            'x_title': 'Cost per task, US dollars, log scale: each labelled gridline is 10 times the last',
            'x_ticks': ['$0.10', '$1', '$10'],
            'y_ticks': ['30', '40', '50', '60'],
            'placement': 'y title set horizontally above each panel\'s plot, left-aligned (never rotated); x ticks and title under the lower panel only, the upper panel keeps the gridlines',
        },
        'layout_px': {'heading_block': 'about 560', 'panel': 'title row 80 + plot 470', 'between_panels': 40, 'x_axis_block': 150, 'source_block': 'about 230'},
    },
    'data': {
        'rows': [row(s) for m in ('Claude Opus 5.5', 'Claude Opus 5', 'GPT-6.1 Sol', 'GPT-6 Sol') for s in SLUGS[m]],
        'derived': [
            {'what': f'{m}, lowest to highest thinking level', **R[m],
             'formula': 'points: score(to) - score(from); cost_times_per_task: cost_per_task_usd(to) / cost_per_task_usd(from)'}
            for m in ('Claude Opus 5.5', 'Claude Opus 5', 'GPT-6.1 Sol', 'GPT-6 Sol')
        ] + [
            {'what': 'Claude Opus 5 to Claude Opus 5.5 at each matched level', 'by_level': UP_OPUS, 'formula': 'derived.json model_upgrades_matched_level; points and cost multiple as above'},
            {'what': 'GPT-6 Sol to GPT-6.1 Sol at each matched level', 'by_level': UP_GPT, 'formula': 'as above; GPT-6.1 Sol has no Non-reasoning setting on Artificial Analysis'},
            {'what': 'callout: Opus 5 at Max v Opus 5.5 at Low', 'value': {'opus_5_max': S('claude-opus-5'), 'opus_5_5_low': S('claude-opus-5-5-low')},
             'formula': 'score(claude-opus-5) > score(claude-opus-5-5-low)', 'holds': S('claude-opus-5') > S('claude-opus-5-5-low')},
            {'what': 'callout: GPT-6 Sol thinking off v Low, cost per task', 'value': {'non_reasoning': C('gpt-6-sol-non-reasoning'), 'low': C('gpt-6-sol-low')},
             'formula': 'cost_per_task_usd(gpt-6-sol-non-reasoning) > cost_per_task_usd(gpt-6-sol-low); also true on the full test set ($449.37 v $268.73)',
             'holds': C('gpt-6-sol-non-reasoning') > C('gpt-6-sol-low')},
        ],
    },
    'source_line': ('Source: Artificial Analysis Intelligence Index v4.3.2, read 17 Oct 2026. Cost per task: its average cost to run one test task, '
                    'US dollars at list prices.'),
    'logos': ['anthropic', 'openai', 'aa'],
    'size': {'width': WIDTH, 'height_estimate': 2140},
    'alt': ('Two charts of score against cost per task. Claude Opus 5.5 rises from 42.3 at Low ($0.55 a task) to 57.6 at Max ($5.98); Claude Opus 5, released two '
            'months earlier, runs from 39.4 to 50.8 and costs more at most levels. GPT-6 Sol rises from 28.5 with thinking off to 47.6 at Max; GPT-6.1 Sol, a week newer, '
            'runs from 42.1 at Low to 51.8 at Max and costs less at every level.'),
}

# ------------------------------------------------------------------ exhibit 3: each step buys less per dollar

E3_MODELS = ['Claude Opus 5.5', 'Claude Sonnet 5.5', 'Claude Haiku 5.5', 'Claude Fable 5.1', 'GPT-6.1 Sol', 'GPT-6 Sol']


def ladder(m):
    ss = [s for s in SLUGS[m] if ROWS[s]['thinking_level'] != 'off']
    base = C(ss[0])
    pts0 = S(ss[0])
    pts_list = []
    for s in ss:
        pts_list.append({'slug': s, 'level': ROWS[s]['thinking_level_label'], 'x_times_low_cost': float(r_half(C(s) / base, 2)),
                         'y_points_added': round(S(s) - pts0, 1)})
    steps = []
    for a, b in zip(ss, ss[1:]):
        dp = round(S(b) - S(a), 1)
        dc = C(b) - C(a)
        steps.append({'from': ROWS[a]['thinking_level_label'], 'to': ROWS[b]['thinking_level_label'], 'points': dp,
                      'extra_cost_per_task_usd': float(r_half(dc, 4)), 'extra_cost_per_point_usd': float(r_half(dc / dp, 4)),
                      'step_cost_times_per_task': float(r_half(C(b) / C(a), 2)),
                      'extra_cost_per_point_full_test_set_usd': float(r_half((ROWS[b]['cost_usd'] - ROWS[a]['cost_usd']) / dp, 2))})
    return pts_list, steps


LAD = {m: ladder(m) for m in E3_MODELS + ['Claude Opus 5']}
for m, (pl, st) in LAD.items():
    per = [s['extra_cost_per_point_usd'] for s in st]
    per_full = [s['extra_cost_per_point_full_test_set_usd'] for s in st]
    if not all(a < b for a, b in zip(per, per[1:])):
        problems.append(f'E3: cost per extra point does not rise at every step for {m}: {per}')
    if not all(a < b for a, b in zip(per_full, per_full[1:])):
        problems.append(f'E3 (full test set): cost per extra point does not rise at every step for {m}: {per_full}')
for m, (pl, st) in LAD.items():
    if not st[-1]['points'] < st[0]['points']:
        problems.append(f'E3: top step does not add fewer points than the first for {m}')
op = LAD['Claude Opus 5.5'][1]
op_pts = LAD['Claude Opus 5.5'][0]


def end_label(m):
    pl, st = LAD[m]
    return {'model': m, 'line1': f'{pts(pl[-1]["y_points_added"])} points', 'line2': f'{times(pl[-1]["x_times_low_cost"])} times the cost'}


fable_last = LAD['Claude Fable 5.1'][1][-1]
E3 = {
    'id': 'each-step-buys-less',
    'order': 3,
    'question': 'Is each step up in thinking level worth what it costs?',
    'kicker': 'EXHIBIT 3 · ARTIFICIAL ANALYSIS · 17 OCT 2026',
    'heading': 'Each step up in thinking buys Claude and GPT less for every extra dollar',
    'standfirst': 'One model per panel, its thinking level rising from Low to Max. The last step, Xhigh (extra high) to Max, is in coral.',
    'takeaway': (f'On Artificial Analysis\'s 0 to 100 index, in all six, every step up added fewer points per extra dollar than the one before: Claude Opus 5.5\'s first step added {op[0]["points"]} points '
                 f'for {times(op[0]["step_cost_times_per_task"])} times the cost, its last {op[-1]["points"]} points for '
                 f'{times(op[-1]["step_cost_times_per_task"])} times.'),
    'notes': [
        {'text': "* Artificial Analysis says Claude Haiku 5.5's costs are understated: its 5 times higher price for long inputs is left out.",
         'placement': 'fine print inside the Claude Haiku 5.5 panel, under its title (the title carries the *)'},
        {'text': 'Starts at Low: with thinking off it cost more to run than at Low.', 'placement': 'fine print inside the GPT-6 Sol panel, under its title'},
        {'text': 'Claude Opus 5, now listed as deprecated, shows the same pattern.', 'placement': 'source block, last sentence'},
    ],
    'chart': {
        'type': 'small multiples: six connected line charts on shared axes, two columns by three rows',
        'why': ('On a straight (not log) cost axis a run of diminishing returns is a curve that flattens; every one of the six flattens at every step. '
                'Indexing cost to each model\'s own Low setting puts a $0.02 model and a $7 model on one scale without hiding either.'),
        'encoding': {
            'x': 'cost per task as a multiple of the model\'s own Low cost, linear, 1 to 16; gridlines at 1, 4, 8, 12, 16',
            'y': 'points added since Low on the Intelligence Index, 0 to 21; gridlines at 0, 10, 20',
            'line': 'dots at each setting (Low, Medium, High, Xhigh, Max) joined in order; segments Low to Xhigh in mint, 7 px; the last segment, Xhigh to Max, in the accent colour, 7 px',
            'dots': '20 px, mint; the Max dot in the accent colour',
            'shared': 'same x and y in all six panels, so slopes and lengths compare; y tick labels on the left column only, x tick labels on the bottom row only',
        },
        'panels': [{'model': m, 'logo': 'openai' if m.startswith('GPT') else 'anthropic', 'title': m, 'end_label': end_label(m),
                    'points': LAD[m][0]} for m in E3_MODELS],
        'panel_px': {'width': 600, 'gap': 32, 'row_gap': 44, 'title_row': 70, 'plot': 300, 'x_domain': '1 to 16 over 600 px', 'y_domain': '0 to 22 over 300 px', 'end_label': 'two lines of 54 px inside the plot, right-aligned at the lower right; every line leaves that corner empty'},
        'panel_titles': {'Claude Haiku 5.5': 'Claude Haiku 5.5 *', 'GPT-6 Sol': 'GPT-6 Sol, from Low'},
        'annotations': [
            {'panel': 'Claude Fable 5.1', 'text': f'Last step: {pts(fable_last["points"])} points for {int(r_half((fable_last["step_cost_times_per_task"] - 1) * 100, 0))}% more',
             'placement': 'two lines ("Last step: +0.2 points" / "for 28% more"), right-aligned at the top right of the Fable panel, 54 px, accent colour', 'matches_article': 'On Fable 5.1, it costs 28% more and barely moves the score.'},
        ],
        'axes_text': {'x_title': "Cost per task, times the model's Low cost", 'y_title': 'Points added on the Intelligence Index (0 to 100)',
                      'x_ticks': ['1', '4', '8', '12', '16'], 'y_ticks': ['0', '10', '20'],
                      'placement': 'y title once, above the grid, left-aligned; x title once, under the bottom row'},
    },
    'data': {
        'rows': [row(s) for m in E3_MODELS for s in SLUGS[m] if ROWS[s]['thinking_level'] != 'off'],
        'derived': [
            {'what': f'{m}: each step up from Low', 'points_from_low': LAD[m][0], 'steps': LAD[m][1],
             'formula': ('x_times_low_cost: cost_per_task_usd(level) / cost_per_task_usd(Low); y_points_added: score(level) - score(Low); '
                         'extra_cost_per_point_usd: (cost_per_task_usd(to) - cost_per_task_usd(from)) / (score(to) - score(from)). Not printed: '
                         'it is the slope the chart draws, and it rises at every step for every model (checked on both cost measures and on the unrounded scores)')}
            for m in E3_MODELS
        ] + [{'what': 'Claude Opus 5 (deprecated, not drawn): same check', 'steps': LAD['Claude Opus 5'][1], 'formula': 'as above; it rises at every step too'}],
        'not_printed_why': ('Cost per extra point is not printed as a number: on the one-decimal scores Fable 5.1\'s last step is 0.2 points, so a per-point price '
                            '($8.26 on one-decimal scores, $10.89 on the unrounded ones) is too sensitive to rounding to print. The slope says it without the number.'),
    },
    'source_line': ('Source: Artificial Analysis Intelligence Index v4.3.2, read 17 Oct 2026. Cost per task in US dollars at list prices. '
                    'Points and multiples: our arithmetic.'),
    'logos': ['anthropic', 'openai', 'aa'],
    'size': {'width': WIDTH, 'height_estimate': 2050},
    'alt': ('Six small line charts, one per model, of points added against cost as a multiple of the Low setting. Every line climbs steeply at first and flattens at '
            'each step. Claude Opus 5.5 adds 15.3 points for 10.9 times the cost; Claude Sonnet 5.5 adds 20.1 for 15.8 times; Claude Haiku 5.5 13.9 for 8.7 times; '
            'Claude Fable 5.1 6.6 for 3.2 times, its last step adding 0.2 points for 28% more; GPT-6.1 Sol 9.7 for 5.5 times; GPT-6 Sol 13.4 for 7.9 times.'),
}

# ------------------------------------------------------------------ exhibit 4: new version or more thinking

def span(ups):
    p = [u['points'] for u in ups]
    c = [u['cost_times_per_task'] for u in ups]
    return min(p), max(p), min(c), max(c), sum(1 for x in c if x < 1)


op_lo, op_hi, opc_lo, opc_hi, op_cheaper = span(UP_OPUS)
gp_lo, gp_hi, gpc_lo, gpc_hi, gp_cheaper = span(UP_GPT)


def lvl_at(ups, value):
    return [u['level'] for u in ups if u['points'] == value][0]


def tile_more(m, family):
    return {'row': family, 'column': 'More thinking, same model', 'model': m,
            'big_number': pts(R[m]['points']), 'big_colour': 'mint',
            'under': f'points, {m.replace("Claude ", "")} from {ROWS[SLUGS[m][0]]["thinking_level_label"]} to Max',
            'bar': {'kind': 'solid', 'to': R[m]['points'], 'colour': 'mint'},
            'cost': f'{times(R[m]["cost_times_per_task"])} times the cost per task', 'cost_colour': 'accent',
            'slugs': [SLUGS[m][0], SLUGS[m][-1]]}


def tile_new(old, new, ups, family, note):
    lo, hi, clo, chi, n_cheaper = span(ups)
    return {'row': family, 'column': 'New version, same thinking level', 'model': f'{old} to {new}',
            'big_number': f'{pts(lo)} to {pts(hi)}', 'big_colour': 'cream',
            'under': f'points, {old.replace("Claude ", "")} to {new.replace("Claude ", "")} at each level',
            'bar': {'kind': 'range', 'solid_to': lo, 'outline_to': hi, 'dots_at': [u['points'] for u in ups], 'colour': 'cream'},
            'cost': f'{times(clo, 2)} to {times(chi, 2)} times the cost: {note}', 'cost_colour': 'mint',
            'slugs': [u['from'] for u in ups] + [u['to'] for u in ups]}


assert gp_cheaper == len(UP_GPT)
E4_TILES = [
    tile_more('Claude Opus 5.5', 'Anthropic · Claude Opus'),
    tile_new('Claude Opus 5', 'Claude Opus 5.5', UP_OPUS, 'Anthropic · Claude Opus', f'cheaper at {op_cheaper} of {len(UP_OPUS)} levels'),
    tile_more('GPT-6.1 Sol', 'OpenAI · GPT Sol'),
    tile_new('GPT-6 Sol', 'GPT-6.1 Sol', UP_GPT, 'OpenAI · GPT Sol', 'cheaper at every level'),
]
newest_pts = [R[m]['points'] for m in ('Claude Opus 5.5', 'GPT-6.1 Sol')]
newest_x = [R[m]['cost_times_per_task'] for m in ('Claude Opus 5.5', 'GPT-6.1 Sol')]
assert min(newest_pts) > max(ver_pts)
E4 = {
    'id': 'new-version-or-more-thinking',
    'order': 4,
    'question': 'Which buys more intelligence for the money: a new model version or a higher thinking level?',
    'kicker': 'EXHIBIT 4 · ARTIFICIAL ANALYSIS · 17 OCT 2026',
    'heading': 'A new Claude Opus or GPT Sol adds fewer points than more thinking, but costs less',
    'standfirst': 'Points each change added on the Intelligence Index (0 to 100), and what it did to the cost per task.',
    'takeaway': (f'On Artificial Analysis\'s 0 to 100 index, more thinking on the newest Claude Opus and GPT Sol added {min(newest_pts)} to {max(newest_pts)} points for '
                 f'{times(min(newest_x))} to {times(max(newest_x))} times the cost per task; the new version added {min(ver_pts)} to {max(ver_pts)} '
                 f'points at the same level and cost less at {cheaper} of the {len(ver_pts)} levels.'),
    'notes': [
        {'text': f'GPT-6 Sol, from thinking off (Non-reasoning) to Max: {pts(R["GPT-6 Sol"]["points"])} points for {times(R["GPT-6 Sol"]["cost_times_per_task"])} times the cost. '
                 f'GPT-6.1 Sol has no thinking-off setting.', 'placement': 'fine print under the OpenAI row'},
        {'text': 'Claude Opus 5 and GPT-6 Sol are now listed as deprecated; results as measured.', 'placement': 'source block, last sentence'},
    ],
    'chart': {
        'type': 'a two by two grid of stat tiles (rows: Claude Opus, GPT Sol; columns: more thinking, new version), each with a big number, a bar on one shared points scale, and its cost',
        'why': ('The question is a straight comparison of two levers on two model lines, so a grid answers it at a glance: the left column\'s numbers and bars are '
                'longer, the right column\'s costs are lower. A bar chart with six labelled rows ran past 2,500 px at the phone floor.'),
        'encoding': {
            'grid': 'two columns of 600 px with a 32 px gutter; a two-line column head over each, 54 px ("More thinking" in mint over "same model"; "A new version" in cream over "same thinking level", second lines Archivo 500 at 70%); a row head with the company logo (56 px) and the model line (60 px Archivo 700) over each row',
            'tile': f'{TOK["ink_soft"]} fill, 12 px corners, 40 px padding; contents top to bottom: big number (Anton 104 px), what it is (54 px Archivo 500, up to 2 lines), bar, cost (54 px Archivo 700, up to 2 lines)',
            'bar': ('one shared scale in every tile: 0 to 20 points over 520 px (26 px a point), 40 px tall, on a cream-at-14% track. More thinking: solid mint to the gain. '
                    'New version: solid cream to the smallest gain across the five matched levels, then an unfilled 3 px cream outline to the largest, with a 12 px dot at each of the five gains (ink on the solid part, cream on the outline)'),
            'cost_colour': f'accent {ACCENT} where the change costs more, mint where it costs less',
        },
        'tiles': E4_TILES,
        'axes_text': {'bar_scale': 'a 0, 10, 20 tick row (IBM Plex Mono 54 px) under the bottom-left tile only: "0", "10", "20 points"'},
    },
    'data': {
        'rows': [row(s) for m in ('Claude Opus 5.5', 'Claude Opus 5', 'GPT-6.1 Sol', 'GPT-6 Sol') for s in SLUGS[m]],
        'derived': [
            {'what': 'thinking ranges', 'value': {m: R[m] for m in ('Claude Opus 5.5', 'Claude Opus 5', 'GPT-6.1 Sol', 'GPT-6 Sol')},
             'formula': 'derived.json thinking_range: points_gained and cost_multiple_per_task'},
            {'what': 'new version at each matched level', 'value': {'Claude Opus 5 to 5.5': UP_OPUS, 'GPT-6 Sol to 6.1 Sol': UP_GPT},
             'formula': 'derived.json model_upgrades_matched_level: points_gained and cost_multiple_per_task'},
            {'what': 'levels where the newer version cost less per task', 'value': f'{cheaper} of {len(ver_pts)} (full test set: {cheaper_full} of {len(ver_pts)})',
             'formula': 'count of cost_times_per_task < 1; the one that did not: Opus 5.5 at Max, 1.02 times per task (1.20 times on the full test set)'},
        ],
    },
    'source_line': ('Source: Artificial Analysis Intelligence Index v4.3.2, read 17 Oct 2026. Cost per task in US dollars at list prices. '
                    'Points and multiples: our arithmetic.'),
    'logos': ['anthropic', 'openai', 'aa'],
    'size': {'width': WIDTH, 'height_estimate': 2000},
    'alt': (f'Four tiles. Claude Opus 5.5 from Low to Max adds {R["Claude Opus 5.5"]["points"]} points for {times(R["Claude Opus 5.5"]["cost_times_per_task"])} times the cost; '
            f'Opus 5 to Opus 5.5 at the same level adds {op_lo} to {op_hi} points at {times(opc_lo, 2)} to {times(opc_hi, 2)} times the cost. '
            f'GPT-6.1 Sol from Low to Max adds {R["GPT-6.1 Sol"]["points"]} points for {times(R["GPT-6.1 Sol"]["cost_times_per_task"])} times; GPT-6 Sol to GPT-6.1 Sol '
            f'at the same level adds {gp_lo} to {gp_hi} points at {times(gpc_lo, 2)} to {times(gpc_hi, 2)} times the cost.'),
}

# ------------------------------------------------------------------ exhibit 5: the cheapest route to each score

CANDIDATES = [r for r in DATA['rows'] if r['cost_per_task_usd'] is not None and not r['aa_marks_deprecated']]


def cheapest(target):
    c = sorted([r for r in CANDIDATES if r['score'] >= target], key=lambda r: r['cost_per_task_usd'])
    c_full = sorted([r for r in CANDIDATES if r['score'] >= target], key=lambda r: r['cost_usd'])
    if c[0]['slug'] != c_full[0]['slug']:
        problems.append(f'E5: cheapest route to {target} differs by cost measure ({c[0]["slug"]} v {c_full[0]["slug"]})')
    return c


LADDER = []
for target, label in ((40, '40 or more'), (45, '45 or more'), (50, '50 or more'), (55, '55 or more')):
    c = cheapest(target)
    best = c[0]
    entry = {'target': target, 'label': label, 'cheapest': best['slug'], 'model': best['model'], 'level': best['thinking_level_label'],
             'score': best['score'], 'cost_per_task_usd': best['cost_per_task_usd'], 'cost_shown': usd(best['cost_per_task_usd']),
             'runner_up': c[1]['slug'], 'runner_up_cost_per_task_usd': c[1]['cost_per_task_usd']}
    LADDER.append(entry)
top = max(CANDIDATES, key=lambda r: r['score'])
LADDER.append({'target': top['score'], 'label': 'The top score', 'cheapest': top['slug'], 'model': top['model'], 'level': top['thinking_level_label'],
               'score': top['score'], 'cost_per_task_usd': top['cost_per_task_usd'], 'cost_shown': usd(top['cost_per_task_usd'])})
assert [e['cheapest'] for e in LADDER] == ['claude-haiku-5-5-xhigh', 'gpt-6-1-sol-medium', 'gpt-6-1-sol-high', 'claude-opus-5-5-xhigh', 'claude-opus-5-5'], [e['cheapest'] for e in LADDER]
# the 40 row is a near tie with a starred cost: show both
tie = LADDER[0]
assert tie['runner_up'] == 'gpt-6-1-sol-low'
jump = C('claude-opus-5-5-xhigh') / C('gpt-6-1-sol-high')
jump_pts = round(S('claude-opus-5-5-xhigh') - S('gpt-6-1-sol-high'), 1)
REFS = [
    {'slug': 'claude-opus-5-5-medium', 'label': "Claude Opus 5.5 at Medium, Anthropic's default", 'logo': 'anthropic',
     'source': "Anthropic's effort guide, platform.claude.com/docs/en/build-with-claude/effort, read 15 Oct 2026: \"Claude Opus 5.5 and Claude Haiku 5.5 default to medium\" (evidence-v3 P1-05)"},
    {'slug': 'claude-haiku-5-5-medium', 'label': "Claude Haiku 5.5 at Medium, Anthropic's default", 'logo': 'anthropic', 'source': 'the same page and line'},
    {'slug': 'gemini-4-argon', 'label': "Gemini 4 Argon at High, Google's top score here", 'logo': 'google',
     'source': "Artificial Analysis Google creator page: \"the top model from Google is Gemini 4 Argon (High) at 53\" (aa-pages.json)"},
]
for rf in REFS:
    r = ROWS[rf['slug']]
    rf.update({'score': r['score'], 'cost_per_task_usd': r['cost_per_task_usd'], 'cost_shown': usd(r['cost_per_task_usd'])})
if 'default to medium' not in EVIDENCE_TEXT:
    problems.append('E5: Anthropic default-to-medium line not found in evidence-v3.md')

E5 = {
    'id': 'cheapest-route-to-each-score',
    'order': 5,
    'question': 'If I need a given level of intelligence, which model and thinking level gets there cheapest, and where do the defaults land?',
    'kicker': 'EXHIBIT 5 · ARTIFICIAL ANALYSIS · 17 OCT 2026',
    'heading': 'The cheapest route to each score mixes Claude and GPT models and thinking levels',
    'standfirst': 'For each score on the Intelligence Index (0 to 100), the current model and thinking level that reaches it at the lowest cost per task.',
    'takeaway': (f'On Artificial Analysis\'s 0 to 100 index, scores up to 50 cost {int(r_half(C(LADDER[0]["cheapest"]) * 100, 0))} to '
                 f'{int(r_half(C(LADDER[2]["cheapest"]) * 100, 0))} cents a task at the cheapest; 55 takes Claude Opus 5.5 at Xhigh for '
                 f'{usd(C("claude-opus-5-5-xhigh"))}, about {int(r_half(jump, 0))} times as much, and Opus 5.5 on Anthropic\'s default (Medium) scores '
                 f'{S("claude-opus-5-5-medium")} for {usd(C("claude-opus-5-5-medium"))}.'),
    'notes': [
        {'text': "* Artificial Analysis says Claude Haiku 5.5's costs are understated: its 5 times higher price for long inputs is left out.",
         'placement': 'fine print directly under the 40 row (the Haiku figures carry the *)'},
        {'text': "ChatGPT is not placed: OpenAI does not say which of these settings its app's levels match. Your own tasks may rank them differently.",
         'placement': 'fine print under the For comparison rows'},
    ],
    'chart': {
        'type': 'ranked table with bars (a price ladder): one row per target score, a bar of cost per task from zero',
        'encoding': {
            'rows': 'five rows, lowest target at the top, 2 px rules between; left column 210 px: the target as "40+", "45+", "50+", "55+", "Top" (Anton 80 px). Right: line 1, logo (46 px) + model and thinking level (54 px Archivo 700, no wrap) with its score to one decimal right-aligned (54 px Plex Mono); line 2, the bar with the dollar figure at its end (Anton 64 px). Column heads, 54 px Archivo 500 at 70%: "Score" and "Cheapest way there, and its score"',
            'x': 'cost per task, US dollars, linear from $0 to $6, bar track 640 px; gridlines at $0, $2, $4, $6',
            'bars': f'cream at 80% up to 50 or more; the 55 and top rows in the accent colour {ACCENT}, the two that cost dollars, not cents',
            'tie_row': ('the 40 row shows both: Claude Haiku 5.5 at Xhigh, 41.2, $0.12, marked *, and under it GPT-6.1 Sol at Low, 42.1, $0.13: '
                        'a near tie, and Artificial Analysis says Haiku\'s cost is understated'),
            'jump': f'an accent bracket between the 50 and 55 rows: "{int(r_half(jump, 0))} times the cost for {jump_pts} more points"',
            'reference_band': ('under the ladder, a 2 px rule at 40%, then "For comparison" (54 px, cream at 75%) and three rows in the same columns, with outlined '
                               '(unfilled, 3 px cream) bars; the left column says "Default" (54 px Archivo 700) for the two Anthropic defaults and "Google" for Gemini 4 Argon'),
        },
        'rows': LADDER,
        'tie_second_line': {'slug': 'gpt-6-1-sol-low', 'model': 'GPT-6.1 Sol', 'level': 'Low', 'score': S('gpt-6-1-sol-low'), 'cost_shown': usd(C('gpt-6-1-sol-low'))},
        'reference_rows': REFS,
        'axes_text': {'column_heads': ['Score needed', 'Cheapest model and thinking level', 'Its score', 'Cost per task'], 'x_ticks': ['$0', '$2', '$4', '$6']},
    },
    'data': {
        'rows': [row(s) for s in [e['cheapest'] for e in LADDER] + ['gpt-6-1-sol-low'] + [rf['slug'] for rf in REFS]],
        'derived': [
            {'what': 'cheapest route to each target', 'value': LADDER,
             'formula': ('among the current rows of data-final.json with a cost (deprecated Claude Opus 5 and GPT-6 Sol left out; neither would change a row): '
                         'the lowest cost_per_task_usd with score >= target. Checked: the same rows win on the full-test-set cost.')},
            {'what': 'the jump from 50 to 55', 'value': {'times': float(r_half(jump, 2)), 'points': jump_pts},
             'formula': 'cost_per_task_usd(claude-opus-5-5-xhigh) / cost_per_task_usd(gpt-6-1-sol-high); score difference'},
        ],
    },
    'source_line': ('Source: Artificial Analysis Intelligence Index v4.3.2, read 17 Oct 2026; current models only. Cost per task in US dollars at list prices. '
                    "Defaults: Anthropic's developer guide, read 15 Oct 2026."),
    'logos': ['anthropic', 'openai', 'google', 'aa'],
    'size': {'width': WIDTH, 'height_estimate': 1960},
    'alt': ('Price ladder. For a score of 40 or more the cheapest was Claude Haiku 5.5 at Xhigh (41.2, $0.12 a task) or GPT-6.1 Sol at Low (42.1, $0.13); 45 or more, '
            'GPT-6.1 Sol at Medium (47.8, $0.21); 50 or more, GPT-6.1 Sol at High (50.2, $0.32); 55 or more, Claude Opus 5.5 at Xhigh (56.0, $3.46); the top score, '
            'Claude Opus 5.5 at Max (57.6, $5.98). For comparison: Claude Opus 5.5 at its default, Medium, 51.2 for $1.34; Claude Haiku 5.5 at its default, Medium, '
            '34.5 for $0.05; Gemini 4 Argon at High, 52.6 for $1.99.'),
}

# ------------------------------------------------------------------ where each goes in the article

AFTER = {
    'launches': para('Start with why your eyes are on the name at all'),
    'model-or-thinking-level': para('The size of the gear change surprised me.'),
    'each-step-buys-less': para("It isn't a straight line, though"),
    'new-version-or-more-thinking': para("That's also why a higher gear eats into your plan faster."),
    'cheapest-route-to-each-score': para("If you build products on AI, don't choose a model by its name or its launch chart."),
}
EXHIBITS = [E1, E2, E3, E4, E5]
for e in EXHIBITS:
    e['after'] = AFTER[e['id']]
    e['after_paragraph_number'] = PARAS.index(e['after']) + 1 if e['after'] in PARAS else None
    e['after_section'] = [p for p in PARAS[:PARAS.index(e['after'])] if p.startswith('## ')][-1][3:] if e['after'] in PARAS else None
    e['post_json_entry'] = {
        'kind': 'image', 'file': f'exhibit-{e["order"]}-{e["id"]}.png', 'name': f'exhibit-{e["order"]}-{e["id"]}.png',
        'logos': [LOGOS[k]['company'] for k in e['logos'] if k != 'aa'] + (['Artificial Analysis'] if 'aa' in e['logos'] else []),
        'shows': 'chart',
        'data_source': 'Anthropic and OpenAI release pages, 15 Oct 2026' if e['id'] == 'launches' else 'Artificial Analysis, 17 Oct 2026',
        'measures': ('launch days of new models, by date' if e['id'] == 'launches' else
                     'Artificial Analysis Intelligence Index v4.3.2, 0 to 100, higher is better; cost per task in US dollars at list prices, lower is cheaper'),
        'purpose': e['question'], 'after': e['after'][:80] + '...',
    }
    e['article_check'] = {}

orders = [e['after_paragraph_number'] for e in EXHIBITS]
if orders != sorted(orders):
    problems.append(f'exhibits are not in the story\'s order: {orders}')

# what each exhibit says against the article's own sentences (the article is not changed)
ART = {
    'more than a third higher': (S('claude-opus-5-5') / S('claude-opus-5-5-low'), 'Opus 5.5 Max / Low score', lambda v: 1.333 < v < 1.4),
    'older Opus 5 at its hardest beat the new one at its lowest': (S('claude-opus-5') - S('claude-opus-5-5-low'), 'points', lambda v: v > 0),
    'GPT-6 Sol about two thirds higher, thinking off to top': (S('gpt-6-sol') / S('gpt-6-sol-non-reasoning'), 'ratio', lambda v: 1.6 < v < 1.72),
    'GPT-6.1 Sol at its top only edged past it': (S('gpt-6-1-sol') - S('gpt-6-sol'), 'points', lambda v: 0 < v < 5),
    'low to medium about two and a half times per task': (C('claude-opus-5-5-medium') / C('claude-opus-5-5-low'), 'times', lambda v: 2.3 < v < 2.6),
    'medium to max another four and a half times': (C('claude-opus-5-5') / C('claude-opus-5-5-medium'), 'times', lambda v: 4.3 < v < 4.7),
    'bottom to top about 11 times': (C('claude-opus-5-5') / C('claude-opus-5-5-low'), 'times', lambda v: 10.5 < v < 11.5),
    'Fable 5.1 last step 28% more': (C('claude-fable-5-1') / C('claude-fable-5-1-xhigh'), 'times', lambda v: 1.275 <= v < 1.285),
    'Haiku 5.5 highest edged past Opus 5.5 lowest for less than half the cost per task': (C('claude-haiku-5-5') / C('claude-opus-5-5-low'), 'times', lambda v: v < 0.5 and S('claude-haiku-5-5') > S('claude-opus-5-5-low')),
    'Opus 5.5 hardest-thinking run $5.98 per task against $0.55 on low': ((C('claude-opus-5-5'), C('claude-opus-5-5-low')), 'usd', lambda v: usd(v[0]) == '$5.98' and usd(v[1]) == '$0.55'),
}
ARTICLE_CHECKS = []
for claim, (v, unit, ok) in ART.items():
    good = bool(ok(v))
    ARTICLE_CHECKS.append({'article_says': claim, 'data': v if not isinstance(v, float) else round(v, 4), 'unit': unit, 'exhibits_agree': good})
    if not good:
        problems.append(f'article check fails: {claim} ({v})')

# Each step up buys less than the one before: in points, or per dollar?
step_points_monotonic = {}
for m in E3_MODELS:
    p = [s['points'] for s in LAD[m][1]]
    step_points_monotonic[m] = all(a > b for a, b in zip(p, p[1:]))

FLAGS = [
    {'about': '"Each step up buys less than the one before." (THE SWITCH THAT MATTERS)',
     'finding': ('True on Artificial Analysis\'s data when "buys" means points per extra dollar: it holds at every step for all seven models listed at every setting, '
                 'on both cost measures and on unrounded scores. In raw points it holds step by step for none of them: Claude Sonnet 5.5\'s Medium to High step (+6.0) '
                 'added more than its Low to Medium step (+4.9), Fable 5.1\'s Medium to High (+2.3) more than Low to Medium (+2.1), Haiku 5.5\'s High to Xhigh (+3.4) '
                 'more than Medium to High (+3.3), GPT-6 Sol\'s Xhigh to Max (+3.4) more than High to Xhigh (+1.8), and Opus 5.5 and GPT-6.1 Sol each have two '
                 'equal steps (+2.4 and +2.4; +0.8 and +0.8). What does hold in points: the top step adds less than the first for every one of them, and Opus 5.5\'s '
                 'Low to Medium step is its biggest, as the article says. Exhibit 3 draws the per-dollar version and makes no step-by-step points claim, so it backs '
                 'the sentence as written. No change to the article.'),
     'step_points_shrink_every_step': step_points_monotonic},
    {'about': 'Cost measure', 'finding': COST_MEASURE['why']},
    {'about': 'ChatGPT\'s default', 'finding': ('No source matches ChatGPT\'s app settings (Instant, Medium, High, Extra High) to Artificial Analysis\'s developer settings, '
                                               'and ChatGPT offers no Max, so no exhibit places ChatGPT\'s default. Exhibit 5 shows Anthropic\'s documented developer defaults '
                                               'only, and says why ChatGPT is not placed.')},
    {'about': 'Claude Haiku 5.5 costs', 'finding': 'Artificial Analysis stars all five as understated; every exhibit showing a Haiku cost carries the line, and Exhibit 5 shows the 40 row as a near tie with GPT-6.1 Sol at Low.'},
    {'about': 'The pack\'s logo gate (not this step)', 'finding': ('The article names Meta (Llama 4), which config/logo-registry.json lists; none of these exhibits carries a Meta '
                                                                   'logo, so another picture in the pack must, or the gate will name it. Artificial Analysis is credited with its logo '
                                                                   'on Exhibits 2 to 5 but is not in the registry.')},
]

# ------------------------------------------------------------------ word checks on everything a reader sees

SEEN_KEYS = ('kicker', 'heading', 'standfirst', 'takeaway', 'source_line', 'alt')
BANNED = re.compile(r'\b(gears?|gearstick|gearbox|badges?|cars?|manual|automatic|transmission|clutch|paddles?|BMW|Audi|Mercedes|first gear|top gear|low gear)\b', re.I)
AMERICAN = re.compile(r'\b(color\w*|center\w*|analyz\w*|optimiz\w*|behavior\w*|favorite\w*|labeled|modeling|program\b|gray|catalog\b)', re.I)


def strings(o):
    if isinstance(o, dict):
        for v in o.values():
            yield from strings(v)
    elif isinstance(o, list):
        for v in o:
            yield from strings(v)
    elif isinstance(o, str):
        yield o


for e in EXHIBITS:
    note_texts = [n['text'] for n in e.get('notes', [])]
    seen = [e[k] for k in SEEN_KEYS] + note_texts + [s for s in strings(e['chart']) if isinstance(s, str)]
    on_chart = [e[k] for k in SEEN_KEYS[:-1]] + note_texts + list(strings({k: v for k, v in e['chart'].items() if k in ('lane_labels', 'point_labels', 'annotations', 'axes_text', 'rows', 'panels', 'tiles', 'tie_second_line', 'reference_rows')}))
    for s in seen:
        if '—' in s or '–' in s:
            problems.append(f'{e["id"]}: dash in {s[:60]!r}')
        if AMERICAN.search(s) and 'colour' not in s:
            problems.append(f'{e["id"]}: American spelling in {s[:80]!r}')
    for s in on_chart:
        if BANNED.search(s):
            problems.append(f'{e["id"]}: car word on the exhibit: {BANNED.search(s).group(0)!r} in {s[:80]!r}')
    if e['id'] != 'launches':
        joined = ' '.join([e['standfirst'], e['source_line'], json.dumps(e['chart'].get('axes_text', {}))])
        if '0 to 100' not in joined:
            problems.append(f'{e["id"]}: no score scale on the exhibit')
        if 'ost per task' not in joined:
            problems.append(f'{e["id"]}: cost not named as cost per task')
        if 'aa' not in e['logos']:
            problems.append(f'{e["id"]}: no Artificial Analysis credit logo')
    if not any(k in e['logos'] for k in ('anthropic', 'openai', 'google')):
        problems.append(f'{e["id"]}: no company logo')
    if len(e['kicker']) > 46:
        problems.append(f'{e["id"]}: kicker too long for one line at 44 px ({len(e["kicker"])} chars)')
if 'what Anthropic calls effort and OpenAI calls reasoning' not in E2['standfirst']:
    problems.append('E2 must define thinking level the first time')

doc = {
    'what_this_is': ("The design for Friday's Substack exhibits (mind.the.gap, piece 904658db-4df2-4537-a0ed-ebe93e081db7): five figures, in the story's order, "
                     'each answering one question a business leader would ask. A spec to draw from, not a render. Built by '
                     '.cache/visual-intel/scripts/exhibits_build.py from data-final.json and derived.json; nothing published, sent or committed.'),
    'built_at': NOW,
    'krish_asked': {'on': '2026-10-17', 'words': ('I expect some pretty heavyweight beautiful stunning visual intel as to what difference models versus thinking levels make '
                                                 "to intelligence and how that correlates to the cost of it. I don't want you to change the article clips but I just want "
                                                 'to make sure that those insights are enterprise-grade and available inside the substack.')},
    'story': json.loads(json.dumps((PLAN / 'story.md').read_text(encoding='utf-8').strip())),
    'article': str(ARTICLE.relative_to(ROOT)) + ' (not changed; every "after" is copied from it and found exactly once)',
    'headline': 'Why Claude and ChatGPT launches keep speeding up, and who will decide how hard your AI thinks',
    'design_contract': {
        'state_of_use': 'A business reader on Substack, mostly on a phone (358 px column), reading the piece through; often a figure is screenshotted and shared alone.',
        'user_and_action': 'Understand, in one look per figure, whether a new model or the thinking level matters more, what each costs, and what to buy.',
        'governing_rule': 'Real Artificial Analysis rows only, by slug; every derived number has its formula; a score always with its scale; costs say what they are.',
        'data_truth': 'Sparse where Artificial Analysis is: Google has one ranged model and its Low has no cost; ChatGPT\'s app settings are not mapped; Haiku costs understated.',
        'materiality': 'Material: new figures for a piece Krish has signed off. He sees the rendered set before it goes into the page.',
        'brand_and_voice': 'makeyourmindup house style from config/studio.json via scripts/pages/brand.py; mind.the.gap accent; krish-voice rules for every word.',
        'authority': 'Design spec only. Rendering, the pack and posting are later steps; posting is his.',
        'proof': 'Each render passes scripts/pages/card.py at 1360 wide (phone floor), is looked at at full size and at 358 px, and is checked against this file.',
    },
    'design_system': DESIGN,
    'cost_measure': COST_MEASURE,
    'score_basis': SCORE_BASIS,
    'exhibits': EXHIBITS,
    'article_checks': ARTICLE_CHECKS,
    'flags_for_krish': FLAGS,
    'checks': {'problems': problems, 'passed': not problems},
}

PROOF = ROOT / '.cache/visual-intel/design/proof.json'
if PROOF.exists():
    proof = json.loads(PROOF.read_text(encoding='utf-8'))
    for e in EXHIBITS:
        pr = proof.get(e['id'])
        if pr and pr.get('size'):
            e['size']['height_estimate'] = pr['size'][1]
            e['size']['height_basis'] = 'measured on the feasibility proof drawn to this spec (house faces, real logos, real rows); the final may differ by a little'
            e['feasibility_proof'] = pr
    doc['feasibility_proofs'] = {
        'what': ('One HTML drawing per exhibit, made by .cache/visual-intel/scripts/proto.py straight from this file and data-final.json, then checked with '
                 'scripts/pages/card.py (phone floor, nothing cut off) by .cache/visual-intel/scripts/prove.py. They prove the layout works at the 54 px floor '
                 'and give the renderer a starting point. They are not final art and were not shown to Krish.'),
        'all_passed': all(p.get('passed') for p in proof.values()),
        'rerun': 'python3 -I /home/user/content-engine/.cache/visual-intel/scripts/prove.py, then this script again',
    }
    if not doc['feasibility_proofs']['all_passed']:
        problems.append('a feasibility proof failed card.py')
        doc['checks'] = {'problems': problems, 'passed': not problems}

if len(sys.argv) > 2 and sys.argv[1] == '--heights':
    hts = json.loads(Path(sys.argv[2]).read_text(encoding='utf-8'))
    for e in EXHIBITS:
        if e['id'] in hts:
            e['size']['measured_text_blocks_px'] = hts[e['id']]

OUT.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
print(f'wrote {OUT} ({OUT.stat().st_size} bytes); problems: {len(problems)}')
for p in problems:
    print('  -', p)
