"""Saturday 12 Dec 2026's good-news carousels for the week of 7 Dec. Each story's facts, source, date, picture and who it
helps come straight from ../research/goodnews.json and goodnews2.json (each primary source opened by the research
readers on 27 Nov 2026); only the headline is shortened here. Pattern small-win (lookalike.json): cover, four stories,
close."""
import json
from pathlib import Path

R = Path(__file__).resolve().parent.parent / 'research'
_C = {}
_FIX = {}
for f in ('goodnews.json', 'goodnews2.json', 'goodnews3.json'):
    d = json.loads((R / f).read_text())
    for c in d['candidates']:
        _C[c['key']] = c
    _FIX.update(d.get('media_fixes') or {})
_FIX['nine-mcp-journalism-pilot'] = 'https://www.nineforbrands.com.au/wp-content/uploads/2026/11/NINE_HERO-IMG.jpg'  # the release page's own og:image, read 27 Nov 2026
KIND = {'pjace-ai-fantasy-28775': 'creators', 'tupacabra-nuremberg-trailer': 'creators'}
LF = ["\"I want actual news items and the content we are going to use here - embedded real world images or videos\" (your Improve, 2 Nov, of the good news)",
      "\"Real-world stories only, but with a hilarious generated cover page\" (your Improve, 9 Nov, of the good news)"]
FLOW = 'small-win'


def story(key, headline):
    c = _C[key]
    p = c['primary']
    media = c.get('media') or {}
    url = _FIX.get(key) or media.get('url')
    st = {'headline': headline, 'what': c['what_happened'], 'why': c.get('why_it_matters') or c['headline'],
          'kind': KIND.get(key, c['sector']), 'helps': c['helps'], 'date': c['date'],
          'source': {'label': p['label'], 'url': p['url']},
          'media': {'kind': media.get('kind') or 'photo', 'url': url}}
    found = c.get('found') or {}
    if found.get('place') == 'sheet':
        st['found'] = {'label': 'Your Instagram inspo sheet', 'url': found.get('url') or p['url']}
    return st


def option(id, topic, hook, see, share, funny, keys, beats, cover_pic, close_words, close_pic, weekly=False, short_by=0, aim='interest'):
    stories = [story(k, h) for k, h in keys]
    cards = [{'words': hook, 'picture': cover_pic}]
    cards += [{'words': s['headline'], 'picture': f"{s['source']['label'].split(',')[0]}: the thing itself ({s['media']['kind']})"} for s in stories]
    while len(cards) < 5:
        cards.append({'words': 'One more story to find this week.', 'picture': 'An empty frame, to be filled with the fourth story'})
    cards.append({'words': close_words, 'picture': close_pic})
    o = {'id': id, 'kind': 'good_news', 'format': 'Good-news carousel, 6 cards, 4:5', 'source_tag': 'trade_press',
         'topic': topic, 'source': {'label': 'Each story\'s own source', 'url': stories[0]['source']['url']},
         'copy': f"{hook} {['', 'One', 'Two', 'Three', 'Four'][len(stories)]} real things AI did for {topic} this month, each with who it helped and how" + (f", and {4 - len(stories)} more to find." if len(stories) < 4 else "."),
         'hook': hook, 'pitch': {'see': see, 'lands': 'It is uplifting, real and in the reader\'s world, and each story names who it helped.',
                                 'why_now': 'Stories dated 20 to 27 November 2026, or found in your Instagram inspo sheet within 30 days.', 'share': share},
         'shape': 'theme', 'aim': aim, 'funny': funny,
         'lookalike': {'pattern': FLOW, 'beats': beats, 'our_take': "The post told one person's small win; ours puts four wins in the reader's own industry side by side, each with who it helped."},
         'learned_from': LF, 'stories': stories, 'stories_due': '2026-11-27', 'cards': cards,
         'direction': {'look': 'The v5 good-news set, modelled on the small-win carousels in your Instagram inspo sheet', 'format': '6 cards, 4:5',
                       'frames': [dict(c) for c in cards], 'tone': 'Warm and real, with one dry line on the cover.',
                       'kit': 'v5 Library good-news set: each story\'s own photo or clip, house type and palette', 'inspo_url': beats}}
    if short_by:
        o['stories_to_find'] = True
        o['stories_short'] = f'Only {4 - short_by} stories on this topic passed their source and repeat checks this week; the other {short_by} are still to find (the board\'s Find the other stories press).'
    if weekly:
        o['weekly'] = 'good_news'
    return o


def candidates():
    out = []
    for f in ('goodnews.json', 'goodnews2.json'):
        d = json.loads((R / f).read_text())
        for c in d['candidates']:
            out.append({'title': c['headline'], 'url': c['primary']['url'], 'place': (c.get('found') or {}).get('place') or 'news', 'date': c['date']})
        for x in d.get('looked_at') or []:
            if x.get('url') and x.get('date'):
                out.append({'title': x.get('title') or '', 'url': x['url'], 'place': x.get('place') or 'news', 'date': x['date']})
    return out


SAT = [
    option('goodnews', 'music', "AI put songwriters and bands in front of millions.",
           "A Korean chart with an AI-assisted ballad at number one, a new boy group's debut, and a guitarist in a studio.",
           "Four music wins from AI this month, each with who it helped.",
           "The number one ballad was written by two humans and sung by software, which is the most K-pop sentence of the year.",
           [('meomuru-melon-number-one', 'Two songwriters used AI to reach number one in Korea.'),
            ('h3arus-kpop-debut-week', 'An AI-made K-pop group released its debut single.'),
            ('cyanite-concierge', 'Music teams can now find a track by asking for it.'),
            ('george-lynch-ai-session', 'A label still hired George Lynch to play on an AI track.')],
           'https://www.instagram.com/power.ai/p/Dfjbe68ldg-/', 'A chart screen with a ballad at number one',
           'Each one still needed a person who knew what good sounds like.', 'A guitarist\'s hands on the strings', weekly=True),
    option('screen', 'film and TV', "AI helped film and TV makers try something new.",
           "A mythology epic with an AI lead actor, seven Korean directors' AI shorts, and an Oscar winner's case study.",
           "Four film and TV wins from AI this month.",
           "The lead actor's surname has the letters AI in it, in case anyone missed the point.",
           [('eklavya-ai-led-series', 'Lionsgate Play started an AI-led mythology series.'),
            ('seoul-indie-fest-ai-cinema', 'Seven Korean directors made AI short films for a festival.'),
            ('hazanavicius-third-hand', 'An Oscar winner is showing how he used AI on his film.')],
           'https://www.instagram.com/power.ai/p/DfcCbPXlWQ-/', 'A cinema screen lighting up a dark room',
           'Every one of them kept a director in the chair.', 'An empty director\'s chair on a set', short_by=1),
    option('makers', 'creators', "This month AI turned solo creators into studios.",
           "A desi Batman riding a buffalo, a fantasy film made for $28,775, and an alternate-history trailer that looks like a blockbuster.",
           "Four creators who made something huge with AI this month.",
           "Batman's newest villain is the queue at a village tea stall.",
           [('desi-batman-25m-views', 'An AI creator\'s Desi Batman reached 25 million views.'),
            ('pjace-ai-fantasy-28775', 'A fantasy comedy film was made for $28,775.'),
            ('tupacabra-nuremberg-trailer', 'A creator\'s AI trailer looks like a blockbuster.'),
            ('garyvee-avatar-channel', 'Gary Vee\'s AI avatar answers a fan a day.')],
           'https://www.instagram.com/evolving.ai/p/DfeWM7jADvK/', 'A phone screen full of view counts',
           'One person, one idea, a studio\'s worth of pictures.', 'A creator at a desk at night', aim='humour'),
    option('newsrooms', 'media', "This month AI helped newsrooms keep readers and save time.",
           "Norway's biggest paper checking AI headlines, Der Spiegel spotting who will cancel, and Australian papers plugged into AI tools.",
           "Four newsroom wins from AI this month.",
           "The newspaper's newest subscriber is a corporate chatbot, and it still has to log in.",
           [('vg-ai-200-stories', 'Norway\'s biggest paper uses AI on 200 stories a day.'),
            ('spiegel-churn-score', 'Der Spiegel\'s model finds a third of readers about to leave.'),
            ('nine-mcp-journalism-pilot', 'Nine plugged its newspapers into business AI tools.'),
            ('canva-mcp-500k', 'Nearly 500,000 people joined Canva through AI assistants.')],
           'https://www.instagram.com/power.ai/p/Dfa2apfFSE5/', 'A newspaper front page beside a laptop',
           'Each one kept an editor checking the machine.', 'An editor\'s red pen on a printout'),
    option('talent', 'scouts, race teams and cinemas', "AI helped footballers, a race team and cinemas get noticed.",
           "A teenager's video reaching a European club, a NASCAR car answering guests, and a cinema assistant answering the easy questions.",
           "Footballers, a race car and a cinema chain AI helped this month.",
           "The driver cannot talk while racing, so the car now does the talking for him.",
           [('footbao-26-signed-europe', 'An AI scouting app got 26 overlooked footballers signed.'),
            ('trackhouse-88bot-talking-car', 'A NASCAR team gave its race car an AI voice for guests.'),
            ('odeon-odi-40-percent', 'Odeon\'s cinema assistant answers 40% of questions, no jobs lost.')],
           'https://www.instagram.com/evolving.ai/p/DfXlI-1AEUh/', 'A young footballer filming on a local pitch',
           'Each one got seen by someone who could pay them.', 'A scout\'s notebook beside a phone', short_by=1),
]
SAT[0]['candidates'] = candidates()
