# Screenshots the IMF, NPR and Stanford pages with the proving line highlighted. Run from this folder: python3 shots.py
import glob,sys
from playwright.sync_api import sync_playwright
exe=sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux*/chrome'))[0]
jobs=[('imf','https://www.imf.org/external/pubs/ft/fandd/2015/03/bessen.htm','Bank branches in urban areas increased 43 percent'),
('npr','https://www.npr.org/transcripts/389027988','400,000 bookkeeping'),
('stanford','https://digitaleconomy.stanford.edu/event/seyed-m-hosseini-and-guy-lichtinger-generative-ai-as-seniority-biased-technological-change-evidence-from-u-s-resume-and-job-posting-data/','junior employment in adopting firms declined sharply')]
JS='''(p)=>{const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const i=n.textContent.indexOf(p);if(i>=0){const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+p.length);const m=document.createElement('mark');m.style.background='#FFD84D';m.style.color='#0C1512';r.surroundContents(m);m.scrollIntoView({block:'center'});return true}}return false}'''
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe,args=['--no-sandbox']);pg=b.new_page(viewport={'width':1400,'height':900},user_agent='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36')
    for name,url,phrase in jobs:
        try:
            pg.goto(url,timeout=45000,wait_until='domcontentloaded');pg.wait_for_timeout(2500)
            for sel in ['button:has-text("Accept")','button:has-text("I Accept")','button:has-text("Agree")','#onetrust-accept-btn-handler']:
                try: pg.click(sel,timeout=800)
                except Exception: pass
            ok=pg.evaluate(JS,phrase);pg.wait_for_timeout(600)
            pg.screenshot(path=name+'.jpg',quality=85);print(name,'highlighted' if ok else 'PHRASE NOT FOUND',pg.title()[:70])
        except Exception as e: print(name,'FAILED',str(e)[:150])
    b.close()
