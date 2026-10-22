"""Prepare named evidence-backed decisions; never record approval or spend."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

PLAN=Path(__file__).resolve().parent;ROOT=PLAN.parents[2]
sys.path.insert(0,str(ROOT/'scripts/post-pack'))
import board_web as web
BASE='/api/content-ideas/d7a20885-7001-4661-b444-9d7ca1043416'
OWN='7719e136-a522-468d-a808-4276296af331';SCORE='f843e77c-721d-4f21-8bdb-3914db3cc313'
AI='224dbc91-dfd8-4aa6-8602-7e7f44cd1665';CHRIS='f22566f2-889f-4198-bf42-d58835375836';ANALYTICS='7c939812-3696-4b15-995d-9e5cb096244e'

def main():
    ap=argparse.ArgumentParser();ap.add_argument('work',type=Path);a=ap.parse_args();w=a.work
    materials=web.call('GET',BASE+'/materials')['materials']
    title='AI for Mortals original: Muse Montreal Expedia workaround'
    text='Worked around the block by booking the flights through Expedia, for $801 total.'
    extra=next((m for m in materials if m['title']==title and m.get('content')==text),None)
    if extra is None:
        extra=web.call('POST',BASE+'/materials',{'kind':'paste','title':title,'content':text,'verbatim':True,
            'url':'https://www.aiformortals.co/blog/grok-bot-vs-meta-muse-vs-chatgpt-dots'})['material']
    materials=web.call('GET',BASE+'/materials')['materials'];lookup={m['id']:m for m in materials}
    current=web.call('GET',BASE+'/fact-check');fc=current['fact_check']
    bad=[c for c in fc['claims']if c['verdict']in ['unverified','contradicted']]
    assert len(bad)==27 and fc['ran_at']=='2026-10-22T12:37:23.458Z','Review the changed gate before preparing decisions'
    definitions=[
        (OWN,'The buyer-scam messages asked','The record describes multiple buyer-scam messages; the earlier readback counts about seven skipped and four similar questions. “Several” is bounded by those observations.'),
        (OWN,"Muse read the shop's published",'Returns and damaged-item refunds support the refund-policy description. “Polished” is the author’s judgment about the draft.'),
        (OWN,'Muse then put that reply','The on-file checker mixed a fabricated first quote with a correct second quote. This exact record states the day-plan priority.'),
        (AI,'None of the three fell','If none of three agents fell for the traps, neither Muse nor Grok did. Including Dots does not contradict that subset.'),
        (AI,'Overall: Grok Bot','The D is Muse’s company-task grade. “Its” refers to Muse in this paragraph, rather than a single shared grade for all tools.'),
        (OWN,"Grok's captured output described",'The filed historical trial output states £335. The web checker substituted a current London–Tokyo fare of £555 for the London–New York trial.'),
        (OWN,"Grok's captured output described",'An outbound 29-hour Lisbon stop is the catch in the return itinerary; the article does not say both directions had that stop.'),
        (OWN,'Muse recommended a different nonstop option','The suggested option was nonstop, which is also direct. The record specifies the baggage details it could not confirm.'),
        (OWN,"Muse's quoted times were",'This reports Muse’s erroneous four-night statement, immediately corrected to three hotel nights. The checker confused reporting the error with asserting four nights were real.'),
        (extra['id'],'Worked around the block','The original Montreal page explicitly says Muse worked around the block through Expedia. That short passage was absent from the earlier primary excerpt and is now filed.'),
        (AI,'Grok Bot was the fastest','This sentence belongs to the Montreal research paragraph. The checker instead applied the author’s separate New York fares.'),
        (OWN,'Both assistants found a real recurring charge','The exact filed record confirms both findings. The checker rejected its own slightly altered quote rather than this existing sentence.'),
        (OWN,'The corpus review found no like-for-like','“The collection” here is the supplied research, separate from the author’s personal trial. The checker incorrectly used his personal trial to contradict the research gap.'),
        (CHRIS,'Three times a day','Alarcon describes a recurring news scraper that had already cleaned up his lists. “Earned a place in his routine” is the author’s summary of that use, not a new frequency claim.'),
        (ANALYTICS,'A mini marketing team','A small team watching analytics and reading actual channel data supports this paraphrase; it does not assert a separate product or team.'),
        (OWN,'The source-thread and recipient readback','“Kept the right people copied in” describes preservation of the source-thread recipients. It does not invent a new recipient or sent message.'),
        (OWN,'On the other email','Asking for monthly hours and fee includes asking for the fee. The shorter article sentence does not claim Grok asked for nothing else.'),
        (OWN,'Muse surfaced unanswered Messenger','Unanswered chats are the basis for “left hanging”, the author’s wording. Completeness remains unverified and outside scoring.'),
        (OWN,'Consumer Gemini asserted','The record states Gemini asserted a cabin bag on a proposed nonstop flight. “Promised” reports its certainty, rather than independently confirming baggage.'),
        (OWN,"Grok Bot and Meta's Muse were compared",'The record identifies both tested assistants. “Head to head” and “done-for-you” describe the comparison and product category, rather than an added experiment.'),
        (OWN,'There were five initial everyday jobs','The five recorded initial jobs support five tests. Follow-ups are explicitly recorded and not counted as separate trials.'),
        (SCORE,'Muse wrote a polished reply','The source record establishes the scam draft; “lovely” is the author’s description of its manner. It is not a separate reliability claim.'),
        (SCORE,'Five rounds. Each gets two scores','The owned method explicitly records one personal-test score and one supplied-research score per round. Comparable reports are first-hand tests of the same tools; missing results remain missing.'),
        (OWN,'The captured request to Muse','The recorded task was to find emails needing replies. Muse’s request is directly quoted; Grok’s captured response describes carrying out that same task.'),
        (OWN,'The corpus review found no like-for-like','This is the author’s review of the supplied corpus, not an exhaustive claim about every test on the internet.'),
        ('380fdc49-e6b4-458d-98ff-68869c45b383','', 'The immediately preceding wiper example is an individual’s Reddit account, while the recipe example is Meta’s own announcement. The sentence labels those source types.'),
        (OWN,'The retained 14 October article draft','The retained earlier piece concerns these assistants, data access and pricing. 14 October is one week before the planned 21 October article; no public publication is invented.')]
    rows=[];doc=['# Final fact-check adjudication, 22 October','',
        'One approved final run cost **$0.59**, below the $1 cap. It checked 57 claims: 30 passed, 23 remain unverified and four are labelled contradicted. The raw result is preserved. No additional paid run is authorised.', '',
        f'Article raw SHA-256: `{hashlib.sha256((ROOT/"docs/plans/2026-10-19-week/wednesday-article-draft.md").read_text(encoding="utf-8").encode()).hexdigest()}`.',
        f'Checker run: `{fc["ran_at"]}`. This is a proposed human adjudication of these exact sentences, not a claimed model pass.','',
        'The record distinguishes private observations, attributed public tests and author judgment. The four disputed contradictions require explicit human review under the native gate; the remaining 23 require named-line sign-off. No wording has changed after the run.','']
    for number,(claim,(mid,needle,reason)) in enumerate(zip(bad,definitions),1):
        material=lookup[mid];content=material['content']
        quote=next((p for p in content.split('\n\n')if needle in p),None)if needle else content
        assert quote and quote in content,(number,needle)
        row={'number':number,'sentence':claim['sentence'],'verdict':claim['verdict'],'material_id':mid,
             'quote':quote,'reason':reason,'source_url':material['url']}
        rows.append(row)
        doc += [f'## {number}. {claim["verdict"]}', '',claim['sentence'],'',reason,'',
            f'Filed evidence: [{material["title"]}]({material["url"]}).', '', '> '+quote.replace('\n','\n> '),'']
    doc += ['## Decision requested','',
        'Approve these 27 named sentences against the evidence above, including the four disputed contradictions, or identify any row to change. Approval will be recorded in Krish’s exact words through the existing named-line sign-off and manual-review routes. It will not edit the automated verdicts or permit another paid run.']
    document='\n'.join(doc)+'\n';(PLAN/'final-fact-adjudication.md').write_text(document,encoding='utf-8')
    record={'article_body_hash':fc['body_hash'],'run_at':fc['ran_at'],'sources_hash':current['sources_hash'],
        'document_sha256':hashlib.sha256(document.encode()).hexdigest(),'rows':rows,'approved':False}
    (w/'fact-adjudication-prepared.json').write_text(json.dumps(record,indent=2,ensure_ascii=False),encoding='utf-8')
    print(json.dumps({'rows':len(rows),'document_sha256':record['document_sha256'],'source_records':len(materials)}),flush=True)

if __name__=='__main__':main()
