"""Prepare native publish-manager inputs; readiness is checked again at activation."""
import json
import re
import sys
from pathlib import Path

PLAN=Path(__file__).resolve().parent;ROOT=PLAN.parents[2]
sys.path.insert(0,str(ROOT/'scripts/post-pack'))
import board_web as web
import publish_manager


def main():
    w=Path(sys.argv[1]).resolve();out=w/'publish';out.mkdir(exist_ok=True)
    piece='d7a20885-7001-4661-b444-9d7ca1043416'
    title=json.loads((PLAN/'post.json').read_text(encoding='utf-8'))['headline']
    copy=dict((label.strip(),text.strip())for label,text in re.findall(
        r'^## ([^\n]+)\n(.*?)(?=^## |\Z)',(PLAN/'publishing-copy.md').read_text(encoding='utf-8'),re.M|re.S))
    files={'long_video':'3 Video/Muse vs Grok Bot - wide 16x9 - YouTube, Substack.mp4',
        'short_video':'3 Video/Muse vs Grok Bot - tall 9x16 - Shorts, Reels, TikTok, LinkedIn.mp4',
        'wide_thumbnail':'3 Video/Muse vs Grok Bot - wide 16x9 - thumbnail.jpg',
        'vertical_cover':'2 Covers and images/vertical-cover-1080x1920-shorts-tiktok-reels.png',
        'square':'2 Covers and images/square-1080x1080.png','share_card':'2 Covers and images/share-card-1200x675.png',
        'cover':'2 Covers and images/substack-cover-1200x630.png','substack_copy':'1 Article/substack-copy.html'}
    roles={'long_video':'wed-video-long','short_video':'wed-video-short','wide_thumbnail':'wed-thumb-wide',
        'vertical_cover':'wed-cover-1080x1920','square':'wed-cover-1080x1080','share_card':'wed-cover-1200x675',
        'cover':'wed-cover-1200x630','substack_copy':'wed-article-copy'}
    state=web.call('GET','/api/board/2026-10-19');facts=web.call('GET',f'/api/content-ideas/{piece}/fact-check')
    links={files[role]:f'https://content.krishraja.com/api/board/2026-10-19/assets/{aid}?sha={state["manifest"]["assets"][aid]["sha256"]}'for role,aid in roles.items()}
    words={'title':title,'subtitle':copy['Article subtitle'],'date':'2026-10-21','long_name':'5-minute video',
        'youtube_title':title,'youtube_description':copy['YouTube description'],'short_title':title,
        'short_caption':copy['Short video caption'],'tiktok_caption':copy['Instagram and TikTok'],
        'linkedin_post':copy['LinkedIn'],'spotify_title':title,'spotify_description':copy['Spotify description'],
        'spotify_chapters':(PLAN/'chapters.txt').read_text(encoding='utf-8'),'files':files,'links':links}
    (out/'publish-words.json').write_text(json.dumps(words,indent=2,ensure_ascii=False),encoding='utf-8')
    article=(ROOT/'docs/plans/2026-10-19-week/wednesday-article-draft.md').read_text(encoding='utf-8')
    assert article.startswith('# ')
    (out/'body.md').write_text(article.partition('\n')[2].lstrip(),encoding='utf-8')
    images=[{'id':role,'role':role,'file':str(w/'article'/name),'alt':'Muse vs Grok Bot: five real-life tests'}for role,name in
        [('cover','cover-1200x630.png'),('vertical-cover','cover-1080x1920.png'),('square-cover','cover-1080x1080.png'),('share-card-cover','cover-1200x675.png')]]
    figures=json.loads((PLAN/'page-facts.json').read_text(encoding='utf-8'))['figures']
    for f,heading in zip(figures,['The inbox','The flight','The news','The work email','The verdict']):
        images.append({'id':Path(f['image']).stem,'file':str(w/f['image']),'alt':f['alt'],'caption':f['caption'],'after_heading':heading})
    passed=[]
    for cut,shape in [('long','16x9'),('short','9x16')]:
        receipt=json.loads((w/f'render-{cut}-stable/muse-vs-grok-{cut}-{shape}.mp4.validation.json').read_text(encoding='utf-8'))
        passed.append(all(x.get('status')=='pass'for x in receipt['checks'].values()))
    status=['Article source adjudications complete; original checker verdicts retained.']
    status.append('Article publication checks clear.'if facts.get('ready')else'Article publication checks remain held.')
    status.append('Both stabilised cuts accepted after full playback.'if all(passed)else'Final video playback acceptance remains open.')
    manager={'title':title,'subtitle':copy['Article subtitle'],'date':'2026-10-21','kicker':'under.the.hood',
        'body':'body.md','words':'publish-words.json','images':images,'status':status,
        'scripts':[{'label':cut.capitalize()+' recorded script','file':str(PLAN/f'recorded-{cut}-script.md')}for cut in ['long','short']]}
    source=out/'manager.json';source.write_text(json.dumps(manager,indent=2,ensure_ascii=False),encoding='utf-8')
    page=publish_manager.build(source,out)
    print(json.dumps({'page':str(page),'article_ready':bool(facts.get('ready')),'playback_accepted':all(passed)}),flush=True)


if __name__=='__main__':main()
