import json,hashlib,os
P='docs/plans/2026-11-20-friday/ve/'; A='.cache/fri20/assets/'
def sha(p): return hashlib.sha256(open(p,'rb').read()).hexdigest()
def crop(x,y,w,h): return {"x":x,"y":y,"w":w,"h":h}, round((w*2560)/(h*1800),4)
def ev(at,obj,verb,state='visible'): return {"at_w":at,"obj":obj,"verb":verb,"to_state":state,"silent":True}
def plate(obj,src,meaning,w,h,beat,camera='push'):
    return {"obj":obj,"device":"scene_plate","meaning":meaning,"persist":{"from_beat":beat,"to_beat":beat},
            "params":{"shots":[{"src":src,"kind":"video","width":w,"height":h}],"camera":camera,"full":True,"grade":"none"}}
def card(obj,src,outlet,date,c,meaning,beat):
    cr,ar=crop(*c); return {"obj":obj,"device":"evidence_card","meaning":meaning,"persist":{"from_beat":beat,"to_beat":beat},
            "params":{"kind":"screenshot","src":src,"outlet":outlet,"date":date,"sourceAspectRatio":ar,"crop":cr}}
import os as _o
INV="plates/b14-invoices-916.mp4" if _o.path.exists(".cache/fri20/assets/plates/b14-invoices-916.mp4") else "plates/b14-invoices-916.png"
INVW,INVH=(720,1280) if INV.endswith("mp4") else (1520,2688)
TH=("shots/tomshw.png","Tom's Hardware","29 Oct 2025")
objects=[
 {"obj":"k_billed","device":"kinetic_stat","dataset":"bill-billed","meaning":"the bill as the hospital first sent it: $195,000 (his account, Tom's Hardware)","persist":{"from_beat":"hook","to_beat":"hook"},"params":{"panel":True,"prefix":"$","group":True,"hero":True}},
 {"obj":"strike","device":"scribble","meaning":"a hand-drawn line through \"$195,000\" as he says \"fraction\"","persist":{"from_beat":"hook","to_beat":"hook"},"params":{"colour":"mint","seed":"fri20","shape":"underline","from":[200,340],"to":[690,330]}},
 plate("sofa","plates/b4-sofa-money-916.mp4","the missing money: a fistful of cash and old receipts pulled out from the back of the sofa (Krish, 19 Nov: \"money back down the back of couches\")",1080,1920,"question"),
 plate("closet","plates/b4-closet-skeleton-916-from2s1.mp4","the skeletons in your closet: a cupboard bursts open and a skeleton tumbles out with the old files (the clip starts at 2.1 s, once a box printed with a year has turned away, and holds its last frame: no year the piece does not own) (Krish, 19 Nov: \"skeletons coming out of closets\")",1080,1920,"skeletons"),
 card("th_head",*TH,(0.13,0.51,0.5,0.32),"the headline: grieving family uses AI chatbot to cut hospital bill from $195,000 to $33,000","proof"),
 plate("steak","plates/b8-steak-sandwich-916.mp4","the gap between what was billed and what was given, as one picture: the cloche lifts on a sad sandwich while the bill on the tray says STEAK",1080,1920,"steak"),
 {"obj":"k_after","device":"kinetic_stat","dataset":"bill-after","meaning":"the bill counting down from $195,000 to where it landed, about $33,000, on \"fell\" (his account, Tom's Hardware)","persist":{"from_beat":"fell","to_beat":"fell"},"params":{"ghost":True,"prefix":"$","group":True}},
 {"obj":"chip_caveat","device":"query_chip","meaning":"the caveat kept on screen: his account, the hospital has not confirmed","persist":{"from_beat":"fell","to_beat":"fell"},"params":{"text":"HIS ACCOUNT · HOSPITAL HASN'T CONFIRMED"}},
 plate("closet2","plates/b4-closet-skeleton-916-from2s1.mp4","the callback: the same cupboard, now yours, opening on 'whose closet it was opening'",1080,1920,"closet"),
 plate("invoices",INV,"his close, generated at his word (\"generate it\", 19 Nov): last year's invoices poured into the AI, red flags popping, a skeleton hand waving from the folder",INVW,INVH,"act"),
]
for o in objects:
    if o['params'].get('shots') and o['params']['shots'][0]['src'].endswith('.png'): o['params']['shots'][0].pop('kind',None)
    if o['obj']=='fortune': o['params']['full']=False; o['params']['camera']='still'
CLIP="a moving clip carries this beat; more device events would only pulse it"
FACE="his line to camera: his face and the art-directed captions carry it (Krish, 18 Nov 2026: \"The captions and my head, etc., would be better.\")"
beats=[
 dict(id="hook",role="hook",span={"from_w":0,"to_w":20},viewer_task="locate_story",point="AI just cut a family's six-figure hospital bill to a fraction",layout="WINDOW",plate={"source":"take"},uses=["k_billed","strike"],events=[ev(0,"k_billed","enter"),ev(0,"k_billed","count_to","billed"),ev(18,"strike","draw","strike")],transition_out="cut",face="window"),
 dict(id="face",role="bridge",span={"from_w":21,"to_w":43},viewer_task="connect_with_speaker",point="Imagine what it is finding in everyone's old paperwork, when whole hospital teams missed it",layout="F1",plate={"source":"take"},uses=[],events=[],transition_out="cut",face="full",override_reason=FACE),
 dict(id="question",role="pivot",span={"from_w":44,"to_w":52},viewer_task="locate_story",point="Will your AI auditor find the missing money?",layout="STAGE",plate={"source":"none"},uses=["sofa"],events=[ev(44,"sofa","enter","0")],transition_out="cut",face="off",override_reason=CLIP),
 dict(id="skeletons",role="pivot",span={"from_w":53,"to_w":61},viewer_task="feel_stakes",point="Or will it find the skeletons in your closet?",layout="STAGE",plate={"source":"none"},uses=["closet"],events=[ev(53,"closet","enter","0")],transition_out="cut",face="off",override_reason=CLIP),
 dict(id="proof",role="anchor",span={"from_w":62,"to_w":81},viewer_task="verify_evidence",point="A real family owed the whole bill after a death with no health cover",layout="STAGE",plate={"source":"none"},uses=["th_head"],events=[ev(62,"th_head","enter"),ev(69,"th_head","mark","attack"),ev(80,"th_head","mark","195")],transition_out="cut",face="off",backdrop="asset:tomshw"),
 dict(id="lines",role="bridge",span={"from_w":82,"to_w":90},viewer_task="understand_mechanism",point="He asked for the bill line by line and gave it to Claude",layout="STAGE",plate={"source":"none"},uses=["th_head"],events=[],transition_out="cut",face="off",backdrop="asset:tomshw"),
 dict(id="code",role="anchor",span={"from_w":91,"to_w":107},viewer_task="understand_mechanism",point="Care was billed under a dearer code than the care he got",layout="WINDOW",plate={"source":"take"},uses=["chip_billed","chip_given"],events=[ev(91,"chip_billed","enter"),ev(99,"chip_billed","highlight"),ev(103,"chip_given","enter")],transition_out="cut",face="window"),
 dict(id="steak",role="bridge",span={"from_w":108,"to_w":119},viewer_task="feel_stakes",point="Charged for a steak, served a sandwich",layout="STAGE",plate={"source":"none"},uses=["steak"],events=[ev(108,"steak","enter","0")],transition_out="cut",face="off",override_reason=CLIP),
 dict(id="fell",role="anchor",span={"from_w":120,"to_w":132},viewer_task="verify_evidence",point="He sent the list and the bill fell to about a sixth",layout="P1",plate={"source":"none"},uses=["k_after","chip_caveat"],events=[ev(120,"k_after","enter"),ev(120,"k_after","count_to","billed"),ev(129,"k_after","count_to","after"),ev(131,"chip_caveat","enter")],transition_out="cut",face="off",backdrop="asset:tomshw"),
 dict(id="love",role="bridge",span={"from_w":133,"to_w":160},viewer_task="connect_with_speaker",point="An old bill can't argue back, the rules are written down, and AI reads every line without a break",layout="F1",plate={"source":"take"},uses=[],events=[],transition_out="cut",face="full",override_reason=FACE),
 dict(id="hindsight",role="anchor",span={"from_w":161,"to_w":177},viewer_task="understand_mechanism",point="About next year AI is guessing; about last year it is reading",layout="WINDOW",plate={"source":"take"},uses=["chip_next","chip_last"],events=[ev(161,"chip_next","enter"),ev(169,"chip_next","highlight"),ev(171,"chip_last","enter"),ev(177,"chip_last","highlight")],transition_out="cut",face="window"),
 dict(id="whose",role="bridge",span={"from_w":178,"to_w":194},viewer_task="connect_with_speaker",point="Whose mistake did Claude find? The hospital's",layout="F1",plate={"source":"take"},uses=[],events=[],transition_out="cut",face="full",override_reason=FACE),
 dict(id="closet",role="pivot",span={"from_w":195,"to_w":205},viewer_task="feel_stakes",point="It didn't care whose closet it was opening",layout="STAGE",plate={"source":"none"},uses=["closet2"],events=[ev(195,"closet2","enter","0")],transition_out="cut",face="off",override_reason=CLIP),
 dict(id="yours",role="payoff",span={"from_w":206,"to_w":214},viewer_task="connect_with_speaker",point="And it won't care when it opens yours",layout="F1",plate={"source":"take"},uses=[],events=[],transition_out="cut",face="full",override_reason=FACE),
 dict(id="act",role="anchor",span={"from_w":215,"to_w":238},viewer_task="land_payoff",point="This week he hands his own AI last year's invoices, to find his skeletons first",layout="STAGE",plate={"source":"none"},uses=["invoices"],events=[ev(215,"invoices","enter","0")],transition_out="cut",face="off",override_reason=CLIP),
 dict(id="close",role="bridge",span={"from_w":239,"to_w":245},viewer_task="land_payoff",point="The full story is free at makeyourmindup.ai",layout="F1",plate={"source":"take"},uses=[],events=[],transition_out="cut",face="full",override_reason=FACE),
]
assets=[{"id":"short-master","kind":"recording","origin":"capture","path":"short.master.mov","frame":{"width":1080,"height":1920},"sha256":sha(A+'short.master.mov'),"licence":"Krish's own recording, 18 Nov 2026 (ai-finding-your-skeletons-short.mp4, sha256 0be73bbd), two restarts and long pauses cut, 1.0x, 85.1 s"}]
gen=json.load(open(P+'generations.json'))
jobs={c['beat']:c['job'] for c in gen['clips']}
for o in objects:
    if o['device']=='scene_plate':
        src=o['params']['shots'][0]['src']; aid=os.path.basename(src).rsplit('.',1)[0]
        if not any(a['id']==aid for a in assets):
            JOBS={"b4-sofa-money-916":"0b2f8990-7656-48ab-b2aa-06c03a11a026","b4-closet-skeleton-916-from2s1":"99452888-ab66-4e5d-9bc1-3008d51b9b32","b8-steak-sandwich-916":"07df126a-e2dc-4f42-8d70-5c98c7c0e191","b14-invoices-916":"67577111-e4d8-4c39-8f9b-4846ed6f4c79" if src.endswith('mp4') else "3a4a9127-f810-4de3-a133-6213d9cc9b8d"}
            assets.append({"id":aid,"kind":"broll","origin":"generated","path":src,"sha256":sha(A+src),"job_id":JOBS[aid],"tool":"higgsfield:gpt_image_2_6 then seedance_2_5","licence":"generated for this piece; Krish approved up to 710 credits, 19 Nov (\"Up to 710, 1080p (Recommended)\"); jobs in ve/generations.json"})
assets.append({"id":"tomshw","kind":"screenshot","origin":"source","path":"shots/tomshw.png","sha256":sha(A+'shots/tomshw.png'),"licence":"screenshot of Tom's Hardware, 29 Oct 2025, https://www.tomshardware.com/tech-industry/artificial-intelligence/grieving-family-uses-ai-chatbot-to-cut-hospital-bill-from-usd195-000-to-usd33-000-family-says-claude-highlighted-duplicative-charges-improper-coding-and-other-violations, captured 19 Nov 2026"})
datasets=[{"id":"bill-billed","unit":"USD, the hospital's first bill","denominator":None,"rows":[{"label":"billed","value":195000}],"producer_label":"Tom's Hardware, 29 Oct 2025 (the family's account)","source_url":"https://www.tomshardware.com/tech-industry/artificial-intelligence/grieving-family-uses-ai-chatbot-to-cut-hospital-bill-from-usd195-000-to-usd33-000-family-says-claude-highlighted-duplicative-charges-improper-coding-and-other-violations","retrieved_at":"2026-11-19"},
          {"id":"bill-after","unit":"USD, after the itemised review","denominator":None,"rows":[{"label":"billed","value":195000},{"label":"after","value":33000}],"producer_label":"Tom's Hardware, 29 Oct 2025 (the family's account)","source_url":"https://www.tomshardware.com/tech-industry/artificial-intelligence/grieving-family-uses-ai-chatbot-to-cut-hospital-bill-from-usd195-000-to-usd33-000-family-says-claude-highlighted-duplicative-charges-improper-coding-and-other-violations","retrieved_at":"2026-11-19"}]
TLINE="Will your AI auditor find missing money or will it find skeletons in your closet?"
title="Will your AI auditor find your missing money, or the skeletons in your closet?"
spec={"schema_version":2,"piece_id":"c00cd4e0-e1bb-4c60-b36f-cea92897e38c","publish_day":"2026-11-20","format":"face-with-proof","theme":"makeyourmindup-video-v1",
 "brand":{"series":"mind.the.gap","captions":"word","caption_theme":"art-directed","title":"Your AI auditor: missing money or skeletons?",
   "references":[{"id":"8ca0bd3d-454d-48fd-a2d1-98d0e5469779","card":"instagram_DfkCOCLt7KZ","for":["look","captions"],"drive_id":"1BfTNeNwSERAvHvtWSmEP9tONOP2jQqrq","takeaway":"His words on the card: \"Really well-animated and strong speaker production as well as K12 Newmalden. The captions are very unique and well-designed, like an art director would do them.\""},
                 {"id":"501c4fd1-4aa1-4cdd-b716-03e70c89c283","card":"instagram_DdCY4cJAQZk","for":["motion"],"drive_id":"1pofv2sX1N0QptLEygxcx0YGYMOD1gjeB","takeaway":"His words on the card: \"I love the infographic style.\""}]},
 "signature":{"hero":{"device":"scene_plate","status":"proven"},"opening_break":"$195,000 slams in above him on his first number and is struck through on 'fraction'","finish_pack":"house_grain","sound_palette":"house-v1 (no kit exists yet: the music bed carries the cut; docs/ve/STATUS.md, \"No sound effects kit\")","variants":{}},
 "objects":objects,"assets":assets,"datasets":datasets,
 "audio":{"master":"take","bed":{"ledger_id":"make-up-your-mind-instrumental","mode":"episode_bed","under_vo_lu":-20},"sfx_kit":"house-v1","targets":{"lufs":-14,"tp":-1}},
 "cuts":{"short":{"aspect":"9:16","take":"short-master","max_s":89,"excerpt":False,"edit":{"remove":[],"speed":1},"captions":{"region":"default","emphasis":[13,18,51,56,81,99,113,119,129,148,169,177,202,213,235]},"beats":beats}},
 "approvals":[],"budget":{"tokens_cap":12600000,"credits":{"higgsfield":710,"runway":0}},
 "style":{"motion":{"module":"ai-music-slam","reason":"Krish picked it on the board, 17 Nov 2026 18:58 UTC"},
   "captions":{"theme":"art-directed","placement":"lower","reason":"Krish picked it on the board, 17 Nov 2026 18:58 UTC"},
   "transitions":{"kind":"whip","reason":"ai-music-slam's own rule: scenes hand over with a horizontal blur whip"},
   "camera":{"move":"phased","hits":True,"reason":"ai-music-slam: the camera pushes through every scene and breathes on long holds"},
   "energy":"high",
   "layout":{"mode":"pillar","reason":"his long take is vertical (1080x1920) on a 16:9 cut: the pillar draws it whole as a full-height panel on the right with the graphics on the left (Krish, 19 Nov 2026, picked \"Pillar: whole take on the right\"); on the tall cut his take stays full frame, and every graphics-only beat still fills the safe region as under fill"},
   "look":"face-with-proof (picked by Krish, 17 Nov 2026 18:58 UTC)",
   "idea":{"object":"the auditor going through the past: every old page it opens turns up either money (cash down the back of the sofa) or a skeleton (out of the cupboard)",
     "moves":[{"move":"a real page or number slams onto the stage on the word that names it","means":"the past is written down, so it can be checked"},
              {"move":"the big number is struck through and counts down","means":"what the audit found, in the family's own account"},
              {"move":"cash comes out of the sofa","means":"the missing money an audit finds"},
              {"move":"a skeleton tumbles out of the cupboard","means":"what else it finds, and it does not care whose cupboard it is"}],
     "never":["a re-typed headline standing in for the real page","a generated picture standing in for a real record","a joke aimed at the family, the viewer or a named person","no gag on the death","his name on screen","invented numbers: every figure on screen is either the family's account as Tom's Hardware reported it or a figure printed on a named real page shown as itself"],
     "real_artifacts":[{"asset":"tomshw","text":"Grieving family uses AI chatbot to cut hospital bill from $195,000 to $33,000"}]},
   "proof":{"beat":"question"}},
 "title_line":TLINE,
 "title_moment":{"title":"Your AI auditor: missing money or skeletons?","line":TLINE,"spans":{"short":{"from_w":45,"to_w":59}},"card":True}}

# Pictures on every face beat (piece guard talking_head, 19 Nov) and no WINDOW on the tall cut (tall_windows): chips
# of his own words carry the face beats; the short's take moves to SPLIT, the long's to the window it already uses.
import re as _re
def _norm(w): return _re.sub(r"[^a-z0-9']", '', w.lower().replace('\u2019', "'"))
def chipify(cut, beats, bid, chips, layout, prefix):
    W = json.load(open(P + f'words.{cut}.json'))
    b = next(x for x in beats if x['id'] == bid)
    lo, hi = b['span']['from_w'], b['span']['to_w']
    b['layout'] = layout; b['plate'] = {"source": "take"}
    if layout == 'SPLIT': b.pop('face', None)
    else: b['face'] = 'window'
    b.pop('override_reason', None)
    at = lo
    for n, (word, text) in enumerate(chips):
        at = next(i for i in range(at, hi + 1) if _norm(W[i]['word']) == _norm(word))
        obj = f"{prefix}_{bid}_{n}"
        objects.append({"obj": obj, "device": "query_chip", "meaning": f"his own words on screen: {text.lower()}",
                        "persist": {"from_beat": bid, "to_beat": bid}, "params": {"text": text}})
        b['uses'].append(obj); b['events'].append(ev(at, obj, 'enter'))
    import math as _m
    need = _m.ceil((hi - lo + 1) / (2.6 * 3))
    taken = {e['at_w'] for e in b['events']}
    chips_here = [u for u in b['uses'] if u.startswith(prefix + '_' + bid + '_')]
    k = 0
    for w in range(lo, hi + 1):
        if len(b['events']) >= need: break
        if w in taken: continue
        first = {e['obj']: e['at_w'] for e in b['events']}
        said = _norm(W[w]['word'])
        own = [c for c in chips_here if first.get(c, hi + 1) < w and len(said) > 3
               and said in {_norm(t) for t in next(o for o in objects if o['obj'] == c)['params']['text'].split()}]
        if not own: continue
        b['events'].append(ev(w, own[0], 'highlight')); taken.add(w); k += 1
    b['events'].sort(key=lambda e: e['at_w'])
def slamify(cut, beats, bid, slams, prefix):
    """His key words slammed one at a time over the SPLIT panel (motion ai-music-slam), each with his phrase on the tape."""
    W = json.load(open(P + f'words.{cut}.json'))
    b = next(x for x in beats if x['id'] == bid)
    lo, hi = b['span']['from_w'], b['span']['to_w']
    b['layout'] = 'SPLIT'; b['plate'] = {"source": "take"}; b.pop('face', None); b.pop('override_reason', None)
    b['uses'], b['events'] = [], []
    at, marks = lo, []
    for n, (said, word, tape) in enumerate(slams):
        at = next(i for i in range(at, hi + 1) if _norm(W[i]['word']) == _norm(said))
        obj = f"{prefix}_{bid}_slam{n}"
        objects.append({"obj": obj, "device": "slam_word", "meaning": f"his own word slammed as he says it: {word.lower()} ({tape.lower()})",
                        "persist": {"from_beat": bid, "to_beat": bid}, "params": {"word": word, "tapeText": tape}})
        b['uses'].append(obj); marks.append((at, obj))
    for i, (at, obj) in enumerate(marks):
        b['events'].append(ev(at, obj, 'enter'))
        if i + 1 < len(marks):
            b['events'].append(ev(marks[i + 1][0] - 1, obj, 'exit'))
    b['events'].sort(key=lambda e: e['at_w'])
def no_marks_on_pages(cut, beats):
    """A 'mark' on an evidence card swaps the screenshot for replacement text (evidence_card/state.ts), so a real page
    is never marked: it is held still to be read, and a beat left short of events says why."""
    import math as _m
    cards = {o['obj'] for o in objects if o['device'] == 'evidence_card' and (o['params'] or {}).get('kind') in ('screenshot', 'document')}
    for b in beats:
        b['events'] = [e for e in b['events'] if not (e['verb'] == 'mark' and e['obj'] in cards)]
        need = _m.ceil((b['span']['to_w'] - b['span']['from_w'] + 1) / (2.6 * 3))
        if len(b['events']) < need and not b.get('override_reason') and set(b['uses']) & cards:
            b['override_reason'] = "a real page held still to be read: a mark would replace the screenshot with text (evidence_card)"
def tosplit(beats, bid):
    b = next(x for x in beats if x['id'] == bid)
    b['layout'] = 'SPLIT'; b['plate'] = {"source": "take"}; b.pop('face', None)

for _b in ('hook', 'code', 'hindsight'): tosplit(beats, _b)
slamify('short', beats, 'face', [("archives", "ARCHIVES", "EVERYONE'S, RIGHT NOW"), ("teams", "TEAMS", "HOSPITALS PAY WHOLE TEAMS"), ("chatbot", "CHATBOT", "A CHATBOT BEAT THEM")], 's')
slamify('short', beats, 'love', [("argue", "ARGUE", "AN OLD BILL CAN'T ARGUE BACK"), ("written", "WRITTEN", "THE RULES ARE WRITTEN DOWN"), ("every", "EVERY", "AI READS EVERY LINE")], 's')
slamify('short', beats, 'code', [("billed", "BILLED", "CARE BILLED UNDER"), ("expensive", "EXPENSIVE", "A MUCH MORE EXPENSIVE CODE"), ("brother-in-law", "BROTHER-IN-LAW", "THAN THE CARE HIS BROTHER-IN-LAW ACTUALLY GOT")], 's')
slamify('short', beats, 'hindsight', [("guessing,", "GUESSING", "NEXT YEAR: IT'S GUESSING"), ("analysing.", "ANALYSING", "LAST YEAR: IT'S ANALYSING")], 's')
slamify('short', beats, 'whose', [("mistake", "MISTAKE", "WHOSE MISTAKE?"), ("hospital's.", "HOSPITAL'S", "IT WAS THE HOSPITAL'S")], 's')
no_marks_on_pages('short', beats)
for _b in beats:  # the bill's own page behind every SPLIT panel, never plain ink (Krish, 19 Nov)
    if _b['layout'] == 'SPLIT': _b['backdrop'] = 'asset:tomshw'
# Full face, slam band above his head (Krish's Critic, 19 Nov): his face stays high with the captions under his chin.
BAND = {"left": 135, "top": 230, "width": 1080, "height": 480, "scale": 0.75}
for _b in beats:
    if _b['layout'] == 'SPLIT':
        _b['layout'] = 'F1'; _b['face'] = 'full'; _b.pop('backdrop', None)
        for _u in _b['uses']:
            next(o for o in objects if o['obj'] == _u)['params']['place'] = dict(BAND)
next(o for o in objects if o['obj'] == 'strike')['params'].update({"from": [230, 135], "to": [850, 130]})
# The hook's counter and its strike sit lower in the band, clear of the frame's top edge and still above his head
# (Fri 20 Nov proof: the panel rode up to the top edge); the strike runs through the digits, not the source line.
for _o in ('k_billed', 'strike'):
    next(o for o in objects if o['obj'] == _o)['params']['place'] = dict(BAND, top=BAND['top'] + 40)
# The cash comes out of the sofa on 'missing money' and the skeleton falls on 'skeletons', not at the beat's start
# (Krish, 19 Nov: "money back down the back of couches"; the Critic, 19 Nov: both played early).
next(o for o in objects if o['obj'] == 'sofa')['params']['shots'][0]['hold_s'] = 2.3
next(o for o in objects if o['obj'] == 'closet')['params']['shots'][0]['hold_s'] = 0.6
next(o for o in objects if o['obj'] == 'th_head')['persist']['to_beat'] = 'lines'  # the same page held: its last line is his 'line by line'
json.dump(spec,open(P+'spec.json','w'),indent=1); print('wrote', len(beats),'beats', len(objects),'objects')

# ---------------- the long cut (16:9) ----------------
def evs(obj, ats, first='enter'):
    out=[ev(ats[0],obj,first)]
    for a in ats[1:]: out.append(ev(a,obj,'mark',f'w{a}'))
    return out
UP=("shots/upworthy-tenant.png","Upworthy Scoop","14 Dec 2024"); NBC=("shots/nbc-dana.png","NBC News","Jan 2024"); HLS=("shots/harvard-krafton.png","Harvard Law School Forum on Corporate Governance","20 Apr 2026")
lobj=[
 {"obj":"l_k","device":"kinetic_stat","dataset":"bill-after","meaning":"the bill the family was sent, counting down to where it landed (his account, Tom's Hardware)","persist":{"from_beat":"hook","to_beat":"hook"},"params":{"ghost":True,"prefix":"$","group":True}},
 {"obj":"l_src","device":"query_chip","meaning":"whose numbers these are: the family's account as Tom's Hardware reported it","persist":{"from_beat":"hook","to_beat":"hook"},"params":{"text":"THE FAMILY'S ACCOUNT · TOM'S HARDWARE"}},
 plate("l_sofa","plates/long-sofa-money-169.mp4","the missing money: cash and old receipts pulled from the back of the office sofa (Krish, 19 Nov: \"money back down the back of couches\")",1920,1080,"l_question"),
 plate("l_closet","plates/b4-closet-skeleton-916-from2s1.mp4","the skeletons in your closet: the cupboard spills its old files and a skeleton (the tall clip framed on the wide stage; the wide clip prints a year nothing owns)",1080,1920,"l_skeletons"),
 card("l_head",*TH,(0.13,0.51,0.5,0.32),"the headline: grieving family uses AI chatbot to cut hospital bill from $195,000 to $33,000","proof"),
 card("l_lede",*TH,(0.13,0.51,0.5,0.21),"the headline as he explains it: Claude highlighted duplicative charges and improper coding","l_code"),
 plate("l_michelin","plates/b8-steak-sandwich-916.mp4","the gap between what was billed and what was served: the cloche lifts on a sad sandwich while the bill reads STEAK (the short's clip, framed on the wide stage; the wide tasting-menu clip printed a garbled row of zeros nothing owns)",1080,1920,"l_michelin"),
 {"obj":"l_after","device":"kinetic_stat","dataset":"bill-after","meaning":"the bill counting down from $195,000 to where it landed, about $33,000, on \"fell\" (his account)","persist":{"from_beat":"l_fell","to_beat":"l_fell"},"params":{"ghost":True,"prefix":"$","group":True}},
 {"obj":"l_caveat","device":"query_chip","meaning":"the caveat on screen: his account, the hospital has not confirmed","persist":{"from_beat":"l_fell","to_beat":"l_fell"},"params":{"text":"HIS ACCOUNT · HOSPITAL HASN'T CONFIRMED"}},
 card("l_tenant",*UP,(0.03,0.1,0.62,0.28),"the headline: tenant uses ChatGPT to uncover crucial evidence and win legal battle against greedy landlord","l_tenant"),
 {"obj":"l_next","device":"query_chip","meaning":"next year: there is no page to check a guess against","persist":{"from_beat":"l_hindsight","to_beat":"l_hindsight"},"params":{"text":"NEXT YEAR · NO PAGE TO CHECK"}},
 {"obj":"l_last","device":"query_chip","meaning":"last year: every line and every rule is already on file","persist":{"from_beat":"l_hindsight","to_beat":"l_hindsight"},"params":{"text":"LAST YEAR · EVERY LINE ON FILE"}},
 {"obj":"l_cust","device":"query_chip","meaning":"the twist: your customers run the same audit on you","persist":{"from_beat":"l_twist","to_beat":"l_twist"},"params":{"text":"YOUR INVOICES · THEIR CHATBOT"}},
 plate("l_closet2","plates/b4-closet-skeleton-916-from2s1.mp4","the callback: the same cupboard, now opening on 'whose closet it was opening'",1080,1920,"l_closet"),
 card("l_dana",*NBC,(0.19,0.49,0.76,0.3),"the headline: a prestigious cancer institute is correcting dozens of papers and retracting others after a blogger cried foul","l_dana"),
 card("l_krafton",*HLS,(0.15,0.6075,0.49,0.064),"the Harvard Law forum on Fortis Advisors v. Krafton: the court quoted at length from the AI chats the buyer's CEO had about taking control of the studio","l_krafton"),
 plate("l_sofa2","plates/long-sofa-money-169.mp4","money, found",1920,1080,"l_money"),
 plate("l_closet3","plates/b4-closet-skeleton-916-from2s1.mp4","skeletons, found",1080,1920,"l_both"),
 plate("l_invoices","plates/long-invoices-169.png","his close, generated at his word (\"generate it\", 19 Nov): last year's invoices poured into the AI, a skeleton hand at the back of the folder",2688,1520,"l_act"),
]
for o in lobj:
    if o['device']=='scene_plate':
        sh=o['params']['shots'][0]
        if sh['src'].endswith('.png'): sh.pop('kind',None)
        if sh['width']<sh['height']: o['params']['full']=False
objects.extend(lobj)
L=[
 dict(id="hook",role="hook",span={"from_w":0,"to_w":19},viewer_task="locate_story",point="AI just cut a family's six-figure hospital bill to a fraction",layout="WINDOW",plate={"source":"take"},uses=["l_k","l_src"],events=[ev(0,"l_src","enter"),ev(15,"l_k","enter"),ev(15,"l_k","count_to","billed"),ev(18,"l_k","count_to","after")],transition_out="cut",face="window"),
 dict(id="face",role="bridge",span={"from_w":20,"to_w":78},viewer_task="connect_with_speaker",point="Imagine what it finds in your last year of paperwork, when whole hospital teams missed it",layout="F1",plate={"source":"take"},uses=[],events=[],transition_out="cut",face="full",override_reason=FACE),
 dict(id="l_question",role="pivot",span={"from_w":79,"to_w":88},viewer_task="locate_story",point="Will your AI auditor find the missing money?",layout="STAGE",plate={"source":"none"},uses=["l_sofa"],events=[ev(79,"l_sofa","enter","0")],transition_out="cut",face="off",override_reason=CLIP),
 dict(id="l_skeletons",role="pivot",span={"from_w":89,"to_w":96},viewer_task="feel_stakes",point="Or will it find the skeletons in your closet?",layout="STAGE",plate={"source":"none"},uses=["l_closet"],events=[ev(89,"l_closet","enter","0")],transition_out="cut",face="off",override_reason=CLIP),
 dict(id="proof",role="anchor",span={"from_w":97,"to_w":136},viewer_task="verify_evidence",point="A real family owed the whole bill after a death with no health cover",layout="WINDOW",plate={"source":"take"},uses=["l_head"],events=evs("l_head",[97,107,114,121,128,133]),transition_out="cut",face="window"),
 dict(id="l_bitmiss",role="bridge",span={"from_w":137,"to_w":169},viewer_task="connect_with_speaker",point="He didn't argue with the total; he asked for every line",layout="F1",plate={"source":"take"},uses=[],events=[],transition_out="cut",face="full",override_reason=FACE),
 dict(id="l_code",role="anchor",span={"from_w":170,"to_w":208},viewer_task="understand_mechanism",point="Every service has a code and a price: one procedure twice, care billed under a dearer code",layout="WINDOW",plate={"source":"take"},uses=["l_lede"],events=evs("l_lede",[170,177,184,190,196,201,206]),transition_out="cut",face="window"),
 dict(id="l_michelin",role="bridge",span={"from_w":209,"to_w":230},viewer_task="feel_stakes",point="Billed for the tasting menu, served the burger",layout="STAGE",plate={"source":"none"},uses=["l_michelin"],events=[ev(209,"l_michelin","enter","0")],transition_out="cut",face="off",override_reason=CLIP),
 dict(id="l_fell",role="anchor",span={"from_w":231,"to_w":272},viewer_task="verify_evidence",point="He sent the list and the bill fell to about a sixth; the hospital has said nothing",layout="WINDOW",plate={"source":"take"},uses=["l_after","l_caveat"],events=[ev(231,"l_after","enter"),ev(231,"l_after","count_to","billed"),ev(244,"l_after","count_to","after"),ev(250,"l_caveat","enter"),ev(256,"l_caveat","highlight"),ev(261,"l_caveat","highlight"),ev(269,"l_caveat","highlight")],transition_out="cut",face="window"),
 dict(id="l_tenant",role="anchor",span={"from_w":273,"to_w":318},viewer_task="verify_evidence",point="A tenant pasted his lease into ChatGPT, found the deposit cap and won",layout="WINDOW",plate={"source":"take"},uses=["l_tenant"],events=evs("l_tenant",[273,282,289,297,302,306,313]),transition_out="cut",face="window"),
 dict(id="l_paperwork",role="bridge",span={"from_w":319,"to_w":354},viewer_task="connect_with_speaker",point="Never pick a paperwork fight with someone who has a chatbot and a free evening",layout="F1",plate={"source":"take"},uses=[],events=[],transition_out="cut",face="full",override_reason=FACE),
 dict(id="l_love",role="bridge",span={"from_w":355,"to_w":401},viewer_task="connect_with_speaker",point="An old bill cannot argue back and its rules are written down",layout="F1",plate={"source":"take"},uses=[],events=[],transition_out="cut",face="full",override_reason=FACE),
 dict(id="l_hindsight",role="anchor",span={"from_w":402,"to_w":448},viewer_task="understand_mechanism",point="About next year AI is guessing; about last year it is reading",layout="WINDOW",plate={"source":"take"},uses=["l_next","l_last"],events=[ev(402,"l_next","enter"),ev(413,"l_next","highlight"),ev(420,"l_last","enter"),ev(429,"l_last","highlight"),ev(436,"l_next","highlight"),ev(441,"l_last","highlight"),ev(447,"l_last","highlight")],transition_out="cut",face="window"),
 dict(id="l_lead",role="bridge",span={"from_w":449,"to_w":506},viewer_task="connect_with_speaker",point="Every flag is a lead a person checks; your contracts and price lists are your rules",layout="F1",plate={"source":"take"},uses=[],events=[],transition_out="cut",face="full",override_reason=FACE),
 dict(id="l_twist",role="pivot",span={"from_w":507,"to_w":538},viewer_task="feel_stakes",point="To your customers, you are the hospital",layout="WINDOW",plate={"source":"take"},uses=["l_cust"],events=[ev(507,"l_cust","enter"),ev(516,"l_cust","highlight"),ev(523,"l_cust","highlight"),ev(528,"l_cust","highlight"),ev(532,"l_cust","highlight")],transition_out="cut",face="window"),
 dict(id="l_whose",role="bridge",span={"from_w":539,"to_w":557},viewer_task="connect_with_speaker",point="Whose mistake did Claude find? The hospital's",layout="F1",plate={"source":"take"},uses=[],events=[],transition_out="cut",face="full",override_reason=FACE),
 dict(id="l_closet",role="pivot",span={"from_w":558,"to_w":566},viewer_task="feel_stakes",point="It didn't care whose closet it was opening",layout="STAGE",plate={"source":"none"},uses=["l_closet2"],events=[ev(558,"l_closet2","enter","0")],transition_out="cut",face="off",override_reason=CLIP),
 dict(id="l_yours",role="payoff",span={"from_w":567,"to_w":576},viewer_task="connect_with_speaker",point="And it won't care when it opens yours",layout="F1",plate={"source":"take"},uses=[],events=[],transition_out="cut",face="full",override_reason=FACE),
 dict(id="l_dana",role="anchor",span={"from_w":577,"to_w":654},viewer_task="verify_evidence",point="Software found faked pictures in a cancer centre's old papers, from outside the building",layout="WINDOW",plate={"source":"take"},uses=["l_dana"],events=evs("l_dana",[577,584,593,601,609,615,620,628,636,645,650]),transition_out="cut",face="window"),
 dict(id="l_krafton",role="anchor",span={"from_w":655,"to_w":739},viewer_task="verify_evidence",point="A boss asked ChatGPT how to dodge a bonus, and the judge quoted the chats",layout="WINDOW",plate={"source":"take"},uses=["l_krafton"],events=evs("l_krafton",[655,665,672,679,686,690,698,704,712,719,727,732]),transition_out="cut",face="window"),
 dict(id="l_money",role="bridge",span={"from_w":740,"to_w":742},viewer_task="feel_stakes",point="Money, found down the back of the sofa",layout="STAGE",plate={"source":"none"},uses=["l_sofa2"],events=[ev(740,"l_sofa2","enter","0")],transition_out="cut",face="off",override_reason=CLIP),
 dict(id="l_both",role="pivot",span={"from_w":743,"to_w":746},viewer_task="feel_stakes",point="or skeletons: it finds both",layout="STAGE",plate={"source":"none"},uses=["l_closet3"],events=[ev(743,"l_closet3","enter","0")],transition_out="cut",face="off",override_reason=CLIP),
 dict(id="l_listfirst",role="bridge",span={"from_w":747,"to_w":775},viewer_task="connect_with_speaker",point="The real question is who reads that list first",layout="F1",plate={"source":"take"},uses=[],events=[],transition_out="cut",face="full",override_reason=FACE),
 dict(id="l_act",role="anchor",span={"from_w":776,"to_w":815},viewer_task="land_payoff",point="This week he puts his own last year's invoices through the AI, to find his skeletons first",layout="STAGE",plate={"source":"none"},uses=["l_invoices"],events=[ev(776,"l_invoices","enter","0")],transition_out="cut",face="off",override_reason=CLIP),
 dict(id="close",role="bridge",span={"from_w":816,"to_w":821},viewer_task="land_payoff",point="The full story is at makeyourmindup.ai",layout="F1",plate={"source":"take"},uses=[],events=[],transition_out="cut",face="full",override_reason=FACE),
]
assets.append({"id":"long-master","kind":"recording","origin":"capture","path":"long.master.mov","frame":{"width":1080,"height":1920},"sha256":sha(A+'long.master.mov'),"licence":"Krish's own recording, 18 Nov 2026 (ai-finding-your-skeletons-long.mp4, sha256 b1428797), restarts and long pauses cut from the reviewed plan's keep spans, joins in measured quiet, 1.0x, 4:25"})
for aid,src,job in [("long-sofa-money-169","plates/long-sofa-money-169.mp4","9b08ad6d-8f60-4b73-a76d-5c24c79cfe5e"),("long-invoices-169","plates/long-invoices-169.png","d58bddce-7ff3-4dcf-8651-637f10f0ee15")]:
    assets.append({"id":aid,"kind":"broll","origin":"generated","path":src,"sha256":sha(A+src),"job_id":job,"tool":"higgsfield:gpt_image_2_6 then seedance_2_5","licence":"generated for this piece; Krish approved up to 710 credits, 19 Nov (\"Up to 710, 1080p (Recommended)\"); jobs in ve/generations.json"})
for aid,src,url,when in [("upworthy-tenant","shots/upworthy-tenant.png","https://scoop.upworthy.com/tenant-uses-chat-gpt-to-uncover-crucial-evidence-and-win-legal-battle-against-greedy-landlord","14 Dec 2024"),("nbc-dana","shots/nbc-dana.png","https://www.nbcnews.com/science/science-news/allegations-research-misconduct-roil-dana-farber-cancer-institute-rcna135521","Jan 2024"),("harvard-krafton","shots/harvard-krafton.png","https://corpgov.law.harvard.edu/2026/04/20/how-a-buyers-ai-conversations-sank-its-earnout-avoidance-strategy/","20 Apr 2026")]:
    assets.append({"id":aid,"kind":"screenshot","origin":"source","path":src,"sha256":sha(A+src),"licence":f"screenshot of the real page, {when}, {url}, captured 19 Nov 2026"})
spec['objects']=objects; spec['assets']=assets
spec['cuts']['long']={"aspect":"16:9","take":"long-master","max_s":330,"excerpt":False,"edit":{"remove":[],"speed":1},"bed":{"ledger_id":"make-up-your-mind-instrumental","reason":"a 4:25 cut: the house's long bed holds the one bed shape at this length"},"captions":{"region":"default","emphasis":[15,18,85,90,189,201,230,247,311,318,413,429,437,448,521,563,575,616,659,713,743,746,812]},"beats":L}
spec['title_moment']['spans']['long']={"from_w":79,"to_w":93}

chipify('long', L, 'face', [("subscriptions", "LAST YEAR'S SUBSCRIPTIONS AND INVOICES"), ("Hospitals", "WHOLE TEAMS TO GET BILLS RIGHT"), ("chatbot", "A CHATBOT FOUND WHAT THEY MISSED"), ("folder", "YOUR FINANCE LEAD'S UNREAD FOLDER")], 'WINDOW', 'l')
chipify('long', L, 'l_bitmiss', [("argue", "HE DIDN'T ARGUE THE TOTAL"), ("line", "HE ASKED FOR IT LINE BY LINE"), ("Claude.", "THEN GAVE THE LOT TO CLAUDE")], 'WINDOW', 'l')
chipify('long', L, 'l_paperwork', [("paperwork", "NEVER PICK A PAPERWORK FIGHT"), ("chatbot", "WITH SOMEONE WHO HAS A CHATBOT"), ("why", "SO WHY ARE CHATBOTS SO GOOD AT THIS?")], 'WINDOW', 'l')
chipify('long', L, 'l_love', [("argue", "AN OLD BILL CANNOT ARGUE BACK"), ("rules", "THE RULES ARE WRITTEN DOWN"), ("every", "EVERY LINE, AGAINST THOSE RULES"), ("coffee.", "NO COFFEE BREAK")], 'WINDOW', 'l')
chipify('long', L, 'l_lead', [("lead.", "EVERY FLAG IS A LEAD"), ("person", "A PERSON CHECKS IT"), ("contracts", "YOUR RULES: CONTRACTS AND PRICE LISTS"), ("invoices,", "GIVE AI LAST YEAR'S INVOICES"), ("things", "THINGS THAT DON'T MAKE FULL SENSE")], 'WINDOW', 'l')
chipify('long', L, 'l_hindsight', [("terrible", "A TERRIBLE FORTUNE TELLER, A REALLY GOOD AUDITOR")], 'WINDOW', 'l')
chipify('long', L, 'l_listfirst', [("first?", "WHO READS THAT LIST FIRST?"), ("carpet", "BRUSHED UNDER THE CARPET"), ("customer", "YOUR CUSTOMER MAY FIND IT FIRST")], 'WINDOW', 'l')
for _b in L:
    if _b['layout'] == 'WINDOW':
        _b['layout'] = 'F1'; _b['face'] = 'full'
def own_word_pulses(cut, beats):
    W = json.load(open(P + f'words.{cut}.json'))
    chips = {o['obj']: {_norm(t) for t in o['params']['text'].replace('·', ' ').split() if len(_norm(t)) > 3}
             for o in objects if o['device'] == 'query_chip'}
    for b in beats:
        lo, hi = b['span']['from_w'], b['span']['to_w']
        enters = {e['obj']: e['at_w'] for e in b['events'] if e['verb'] == 'enter'}
        taken = {e['at_w'] for e in b['events'] if e['verb'] != 'highlight'}
        kept = []
        for e in b['events']:
            if e['verb'] != 'highlight' or e['obj'] not in chips or _norm(W[e['at_w']]['word']) in chips[e['obj']]:
                kept.append(e); continue
            spots = [i for i in range(enters.get(e['obj'], lo) + 1, hi + 1)
                     if _norm(W[i]['word']) in chips[e['obj']] and i not in taken]
            if spots:
                at = min(spots, key=lambda i: abs(i - e['at_w'])); taken.add(at); kept.append({**e, 'at_w': at})
        b['events'] = sorted(kept, key=lambda e: e['at_w'])
own_word_pulses('long', L)
no_marks_on_pages('long', L)
json.dump(spec,open(P+'spec.json','w'),indent=1); print('long', len(L),'beats; objects', len(objects))
