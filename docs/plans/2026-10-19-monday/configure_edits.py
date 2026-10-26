"""Attach the approved treatment and heard-word anchors to the two generated kits."""
import json
import shutil
from prepare_video import ROOT, PLAN, WORK, SAID

LONG=[
 ('google','On 1st of December','going to double too'),
 ('rivals','Google isn\'t alone','cheaper than the one before'),
 ('same','look where they\'ve all landed','numbers has moved this year'),
 ('lockin','A low price gets your team','full price can arrive on your doorstep'),
 ('reuse','The first is reusing','charges 95 % less for it'),
 ('bill','So say that whole','not just the price'),
 ('jobs','second tactic is a cheaper AI','each finished job really costs'),
 ('budget','Number one set your budget','probably not going to'),
 ('contract','Secondly put the price','going to hold'),
 ('switch','number three is keep the freedom','and one ends you can leave'),
 ('prediction','So my prediction is','put this at 95%'),
 ('questions','here\'s what to do on Monday','before you change anything'),
]
SHORT=[
 ('google','on 1st of December','2 to 4'),
 ('rivals','OpenAI cut its best','prices move this year'),
 ('rules','three rules are going to hold','freedom to switch'),
]

for cut, cues, shape in [('long',LONG,'16x9'),('short',SHORT,'9x16')]:
    f=WORK/'kit'/f'{cut}.json'; cfg=json.loads(f.read_text())
    cfg.update({'crop':[1080,1920,0,0], 'face':[400,920] if cut=='short' else [210,920], 'voice':'repair', 'reframe':False,
                'max_gap':0.9,'pad_before':0.2,'pad_after':0.3,
                'intro':{s:f'../story/intro-{s}.mp4' for s in ['16x9','9x16']},
                'intro_override':f'Krish, 2026-10-19: {SAID}',
                'endcard':{s:f'../story/outro-{s}.mp4' for s in ['16x9','9x16']},
                'music':'no-curves-instrumental','music_seconds':100 if cut=='long' else 90,
                'series':'follow_the_money','captions':cut=='short','strap':False,
                'cues':[{'id':key,'panel':f'panels/{key}-{{aspect}}.png','start':start,'end':end} for key,start,end in cues],
                'replacements':[['can sort of price rise','cancelled a price rise'],['And thropics','Anthropic\'s'],['And a thropic','Anthropic'],['and anthropic','and Anthropic'],['clawed AIs','Claude AIs'],['Re -rival','Three rivals'],['canceled','cancelled'],['argon','Argon']]})
    if cut=='long':
        cfg['replacements'].append(['and lesser price','unless a price'])
        from finalize_captions import DECISIONS
        cfg['replacements'].extend([list(pair) for pair in DECISIONS])
        cfg['music_mode']='episode'
        cfg['chapters']=[{'title':'Why AI prices keep changing','starts':'So I follow'},
                         {'title':'Google, OpenAI and Anthropic keep changing prices','starts':'Google isn\'t alone'},
                         {'title':'Why a cheap AI tool can be costly to leave','starts':'So why do they keep doing it'},
                         {'title':'AI discounts can change too','starts':'The first is reusing'},
                         {'title':'Three rules for your AI budget','starts':'There are three rules'},
                         {'title':'My AI price prediction for the end of 2026','starts':'So my prediction is'}]
    f.write_text(json.dumps(cfg,indent=2)+'\n',encoding='utf-8')
    dest=WORK/cut;dest.mkdir(exist_ok=True)
    shutil.copy2(WORK/f'{cut}.words.json',dest/f'{cfg["name"]}.words.json')
    # A portable version of the exact edit choices, not machine-local source files.
    (PLAN/f'{cut}-edit.json').write_text(json.dumps(cfg,indent=2)+'\n',encoding='utf-8')
print('Configured both cuts from the approved treatment and actual transcripts.')
