"""Prepare Monday's delivery pack from approved copy and existing assets; no sends."""
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];PLAN=Path(__file__).parent
OUT=ROOT/'.cache/monday-release-gates';WORK=ROOT/'.cache/produce/2026-10-19-5b5bfadc'
def save(p,d):p.write_text(json.dumps(d,indent=2)+'\n',encoding='utf8')
def rel(p):return str(p.resolve().relative_to(ROOT)).replace('\\','/')
def source(p):return '../../../'+rel(p)
def main():
 mat=json.loads((ROOT/'docs/plans/2026-10-19-board-delivery/monday-materials.json').read_text(encoding='utf8'));sec={s['id']:s for s in mat['sections']}
 def copies(key):return {x['label']:x['text'] for x in sec[key]['copy']}
 yt,short,spot=[copies(k) for k in ['youtube','shorts','spotify']]
 folder='3 Posts/2026-10-19 Mon follow.the.money - Why AI prices keep changing'
 wide='Why AI prices keep changing - wide 16x9 - YouTube, Substack.mp4';tall='Why AI prices keep changing - tall 9x16 - Shorts, Reels, TikTok, LinkedIn.mp4'
 words={'title':yt['Video title'],'subtitle':json.loads((PLAN/'page-facts.json').read_text(encoding='utf8'))['deck'],'date':'2026-10-19','long_name':'5-minute video (5:51)',
 'youtube_title':yt['Video title'],'youtube_description':yt['Description'],'short_title':short['Short title'],'short_caption':short['Caption'],'tiktok_caption':short['Caption'],'linkedin_post':short['Caption'],
 'spotify_title':spot['Episode title'],'spotify_description':spot['Description'],'spotify_chapters':spot['Chapters'],
 'files':{'long_video':'3 Video/'+wide,'short_video':'3 Video/'+tall,'wide_thumbnail':'3 Video/Why AI prices keep changing - wide 16x9 - thumbnail.jpg','vertical_cover':'2 Covers and images/vertical-cover-1080x1920-shorts-tiktok-reels.png','square':'2 Covers and images/square-1080x1080.png','share_card':'2 Covers and images/share-card-1200x675.png','cover':'2 Covers and images/substack-cover-1200x630.png','substack_copy':'1 Article/substack-copy.html','spotify_thumbnail':'3 Video/Spotify thumbnail 1920x1080.jpg'}}
 words['description'] = words['youtube_description']
 words['substack_title'] = words['title']
 words['substack_subtitle'] = words['subtitle']
 words['long_name'] = '5-minute video'
 downloads = PLAN/'release-downloads.json'
 if downloads.exists():
  words['links'] = {item['pack_path']: item['source_url'] for item in json.loads(downloads.read_text(encoding='utf8')) if item.get('pack_path')}
 save(PLAN/'publish-words.json',words)
 facts=json.loads((PLAN/'page-facts.json').read_text(encoding='utf8'));body=(PLAN/'publish-body.md').read_text(encoding='utf8')
 for phrase,sid in facts['links']:
  body=body.replace(phrase,'['+phrase+']('+facts['sources'][sid][1]+')',1)
 body+='\n\n## SOURCES\n\n'+'\n'.join('- ['+name+']('+url+')' for name,url in facts['sources'].values())+'\n'
 (PLAN/'publish-body-linked.md').write_text(body,encoding='utf8')
 images=[]
 for role,file in [('cover','cover-1200x630.png'),('vertical-cover','cover-1080x1920.png'),('square-cover','cover-1080x1080.png'),('share-card-cover','cover-1200x675.png')]:
  images.append({'id':role,'role':role,'file':source(OUT/'pages'/file),'alt':'What will AI cost next? Google, OpenAI and Anthropic, with Krish.'})
 for fig,heading in zip(facts['figures'],['WHAT CHANGES ON 1 DECEMBER',"IT ISN'T JUST GOOGLE","EVEN THE DISCOUNTS DON'T LAST"]):
  # Use headings as the unchanged body spells them.
  images.append({'id':Path(fig['image']).stem,'file':fig['image'],'alt':fig['alt'],'after_heading':heading})
 save(PLAN/'publish-manager.json',{'title':words['title'],'subtitle':words['subtitle'],'date':'2026-10-19','kicker':'follow.the.money','body':'publish-body-linked.md','words':'publish-words.json','images':images,'scripts':[{'label':'Approved long-cut transcript','file':'captions/long-approved.txt'},{'label':'Short-cut transcript','file':source(WORK/'short/why-ai-prices-keep-changing-short.cut.txt')}], 'status':['Publication readiness is confirmed by the live fact and making records.','Both current cuts accepted by Krish after full playback with sound.']})
 files=[{'kind':'fact-checked-text','file':'publish-body.md'}]
 for kind,name in [('substack-copy','substack.html'),('web-page','page.html'),('email-pictures-off','email-pictures-off.html'),('cover','cover.png'),('substack-cover','cover-1200x630.png'),('share-card-cover','cover-1200x675.png'),('square-cover','cover-1080x1080.png'),('vertical-cover','cover-1080x1920.png'),('phone-check','phone-images.png')]:
  files.append({'kind':kind,'file':source(OUT/'pages'/name),'logos':['Google','OpenAI','Anthropic']})
 for key in ['google','same','bill']:
  files.append({'kind':'image','file':source(OUT/f'article-cards/{key}.png'),'purpose':{'google':'Google public pricing before and after 1 December.','same':'The selected offers compared, including their time limits.','bill':'The article’s illustrative monthly bill, with reuse discounts.'}[key],'logos':['Google','OpenAI','Anthropic'] if key=='same' else [],'shows':'chart','data_source':'The dated provider sources and illustrative calculation in the checked article.','measures':'US dollars per million tokens' if key!='bill' else 'Illustrative total monthly US dollars for the same workload'})
 for cut,shape,ratio in [('long','wide','16x9'),('short','tall','9x16')]:
  files.append({'kind':'video','shape':shape,'file':source(WORK/cut/f'why-ai-prices-keep-changing-{cut}-{ratio}.mp4'),'logos':['Google','OpenAI','Anthropic']})
  thumb='thumb-wide-1280x720.jpg' if cut=='long' else 'thumb-tall-1080x1920.jpg'
  files.append({'kind':'thumbnail','shape':shape,'file':source(WORK/'thumbs'/thumb),'logos':['Google','OpenAI','Anthropic']})
 files += [{'kind':'captions','file':source(ROOT/'.cache/monday-final-captions/files/Why AI prices keep changing - long - approved captions.srt')},{'category':'video','file':'captions/long-approved.txt','name':'Approved long-cut transcript.txt','purpose':'The recorded long cut, with Krish’s three confirmed caption corrections.'},{'category':'video','file':source(WORK/'short/why-ai-prices-keep-changing-short.cut.txt'),'name':'Short-cut transcript.txt','purpose':'Transcript of the accepted short cut.'},{'category':'video','file':source(ROOT/'.cache/publish-ready-2026-10-19/monday-spotify-1920x1080.jpg'),'name':'Spotify thumbnail 1920x1080.jpg','purpose':'The 1920 x 1080 thumbnail for the Spotify video episode.'},{'kind':'video-words','file':'publish-words.json'},{'kind':'publish-manager','file':source(OUT/'manager/publish-manager.html')},{'kind':'publish-kit','file':source(OUT/'kit/publish.html')}]
 save(PLAN/'post-release.json',{'piece_id':'5b5bfadc-a60c-4d0a-be8e-b2e9bf43d092','date':'2026-10-19','subchannel':'follow.the.money','subject':'Why AI prices keep changing','headline':words['title'],'files':files})
 print('Prepared channel words, manager and complete post manifest.')
if __name__=='__main__':main()
