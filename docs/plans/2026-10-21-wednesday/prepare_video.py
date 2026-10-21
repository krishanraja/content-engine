"""Prepare this recording's evidence cues using the house edit and kit tools.

Cue positions come from the retained spoken words. Source recordings are never
changed. Runtime media and render receipts live in the supplied production folder.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'scripts/quick-edit'))
import make

PLAN = Path(__file__).resolve().parent
PIECE = 'd7a20885-7001-4661-b444-9d7ca1043416'

SHORT = [(0,'five-jobs'),(5.8,'scam-grok'),(14,'scam-request'),
         (20,'scam-grok'),(22,'scam-priority'),(32,'scam-community'),
         (41,'flight-fare'),(45,'flight-layover'),(56,'flight-nights'),
         (62,'flight-verdict'),(65,'community-score'),(70,'starting-point'),
         (84,'permission-test')]
LONG = [(0,'five-jobs'),(23,'scam-grok'),(32,'five-jobs'),
        (55.5,'scam-request'),(68.9,'scam-grok'),(75.3,'scam-priority'),
        (88.3,'scam-community'),(101.4,'scam-priority'),(108,'flight-fare'),
        (120,'flight-layover'),(126,'flight-nights'),(137,'flight-verdict'),
        (146.9,'cancel-check'),(185.9,'day-plan'),(193.5,'day-community'),
        (209.2,'day-result'),(221.4,'news-date'),(239.3,'news-result'),
        (268.7,'email-correction'),(270.7,'email-honesty'),
        (282.5,'email-duplicate'),(300.5,'fee-handoff'),(311,'social-fit'),
        (351.5,'wiper-task'),(373.4,'my-score'),(381.8,'community-score'),
        (391.7,'starting-point'),(423.2,'permission-test')]


def write(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')


def anchor(words, index, end=False):
    for size in range(3, 14):
        a, b = (max(0,index-size+1),index+1) if end else (index,min(len(words),index+size))
        text = ' '.join(w['w'].strip() for w in words[a:b])
        try:
            found = make.quality.unique_anchor(words, text, make.norm)
        except ValueError:
            continue
        if found and found[0] == a and found[1] == b-1:
            return text
    raise ValueError(f'No unique anchor at {index}')


def prepare(work, cut):
    out = work / f'kit-{cut}'
    out.mkdir(exist_ok=True)
    raw = json.loads((work/f'{cut}.words.json').read_text(encoding='utf-8'))['words']
    source = work/'sources'/f'{cut}-original.mp4'
    make.FPS = make.render_fps({}, source)
    duration = 462.239089 if cut == 'long' else 97.705278
    removals = json.loads((work/'long-removals.json').read_text(encoding='utf-8')) if cut == 'long' else []
    segs, total = make.segments(raw, make.resolve_removals(raw, removals), .35,.18,.25,duration, protect_removals=True)
    words = make.retime(raw,segs)
    boundaries = LONG if cut == 'long' else SHORT
    step = 4.8 if cut == 'long' else 2.25
    groups = []
    start = 0
    while start < len(words):
        end = start
        while end+1 < len(words) and words[end+1]['e']-words[start]['s'] < step:
            end += 1
        if len(words)-end < 4:
            end = len(words)-1
        groups.append((start,end))
        start = end+1
    cues=[]
    for n,(a,b) in enumerate(groups):
        rawtime = raw[words[a]['src']]['s']
        topic = next(name for t,name in reversed(boundaries) if rawtime >= t)
        # An evidence reveal follows the words: its key row becomes active,
        # then the other row. Both states remain readable throughout.
        card = topic + f'-focus{n%2}'
        cues.append({'id':card, 'panel':f'panels/{card}-{{aspect}}.png',
                     'start':anchor(words,a), 'end':anchor(words,b,True),
                     'lead':.20, 'tail':.35})
    wins, missing = make.cue_windows(words,cues,total,strict=True)
    assert not missing, missing
    cfg={'name':f'muse-vs-grok-{cut}','source':str(source),
         'words':str(work/f'{cut}.words.json'),'model':'small.en',
         'script':str(PLAN/f'recorded-{cut}-script.md'),
         'crop':[1080,1920,0,0], 'subject':'Muse vs Grok Bot',
         'date':'2026-10-21','piece_id':PIECE,'tiktok':True,
         'intro':{s:str(work/'story'/f'intro-{s}.mp4') for s in ['16x9','9x16']},
         'intro_override':"Krish, 2026-10-12: when the videos come back bear in mind that I want a proper animated branded intro to this specific story visually, the audio treatment, and then a proper animated outro card. Across all formats, and this should be part of the system moving forward.",
         'endcard':{s:str(work/'story'/f'outro-{s}.mp4') for s in ['16x9','9x16']},
         'music':'no-curves-instrumental','music_seconds':342,
         'voice':'repair','desniff':True,'frame16':'frame-16x9.png',
         'strap':False,'remove':removals,'replacements':[
             ['Grokbot','Grok Bot'],['GrokBot','Grok Bot'],
             ["Mehta's news","Meta's Muse"],["Metas","Meta's"],["Ascender","the sender"],
             ['MakeYourMindHop .ai','makeyourmindup.ai']],
         'cues':cues}
    post=json.loads((PLAN/'post.json').read_text(encoding='utf-8'))
    post['files']=[{'kind':'video-script','cut':cut,'file':str(PLAN/f'recorded-{cut}-script.md')}]
    for card in sorted({c['id'] for c in cues}):
        post['files'].append({'kind':'image','file':str(work/'cards'/f'{card}.png'),
                              'purpose':card.replace('-',' ')})
    write(out/f'{cut}.json',cfg)
    write(out/'post.json',post)
    write(out/'cue-clock.json',{'speech_seconds':total,'words':words,'windows':wins,
                             'coverage':make.quality.coverage(wins,0,total)})
    print(cut,round(total,3),'seconds',len(cues),'cues',make.quality.coverage(wins,0,total))


if __name__ == '__main__':
    for cut in ['short','long']:
        prepare(Path(sys.argv[1]).resolve(),cut)
