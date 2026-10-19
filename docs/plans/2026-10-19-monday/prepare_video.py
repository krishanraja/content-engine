"""Reproducible Monday video assets. Run from the repository root after sign-off.

The cards explain the recorded argument. These are review assets until the
article fact gate passes; none of this script publishes or completes a record.
"""
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PLAN = Path(__file__).resolve().parent
WORK = ROOT / '.cache/produce/2026-10-19-5b5bfadc'
sys.path.insert(0, str(ROOT / 'scripts/post-pack'))
import title_check

SAID = 'Approve set A and the listed treatment'
HEADINGS = [
    "Google's Gemini launch price ends",
    'Google, OpenAI and Anthropic keep changing prices',
    'Why a cheap AI tool can be costly to leave',
    'AI discounts can change too',
    'What does each completed AI task cost?',
    'Three rules for your AI budget',
    'Budget at the full price',
    'Agree a price and an end date',
    'Keep the freedom to switch',
    'My AI price prediction for the end of 2026',
    'Questions for whoever owns your AI budget',
]

def prepare():
    logos = PLAN / 'logos'
    logos.mkdir(exist_ok=True)
    for name in ['google-cream.svg', 'openai-symbol-cream.svg', 'anthropic-symbol-cream.svg']:
        shutil.copy2(ROOT / 'docs/plans/2026-10-14-wednesday/logos' / name, logos / name)
    (logos / 'SOURCES.md').write_text('Unmodified official logo assets reused from the 14 October plan. See that plan and its logo source notes for provenance.\n', encoding='utf-8')
    lines = [('youtube', 'Why Google, OpenAI and Anthropic keep changing AI prices'),
             ('thumbnail', 'WHAT WILL AI COST NEXT?'),
             ('shorts', 'Google, OpenAI and Anthropic: three rules for your AI budget')]
    lines += [('card', h) for h in HEADINGS]
    for surface, line in lines:
        title_check.record_verdict(line, 'picked', 'Set A and its listed treatment approved after recording.', SAID, surface, '5b5bfadc-a60c-4d0a-be8e-b2e9bf43d092')
    rows = [
        {'name':'Google', 'logo':'logos/google-cream.svg', 'tag':'Gemini', 'colour':'butter'},
        {'name':'OpenAI', 'logo':'logos/openai-symbol-cream.svg', 'tag':'ChatGPT', 'colour':'mint'},
        {'name':'Anthropic', 'logo':'logos/anthropic-symbol-cream.svg', 'tag':'Claude', 'colour':'lilac'},
    ]
    facts = {'subchannel':'follow.the.money', 'date':'2026-10-19',
             'headline':'Why AI prices keep changing', 'video_title':'Why Google, OpenAI and Anthropic keep changing AI prices',
             'video_title_emphasis':'AI prices', 'comment_question':'WHAT WILL AI COST NEXT?',
             'cover':{'headline':['WHAT WILL AI','COST NEXT?'], 'portrait':True, 'rows':rows},
             'thumbs':{'headline':['WHAT WILL AI','COST NEXT?'], 'portrait':True, 'rows':rows},
             'standoff':{'left':{'label':'Google','logos':[rows[0]['logo']]},
                         'right':[{'label':r['name'],'logos':[r['logo']]} for r in rows[1:]]}}
    (PLAN / 'cover-facts.json').write_text(json.dumps(facts, indent=2)+'\n', encoding='utf-8')
    # Keep the complete heard words for the next editor; original scripts stay untouched.
    for cut in ('long', 'short'):
        shutil.copy2(WORK / f'{cut}.words.json', PLAN / f'{cut}.words.json')
        shutil.copy2(WORK / f'{cut}-narration.md', PLAN / f'{cut}-narration.md')
    print('Recorded video wording approval; prepared facts, logo sources and narration evidence.')

if __name__ == '__main__':
    prepare()
