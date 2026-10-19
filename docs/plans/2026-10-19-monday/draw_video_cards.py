"""Render independently composed wide/tall explanatory panels, with layout proof."""
import base64
import html
import json
import sys
from pathlib import Path
from prepare_video import ROOT, PLAN, WORK, HEADINGS
sys.path.insert(0, str(ROOT / 'scripts/pages'))
import brand

def esc(s): return html.escape(str(s))
def logo(name):
    f={'Google':'google-cream.svg','OpenAI':'openai-symbol-cream.svg','Anthropic':'anthropic-symbol-cream.svg'}[name]
    return '<img class="mark" src="data:image/svg+xml;base64,'+base64.b64encode((PLAN/'logos'/f).read_bytes()).decode()+'">'
def row(k,v,sub=''):
    return f'<div class="row"><div><strong>{esc(k)}</strong><small>{esc(sub)}</small></div><b>{esc(v)}</b></div>'
def company(name,main,detail):
    return f'<div class="company">{logo(name)}<div><strong>{name}</strong><p>{main}</p><small>{detail}</small></div></div>'

# Each statement is tied to the take and existing research. No invented data.
CARDS = [
 ('google',HEADINGS[0], 'What changes, and when?',
  '<div class="date">1 DECEMBER 2026</div>'+row('AI reads','$2 → $4','US dollars per million input tokens')+row('AI writes','$10 → $20','US dollars per million output tokens'),
  'Google launch pricing • public rates • as discussed 19 Oct 2026'),
 ('rivals',HEADINGS[1], 'How do the three offers differ?',
  company('Google','Launch price ends','New public rate from 1 December')+company('OpenAI','Promotion has an end date','At least through 21 November')+company('Anthropic','Planned rise cancelled','A newer top model also arrived cheaper'),
  'Provider announcements • dates and conditions matter'),
 ('same',HEADINGS[1], 'Where have their top-model prices landed?',
  '<div class="columns"><span>PER MILLION TOKENS</span><span>READ</span><span>WRITE</span></div>'+''.join(f'<div class="prices"><div>{logo(n)}<strong>{n}</strong></div><b>$4</b><b>$20</b></div>' for n in ['Google','OpenAI','Anthropic'])+'<div class="note">Google: from December. OpenAI: promotional rate.</div>',
  'US dollars • selected models in this story • not every product'),
 ('lockin',HEADINGS[2], 'Why can switching become expensive?',
  '<div class="flow"><div><b>01</b><strong>Your instructions</strong></div><div><b>02</b><strong>Your tools</strong></div><div><b>03</b><strong>Your team’s habits</strong></div></div><div class="takeaway">The more you build around one AI,<br>the harder it can be to move.</div>',
  'Commercial explanation • Krish’s assessment'),
 ('reuse',HEADINGS[3], 'What does the AI reuse?',
  '<div class="doc">SAME POLICY DOCUMENT</div><div class="questions"><span>Customer A’s question</span><span>Customer B’s question</span></div><div class="takeaway">The question changes.<br>The policy repeats.</div><div class="note">The discount applies to eligible reused input,<br>not every word on your bill.</div>',
  'Google context caching • qualifying repeated input'),
 ('bill',HEADINGS[3], 'Does the discount protect the whole bill?',
  '<div class="date">ILLUSTRATIVE MONTH • SAME WORKLOAD</div>'+row('Before December','$980','Reuse discount included')+row('From December','$1,960','Reuse discount still included')+'<div class="takeaway">A smaller bill can still double.</div>',
  'Worked example from the article • not a company invoice'),
 ('jobs',HEADINGS[4], 'How do you compare cheaper AI properly?',
  '<div class="equation"><span>AI charge</span><b>+</b><span>Human correction</span></div><div class="takeaway">Compare the cost of<br>a finished job.</div><div class="note">Test 10 real jobs your team already does.</div>',
  'Decision rule • check actual work, not just the token price'),
 ('rules',HEADINGS[5], 'What holds when the next offer changes?',
  '<div class="rules"><div><b>01</b><strong>Budget at the full price</strong></div><div><b>02</b><strong>Agree a price and an end date</strong></div><div><b>03</b><strong>Keep the freedom to switch</strong></div></div>',
  'Krish’s three rules • for the person who owns the AI budget'),
 ('budget',HEADINGS[6], 'What number belongs in the budget?',
  '<div class="bigword">FULL<br>PRICE</div><div class="note">Treat a temporary discount as upside.<br>Do not depend on it lasting.</div>',
  'Rule 01 • budgeting judgment'),
 ('contract',HEADINGS[7], 'What needs to be agreed in writing?',
  '<div class="contract"><div>PRICE <span>Agreed rate</span></div><div>UNTIL <span>Agreed date</span></div></div><div class="note">Check whether your contract fixes the price<br>or follows the public rate.</div>',
  'Rule 02 • check your own contract'),
 ('switch',HEADINGS[8], 'What makes another AI a real option?',
  '<div class="rules"><div><b>01</b><strong>Keep your instructions</strong></div><div><b>02</b><strong>Keep your data usable</strong></div><div><b>03</b><strong>Keep real jobs to test against</strong></div></div>',
  'Rule 03 • Krish’s practical recommendation'),
 ('prediction',HEADINGS[9], 'What is the specific call?',
  '<div class="prediction"><b>95%</b><span>KRISH’S CONFIDENCE</span></div><div class="note">One of Google, OpenAI or Anthropic<br>cuts its top-model rate below $4 read / $20 write<br>per million tokens by 31 December 2026.</div>',
  'Prediction • personal judgment, not a provider commitment'),
 ('questions',HEADINGS[10], 'What should you ask next?',
  '<div class="rules"><div><b>?</b><strong>How much of our bill gets a discount?</strong></div><div><b>?</b><strong>Does our contract fix the price?</strong></div></div><div class="takeaway">Get the answers before<br>you change anything.</div>',
  'Monday’s action • from the recorded long cut'),
]

CSS='''*{box-sizing:border-box}body{margin:0;background:#0c1512;color:#f4efe4;font-family:Archivo}main{height:100vh;padding:48px 56px 38px;display:flex;flex-direction:column;border-top:12px solid #ffd84d}header{font:21px "IBM Plex Mono";letter-spacing:1.5px;color:#ffd84d;margin-bottom:22px}h1{font:66px/1.06 Anton;margin:0 0 28px;max-width:100%}.body{flex:1;display:flex;flex-direction:column;justify-content:center;gap:22px;min-height:0}footer{font:20px/1.4 "IBM Plex Mono";color:#b3bdb4;margin-top:25px}.date{font:23px "IBM Plex Mono";color:#ffd84d;letter-spacing:1px}.row{padding:25px 0;border-bottom:2px solid #3b4840;display:flex;align-items:center;justify-content:space-between;gap:20px}strong{font-size:38px;font-weight:650}small{display:block;font-size:24px;line-height:1.4;margin-top:8px;color:#c2cec4}.row b{font:82px Anton;color:#ffd84d;white-space:nowrap}.company{display:flex;align-items:center;gap:30px;padding:20px 0;border-bottom:2px solid #35443a}.mark{width:90px;height:90px;object-fit:contain}.company p{font-size:37px;margin:5px 0}.columns,.prices{display:grid;grid-template-columns:1.5fr .6fr .6fr;align-items:center;gap:20px}.columns{font:20px "IBM Plex Mono";color:#b6c5b9}.prices{border-bottom:2px solid #35443a;padding:22px 0}.prices>div{display:flex;gap:20px;align-items:center}.prices b{font:86px Anton;color:#ffd84d}.flow,.rules{display:flex;flex-direction:column;gap:24px}.flow>div,.rules>div{display:flex;gap:30px;align-items:center;padding:25px 30px;background:#19271f;border-left:6px solid #ffd84d}.flow b,.rules b{font:52px Anton;color:#ffd84d}.takeaway{font:55px/1.15 Anton;margin-top:22px}.note{font-size:31px;line-height:1.4;color:#d1dccf}.doc{border:3px solid #ffd84d;padding:34px;font:42px Anton;text-align:center;background:#20291b}.questions{display:flex;gap:24px}.questions span{flex:1;border-top:3px solid #ffd84d;padding:28px 15px;font-size:31px;text-align:center}.equation{display:flex;align-items:center;gap:22px}.equation span{background:#1d3025;padding:28px;font-size:38px}.equation b{font:66px Anton;color:#ffd84d}.bigword{font:156px/.98 Anton;color:#ffd84d}.contract>div{font:26px "IBM Plex Mono";padding:35px;border-bottom:3px solid #ffd84d;display:flex;justify-content:space-between}.contract span{font:58px Anton}.prediction b{font:200px/.95 Anton;color:#ffd84d;display:block}.prediction span{font:22px "IBM Plex Mono";display:block;margin-top:15px}body.tall main{padding:35px 45px 30px}body.tall h1{font-size:61px;margin-bottom:22px}body.tall header{font-size:21px;margin-bottom:20px}body.tall footer{font-size:20px}body.tall .row b{font-size:77px}body.tall strong{font-size:36px}body.tall .takeaway{font-size:52px}body.tall .company{padding:12px 0}body.tall .company p{font-size:36px}body.tall .prices b{font-size:77px}body.tall .prediction b{font-size:180px}'''

def main():
    out=WORK/'kit/panels'; out.mkdir(parents=True,exist_ok=True)
    receipt=[]
    with brand.playwright() as p:
        browser=brand.browser(p)
        for shape,(w,h) in {'16x9':(1314,1080),'9x16':(1080,1000)}.items():
            page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
            for i,(key,title,question,body,source) in enumerate(CARDS):
                larger='''.prices{padding:14px 0}.prices b{line-height:1}.body{gap:18px}h1{font-size:76px}.row b{font-size:110px}strong{font-size:49px}small{font-size:30px}.note{font-size:39px}.takeaway{font-size:64px}.bigword{font-size:240px}.contract span{font-size:76px}.prediction b{font-size:235px}.flow>div,.rules>div{padding:30px}.company p{font-size:44px}.company strong{font-size:43px}.prices b{font-size:112px}.equation span{font-size:47px}.doc{font-size:51px;padding:45px}.questions span{font-size:37px}.date{font-size:28px}body.tall strong{font-size:44px}body.tall .row b{font-size:96px}body.tall .takeaway{font-size:59px}body.tall .company p{font-size:41px}body.tall .prices b{font-size:98px}body.tall .prediction b{font-size:215px}'''
                source_html=f'<!doctype html><style>{brand.font_css()}\n{CSS}\n{larger}</style><body class="{"tall" if shape=="9x16" else "wide"}"><main><header>FOLLOW.THE.MONEY / {i+1:02d}</header><h1>{esc(title)}</h1><div class="body">{body}</div><footer>{esc(source)}</footer></main></body>'
                file=out/f'{key}-{shape}.html'; file.write_text(source_html,encoding='utf-8')
                page.set_content(source_html); page.evaluate('document.fonts.ready')
                problems=page.evaluate('''() => [...document.querySelectorAll('h1,.body,footer')].flatMap(e=>{const r=e.getBoundingClientRect(); return r.bottom>innerHeight-12 || r.right>innerWidth-20 || (e.className==='body' && e.scrollHeight>e.clientHeight+2) ? [{tag:e.tagName, text:e.innerText, box:{y:r.y,bottom:r.bottom},scroll:e.scrollHeight,height:e.clientHeight}]:[]})''')
                if problems: raise RuntimeError(f'{key}/{shape}: {problems}')
                page.screenshot(path=str(out/f'{key}-{shape}.png'))
                receipt.append({'id':key,'shape':shape,'heading':title,'question':question,'layout':'fits','source_note':source})
            page.close()
        browser.close()
    (PLAN/'video-card-layout-proof.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
    print(f'Drew {len(receipt)} panels; all layout bounds passed. Visual review still required.')

if __name__=='__main__': main()

