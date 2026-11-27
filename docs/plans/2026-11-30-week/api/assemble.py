"""Assembles docs/plans/2026-11-30-week/ideas.json from heroes.json and offdays.json (the Sunday ideas run, 26 Nov 2026)."""
import json
from pathlib import Path

W = Path('docs/plans/2026-11-30-week')
heroes = json.loads((W / 'api/heroes.json').read_text())
off = json.loads((W / 'api/offdays.json').read_text())
inp = json.loads((W / 'lookalike-input.json').read_text())
old = {}
if (W / 'ideas.json').exists():
    old = json.loads((W / 'ideas.json').read_text())

about = (
    'The Sunday ideas run for the week of 30 November 2026 (sunday-ideas.yml), steps 1 to 7 of plan-week, the whole board once, '
    'Saturday\'s good news included. Researched with web search and web fetch only: Drive and Firecrawl were not connected, so '
    'the Cold Ideas & Inspo folder was not read. ' + ' '.join(inp.get('warnings') or []) +
    ' Reddit could not be read for the meme templates (HTTP 403 from r/MemeTemplatesOfficial and r/memes). '
    'The newest 100 rows of the Instagram inspo sheet carry no carousel type or slide text (profile-grid backfill), so no Saturday '
    'option can name a post the sheet holds as a carousel this week.'
)

asks_words = {m['id']: m.get('his_words') for m in json.loads((W / 'sources.json').read_text())['must_cover']}

accounted = {
    '4077d778-8f73-410a-a142-26cd9e308d07': 'Already made: this card (what Claude Duet does) became Wednesday 4 November\'s piece on Duet\'s approval gate (b63d2507), and it has no line into the creative industries the beat now covers.',
    '385a5da8-2cae-41ec-8fb6-2e328920664c': 'Already used, and you said (24 Oct) it is "good general advice for other topics that are more interesting than this": the three-question test stays a rule we apply, never its own idea.',
    '13720d74-2177-42cb-a9f8-6d8d0e06bf5a': 'A style ask, used: the Hannah Fry breakdown is the hannah-fry check every script on this board will pass, and Friday\'s fry-explainer recommendations follow it.',
    '626b338c-c064-4743-bf1c-22981f54d3e1': 'Already made: everyone vibe coding without knowing it was Friday 27 November\'s piece (4f8f23b2), inside three weeks.',
    'ccbe548e-9c51-4e7d-819b-f629c7e2ddc9': 'Already made: which human qualities lead to job loss became Thursday 19 November\'s said-to-camera off day (701a2c55).',
    '772d09a7-2455-4f05-a6f2-d90d0e60314a': 'A style ask, used: each pitch here is written as a plain chain a 12-year-old can follow, the way her short simplifies a hard topic.',
    'c02e49b6-5c38-4fb0-a753-6ade6d6f4248': 'A brand ask with no subject: you saved it as the kind of company you want to become, in the form of a viral organic post. It shapes how the posts feel, so no single idea this week answers it; it stays open for the brand work.',
    '8ca0bd3d-454d-48fd-a2d1-98d0e5469779': 'A style ask, used: its art-directed captions are the caption style recommended for this week\'s voiceover shorts.',
    'dd93bfb1-20be-4c13-93b7-3c34ded7544b': 'Held, not dropped: software editing itself on the fly has no dated, sourced story inside the creative industries this fortnight; Ubisoft\'s Motherbrain is the nearest, and it is on Friday as a story about defaults, which does not claim your ask.',
    '7502d46a-3ec1-4fc1-964a-e91b9e284415': 'Already made: the dirty truth of how companies measure AI was Friday 13 November\'s piece, "Meta staff were ranked by AI use. They gamed it." (f3fcd5e1).',
    'cca6cea3-ee1d-4098-bc2f-d5d8444b18fc': 'Already shown: what you pay for ads in the chatbots was Tuesday 24 November\'s two options on the 23 Nov board (adwait, adprice) and Thursday 19 November\'s post, so it is not offered again under a new id.',
    '6eaaf127-ed4e-48bc-86a0-54c9e99aa428': 'Already made: build versus buy became Wednesday 18 November\'s piece (db9f9f6a).',
    '50368dee-0a10-4452-a79a-0607d4f2e278': 'Already made: Canva, Adobe or Claude became Wednesday 25 November\'s piece (bf0fddae).',
    'ca53cac9-d00d-49ed-8ea8-f17f61f602f4': 'Held, not dropped: the newest creative-industry case, AI uncovering lost detail in an 1888 painting, was already on the 23 Nov board\'s Saturday, and nothing newer and checked landed by 26 Nov.',
    'd16fe9ff-413c-47c4-ac53-c89e40d28489': 'Held: its caption is very close to the meme you approved for Friday 13 November, "POV: your AI agent using your computer without being set up properly by you" (povteach), so a second one this soon would read as a repeat.',
    'da3cacd1-b038-4827-bd22-1d4d9be07889': 'Already shown: it was Thursday 19 November\'s lookalike option on the 16 Nov board, so it is not offered again under a new id.',
    '93342d88-0320-4e56-a3c1-f25889d8add4': 'For Heartside, not this publication: you saved it for "heartside posts to buff out the volume", so it stays with the heartside cues.',
    '2162c904-b0ff-452b-81aa-b8cfd7ec1909': 'Already made: the reskin is Tuesday 10 November\'s short (mcpskin), approved with your Improve on 3 Nov.',
    'aae54ef9-0bd7-49a8-959e-96695e1a51a8': 'A style ask, used: every pitch here is held to one plain chain, the crazy simple explanation you asked for.',
    'e829fbfb-278d-45e2-9607-73af4c04310d': 'Already shown: its look was Thursday 19 November\'s lookalike option on the 16 Nov board; it guides how this week\'s voiceover shorts are drawn.',
    '7f43c6b5-a468-40f3-ad66-c988cdc16072': 'A style ask for a clean to-camera 1-2-3 shot: this week\'s to-camera recommendations are Monday\'s gym-music wildcard and Wednesday\'s TikTok test (fry-talking-head), and no off day is to camera.',
    '87a82f7f-6411-41c9-92b1-a52c4f3e4f8a': 'Answered for good: your positive ray of sunshine is the weekly Saturday good news, offered again this Saturday with four makers who reached millions.',
    'e73a0110-a108-456c-8781-350259b1b196': 'Already shown: its fast subtitles were part of Thursday 19 November\'s lookalike option; the designed captions of this week\'s voiceover shorts follow it.',
    '501c4fd1-4aa1-4cdd-b716-03e70c89c283': 'A style ask, used: the infographic style is the look of Tuesday\'s and Thursday\'s tool cards.',
    '2b582f5a-52fb-49a3-8502-0e9bd914f772': 'Already made: the translator meme for when your AI talks to your customer\'s AI was Tuesday 3 November\'s off day, approved with your words for the caption.',
    'f6327ce0-a414-4365-98df-635c1780523c': 'Already a piece: Wednesday 11 November\'s AI-in-music piece (36886e0b) uses this clip.',
    '90b654ca-204a-4aef-bffe-19cfa7a2db19': 'Already a piece: Wednesday 11 November\'s AI-in-music piece (36886e0b) uses this clip.',
    'd501ae8a-bce1-4964-89a0-63bf076bc641': 'A style ask, used: her lit talking head is the production recommended for Friday\'s AI awards wildcard, and her simple chain is the chain every pitch here passes.',
    'a397253e-bfe1-4a84-babc-27d93fd2779d': 'You dismissed the card; its boring-topic, irresistible-headline style is how this week\'s headlines are written.',
    '5b865aa9-463c-44c3-9352-73fda39fa18e': 'You dismissed the card; its chart-led style is how this week\'s explainer carousels are drawn.',
    'dde4b46f-fa8b-4ba4-b0e8-b82b5d5352d3': 'Already shown: what an MCP connector is was Tuesday 24 November\'s "What is MCP, actually?" option on the 23 Nov board, so it is not offered again under a new id. Thursday\'s video plug-in card uses your board-table picture without claiming the ask.',
    '45e0ead0-310b-4c74-9bd2-54305fb41539': 'A style-only card: its frame-by-frame explainer style is the motion recommended for Wednesday\'s Suno Bridge teardown.',
}

held_asks = {
    'c02e49b6-5c38-4fb0-a753-6ade6d6f4248': ('any', 'The YouTube short you saved as the kind of company you want to become', 'https://youtube.com/shorts/5LVSk_2HF2k?si=n0MyAq3UYgny0ESE'),
    'd16fe9ff-413c-47c4-ac53-c89e40d28489': ('tue', 'The YouTube short you saved to reskin as a "forgot to teach your AI" meme', 'https://youtube.com/shorts/tJwqPQvgQkk?is=MD4N2ZQuY488v1mB'),
    'da3cacd1-b038-4827-bd22-1d4d9be07889': ('thu', 'The Instagram reel you saved to copy and reskin', 'https://www.instagram.com/reel/DeR9G-JNf-8/?cplk=b2x4bXNtYzlidm1q'),
    'ca53cac9-d00d-49ed-8ea8-f17f61f602f4': ('fri', 'The research dossier you saved on times AI corrected what people believed', None),
    'dd93bfb1-20be-4c13-93b7-3c34ded7544b': ('wed', 'The DeepSeek post you saved on software that edits itself on the fly', 'https://www.instagram.com/evolving.ai/p/DfZlAbRAISa/'),
}
src = json.loads((W / 'sources.json').read_text())
ask_rows = {a['id']: a for a in src.get('asks') or []}
mc = {m['id']: m for m in src['must_cover']}
for aid in accounted:
    if aid in held_asks or aid not in ask_rows or not asks_words.get(aid):
        continue
    a = ask_rows[aid]
    what = (mc.get(aid) or {}).get('what') or a.get('name')
    held_asks[aid] = ('any', 'Your saved card ' + str(a.get('name')) + ': ' + (str(asks_words.get(aid) or '')[:70]).rstrip() + '...', a.get('url'))
TITLES = {
    'e73a0110-a108-456c-8781-350259b1b196': 'The Instagram reel you saved for its fast, eye-catching subtitles',
    '501c4fd1-4aa1-4cdd-b716-03e70c89c283': 'The Instagram reel you saved for its infographic style',
}
for aid, t in TITLES.items():
    if aid in held_asks:
        held_asks[aid] = (held_asks[aid][0], t, held_asks[aid][2])
held = []
for aid, (day, title, url) in held_asks.items():
    h = {'ref': f'ask/{aid}', 'day': day, 'title': title, 'reason': accounted[aid], 'said': asks_words.get(aid)}
    if url:
        h['source'] = {'label': title, 'url': url}
    held.append(h)
held += [
    {'ref': '2026-11-23/queue/wed-4', 'day': 'wed', 'title': 'Your sleep headband was training an AI on your brainwaves', 'reason': 'Held: you filed it to come back, and from this board the beat leaves out privacy and data stories (Ruling, Krish, 2026-11-24; config/beat.json); it waits for a creative-industry angle on wearables, or your "Offer it again".', 'said': 'I like this piece. Let\'s make sure it comes back next week.'},
    {'ref': '2026-11-23/queue/fri-5', 'day': 'fri', 'title': 'ChatGPT now answers with an app', 'reason': 'Already made: you filed it with its research, and it went out as Friday 27 November\'s piece (4f8f23b2).', 'said': 'Yes let\'s ask the 5 Whys or even the 10 Whys in a Perplexity prompt for this so that we are really clear on different angles on this. I\'ve already given you a bunch of inspiration and research to back this up so do not lose that file. File it for this piece and make sure it comes back next week.'},
]

split = [
    {'ref': '2026-11-23/queue/fri-5', 'parts': [{'kind': 'depth', 'quote': 'let\'s ask the 5 Whys or even the 10 Whys in a Perplexity prompt'}, {'kind': 'wish', 'quote': 'make sure it comes back next week'}]},
    {'ref': '2026-11-23/queue/wed-4', 'parts': [{'kind': 'wish', 'quote': 'Let\'s make sure it comes back next week.'}]},
    {'ref': '2026-11-23/queue/off-tue-teenhomework', 'parts': [{'kind': 'format', 'quote': 'combine it with the carousel that is already on there'}]},
]

ideas = {
    '_about': about,
    'week_start': '2026-11-30',
    'checked_on': '2026-11-26',
    'days': heroes,
    'offdays': off,
    'considered': {'mon': 8, 'wed': 7, 'fri': 8},
    'accounted': accounted,
    'held': held,
    'vetoes': [{'subject': 'Infosys', 'said': 'Told you already. Infosys is boring.', 'at': '2026-11-09', 'ref': '2026-11-16/queue/off-tue-infosys', 'day': 'tue'}],
    'split': split,
    'his_empty': {
        'mon': 'Nothing of his fits Monday: no idea from Krish since 15 Nov, and his open asks on money (ads in the chatbots) went out on the 23 Nov board.',
        'wed': 'Nothing of his fits Wednesday: his ask on software editing itself has no dated creative-industry story this fortnight (held, with his words).',
        'fri': 'Nothing of his fits Friday: his ask on AI correcting what people believed is held until a newer checked case lands.',
    },
}
for k in ('repeat_review',):
    if k in old:
        ideas[k] = old[k]
# Keep reads already recorded on an option when the file is rebuilt.
for side in ('days', 'offdays'):
    for day, opts in ideas[side].items():
        before = {o.get('id'): o for o in (old.get(side) or {}).get(day) or []}
        for o in opts:
            b = before.get(o.get('id')) or {}
            for f in ('read_back', 'story_score', 'wildcard_distance', 'rank', 'order'):
                if f in b and f not in o:
                    o[f] = b[f]
            if 'wildcard' in o and isinstance(b.get('wildcard'), dict) and 'distance' in b['wildcard']:
                o['wildcard']['distance'] = b['wildcard']['distance']
(W / 'ideas.json').write_text(json.dumps(ideas, indent=1, ensure_ascii=False) + '\n')
print('wrote ideas.json')
