"""Reproducible local preparation of Friday/Monday delivery cards. No posting.

Reads downloaded board snapshots in .cache/publish-ready-2026-10-19.
Renders the approved wide artwork at 1.5 device scale for Spotify's 1920x1080.
"""
import hashlib
import html
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[3]
PLAN = Path(__file__).parent
CACHE = ROOT / '.cache/publish-ready-2026-10-19'
WORK = ROOT / '.cache/produce/2026-10-19-5b5bfadc'
LIBRARY = Path('H:/My Drive/Ventures/Active Ventures/makeyourmindup/3 Posts')
FRIDAY = LIBRARY / '2026-10-16 Fri mind.the.gap - Why so many AIs/3 Video'
MONDAY = LIBRARY / '2026-10-19 Mon follow.the.money - Why AI prices keep changing/3 Video'
sys.path[:0] = [str(ROOT / 'scripts/pages'), str(ROOT / 'scripts/post-pack'), str(ROOT / '.cache/python-deps')]
import build as pages
import brand
import card


def save(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf8')


def render_thumb(facts, output):
    if output.exists():
        return
    data = json.loads(facts.read_text(encoding='utf8'))
    page = pages.thumb_html(data, facts.parent, 'wide')
    with brand.playwright() as runtime:
        browser = brand.browser(runtime)
        tab = browser.new_page(viewport={'width':1280, 'height':720}, device_scale_factor=1.5)
        tab.set_content(page)
        card.settle(tab)
        fit = pages.fit_thumb(tab, 'wide')
        if not fit['ok']:
            raise ValueError('Approved thumbnail no longer fits')
        tab.screenshot(path=str(output), type='jpeg', quality=92)
        browser.close()


def main():
    CACHE.mkdir(exist_ok=True)
    fri_id = '904658db-4df2-4537-a0ed-ebe93e081db7'
    mon_id = '5b5bfadc-a60c-4d0a-be8e-b2e9bf43d092'
    render_thumb(ROOT / 'docs/plans/2026-10-09-friday/cover-facts-tall.json', CACHE / 'friday-spotify-approved-1920x1080.jpg')
    render_thumb(ROOT / 'docs/plans/2026-10-19-monday/cover-facts.json', CACHE / 'monday-spotify-1920x1080.jpg')
    chapters = {
        'friday': '00:00 Do new Claude and ChatGPT matter?\n01:46 Why AI launches keep speeding up\n02:31 Can Opus 5 beat Opus 5.5?\n05:30 Who pays when ChatGPT thinks?\n06:19 Who decides how hard AI thinks?\n08:25 What will ChatGPT hide from you?\n10:11 What should ChatGPT let you choose?\n12:00 Will ChatGPT decide for you again?',
        'monday': '00:00 Why AI prices keep changing\n01:17 Three AI firms keep changing prices\n02:12 Why a cheap AI tool is costly to leave\n02:45 AI discounts can change too\n03:56 Three rules for your AI budget\n04:55 My AI price prediction for 2026',
    }
    for day, text in chapters.items():
        times = []
        for line in text.splitlines():
            time, title = line.split(' ',1)
            m,s = map(int,time.split(':'))
            assert len(title) < 40, title
            times.append(m*60+s)
        assert len(times) >= 3 and times[0] == 0 and all(b-a >= 30 for a,b in zip(times,times[1:]))
        (CACHE / f'{day}-spotify-chapters.txt').write_text(text+'\n',encoding='utf8')
    mappings = {'friday':[], 'monday':[]}
    def asset(day, name, path, label):
        aid = f'{day}-{name}'
        url = f'https://content.krishraja.com/prepared/{aid}'
        mappings[day].append({'id':aid,'source_url':url,'path':str(path)})
        return {'label':label,'url':url}
    def cp(label,text): return {'label':label,'text':text}
    fri_long = asset('friday','long-repaired',FRIDAY/'Why so many AIs - deep 16x9 - repaired 19 Oct.mp4','Download episode (13:36)')
    fri_short = asset('friday','short-repaired',FRIDAY/'Why so many AIs - short 9x16 - repaired 19 Oct.mp4','Download clip (1:28)')
    fri_thumb = asset('friday','spotify-thumbnail',CACHE/'friday-spotify-approved-1920x1080.jpg','Download Spotify thumbnail (1920x1080)')
    fri_ch = asset('friday','spotify-chapters',CACHE/'friday-spotify-chapters.txt','Download repaired-cut chapters')
    fri_words = json.loads((ROOT/'docs/plans/2026-10-09-friday/publish-copy-v2.json').read_text(encoding='utf8'))
    # Existing approved wording, with the publication URL placeholder omitted until it exists.
    fri_desc = fri_words['spotify_description'].replace('\n{ARTICLE_URL}','')
    friday = {'piece_id':fri_id,'status':'ready','note':'Friday\'s repaired videos are the current files. Article checks pass with your existing sign-offs and approved forecast-date exception. Channel wording, images and publishing checklist remain below. Your Make Your Mind Up show is created and your Epidemic Sound subscription is active, confirmed on 19 October.',
      'copy_updates': {'fri-c13': chapters['friday']},
      'sections':[{'id':'spotify','title':'Spotify: finished episode and clip','note':'Use these repaired files and chapter times. The title and description retain your approved wording. The new thumbnail also works for YouTube and replaces the older Another Claude image. Upload directly in Spotify for Creators. These assets have not been posted.',
        'files':[fri_long,fri_short,fri_thumb,fri_ch],
        'copy':[cp('Episode title',fri_words['youtube_title']),cp('Description',fri_desc),cp('Chapters',chapters['friday'])]}]}
    mon_long = asset('monday','long-review',WORK/'long/why-ai-prices-keep-changing-long-16x9.mp4','Download long video (5:51)')
    mon_short = asset('monday','short-review',WORK/'short/why-ai-prices-keep-changing-short-9x16.mp4','Download short video (1:26)')
    mon_wide = asset('monday','wide-thumbnail',WORK/'thumbs/thumb-wide-1280x720.jpg','Download YouTube thumbnail')
    mon_tall = asset('monday','tall-thumbnail',WORK/'thumbs/thumb-tall-1080x1920.jpg','Download vertical thumbnail')
    mon_sp = asset('monday','spotify-thumbnail',CACHE/'monday-spotify-1920x1080.jpg','Download Spotify thumbnail (1920x1080)')
    mon_ch = asset('monday','spotify-chapters',CACHE/'monday-spotify-chapters.txt','Download chapters')
    title = 'Why Google, OpenAI and Anthropic keep changing AI prices'
    short = 'Google, OpenAI and Anthropic: three rules for your AI budget'
    description = 'Google, OpenAI and Anthropic keep changing their AI prices. How do you budget when the offer you sign up for can end?\n\nThree rules for your next AI budget: budget at the full price, agree a price and an end date, and keep the freedom to switch.\n\nWatch the explanation, then ask whoever owns your AI budget what each completed task costs.\n\nMore at makeyourmindup.ai'
    caption = 'Google, OpenAI and Anthropic keep changing AI prices. Three rules for your next budget: budget at the full price, agree a price and an end date, and keep the freedom to switch.\n\nThe full explanation is at makeyourmindup.ai.'
    monday = {'piece_id':mon_id,'status':'review','note':'Finished video files and approved titles are here for review. Hold all Monday publication: one article fact-check entry is unresolved. Your three caption corrections are approved and the corrected subtitle file is available below. No further paid fact check is authorised. The article uses your updated prediction: 95% by 31 December 2026. The original outline and script boxes below retain their earlier wording for provenance; use the finished takes as the recording reference. These files do not mark the piece publish-ready.',
      'sections':[
        {'id':'video','title':'Monday: finished video files','note':'The long cut is for Substack, YouTube and Spotify. The short is for Shorts, Reels, TikTok, LinkedIn and the Spotify clip. Use these finished cuts, not the original recordings in the Inbox.','files':[mon_long,mon_short,mon_wide,mon_tall]},
        {'id':'youtube','title':'YouTube and Substack video','note':'Video title approved as set A. Description prepared from the signed-off treatment and recorded script; publication remains on hold.','copy':[cp('Video title',title),cp('Description',description)]},
        {'id':'shorts','title':'Shorts, Reels, TikTok and LinkedIn','note':'Short title approved as set A. Caption prepared from the recorded message; publication remains on hold.','copy':[cp('Short title',short),cp('Caption',caption)]},
        {'id':'spotify','title':'Spotify: episode, thumbnail and chapters','note':'Use the long video as the episode and the short as its clip. Add the chapters to the description. Leave episode art empty to use the show art. Your Make Your Mind Up show and active Epidemic Sound subscription are confirmed. Hold upload until Monday\'s review is cleared.','files':[mon_sp,mon_ch],'copy':[cp('Episode title',title),cp('Description',description),cp('Chapters',chapters['monday'])]}
      ]}
    corrected = ROOT / '.cache/monday-final-captions/files'
    monday['sections'][0]['files'] += [asset('monday','approved-captions',corrected/'Why AI prices keep changing - long - approved captions.srt','Download approved long-video captions (SRT)'), asset('monday','approved-transcript',corrected/'Why AI prices keep changing - long - approved transcript.txt','Download approved long-video transcript')]
    archive = LIBRARY.parent / 'Video Engine/Archive/2026-10-19 Why AI prices keep changing (post to YouTube, Substack, Shorts, Reels, TikTok, LinkedIn)'
    clips = [asset('monday', f'caption-{n}', archive/f'caption-check-{n}.wav', label) for n,label in [
        (82,'Listen: four batch / twenty batch'), (157,'Listen: bill / build and correction'),
        (331,'Listen: where you work / way work')]]
    monday['sections'].append({'id':'caption-review','title':'Caption corrections confirmed',
        'note':'Krish confirmed all three passages on 19 October: $4 a batch to read tokens, and $20 a batch to write tokens; two ways to bring the bill down; where you work. The source excerpts are retained for reference. The approved SRT and transcript are in the video files above.', 'files':clips})
    for day,data in [('friday',friday),('monday',monday)]:
        save(PLAN/f'{day}-materials.json',data)
        save(CACHE/f'{day}-new-assets.json',mappings[day])
    # Preserve the existing review IDs, labels and wording; don't overwrite recorded scripts.
    before = (CACHE/'2026-10-19-before.html').read_text(encoding='utf8')
    reviews = []
    for raw in re.findall(r'<section class="rv-item".*?</section>',before,re.S):
        label = html.unescape(re.search(r'<h3>(.*?)</h3>',raw,re.S)[1])
        rid, text = re.search(r'<textarea[^>]*data-review-id="([^"]+)"[^>]*>(.*?)</textarea>',raw,re.S).groups()
        path = CACHE/f'{rid}.md'
        path.write_text(html.unescape(text),encoding='utf8')
        reviews.append(f'mon={label}|{path}')
    save(CACHE/'monday-review-args.json',reviews)
    receipt=[]
    for day,items in mappings.items():
        for item in items:
            p=Path(item['path']); receipt.append({'id':item['id'],'bytes':p.stat().st_size,'sha256':hashlib.file_digest(p.open('rb'),'sha256').hexdigest()})
    save(PLAN/'source-assets.json',receipt)
    print(json.dumps({'materials':['friday','monday'],'assets':len(receipt),'review_boxes':len(reviews)}))


if __name__ == '__main__':
    main()

